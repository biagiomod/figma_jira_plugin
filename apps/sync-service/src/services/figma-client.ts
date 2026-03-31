import type { FigmaResourceMetadata } from '@figma-jira/shared-types'
import {
  FigmaAccessDeniedError,
  FigmaRateLimitedError,
  FigmaResourceNotFoundError,
  FigmaUnavailableError,
} from '../lib/errors.js'
import { getSecrets } from '../lib/secrets.js'

const FIGMA_API_BASE = 'https://api.figma.com'

/**
 * Low-level Figma API client. All Figma API calls go through here.
 * The Jira plugin has no knowledge of this client or the Figma API.
 *
 * Authentication: FIGMA_SERVICE_TOKEN from Secrets Manager.
 * This is the only place the token is used — never passed to callers.
 */

async function figmaFetch(path: string): Promise<Response> {
  const secrets = await getSecrets()

  const response = await fetch(`${FIGMA_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${secrets.figmaServiceToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (response.status === 403) throw new FigmaAccessDeniedError()
  if (response.status === 404) throw new FigmaResourceNotFoundError()
  if (response.status === 429) throw new FigmaRateLimitedError()
  if (response.status >= 500) throw new FigmaUnavailableError(`Figma returned ${response.status}`)

  return response
}

/**
 * Fetch metadata for a Figma file.
 * Uses /v1/files/{fileKey}?depth=1 to minimize response size.
 *
 * TODO: The full file response can be very large for complex files.
 * Consider switching to /v1/files/{fileKey}/nodes if only node metadata is needed,
 * and caching file-level metadata separately with a longer TTL.
 */
export async function fetchFileMetadata(fileKey: string): Promise<{
  fileName: string
  lastModifiedAt: string
}> {
  const response = await figmaFetch(`/v1/files/${fileKey}?depth=1`)
  const data = (await response.json()) as {
    name: string
    lastModified: string
  }

  return {
    fileName: data.name,
    lastModifiedAt: data.lastModified,
  }
}

/**
 * Fetch metadata for a specific node within a Figma file.
 */
export async function fetchNodeMetadata(
  fileKey: string,
  nodeId: string,
): Promise<{ nodeName: string; lastModifiedAt: string }> {
  // Node IDs in API calls use colons; URL-encode the colon
  const encodedNodeId = encodeURIComponent(nodeId)
  const response = await figmaFetch(`/v1/files/${fileKey}/nodes?ids=${encodedNodeId}`)
  const data = (await response.json()) as {
    nodes: Record<string, { document: { name: string }; lastModified?: string } | null>
    lastModified: string
  }

  const node = data.nodes[nodeId]
  if (!node) throw new FigmaResourceNotFoundError(`Node ${nodeId} not found in file ${fileKey}`)

  return {
    nodeName: node.document.name,
    lastModifiedAt: node.lastModified ?? data.lastModified,
  }
}

/**
 * Fetch a thumbnail image URL for a Figma node or file.
 * Returns a temporary Figma-hosted URL — must be downloaded and stored in S3
 * before it expires (typically a few hours).
 *
 * For file-level links (nodeId = null), fetches the file thumbnail.
 *
 * TODO: The images endpoint has rate limits. Consider batching multiple
 * node requests in a single call when syncing many links for the same file.
 */
export async function fetchThumbnailUrl(
  fileKey: string,
  nodeId: string | null,
): Promise<string | null> {
  try {
    if (nodeId) {
      const encodedNodeId = encodeURIComponent(nodeId)
      const response = await figmaFetch(
        `/v1/images/${fileKey}?ids=${encodedNodeId}&format=png&scale=2`,
      )
      const data = (await response.json()) as {
        images: Record<string, string | null>
        err: string | null
      }

      if (data.err) {
        console.warn(`[figma-client] Thumbnail fetch error for node ${nodeId}: ${data.err}`)
        return null
      }

      return data.images[nodeId] ?? null
    } else {
      // File-level thumbnail: fetch file metadata which includes a thumbnail URL
      // TODO: Figma /v1/files does not directly return a usable thumbnail URL for all cases.
      // For now, return null for file-level links and show placeholder.
      // A proper implementation would use the file's thumbnail_url field if available.
      const response = await figmaFetch(`/v1/files/${fileKey}?depth=1`)
      const data = (await response.json()) as { thumbnailUrl?: string }
      return data.thumbnailUrl ?? null
    }
  } catch (err) {
    // Thumbnail fetch failure is non-fatal — return null and let caller handle
    console.warn(`[figma-client] Failed to fetch thumbnail for ${fileKey}/${nodeId}:`, err)
    return null
  }
}

/**
 * Fetch complete resource metadata (file + node if applicable) plus thumbnail URL.
 * This is the primary call made during link creation and sync.
 */
export async function fetchResourceMetadata(
  fileKey: string,
  nodeId: string | null,
): Promise<FigmaResourceMetadata> {
  const [fileMeta, thumbnailUrl] = await Promise.all([
    fetchFileMetadata(fileKey),
    fetchThumbnailUrl(fileKey, nodeId),
  ])

  let nodeName: string | null = null
  let lastModifiedAt = fileMeta.lastModifiedAt

  if (nodeId) {
    const nodeMeta = await fetchNodeMetadata(fileKey, nodeId)
    nodeName = nodeMeta.nodeName
    lastModifiedAt = nodeMeta.lastModifiedAt
  }

  return {
    fileKey,
    nodeId,
    fileName: fileMeta.fileName,
    nodeName,
    lastModifiedAt,
    thumbnailUrl,
  }
}

/**
 * Validate that the service token is functional.
 * Called at Lambda cold start (config.ts) to fail fast on misconfigured tokens.
 *
 * TODO: Wire this into the Lambda handler cold-start path once basic wiring is done.
 */
export async function validateServiceToken(): Promise<void> {
  await figmaFetch('/v2/me')
}

/**
 * Register a Figma webhook for a file.
 * Figma will push FILE_UPDATE events to the endpoint URL.
 *
 * @param fileKey - Figma file key to watch
 * @param webhookEndpointUrl - Publicly reachable URL for POST /webhooks/figma
 * @param passcode - Stored in Secrets Manager; validated in webhook-handler
 * @returns The Figma-assigned webhook ID
 */
export async function registerWebhook(
  fileKey: string,
  webhookEndpointUrl: string,
  passcode: string,
): Promise<string> {
  const secrets = await getSecrets()

  const response = await fetch(`${FIGMA_API_BASE}/v2/webhooks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secrets.figmaServiceToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event_type: 'FILE_UPDATE',
      // team_id: Figma webhook v2 API accepts null for file-level webhooks when using a personal
      // token or a service token with file-level scope. If webhook registration fails with 403,
      // verify whether your token type requires a team_id. See Figma API docs: /v2/webhooks
      team_id: null,
      file_key: fileKey,
      endpoint: webhookEndpointUrl,
      passcode,
      status: 'ACTIVE',
      description: `figma-jira-dc: ${fileKey}`,
    }),
  })

  if (response.status === 403) throw new FigmaAccessDeniedError('Cannot register webhook')
  if (response.status === 429) throw new FigmaRateLimitedError()
  if (!response.ok) throw new FigmaUnavailableError(`Webhook registration returned ${response.status}`)

  const data = (await response.json()) as { id: string }
  return data.id
}

/**
 * Deregister a Figma webhook by its ID.
 * Idempotent — treats 404 as success (already gone).
 */
export async function deregisterWebhook(webhookId: string): Promise<void> {
  const secrets = await getSecrets()

  const response = await fetch(`${FIGMA_API_BASE}/v2/webhooks/${webhookId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${secrets.figmaServiceToken}`,
    },
  })

  if (response.status === 404) return  // Already gone — idempotent
  if (response.status === 403) throw new FigmaAccessDeniedError('Cannot deregister webhook')
  if (!response.ok) {
    throw new FigmaUnavailableError(`Webhook deregistration returned ${response.status}`)
  }
}
