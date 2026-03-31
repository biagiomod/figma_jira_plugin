# @figma-jira/shared-types

TypeScript enums, DTOs, and Zod schemas shared between the sync-service Lambda functions and the React frontend.

This is a private workspace package — it is not published to npm. It is referenced via pnpm workspace protocol by `@figma-jira/sync-service` and the Jira plugin frontend.

---

## What's in Here

| Module | Exports | Purpose |
|---|---|---|
| `enums.ts` | `ResourceType`, `DesignStatus`, `SyncStatus`, `SyncErrorCode`, `AuditEventType`, `ApiErrorCode` | String enums used across API contracts and DB values |
| `dtos.ts` | `LinkDto`, `ParsedFigmaLinkDto`, `ParseLinkRequest`, `CreateLinkRequest`, `UpdateStatusRequest`, `ApiErrorResponse`, `GetLinksResponse`, `FigmaUrlParts`, `FigmaFileMetadata`, `FigmaNodeMetadata`, `FigmaResourceMetadata`, `SyncStateDto` | TypeScript interfaces for all API request/response shapes and internal data models |
| `schemas.ts` | Zod schemas corresponding to the DTOs | Runtime validation at API boundaries |

All three modules are re-exported from the package root (`index.ts`).

---

## How to Import

```typescript
import { DesignStatus, ResourceType, LinkDto } from '@figma-jira/shared-types'
```

The package exports from `./dist/index.js`. Run `pnpm build` in this directory to compile before use, or rely on the workspace-level `pnpm build` command.

---

## Key Exports

### Enums

| Enum | Values |
|---|---|
| `DesignStatus` | `NONE`, `IN_PROGRESS`, `READY_FOR_DEV`, `CHANGES_AFTER_DEV` |
| `ResourceType` | `FILE`, `FRAME`, `PROTOTYPE`, `FIGJAM` |
| `SyncStatus` | `PENDING`, `SUCCESS`, `FAILED` |
| `SyncErrorCode` | `FIGMA_429`, `FIGMA_403`, `FIGMA_404`, `NETWORK`, `UNKNOWN` |
| `AuditEventType` | `LINK_CREATED`, `LINK_DELETED`, `STATUS_CHANGED`, `SYNC_COMPLETED`, `DESIGN_CHANGED`, `WEBHOOK_RECEIVED`, `WEBHOOK_REGISTERED`, `WEBHOOK_DEREGISTERED` |
| `ApiErrorCode` | `INVALID_FIGMA_URL`, `INVALID_API_KEY`, `LINK_NOT_FOUND`, `FIGMA_RATE_LIMITED`, `INTERNAL_ERROR`, and others |

### Key DTOs

| Interface | Description |
|---|---|
| `LinkDto` | Primary data shape returned by all link API endpoints |
| `CreateLinkRequest` | Request body for `POST /issues/{issueKey}/links` |
| `UpdateStatusRequest` | Request body for `PATCH /issues/{issueKey}/links/{linkId}/status` |
| `ParsedFigmaLinkDto` | Result of parsing a Figma URL without persisting (for the parse-preview endpoint) |
| `ApiErrorResponse` | Standard error response body shape |
| `FigmaUrlParts` | Internal parsed URL representation (fileKey, nodeId, resourceType) |

---

## Build

```bash
# From this directory
pnpm build

# From repo root (builds all packages)
pnpm build
```

TypeScript source is compiled to `dist/`. The `dist/` directory is git-ignored.

---

## Workspace Configuration

This package is declared in `pnpm-workspace.yaml` as `packages/shared-types`. Other packages reference it as:

```json
"dependencies": {
  "@figma-jira/shared-types": "workspace:*"
}
```
