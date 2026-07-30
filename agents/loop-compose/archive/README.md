# Archive — composition memory (stare decisis)

Cross-run memory for `loop-compose`. Written only by the orchestrator's
end-of-run archive step, after the ε canary PASSES. A composition whose canary
FAILS is **not** archived (`agents/loop-compose/LOOP.md` §ε).

| File | Purpose |
|------|---------|
| `composition-manifest.jsonl` | Append-only record of every composition attempted, with its verdicts, delta-test result and canary outcome. |

## Why a manifest and not a log

Future calls to `loop-compose` **read this file before running Wave α**. If a
similar loop pair has been composed before, the prior entry tells you which
edges were bound, which were refused and why, and whether the resulting loop
survived its canary. That is stare decisis — the mechanism proposed in
`agents/loop-forge/_meta-session/runs/2026-07-25-C001/brainstorm/B-008-outsider-s2.md`
(idea I-002-JUR) and the reason the manifest is a declared output port rather
than a side effect.

Concretely, a future run should consult it to avoid:

- re-deriving a CONFLICT resolution that already has a known answer (the
  resume-contract single-writer class in `CM-001` will recur for *any* pair of
  parents that both export a `record-port`);
- re-binding an edge a prior run refused as degenerate;
- re-authoring a loop that already exists under a different name.

## Append-only, with explicit reversal

Entries are never deleted or edited. A composition that later proves to be a
mistake is retracted by appending a **new** entry that sets `reversed_by` on the
old one via its own `reverses` field, with a reason. The history of what was
tried — including what was tried and abandoned — is the point.

## Entry shape

See `CM-001` for a complete example. Load-bearing fields:

| Field | Meaning |
|-------|---------|
| `loop_a`, `loop_b`, `operator` | what was composed, under which of ⊕ ∘ ⊗ ⋈ |
| `candidate_bindings`, `verdicts` | Wave α count and the Wave β 3-state tally |
| `bound_edges` | the edges the contract actually wired (with adapter and role) |
| `deferred_edges` | COMPOSE + semantically admissible, left unbound this run |
| `refused_edges` | with the reason — this is the reusable part |
| `conflict_class`, `conflict_resolution` | how CONFLICT was resolved instead of refusing to ship |
| `delta_test` | property, scores per baseline, and which capabilities were absent from **both** parents |
| `canary` | domain from the fixed corpus, verdict, per-pack outcomes, kill/resume trials |
| `remaining_extraction_depth` | the composed loop's budget, derived from its parents |
| `reversed_by` | `null`, or the id of a later entry that retracts this one |

## Current entries

| id | Composition | Operator | Delta-test | Canary | Result |
|----|-------------|----------|-----------|--------|--------|
| `CM-001` | `cd-review` ⋈ `brainstorm` → `cdreview-brainstorm-join` | `join_on_archive` | ADMIT (8/8 vs 2/8 vs 2/8) | PASS | shipped |
