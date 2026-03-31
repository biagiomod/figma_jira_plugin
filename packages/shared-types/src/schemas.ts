import { z } from 'zod'
import { DesignStatus, ResourceType } from './enums.js'

/**
 * Validates the body of POST /links/parse
 */
export const ParseLinkRequestSchema = z.object({
  figma_url: z.string().url('figma_url must be a valid URL'),
})

/**
 * Validates the body of POST /issues/{issueKey}/links
 */
export const CreateLinkRequestSchema = z.object({
  figma_url: z.string().url('figma_url must be a valid URL'),
})

/**
 * Validates the body of PATCH /issues/{issueKey}/links/{linkId}/status
 */
export const UpdateStatusRequestSchema = z.object({
  status: z.nativeEnum(DesignStatus, {
    errorMap: () => ({
      message: `status must be one of: ${Object.values(DesignStatus).join(', ')}`,
    }),
  }),
})

/**
 * Validates a Figma URL string structurally (before deeper parsing).
 * Full semantic parsing happens in figma-url.ts.
 */
export const FigmaUrlSchema = z
  .string()
  .url()
  .refine(
    (url) => {
      try {
        const parsed = new URL(url)
        return parsed.hostname === 'www.figma.com' || parsed.hostname === 'figma.com'
      } catch {
        return false
      }
    },
    { message: 'URL must be a figma.com URL' },
  )

/**
 * Validates issue key format (e.g. PROJ-123, ABC-1).
 */
export const IssueKeySchema = z
  .string()
  .regex(/^[A-Z][A-Z0-9]+-\d+$/, 'Invalid Jira issue key format')

/**
 * Validates a UUID v4 string.
 */
export const UuidSchema = z.string().uuid()

/**
 * Validates ResourceType enum values.
 */
export const ResourceTypeSchema = z.nativeEnum(ResourceType)

/**
 * Validates DesignStatus enum values.
 */
export const DesignStatusSchema = z.nativeEnum(DesignStatus)

export type ParseLinkRequestInput = z.infer<typeof ParseLinkRequestSchema>
export type CreateLinkRequestInput = z.infer<typeof CreateLinkRequestSchema>
export type UpdateStatusRequestInput = z.infer<typeof UpdateStatusRequestSchema>
