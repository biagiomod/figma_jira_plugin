# Figma for Jira Data Center

Internal Figma integration for Jira Data Center. Links Figma designs to Jira issues, shows previews, detects design updates, and supports a "ready for dev" status workflow.

This is a single-org internal tool — not a Marketplace app.

---

## Architecture

```
Jira Data Center (thin Java plugin)
  └─► AWS API Gateway (x-api-key auth)
        ├─► Lambda: api-handler    (link CRUD, signed URLs)
        ├─► Lambda: webhook-handler (Figma push events)
        └─► Lambda: polling-sync   (EventBridge cron)
              ├─► RDS PostgreSQL   (links, sync state, audit)
              ├─► S3               (private thumbnail cache)
              └─► Secrets Manager  (Figma token, DB creds, API key)
```

The Jira plugin is a thin proxy. All business logic, Figma API calls, and persistence live in AWS.

See `docs/superpowers/specs/2026-03-31-figma-jira-dc-design.md` for the full design spec.

---

## Repo Structure

```
figma-jira/
├── apps/
│   ├── jira-dc-plugin/           # Java/Maven P2 plugin + React frontend
│   └── sync-service/             # TypeScript Lambda functions
│       └── infra/                # AWS CDK stack
├── packages/
│   └── shared-types/             # TypeScript enums, DTOs, Zod schemas
└── docs/
    └── superpowers/specs/        # Design spec and ADRs
```

---

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Node.js | 20+ | TypeScript packages |
| pnpm | 9+ | Monorepo package manager |
| Java | 11 | Jira plugin (required by Atlassian P2) |
| Maven | 3.8+ | Jira plugin build |
| Atlassian Plugin SDK | latest | Local Jira DC dev (`atlas-run`) |
| AWS CDK | 2.x | Infrastructure deployment |
| Docker | any | Local PostgreSQL |

---

## Local Development

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

### 3. Run DB migrations

```bash
cp apps/sync-service/.env.example apps/sync-service/.env.local
# Edit .env.local — set LOCAL_DEV=true and fill in FIGMA_SERVICE_TOKEN
pnpm --filter @figma-jira/sync-service migrate
```

### 4. Develop the React panel (no Jira needed)

```bash
cd apps/jira-dc-plugin/src/main/resources/frontend
pnpm dev
# Open http://localhost:5173/src/panel/index.html?issueKey=PROJ-123
```

### 5. Run sync-service locally (Lambda via SAM)

```bash
# Requires AWS SAM CLI installed
# TODO: Add SAM template (template.yaml) — see apps/sync-service/README.md
cd apps/sync-service
sam local start-api --env-vars .env.local
```

### 6. Run the full Jira DC plugin (requires Jira license)

```bash
cd apps/jira-dc-plugin
# Build the React frontend first
(cd src/main/resources/frontend && pnpm build)
# Start Jira DC with the plugin installed
mvn amps:run
# Jira starts at http://localhost:2990/jira
```

---

## Build

```bash
# Build all TypeScript packages
pnpm build

# Build Jira plugin JAR
cd apps/jira-dc-plugin
(cd src/main/resources/frontend && pnpm build)
mvn package

# Deploy AWS infrastructure
cd apps/sync-service/infra
pnpm cdk deploy
```

---

## Testing

```bash
# Run all tests
pnpm test

# Run sync-service tests only
pnpm --filter @figma-jira/sync-service test
```

---

## Configuration

### AWS (required before Jira plugin setup)

1. Deploy the CDK stack: `cd apps/sync-service/infra && pnpm cdk deploy`
2. Note the outputs: `ApiGatewayUrl`, `ApiKeyId`, `WebhookUrl`
3. Retrieve the API key value from AWS Console → API Gateway → API Keys
4. Populate the Secrets Manager secret (ARN in CDK output `SecretArn`):
   ```json
   {
     "figmaServiceToken": "figd_...",
     "dbConnectionString": "postgres://user:pass@host:5432/figma_jira",
     "syncServiceApiKey": "your-api-key-value",
     "figmaWebhookPasscode": "random-secure-string"
   }
   ```
5. Run DB migrations against your RDS instance
6. Register the webhook URL in Figma: Settings → Webhooks → New webhook → paste `WebhookUrl`

### Jira plugin

1. Install the plugin JAR via Jira Admin → Manage apps → Upload app
2. Go to Admin → Add-ons → Figma Integration
3. Enter the `ApiGatewayUrl` and API key value from step 3 above
4. Save — the Figma Designs panel will appear on all issue views

---

## Required Secrets (AWS Secrets Manager)

| Key | Description |
|---|---|
| `figmaServiceToken` | Figma service token (starts with `figd_`) |
| `dbConnectionString` | PostgreSQL connection string for RDS |
| `syncServiceApiKey` | Shared API key between Jira plugin and API Gateway |
| `figmaWebhookPasscode` | Passcode used to validate Figma webhook payloads |

---

## Implementation Status

| Area | Status |
|---|---|
| shared-types (enums, DTOs, schemas) | Fully implemented |
| sync-service: config, auth, error model | Fully implemented |
| sync-service: Figma URL parser | Fully implemented + tested |
| sync-service: DB migrations (all 4 tables) | Fully implemented |
| sync-service: DB query modules | Fully implemented |
| sync-service: figma-client | Substantially implemented (Figma API calls wired) |
| sync-service: links-service (link CRUD) | Substantially implemented |
| sync-service: sync-service (change detection) | Substantially implemented |
| sync-service: thumbnail-service | Substantially implemented |
| sync-service: api-handler (all REST routes) | Substantially implemented |
| sync-service: webhook-handler | Scaffolded (structure ready for queue addition) |
| sync-service: polling-sync | Scaffolded |
| sync-service: CDK infra stack | Scaffolded (RDS/VPC config TBD) |
| Jira plugin: Maven POM | Scaffolded |
| Jira plugin: atlassian-plugin.xml | Scaffolded |
| Jira plugin: REST proxy (Java) | Substantially implemented |
| Jira plugin: React panel | Substantially implemented |
| Jira plugin: Admin page | Scaffolded (servlet wiring TBD) |
| Tests: URL parser | Fully implemented |
| Tests: Status transitions | Fully implemented |

---

## Known Gaps and Next Steps

- RDS/VPC configuration must be added to the CDK stack before deploying
- `WEBHOOK_ENDPOINT_URL` env var must be set after API Gateway is deployed
- Admin page React → Java servlet wiring is incomplete (TODO in AdminPage.tsx)
- SAM local template (`template.yaml`) for local Lambda development is not yet created
- JQL custom field search (Phase 3) requires a spike — not yet implemented
- Figma plugin (Phase 4) is a separate future effort

See `docs/superpowers/specs/2026-03-31-figma-jira-dc-design.md` for the full roadmap.
