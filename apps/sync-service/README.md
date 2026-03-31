# sync-service

AWS Lambda-based sync service for Figma for Jira DC.

This package contains three Lambda functions, all supporting services and DB infrastructure, and the AWS CDK stack that deploys everything. It owns: Figma API integration, design link persistence, sync jobs, webhook intake, and thumbnail caching.

---

## What's in Here

Three Lambda entry points:

| Handler | Trigger | Purpose |
|---|---|---|
| `api-handler` | API Gateway (all routes except /webhooks/figma) | Link CRUD, parse, signed URL refresh |
| `webhook-handler` | API Gateway `/webhooks/figma` | Receive Figma FILE_UPDATE events, enqueue sync |
| `polling-sync` | EventBridge cron (every 30 min) | Sweep stale links, detect changes, deregister inactive webhooks |

---

## Source Structure

```
src/
├── config.ts                    # Env var validation at cold start
├── handlers/
│   ├── api-handler.ts           # 6 REST routes wired
│   ├── webhook-handler.ts       # Passcode validation + FILE_UPDATE processing
│   └── polling-sync.ts          # Batch sync sweep + deferred webhook deregistration
├── services/
│   ├── figma-client.ts          # Figma REST API v1/v2 (files, nodes, images, webhooks)
│   ├── links-service.ts         # Link CRUD including webhook registration side-effects
│   ├── sync-service.ts          # Change detection and status transition logic
│   └── thumbnail-service.ts     # S3 upload + pre-signed URL generation
├── db/
│   ├── client.ts                # Kysely singleton
│   ├── schema.ts                # Table type definitions
│   ├── migrate.ts               # Migration runner (run outside Lambda)
│   ├── migrations/              # Numbered SQL migration files (4 tables)
│   └── queries/                 # Typed query functions per entity
│       ├── links.ts             # design_links queries
│       ├── sync-state.ts        # sync_state queries
│       ├── webhooks.ts          # webhook_registrations queries
│       └── audit.ts             # audit_events queries
├── lib/
│   ├── api-key-auth.ts          # x-api-key validation middleware
│   ├── secrets.ts               # Secrets Manager client (cached per warm instance)
│   ├── errors.ts                # Typed error classes
│   └── figma-url.ts             # Figma URL parser + normalizer
└── __tests__/                   # Unit tests
infra/                           # AWS CDK v2 TypeScript stack
```

---

## Local Development

### Prerequisites

- Node.js 20+
- pnpm 10+
- Docker (for local PostgreSQL)

### Setup

```bash
# Install dependencies (from repo root)
pnpm install

# Start local PostgreSQL
docker run -d --name figma-jira-db \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=figma_jira -p 5432:5432 postgres:16

# Configure environment
cp .env.example .env.local
# Edit .env.local: set LOCAL_DEV=true, fill FIGMA_SERVICE_TOKEN
```

### Run migrations

```bash
pnpm migrate
```

This runs all SQL files in `src/db/migrations/` against the database specified in `DB_CONNECTION_STRING`.

### Local Lambda invocation

**SAM local execution is not yet available.** `template.yaml` has not been created. Until it exists:

- Use `pnpm test` for fast feedback on core logic
- Use `npx ts-node` to exercise individual modules
- Full Lambda invocation requires deploying to AWS or creating `template.yaml`

Creating `template.yaml` is a known gap — see `docs/HANDOFF.md`.

---

## Tests

```bash
# From repo root
pnpm test

# From this directory
pnpm --filter @figma-jira/sync-service test
```

### What the tests cover

| Suite | Count | Coverage |
|---|---|---|
| Figma URL parser (`figma-url.test.ts`) | 37 tests | `/design/`, `/file/`, `/proto/`, `/board/`, branch URLs, node IDs, edge cases |
| Status transitions | 7 tests | All valid/invalid transitions including READY_FOR_DEV → CHANGES_AFTER_DEV |

No integration tests or end-to-end tests exist yet.

---

## CDK Infra

The CDK stack is in `infra/` and deploys: API Gateway, 3 Lambda functions, S3 bucket, EventBridge rule, and a Secrets Manager secret.

**Important:** VPC and RDS configuration are not included in the stack. Lambda functions cannot reach RDS without VPC config. This must be added before deploying to production.

```bash
cd infra

# Synthesize (confirm the CloudFormation template is valid — works today)
npx cdk synth

# Bootstrap (first deploy only)
npx cdk bootstrap aws://<account-id>/<region>

# Deploy
npx cdk deploy
```

Note the stack outputs after deploy:
- `ApiGatewayUrl` — base URL for the API
- `ApiKeyId` — retrieve the key value from the AWS console
- `WebhookUrl` — the Figma webhook target URL
- `SecretArn` — Secrets Manager secret ARN

After deploying, set `WEBHOOK_ENDPOINT_URL` in the Lambda environment to the `WebhookUrl` value.

---

## DB Migrations

Migrations are plain SQL files in `src/db/migrations/`. Run them with:

```bash
# Local
pnpm migrate

# Against RDS (set the connection string first)
DB_CONNECTION_STRING="postgres://user:pass@rds-host:5432/figma_jira" pnpm migrate
```

The 4 tables created:

| Table | Purpose |
|---|---|
| `design_links` | One row per Figma link on a Jira issue (soft-delete) |
| `sync_state` | Sync status, backoff timing, error code per link |
| `webhook_registrations` | Active/inactive Figma webhook registrations per file |
| `audit_events` | Append-only event log for all mutations |

---

## Environment Variables

| Variable | Required in production | Default | Purpose |
|---|---|---|---|
| `AWS_REGION` | Yes | `us-east-1` | AWS region |
| `SECRETS_MANAGER_SECRET_NAME` | Yes | `figma-jira/sync-service` | Secrets Manager secret name |
| `THUMBNAIL_BUCKET_NAME` | Yes | — | S3 bucket for thumbnails |
| `WEBHOOK_ENDPOINT_URL` | Yes (post-deploy) | — | Figma webhook target URL |
| `POLLING_INTERVAL_MINUTES` | No | `30` | Informational — matches EventBridge rule |
| `SYNC_BACKOFF_BASE_SECONDS` | No | `60` | Base backoff for failed syncs |
| `SYNC_BACKOFF_MAX_SECONDS` | No | `14400` | Max backoff cap (4 hours) |
| `LOCAL_DEV` | No | — | `true` = read secrets from env vars |
| `FIGMA_SERVICE_TOKEN` | Local dev only | — | Figma API service token |
| `DB_CONNECTION_STRING` | Local dev only | — | PostgreSQL connection string |
| `SYNC_SERVICE_API_KEY` | Local dev only | — | Shared API key (Jira ↔ API Gateway) |
| `FIGMA_WEBHOOK_PASSCODE` | Local dev only | — | Validates incoming webhook payloads |

In production, `FIGMA_SERVICE_TOKEN`, `DB_CONNECTION_STRING`, `SYNC_SERVICE_API_KEY`, and `FIGMA_WEBHOOK_PASSCODE` are loaded from Secrets Manager — they must not be set as Lambda environment variables in production.

---

## Known Gaps

| Gap | Notes |
|---|---|
| VPC/RDS config missing from CDK | Add VPC, subnet, and security group config to Lambda definitions before deploying |
| `WEBHOOK_ENDPOINT_URL` not set | Set after first CDK deploy using the `WebhookUrl` stack output |
| SAM `template.yaml` not created | Required for `sam local invoke` and `sam local start-api` |
| No integration tests | DB query modules and Lambda handlers have no automated test coverage |
| CloudWatch log retention unset | Add `logRetention` to CDK Lambda definitions |
