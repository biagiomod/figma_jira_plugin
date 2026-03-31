import type { APIGatewayProxyEventV2 } from 'aws-lambda'
import { InvalidApiKeyError } from './errors.js'
import { getSecrets } from './secrets.js'

/**
 * Validates the x-api-key header against the stored API key.
 *
 * This is the trust boundary between the Jira plugin and the sync service.
 * The API key is a shared secret: stored in AWS Secrets Manager on the AWS side,
 * and in Jira plugin configuration on the Jira side.
 *
 * Not a substitute for network-level controls (WAF, VPC) — those are deferred
 * hardening steps. For MVP, key possession is sufficient for an internal tool.
 *
 * Throws InvalidApiKeyError if the key is missing or incorrect.
 */
export async function requireApiKey(event: APIGatewayProxyEventV2): Promise<void> {
  const provided = event.headers['x-api-key']
  if (!provided) throw new InvalidApiKeyError()

  const secrets = await getSecrets()
  if (provided !== secrets.syncServiceApiKey) throw new InvalidApiKeyError()
}
