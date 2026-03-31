import { DesignStatus, ResourceType, SyncStatus } from './enums.js'

/**
 * The primary data shape returned by all link-related API endpoints.
 * thumbnail_signed_url is an S3 pre-signed URL (1hr TTL), null if no thumbnail exists yet.
 */
export interface LinkDto {
  id: string
  issue_key: string
  figma_url: string
  figma_file_key: string
  figma_node_id: string | null
  resource_type: ResourceType
  design_status: DesignStatus
  file_name: string
  node_name: string | null
  thumbnail_signed_url: string | null
  last_modified_at: string   // ISO 8601
  last_synced_at: string | null  // ISO 8601
  linked_by_jira_user: string
  linked_at: string          // ISO 8601
}

/**
 * Result of parsing a Figma URL without persisting anything.
 * thumbnail_preview_url is a temporary Figma-hosted URL — not stored in S3.
 * Its domain is an implementation detail of the Figma API and may change.
 */
export interface ParsedFigmaLinkDto {
  figma_file_key: string
  figma_node_id: string | null
  resource_type: ResourceType
  file_name: string
  node_name: string | null
  last_modified_at: string  // ISO 8601
  thumbnail_preview_url: string | null
}

/**
 * Request body for POST /links/parse
 */
export interface ParseLinkRequest {
  figma_url: string
}

/**
 * Request body for POST /issues/{issueKey}/links
 * jira_user is NOT in the body — it is read from X-Jira-User header by the Lambda.
 */
export interface CreateLinkRequest {
  figma_url: string
}

/**
 * Request body for PATCH /issues/{issueKey}/links/{linkId}/status
 * jira_user is NOT in the body — it is read from X-Jira-User header by the Lambda.
 */
export interface UpdateStatusRequest {
  status: DesignStatus
}

/**
 * Standard API error response body.
 * code is stable and machine-readable; message is human-readable only.
 */
export interface ApiErrorResponse {
  error: {
    code: string
    message: string
    request_id?: string
  }
}

/**
 * Response body for GET /issues/{issueKey}/links
 */
export interface GetLinksResponse {
  links: LinkDto[]
}

/**
 * Internal representation of a parsed Figma URL before any API calls.
 */
export interface FigmaUrlParts {
  fileKey: string
  nodeId: string | null  // normalized: uses colons (e.g. "45:67"), not hyphens
  resourceType: ResourceType
}

/**
 * Minimal Figma file metadata returned by the Figma API.
 */
export interface FigmaFileMetadata {
  fileKey: string
  fileName: string
  lastModifiedAt: string  // ISO 8601
}

/**
 * Minimal Figma node metadata returned by the Figma API.
 */
export interface FigmaNodeMetadata {
  nodeId: string
  nodeName: string
  lastModifiedAt: string  // ISO 8601
}

/**
 * Combined metadata for a Figma resource (file-level or node-level).
 */
export interface FigmaResourceMetadata {
  fileKey: string
  nodeId: string | null
  fileName: string
  nodeName: string | null
  lastModifiedAt: string  // ISO 8601
  thumbnailUrl: string | null  // temporary Figma-hosted URL; fetch and store in S3
}

/**
 * Sync state summary for a single design link.
 */
export interface SyncStateDto {
  design_link_id: string
  sync_status: SyncStatus
  last_synced_at: string | null
  next_sync_at: string | null
  sync_error_code: string | null
  sync_attempts: number
}
