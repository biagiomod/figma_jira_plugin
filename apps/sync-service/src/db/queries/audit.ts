import type { Kysely } from 'kysely'
import type { Database } from '../client.js'
import type { AuditEventType } from '../schema.js'

interface WriteAuditEventParams {
  event_type: AuditEventType
  design_link_id?: string | null
  issue_key?: string | null
  jira_user?: string | null
  metadata?: Record<string, unknown>
}

/**
 * Append an audit event. Audit events are never updated or deleted.
 * Failures here should not propagate to the user — log and continue.
 */
export async function writeAuditEvent(
  db: Kysely<Database>,
  params: WriteAuditEventParams,
): Promise<void> {
  try {
    await db
      .insertInto('audit_events')
      .values({
        event_type: params.event_type,
        design_link_id: params.design_link_id ?? null,
        issue_key: params.issue_key ?? null,
        jira_user: params.jira_user ?? null,
        metadata: params.metadata ?? {},
      })
      .execute()
  } catch (err) {
    // Audit write failure must not break the primary operation
    console.error('[audit] Failed to write audit event:', err)
  }
}
