# M-008 — playground.default

## Summary
- findings: 2
- surface: `src/app/playground/page.tsx` (shell/a11y only; `ReactiveExercise` mount not deep-audited)
- evidence: repo-first TypeScript/TSX/CSS string (render bridge absent)

## Findings

### F-001
- evidence_class: MECHANICAL-DOM
- severity: major
- control: heading-order
- claim: The page title “Exigo Playground” is a `<span className="pg__title">`, not an `h1`. The shell declares no heading elements, so there is no document heading outline for this surface.
- citation: src/app/playground/page.tsx:81
- fix_hint: Change `pg__title` to an `h1` (keep the same class for styling), or wrap the head in a landmark with an `h1`.

### F-002
- evidence_class: MECHANICAL-CSS
- severity: major
- control: hit-target
- claim: Preset chip buttons declare `padding:5px 11px` and `font-size:11px` with no `min-height` ≥ 24px. Vertical padding (5+5) + font-size (11) = 21px declared content+padding floor — under the 24px hit-target threshold (AC-02 numbers from this CSS source).
- citation: src/app/playground/page.tsx:20
- fix_hint: Raise chip hit area with `min-height:24px` (and matching min-width) or increase block padding so padding-block + content ≥ 24px.

## Auto-cleared
- `<img>` missing alt — no `<img>` in playground shell
- form controls without label / aria-label / aria-labelledby — `<textarea>` has `aria-label="spec editor"` (`src/app/playground/page.tsx:103`); preset controls are `<button type="button">` with visible `p.label` text
- clickable non-button (`div`/`span` + `onClick`) — chips use `<button>`; no `div`/`span` onClick in shell
- non-descriptive link text — no `<a>` / `Link` in shell
- heading skips among existing headings — N/A beyond F-001 (no heading nodes present to skip between)
- token contrast — skipped (chip/editor colors use token vars; no numeric contrast ratio claimed without overreaching AC-02)
