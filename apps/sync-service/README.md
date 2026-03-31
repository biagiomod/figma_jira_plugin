# sync-service

AWS Lambda-based sync service for Figma for Jira DC.

Owns: Figma API integration, design link persistence, sync jobs, webhook intake, thumbnail caching.

## Structure

```
src/
├── config.ts                # Env var validation (cold-start)
├── handlers/
│   ├── api-handler.ts       # All synchronous REST routes
│   ├── webhook-handler.ts   # Figma webhook intake
│   └── polling-sync.ts      # EventBridge cron sweep
├── services/
│   ├── figma-client.ts      # Figma REST API wrapper
│   ├── links-service.ts     # Link CRUD business logic
│   ├── sync-service.ts      # Change detection + status transitions
│   └── thumbnail-service.ts # S3 thumbnail store + signed URLs
├── db/
│   ├── client.ts            # Kysely singleton
│   ├── schema.ts            # Table type definitions
│   ├── migrate.ts           # Migration runner (run outside Lambda)
│   ├── migrations/          # Numbered SQL migration files
│   └── queries/             # Typed query functions per entity
├── lib/
│   ├── api-key-auth.ts      # x-api-key validation
│   ├── secrets.ts           # Secrets Manager client (cached)
│   ├── errors.ts            # Typed error classes
│   └── figma-url.ts         # Figma URL parser + normalizer
└── __tests__/               # Unit tests
infra/                       # AWS CDK stack
```

## Local dev

```bash
# Copy and fill env file
cp .env.example .env.local

# Run migrations (requires local PostgreSQL)
pnpm migrate

# Run tests
pnpm test
```

## Required env vars (see .env.example for full list)

- `LOCAL_DEV=true` for local development
- `FIGMA_SERVICE_TOKEN` — Figma API token
- `DB_CONNECTION_STRING` — PostgreSQL connection string
- `SYNC_SERVICE_API_KEY` — shared secret with Jira plugin
- `FIGMA_WEBHOOK_PASSCODE` — validates incoming Figma webhook payloads
- `THUMBNAIL_BUCKET_NAME` — S3 bucket for cached thumbnails

## TODOs before production

- [ ] Add VPC/subnet config to CDK Lambda definitions (for RDS access)
- [ ] Set `WEBHOOK_ENDPOINT_URL` env var after API Gateway is deployed
- [ ] Add `template.yaml` for SAM local development
- [ ] Wire `validateServiceToken()` call at Lambda cold start
- [ ] Add integration tests for DB query modules
