# Messaging Brief — Figma for Jira Data Center

**Purpose:** Grounds all communications (video, landing page, internal presentations) in accurate, consistent messaging. Do not invent claims beyond what is documented here.

---

## Problem Statement

Design teams work in Figma. Engineering teams work in Jira. When a design changes, the update does not automatically surface in Jira. Developers check Figma manually, lose track of what is current, and occasionally build from outdated specs. There is no reliable, visible signal for "this design is ready to build." The result is rework, clarification overhead in Slack, and slower, less confident handoff.

For teams on Jira Data Center, the Figma for Jira integration available on Atlassian Cloud is not accessible. The tooling gap is real, and internal workarounds — shared links, Confluence embeds, status comments — are inadequate substitutes.

---

## Audience

**Primary (practitioners):**
- Software engineers who want to know whether a design spec is current before building
- Product designers who want to communicate design status without leaving Figma
- Product managers who need a shared, visible handoff state in Jira

**Secondary (evaluators/decision-makers):**
- Engineering leads assessing the tool for team adoption
- Platform or DevOps leads reviewing the security and infrastructure posture

**Context:** Medium-to-high intent. This is an internal tool presentation — the audience already knows the problem. The page and video should confirm the solution is credible, correct for their environment, and ready to evaluate.

---

## Narrative Spine

1. **The problem is familiar:** Design context is fragmented. Jira issues lack reliable links to what was actually designed.
2. **The cost is real:** Rework, Slack clarification threads, and "which version is this?" delays compound over time.
3. **The Cloud app proves the value:** Figma for Jira (Cloud) demonstrates that linking designs directly to issues reduces friction — but it is not available on Data Center.
4. **Our project fills the gap:** A Jira DC-native internal implementation that delivers the core value: linked designs, visible thumbnails, change detection, and a reliable "Ready for Dev" signal.
5. **It is built correctly:** Secure AWS-backed architecture, no hardcoded secrets, internal-only deployment, tested codebase ready for engineering handoff.

---

## Key Messages

1. **Design context belongs in Jira, not across browser tabs.**
2. **When a Figma file changes, the linked Jira issues should surface that change automatically.**
3. **"Ready for Dev" should be a visible, reliable state — not a question you ask in Slack.**
4. **This is a Jira Data Center-native solution — not a Cloud workaround, not a Marketplace plugin.**
5. **It is built for internal use: secure, auditable, and deployable on your infrastructure.**

---

## Feature Pillars (Accurate — from approved spec)

| Pillar | Description | Notes |
|---|---|---|
| Link Figma resources to Jira issues | Attach one or more Figma files, frames, or prototypes to any Jira issue | Supports /design/, /file/, /proto/, /board/ URL types |
| In-Jira design preview | Thumbnail images and metadata (file name, last modified) visible directly on the issue page | Thumbnails cached in S3 via pre-signed URLs |
| Design change detection | Figma webhooks notify the sync service when a linked file changes; polling fallback covers gaps | FILE_UPDATE events; polling every 30 minutes |
| Design status workflow | Four statuses: None, In Progress, Ready for Dev, Changes After Dev | One automatic transition: READY_FOR_DEV → CHANGES_AFTER_DEV on detected change |
| Reliability via dual sync | Primary: Figma webhook push. Fallback: scheduled polling every 30 min | Webhook delivery failure does not cause missed updates |
| Audit logging | Key events recorded: link created/deleted, status changed, sync completed, design changed | Stored in RDS audit_events table |
| Admin configuration | API Gateway URL and API key configurable via Jira admin page | No per-user Figma auth required |

---

## Proof Points (Truthful — do not inflate)

- TypeScript compiles cleanly across all packages (`pnpm typecheck` passes)
- 44 unit tests passing (Figma URL parser, status transition logic)
- Full AWS CloudFormation template synthesizes correctly (`cdk synth` passes)
- No hardcoded secrets — all credentials via AWS Secrets Manager
- S3 bucket fully private; thumbnails accessible only via pre-signed URLs
- Internal-only deployment; not distributed via Atlassian Marketplace
- Codebase is handoff-ready with complete documentation (SETUP.md, HANDOFF.md, SECURITY.md)

---

## Claims to Avoid

| Do not claim | Reason |
|---|---|
| Per-user Figma authentication | Single org-level service token only — per-user auth is explicitly out of scope |
| Exact parity with the Cloud app | Different architecture (P2 plugin + Lambda vs Forge/Connect); different internals |
| Marketplace availability | Internal tool only |
| Real-time sync | Webhook + processing latency is acceptable, not sub-second |
| JQL custom field search | Deferred to Phase 3 — not implemented |
| Figma plugin (link from Figma to Jira) | Phase 4 — not started |
| Specific efficiency percentages | No measured results exist yet |
| "Seamless," "revolutionary," "next-generation" | No evidence; avoid hype language |

---

## Tone and Style

- Professional, confident, and direct
- Benefits before features
- Smart Brevity: short sentences, no filler, scannable structure
- Internal-enterprise appropriate: no startup marketing energy
- Honest about what is a starter implementation vs fully production-hardened
- No exclamation marks, no emojis in copy
- Language: "reduces," "surfaces," "links," "visible," "reliable" — not "transforms," "disrupts," "unlocks"

---

## Visual Identity Guidance

- Color palette: Dark backgrounds for video (#0A0A0F, #12121A), near-white text (#F0F0F4)
- Accent: Figma purple-adjacent (#7B61FF or #6B52FF), Jira blue (#0052CC)
- Typography: System sans-serif stack — Inter or system-ui for screen, clean hierarchy
- Motion: Subtle, enterprise-appropriate — fade-in, slide-up, no bounce or spring physics
- Visuals: Architecture diagrams, status chip mockups, card-style design link previews
- No stock photography; no avatars; no fake customer logos

---

## Primary Conversion Action (Landing Page)

**Primary CTA:** "Request access to the starter package"
- Appropriate framing for internal tool distribution
- Low-friction — a contact/request form, not a purchase
- Microcopy: "Internal starter package — available to engineering teams on request"

**Secondary CTA:** "View the technical overview" (anchor link to architecture section)

---

## Sources

- Approved design spec: `docs/superpowers/specs/2026-03-31-figma-jira-dc-design.md`
- Handoff documentation: `docs/HANDOFF.md`
- Security posture: `docs/SECURITY.md`
- Content guidelines: AI Landing Page Instructions v2, LandingPageGuidelines.md
- External reference: Figma for Jira (Cloud) — official documentation and marketing pages, used for problem/value framing only, not as a claim of feature parity
