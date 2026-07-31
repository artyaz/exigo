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

---

## Independent corroboration: SonarCloud flagged the planted defects

Unplanned, and worth recording. When this run was opened as PR #107, SonarCloud
scanned `fixtures/planted.html` as if it were product code and raised **2 bugs** —
both of them planted defects from the table above:

| Sonar finding | Severity | Bench row |
|---|---|---|
| `planted.html:14` — "Add an `id` attribute to this input field and associate it with a label." | MAJOR | **#5** (input with no `<label>`) |
| `planted.html:16` — "Add a `onKeyDown\|onKeyUp` attribute to this `<div>` tag." | MINOR | **#7** (`<div onclick>` as a button) |

Two things follow.

**1. The fixtures are realistic.** An independent, non-LLM static analyser
recognised the same defects the bench plants. That is external evidence the
planted arm is not a strawman built to be easy.

**2. It sharpens bench row #5.** The bench scored #5 as only *partial*, because
`BrowserObserve` reported "textbox with accessible name Search" — the
`placeholder` supplies an accessible name and masks the missing `<label>`. Sonar,
reading the source rather than the accessibility tree, caught it outright at
MAJOR. This is precisely the DOM-vs-a11y-tree divergence that **AC-03**
(cross-check, never substitute) exists to exploit: the a11y tree said "named",
the source said "unlabelled", and the *disagreement* is the finding. Static
source analysis is the stronger detector for this class, and the authored loop's
wave μ is repo-first for exactly this reason.

**Consequence for CI:** the fixtures are excluded from SonarCloud analysis via
`.sonarcloud.properties` (`sonar.exclusions=agents/**/recon/fixtures/**`). The
defects must stay exactly where they are — they are the measurement instrument —
but they must not be scored as product code, or the quality gate fails forever on
defects that are the point.
