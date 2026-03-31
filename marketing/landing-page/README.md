# Figma for Jira DC — Internal Landing Page

A standalone, no-build HTML landing page for presenting the Figma for Jira Data Center internal tool to engineering colleagues and stakeholders.

---

## How to view

Open `index.html` directly in any modern browser. No build step, no server, no dependencies.

```
open marketing/landing-page/index.html   # macOS
start marketing/landing-page/index.html  # Windows
```

The page is fully self-contained: `index.html` references `styles.css` in the same directory. Both files must be in the same folder.

---

## How to edit copy

All copy is inline in `index.html`. Each section is clearly marked with an HTML comment:

| Section | Comment marker in HTML |
|---|---|
| Hero | `SECTION 1: HERO` |
| Problem | `SECTION 2: PROBLEM` |
| Solution overview | `SECTION 3: SOLUTION OVERVIEW` |
| Benefits | `SECTION 4: BENEFITS` |
| Features | `SECTION 5: FEATURES` |
| Architecture | `SECTION 6: ARCHITECTURE / TECHNICAL OVERVIEW` |
| Proof / package status | `SECTION 7: PROOF / STARTER PACKAGE STATUS` |
| FAQ | `SECTION 8: OBJECTIONS / FAQ` |
| Final CTA | `SECTION 9: FINAL CTA` |
| Footer | `FOOTER` |

To edit a section, search for its comment marker in `index.html` and update the text within that section's HTML.

---

## How to replace placeholder visuals

There are two placeholder boxes in the page. Each has an HTML comment immediately above it explaining what to replace it with.

### Hero visual (right column of the hero section)
- Find the comment: `REPLACE THIS PLACEHOLDER` inside `SECTION 1: HERO`
- Replace the `<div class="placeholder-box" ...>` block with an `<img>` tag
- Recommended: a screenshot of the Jira issue page showing the Figma Designs panel
- Suggested filename: `hero-mockup.png` (place in this directory)
- Recommended size: 480×360px or 2:1.5 aspect ratio

Example replacement:
```html
<img src="hero-mockup.png" alt="Jira issue page showing the Figma Designs panel with linked thumbnail and status" style="width:100%; border-radius:10px;" />
```

### Architecture diagram
- Find the comment: `REPLACE THIS PLACEHOLDER` inside `SECTION 6: ARCHITECTURE`
- Replace the `<div class="placeholder-box arch-diagram-placeholder">` block with your diagram
- Suggested filename: `architecture-diagram.svg` or `architecture-diagram.png`
- Recommended width: 800px+

Example replacement:
```html
<img src="architecture-diagram.svg" alt="Architecture diagram: Jira DC Plugin → API Gateway → Lambda → RDS / S3 / Secrets Manager" style="width:100%; border-radius:10px;" />
```

---

## What the CTA links to

Both "Request the starter package" buttons link to `#contact`, which is a placeholder anchor at the bottom of the page.

**Before using this page with real stakeholders, update the `href` on both CTA buttons:**

1. Search for `href="#contact"` in `index.html` — there are two instances (hero and final CTA section)
2. Replace with the appropriate destination:
   - An email link: `href="mailto:your-team@yourorg.com?subject=Figma+for+Jira+DC+Starter+Package"`
   - A form URL: `href="https://your-internal-form-url"`
   - A Jira request ticket: `href="https://your-jira.yourorg.com/browse/XXXX"`

The "Technical docs" link in the footer also uses `href="#"` as a placeholder — update it to point to your actual documentation location (e.g., Confluence, GitHub).

---

## Who this page is for

This page is intended for:
- **Engineering teams** evaluating whether to adopt the integration
- **Engineering managers and tech leads** assessing scope, architecture, and maintenance overhead
- **Stakeholders** who need a clear, honest overview of what the tool is and what it requires

It is not a public-facing marketing page. It does not make performance claims beyond what has been verified. The "starter package" framing is intentional — the page is honest about the fact that infrastructure setup is required before the tool is operational.

---

## Editing styles

All visual styles are in `styles.css`. CSS custom properties (variables) are defined at the top of the file in the `:root` block — color palette, spacing, and typography scales can be adjusted there without hunting through the file.

Key variables:
- `--color-accent` — primary button and highlight color (`#7B61FF`)
- `--color-hero-bg` — dark hero/footer background (`#0A0A0F`)
- `--color-bg` — page background (`#F9F9FB`)
- `--section-pad` — vertical section padding (`80px`)
- `--max-width` — maximum content width (`1080px`)
