import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { getDb } from '../db/client.js'
import { getSecrets } from '../lib/secrets.js'
import { InvalidWebhookPasscodeError } from '../lib/errors.js'
import { writeAuditEvent } from '../db/queries/audit.js'
import { processWebhookEvent } from '../services/sync-service.js'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

/**
 * Figma webhook payload (v2 API, FILE_UPDATE event type).
 * Only the fields we care about are typed here — the full payload may
 * contain additional fields that we intentionally ignore.
 *
 * Figma docs: https://www.figma.com/developers/api#webhooks_v2
 */
interface FigmaWebhookPayload {
  event_type: string
  file_key?: string
  passcode?: string
  timestamp?: string
  webhook_id?: string
  description?: string
}

/**
 * webhook-handler — receives Figma FILE_UPDATE events.
 *
 * Auth: Figma passcode in request body (NOT x-api-key).
 * This endpoint is publicly reachable by Figma's servers.
 *
 * Processing: inline for MVP (no queue).
 *
 * Architecture note: processWebhookEvent() is intentionally separated
 * from this handler. When/if a queue (SQS) is added later, only this
 * handler changes — processWebhookEvent() becomes the queue consumer
 * without any modification to the core sync logic.
 *
 * To add SQS:
 *   1. Replace the processWebhookEvent() call below with an SQS.sendMessage()
 *   2. Create a new Lambda triggered by the SQS queue that calls processWebhookEvent()
 *   3. No changes required to processWebhookEvent() itself
 */
export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  let payload: FigmaWebhookPayload
  try {
    payload = JSON.parse(event.body ?? '{}') as FigmaWebhookPayload
  } catch {
    return {
      statusCode: 400,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: { code: 'INVALID_BODY', message: 'Request body is not valid JSON' } }),
    }
  }

  // Validate passcode before any processing
  try {
    await validatePasscode(payload.passcode)
  } catch {
    return {
      statusCode: 401,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: { code: 'INVALID_WEBHOOK_PASSCODE', message: 'Invalid or missing webhook passcode' } }),
    }
  }

  const fileKey = payload.file_key
  const eventType = payload.event_type

  // Respond 200 immediately — Figma expects a fast response
  // Processing happens synchronously within this Lambda invocation (MVP).
  // TODO: If processing latency becomes a concern, move processWebhookEvent()
  //       to an SQS-triggered consumer Lambda (see architecture note above).

  if (!fileKey) {
    console.warn('[webhook] Received event with no file_key, ignoring:', eventType)
    return { statusCode: 200, body: JSON.stringify({ received: true }) }
  }

  const db = await getDb()

  await writeAuditEvent(db, {
    event_type: 'WEBHOOK_RECEIVED',
    metadata: {
      figma_event_type: eventType,
      figma_file_key: fileKey,
      figma_webhook_id: payload.webhook_id,
      timestamp: payload.timestamp,
    },
  })

  // Only process FILE_UPDATE events for now
  if (eventType !== 'FILE_UPDATE') {
    console.info(`[webhook] Ignoring unhandled event type: ${eventType}`)
    return { statusCode: 200, body: JSON.stringify({ received: true }) }
  }

  try {
    const result = await processWebhookEvent(db, fileKey)
    console.info(`[webhook] Processed FILE_UPDATE for ${fileKey}: ${result.processed} links, ${result.changed} changed`)
  } catch (err) {
    // Do not let processing errors fail the 200 response to Figma.
    // Figma will retry on non-200 responses — we do not want retry loops
    // for processing errors (e.g. transient DB issues).
    // The audit event and sync_state already record the failure.
    console.error(`[webhook] Processing error for file ${fileKey}:`, err)
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) }
}

async function validatePasscode(provided: string | undefined): Promise<void> {
  if (!provided) throw new InvalidWebhookPasscodeError()
  const secrets = await getSecrets()
  if (provided !== secrets.figmaWebhookPasscode) throw new InvalidWebhookPasscodeError()
}
