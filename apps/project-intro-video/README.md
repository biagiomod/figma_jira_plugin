# Figma for Jira DC — Intro Video

A Remotion video package that produces a 90-second (1920×1080, 30fps) intro and demo video for **Figma for Jira Data Center** — an internal Jira DC P2 plugin that links Figma designs to Jira issues.

---

## What this package produces

A polished, enterprise-appropriate 90-second video covering:

1. **Scene 1 (0–18s):** The problem — design, Jira, and Slack are disconnected
2. **Scene 2 (18–30s):** The cost — status ambiguity, handoff uncertainty, rework
3. **Scene 3 (30–48s):** The solution — Figma designs linked directly in Jira
4. **Scene 4 (48–66s):** Change detection — webhook sync and polling fallback
5. **Scene 5 (66–80s):** Architecture — secure AWS backend diagram
6. **Scene 6 (80–90s):** Close — outcomes and engineering review invite

---

## Prerequisites

- Node.js 20+
- pnpm 9+
- Chrome or Chromium (Remotion uses it for rendering)

---

## Install

From the `apps/project-intro-video/` directory:

```bash
pnpm install
```

Or from the monorepo root:

```bash
pnpm install
```

---

## Preview (Remotion Studio)

Opens an interactive studio in your browser where you can scrub through scenes:

```bash
pnpm preview
```

This runs `remotion studio` and opens `http://localhost:3000`.

---

## Render to MP4

```bash
pnpm render
```

Output: `out/figma-jira-dc-intro.mp4` (H.264, 1920×1080, 30fps)

### Render a specific scene only

```bash
npx remotion render Scene3-Solution out/scene3.mp4
```

Valid composition IDs:
- `FigmaJiraDCIntro` — full 90-second video
- `Scene1-Problem`
- `Scene2-Cost`
- `Scene3-Solution`
- `Scene4-ChangeDetection`
- `Scene5-Architecture`
- `Scene6-Close`

---

## Replace placeholder screenshots

Placeholder boxes appear wherever real screenshots would go. See [`public/placeholder-assets.md`](./public/placeholder-assets.md) for the full list with exact file paths and replacement instructions.

**Quick reference:**

| Placeholder | File to add | Used in |
|-------------|-------------|---------|
| Figma frame thumbnail | `public/thumbnail-checkout-frame.jpg` | Scene 3, Scene 4 |
| Figma logo | `public/icons/figma.svg` | Scene 1 |
| Jira logo | `public/icons/jira.svg` | Scene 1 |

After adding assets, update the relevant component to use `<Img src={staticFile('...')} />` from Remotion.

---

## Update copy / narration

- **All on-screen text** lives in the individual scene files: `src/scenes/Scene*.tsx`
- **Narration script and timing notes:** `src/script.md`
- Each scene file has a `TEXT_LINES` or inline text constant near the top — easy to find and edit

---

## Adjust timing

Scene boundaries are defined in `src/tokens.ts` under `timing`:

```typescript
timing: {
  fps: 30,
  totalFrames: 2700,  // 90 seconds total
  scene1Start: 0,    scene1End: 540,   // 0–18s
  scene2Start: 540,  scene2End: 900,   // 18–30s
  scene3Start: 900,  scene3End: 1440,  // 30–48s
  scene4Start: 1440, scene4End: 1980,  // 48–66s
  scene5Start: 1980, scene5End: 2400,  // 66–80s
  scene6Start: 2400, scene6End: 2700,  // 80–90s
}
```

After changing timing:
1. Update `tokens.ts`
2. Update `Root.tsx` — the `durationInFrames` values for each `Series.Sequence` and each `Composition`
3. Adjust animation keyframes inside the affected scene file if needed

---

## Add voiceover or background music

Place audio files in `public/` and wire them into `src/Root.tsx`:

```tsx
import { Audio, staticFile } from 'remotion';

// Inside FigmaJiraDCIntro, alongside the Series:
<Audio src={staticFile('voiceover.mp3')} />
<Audio src={staticFile('bg-music.mp3')} volume={0.12} />
```

---

## Export / render options

```bash
# Default H.264 MP4
pnpm render

# ProRes (for video editors)
npx remotion render FigmaJiraDCIntro out/figma-jira-dc-intro.mov --codec=prores

# WebM
npx remotion render FigmaJiraDCIntro out/figma-jira-dc-intro.webm --codec=vp8

# Export a single PNG still at a specific frame
npx remotion still FigmaJiraDCIntro out/still-frame-0.png --frame=0
```

---

## Project structure

```
src/
  index.ts              # Remotion registerRoot entry
  Root.tsx              # Registers all compositions; stitches scenes with Series
  tokens.ts             # Design tokens: colors, fonts, timing
  script.md             # Narration script + timing notes
  scenes/
    Scene1Problem.tsx
    Scene2Cost.tsx
    Scene3Solution.tsx
    Scene4ChangeDetection.tsx
    Scene5Architecture.tsx
    Scene6Close.tsx
  components/
    StatusChip.tsx       # Design status badge (Ready for Dev, Changes After Dev, etc.)
    DesignCard.tsx       # Figma design preview card shown in Jira panel
    ToolCard.tsx         # Figma/Jira/Slack tool cards in Scene 1
    ArchNode.tsx         # Architecture diagram nodes, arrows, zone labels
    CostCard.tsx         # Cost/friction cards in Scene 2
    Typography.tsx       # Heading, Body, Label, Caption text components
public/
  placeholder-assets.md # Documents all placeholders and replacement instructions
```
