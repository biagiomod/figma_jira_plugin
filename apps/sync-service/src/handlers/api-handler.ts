import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import type { ZodSchema } from 'zod'
import {
  CreateLinkRequestSchema,
  ParseLinkRequestSchema,
  UpdateStatusRequestSchema,
  type DesignStatus,
} from '@figma-jira/shared-types'
import { requireApiKey } from '../lib/api-key-auth.js'
import { parseFigmaUrl } from '../lib/figma-url.js'
import { toAppError, errorResponseBody, AppError } from '../lib/errors.js'
import { getDb } from '../db/client.js'
import { getLinkById } from '../db/queries/links.js'
import {
  getLinksForIssue,
  createLink,
  deleteLink,
  setLinkStatus,
  refreshLink,
  toLinkDto,
} from '../services/links-service.js'
import { fetchResourceMetadata } from '../services/figma-client.js'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

function ok(body: unknown): APIGatewayProxyResultV2 {
  return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(body) }
}

function noContent(): APIGatewayProxyResultV2 {
  return { statusCode: 204 }
}

function badRequest(message: string): APIGatewayProxyResultV2 {
  return {
    statusCode: 400,
    headers: JSON_HEADERS,
    body: JSON.stringify({ error: { code: 'BAD_REQUEST', message } }),
  }
}

function errResponse(err: AppError, requestId?: string): APIGatewayProxyResultV2 {
  return {
    statusCode: err.statusCode,
    headers: JSON_HEADERS,
    body: errorResponseBody(err, requestId),
  }
}

function parseBody<T>(
  event: APIGatewayProxyEventV2,
  schema: ZodSchema<T>,
): { ok: true; data: T } | { ok: false; response: APIGatewayProxyResultV2 } {
  let raw: unknown
  try {
    raw = event.body ? JSON.parse(event.body) : {}
  } catch {
    return { ok: false, response: badRequest('Request body is not valid JSON') }
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    return { ok: false, response: badRequest(result.error.message) }
  }

  return { ok: true, data: result.data }
}

/**
 * api-handler — handles all synchronous REST operations.
 *
 * Routes (matched by method + path pattern from API Gateway):
 *   POST   /links/parse                              → parseLink
 *   GET    /issues/{issueKey}/links                  → getLinks
 *   POST   /issues/{issueKey}/links                  → createLinkForIssue
 *   DELETE /issues/{issueKey}/links/{linkId}         → deleteLinkForIssue
 *   PATCH  /issues/{issueKey}/links/{linkId}/status  → updateLinkStatus
 *   POST   /issues/{issueKey}/links/{linkId}/sync    → syncLinkNow
 *
 * All routes require a valid x-api-key header (validated by requireApiKey).
 * jira_user identity is read from X-Jira-User header (audit metadata only, not auth).
 */
export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  const requestId = event.requestContext?.requestId

  try {
    await requireApiKey(event)
  } catch (err) {
    const appErr = toAppError(err)
    return errResponse(appErr, requestId)
  }

  const method = event.requestContext.http.method.toUpperCase()
  const path = event.requestContext.http.path

  try {
    // POST /links/parse
    if (method === 'POST' && path === '/links/parse') {
      return await handleParseLink(event)
    }

    // Routes under /issues/{issueKey}/...
    const issueMatch = path.match(/^\/issues\/([^/]+)\/links(?:\/([^/]+))?(?:\/([^/]+))?$/)
    if (!issueMatch) {
      return { statusCode: 404, headers: JSON_HEADERS, body: JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Route not found' } }) }
    }

    const issueKey = decodeURIComponent(issueMatch[1] ?? '')
    const linkId = issueMatch[2] ? decodeURIComponent(issueMatch[2]) : null
    const subResource = issueMatch[3] ?? null  // e.g. "status", "sync"

    // GET /issues/{issueKey}/links
    if (method === 'GET' && !linkId) {
      return await handleGetLinks(event, issueKey)
    }

    // POST /issues/{issueKey}/links
    if (method === 'POST' && !linkId) {
      return await handleCreateLink(event, issueKey)
    }

    // DELETE /issues/{issueKey}/links/{linkId}
    if (method === 'DELETE' && linkId && !subResource) {
      return await handleDeleteLink(event, linkId)
    }

    // PATCH /issues/{issueKey}/links/{linkId}/status
    if (method === 'PATCH' && linkId && subResource === 'status') {
      return await handleUpdateStatus(event, linkId)
    }

    // POST /issues/{issueKey}/links/{linkId}/sync
    if (method === 'POST' && linkId && subResource === 'sync') {
      return await handleSyncLink(event, linkId)
    }

    return { statusCode: 404, headers: JSON_HEADERS, body: JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Route not found' } }) }
  } catch (err) {
    const appErr = toAppError(err)
    return errResponse(appErr, requestId)
  }
}

// -----------------------------------------------------------------------
// Route handlers
// -----------------------------------------------------------------------

async function handleParseLink(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  const parsed = parseBody(event, ParseLinkRequestSchema)
  if (!parsed.ok) return parsed.response

  const urlParts = parseFigmaUrl(parsed.data.figma_url)
  const metadata = await fetchResourceMetadata(urlParts.fileKey, urlParts.nodeId)

  return ok({
    figma_file_key: metadata.fileKey,
    figma_node_id: metadata.nodeId,
    resource_type: urlParts.resourceType,
    file_name: metadata.fileName,
    node_name: metadata.nodeName,
    last_modified_at: metadata.lastModifiedAt,
    thumbnail_preview_url: metadata.thumbnailUrl,
  })
}

async function handleGetLinks(
  event: APIGatewayProxyEventV2,
  issueKey: string,
): Promise<APIGatewayProxyResultV2> {
  const db = await getDb()
  const links = await getLinksForIssue(db, issueKey)
  return ok({ links })
}

async function handleCreateLink(
  event: APIGatewayProxyEventV2,
  issueKey: string,
): Promise<APIGatewayProxyResultV2> {
  const parsed = parseBody(event, CreateLinkRequestSchema)
  if (!parsed.ok) return parsed.response

  const jiraUser = event.headers['x-jira-user'] ?? 'unknown'
  const db = await getDb()

  const link = await createLink(db, issueKey, parsed.data.figma_url, jiraUser)
  return ok(link)
}

async function handleDeleteLink(
  event: APIGatewayProxyEventV2,
  linkId: string,
): Promise<APIGatewayProxyResultV2> {
  const jiraUser = event.headers['x-jira-user'] ?? 'unknown'
  const db = await getDb()
  await deleteLink(db, linkId, jiraUser)
  return noContent()
}

async function handleUpdateStatus(
  event: APIGatewayProxyEventV2,
  linkId: string,
): Promise<APIGatewayProxyResultV2> {
  const parsed = parseBody(event, UpdateStatusRequestSchema)
  if (!parsed.ok) return parsed.response

  const jiraUser = event.headers['x-jira-user'] ?? 'unknown'
  const db = await getDb()

  const link = await setLinkStatus(db, linkId, parsed.data.status as DesignStatus, jiraUser)
  return ok(link)
}

async function handleSyncLink(
  _event: APIGatewayProxyEventV2,
  linkId: string,
): Promise<APIGatewayProxyResultV2> {
  const db = await getDb()
  const link = await refreshLink(db, linkId)
  return ok(link)
}
