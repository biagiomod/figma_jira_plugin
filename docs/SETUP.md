# Setup Guide

This guide covers all three setup paths: quick evaluation, local development, and full integration deployment.

---

## Prerequisites

### Node.js 20+

Required for all paths. Download from [nodejs.org](https://nodejs.org/) or use a version manager:

```bash
# nvm
nvm install 20 && nvm use 20

# fnm
fnm install 20 && fnm use 20
```

### pnpm 10+

Required for all paths.

```bash
npm install -g pnpm@latest
```

### Docker

Required for Path 2 (local PostgreSQL). Download from [docker.com](https://www.docker.com/).

### Java 11

Required for Path 3 (Jira plugin build). Atlassian P2 plugins require exactly Java 11 — do not use Java 17 or 21.

```bash
# macOS with SDKMAN
sdk install java 11.0.23-tem
```

### Maven 3.8+

Required for Path 3.

```bash
# macOS
brew install maven
```

### Atlassian Plugin SDK

Required for Path 3. Provides `atlas-run`, `atlas-package`, and the local Jira DC runner.

Install from: [developer.atlassian.com/server/framework/atlassian-sdk/install-the-atlassian-sdk-on-a-linux-or-mac-system/](https://developer.atlassian.com/server/framework/atlassian-sdk/install-the-atlassian-sdk-on-a-linux-or-mac-system/)

The SDK sets `ATLAS_HOME` and wraps Maven with Atlassian repository configuration.

### AWS CLI v2

Required for Path 3. Install from [docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).

```bash
aws configure   # set region, access key, secret key
```

### AWS CDK 2.x

Required for Path 3.

```bash
npm install -g aws-cdk
cdk --version   # confirm 2.x
```

---

## Path 1 — Quick Evaluation

Runs the type-checker and test suite. No AWS account, Figma token, or Docker required.

```bash
git clone <repo-url> figma-jira
cd figma-jira

pnpm install
pnpm typecheck    # zero errors expected
pnpm test         # 44 tests: Figma URL parser + status transitions
```

Expected output:

```
Test Suites: 2 passed, 2 total
Tests:       44 passed, 44 total
```

---

## Path 2 — Local Development

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start local PostgreSQL

```bash
docker run -d \
  --name figma-jira-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=figma_jira \
  -p 5432:5432 \
  postgres:16
```

### 3. Configure environment

```bash
cp apps/sync-service/.env.example apps/sync-service/.env.local
```

Edit `apps/sync-service/.env.local` and set:

| Variable | Value |
|---|---|
| `LOCAL_DEV` | `true` |
| `FIGMA_SERVICE_TOKEN` | A real Figma service token (`figd_...`) |
| `DB_CONNECTION_STRING` | `postgres://postgres:postgres@localhost:5432/figma_jira` (default) |
| `SYNC_SERVICE_API_KEY` | Any string for local dev (e.g. `dev-key-local`) |
| `FIGMA_WEBHOOK_PASSCODE` | Any string for local dev |

Do not commit `.env.local`. It is git-ignored.

### 4. Run DB migrations

```bash
pnpm --filter @figma-jira/sync-service migrate
```

This runs all SQL migrations in `apps/sync-service/src/db/migrations/` against the local PostgreSQL.

### 5. Run the React panel dev server

No Jira instance or backend is needed to develop the panel UI.

```bash
cd apps/jira-dc-plugin/src/main/resources/frontend
pnpm install
pnpm dev
# Open: http://localhost:5173/src/panel/index.html?issueKey=PROJ-123
```

### 6. Local Lambda invocation

**SAM local execution is not yet available.** The `template.yaml` required by AWS SAM CLI has not been created. Until it exists, use unit tests or `ts-node` to invoke handlers directly:

```bash
cd apps/sync-service
npx ts-node -e "import('./src/handlers/api-handler.js').then(m => console.log('loaded'))"
```

See the Known Gaps section in `docs/HANDOFF.md` for how to address this.

---

## Path 3 — Full Integration

### 1. Replace the `com.yourorg` placeholder

Before building the Jira plugin, replace `com.yourorg` with your organization's actual package name in:

- `apps/jira-dc-plugin/pom.xml` — `groupId` and `atlassian.plugin.key`
- All files under `apps/jira-dc-plugin/src/main/java/com/yourorg/`
- `apps/jira-dc-plugin/src/main/resources/atlassian-plugin.xml`

### 2. Add RDS/VPC configuration to CDK

The CDK stack in `apps/sync-service/infra/` defines all Lambda, API Gateway, S3, and EventBridge resources but does **not** include VPC or RDS configuration. Before deploying, add:

- VPC and subnet references (or create a new VPC)
- RDS PostgreSQL instance (or reference an existing one)
- Lambda VPC config (`vpcSubnets`, `securityGroups`) so Lambdas can reach RDS

### 3. Bootstrap CDK (first deploy only)

```bash
cd apps/sync-service/infra
cdk bootstrap aws://<account-id>/<region>
```

### 4. Synthesize and review the CloudFormation template

```bash
npx cdk synth
```

Review the output before deploying.

### 5. Deploy

```bash
npx cdk deploy
```

Note the stack outputs:
- `ApiGatewayUrl` — base URL for all API calls
- `ApiKeyId` — API Gateway key ID (retrieve the value from the console)
- `WebhookUrl` — the Figma webhook target URL
- `SecretArn` — ARN of the Secrets Manager secret

### 6. Populate Secrets Manager

Retrieve the `SecretArn` from the CDK output. Create or update the secret value:

```json
{
  "figmaServiceToken": "figd_...",
  "dbConnectionString": "postgres://user:pass@your-rds-host:5432/figma_jira",
  "syncServiceApiKey": "your-generated-api-key-value",
  "figmaWebhookPasscode": "a-random-secure-string"
}
```

Retrieve the API key value from AWS Console → API Gateway → API Keys → show value. Store it in `syncServiceApiKey`.

### 7. Run DB migrations against RDS

```bash
cd apps/sync-service
DB_CONNECTION_STRING="postgres://user:pass@rds-host:5432/figma_jira" pnpm migrate
```

### 8. Set `WEBHOOK_ENDPOINT_URL`

After deployment, update the Lambda environment variable `WEBHOOK_ENDPOINT_URL` to the `WebhookUrl` value from the CDK output. This is used by `links-service.ts` when registering Figma webhooks.

### 9. Register the Figma webhook

In Figma: Settings → Webhooks → New webhook → paste the `WebhookUrl` value.
Set the passcode to match the `figmaWebhookPasscode` value you stored in Secrets Manager.

### 10. Build the Jira plugin

```bash
cd apps/jira-dc-plugin/src/main/resources/frontend
pnpm install
pnpm build

cd ../../../../../../   # back to apps/jira-dc-plugin/
mvn package
# Output: target/figma-jira-dc-<version>.jar
```

Note: `mvn package` was not run in the development environment — the POM and Java source are consistent with Atlassian AMPS conventions but have not been verified against a live Maven build. If the build fails, check that `atlassian-rest-common` and `amps` versions in `pom.xml` match your target Jira DC version.

### 11. Install the Jira plugin

1. Jira Admin → Manage apps → Upload app
2. Upload `target/figma-jira-dc-<version>.jar`
3. Go to Admin → Add-ons → Figma Integration
4. Enter the `ApiGatewayUrl` and API key value from step 6
5. Save

The Figma Designs panel will appear on all issue view pages.

---

## Environment Variables Reference

All variables are read by `apps/sync-service/src/config.ts` at Lambda cold start. Variables marked "required in production" are loaded from Secrets Manager when `LOCAL_DEV` is not set.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `AWS_REGION` | Yes | `us-east-1` | AWS region for all SDK calls |
| `SECRETS_MANAGER_SECRET_NAME` | Yes | `figma-jira/sync-service` | Secret name in Secrets Manager |
| `THUMBNAIL_BUCKET_NAME` | Yes | — | S3 bucket for thumbnail cache |
| `POLLING_INTERVAL_MINUTES` | No | `30` | Polling cron frequency (informational) |
| `SYNC_BACKOFF_BASE_SECONDS` | No | `60` | Base backoff for failed syncs |
| `SYNC_BACKOFF_MAX_SECONDS` | No | `14400` | Max backoff cap (4 hours) |
| `WEBHOOK_ENDPOINT_URL` | Yes (post-deploy) | — | Figma webhook target URL |
| `LOCAL_DEV` | No | — | Set `true` to read secrets from env vars instead of Secrets Manager |
| `FIGMA_SERVICE_TOKEN` | Local dev only | — | Figma API service token |
| `DB_CONNECTION_STRING` | Local dev only | — | PostgreSQL connection string |
| `SYNC_SERVICE_API_KEY` | Local dev only | — | Shared API key (Jira ↔ API Gateway) |
| `FIGMA_WEBHOOK_PASSCODE` | Local dev only | — | Validates incoming Figma webhook payloads |
