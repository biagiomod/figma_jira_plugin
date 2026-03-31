# Figma for Jira Data Center — Design Spec

**Date:** 2026-03-31
**Status:** Approved — pending implementation planning
**Scope:** Internal single-org deployment. Not a Marketplace app.

---

## 1. Project Goal

Build an internal Jira Data Center app with supporting AWS infrastructure that recreates the core user-facing capabilities of "Figma for Jira" — specifically: linking Figma designs to Jira issues, previewing them inside Jira, tracking design updates, and supporting a "ready for dev" design status workflow.

This is not a clone of the Atlassian Cloud app internals. It is a Jira Data Center-native implementation using the P2 plugin model and an AWS-hosted sync service.

---

## 2. Scope

**In scope (MVP):**
- Link one or more Figma designs to a Jira issue
- Preview linked designs (thumbnail, metadata) inside the Jira issue view
- Detect when a linked design changes in Figma
- Support a manually-set design status with one sync-assisted transition
- Admin configuration of AWS connectivity
- Webhook-based sync with polling fallback
- Audit logging of key events

**Out of scope (explicitly deferred):**
- Per-user Figma authentication
- Figma plugin (create/link Jira issues from Figma)
- Multi-Jira-instance support
- JQL custom field search (Phase 3 spike required — not guaranteed)
- Figma branch/version tracking
- Atlassian Marketplace distribution

---

## 3. Non-Goals

- Exact parity with the Jira Cloud "Figma for Jira" app — Cloud uses Atlassian Forge and Connect modules unavailable on Data Center
- Per-user design permissions at the AWS layer — Jira-level access control is the boundary
- Real-time (sub-second) sync — webhook delivery plus processing latency is acceptable
- Supporting Jira Server as a primary target — Data Center first; Server may work if compatible extension points are used

---

## 4. Architecture Overview

### Components

```
┌──────────────────────────────────────────────────────────┐
│                  Jira Data Center                         │
│                                                           │
│  ┌───────────────────────────────────────────────────┐   │
│  │  figma-jira-dc-plugin  (thin Java / P2)           │   │
│  │                                                   │   │
│  │  • Issue web panel  →  React bundle               │   │
│  │  • Admin config page  (API GW URL + API key)      │   │
│  │  • REST proxy  /rest/figma-jira/1.0/...           │   │
│  │    - forwards requests to AWS API Gateway         │   │
│  │    - attaches X-Jira-User header (audit only)     │   │
│  │    - attaches X-Jira-Issue header                 │   │
│  │    - NO secret storage, NO per-user tokens        │   │
│  └───────────────────────────────────────────────────┘   │
└─────────────────────────┬────────────────────────────────┘
                          │ HTTPS + x-api-key header
                          ▼
┌──────────────────────────────────────────────────────────┐
│  AWS API Gateway  (auth: API key, per-deployment secret)  │
│                          │                                │
│          ┌───────────────┼───────────────┐               │
│          ▼               ▼               ▼               │
│   ┌─────────────┐ ┌────────────┐ ┌─────────────────┐    │
│   │ api-handler │ │  webhook-  │ │  polling-sync   │    │
│   │  (Lambda)   │ │  handler   │ │   (Lambda)      │    │
│   │             │ │  (Lambda)  │ │                 │    │
│   │ • parse URL │ │            │ │ • sweep links   │    │
│   │ • CRUD links│ │ • receive  │ │   older than    │    │
│   │ • get links │ │   Figma    │ │   sync threshold│    │
│   │ • gen S3    │ │   events   │ │ • re-fetch meta │    │
│   │   signed URL│ │ • update   │ │ • update S3     │    │
│   └──────┬──────┘ │   sync     │ │   thumbnails    │    │
│          │        │   state    │ └────────┬────────┘    │
│          │        └─────┬──────┘          │             │
│          └──────────────┴─────────────────┘             │
│                         │                               │
│          ┌──────────────┼─────────────┐                 │
│          ▼              ▼             ▼                  │
│   ┌────────────┐  ┌──────────┐  ┌─────────┐            │
│   │    RDS     │  │    S3    │  │ Secrets │            │
│   │ PostgreSQL │  │ (thumbs, │  │ Manager │            │
│   │            │  │ private) │  │         │            │
│   │ • links    │  │          │  │ • Figma │            │
│   │ • sync     │  │ signed   │  │   svc   │            │
│   │   state    │  │ URLs only│  │   token │            │
│   │ • audit    │  │          │  │ • DB    │            │
│   └────────────┘  └──────────┘  │   creds │            │
│                                  │ • API   │            │
│                                  │   key   │            │
│                                  │ • WH    │            │
│                                  │   pass  │            │
│                                  └─────────┘            │
└──────────────────────────────────────────────────────────┘
                          ▲
              Figma webhooks (push, public endpoint)
                          │
                   api.figma.com
```

### Three Lambda Functions

| Function | Trigger | Runtime profile |
|---|---|---|
| `api-handler` | API Gateway | Synchronous, latency-sensitive, user-facing |
| `webhook-handler` | API Gateway (public endpoint) | Async-natured, externally triggered, separate concurrency |
| `polling-sync` | EventBridge cron | Batch, long timeout budget, independent of user traffic |

These three are separated because they have genuinely different runtime profiles. Merging them would couple timeout configs and concurrency settings that naturally differ.

---

## 5. Trust Boundaries

| Boundary | MVP mechanism | Deferred hardening |
|---|---|---|
| React panel → Jira REST proxy | Jira session cookie (same-origin) | — |
| Jira plugin → AWS API Gateway | `x-api-key` header (shared secret, stored in plugin config) | HMAC signing, IP allowlisting/WAF, VPC peering |
| API Gateway → Lambda | IAM execution role | — |
| Lambda → Figma API | `Authorization: Bearer $FIGMA_SERVICE_TOKEN` (from Secrets Manager) | OAuth2 app if service token proves limiting |
| Lambda → RDS | Connection string (from Secrets Manager) | — |
| Jira panel → S3 thumbnails | Pre-signed GET URLs (1hr TTL), generated per request | — |
| Figma → webhook-handler | Figma passcode field in payload (from Secrets Manager) | — |

**Key assumption:** Possession of the API key is sufficient to call any sync-service endpoint. There is no per-user authorization at the AWS layer. Jira-level access control (if you can see the issue, you can see its linked designs) is the enforced boundary. This is appropriate for an internal single-org deployment.

`X-Jira-User` and `X-Jira-Issue` headers passed by the Jira proxy are **informational metadata only**. They are used for audit logging and never for authorization decisions.

---

## 6. Data Model

### `design_links`

Core record. One row per Figma resource linked to a Jira issue.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `issue_key` | `VARCHAR(64)` NOT NULL | e.g. `PROJ-123` |
| `figma_url` | `TEXT` NOT NULL | Original URL — display and audit only |
| `figma_file_key` | `VARCHAR(128)` NOT NULL | Extracted from URL |
| `figma_node_id` | `VARCHAR(128)` nullable | `null` = file-level link |
| `resource_type` | `ENUM` NOT NULL | `FILE \| FRAME \| PROTOTYPE \| FIGJAM` |
| `design_status` | `ENUM` NOT NULL default `NONE` | `NONE \| IN_PROGRESS \| READY_FOR_DEV \| CHANGES_AFTER_DEV` |
| `file_name` | `TEXT` | Cached from Figma |
| `node_name` | `TEXT` nullable | Cached from Figma |
| `thumbnail_s3_key` | `TEXT` nullable | `null` = no thumbnail yet |
| `last_modified_at` | `TIMESTAMPTZ` | From Figma `last_modified` |
| `linked_by_jira_user` | `VARCHAR(256)` | Audit metadata only |
| `linked_at` | `TIMESTAMPTZ` NOT NULL | |
| `updated_at` | `TIMESTAMPTZ` NOT NULL | Last metadata refresh |
| `deleted_at` | `TIMESTAMPTZ` nullable | Soft delete — `null` = active |

**Indexes:**
- `(issue_key)` — primary lookup
- `(figma_file_key)` — webhook fanout
- `(issue_key, figma_file_key, COALESCE(figma_node_id, ''), resource_type) UNIQUE WHERE deleted_at IS NULL` — logical deduplication; prevents duplicate links regardless of URL variation

**Status ownership rule:**
> `design_status` is set manually by users via the Jira panel, with one exception: sync may automatically transition `READY_FOR_DEV → CHANGES_AFTER_DEV` when a change is detected in Figma. All other transitions are user-initiated. Source of truth: `design_links.design_status`.

---

### `sync_state`

Operational sync metadata. 1:1 with `design_links`. Created in the same transaction. Never orphaned.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `design_link_id` | `UUID` NOT NULL UNIQUE FK → `design_links.id` | `UNIQUE` enforces 1:1 |
| `last_synced_at` | `TIMESTAMPTZ` | When last sync ran |
| `next_sync_at` | `TIMESTAMPTZ` | Set on sync completion; polling query target |
| `sync_status` | `ENUM` NOT NULL | `PENDING \| SUCCESS \| FAILED` |
| `sync_error` | `TEXT` nullable | Human-readable last error |
| `sync_error_code` | `VARCHAR(32)` nullable | `FIGMA_429 \| FIGMA_403 \| FIGMA_404 \| NETWORK \| UNKNOWN` |
| `change_detected_at` | `TIMESTAMPTZ` nullable | When last design change was noticed |
| `sync_attempts` | `INTEGER` NOT NULL default `0` | Resets to 0 on success |

**Indexes:**
- `(next_sync_at)` — polling sweep: `WHERE next_sync_at <= NOW()` joined to `design_links WHERE deleted_at IS NULL`
- `UNIQUE (design_link_id)` — enforces 1:1

**Retry semantics:** On failure, set `next_sync_at = NOW() + (2^sync_attempts * base_interval)` capped at max backoff (e.g. 4 hours). On success, reset `sync_attempts = 0`, set `next_sync_at = NOW() + regular_interval`.

**Note on `PENDING` state:** Newly created records start as `PENDING` with `next_sync_at = NOW()`. The polling index has no status predicate — it picks up all records where `next_sync_at <= NOW()` including new `PENDING` ones. The index is plain `(next_sync_at)` with no WHERE clause.

---

### `webhook_registrations`

Tracks which Figma files have active webhook subscriptions. One row per `figma_file_key`.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `figma_file_key` | `VARCHAR(128)` UNIQUE NOT NULL | |
| `figma_webhook_id` | `VARCHAR(256)` nullable | Null if registration failed |
| `is_active` | `BOOLEAN` NOT NULL default `false` | `true` = registered and believed active |
| `registered_at` | `TIMESTAMPTZ` nullable | |
| `last_event_received_at` | `TIMESTAMPTZ` nullable | |
| `last_registration_error` | `TEXT` nullable | Last error from Figma registration API |

**Deregistration semantics:**
- On link soft-delete: check `COUNT(*) FROM design_links WHERE figma_file_key = $1 AND deleted_at IS NULL`
- If count = 0: set `is_active = false` immediately (synchronous, in same request)
- Actual Figma `DELETE /v2/webhooks/{id}` call: deferred to `polling-sync` next run
- `polling-sync` checks `WHERE is_active = false AND figma_webhook_id IS NOT NULL` and calls Figma DELETE
- Figma DELETE is idempotent; 404 response is logged and treated as success
- Race condition (two concurrent deletes for last links of same file): both may set `is_active = false`; second deregistration call gets 404 from Figma, handled gracefully

---

### `audit_events`

Append-only. Never updated or soft-deleted.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `event_type` | `ENUM` NOT NULL | See below |
| `design_link_id` | `UUID` nullable FK | |
| `issue_key` | `VARCHAR(64)` nullable | Denormalized for query convenience |
| `jira_user` | `VARCHAR(256)` nullable | From `X-Jira-User` header |
| `metadata` | `JSONB` | e.g. `{ from: "READY_FOR_DEV", to: "CHANGES_AFTER_DEV" }` |
| `created_at` | `TIMESTAMPTZ` NOT NULL | |

**Event types:** `LINK_CREATED`, `LINK_DELETED`, `STATUS_CHANGED`, `SYNC_COMPLETED`, `DESIGN_CHANGED`, `WEBHOOK_RECEIVED`, `WEBHOOK_REGISTERED`, `WEBHOOK_DEREGISTERED`

Sync failures are recorded as `SYNC_COMPLETED` with `metadata->>'status' = 'failed'`. No separate `SYNC_FAILED` event type.

**Indexes:**
- `(design_link_id, created_at)` — link history
- `(issue_key, created_at)` — issue-level audit view across all links

---

### S3 Thumbnail Policy

| Concern | Decision |
|---|---|
| Access | Private bucket — no public access |
| Key structure | `thumbnails/{figma_file_key}/{node_id or "file"}.png` |
| Refresh trigger | Overwrite on change detection (webhook or polling) |
| Retrieval | `api-handler` generates pre-signed GET URL (1hr TTL) per request |
| No thumbnail yet | `thumbnail_s3_key = null`; panel renders Figma icon placeholder |
| Refresh failure | Retain stale S3 object; log error in `sync_state`; panel shows last known thumbnail |
| Expired URL mid-session | React `<img onError>` triggers one silent re-fetch of link data; falls back to placeholder if that also fails |

---

## 7. API Contracts

### Trust model

All sync-service endpoints (except `/webhooks/figma`) require `x-api-key` header validated by API Gateway. This is an API Gateway-managed API key stored in AWS. The matching value is stored in the Jira plugin admin configuration at deployment time.

`/webhooks/figma` validates the Figma passcode from the request body (retrieved from Secrets Manager) instead.

### Jira plugin proxy behaviour

The Jira plugin adds three things to every proxied request and nothing else:
1. `x-api-key` header (from plugin config)
2. `X-Jira-User` header (current Jira username — audit only)
3. `X-Jira-Issue` header (current issue key)

The plugin does not transform, buffer, or interpret responses. It is a thin pass-through.

---

### `POST /links/parse`

Parse and preview a Figma URL. No persistence.

**Request:**
```json
{ "figma_url": "https://www.figma.com/..." }
```

**Response 200:**
```json
{
  "figma_file_key": "abc123",
  "figma_node_id": "45:67",
  "resource_type": "FRAME",
  "file_name": "Product Design v3",
  "node_name": "Login Screen",
  "last_modified_at": "2026-03-30T14:22:00Z",
  "thumbnail_preview_url": "https://figma-alpha-api.s3.us-west-2.amazonaws.com/..."
}
```

`thumbnail_preview_url` is a temporary Figma-hosted URL (not stored in S3). Used for preview only — not persisted. The domain in the example is illustrative; Figma's image host URL format is an implementation detail subject to change.

**Idempotent:** Yes. **Sync:** Synchronous.

---

### `POST /issues/{issueKey}/links`

Persist a design link.

**Request:**
```json
{ "figma_url": "https://www.figma.com/..." }
```

`jira_user` is read from the `X-Jira-User` header added by the Jira proxy — not from the request body.

**Response 200:** `LinkDto`

**Idempotent:** Yes — upsert on `(issue_key, figma_file_key, COALESCE(figma_node_id, ''), resource_type) WHERE deleted_at IS NULL`.

**Side effects:** Inserts `design_links` + `sync_state` in one transaction; fetches metadata + thumbnail from Figma; stores thumbnail in S3; registers Figma webhook if not already registered; writes `LINK_CREATED` audit event.

**Thumbnail failure:** Non-fatal. Link saves with `thumbnail_s3_key = null`. Response includes `thumbnail_signed_url: null`.

---

### `GET /issues/{issueKey}/links`

Return all active design links for a Jira issue.

**Response 200:**
```json
{ "links": [LinkDto, ...] }
```

Each `LinkDto` includes a freshly generated pre-signed S3 URL (1hr TTL). **Idempotent:** Yes. **Sync:** Synchronous.

---

### `DELETE /issues/{issueKey}/links/{linkId}`

Soft-delete a link.

**Response:** `204 No Content`

**Idempotent:** Yes. Already-deleted link returns `204`. Non-existent `linkId` returns `404`.

**Side effects:** Sets `deleted_at`; if no remaining active links for `figma_file_key`, sets `webhook_registrations.is_active = false` (actual Figma deregistration deferred to `polling-sync`); writes `LINK_DELETED` audit event.

---

### `PATCH /issues/{issueKey}/links/{linkId}/status`

Manually update design status.

**Request:**
```json
{ "status": "READY_FOR_DEV" }
```

`jira_user` is read from the `X-Jira-User` header — not from the request body.

**Response 200:** Updated `LinkDto`

**Idempotent:** Yes — same status twice is a no-op. **Side effect:** Writes `STATUS_CHANGED` audit event with `metadata: { from, to }`.

---

### `POST /issues/{issueKey}/links/{linkId}/sync`

Manual refresh for a single link.

**Response 200:** Updated `LinkDto` with fresh metadata and new `thumbnail_signed_url`.

**Idempotent:** Yes. **Sync:** Synchronous for MVP. Candidate for `202` async if Figma latency proves problematic in practice.

---

### `POST /webhooks/figma` *(not proxied from Jira)*

Receive Figma push events.

**Auth:** Figma passcode field in request body (from Secrets Manager). Invalid passcode → `401`, no processing.

**Response:** `200` immediately. Processing inline (MVP — no queue).

**Processing order:**
1. Validate passcode
2. Extract `file_key` from payload
3. Find all active `design_links` for `figma_file_key`
4. For each: fetch updated metadata, compare `last_modified_at`
5. If changed: overwrite S3 thumbnail, update `sync_state`, set `change_detected_at`
6. If changed and `design_status = READY_FOR_DEV`: transition to `CHANGES_AFTER_DEV`
7. Write `WEBHOOK_RECEIVED` and `DESIGN_CHANGED` audit events

**Idempotent:** Yes — processing the same event twice converges to the same state.

---

### Shared `LinkDto`

```typescript
interface LinkDto {
  id: string
  issue_key: string
  figma_url: string
  figma_file_key: string
  figma_node_id: string | null
  resource_type: 'FILE' | 'FRAME' | 'PROTOTYPE' | 'FIGJAM'
  design_status: 'NONE' | 'IN_PROGRESS' | 'READY_FOR_DEV' | 'CHANGES_AFTER_DEV'
  file_name: string
  node_name: string | null
  thumbnail_signed_url: string | null  // S3 pre-signed URL, 1hr TTL; null = no thumbnail
  last_modified_at: string             // ISO 8601
  last_synced_at: string | null        // ISO 8601
  linked_by_jira_user: string
  linked_at: string                    // ISO 8601
}
```

---

### Error model

```typescript
{
  error: {
    code: string      // machine-readable, stable
    message: string   // human-readable, not for parsing
    request_id?: string  // Lambda request ID for log correlation
  }
}
```

| HTTP | `code` | Meaning |
|---|---|---|
| `400` | `INVALID_FIGMA_URL` | URL does not parse as a valid Figma resource URL |
| `401` | `INVALID_API_KEY` | Missing or incorrect `x-api-key` |
| `401` | `INVALID_WEBHOOK_PASSCODE` | Figma webhook passcode mismatch |
| `403` | `FIGMA_ACCESS_DENIED` | Service token lacks access to this Figma resource |
| `404` | `LINK_NOT_FOUND` | Link does not exist or is soft-deleted |
| `404` | `FIGMA_RESOURCE_NOT_FOUND` | Figma returned 404 for this file/node |
| `422` | `INVALID_STATUS_VALUE` | `status` is not a valid `DesignStatus` value |
| `429` | `FIGMA_RATE_LIMITED` | Figma API rate limit hit |
| `500` | `INTERNAL_ERROR` | Unexpected server error |
| `503` | `FIGMA_UNAVAILABLE` | Figma API returned 5xx |

---

### Figma API — implementation detail boundary

These Figma API endpoints are consumed internally by `sync-service` only. The Jira plugin has no knowledge of Figma API URLs, tokens, or response schemas.

| Figma endpoint | Used by | Purpose |
|---|---|---|
| `GET /v1/files/{fileKey}` | `figma-client.ts` | File name, `last_modified` |
| `GET /v1/files/{fileKey}/nodes?ids={nodeId}` | `figma-client.ts` | Node name, `last_modified` |
| `GET /v1/images/{fileKey}?ids={nodeId}&format=png` | `thumbnail-service.ts` | Thumbnail image URL (temporary) |
| `POST /v2/webhooks` | `links-service.ts` | Register file-level webhook |
| `DELETE /v2/webhooks/{webhookId}` | `polling-sync.ts` | Deregister webhook |
| `GET /v2/me` | `config.ts` cold-start | Validate `FIGMA_SERVICE_TOKEN` on startup |

**Known assumptions:**
- Figma image URLs from `/v1/images` are temporary — this is why thumbnails are stored in S3
- Webhook v2 is the current API; v1 is deprecated
- Figma rate limits are undocumented with hard numbers; `polling-sync` must back off on `429`

---

## 8. Monorepo Structure

```
figma-jira/
├── apps/
│   ├── jira-dc-plugin/
│   │   ├── src/main/
│   │   │   ├── java/com/yourorg/figurajira/
│   │   │   │   ├── rest/             # Thin REST proxy handlers
│   │   │   │   └── config/           # Plugin config helpers
│   │   │   ├── resources/
│   │   │   │   ├── atlassian-plugin.xml
│   │   │   │   └── templates/        # Velocity: admin config page
│   │   │   └── frontend/
│   │   │       ├── src/
│   │   │       │   ├── panel/        # Issue view panel (main UI)
│   │   │       │   └── admin/        # Admin config page
│   │   │       ├── package.json
│   │   │       ├── vite.config.ts
│   │   │       └── tsconfig.json
│   │   ├── pom.xml
│   │   └── README.md
│   │
│   └── sync-service/
│       ├── src/
│       │   ├── handlers/
│       │   │   ├── api-handler.ts
│       │   │   ├── webhook-handler.ts
│       │   │   └── polling-sync.ts
│       │   ├── services/
│       │   │   ├── figma-client.ts
│       │   │   ├── links-service.ts
│       │   │   ├── sync-service.ts
│       │   │   └── thumbnail-service.ts
│       │   ├── db/
│       │   │   ├── client.ts
│       │   │   ├── migrations/
│       │   │   └── queries/
│       │   │       ├── links.ts
│       │   │       ├── sync-state.ts
│       │   │       ├── webhooks.ts
│       │   │       └── audit.ts
│       │   ├── lib/
│       │   │   ├── api-key-auth.ts
│       │   │   ├── secrets.ts
│       │   │   ├── errors.ts
│       │   │   └── figma-url.ts
│       │   └── config.ts
│       ├── infra/
│       │   ├── bin/app.ts
│       │   ├── lib/
│       │   │   ├── sync-service-stack.ts
│       │   │   ├── lambdas.ts
│       │   │   ├── database.ts
│       │   │   └── storage.ts
│       │   └── cdk.json
│       ├── .env.example
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   └── shared-types/
│       ├── src/
│       │   ├── enums.ts
│       │   ├── dtos.ts
│       │   ├── schemas.ts
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── docs/
│   ├── superpowers/specs/
│   └── adr/
│
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .editorconfig
├── .gitignore
└── README.md
```

---

## 9. Phased Delivery Plan

### Phase 0 — Repo scaffold *(this session)*
- Monorepo config, shared-types skeleton, sync-service skeleton, plugin skeleton, infra skeleton, all docs
- Exit criteria: repo builds without errors; types compile; plugin passes `mvn package`

### Phase 1 — Core link CRUD + panel display *(first working feature)*
- `api-handler`: parse, CRUD, signed URL generation
- DB migrations: all four tables
- `figma-client`, `links-service`, `thumbnail-service`
- Jira plugin REST proxy endpoints wired to AWS
- React panel: link cards with thumbnail, status badge, open/unlink actions
- Admin page: API GW URL + API key configuration
- Exit criteria: user can paste a Figma URL on a Jira issue, save it, and see a card with thumbnail and metadata

### Phase 2 — Sync, change detection, status
- `webhook-handler`: Figma webhook intake + processing
- `polling-sync`: sweep + retry logic with `next_sync_at`
- Webhook registration/deregistration on link create/delete
- `READY_FOR_DEV → CHANGES_AFTER_DEV` automatic status transition
- Manual status change from panel
- Stale thumbnail refresh
- Exit criteria: changing a design in Figma updates the Jira panel; "ready for dev" designs flag when changed

### Phase 3 — Polish, admin visibility, reporting
- Admin page: all links across issues, sync state overview
- JQL-compatible search — **requires spike first; not guaranteed**
- Panel: last synced timestamp, manual refresh button, error states
- Audit event viewer in admin
- Exit criteria: admin can see all linked designs and sync health; developers understand design status at a glance

### Phase 4 — Figma plugin *(separate spec)*
- `apps/figma-plugin` — create Jira issue from Figma, view linked issues from Figma
- Depends on Phase 1–2 being stable
- Requires its own brainstorm → spec → plan cycle

---

## 10. Minimum Testing Expectations

| Area | Minimum coverage |
|---|---|
| `figma-url.ts` (URL parser) | Unit tests: all resource type URLs, malformed URLs, node IDs with hyphens vs colons, branch URLs |
| Status transition logic | Unit tests: all manual transitions, `READY_FOR_DEV → CHANGES_AFTER_DEV` sync transition, idempotent same-status update |
| DB query layer (`db/queries/`) | Integration tests against local PostgreSQL: insert, upsert, soft-delete, polling sweep query |
| `api-handler` | Handler unit tests with mocked DB and Figma client: happy path per endpoint, known Figma error codes |
| `webhook-handler` | Unit test: valid passcode accepted, invalid rejected, change detection triggers status transition |
| Jira REST proxy | Smoke tests against local AMPS: proxy forwards headers, propagates non-200 responses from Lambda |

Tests live in `__tests__/` alongside source in each package. No coverage percentage targets for MVP.

---

## 11. Known Risks and Deferred Decisions

| Risk / Gap | Severity | Status |
|---|---|---|
| JQL custom field support on Jira DC | Medium | Spike required in Phase 3 — not guaranteed |
| Figma rate limits (undocumented hard numbers) | Medium | Polling-sync must implement backoff; monitor in production |
| Jira DC local dev requires a valid license | Low | Document in plugin README; team must obtain evaluation license |
| Figma webhook v2 API stability | Low | Use v2 only; monitor Figma changelog |
| Lambda cold start latency on `api-handler` | Low | Acceptable for internal tool; provisioned concurrency available if needed |
| API key rotation process | Low | Manual operational runbook; not automated in MVP |
| `FIGMA_SERVICE_TOKEN` expiry | Medium | Figma tokens do not expire but can be revoked; add startup validation via `GET /v2/me` |
| Thumbnail Figma image URL expiry during parse step | Low | Expected; preview URL is temporary by design |
| Jira Server (non-DC) compatibility | Low | Data Center first; Server may work with same extension points but is untested |

---

## 12. Decisions Not Yet Made (Deferred to Implementation Planning)

- ORM / query builder selection for `sync-service` DB layer (candidates: `kysely`, raw `pg`, `drizzle-orm`)
- CDK vs SAM for infrastructure-as-code (CDK preferred; SAM acceptable if team prefers)
- React bundler version and Jira web panel injection method (iframe vs. inline)
- Polling interval default value and configurability
- Maximum backoff cap for failed syncs
- Whether `POST /issues/.../links/{id}/sync` should become async (`202`) based on observed Figma latency
