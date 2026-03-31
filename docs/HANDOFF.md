# Engineering Handoff

This document is for the engineering lead or team receiving this codebase. It covers what was built, what was not, implementation completeness, recommended starting tasks, and known gaps with actionable steps to close them.

---

## What Was Built

- **shared-types** — TypeScript enums, DTOs, and Zod schemas shared across Lambda functions and the React frontend
- **sync-service** — Three AWS Lambda functions (api-handler, webhook-handler, polling-sync) with supporting services (figma-client, links-service, sync-service, thumbnail-service), a typed Kysely DB layer, SQL migrations for 4 tables, and auth middleware
- **CDK infra stack** — AWS CDK v2 TypeScript stack defining API Gateway, Lambda functions, S3 bucket, EventBridge rule, and Secrets Manager secret (VPC/RDS not included)
- **Jira DC plugin** — Java 11 P2 plugin with a thin HTTP proxy (SyncServiceProxy), plugin config storage via SAL PluginSettings, a Velocity web panel template, a React issue panel (FigmaPanel.tsx), and a React admin config page (AdminPage.tsx)
- **Figma URL parser** — Handles `/design/`, `/file/`, `/proto/`, `/board/`, and branch URLs; 44 unit tests passing
- **Status transition logic** — Governs the one automatic transition (READY_FOR_DEV → CHANGES_AFTER_DEV on detected change); unit tested

---

## What Was Intentionally Not Built

- **JQL custom field integration** — Planned as Phase 3. Requires a spike on Jira DC custom field indexing. Not started.
- **Figma plugin** — Planned as Phase 4. A separate effort; no code exists.
- **Per-user Figma OAuth** — By design, a single org-level service token is used. Per-user auth was evaluated and rejected.
- **Atlassian Marketplace packaging** — This is an internal tool. No marketplace compliance work was done.
- **WAF / DDoS protection** — Not set up on API Gateway. Flagged as a hardening item.

---

## Implementation Completeness

### Fully implemented and tested

| Component | Notes |
|---|---|
| `packages/shared-types` | Enums, DTOs, Zod schemas — complete |
| `sync-service/src/config.ts` | Cold-start env var validation |
| `sync-service/src/lib/api-key-auth.ts` | x-api-key validation |
| `sync-service/src/lib/errors.ts` | Typed error classes |
| `sync-service/src/lib/figma-url.ts` | Figma URL parser — 44 unit tests passing |
| `sync-service/src/lib/secrets.ts` | Secrets Manager client with per-warm-instance cache |
| Status transition logic | Unit tested — guards the READY_FOR_DEV → CHANGES_AFTER_DEV transition |
| DB migrations | 4 SQL migrations: design_links, sync_state, webhook_registrations, audit_events |
| DB query modules | Kysely typed queries for all 4 tables |

### Substantially implemented (not end-to-end tested)

These are complete in structure and wiring but have not been run against real infrastructure.

| Component | Notes |
|---|---|
| `sync-service/src/services/figma-client.ts` | Figma API v1/v2: files, nodes, images, webhooks |
| `sync-service/src/services/links-service.ts` | Full link CRUD including webhook registration side-effects |
| `sync-service/src/services/sync-service.ts` | Change detection, status transitions on sync |
| `sync-service/src/services/thumbnail-service.ts` | S3 upload + pre-signed URL generation |
| `sync-service/src/handlers/api-handler.ts` | All 6 REST routes wired |
| `sync-service/src/handlers/webhook-handler.ts` | Passcode validation, FILE_UPDATE processing |
| `sync-service/src/handlers/polling-sync.ts` | Batch sweep + deferred webhook deregistration |
| `apps/jira-dc-plugin/.../SyncServiceProxy.java` | Thin HTTP proxy with header injection |
| `apps/jira-dc-plugin/.../FigmaPanel.tsx` | Full issue panel UI: CRUD, status badge, error handling |

### Scaffolded (structure present, wiring incomplete)

| Component | What is missing |
|---|---|
| CDK infra stack | VPC and RDS configuration not included — must be added before deploy |
| `AdminPage.tsx` | React → Java servlet POST call is a TODO — not wired |
| `atlassian-plugin.xml` | i18n file is referenced but not created |

### Not created

| Component | Notes |
|---|---|
| Java admin servlet | GET/POST handler for reading/writing plugin config from the admin page |
| `figma-jira-i18n.properties` | i18n strings file referenced in `atlassian-plugin.xml` |
| `apps/sync-service/template.yaml` | SAM template for local Lambda invocation |

### Not started

| Component | Notes |
|---|---|
| JQL custom field integration | Phase 3 — requires separate spike |
| Figma plugin | Phase 4 — separate future effort |

---

## What the First Engineer Should Do First

1. **Replace `com.yourorg`** in `apps/jira-dc-plugin/pom.xml`, all Java source files, and `atlassian-plugin.xml` with the actual org package name. This must happen before any Maven build.

2. **Add VPC/RDS config to the CDK stack** in `apps/sync-service/infra/`. The stack synthesizes successfully today but Lambdas cannot reach RDS without VPC configuration. This is the single biggest gap before a real deploy.

3. **Create the admin servlet** (Java, GET/POST) in `apps/jira-dc-plugin/src/main/java/com/yourorg/figurajira/rest/`. The admin page React component (`AdminPage.tsx`) already exists but its save action is not wired. The servlet must read/write `PluginConfig` and be registered in `atlassian-plugin.xml`.

4. **Create `figma-jira-i18n.properties`** in `apps/jira-dc-plugin/src/main/resources/`. The plugin descriptor already references it. A minimal file with placeholder keys is sufficient to unblock the Maven build.

5. **Run an end-to-end smoke test** once VPC/RDS and Secrets Manager are configured: deploy the CDK stack, run migrations, POST to `/issues/TEST-1/links`, verify a row in the DB and a thumbnail in S3.

6. **Create `template.yaml`** for SAM local development. This enables `sam local invoke` and `sam local start-api` for faster Lambda iteration without deploying to AWS.

---

## Known Gaps and How to Close Them

| Gap | How to close |
|---|---|
| VPC/RDS config missing from CDK | Add `vpc`, `vpcSubnets`, and `securityGroups` to Lambda definitions in `infra/lib/sync-service-stack.ts`; add or reference an RDS cluster |
| `WEBHOOK_ENDPOINT_URL` not set | After first CDK deploy, copy `WebhookUrl` from stack outputs into the Lambda env var |
| Admin servlet not created | Implement `AdminServlet.java` with GET (return current settings as JSON) and POST (save settings via `PluginConfig`); register in `atlassian-plugin.xml` |
| i18n properties file missing | Create `apps/jira-dc-plugin/src/main/resources/figma-jira-i18n.properties` with the keys referenced in `atlassian-plugin.xml` |
| SAM template missing | Create `apps/sync-service/template.yaml` mapping each Lambda handler to the appropriate function definition; reference `.env.local` for local env vars |
| CloudWatch log retention unset | Add `logRetention: RetentionDays.THREE_MONTHS` to each Lambda definition in the CDK stack |
| API key rotation | Implement a rotation Lambda or document a manual rotation runbook; currently no automated mechanism exists |
| No WAF | Consider attaching an AWS WAF web ACL to the API Gateway stage if the API will be reachable from the internet |

---

## External Dependencies

| Dependency | Purpose | Notes |
|---|---|---|
| Figma API | Fetch file/node metadata, thumbnails, manage webhooks | Requires a valid service token (`figd_...`) |
| Figma Webhook delivery | Push FILE_UPDATE events | Requires a publicly reachable webhook URL |
| Jira Data Center | Host the plugin, provide issue keys and user context | Requires a DC license |
| AWS API Gateway | x-api-key auth, route incoming requests | Deployed via CDK |
| AWS Lambda | All sync-service business logic | Node.js 20 runtime |
| AWS RDS PostgreSQL | Persistent storage | Not included in CDK stack — must be added |
| AWS S3 | Private thumbnail cache | Deployed via CDK |
| AWS Secrets Manager | Runtime secrets | Deployed via CDK |
| AWS EventBridge | 30-minute polling cron | Deployed via CDK |

---

## Testing Coverage Summary

| Test suite | Count | Status |
|---|---|---|
| Figma URL parser (`figma-url.test.ts`) | 37 | Passing |
| Status transition logic | 7 | Passing |
| **Total** | **44** | **44/44 passing** |

No integration tests or end-to-end tests exist yet. The DB query modules, Lambda handlers, and Java proxy have no automated test coverage. Adding integration tests for the DB layer and contract tests for the Lambda API routes are the highest-value testing investments.

---

## Architecture Decisions

| Decision | Rationale |
|---|---|
| Single org-level Figma service token | Per-user OAuth requires Figma OAuth app setup and token storage per user — not worth the complexity for an internal single-org tool |
| x-api-key trust between plugin and API Gateway | Simple, auditable, no JWT or session infrastructure needed; acceptable for an internal server-to-server call over HTTPS |
| Kysely over Drizzle or raw pg | Smaller Lambda bundle than Drizzle; better type inference than raw pg; no ORM overhead |
| pnpm workspaces monorepo | Keeps shared-types, sync-service, and future packages in one repo with a single install |
| Soft-delete on design_links | Preserves audit history; rows are marked `deleted_at` and excluded from queries, not physically removed |
| Deferred webhook deregistration | Avoids a Figma API call on every link delete; polling-sync sweeps inactive registrations in batch |
| iframe for Jira DC web panel | Standard Atlassian P2 web panel approach; avoids conflicts with Jira's own JavaScript |
| Figma passcode in webhook body | Figma's own webhook authentication pattern; no HMAC signature support from Figma |

See `docs/superpowers/specs/2026-03-31-figma-jira-dc-design.md` for the full design spec.

---

## License and Usage Notes

This codebase is an internal tool built for a single organization's Jira Data Center instance. It is not licensed for distribution, resale, or submission to the Atlassian Marketplace. The `com.yourorg` package name placeholder must be replaced before any build — it has no standing as a Maven group ID.
