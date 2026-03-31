import type { ScheduledEvent, Context } from 'aws-lambda'
import { getDb } from '../db/client.js'
import { getLinksDueForSync } from '../db/queries/links.js'
import { getWebhooksPendingDeregistration, deactivateWebhook } from '../db/queries/webhooks.js'
import { writeAuditEvent } from '../db/queries/audit.js'
import { syncLink } from '../services/sync-service.js'
import { deregisterWebhook } from '../services/figma-client.js'

const BATCH_SIZE = 50

/**
 * polling-sync — EventBridge cron-triggered Lambda.
 *
 * Responsibilities:
 *   1. Sweep design links whose next_sync_at is due → call syncLink() for each
 *   2. Deregister inactive webhooks with Figma (deferred from delete operations)
 *
 * Figma API rate limit note: the Figma API does not publish hard rate limit numbers.
 * This handler processes links sequentially (not in parallel) to avoid bursts.
 * If Figma returns 429 on a link, syncLink() records FIGMA_429 in sync_state
 * and the backoff scheduling prevents an immediate retry.
 *
 * TODO: If the link count grows large enough that a single Lambda invocation
 * cannot process all due links within the EventBridge schedule interval,
 * add pagination (store a cursor) or switch to a fan-out pattern.
 */
export const handler = async (
  _event: ScheduledEvent,
  context: Context,
): Promise<void> => {
  const startedAt = Date.now()
  const db = await getDb()

  console.info('[polling-sync] Starting sync sweep')

  // --- Step 1: Sync links due for refresh ---
  const linksDue = await getLinksDueForSync(db, BATCH_SIZE)
  console.info(`[polling-sync] Found ${linksDue.length} links due for sync`)

  let synced = 0
  let changed = 0

  for (const link of linksDue) {
    // Stop if we're within 30 seconds of the Lambda timeout to allow graceful exit
    const remainingMs = context.getRemainingTimeInMillis()
    if (remainingMs < 30_000) {
      console.warn('[polling-sync] Approaching Lambda timeout — stopping early')
      break
    }

    const didChange = await syncLink(db, link)
    synced++
    if (didChange) changed++

    // Brief pause between Figma API calls to avoid rate limit bursts
    // TODO: Tune this based on observed Figma API behaviour
    await sleep(200)
  }

  console.info(`[polling-sync] Sync sweep complete: ${synced} synced, ${changed} changed`)

  // --- Step 2: Deregister inactive webhooks ---
  const pendingDeregistration = await getWebhooksPendingDeregistration(db)
  console.info(`[polling-sync] Found ${pendingDeregistration.length} webhooks pending deregistration`)

  for (const webhook of pendingDeregistration) {
    if (!webhook.figma_webhook_id) continue

    try {
      await deregisterWebhook(webhook.figma_webhook_id)
      // Mark figma_webhook_id as cleared so we don't retry on next sweep
      await db
        .updateTable('webhook_registrations')
        .set({ figma_webhook_id: null })
        .where('id', '=', webhook.id)
        .execute()

      await writeAuditEvent(db, {
        event_type: 'WEBHOOK_DEREGISTERED',
        metadata: {
          figma_file_key: webhook.figma_file_key,
          figma_webhook_id: webhook.figma_webhook_id,
        },
      })

      console.info(`[polling-sync] Deregistered webhook for ${webhook.figma_file_key}`)
    } catch (err) {
      // Log and continue — will retry on next sweep
      console.error(
        `[polling-sync] Failed to deregister webhook ${webhook.figma_webhook_id}:`,
        err,
      )
    }
  }

  const elapsed = Date.now() - startedAt
  console.info(`[polling-sync] Finished in ${elapsed}ms`)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
