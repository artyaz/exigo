# `ux-review` — UX design/review loop

The canonical protocol is **[`LOOP.md`](./LOOP.md)**.

The perceptual counterpart to `agents/cd-review/` (critical, code) and
`agents/brainstorm/` (divergent, ideas). It owns the visual and interaction layer
of the exigo app: legibility, reachability, and design-system consistency.

- Dated run artifacts: `agents/ux-review/runs/YYYY-MM-DD-UNNN/`
- Cross-run memory: `agents/ux-review/archive/`

## Read this before running it

Three properties are load-bearing and easy to get wrong:

1. **Publishing is irreversible.** `UnpublishFile` reports success while the
   inner URL keeps serving. Publishes are capped by a monotonic pre-flight
   counter and no success path may call `UnpublishFile`. See LOOP.md §4.
2. **Numbers may only come from CSS source**, never from a screenshot. The loop
   has real pixels but no `getComputedStyle` — see the evidence-class taxonomy,
   LOOP.md §2.
3. **Both bench arms run every run.** A clean-arm false positive is a bench
   failure that halts the run, not a finding. Recall without a false-positive arm
   is how a rubber-stamping reviewer scores well.

## Status: shipped, not settled

Authored by `loop-forge` cycle **loop-004**
(`agents/loop-forge/runs/2026-07-30-L004/`), passing the ε ship-gate 11/11.

All three Wave β verdicts were **INCONCLUSIVE** — none ADVANCE. The loop is
shippable because every mechanism is scoped to what its evidence actually
supports, not because the mechanisms are verified. `LOOP.md` §9 lists every open
item and what would settle it. Read it before trusting a verdict this loop emits.

Design rationale: `agents/loop-forge/runs/2026-07-30-L004/` (Ω probes and the
measured discrimination bench under `recon/`, design decisions under
`brainstorm/`, dossiers under `research/`).
