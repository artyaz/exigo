# δ proposals — ux-001

Proposer wave. Evidence class must support each fix. Gate authored separately by ε.

| ID | Surface | Finding | Class | Fix applied |
|----|---------|---------|-------|-------------|
| D-001 | sign-in / sign-up | unlabeled AuthInput | MECHANICAL-DOM | `aria-label` defaults to placeholder; optional `id` |
| D-002 | sign-in / sign-up | loading submit nameless | MECHANICAL-DOM | `aria-busy` + sr-only children while loading |
| D-003 | sign-in / sign-up | divider contrast ~3.77:1 | MECHANICAL-CSS | `text-tertiary` → `text-secondary` (white/60) |
| D-004 | settings | unlabeled inputs | MECHANICAL-DOM | `<label htmlFor>` + ids |
| D-005 | settings | div radios | MECHANICAL-DOM | `<button type="button" role="radio">` |
| D-006 | settings | subtitle/label contrast | MECHANICAL-CSS | `--white-30/40` → `--white-60` |
| D-007 | settings | missing h1 | MECHANICAL-DOM | title → `<h1>` |
| D-008 | spaces | unlabeled create input | MECHANICAL-DOM | `aria-label="Space name"` + id |
| D-009 | spaces | mobile create btn empty name | A11Y-TREE (source) | `aria-label` + sr-only/md-visible text |
| D-010 | playground | missing h1 | MECHANICAL-DOM | title → `<h1>` |
| D-011 | playground | chip hit target 21px | MECHANICAL-CSS | `min-height/min-width: 24px` |
| D-012 | pricing | loading CTA empty name | A11Y-TREE (source) | `aria-label` + sr-only + `aria-busy` |

Not fixed (abstained / deferred):
- Perceptual corroboration of contrast/hit-targets (bridge absent)
- BR-001 focus-visible / keyboard sequence publish pass
