# Extraction Record — `loop-compose`

**Filed by:** loop-forge cycle-001 orchestrator (during Wave β consolidation)
**Filed at:** 2026-07-25
**Filed from:** R-003 dossier (idea I-001-S3)
**Child loop:** `agents/loop-compose/`
**Child's `remaining_extraction_depth`:** 2 (parent loop-forge has depth 3; child = parent − 1 per C-001-can-03)

## Trigger (the itch)

During Wave β consolidation, R-003 (verifying idea I-001-S3: typed ports + 3-state composition verdict + baseline delta-test) returned **ADVANCE @ 0.72** with the observation:

> Each mechanism is grounded in decades-old literature with live citations. The riskiest assumption (decidability from prose) is real but self-repairing — the idea itself mandates typed-port blocks, but only for forward-authored loops.

R-003 also noted that the composition operation is **non-trivial** (it requires a composition contract, a verdict, a delta-test, and an authoring pass) and **reusable beyond loop-forge** (any caller wanting to compose two existing loops benefits, not just loop-forge authoring a new loop from a target domain).

This satisfies the loop-itch criteria from `agents/loop-forge/LOOP.md` §6.1:

- **Repeating decision points**: every future loop-forge cycle that wants to compose with an existing loop would re-derive the composition protocol.
- **Multiple wave-worthy slices**: composition has its own enumerate → verdict → delta-test → author → ship waves.
- **Own stop conditions**: composition has its own goal-anchored / novelty-decay / budget stop conditions.

## Sub-problem summary

Author a loop that takes two existing loops (each with a `ports:` block) plus a composition contract, and produces a new loop that is the typed-port composition of the two parents, gated by:

1. The 3-state COMPOSE/CONFLICT/ORTHOGONAL verdict (typed-port match + resource-collision check)
2. The baseline delta-test (composed must beat BOTH parents on a declared property)
3. The canary ship-gate (sealed run + reverse-authority + day-status oracle)

## Residual scope (what the child loop owns)

The child loop owns:

- Reading two parent loops' `ports:` blocks
- Enumerating port-binding candidates
- Issuing the 3-state composition verdict
- Drafting and running the delta-test
- Authoring the composed `LOOP.md` + skeleton
- Running the canary ship-gate on the composed loop
- Maintaining the composition manifest (stare decisis memory)

The parent (loop-forge) retains ownership of:

- Authoring loops from a target domain statement (the Ω→α→β→γ→δ→ε flow)
- The mid-task extraction protocol itself (the itch-filing + depth-budget + checkpointable extract/)
- The loop-genome archive (PORTFOLIO.md, loop-novelty.jsonl, loop-constraints.jsonl)

## Composition relationship

The child loop is a **sibling** of loop-forge (not a child in the runtime sense — it has its own `runs/` directory and its own launcher). Loop-forge may invoke loop-compose when it needs to compose two loops (e.g., "loop-forge + brainstorm = a new loop that creates loops via divergent brainstorming"). The invocation goes through loop-compose's `ports:` block.

## Verification

Per `agents/loop-forge/LOOP.md` §6 (mid-task extraction protocol):

- ✓ Loop-itch filed by R-003 with evidence (repeating decision points + multiple wave-worthy slices + own stop conditions)
- ✓ Depth budget respected (parent depth 3 → child depth 2, not exceeding parent)
- ✓ Checkpointable extraction (this file is the checkpoint; child loop ships in parallel)
- ✓ Child loop has its own LOOP.md + README + archive skeleton + runs skeleton
- ✓ Child loop has its own `ports:` block (canonical C-001-can-02)
- ✓ Child loop declares its own `last_step` vocabulary (C-001-004a)
- ✓ Child loop's LINEAGE BLOCK enforces no-self-composition + no-parent-mutation (C-001-can-05)
- ✓ Child loop's canary ship-gate uses fixed trivial-domain corpus (C-001-004b)

## Future benefit

Per the user's brief: "if that loop really something we could benefit from in future". Loop-compose benefits future work because:

1. **Anytime we want to combine two loops** — e.g., "brainstorm + cd-review = a critical-divergent review loop", or "loop-forge + loop-compose = a meta-meta-loop that authors loops by composition" — we invoke loop-compose instead of re-deriving the composition protocol.
2. **The composition manifest** (`agents/loop-compose/archive/composition-manifest.jsonl`) accumulates prior compositions as stare decisis — future calls consult prior compositions for similar loop pairs.
3. **The composition primitive is itself combinable** — loop-compose can compose with loop-forge, producing a meta-composition loop. The depth budget (C-001-can-03) prevents infinite meta-recursion.
