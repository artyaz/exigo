# M-007 — spaces.default

## Summary
- findings: 2
- surface: `src/app/spaces/page.tsx` (+ `src/app/_components/legal-ui.tsx` via `LegalCornerLink`)
- evidence: repo-first TypeScript/TSX (render bridge absent)

## Findings

### F-001
- evidence_class: MECHANICAL-DOM
- severity: major
- control: form-label
- claim: The create-space text `<input>` has a placeholder only — no associated `<label>`, `aria-label`, or `aria-labelledby`.
- citation: src/app/spaces/page.tsx:120
- fix_hint: Add a visible `<label htmlFor="…">` (or `aria-label="Space name"`) wired to a stable `id` on the input; do not treat placeholder as the name.

### F-002
- evidence_class: A11Y-TREE
- severity: major
- control: form-control-name
- claim: The submit control’s only text node (“Create Space”) is in a `span` with `hidden md:inline` (display:none below `md`). The icon sibling (`Plus` / `Loader2`) is a Lucide SVG that defaults to `aria-hidden`, so the button’s accessible name is empty on the default (mobile-first) cascade.
- citation: src/app/spaces/page.tsx:132
- fix_hint: Add `aria-label="Create Space"` on the `<button>`, or keep the text in the accessibility tree (e.g. `sr-only` below `md` instead of `hidden`).

## Auto-cleared
- heading order — `h1` at `src/app/spaces/page.tsx:97`, space cards use `h2` at `:176`; no skips
- `<img>` missing alt — no `<img>` in surface
- clickable non-button (`div`/`span` + `onClick`) — space cards are `Link` wrapping presentational `motion.div` (no `onClick` on non-button)
- non-descriptive link text — “Pricing”, “Upgrade”, “Terms • Privacy • Refunds” (`legal-ui.tsx:15`); card links expose space name via `h2` content
- declared hit-target under 24px — create CTA uses `px-6 py-3`; `LegalCornerLink` uses `text-[11px] py-1` but rem→px for `py-1` is not fully derivable from repo CSS alone under AC-02, so no sub-24px claim filed
- token contrast — skipped (no AC-02-safe numeric contrast claim authored)
