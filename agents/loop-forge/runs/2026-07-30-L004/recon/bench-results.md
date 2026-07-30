# Ω discrimination bench — measured detection on the planted fixture

Seeds the test bench canonical invariant **C-001-can-01** requires ("ship a
built-in discrimination test bench gating primitive promotion"). Two fixtures:
`fixtures/planted.html` (8 planted defects) and `fixtures/clean.html` (the same
screen built correctly). Measured through the validated evidence path
(§ loop-spec: publish → inner `pub.hyperagent.com/p/<id>` → browser).

| # | Planted defect | Evidence class | Detected? | By what |
|---|---|---|---|---|
| 1 | text at ~1.9:1 contrast | PERCEPTUAL (pixels) | **yes** | screenshot — renders visibly washed out |
| 2 | text at ~1.1:1 contrast | PERCEPTUAL (pixels) | **yes** | screenshot — near-invisible |
| 3 | heading order `h1 → h4` | MECHANICAL (DOM) | **yes** | pristine DOM |
| 4 | `<img>` with no `alt` | MECHANICAL + a11y tree | **yes** | Observe: "image element with no alt text" |
| 5 | `<input>` with no `<label>` | MECHANICAL | **partial** | Observe reports "accessible name Search" — the *placeholder* supplies a name, masking the defect. Detectable in DOM (no `<label for>`, no `aria-label`) but **not** via the a11y tree alone. |
| 6 | 14px hit target (< 24px) | MECHANICAL (geometry) | **partial** | Observe returns a selector but no box size; the screenshot shows it is tiny. No computed-geometry API is exposed, so this needs CSS-source derivation or pixel measurement. |
| 7 | `<div onclick>` as a button | MECHANICAL (cross-check) | **yes, by absence** | present in DOM with `onclick`, but Observe omits it from the control list → DOM-vs-a11y-tree mismatch is the finding |
| 8 | non-descriptive link "click here" | MECHANICAL (a11y tree) | **yes** | Observe returns the accessible name; a rule can flag it |

**Score: 6 detected, 2 partial, 0 missed.** Both partials are informative rather
than fatal: #5 shows the a11y tree can *mask* a defect the DOM reveals (so the
two sources must be cross-checked, not substituted), and #6 marks the one
genuine capability gap — no computed-style/geometry access.

**Clean-control check:** the same probes on `fixtures/clean.html` must yield zero
findings. Not yet executed — carried into ε as the canary's false-positive arm.
A bench with no clean arm measures recall only, and recall alone is how a
rubber-stamping reviewer scores well.

## The capability gap, stated plainly

There is **no script-evaluation tool** in the browser surface (no
`BrowserEvaluate`). So the loop cannot read `getComputedStyle`, cannot call
`getBoundingClientRect`, and cannot run axe-core in-page. Consequences:

- Contrast is obtainable as *rendered pixels* (screenshot) but not as a
  *computed ratio*. A numeric WCAG verdict must therefore be derived from CSS
  source / Tailwind tokens, with the screenshot as corroboration.
- Hit-target geometry has the same shape: derive from CSS, corroborate visually.
- This is exactly where a UX loop is tempted to narrate a number it never
  measured. It is the single most important thing for the Adversary to hunt.
