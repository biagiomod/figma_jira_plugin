/**
 * The type of Figma resource being linked.
 * Maps to the URL path segment and determines how the resource is displayed.
 */
export enum ResourceType {
  FILE = 'FILE',
  FRAME = 'FRAME',
  PROTOTYPE = 'PROTOTYPE',
  FIGJAM = 'FIGJAM',
}

/**
 * Design status set manually by users in the Jira panel.
 *
 * Ownership rule: status is always user-set EXCEPT for the single automatic
 * transition READY_FOR_DEV → CHANGES_AFTER_DEV, which sync triggers when it
 * detects a design change after the status was marked ready.
 */
export enum DesignStatus {
  NONE = 'NONE',
  IN_PROGRESS = 'IN_PROGRESS',
  READY_FOR_DEV = 'READY_FOR_DEV',
  CHANGES_AFTER_DEV = 'CHANGES_AFTER_DEV',
}

/**
 * Current sync state for a design link's sync_state row.
 * PENDING = newly created or queued, not yet processed.
 * SUCCESS = last sync succeeded.
 * FAILED  = last sync failed; next_sync_at will reflect backoff.
 */
export enum SyncStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

/**
 * Machine-readable error codes stored in sync_state.sync_error_code.
 * Used for triage without parsing free-text error messages.
 */
export enum SyncErrorCode {
  FIGMA_429 = 'FIGMA_429',
  FIGMA_403 = 'FIGMA_403',
  FIGMA_404 = 'FIGMA_404',
  NETWORK = 'NETWORK',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Audit event types written to audit_events.
 * SYNC_COMPLETED covers both success and failure (distinguish via metadata.status).
 */
export enum AuditEventType {
  LINK_CREATED = 'LINK_CREATED',
  LINK_DELETED = 'LINK_DELETED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  SYNC_COMPLETED = 'SYNC_COMPLETED',
  DESIGN_CHANGED = 'DESIGN_CHANGED',
  WEBHOOK_RECEIVED = 'WEBHOOK_RECEIVED',
  WEBHOOK_REGISTERED = 'WEBHOOK_REGISTERED',
  WEBHOOK_DEREGISTERED = 'WEBHOOK_DEREGISTERED',
}

/**
 * API-level error codes returned in error response bodies.
 * These are stable strings safe to check programmatically.
 */
export enum ApiErrorCode {
  INVALID_FIGMA_URL = 'INVALID_FIGMA_URL',
  INVALID_API_KEY = 'INVALID_API_KEY',
  INVALID_WEBHOOK_PASSCODE = 'INVALID_WEBHOOK_PASSCODE',
  FIGMA_ACCESS_DENIED = 'FIGMA_ACCESS_DENIED',
  LINK_NOT_FOUND = 'LINK_NOT_FOUND',
  FIGMA_RESOURCE_NOT_FOUND = 'FIGMA_RESOURCE_NOT_FOUND',
  INVALID_STATUS_VALUE = 'INVALID_STATUS_VALUE',
  FIGMA_RATE_LIMITED = 'FIGMA_RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  FIGMA_UNAVAILABLE = 'FIGMA_UNAVAILABLE',
}
