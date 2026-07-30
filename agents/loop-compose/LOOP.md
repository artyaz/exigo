---
loop_id: loop-compose
parent_loops: [loop-forge]
mutation_operator: extract
remaining_extraction_depth: 2
ports:
  inputs:
    - {name: loop-a-port, type: directory-path, required: true, description: "path to agents/<loopA>/"}
    - {name: loop-b-port, type: directory-path, required: true, description: "path to agents/<loopB>/"}
    - {name: composition-contract-port, type: yaml, required: true, description: "binding spec: which output of A feeds which input of B"}
  outputs:
    - {name: composed-loop-port, type: directory-path, description: "path to the new agents/<composed>/ directory"}
    - {name: composition-manifest-port, type: file, path: "agents/loop-compose/archive/composition-manifest.jsonl"}
last_step_vocabulary: [init, alpha_pair_enumerated, beta_verdicted, gamma_delta_tested, delta_authored, epsilon_canary_passed, archived]
lineage:
  parent_loops: [loop-forge]
  no_self_composition: true
  no_parent_mutation: true
  extracted_from: loop-forge
  extracted_at: 2026-07-25
  extraction_reason: "composition operation is reusable beyond loop-forge — any caller wanting to compose two loops benefits"
---

# Loop-Compose (`loop-compose`)

Continuous **enumerate → verdict → delta-test → author → ship** composition loop for Exigo.

This is a **sibling loop extracted mid-task from `agents/loop-forge/`**. Where
loop-forge authors new loops from a target domain statement, **loop-compose
authors a new loop by composing two existing loops**. Its ship target is a
new `agents/<name>/LOOP.md` that combines the autonomy envelopes of two
parent loops via a typed-port composition contract.

This loop exists because — during loop-forge's inaugural cycle — Wave β
subagent R-003 verified that the composition primitive (typed ports +
3-state COMPOSE/CONFLICT/ORTHOGONAL verdict + baseline delta-test) is a
non-trivial operation that takes two existing loops and produces a new one
(R-003 verdict: ADVANCE @ 0.72). Per the user's brief ("If agent needs, it
must create an even new loop mid-task that it thinks gonna reach more quality
work, and if that loop really something we could benefit from in future"),
the loop-forge orchestrator filed a `loop-itch.md` and extracted this
sibling loop. See `agents/loop-forge/_meta-session/runs/2026-07-25-C001/extract/loop-compose.md`
for the extraction record.

The loop alternates waves forever (until a stop condition fires):

1. **α Pair-enumerate** (orchestrator solo) — read both parent loops' `ports:`
   blocks; enumerate every (output-port-of-A, input-port-of-B) binding; for
   each binding, draft a `composition-contract.md` describing the resulting
   composed loop's purpose.
2. **β Verdict** (orchestrator solo, using the 3-state composition verdict) —
   for each candidate binding, issue one of:
   - **COMPOSE** — output port of A matches input port of B (type-compatible)
   - **CONFLICT** — autonomy envelopes collide (both claim same `runs/`
     directory, same external side-effect budget, or same `loop_id` namespace)
   - **ORTHOGONAL** — co-exist but no chaining possible (no port match)
3. **γ Delta-test** (single subagent) — for each COMPOSE candidate, draft a
   `delta_test.md` specifying a measurable property the composed loop must
   exhibit that NEITHER parent alone exhibits. Run the composed loop AND each
   parent-only baseline on the same trivial-domain input. Admit only if
   composed strictly beats both.
4. **δ Author** (orchestrator solo) — write the composed loop's `LOOP.md`,
   `README.md`, `archive/` skeleton, `runs/` skeleton, `loop-registry.json`
   sidecar. Each section paired with one constraint from the composition
   contract.
5. **ε Ship-gate** (orchestrator + 1 spawned composed-loop micro-cycle) —
   sealed canary run of the composed loop, with a spec drawn from a fixed
   trivial-domain corpus (C-001-004b). Kill-and-resume oracle on the
   composed loop's declared `last_step` vocabulary (C-001-004a).
6. **Archive** (orchestrator solo) — append the composed loop's entry to
   `agents/loop-compose/archive/composition-manifest.jsonl`. This is the
   reusable composition memory: future calls to loop-compose read the
   manifest to find prior compositions for similar loop pairs (stare decisis
   — see `agents/loop-forge/_meta-session/runs/2026-07-25-C001/brainstorm/B-008-outsider-s2.md`
   idea I-002-JUR).

## Two-layer harness

Same as loop-forge / cd-review / brainstorm: launcher (user-triggered, thin)
spawns a separate composition-scope agent (peer process, no HITL, 380k token
hard kill-switch).

## Composition contract format

```yaml
# composition-contract.md
loop_a: agents/brainstorm/
loop_b: agents/loop-forge/
binding:
  - {from: brainstorm.outputs.ideas-port, to: loop-forge.inputs.target-domain-port, adapter: identity}
operator: sequential_pipe    # one of: parallel ⊕, sequential ∘, adversarial ⊗, join-on-archive ⋈
delta_test:
  property: "the composed loop authors a new loop whose target domain was itself discovered via brainstorm, not supplied by a human"
  baseline_a: "run brainstorm alone, output ideas, no loop authored"
  baseline_b: "run loop-forge alone with a human-supplied target domain, no brainstorm"
  pass_criterion: "composed loop authors a loop AND the target domain appears in brainstorm's idea-docs"
```

## 3-state composition verdict (canonical)

For each (loop_a, loop_b) pair, the verdict is computed by:

1. **Type-match**: does any output port of A have a type-compatible with any input port of B? If no → ORTHOGONAL.
2. **Resource-collision**: do A and B claim overlapping external side-effects (same `runs/` prefix, same `MAX_OPEN_PRS` budget, same `loop_id` namespace)? If yes → CONFLICT.
3. **Default**: COMPOSE.

A CONFLICT verdict forces either rename (loop_b gets a different `loop_id` namespace) or refuse-to-ship.

## Delta-test (canonical)

Admit the composed loop IFF:

```
quality(composed) > quality(baseline_a)  AND  quality(composed) > quality(baseline_b)
```

where `quality` is the property declared in `delta_test.md`. This rejects degenerate compositions ("loop-forge + brainstorm = brainstorm renamed" — the B-003 I-003-DELTA failure mode).

## Combinability with loop-forge

Loop-compose is itself combinable. Its `ports:` block (in the YAML header
above) declares inputs (loop-a-port, loop-b-port, composition-contract-port)
and outputs (composed-loop-port, composition-manifest-port).

**Composition example:** `loop-forge ⊕ loop-compose` = a meta-meta-loop that
authors loops by composing existing loops (loop-forge's `target-domain-port`
is fed by loop-compose's `composed-loop-port`).

## Stop conditions

- **Goal-anchored**: stop when N composed loops pass the ε canary.
- **Novelty-decay**: 3 consecutive cycles with 0 new COMPOSE verdicts (all pairs ORTHOGONAL or CONFLICT).
- **Budget**: max 10 compositions per session; max 4M tokens; per-cycle 380k kill-switch.
- **Blast-radius**: `MAX_NEW_LOOPS_PER_SESSION=10` (each composition creates a new loop directory).

## Conventions

- Loop IDs for composed loops: `<loopA>-<loopB>-<operator>` (e.g., `brainstorm-loopforge-pipe`).
- Run IDs: `runs/YYYY-MM-DD-LNNN-composed-<name>/`.
- Composition manifest entries are append-only; reversal flags allowed (`reversed_by` field referencing a later entry).

## History

| Date | Note |
|------|------|
| 2026-07-25 | Initial loop authored via mid-task extraction from `agents/loop-forge/` cycle-001. Extraction triggered by loop-itch filed during Wave β (R-003 verified composition primitive is non-trivial + reusable). Design rationale: `agents/loop-forge/_meta-session/runs/2026-07-25-C001/extract/loop-compose.md`. |
