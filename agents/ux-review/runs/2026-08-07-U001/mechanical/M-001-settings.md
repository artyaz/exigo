# M-001 — settings.default

## Summary
- findings: 5
- auto_cleared_classes: [heading-order-skip, img-alt, non-descriptive-link-text, declared-hit-target-under-24]

## Findings

### F-001
- evidence_class: MECHANICAL-DOM
- severity: major
- control: Base URL / API key / Model inputs
- claim: Three `<input>` controls have adjacent visual `.st__label` spans but no associated `<label for>`, wrapping `<label>`, `aria-label`, or `aria-labelledby`. Placeholder text is not an accessible name association under §3.1.
- citation: src/app/settings/page.tsx:145-151; src/app/settings/page.tsx:153-163; src/app/settings/page.tsx:171-178
- fix_hint: Wire each field with `<label htmlFor=…>` + matching `id`, or add `aria-labelledby` pointing at the existing `.st__label` spans (give those spans stable ids).

### F-002
- evidence_class: MECHANICAL-DOM
- severity: minor
- control: Provider radio options (Gemini / Custom endpoint)
- claim: Provider choices are `<div>` elements with `onClick` acting as selectable controls. They expose `role="radio"` + keyboard handlers, but remain non-native clickable divs (prefer `<button role="radio">` or native `<input type="radio">`). Single-source DOM claim — needs a11y-tree corroboration that radios are correctly named/focused.
- citation: src/app/settings/page.tsx:107-122; src/app/settings/page.tsx:123-138
- fix_hint: Replace the clickable divs with native radios styled to match, or `<button type="button" role="radio">` inside the existing `role="radiogroup"`.

### F-003
- evidence_class: MECHANICAL-CSS
- severity: major
- control: `.st__sub` (“AI provider”)
- claim: Subtitle text uses `color: var(--white-30)` on page background `var(--neutral-950)`. Token sources: `--white-30: rgba(255, 255, 255, 0.3)` and `--neutral-950: #0a0a0a`. DERIVED contrast ≈ 2.59:1 after alpha-blend of white@0.3 onto #0a0a0a (blended ≈ #545454 on #0a0a0a) — well below WCAG AA 4.5:1 for text. Not measured in render.
- citation: src/app/settings/page.tsx:13 (`.st__sub`); src/app/settings/page.tsx:10 (`.st` bg); src/styles/exigo-tokens.css:33 (`--white-30`); src/styles/exigo-tokens.css:16 (`--neutral-950`)
- fix_hint: Raise subtitle to at least `--white-60` / `--white-70` (or solid neutral ≥ #a3a3a3) on `--neutral-950`.

### F-004
- evidence_class: MECHANICAL-CSS
- severity: minor
- control: `.st__label` / `.st__hint` / `.st__opt-d`
- claim: Form chrome text uses `color: var(--white-40)` on `--neutral-950`. Token `--white-40: rgba(255, 255, 255, 0.4)` on `#0a0a0a` DERIVED ≈ 3.77:1 after alpha-blend — fails AA 4.5:1 for normal-size text. Not measured in render.
- citation: src/app/settings/page.tsx:16-17,22 (`.st__label` / `.st__hint` / `.st__opt-d`); src/styles/exigo-tokens.css:32 (`--white-40`); src/styles/exigo-tokens.css:16 (`--neutral-950`)
- fix_hint: Bump labels/hints to `--white-60` or higher for body-size copy.

### F-005
- evidence_class: MECHANICAL-DOM
- severity: nit
- control: page title “Settings”
- claim: Visible page title is a `<span className="st__title">`, not an `<h1>`. There is no heading-level skip (no `h1`…`hN` sequence at all). Flagged only as document-outline gap outside the strict order-skip plant; demoted to nit — needs a11y-tree corroboration for landmark/heading absence.
- citation: src/app/settings/page.tsx:96
- fix_hint: Change `.st__title` element to `<h1>` (keep the class).

## Auto-cleared
- heading-order-skip: no `h1`→`hN` skip present (no heading elements in tree; order-skip class clean).
- img-alt: no `<img>` elements in this surface.
- non-descriptive-link-text: no `<a>` / `Link` with lone “click here” / “here” / “more” / “read more”.
- declared-hit-target-under-24: interactive CSS declares padding floors above 24px content box for `.st__opt` (`padding:12px 14px`, line 19) and `.st__btn` (`padding:9px 18px` + `font-size:12px`, line 26) — no explicit `width`/`height`/`min-*` under 24px on controls.
