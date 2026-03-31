import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager'
import { config } from '../config.js'

/**
 * Shape of the JSON object stored in Secrets Manager.
 * All sync-service secrets live in a single secret for simplicity.
 */
interface SecretsPayload {
  figmaServiceToken: string
  dbConnectionString: string
  syncServiceApiKey: string
  figmaWebhookPasscode: string
}

let cachedSecrets: SecretsPayload | null = null

const client = new SecretsManagerClient({ region: config.awsRegion })

/**
 * Fetches and caches secrets from AWS Secrets Manager.
 * Cached per Lambda warm instance — not re-fetched on every invocation.
 *
 * In local dev mode (LOCAL_DEV=true), secrets are read from environment
 * variables instead of Secrets Manager.
 *
 * TODO: Add cache TTL / refresh on rotation if Secrets Manager rotation is
 * enabled. For now, a Lambda redeploy or restart clears the cache.
 */
export async function getSecrets(): Promise<SecretsPayload> {
  if (cachedSecrets) return cachedSecrets

  if (config.isLocalDev) {
    if (
      !config.localFigmaServiceToken ||
      !config.localDbConnectionString ||
      !config.localApiKey ||
      !config.localWebhookPasscode
    ) {
      throw new Error(
        'LOCAL_DEV=true but one or more local secret env vars are missing. ' +
        'Set FIGMA_SERVICE_TOKEN, DB_CONNECTION_STRING, SYNC_SERVICE_API_KEY, ' +
        'FIGMA_WEBHOOK_PASSCODE in your .env.local file.',
      )
    }

    cachedSecrets = {
      figmaServiceToken: config.localFigmaServiceToken,
      dbConnectionString: config.localDbConnectionString,
      syncServiceApiKey: config.localApiKey,
      figmaWebhookPasscode: config.localWebhookPasscode,
    }
    return cachedSecrets
  }

  // Production: fetch from Secrets Manager
  const secretName = config.secretsManagerSecretName!
  const command = new GetSecretValueCommand({ SecretId: secretName })

  let raw: string
  try {
    const response = await client.send(command)
    if (!response.SecretString) {
      throw new Error(`Secret ${secretName} has no SecretString value`)
    }
    raw = response.SecretString
  } catch (err) {
    throw new Error(
      `Failed to fetch secrets from Secrets Manager (${secretName}): ${
        err instanceof Error ? err.message : String(err)
      }`,
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`Secret ${secretName} is not valid JSON`)
  }

  // Validate expected shape
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>)['figmaServiceToken'] !== 'string' ||
    typeof (parsed as Record<string, unknown>)['dbConnectionString'] !== 'string' ||
    typeof (parsed as Record<string, unknown>)['syncServiceApiKey'] !== 'string' ||
    typeof (parsed as Record<string, unknown>)['figmaWebhookPasscode'] !== 'string'
  ) {
    throw new Error(
      `Secret ${secretName} is missing required keys: ` +
      'figmaServiceToken, dbConnectionString, syncServiceApiKey, figmaWebhookPasscode',
    )
  }

  cachedSecrets = parsed as SecretsPayload
  return cachedSecrets
}

/** Clears the secrets cache. Useful in tests. */
export function clearSecretsCache(): void {
  cachedSecrets = null
}
