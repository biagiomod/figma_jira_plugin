# Voiceover / Narration Script
## Figma for Jira — Data Center: Intro Video

---

## Scene 1 — The Problem
**Time range:** 0:00 – 0:18 (frames 0–540)

### On-screen text:
1. "Design lives in Figma."
2. "Work lives in Jira."
3. "Updates travel through Slack."
4. "Something is always out of sync."

### Voiceover:
> "Your designers work in Figma. Your developers track work in Jira. When something changes in a design, that update travels through Slack — or it doesn't. By the time a developer builds from the spec, nobody is sure if it's the latest version."

### Timing notes:
- Tool cards (Figma, Jira, Slack) animate in sequentially starting at frame 10
- Gap indicators appear at frame 70 to suggest disconnection
- Text lines stagger in starting at frame 100 (~3.3s)
- Last line ("Something is always out of sync.") uses amber color for emphasis

---

## Scene 2 — The Cost
**Time range:** 0:18 – 0:30 (frames 540–900)

### On-screen text:
1. "Status ambiguity."
2. "Handoff uncertainty."
3. "Rework."

### Voiceover:
> "Status ambiguity. Handoff uncertainty. Rework. These aren't edge cases — they compound quietly across every sprint, every design cycle."

### Timing notes:
- Three cost cards fade in with 30-frame stagger
- Summary line appears at frame 110 within scene (~3.7s into scene)
- Each card label maps to the on-screen text summary

---

## Scene 3 — Solution Introduction
**Time range:** 0:30 – 0:48 (frames 900–1440)

### On-screen text:
1. "Figma designs, directly in Jira."
2. "Link any file, frame, or prototype to any issue."
3. "Your team sees it where they already work."

### Voiceover:
> "Figma for Jira Data Center links your designs directly to Jira issues. Thumbnails, metadata, and design status — visible right on the issue page, where your team already works."

### Timing notes:
- Jira issue card slides in from left at frame 0
- Figma Designs panel slides in from right at frame 30
- Design card appears inside panel at frame 55
- Plugin name label "Figma for Jira — Data Center" appears at frame 90
- Text lines stagger starting at frame 120

---

## Scene 4 — Change Detection
**Time range:** 0:48 – 1:06 (frames 1440–1980)

### On-screen text:
1. "When a design changes, Jira knows."
2. "Webhook sync. Polling fallback."
3. "Status updated automatically."

### Voiceover:
> "When a linked design changes in Figma, a webhook notifies the sync service. If the webhook misses a delivery, a polling job sweeps every 30 minutes. When a change is detected on a design marked Ready for Dev, the status updates automatically."

### Timing notes:
- Design card appears at frame 0
- "Design updated" badge appears at frame 55 with subtle scale animation
- Status chip transitions from "Ready for Dev" → "Changes After Dev" at frame 85–110
- "Webhook detected change" indicator appears at frame 75
- "Polling fallback: every 30 min" appears at frame 100
- Text lines stagger starting at frame 130

---

## Scene 5 — Architecture
**Time range:** 1:06 – 1:20 (frames 1980–2400)

### On-screen text:
1. "Secure AWS backend."
2. "Your Jira DC. Your infrastructure."
3. "No external token storage."

### Voiceover:
> "The backend runs in your AWS account — API Gateway, three Lambda functions, RDS PostgreSQL, and S3 for thumbnails. All credentials live in AWS Secrets Manager. No secrets are hardcoded. No data leaves your infrastructure."

### Timing notes:
- Zone labels (Internal / AWS) appear at frames 5 and 20
- Architecture nodes animate in sequentially:
  - Jira DC Plugin: frame 0
  - API Gateway: frame 15
  - Lambda api-handler: frame 30
  - Lambda webhook-handler: frame 40
  - Lambda polling-sync: frame 50
  - RDS PostgreSQL: frame 65
  - S3: frame 75
  - Secrets Manager: frame 85
  - Figma webhook row: frame 40
- "All secrets in AWS Secrets Manager" callout appears at frame 100
- Text lines stagger starting at frame 130

---

## Scene 6 — Handoff and Close
**Time range:** 1:20 – 1:30 (frames 2400–2700)

### On-screen text:
1. "Less context switching."
2. "Clearer handoff."
3. "Better developer confidence."
4. "Figma for Jira — Data Center."
5. "Internal starter package. Available for engineering review."

### Voiceover:
> "Less context switching. Clearer handoff. Better developer confidence. Figma for Jira Data Center is a tested starter package, ready for engineering review and deployment on your Jira Data Center instance."

### Timing notes:
- Outcome lines stagger in: frames 10, 35, 60
- Divider line appears at frame 90
- Project title appears at frame 100 with accent underline animating in
- CTA line appears at frame 125

---

## Production notes

- Total duration: 90 seconds (2700 frames at 30fps)
- No music track is included — add a subtle ambient track before final export
- Voiceover should be recorded in a neutral, confident tone — no enthusiasm inflation
- The video is intended for internal stakeholder and engineering review, not marketing distribution
