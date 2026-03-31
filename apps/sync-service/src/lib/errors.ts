import { ApiErrorCode } from '@figma-jira/shared-types'

/**
 * Base class for all typed application errors.
 * Carry an HTTP status code and an API-level error code.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class InvalidFigmaUrlError extends AppError {
  constructor(url: string) {
    super(400, ApiErrorCode.INVALID_FIGMA_URL, `Not a valid Figma URL: ${url}`)
    this.name = 'InvalidFigmaUrlError'
  }
}

export class InvalidApiKeyError extends AppError {
  constructor() {
    super(401, ApiErrorCode.INVALID_API_KEY, 'Missing or invalid API key')
    this.name = 'InvalidApiKeyError'
  }
}

export class InvalidWebhookPasscodeError extends AppError {
  constructor() {
    super(401, ApiErrorCode.INVALID_WEBHOOK_PASSCODE, 'Invalid or missing webhook passcode')
    this.name = 'InvalidWebhookPasscodeError'
  }
}

export class FigmaAccessDeniedError extends AppError {
  constructor(detail?: string) {
    super(
      403,
      ApiErrorCode.FIGMA_ACCESS_DENIED,
      detail ?? 'Figma service token does not have access to this resource',
    )
    this.name = 'FigmaAccessDeniedError'
  }
}

export class LinkNotFoundError extends AppError {
  constructor(linkId: string) {
    super(404, ApiErrorCode.LINK_NOT_FOUND, `Design link not found: ${linkId}`)
    this.name = 'LinkNotFoundError'
  }
}

export class FigmaResourceNotFoundError extends AppError {
  constructor(detail?: string) {
    super(404, ApiErrorCode.FIGMA_RESOURCE_NOT_FOUND, detail ?? 'Figma resource not found')
    this.name = 'FigmaResourceNotFoundError'
  }
}

export class FigmaRateLimitedError extends AppError {
  constructor() {
    super(429, ApiErrorCode.FIGMA_RATE_LIMITED, 'Figma API rate limit exceeded; retry later')
    this.name = 'FigmaRateLimitedError'
  }
}

export class FigmaUnavailableError extends AppError {
  constructor(detail?: string) {
    super(503, ApiErrorCode.FIGMA_UNAVAILABLE, detail ?? 'Figma API is unavailable')
    this.name = 'FigmaUnavailableError'
  }
}

export class InternalError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(500, ApiErrorCode.INTERNAL_ERROR, message, cause)
    this.name = 'InternalError'
  }
}

/**
 * Convert any unknown error into a structured AppError for consistent responses.
 */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err
  const message = err instanceof Error ? err.message : 'An unexpected error occurred'
  return new InternalError(message, err)
}

/**
 * Build the standard Lambda response body for an error.
 */
export function errorResponseBody(err: AppError, requestId?: string): string {
  return JSON.stringify({
    error: {
      code: err.code,
      message: err.message,
      ...(requestId ? { request_id: requestId } : {}),
    },
  })
}
