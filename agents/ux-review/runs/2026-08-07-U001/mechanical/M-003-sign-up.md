# M-003 — sign-up.default

## Summary
- findings: 3
- auto_cleared_classes: [heading-order-skip, img-alt, div-onclick-control, non-descriptive-link-text, declared-hit-target-under-24]

## Findings

### F-001
- evidence_class: MECHANICAL-DOM
- severity: major
- control: Email / Password / verification code (`AuthInput`)
- claim: Shared `AuthInput` renders a bare `<input>` with only `placeholder` — no `<label for>`, wrapping `<label>`, `aria-label`, or `aria-labelledby`. Sign-up uses it for email, password, and (pending-verification state) the 6-digit code field.
- citation: src/app/_components/auth-ui.tsx:129-138; src/app/sign-up/[[...sign-up]]/page.tsx:113-126; src/app/sign-up/[[...sign-up]]/page.tsx:139-148
- fix_hint: Extend `AuthInput` with `label` / `aria-label` / `id` props and associate visible or sr-only labels on each call site (including verification code).

### F-002
- evidence_class: MECHANICAL-DOM
- severity: minor
- control: `AuthSubmitButton` (loading state)
- claim: When `isLoading` is true, button children are replaced by a bare `<Loader2>` with no text; button has no `aria-label` / `aria-busy`. Accessible name collapses while submitting / verifying. Single-source — needs a11y-tree corroboration.
- citation: src/app/_components/auth-ui.tsx:149-160; src/app/sign-up/[[...sign-up]]/page.tsx:128-131; src/app/sign-up/[[...sign-up]]/page.tsx:150-152
- fix_hint: Preserve “Sign Up” / “Verify Email” name via sr-only text or `aria-label`; set `aria-busy="true"` during load.

### F-003
- evidence_class: MECHANICAL-CSS
- severity: minor
- control: `AuthDivider` label (“or sign up with email”)
- claim: Divider copy uses `.text-tertiary` → `text-white/40` on `bg-neutral-950`. DERIVED contrast for white@0.4 on #0a0a0a ≈ 3.77:1 — below AA 4.5:1 for small text. Not measured in render.
- citation: src/app/_components/auth-ui.tsx:78; src/styles/globals.css:49-50; src/styles/exigo-tokens.css:16; src/app/sign-up/[[...sign-up]]/page.tsx:107
- fix_hint: Prefer `.text-secondary` (`text-white/60`) for divider copy, matching footer link contrast budget.

## Auto-cleared
- heading-order-skip: single `<h1>` via `AuthLayout` (auth-ui.tsx:30); no subordinate headings → no skip. Title swaps between “Create an Account” and “Check your email” but remains one `h1`.
- img-alt: no `<img>` elements.
- div-onclick-control: no `<div>`/`<span>` `onClick` controls; Google OAuth, submit, and “Back to sign up” (sign-up page.tsx:154-164) are `<button>` / `<Link>`.
- non-descriptive-link-text: “Sign in” (page.tsx:171-173), consent “Terms of Service” / “Privacy Policy” / “Refund Policy” (legal-ui.tsx:25-35), and corner “Terms • Privacy • Refunds” (legal-ui.tsx:15) are descriptive — not bare “click here”/“here”/“more”/“read more”.
- declared-hit-target-under-24: same shared auth chrome as sign-in — `py-3` / `py-2.5` on primary buttons/inputs; no explicit sub-24px `width`/`height`/`min-*` on interactive controls. `LegalCornerLink` `py-1` + `text-[11px]` lacks an explicit under-24 box declaration — not flagged.
