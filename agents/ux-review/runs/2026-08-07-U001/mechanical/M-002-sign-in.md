# M-002 — sign-in.default

## Summary
- findings: 3
- auto_cleared_classes: [heading-order-skip, img-alt, div-onclick-control, non-descriptive-link-text, declared-hit-target-under-24]

## Findings

### F-001
- evidence_class: MECHANICAL-DOM
- severity: major
- control: Email / Password (`AuthInput`)
- claim: Shared `AuthInput` renders a bare `<input>` with only `placeholder` — no `<label for>`, wrapping `<label>`, `aria-label`, or `aria-labelledby`. Sign-in wires two instances (email + password). Placeholder-as-label is the planted unlabeled-input class.
- citation: src/app/_components/auth-ui.tsx:129-138; src/app/sign-in/[[...sign-in]]/page.tsx:88-101
- fix_hint: Add a visible or sr-only `<label htmlFor>` per field, or pass `aria-label` (e.g. from placeholder) through `AuthInput` props onto the `<input>`.

### F-002
- evidence_class: MECHANICAL-DOM
- severity: minor
- control: `AuthSubmitButton` (loading state)
- claim: When `isLoading` is true, button children are replaced by a bare `<Loader2>` icon with no text and the `<button>` has no `aria-label` / `aria-busy`. Accessible name collapses to empty/ambiguous from source. Single-source — needs a11y-tree corroboration of computed name while loading.
- citation: src/app/_components/auth-ui.tsx:149-160; src/app/sign-in/[[...sign-in]]/page.tsx:103-106
- fix_hint: Keep visible or sr-only “Sign In” text while loading; set `aria-busy="true"` and a stable `aria-label="Sign In"`.

### F-003
- evidence_class: MECHANICAL-CSS
- severity: minor
- control: `AuthDivider` label (“or continue with email”)
- claim: Divider copy uses `.text-tertiary` → `text-white/40` on `bg-neutral-950` (`#0a0a0a`). DERIVED contrast for white@0.4 on #0a0a0a ≈ 3.77:1 — below AA 4.5:1 for `text-sm`. Token/utility sources cited; not measured in render.
- citation: src/app/_components/auth-ui.tsx:78; src/styles/globals.css:49-50 (`.text-tertiary` → `text-white/40`); src/styles/exigo-tokens.css:16 (`--neutral-950: #0a0a0a`); src/app/sign-in/[[...sign-in]]/page.tsx:82
- fix_hint: Use `.text-secondary` (`text-white/60`, ≈7.3:1 DERIVED on #0a0a0a) or raise tertiary opacity.

## Auto-cleared
- heading-order-skip: single `<h1>` in `AuthLayout` (src/app/_components/auth-ui.tsx:30); no lower headings → no skip.
- img-alt: no `<img>` (Google mark is inline `<svg>` inside a named `<button>`, auth-ui.tsx:54-59).
- div-onclick-control: no clickable `<div>`/`<span>` with `onClick`; Google + submit use `<button>`.
- non-descriptive-link-text: links are “Sign up” (sign-in page.tsx:112-114) and “Terms • Privacy • Refunds” (legal-ui.tsx:15) — not bare “click here”/“here”/“more”/“read more”.
- declared-hit-target-under-24: primary controls declare comfortable padding (`GoogleAuthButton` `py-3`, auth-ui.tsx:52; `AuthSubmitButton` `py-2.5`, auth-ui.tsx:154; `AuthInput` `py-2.5`, auth-ui.tsx:137). `LegalCornerLink` uses `py-1` + `text-[11px]` (legal-ui.tsx:8) but has no explicit `width`/`height`/`min-*` under 24px — skipped rather than inventing a measured box.
