import { z } from 'zod'

/**
 * Runtime configuration schema.
 * Validated at Lambda cold-start. Missing required vars cause immediate failure
 * rather than a confusing runtime error later in the request path.
 *
 * In local dev (LOCAL_DEV=true), secrets are read from env vars directly.
 * In Lambda, secrets are fetched from Secrets Manager via secrets.ts.
 */
const ConfigSchema = z.object({
  awsRegion: z.string().min(1),
  thumbnailBucketName: z.string().min(1),
  secretsManagerSecretName: z.string().optional(), // required unless LOCAL_DEV
  pollingIntervalMinutes: z.number().int().positive().default(30),
  syncBackoffBaseSeconds: z.number().int().positive().default(60),
  syncBackoffMaxSeconds: z.number().int().positive().default(14400),
  isLocalDev: z.boolean().default(false),

  // Only populated in local dev mode; populated from Secrets Manager otherwise
  localFigmaServiceToken: z.string().optional(),
  localDbConnectionString: z.string().optional(),
  localApiKey: z.string().optional(),
  localWebhookPasscode: z.string().optional(),
})

export type Config = z.infer<typeof ConfigSchema>

function loadConfig(): Config {
  const isLocalDev = process.env['LOCAL_DEV'] === 'true'

  const raw = {
    awsRegion: process.env['AWS_REGION'] ?? 'us-east-1',
    thumbnailBucketName: process.env['THUMBNAIL_BUCKET_NAME'],
    secretsManagerSecretName: process.env['SECRETS_MANAGER_SECRET_NAME'],
    pollingIntervalMinutes: parseInt(process.env['POLLING_INTERVAL_MINUTES'] ?? '30', 10),
    syncBackoffBaseSeconds: parseInt(process.env['SYNC_BACKOFF_BASE_SECONDS'] ?? '60', 10),
    syncBackoffMaxSeconds: parseInt(process.env['SYNC_BACKOFF_MAX_SECONDS'] ?? '14400', 10),
    isLocalDev,
    localFigmaServiceToken: isLocalDev ? process.env['FIGMA_SERVICE_TOKEN'] : undefined,
    localDbConnectionString: isLocalDev ? process.env['DB_CONNECTION_STRING'] : undefined,
    localApiKey: isLocalDev ? process.env['SYNC_SERVICE_API_KEY'] : undefined,
    localWebhookPasscode: isLocalDev ? process.env['FIGMA_WEBHOOK_PASSCODE'] : undefined,
  }

  const result = ConfigSchema.safeParse(raw)
  if (!result.success) {
    throw new Error(`Invalid configuration: ${result.error.message}`)
  }

  const config = result.data

  if (!isLocalDev && !config.secretsManagerSecretName) {
    throw new Error('SECRETS_MANAGER_SECRET_NAME is required in non-local-dev mode')
  }

  if (!config.thumbnailBucketName) {
    throw new Error('THUMBNAIL_BUCKET_NAME is required')
  }

  return config
}

// Singleton — evaluated once per Lambda cold start
export const config = loadConfig()
