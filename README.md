# Figma for Jira Data Center

An internal single-org tool that integrates Figma designs with Jira Data Center. It links Figma files and frames to Jira issues, tracks design status (IN_PROGRESS, READY_FOR_DEV, CHANGES_AFTER_DEV), detects design changes via Figma webhooks and scheduled polling, and caches thumbnail previews in S3. This is not a Marketplace app — it is built for one organization's Jira DC instance.

**Audience:** Internal engineering team inheriting this codebase.

---

## Architecture

```
Jira Data Center (thin Java P2 plugin — proxy only)
  └─► AWS API Gateway (x-api-key auth)
        ├─► Lambda: api-handler     (link CRUD, parse, signed URLs)
        ├─► Lambda: webhook-handler (Figma push events)
        └─► Lambda: polling-sync    (EventBridge cron, every 30 min)
              ├─► RDS PostgreSQL    (design_links, sync_state, webhook_registrations, audit_events)
              ├─► S3                (private thumbnail cache, pre-signed URLs)
              └─► Secrets Manager  (Figma token, DB creds, API key, webhook passcode)
```

The Jira plugin is a thin proxy. All business logic, Figma API calls, and persistence live in the AWS sync-service.

---

## Repo Structure

```
figma-jira/
├── apps/
│   ├── jira-dc-plugin/              # Java 11, Maven, Atlassian AMPS
│   │   ├── pom.xml
│   │   └── src/main/
│   │       ├── java/com/yourorg/figurajira/
│   │       │   ├── config/PluginConfig.java
│   │       │   └── rest/SyncServiceProxy.java
│   │       └── resources/
│   │           ├── atlassian-plugin.xml
│   │           ├── templates/figma-panel.vm
│   │           └── frontend/          # React + Vite (pnpm)
│   └── sync-service/                # TypeScript Node.js 20
│       ├── src/
│       │   ├── config.ts
│       │   ├── handlers/            # Lambda entry points
│       │   ├── services/            # Business logic
│       │   ├── db/                  # Kysely client, schema, migrations
│       │   └── lib/                 # Auth, errors, parser, secrets
│       └── infra/                   # AWS CDK v2 TypeScript stack
├── packages/
│   └── shared-types/                # TypeScript enums, DTOs, Zod schemas
└── docs/
    ├── SETUP.md
    ├── HANDOFF.md
    ├── SECURITY.md
    └── superpowers/specs/           # Design spec and ADRs
```

---

## Setup Paths

### Path 1 — Quick evaluation (TypeScript only, no AWS or Figma needed)

Run the test suite and type-check with nothing but Node.js and pnpm.

```bash
pnpm install
pnpm typecheck
pnpm test
# 44 tests pass: Figma URL parser + status transition logic
```

### Path 2 — Local development (Docker + local env)

Full sync-service with a local PostgreSQL database. Figma API calls require a real service token; SAM local Lambda execution is not yet available (see Known Gaps).

```bash
docker run -d --name figma-jira-db \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=figma_jira -p 5432:5432 postgres:16

cp apps/sync-service/.env.example apps/sync-service/.env.local
# Edit .env.local: set LOCAL_DEV=true and fill FIGMA_SERVICE_TOKEN

pnpm --filter @figma-jira/sync-service migrate

# React panel dev server (no Jira or backend needed)
cd apps/jira-dc-plugin/src/main/resources/frontend
pnpm install && pnpm dev
# Open http://localhost:5173/src/panel/index.html?issueKey=PROJ-123
```

### Path 3 — Full integration (real AWS + Figma + Jira DC)

See `docs/SETUP.md` for the complete step-by-step guide. High-level sequence:

1. `cd apps/sync-service/infra && npx cdk deploy` (add VPC/RDS config first — see Known Gaps)
2. Populate Secrets Manager with Figma token, DB creds, API key, webhook passcode
3. Run DB migrations against RDS
4. Register Figma webhook URL
5. Build and install the Jira plugin JAR
6. Configure the admin page in Jira

---

## Prerequisites

| Tool | Version | Path 1 | Path 2 | Path 3 |
|---|---|---|---|---|
| Node.js | 20+ | required | required | required |
| pnpm | 10+ | required | required | required |
| Docker | any | — | required | — |
| Java | 11 | — | — | required |
| Maven | 3.8+ | — | — | required |
| Atlassian Plugin SDK | latest | — | — | required |
| AWS CLI | v2 | — | — | required |
| AWS CDK | 2.x | — | — | required |

---

## Implementation Status

| Component | Status |
|---|---|
| shared-types: enums, DTOs, Zod schemas | Fully implemented |
| sync-service: config, auth, error model | Fully implemented |
| sync-service: Figma URL parser | Fully implemented, 44 tests passing |
| sync-service: DB migrations (4 tables) | Fully implemented |
| sync-service: DB query modules (Kysely) | Fully implemented |
| sync-service: figma-client | Substantially implemented, not end-to-end tested |
| sync-service: links-service | Substantially implemented, not end-to-end tested |
| sync-service: sync-service (change detection) | Substantially implemented, not end-to-end tested |
| sync-service: thumbnail-service | Substantially implemented, not end-to-end tested |
| sync-service: api-handler (6 REST routes) | Substantially implemented, not end-to-end tested |
| sync-service: webhook-handler | Substantially implemented, not end-to-end tested |
| sync-service: polling-sync | Substantially implemented, not end-to-end tested |
| sync-service: CDK infra stack | Scaffolded — RDS/VPC config not included |
| Jira plugin: Maven POM + plugin descriptor | Scaffolded |
| Jira plugin: SyncServiceProxy (Java) | Substantially implemented |
| Jira plugin: React panel (FigmaPanel.tsx) | Substantially implemented |
| Jira plugin: Admin page (AdminPage.tsx) | Scaffolded — servlet wiring incomplete |
| Jira plugin: admin servlet (Java) | Not created |
| Jira plugin: i18n properties file | Not created |
| SAM template.yaml for local Lambda dev | Not created |
| JQL custom field integration | Not started (Phase 3) |
| Figma plugin | Not started (Phase 4) |

---

## Known Gaps and Next Steps

- **RDS/VPC config** must be added to the CDK stack (`apps/sync-service/infra/`) before deploying
- **`WEBHOOK_ENDPOINT_URL`** env var must be set after API Gateway is deployed
- **SAM `template.yaml`** does not exist yet — local Lambda invocation via SAM is not possible; use unit tests or `ts-node` for local verification
- **Admin servlet** (Java GET/POST for plugin config) is not yet implemented
- **i18n properties file** (`figma-jira-i18n.properties`) is referenced in `atlassian-plugin.xml` but not created
- **`com.yourorg` placeholder** in all Java source and `pom.xml` must be replaced with your actual org package name before building
- **CloudWatch log retention** is not set — recommend 30–90 day retention
- **API key rotation** has no automated mechanism — manual process required

See `docs/HANDOFF.md` for prioritized next steps and `docs/SECURITY.md` for security posture.

---

## Documentation

| Document | Contents |
|---|---|
| `docs/SETUP.md` | Full setup guide for all three paths |
| `docs/HANDOFF.md` | Engineering handoff summary, gaps, recommended starting tasks |
| `docs/SECURITY.md` | Trust model, secrets handling, security gaps, hardening recommendations |
| `apps/jira-dc-plugin/README.md` | Plugin-specific build and configuration guide |
| `apps/sync-service/README.md` | Lambda service structure, env vars, CDK, migrations |
| `packages/shared-types/README.md` | Shared TypeScript types package |
| `docs/superpowers/specs/` | Design spec and architecture decision records |
