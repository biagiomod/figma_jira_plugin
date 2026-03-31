# Placeholder Assets

This document lists every placeholder in the video and what real asset should replace it.

All placeholder areas are rendered as styled `div` elements with a dashed border and descriptive label text. To replace them with real screenshots, update the relevant component with an `<Img>` element from Remotion (which handles frame-accurate image loading).

---

## Scene 3 — Solution Introduction

### Placeholder 1: DesignCard thumbnail
- **Location:** `src/components/DesignCard.tsx` — the "thumbnail area" div inside the card
- **Label shown:** `[SCREENSHOT: Figma frame thumbnail]`
- **Dimensions:** 380×200px (within the card)
- **Replace with:** A screenshot of a Figma frame — ideally the Payment Screen or similar UI frame
- **Recommended source:** Export a frame from your Figma file at 2x resolution, save as `public/thumbnail-checkout-frame.jpg`
- **Remotion usage:**
  ```tsx
  import { Img, staticFile } from 'remotion';
  // Replace the placeholder div with:
  <Img src={staticFile('thumbnail-checkout-frame.jpg')} style={{ width: '100%', height: 200, objectFit: 'cover' }} />
  ```

---

## Scene 4 — Change Detection

### Placeholder 2: DesignCard thumbnail (with change badge)
- **Location:** `src/scenes/Scene4ChangeDetection.tsx` — the inline thumbnail div
- **Label shown:** `[SCREENSHOT: Figma frame thumbnail]`
- **Dimensions:** 380×200px
- **Replace with:** Same thumbnail as Scene 3, or a "modified" version of the frame
- **Notes:** The badge and status chip animate on top of this — use the same image or a slightly different crop to convey "this changed"
- **Remotion usage:** Same as above, `staticFile('thumbnail-checkout-frame.jpg')`

---

## Optional additions (not placeholders, but recommended enhancements)

### Background texture
- A subtle dot-grid or noise texture on the dark background would improve visual quality
- Save as `public/bg-noise.png` and apply as `backgroundImage` in scene containers

### Figma logo / Jira logo
- The ToolCard component currently uses Unicode symbols (◈, ◉, ◎) as icon stand-ins
- Replace with actual SVG logos in `public/icons/figma.svg` and `public/icons/jira.svg`
- Render with `<Img src={staticFile('icons/figma.svg')} />`

### Audio track
- No audio is wired up in this package
- To add a voiceover, place the audio file at `public/voiceover.mp3` and add to `Root.tsx`:
  ```tsx
  import { Audio, staticFile } from 'remotion';
  // Inside FigmaJiraDCIntro:
  <Audio src={staticFile('voiceover.mp3')} />
  ```
- For background music, use `<Audio src={staticFile('bg-music.mp3')} volume={0.15} />`

---

## Asset placement summary

| File path | Used in | Description |
|-----------|---------|-------------|
| `public/thumbnail-checkout-frame.jpg` | Scene3, Scene4 | Figma frame screenshot |
| `public/icons/figma.svg` | Scene1 ToolCard | Figma logo |
| `public/icons/jira.svg` | Scene1 ToolCard | Jira logo |
| `public/voiceover.mp3` | Root.tsx (optional) | Recorded narration |
| `public/bg-music.mp3` | Root.tsx (optional) | Ambient background track |
