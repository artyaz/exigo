# M-004 — home.default

## Summary
- findings: 0
- surface: `src/app/page.tsx`
- evidence: repo-first TypeScript/TSX (render bridge absent)

## Findings

_None._

## Auto-cleared
- heading order — single `h1` at `src/app/page.tsx:17`; no lower headings, no skips
- `<img>` missing alt — no `<img>` in surface
- form controls without label / aria-label / aria-labelledby — no form controls
- clickable non-button (`div`/`span` + `onClick`) — none; CTAs are `Link` elements
- non-descriptive link text (`click here` / `here` / `more`) — links use “Get started”, “Pricing”, “Terms”, “Privacy”, “Refunds”
- declared hit-target under 24px — no interactive control declares an explicit sub-24px height/min-height/padding+font-size floor in this file’s CSS source
- token contrast — skipped (no contrast claim derived solely from `exigo-tokens.css` / explicit class pair without stretching AC-02)
