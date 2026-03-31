import type { Kysely } from 'kysely'
import type { Database } from '../client.js'
import type { SyncState } from '../schema.js'
import { config } from '../../config.js'

/**
 * Create an initial sync_state row for a newly created design link.
 * Called in the same transaction as design_links insert.
 * next_sync_at = NOW() so the polling sweep picks it up immediately.
 */
export async function createInitialSyncState(
  db: Kysely<Database>,
  designLinkId: string,
): Promise<SyncState> {
  return db
    .insertInto('sync_state')
    .values({
      design_link_id: designLinkId,
      sync_status: 'PENDING',
      next_sync_at: new Date(),
    })
    .returningAll()
    .executeTakeFirstOrThrow()
}

/**
 * Mark a sync as succeeded. Resets sync_attempts and sets next_sync_at
 * to the regular polling interval from now.
 */
export async function markSyncSuccess(
  db: Kysely<Database>,
  syncStateId: string,
  changeDetectedAt?: Date,
): Promise<SyncState> {
  const nextSyncAt = new Date(
    Date.now() + config.pollingIntervalMinutes * 60 * 1_000,
  )

  return db
    .updateTable('sync_state')
    .set({
      sync_status: 'SUCCESS',
      last_synced_at: new Date(),
      next_sync_at: nextSyncAt,
      sync_error: null,
      sync_error_code: null,
      sync_attempts: 0,
      ...(changeDetectedAt ? { change_detected_at: changeDetectedAt } : {}),
    })
    .where('id', '=', syncStateId)
    .returningAll()
    .executeTakeFirstOrThrow()
}

/**
 * Mark a sync as failed. Increments sync_attempts and applies exponential
 * backoff to next_sync_at, capped at SYNC_BACKOFF_MAX_SECONDS.
 */
export async function markSyncFailed(
  db: Kysely<Database>,
  syncStateId: string,
  currentAttempts: number,
  errorCode: string,
  errorMessage: string,
): Promise<SyncState> {
  const attempts = currentAttempts + 1
  const backoffMs = Math.min(
    Math.pow(2, attempts) * config.syncBackoffBaseSeconds * 1_000,
    config.syncBackoffMaxSeconds * 1_000,
  )
  const nextSyncAt = new Date(Date.now() + backoffMs)

  return db
    .updateTable('sync_state')
    .set({
      sync_status: 'FAILED',
      last_synced_at: new Date(),
      next_sync_at: nextSyncAt,
      sync_error: errorMessage,
      sync_error_code: errorCode,
      sync_attempts: attempts,
    })
    .where('id', '=', syncStateId)
    .returningAll()
    .executeTakeFirstOrThrow()
}

/**
 * Fetch the sync_state row for a design link.
 */
export async function getSyncStateByLinkId(
  db: Kysely<Database>,
  designLinkId: string,
): Promise<SyncState | null> {
  const row = await db
    .selectFrom('sync_state')
    .selectAll()
    .where('design_link_id', '=', designLinkId)
    .executeTakeFirst()

  return row ?? null
}
