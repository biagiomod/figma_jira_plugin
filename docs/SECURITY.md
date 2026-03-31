# Security Posture

This document describes the security model for Figma for Jira DC, covering trust relationships, secrets handling, authentication boundaries, known gaps, and hardening recommendations.

---

## Trust Model

```
Jira DC user (browser)
  └─► Jira DC server (authenticated Jira session)
        └─► SyncServiceProxy.java (injects x-api-key + Jira user header)
              └─► AWS API Gateway (validates x-api-key)
                    └─► Lambda functions (trust API Gateway's auth)
                          └─► Figma API (service token auth)
                          └─► RDS (connection string from Secrets Manager)
                          └─► S3 (IAM role)

Figma servers
  └─► Lambda: webhook-handler (validates passcode in request body)
```

Key trust assumptions:
- The Jira DC server is trusted to inject the correct `X-Jira-User` header. There is no independent verification of the Jira user identity at the Lambda layer.
- API Gateway enforces x-api-key on all routes **except** `/webhooks/figma` (Figma calls it directly without an API key).
- Lambda functions trust that if a request reaches them via API Gateway, the API key was valid.

---

## Secrets Handling

### In production (Lambda)

All runtime secrets are stored in a single AWS Secrets Manager secret (ARN in CDK output `SecretArn`). The secret value is a JSON object:

```json
{
  "figmaServiceToken": "figd_...",
  "dbConnectionString": "postgres://user:pass@host:5432/figma_jira",
  "syncServiceApiKey": "...",
  "figmaWebhookPasscode": "..."
}
```

`apps/sync-service/src/lib/secrets.ts` loads and caches this object per warm Lambda instance. The cache is intentionally not invalidated between invocations — if secrets are rotated, the Lambda must be redeployed or cold-started to pick up the new values.

Lambda functions never receive secrets as plain environment variables in production (except `SECRETS_MANAGER_SECRET_NAME` and `THUMBNAIL_BUCKET_NAME`, which are not sensitive).

### In local development

When `LOCAL_DEV=true`, `secrets.ts` reads secrets from environment variables instead of calling Secrets Manager. These must be set in `.env.local` (git-ignored).

**Never use real production secrets in `.env.local`.** Use a personal Figma developer token and a throwaway DB instance.

### What is git-ignored

`.gitignore` covers: `.env`, `.env.*`, `*.env`, `cdk.context.json`, `cdk.out/`, `*.jar` (build artifacts). Confirm the `.gitignore` is applied before your first commit.

---

## Authentication Boundaries

### Jira plugin → API Gateway: x-api-key

`SyncServiceProxy.java` reads the API key from SAL PluginSettings and injects it as the `x-api-key` header on every outbound request. API Gateway rejects any request missing a valid key.

The API key value is stored in SAL PluginSettings (Jira's plugin config storage). SAL PluginSettings does **not** encrypt stored values at rest — this is standard behavior for all Jira DC plugins. The values are protected by Jira's own access controls (only Jira admins can access the admin page).

### Figma → webhook-handler: passcode in request body

Figma includes the configured passcode in the body of every webhook event. `webhook-handler.ts` validates this before processing any event. The `/webhooks/figma` route does not require an API key (Figma has no mechanism to send one).

The passcode must be a randomly generated string stored in Secrets Manager. It must match the value configured in the Figma webhook settings.

### Lambda → Figma API: service token

All Figma API calls use a single org-level service token (`figd_...`) loaded from Secrets Manager. This token has access to all Figma files in the organization. There is no per-user scoping.

### Lambda → RDS: connection string

Lambdas connect to RDS using a connection string from Secrets Manager. The connection string includes the database username and password. In production, the Lambda must be in the same VPC as RDS (this VPC configuration is not yet in the CDK stack — see Known Gaps).

### Lambda → S3: IAM role

The Lambda execution role is granted `s3:PutObject` and `s3:GetObject` on the thumbnail bucket via IAM. No public access is allowed on the bucket.

---

## What Is NOT Encrypted or Protected

- **SAL PluginSettings** — the API Gateway URL and API key stored by the Jira plugin are not encrypted at rest. This is a platform limitation of Jira DC plugin config storage. Anyone with Jira admin access can view these values.
- **API key rotation** — there is no automated rotation mechanism. Rotation requires manually generating a new key in API Gateway, updating Secrets Manager, and updating the Jira plugin admin config.
- **Jira user identity** — the `X-Jira-User` header passed from `SyncServiceProxy.java` to Lambda is trusted without independent verification. A compromised Jira server could spoof this header.

---

## What Logs Are Safe / What to Never Log

### Safe to log

- Jira issue keys (e.g. `PROJ-123`)
- Figma file keys (e.g. `abc123XYZ`)
- Link IDs (UUIDs)
- Error codes (`FIGMA_429`, `LINK_NOT_FOUND`, etc.)
- Sync job status and timing
- Request IDs

### Never log

- Figma service token (confirmed: not logged anywhere)
- DB connection string or any component of it (username, password, host)
- API key value
- Webhook passcode
- Pre-signed S3 URLs (these are time-limited but grant read access to thumbnail objects — confirmed fix: full signed URL is not logged)
- Full Figma image URLs from the Figma API response (may contain session-specific tokens)

When adding new logging, check that no object containing secrets is passed to the logger. The pattern `logger.info({ ...event })` can accidentally log request headers including `x-api-key`.

---

## Known Security Gaps

| Gap | Risk | Priority |
|---|---|---|
| CloudWatch log retention not set | Log storage costs grow unbounded; stale logs retained indefinitely | Medium |
| No API key rotation mechanism | A leaked API key stays valid until manually rotated | Medium |
| No WAF on API Gateway | No rate limiting or IP blocking at the edge | Low (internal tool) |
| VPC/RDS config not in CDK | Lambdas currently cannot reach RDS; also means DB is not VPC-isolated | High (deploy blocker) |
| SAL PluginSettings not encrypted | API key stored in plaintext in Jira config storage | Low (protected by Jira admin access) |
| Jira user header not verified | Lambda trusts the `X-Jira-User` header injected by the plugin | Low (Jira server is trusted) |

---

## Recommendations Before Production

1. **Set CloudWatch log retention.** Add `logRetention: RetentionDays.THREE_MONTHS` to each Lambda definition in the CDK stack. This is a one-line change per Lambda.

2. **Add VPC configuration to CDK.** Required for Lambda-to-RDS connectivity. Also ensures the DB is not publicly accessible.

3. **Document an API key rotation runbook.** Steps: generate a new API key in API Gateway → update `syncServiceApiKey` in Secrets Manager → update the Jira plugin admin config → invalidate the old key. Until rotation is automated, this runbook prevents a leaked key from staying active.

4. **Review Figma service token scope.** If the token grants access to more Figma files than the integration needs, consider a scoped token or a dedicated Figma service account.

5. **Consider AWS WAF.** If the API Gateway URL is discoverable outside the organization network, attach a WAF web ACL with rate limiting. For a VPN-only deployment, this may not be necessary.

6. **Audit Lambda execution role permissions.** The CDK stack grants the Lambda role access to Secrets Manager, S3, and CloudWatch Logs. Verify no extra permissions are granted. Follow least-privilege.

---

## Safe Defaults (Out of the Box)

- No hardcoded secrets anywhere in the codebase
- S3 bucket has all public access blocked
- API Gateway `dataTraceEnabled` is set to `false` (prevents request/response body logging to CloudWatch)
- All routes except `/webhooks/figma` require a valid x-api-key
- `.gitignore` covers all env files and CDK context files
- `LOCAL_DEV` flag ensures local dev never calls Secrets Manager
- Webhook passcode validation runs before any event processing
