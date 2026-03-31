import { sql } from 'kysely'
import type { Kysely } from 'kysely'
import type { Database } from '../client.js'
import type { DesignLink, NewDesignLink } from '../schema.js'

/**
 * Fetch all active (non-deleted) design links for a Jira issue.
 * Ordered by linked_at ascending (oldest link first, stable display order).
 */
export async function getLinksByIssueKey(
  db: Kysely<Database>,
  issueKey: string,
): Promise<DesignLink[]> {
  return db
    .selectFrom('design_links')
    .selectAll()
    .where('issue_key', '=', issueKey)
    .where('deleted_at', 'is', null)
    .orderBy('linked_at', 'asc')
    .execute()
}

/**
 * Fetch a single active design link by ID.
 * Returns null if not found or soft-deleted.
 */
export async function getLinkById(
  db: Kysely<Database>,
  linkId: string,
): Promise<DesignLink | null> {
  const row = await db
    .selectFrom('design_links')
    .selectAll()
    .where('id', '=', linkId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst()

  return row ?? null
}

/**
 * Insert a new design link and return the created row.
 * Use upsertLink for idempotent create-or-return behaviour.
 */
export async function insertLink(
  db: Kysely<Database>,
  values: Omit<NewDesignLink, 'id' | 'linked_at' | 'updated_at'>,
): Promise<DesignLink> {
  const row = await db
    .insertInto('design_links')
    .values(values)
    .returningAll()
    .executeTakeFirstOrThrow()

  return row
}

/**
 * Upsert a design link based on logical resource identity.
 * If an active link already exists for the same (issue_key, figma_file_key,
 * figma_node_id, resource_type), returns the existing row without modification.
 * If a soft-deleted row exists, re-activates it with updated metadata.
 *
 * This is the primary create path — callers should use this, not insertLink directly.
 */
export async function upsertLink(
  db: Kysely<Database>,
  values: Omit<NewDesignLink, 'id' | 'linked_at' | 'updated_at'>,
): Promise<{ link: DesignLink; created: boolean }> {
  // Check for existing active link
  const existing = await db
    .selectFrom('design_links')
    .selectAll()
    .where('issue_key', '=', values.issue_key)
    .where('figma_file_key', '=', values.figma_file_key)
    .where(
      'figma_node_id',
      values.figma_node_id === null ? 'is' : '=',
      values.figma_node_id as string,
    )
    .where('resource_type', '=', values.resource_type)
    .where('deleted_at', 'is', null)
    .executeTakeFirst()

  if (existing) {
    return { link: existing, created: false }
  }

  // Check for soft-deleted link and re-activate
  const deleted = await db
    .selectFrom('design_links')
    .selectAll()
    .where('issue_key', '=', values.issue_key)
    .where('figma_file_key', '=', values.figma_file_key)
    .where(
      'figma_node_id',
      values.figma_node_id === null ? 'is' : '=',
      values.figma_node_id as string,
    )
    .where('resource_type', '=', values.resource_type)
    .where('deleted_at', 'is not', null)
    .orderBy('deleted_at', 'desc')
    .executeTakeFirst()

  if (deleted) {
    const reactivated = await db
      .updateTable('design_links')
      .set({
        ...values,
        deleted_at: null,
        design_status: 'NONE',
        updated_at: new Date(),
      })
      .where('id', '=', deleted.id)
      .returningAll()
      .executeTakeFirstOrThrow()

    return { link: reactivated, created: true }
  }

  // Insert new
  const created = await insertLink(db, values)
  return { link: created, created: true }
}

/**
 * Soft-delete a design link. Returns the updated row, or null if not found.
 */
export async function softDeleteLink(
  db: Kysely<Database>,
  linkId: string,
): Promise<DesignLink | null> {
  const row = await db
    .updateTable('design_links')
    .set({ deleted_at: new Date(), updated_at: new Date() })
    .where('id', '=', linkId)
    .where('deleted_at', 'is', null)
    .returningAll()
    .executeTakeFirst()

  return row ?? null
}

/**
 * Update design_status for a link.
 * Returns the updated row, or null if not found / already deleted.
 */
export async function updateLinkStatus(
  db: Kysely<Database>,
  linkId: string,
  status: DesignLink['design_status'],
): Promise<DesignLink | null> {
  const row = await db
    .updateTable('design_links')
    .set({ design_status: status, updated_at: new Date() })
    .where('id', '=', linkId)
    .where('deleted_at', 'is', null)
    .returningAll()
    .executeTakeFirst()

  return row ?? null
}

/**
 * Update cached Figma metadata for a link (file_name, node_name,
 * thumbnail_s3_key, last_modified_at). Used by sync jobs.
 */
export async function updateLinkMetadata(
  db: Kysely<Database>,
  linkId: string,
  updates: {
    file_name: string
    node_name: string | null
    thumbnail_s3_key: string | null
    last_modified_at: Date
  },
): Promise<DesignLink | null> {
  const row = await db
    .updateTable('design_links')
    .set({ ...updates, updated_at: new Date() })
    .where('id', '=', linkId)
    .where('deleted_at', 'is', null)
    .returningAll()
    .executeTakeFirst()

  return row ?? null
}

/**
 * Get all active links for a given Figma file key.
 * Used by webhook-handler to fan out processing across all affected links.
 */
export async function getLinksByFileKey(
  db: Kysely<Database>,
  figmaFileKey: string,
): Promise<DesignLink[]> {
  return db
    .selectFrom('design_links')
    .selectAll()
    .where('figma_file_key', '=', figmaFileKey)
    .where('deleted_at', 'is', null)
    .execute()
}

/**
 * Count active links for a Figma file key.
 * Used to decide whether to deregister a webhook after a link is deleted.
 */
export async function countActiveLinksByFileKey(
  db: Kysely<Database>,
  figmaFileKey: string,
): Promise<number> {
  const result = await db
    .selectFrom('design_links')
    .select(db.fn.count<string>('id').as('count'))
    .where('figma_file_key', '=', figmaFileKey)
    .where('deleted_at', 'is', null)
    .executeTakeFirstOrThrow()

  return parseInt(result.count, 10)
}

/**
 * Sync-assisted status transition: READY_FOR_DEV → CHANGES_AFTER_DEV.
 * Only applied when sync detects a change and current status is READY_FOR_DEV.
 * This is the one automatic status transition documented in the spec.
 */
export async function transitionToChangesAfterDevIfReady(
  db: Kysely<Database>,
  linkId: string,
): Promise<DesignLink | null> {
  const row = await db
    .updateTable('design_links')
    .set({ design_status: 'CHANGES_AFTER_DEV', updated_at: new Date() })
    .where('id', '=', linkId)
    .where('design_status', '=', 'READY_FOR_DEV')
    .where('deleted_at', 'is', null)
    .returningAll()
    .executeTakeFirst()

  return row ?? null
}

/**
 * Fetch links due for a sync sweep.
 * Returns active links whose next_sync_at is in the past (or null = never synced).
 * Joins through sync_state to read next_sync_at.
 */
export async function getLinksDueForSync(
  db: Kysely<Database>,
  limit: number,
): Promise<Array<DesignLink & { sync_state_id: string }>> {
  return db
    .selectFrom('design_links as dl')
    .innerJoin('sync_state as ss', 'ss.design_link_id', 'dl.id')
    .selectAll('dl')
    .select('ss.id as sync_state_id')
    .where('dl.deleted_at', 'is', null)
    .where((eb) =>
      eb.or([
        eb('ss.next_sync_at', 'is', null),
        eb('ss.next_sync_at', '<=', sql<Date>`NOW()`),
      ]),
    )
    .orderBy('ss.next_sync_at', 'asc')
    .limit(limit)
    .execute() as Promise<Array<DesignLink & { sync_state_id: string }>>
}
