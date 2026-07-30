# B-002 — dreamer / s2

## Subagent meta
- cycle_id: cycle-001
- subagent_id: B-002
- persona: dreamer
- seed: s2
- started_at: 2026-07-25T10:02:00Z
- completed_at: 2026-07-25T10:11:00Z

## Problem echoed
Design a universal, combinable, autonomy-enabling, mid-task-extracting meta-loop whose ship target is a new loop's LOOP.md.

## Oblique strategy applied
"Use an old idea you've already had, but apply it to a different scale." Each idea scales an existing per-cycle pattern to a new scale.

## Inherited constraints echoed
(none)

## Ideas

### I-001-PORTFOLIO: PORTFOLIO.md as cross-loop single source of truth
- Pattern scaled: "LOOP.md is single source of truth" (cd-review §0, brainstorm §0)
- New scale: per-portfolio
- Description: A top-level `PORTFOLIO.md` catalogs every authored loop with its autonomy envelope, combinability graph, and version, rewritten each meta-cycle. LOOP.md stays local truth; PORTFOLIO.md is the inter-loop truth.
- Why it's novel: Lifts the single-source-of-truth invariant from loop-internal to loop-registry protocol.
- Riskiest assumption: PORTFOLIO.md stays coherent past 50 loops.
- Warrant: Combinability needs an addressable registry; without it, combinations are re-derived every cycle.
- Parent idea: none

### I-002-LOOPSCOPE: Two-layer harness at the loop-authoring scale
- Pattern scaled: launcher + cycle-scope agent two-layer harness (brainstorm §0.5)
- New scale: per-loop-authoring
- Description: Loop-forge launcher spawns a loop-scope agent owning ONE loop end-to-end (skeleton → stress-test → ship LOOP.md). Launcher polls `loop-status.json` + `LOOP-DRAFT.md` "Stopped at". Peer process, never a child. Runs waves of in-process subagents.
- Why it's novel: Re-uses the crash-recovery harness where the work unit is "a loop," not "a cycle."
- Riskiest assumption: A loop is authorable within ~380k tokens.
- Warrant: The harness survives context exhaustion; mid-loop checkpointing (I-004) extends it.
- Parent idea: none

### I-003-COMPOSE: 3-state combinability verdicts between loops
- Pattern scaled: 3-state verdict ADVANCE/REFUTE/INCONCLUSIVE (brainstorm §0)
- New scale: inter-loop
- Description: Each new loop is combinability-tested against each existing loop. Each pair issues: COMPOSE (safe to chain), CONFLICT (autonomy envelopes collide — both claim same `runs/`), ORTHOGONAL (co-exist, no chaining). CONFLICT forces rename or refuse-to-ship.
- Why it's novel: Ports the verdict grammar from idea-evaluation to loop-evaluation; "combinable" becomes checkable.
- Riskiest assumption: Pairwise combinability is decidable from LOOP.md text alone.
- Warrant: Loops declare resource surfaces in a machine-readable block; verdict = graph-coloring check.
- Parent idea: none

### I-004-EXTRACT: Mid-loop extraction checkpoint
- Pattern scaled: mid-wave checkpointing (brainstorm §0 `checkpoints/`)
- New scale: mid-loop
- Description: When the loop-scope agent detects a sub-problem warranting its own autonomy envelope, it writes `extract/{name}.md` (partial LOOP.md slice, trigger, residual scope). Launcher spawns a parallel loop-scope agent for the sub-loop; parent LOOP.md gains `composes-with:` ref when child ships.
- Why it's novel: Turns "mid-task extraction" from heuristic into a checkpointed, resumable, parallelizable primitive.
- Riskiest assumption: Extraction fires before parent commits to embedding the sub-protocol inline.
- Warrant: Sub-protocols must be declared as named slots before filling; extraction is always a slot-refactor.
- Parent idea: I-002-LOOPSCOPE

### I-005-DIVERSELOOP: Loop persona × domain-seed diversification matrix
- Pattern scaled: persona × seed matrix (brainstorm §0)
- New scale: per-loop
- Description: α-wave generates LOOP.md drafts for one domain, diversified across loop-personas (hostile, divergent, conservative) × domain-seeds (oblique reframe). β stress-tests each; γ synthesizes the canonical LOOP.md from survivors.
- Why it's novel: Scales anti-mode-collapse diversification from idea-space to protocol-space — author 6 to keep 1.
- Riskiest assumption: Loop-personas produce different protocol shapes, not just different prose.
- Warrant: Each persona carries a hard structural constraint (hostile: kill-switch per step; divergent: sub-loop escape hatch per step).
- Parent idea: none

## Self-report
- Ideas generated: 5
- Ideas skipped: 0
- Mutations: 0
- Violations: 0
