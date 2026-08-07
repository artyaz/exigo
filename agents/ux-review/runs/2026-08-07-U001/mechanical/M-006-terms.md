# M-006 — terms.default

## Summary
- findings: 0
- surface: `src/app/terms/page.tsx`
- evidence: repo-first TypeScript/TSX (render bridge absent)

## Findings

_None._

## Auto-cleared
- heading order — `h1` at `src/app/terms/page.tsx:26`, then `h2` sections at `:50`, `:77`, `:102`; no skips
- `<img>` missing alt — no `<img>` in surface
- form controls without label / aria-label / aria-labelledby — no form controls
- clickable non-button (`div`/`span` + `onClick`) — none; nav/back use `<a>` / `Link`
- non-descriptive link text — “Back”, section titles, and `contact@chmyl.com` mailto text
- declared hit-target under 24px — back control uses `px-3 py-1.5 text-xs`; section nav uses `px-3 py-2 text-sm`; no explicit sub-24px height/min-height in source
- token contrast — skipped (no AC-02-safe numeric contrast claim authored)
