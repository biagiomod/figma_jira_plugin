import type { Kysely } from 'kysely'
import type { LinkDto, ResourceType, DesignStatus } from '@figma-jira/shared-types'
import type { Database } from '../db/client.js'
import type { DesignLink } from '../db/schema.js'
import {
  countActiveLinksByFileKey,
  getLinksByIssueKey,
  getLinkById,
  upsertLink,
  softDeleteLink,
  updateLinkStatus,
  updateLinkMetadata,
} from '../db/queries/links.js'
import { createInitialSyncState } from '../db/queries/sync-state.js'
import {
  getWebhookByFileKey,
  upsertWebhookRegistration,
  recordWebhookRegistrationFailure,
  deactivateWebhook,
} from '../db/queries/webhooks.js'
import { writeAuditEvent } from '../db/queries/audit.js'
import { parseFigmaUrl } from '../lib/figma-url.js'
import { fetchResourceMetadata } from './figma-client.js'
import { storeThumbnail, getSignedThumbnailUrl } from './thumbnail-service.js'
import { LinkNotFoundError } from '../lib/errors.js'

// Injected at runtime — avoids circular dependency with figma-client
// TODO: Make this injectable via parameter for easier testing
const WEBHOOK_ENDPOINT_URL = process.env['WEBHOOK_ENDPOINT_URL'] ?? ''

/**
 * Convert a DB row + signed URL into the LinkDto returned to callers.
 */
export async function toLinkDto(link: DesignLink): Promise<LinkDto> {
  const signedUrl = await getSignedThumbnailUrl(link.thumbnail_s3_key)
  return {
    id: link.id,
    issue_key: link.issue_key,
    figma_url: link.figma_url,
    figma_file_key: link.figma_file_key,
    figma_node_id: link.figma_node_id,
    resource_type: link.resource_type as ResourceType,
    design_status: link.design_status as DesignStatus,
    file_name: link.file_name,
    node_name: link.node_name,
    thumbnail_signed_url: signedUrl,
    last_modified_at: link.last_modified_at.toISOString(),
    last_synced_at: null,  // TODO: join with sync_state in a follow-up for richer responses
    linked_by_jira_user: link.linked_by_jira_user,
    linked_at: link.linked_at.toISOString(),
  }
}

/**
 * Get all active design links for a Jira issue, with signed thumbnail URLs.
 */
export async function getLinksForIssue(
  db: Kysely<Database>,
  issueKey: string,
): Promise<LinkDto[]> {
  const links = await getLinksByIssueKey(db, issueKey)
  return Promise.all(links.map(toLinkDto))
}

/**
 * Create a new design link (or return existing if already linked).
 *
 * Steps:
 * 1. Parse and validate the Figma URL
 * 2. Fetch Figma metadata + thumbnail URL
 * 3. Store thumbnail in S3 (non-fatal if this fails)
 * 4. Upsert design_links + sync_state in a transaction
 * 5. Register Figma webhook if not already registered
 * 6. Write LINK_CREATED audit event
 * 7. Return LinkDto
 */
export async function createLink(
  db: Kysely<Database>,
  issueKey: string,
  figmaUrl: string,
  jiraUser: string,
): Promise<LinkDto> {
  const urlParts = parseFigmaUrl(figmaUrl)

  // Fetch Figma metadata (may throw FigmaAccessDeniedError, FigmaResourceNotFoundError, etc.)
  const metadata = await fetchResourceMetadata(urlParts.fileKey, urlParts.nodeId)

  // Store thumbnail in S3
  let thumbnailS3Key: string | null = null
  if (metadata.thumbnailUrl) {
    thumbnailS3Key = await storeThumbnail(urlParts.fileKey, urlParts.nodeId, metadata.thumbnailUrl)
  }

  // Upsert design_links + sync_state atomically
  let linkId: string
  await db.transaction().execute(async (trx) => {
    const { link, created } = await upsertLink(trx, {
      issue_key: issueKey,
      figma_url: figmaUrl,
      figma_file_key: urlParts.fileKey,
      figma_node_id: urlParts.nodeId,
      resource_type: urlParts.resourceType,
      design_status: 'NONE',
      file_name: metadata.fileName,
      node_name: metadata.nodeName,
      thumbnail_s3_key: thumbnailS3Key,
      last_modified_at: new Date(metadata.lastModifiedAt),
      linked_by_jira_user: jiraUser,
      deleted_at: null,
    })

    linkId = link.id

    if (created) {
      await createInitialSyncState(trx, link.id)
    }
  })

  // Register webhook (after transaction — not part of the atomic operation)
  await ensureWebhookRegistered(db, urlParts.fileKey)

  // Audit
  await writeAuditEvent(db, {
    event_type: 'LINK_CREATED',
    design_link_id: linkId!,
    issue_key: issueKey,
    jira_user: jiraUser,
  })

  const link = await getLinkById(db, linkId!)
  if (!link) throw new Error('Link not found immediately after creation — this should never happen')

  return toLinkDto(link)
}

/**
 * Soft-delete a design link.
 * If it was the last active link for its Figma file, deactivates the webhook
 * (actual Figma API deregistration is deferred to polling-sync).
 */
export async function deleteLink(
  db: Kysely<Database>,
  linkId: string,
  jiraUser: string,
): Promise<void> {
  const link = await getLinkById(db, linkId)
  if (!link) throw new LinkNotFoundError(linkId)

  const deleted = await softDeleteLink(db, linkId)
  if (!deleted) throw new LinkNotFoundError(linkId)

  // Deactivate webhook if no more active links for this file
  const remaining = await countActiveLinksByFileKey(db, link.figma_file_key)
  if (remaining === 0) {
    await deactivateWebhook(db, link.figma_file_key)
  }

  await writeAuditEvent(db, {
    event_type: 'LINK_DELETED',
    design_link_id: linkId,
    issue_key: link.issue_key,
    jira_user: jiraUser,
  })
}

/**
 * Update the design_status for a link.
 * Any status value is accepted from the API — business rules enforced in UI.
 * The one sync-assisted transition (READY_FOR_DEV → CHANGES_AFTER_DEV) is
 * triggered by sync-service.ts, not here.
 */
export async function setLinkStatus(
  db: Kysely<Database>,
  linkId: string,
  status: DesignStatus,
  jiraUser: string,
): Promise<LinkDto> {
  const link = await getLinkById(db, linkId)
  if (!link) throw new LinkNotFoundError(linkId)

  const previousStatus = link.design_status

  // No-op if status hasn't changed
  if (previousStatus === status) {
    return toLinkDto(link)
  }

  const updated = await updateLinkStatus(db, linkId, status)
  if (!updated) throw new LinkNotFoundError(linkId)

  await writeAuditEvent(db, {
    event_type: 'STATUS_CHANGED',
    design_link_id: linkId,
    issue_key: link.issue_key,
    jira_user: jiraUser,
    metadata: { from: previousStatus, to: status },
  })

  return toLinkDto(updated)
}

/**
 * Refresh a single link's metadata and thumbnail from Figma on demand.
 * Called by the manual "refresh now" endpoint.
 */
export async function refreshLink(
  db: Kysely<Database>,
  linkId: string,
): Promise<LinkDto> {
  const link = await getLinkById(db, linkId)
  if (!link) throw new LinkNotFoundError(linkId)

  const metadata = await fetchResourceMetadata(link.figma_file_key, link.figma_node_id)

  let thumbnailS3Key = link.thumbnail_s3_key
  if (metadata.thumbnailUrl) {
    const stored = await storeThumbnail(
      link.figma_file_key,
      link.figma_node_id,
      metadata.thumbnailUrl,
    )
    if (stored) thumbnailS3Key = stored
  }

  const updated = await updateLinkMetadata(db, linkId, {
    file_name: metadata.fileName,
    node_name: metadata.nodeName,
    thumbnail_s3_key: thumbnailS3Key,
    last_modified_at: new Date(metadata.lastModifiedAt),
  })

  return toLinkDto(updated ?? link)
}

/**
 * Ensure a Figma webhook is registered for a file.
 * No-op if an active registration already exists.
 * Registration failure is logged but does not block the link creation.
 */
async function ensureWebhookRegistered(
  db: Kysely<Database>,
  figmaFileKey: string,
): Promise<void> {
  const existing = await getWebhookByFileKey(db, figmaFileKey)
  if (existing?.is_active) return

  if (!WEBHOOK_ENDPOINT_URL) {
    console.warn('[links-service] WEBHOOK_ENDPOINT_URL not set — skipping webhook registration')
    return
  }

  try {
    const { registerWebhook } = await import('./figma-client.js')
    const { getSecrets } = await import('../lib/secrets.js')
    const secrets = await getSecrets()

    const webhookId = await registerWebhook(
      figmaFileKey,
      WEBHOOK_ENDPOINT_URL,
      secrets.figmaWebhookPasscode,
    )

    await upsertWebhookRegistration(db, figmaFileKey, webhookId)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[links-service] Webhook registration failed for ${figmaFileKey}:`, message)
    await recordWebhookRegistrationFailure(db, figmaFileKey, message)
    // Non-fatal: polling will still sync the link; webhook is best-effort
  }
}
