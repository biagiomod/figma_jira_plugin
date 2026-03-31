import type { Generated, Selectable, Insertable, Updateable } from 'kysely'

/**
 * Kysely table type definitions.
 * These mirror the SQL schema in migrations/001_initial_schema.sql exactly.
 * If you change the SQL, update these types to match.
 */

// ------------------------------------------------------------------
// design_links
// ------------------------------------------------------------------

export interface DesignLinksTable {
  id: Generated<string>
  issue_key: string
  figma_url: string
  figma_file_key: string
  figma_node_id: string | null
  resource_type: 'FILE' | 'FRAME' | 'PROTOTYPE' | 'FIGJAM'
  design_status: 'NONE' | 'IN_PROGRESS' | 'READY_FOR_DEV' | 'CHANGES_AFTER_DEV'
  file_name: string
  node_name: string | null
  thumbnail_s3_key: string | null
  last_modified_at: Date
  linked_by_jira_user: string
  linked_at: Generated<Date>
  updated_at: Generated<Date>
  deleted_at: Date | null
}

export type DesignLink = Selectable<DesignLinksTable>
export type NewDesignLink = Insertable<DesignLinksTable>
export type DesignLinkUpdate = Updateable<DesignLinksTable>

// ------------------------------------------------------------------
// sync_state
// ------------------------------------------------------------------

export interface SyncStateTable {
  id: Generated<string>
  design_link_id: string
  last_synced_at: Date | null
  next_sync_at: Date | null
  sync_status: 'PENDING' | 'SUCCESS' | 'FAILED'
  sync_error: string | null
  sync_error_code: string | null
  change_detected_at: Date | null
  sync_attempts: Generated<number>
}

export type SyncState = Selectable<SyncStateTable>
export type NewSyncState = Insertable<SyncStateTable>
export type SyncStateUpdate = Updateable<SyncStateTable>

// ------------------------------------------------------------------
// webhook_registrations
// ------------------------------------------------------------------

export interface WebhookRegistrationsTable {
  id: Generated<string>
  figma_file_key: string
  figma_webhook_id: string | null
  is_active: boolean
  registered_at: Date | null
  last_event_received_at: Date | null
  last_registration_error: string | null
}

export type WebhookRegistration = Selectable<WebhookRegistrationsTable>
export type NewWebhookRegistration = Insertable<WebhookRegistrationsTable>
export type WebhookRegistrationUpdate = Updateable<WebhookRegistrationsTable>

// ------------------------------------------------------------------
// audit_events
// ------------------------------------------------------------------

export interface AuditEventsTable {
  id: Generated<string>
  event_type:
    | 'LINK_CREATED'
    | 'LINK_DELETED'
    | 'STATUS_CHANGED'
    | 'SYNC_COMPLETED'
    | 'DESIGN_CHANGED'
    | 'WEBHOOK_RECEIVED'
    | 'WEBHOOK_REGISTERED'
    | 'WEBHOOK_DEREGISTERED'
  design_link_id: string | null
  issue_key: string | null
  jira_user: string | null
  metadata: unknown  // JSONB — use typed accessors at call sites
  created_at: Generated<Date>
}

export type AuditEvent = Selectable<AuditEventsTable>
export type NewAuditEvent = Insertable<AuditEventsTable>
export type AuditEventType = AuditEventsTable['event_type']
