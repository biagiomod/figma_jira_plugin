import type { Kysely } from 'kysely'
import type { Database } from '../db/client.js'
import type { DesignLink } from '../db/schema.js'
import { getLinksByFileKey, transitionToChangesAfterDevIfReady, updateLinkMetadata } from '../db/queries/links.js'
import { markSyncSuccess, markSyncFailed, getSyncStateByLinkId } from '../db/queries/sync-state.js'
import { touchWebhookLastReceived } from '../db/queries/webhooks.js'
import { writeAuditEvent } from '../db/queries/audit.js'
import { fetchResourceMetadata } from './figma-client.js'
import { storeThumbnail } from './thumbnail-service.js'
import { SyncErrorCode } from '@figma-jira/shared-types'
import {
  FigmaRateLimitedError,
  FigmaAccessDeniedError,
  FigmaResourceNotFoundError,
  AppError,
} from '../lib/errors.js'

/**
 * Classify a sync error into a SyncErrorCode for storage in sync_state.
 */
function classifySyncError(err: unknown): SyncErrorCode {
  if (err instanceof FigmaRateLimitedError) return SyncErrorCode.FIGMA_429
  if (err instanceof FigmaAccessDeniedError) return SyncErrorCode.FIGMA_403
  if (err instanceof FigmaResourceNotFoundError) return SyncErrorCode.FIGMA_404
  if (err instanceof AppError) return SyncErrorCode.UNKNOWN
  return SyncErrorCode.NETWORK
}

/**
 * Sync a single design link: fetch latest Figma metadata, compare
 * last_modified_at, refresh thumbnail if changed, update sync_state.
 *
 * Applies the one automatic status transition:
 *   READY_FOR_DEV → CHANGES_AFTER_DEV when a design change is detected.
 *
 * Returns true if a change was detected.
 */
export async function syncLink(
  db: Kysely<Database>,
  link: DesignLink,
): Promise<boolean> {
  const syncState = await getSyncStateByLinkId(db, link.id)
  if (!syncState) {
    console.warn(`[sync] No sync_state found for link ${link.id} — skipping`)
    return false
  }

  let changeDetected = false

  try {
    const metadata = await fetchResourceMetadata(link.figma_file_key, link.figma_node_id)
    const remoteLastModified = new Date(metadata.lastModifiedAt)
    const storedLastModified = link.last_modified_at

    changeDetected = remoteLastModified > storedLastModified

    // Always refresh thumbnail if changed (overwrite S3 object)
    let thumbnailS3Key = link.thumbnail_s3_key
    if (changeDetected && metadata.thumbnailUrl) {
      const stored = await storeThumbnail(
        link.figma_file_key,
        link.figma_node_id,
        metadata.thumbnailUrl,
      )
      if (stored) thumbnailS3Key = stored
    }

    // Update metadata in DB
    await updateLinkMetadata(db, link.id, {
      file_name: metadata.fileName,
      node_name: metadata.nodeName,
      thumbnail_s3_key: thumbnailS3Key,
      last_modified_at: remoteLastModified,
    })

    // Apply automatic status transition if design changed after being marked ready
    if (changeDetected) {
      await transitionToChangesAfterDevIfReady(db, link.id)

      await writeAuditEvent(db, {
        event_type: 'DESIGN_CHANGED',
        design_link_id: link.id,
        issue_key: link.issue_key,
        metadata: {
          previous_last_modified: storedLastModified.toISOString(),
          new_last_modified: remoteLastModified.toISOString(),
        },
      })
    }

    await markSyncSuccess(db, syncState.id, changeDetected ? new Date() : undefined)

    await writeAuditEvent(db, {
      event_type: 'SYNC_COMPLETED',
      design_link_id: link.id,
      issue_key: link.issue_key,
      metadata: { status: 'success', change_detected: changeDetected },
    })
  } catch (err) {
    const code = classifySyncError(err)
    const message = err instanceof Error ? err.message : String(err)

    await markSyncFailed(db, syncState.id, syncState.sync_attempts, code, message)

    await writeAuditEvent(db, {
      event_type: 'SYNC_COMPLETED',
      design_link_id: link.id,
      issue_key: link.issue_key,
      metadata: { status: 'failed', error_code: code, error: message },
    })

    console.error(`[sync] Failed to sync link ${link.id} (${code}): ${message}`)
  }

  return changeDetected
}

/**
 * Process a Figma webhook event for a file.
 * Finds all active links for the file and syncs each one.
 *
 * Design note: this function is intentionally separated from the handler
 * so a queue consumer (e.g. SQS Lambda) can call it directly without
 * touching the HTTP layer. Adding a queue later requires only changing
 * what calls this function — not the function itself.
 *
 * Returns a summary of processed links.
 */
export async function processWebhookEvent(
  db: Kysely<Database>,
  figmaFileKey: string,
): Promise<{ processed: number; changed: number }> {
  const links = await getLinksByFileKey(db, figmaFileKey)

  await touchWebhookLastReceived(db, figmaFileKey)

  let changed = 0
  for (const link of links) {
    const didChange = await syncLink(db, link)
    if (didChange) changed++
  }

  return { processed: links.length, changed }
}
