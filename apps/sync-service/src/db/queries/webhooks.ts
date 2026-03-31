import type { Kysely } from 'kysely'
import type { Database } from '../client.js'
import type { WebhookRegistration } from '../schema.js'

/**
 * Get the webhook registration for a Figma file, if any.
 */
export async function getWebhookByFileKey(
  db: Kysely<Database>,
  figmaFileKey: string,
): Promise<WebhookRegistration | null> {
  const row = await db
    .selectFrom('webhook_registrations')
    .selectAll()
    .where('figma_file_key', '=', figmaFileKey)
    .executeTakeFirst()

  return row ?? null
}

/**
 * Record a successful Figma webhook registration.
 * Uses ON CONFLICT to handle the case where a row already exists
 * (e.g. a previous failed registration left a row behind).
 */
export async function upsertWebhookRegistration(
  db: Kysely<Database>,
  figmaFileKey: string,
  figmaWebhookId: string,
): Promise<WebhookRegistration> {
  return db
    .insertInto('webhook_registrations')
    .values({
      figma_file_key: figmaFileKey,
      figma_webhook_id: figmaWebhookId,
      is_active: true,
      registered_at: new Date(),
      last_registration_error: null,
    })
    .onConflict((oc) =>
      oc.column('figma_file_key').doUpdateSet({
        figma_webhook_id: figmaWebhookId,
        is_active: true,
        registered_at: new Date(),
        last_registration_error: null,
      }),
    )
    .returningAll()
    .executeTakeFirstOrThrow()
}

/**
 * Record a failed webhook registration attempt.
 * Leaves is_active = false and stores the error for ops visibility.
 */
export async function recordWebhookRegistrationFailure(
  db: Kysely<Database>,
  figmaFileKey: string,
  error: string,
): Promise<WebhookRegistration> {
  return db
    .insertInto('webhook_registrations')
    .values({
      figma_file_key: figmaFileKey,
      figma_webhook_id: null,
      is_active: false,
      last_registration_error: error,
    })
    .onConflict((oc) =>
      oc.column('figma_file_key').doUpdateSet({
        is_active: false,
        last_registration_error: error,
      }),
    )
    .returningAll()
    .executeTakeFirstOrThrow()
}

/**
 * Mark a webhook as inactive (deactivated, pending actual Figma deregistration).
 * Called synchronously when the last active link for a file is deleted.
 * Actual Figma API deregistration is deferred to polling-sync.
 */
export async function deactivateWebhook(
  db: Kysely<Database>,
  figmaFileKey: string,
): Promise<void> {
  await db
    .updateTable('webhook_registrations')
    .set({ is_active: false })
    .where('figma_file_key', '=', figmaFileKey)
    .execute()
}

/**
 * Update the last_event_received_at timestamp when a webhook event arrives.
 */
export async function touchWebhookLastReceived(
  db: Kysely<Database>,
  figmaFileKey: string,
): Promise<void> {
  await db
    .updateTable('webhook_registrations')
    .set({ last_event_received_at: new Date() })
    .where('figma_file_key', '=', figmaFileKey)
    .execute()
}

/**
 * Find all webhook rows that are inactive but still have a figma_webhook_id.
 * These are candidates for actual Figma API deregistration by polling-sync.
 */
export async function getWebhooksPendingDeregistration(
  db: Kysely<Database>,
): Promise<WebhookRegistration[]> {
  return db
    .selectFrom('webhook_registrations')
    .selectAll()
    .where('is_active', '=', false)
    .where('figma_webhook_id', 'is not', null)
    .execute()
}
