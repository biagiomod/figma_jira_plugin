import { ResourceType } from '@figma-jira/shared-types'
import type { FigmaUrlParts } from '@figma-jira/shared-types'
import { InvalidFigmaUrlError } from './errors.js'

/**
 * Parses a Figma URL into its canonical components.
 *
 * Supported URL formats:
 *   https://www.figma.com/design/{fileKey}/{name}                     → FILE
 *   https://www.figma.com/design/{fileKey}/{name}?node-id={nodeId}    → FRAME
 *   https://www.figma.com/proto/{fileKey}/{name}?node-id={nodeId}     → PROTOTYPE
 *   https://www.figma.com/board/{fileKey}/{name}                      → FIGJAM
 *   https://www.figma.com/file/{fileKey}/{name}                       → FILE (legacy)
 *   https://www.figma.com/design/{fileKey}/branch/{branchKey}/...     → treated as FILE/FRAME on the branch
 *
 * Node IDs in URLs use hyphens (e.g. "45-67") but the Figma REST API uses
 * colons ("45:67"). This function normalizes to colon format.
 *
 * Throws InvalidFigmaUrlError if the URL cannot be parsed as a Figma resource.
 */
export function parseFigmaUrl(rawUrl: string): FigmaUrlParts {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new InvalidFigmaUrlError(rawUrl)
  }

  const hostname = url.hostname
  if (hostname !== 'www.figma.com' && hostname !== 'figma.com') {
    throw new InvalidFigmaUrlError(rawUrl)
  }

  const segments = url.pathname.split('/').filter(Boolean)
  // segments[0] is the path type: design, proto, board, file
  // segments[1] is the fileKey
  // segments[2] is the file name (slug, ignored)
  // For branch URLs: segments[2] = 'branch', segments[3] = branchKey

  if (segments.length < 2) {
    throw new InvalidFigmaUrlError(rawUrl)
  }

  const pathType = segments[0]
  const rawFileKey = segments[1]

  if (!pathType || !rawFileKey) {
    throw new InvalidFigmaUrlError(rawUrl)
  }

  let resourceType: ResourceType
  let fileKey: string = rawFileKey

  switch (pathType) {
    case 'design':
    case 'file':
      resourceType = ResourceType.FILE
      break
    case 'proto':
      resourceType = ResourceType.PROTOTYPE
      break
    case 'board':
      resourceType = ResourceType.FIGJAM
      break
    default:
      throw new InvalidFigmaUrlError(rawUrl)
  }

  // Branch URLs: /design/{fileKey}/branch/{branchKey}/...
  // Treat the branchKey as the effective fileKey for API calls.
  if (segments[2] === 'branch' && segments[3]) {
    fileKey = segments[3]
  }

  // Extract and normalize node-id from query params
  const rawNodeId = url.searchParams.get('node-id')
  let nodeId: string | null = null

  if (rawNodeId) {
    // Normalize hyphens → colons (e.g. "45-67" → "45:67")
    nodeId = rawNodeId.replace(/-/g, ':')

    // If node-id is present and resource type is FILE, upgrade to FRAME
    if (resourceType === ResourceType.FILE) {
      resourceType = ResourceType.FRAME
    }
  }

  return { fileKey, nodeId, resourceType }
}

/**
 * Returns a stable canonical key string for a parsed Figma resource.
 * Used for deduplication — avoids comparing raw URLs that may differ in
 * slug text, query param order, or trailing slashes.
 *
 * Format: "{fileKey}:{nodeId|file}:{resourceType}"
 */
export function figmaResourceKey(parts: FigmaUrlParts): string {
  return `${parts.fileKey}:${parts.nodeId ?? 'file'}:${parts.resourceType}`
}
