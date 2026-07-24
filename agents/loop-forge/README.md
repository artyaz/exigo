# Loop-Forge (`agents/loop-forge/`)

Continuous **recon → design → verify → synthesize → author → ship-gate** meta-loop for Exigo.

This is the **authoring** counterpart to `agents/cd-review/` (critical) and
`agents/brainstorm/` (divergent). Where cd-review optimizes an existing codebase
and brainstorm pressure-tests new ideas, **loop-forge authors new loops**. Its
ship target is a new `agents/<name>/LOOP.md` plus its `README.md`, `archive/`,
and `runs/` skeleton — a complete, runnable, autonomous loop that did not exist
before this cycle started.

## Quick links

- **Canonical protocol:** [`LOOP.md`](./LOOP.md) — the single source of truth (read this first)
- **Cross-loop memory:** [`archive/`](./archive/) — novelty, constraints, cycles, citations
- **Per-cycle runs:** [`runs/YYYY-MM-DD-LNNN/`](./runs/) — immutable dated artifacts
- **Design rationale:** [`_meta-session/`](./_meta-session/) — the brainstorm meta-session that produced this loop

## How it works (one paragraph)

A launcher session (user-triggered, thin) spawns an autonomous loop-scope agent
that runs one full cycle: **Wave Ω** dispatches 2 sequential adversarial slots
(Autonomy-Realist + Autonomy-Adversary) that probe the target domain and derive
autonomy criteria without HITL — the Adversary's job is to find a hidden HITL
step inside each Realist proposal; **Wave α** dispatches 10 parallel design
subagents (5 personas × 2 seeds — Dreamer, Skeptic, Engineer, Outsider,
Cross-Domain Synthesizer — for structural diversity), each generating 3-7
**design decisions** (not topic ideas) for the target loop's protocol;
**Wave β** dispatches 5 parallel research subagents that produce Toulmin-shaped
dossiers with 3-state verdicts (ADVANCE / REFUTE / INCONCLUSIVE); **Wave γ**
runs 2 sequential synthesis subagents (claims extractor, then constraint
writer); **Wave δ** is the orchestrator's solo authoring pass — writes the
target loop's `LOOP.md`, `README.md`, `archive/` skeleton, `runs/` skeleton,
and `loop-registry.json` sidecar, with each section paired to one constraint;
**Wave ε** is the canary ship-gate — the target loop is spawned as a leaf
worker under reverse-authority with a trivial-domain spec, run sealed, killed
mid-step, and verified to resume from `day-status.json` alone. The cross-loop
archives (novelty, constraints, citations, cycles) grow monotonically — that
is the loop's memory. Mid-task, any subagent may file a `loop-itch.md` to
trigger extraction of a sibling sub-loop (depth-bounded, never unbounded).
Repeat until a stop condition fires (goal met, novelty decay, budget cap, or
user cancel).

## How to start a cycle

Read `LOOP.md` §0.5 (launcher protocol) and §1 (starting a new loop-authoring
cycle). In short:

1. Decide a target domain + stop condition for the session.
2. Pick a cycle type (scout = 350k tokens default; deep = ~727k over 2 spawns, opt-in).
3. Spawn a loop-scope orchestrator as a peer process (NOT a subagent of the launcher):

```bash
grok -p "$(cat <<'EOF'
You are the loop-forge LOOP-SCOPE ORCHESTRATOR for Exigo.
Read and obey agents/loop-forge/LOOP.md entirely.
RUN_ROOT=agents/loop-forge/runs/2026-07-25-L001
LOOP_ID=loop-001
TARGET_DOMAIN={…}
INHERITED_CONSTRAINTS={from archive/constraints.jsonl, decay_score ≥ 0.3, plus [canonical]-tagged invariants}
CYCLE_TYPE=scout
STOP_CONDITION={goal-anchored | novelty-decay-3-consecutive | max-loops-N}
HARD_BUDGET_TOKENS=380000
NO HUMAN IN THE LOOP. Do not pause for "should I continue?".
EOF
)" --cwd <repo> --output-format json --yolo
```

4. Poll `$RUN_ROOT/day-status.json` + `$RUN_ROOT/RECORD.md` only — never ingest the worker's session JSONL.
5. Between cycles: read `synthesis/S-001-claims.md` + `S-002-constraints.md` + ADVANCE-verdicted dossiers; decide which design decisions to embody; trigger next cycle OR close the loop.

## Key design choices (see `_meta-session/` for the full rationale)

- **Modeled on cb-review's + brainstorm's autonomy pattern** (two-layer launcher + cycle-scope agent, strict wave separation, `day-status.json` + `RECORD.md` resume contract, single source of truth, multi-layer stop conditions, no-HITL inside the worker).
- **6 waves replace 3** (Ω recon / α design / β verify / γ synthesize / δ author / ε ship-gate). Ω discovers what autonomy means in-situ; δ is the orchestrator's solo authoring pass; ε is the canary ship-gate.
- **Wave Ω adversarial slots** (Autonomy-Realist + Autonomy-Adversary) — derived from brainstorm §6.3 all-advance DA re-dispatch, lifted one wave earlier and one scale up. **INCONCLUSIVE pending injected-HITL benchmark** (C-001-001).
- **Typed `ports:` block** in every LOOP.md header (canonical C-001-can-02) — makes composition decidable via COMPOSE / CONFLICT / ORTHOGONAL verdict.
- **Mid-task extraction protocol** (loop-itch + depth-budget + checkpointable extract/) — turns "mid-task extraction" from heuristic into a checkpointed, resumable, depth-bounded primitive.
- **Canary ship-gate** (sealed run + reverse-authority micro-cycle + day-status oracle) — makes autonomy + combinability a runtime proof, not a claim. **ADVANCE capped 0.50** pending citation re-verification (3 of 8 R-004 URLs non-200).
- **Loop-genome archive** (PORTFOLIO.md + loop-portfolio.json + loop-novelty.jsonl + loop-constraints.jsonl + forge-status.json + LINEAGE BLOCK) — cross-loop memory with content-addressable genealogy.
- **5 canonical invariants** (test-bench, typed-ports, depth-budget, day-status SHAPE, no-self/parent-mutation) — load-bearing for autonomy; not subject to decay.
- **Mid-task extraction demonstrated:** `agents/loop-compose/` extracted as sibling loop (composition operation deserves its own autonomy envelope).

## Relationship to cd-review and brainstorm

| Aspect | `agents/cd-review/` (cb-review) | `agents/brainstorm/` (brainstorming) | `agents/loop-forge/` (this loop) |
|---|---|---|---|
| Mode | Critical (review existing code) | Divergent (generate new ideas) | Authoring (create new loops) |
| Wave 1 | A: hostile audit (slices) | α: brainstorm (persona×seed) | Ω: recon (Realist+Adversary) |
| Wave 2 | B: brainstorm fixes | β: research / verify | α: design (persona×seed) |
| Wave 3 | C: fix | γ: synthesis (claims + constraints) | β: verify (Toulmin + 3-state verdict) |
| Wave 4 | D: pre-PR review | (none) | γ: synthesis |
| Wave 5 | (ship) | (ship synthesis docs) | δ: author target LOOP.md |
| Wave 6 | — | — | ε: canary ship-gate |
| Slice map | Fixed per repo (S1–S11) | None — each cycle has its own brief | None — each cycle has its own target domain |
| Ship target | PR to develop → main + CodeRabbit | Synthesis docs + ADVANCE dossiers | A new `agents/<name>/LOOP.md` + skeleton |
| Cross-cycle memory | None (each day is independent) | `archive/` (novelty, constraints, citations, cycles) | `archive/` (loop-novelty, loop-constraints, loop-portfolio, citations, cycles) + `loop-registry.json` |
| Stop condition | Day scope closed | Goal-anchored + novelty-decay + budget cap | Same + extraction-depth budget + blast-radius kill-switch |
| Two-layer harness | Launcher + day-scope agent | Launcher + cycle-scope agent | Launcher + loop-scope agent (same pattern) |

The three loops share the same autonomy model (`LOOP.md` canonical, `RECORD.md`
+ `day-status.json` resume, separate-process launcher, no HITL inside the
worker). They differ in what they produce: cd-review ships code fixes;
brainstorm ships verified ideas; loop-forge ships new loops.

## Composability

Loop-forge is itself combinable. Its `ports:` block:

```yaml
ports:
  inputs:
    - {name: target-domain-port, type: text, required: true}
    - {name: prior-constraints-port, type: archive-constraints.jsonl, required: false}
  outputs:
    - {name: loop-md-port, type: file, path: "agents/<name>/LOOP.md"}
    - {name: loop-registry-port, type: file, path: "agents/<name>/loop-registry.json"}
```

**Composition example:** `loop-forge ⊕ brainstorm` = a new loop that creates
loops via divergent brainstorming (brainstorm's `ideas-port` feeds loop-forge's
`target-domain-port`). Use `agents/loop-compose/` (extracted sibling loop) to
compute the composition.
