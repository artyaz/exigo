# M-005 — pricing.default

## Summary
- findings: 1
- surface: `src/app/pricing/page.tsx`
- evidence: repo-first TypeScript/TSX (render bridge absent)

## Findings

### F-001
- evidence_class: A11Y-TREE
- severity: minor
- control: form-control-name
- claim: When checkout is loading, the plan CTA replaces its text with a Lucide `Loader2` icon that ships `aria-hidden` by default, leaving the `<button>` with no accessible name for that state.
- citation: src/app/pricing/page.tsx:317
- fix_hint: Keep a stable `aria-label` (e.g. “Switch to this plan”) on the button, and/or expose loading via `aria-busy` plus visually-hidden status text instead of swapping the only named content for an aria-hidden spinner.

## Auto-cleared
- heading order — `h1` (`src/app/pricing/page.tsx:410` / `:447`) then per-plan `h2` (`:246`); no skips
- `<img>` missing alt — no `<img>` in surface
- form controls without label / aria-label / aria-labelledby — billing period `role="group"` has `aria-label="Billing period"` (`:480`); toggle buttons have visible text names; non-loading CTAs named by text
- clickable non-button (`div`/`span` + `onClick`) — none; actions use `Link` / `<button>`
- non-descriptive link text — “Back”, “Sign in”, “Sign in to subscribe”, perk link text from `perk.text`
- declared hit-target under 24px — primary CTAs use `py-2.5` / `py-2` with `text-sm`; no explicit sub-24px height declared in source
- token contrast — skipped (no AC-02-safe numeric contrast claim authored)
