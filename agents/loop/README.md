# Brainstorming Loop (`agents/loop/`)

Continuous **brainstorm → research → synthesize → brainstorm** loop for Exigo.

This is the **divergent** counterpart to `agents/cd-review/` (which is the **critical** counterpart). The cd-review loop optimizes an existing codebase. The brainstorming loop generates, pressure-tests, and converges on **new ideas** that have not been written down yet — product features, architecture directions, research questions, design decisions.

## Quick links

- **Canonical protocol:** [`LOOP.md`](./LOOP.md) — the single source of truth (read this first)
- **Cross-cycle memory:** [`archive/`](./archive/) — novelty, constraints, cycles, citations
- **Per-cycle runs:** [`runs/YYYY-MM-DD-CNNN/`](./runs/) — immutable dated artifacts
- **Design rationale:** [`_meta-session/`](./_meta-session/) — the meta-brainstorm session that produced this loop

## How it works (one paragraph)

A launcher session (user-triggered, thin) spawns an autonomous cycle-scope agent that runs one full cycle: **Wave α** dispatches 10 parallel brainstorm subagents (5 personas × 2 seeds — Dreamer, Skeptic, Engineer, Outsider, Cross-Domain Synthesizer — for structural diversity); the orchestrator consolidates their outputs into a shortlist of 5 ideas; **Wave β** dispatches 5 parallel research subagents (one per idea) that produce Toulmin-shaped dossiers with 3-state verdicts (ADVANCE / REFUTE / INCONCLUSIVE); the orchestrator verifies every citation; **Wave γ** runs 2 sequential synthesis subagents (claims extractor, then constraint writer) that produce the next cycle's constraints. The cross-cycle archives (novelty, constraints, citations) grow monotonically — that is the loop's memory. Repeat until a stop condition fires (goal met, novelty decay, budget cap, or user cancel).

## How to start a cycle

Read `LOOP.md` §0.5 (launcher protocol) and §1 (starting a new cycle). In short:

1. Decide a problem statement + stop condition for the session.
2. Pick a cycle type (scout = 350k tokens default; deep = ~727k over 2 spawns, opt-in).
3. Spawn a cycle-scope orchestrator as a peer process (NOT a subagent of the launcher):

```bash
grok -p "$(cat <<'EOF'
You are the brainstorming-loop CYCLE-SCOPE ORCHESTRATOR for Exigo.
Read and obey agents/loop/LOOP.md entirely.
RUN_ROOT=agents/loop/runs/2026-07-25-C001
CYCLE_ID=cycle-001
PROBLEM_STATEMENT={…}
INHERITED_CONSTRAINTS={from archive/constraints.jsonl, decay_score >= 0.3}
CYCLE_TYPE=scout
STOP_CONDITION={goal-anchored | novelty-decay-3-consecutive | max-cycles-N}
HARD_BUDGET_TOKENS=380000
NO HUMAN IN THE LOOP. Do not pause for "should I continue?".
EOF
)" --cwd <repo> --output-format json --yolo
```

4. Poll `$RUN_ROOT/day-status.json` + `$RUN_ROOT/RECORD.md` only — never ingest the worker's session JSONL.
5. Between cycles: read `synthesis/S-001-claims.md` + `S-002-constraints.md` + ADVANCE-verdicted dossiers; decide which ideas to pursue; trigger next cycle OR close the loop.

## Key design choices (see `_meta-session/` for the full rationale)

- **Modeled on cb-review's autonomy pattern** (two-layer launcher + cycle-scope agent, strict wave separation, `day-status.json` + `RECORD.md` resume contract, single source of truth).
- **Max-N parallel subagents in both brainstorm AND research** (N=10 for α, M=5 for β) — per the user's brief.
- **Persona × seed matrix** for structural diversity (Deng, Brucks & Toubia 2026: LLM independent samples collapse in diversity without explicit pressure).
- **Toulmin dossier + 3-state verdict** (ADVANCE / REFUTE / INCONCLUSIVE) — research must produce external grounding, not LLM-only reasoning.
- **Citation content verification** (CiteTracer-adapted) — every URL is live-fetched and content-matched; hallucinated citations are a firing offense.
- **Single-model shop anti-sycophancy** — different persona + different rubric + different temperature (0.3 Judge / 0.7 workers), steelman-then-falsify ordering, "all-advance is suspicious" DA re-dispatch.
- **Cross-cycle archives** — novelty.jsonl, constraints.jsonl, cycles.json, citations.jsonl are the loop's long-term memory; constraints decay over cycles not applied.
- **Three-layer stop conditions** — goal-anchored + novelty-decay + budget-anchored — make infinite loops impossible (arXiv:2607.01641 IAL-Scan).

## Relationship to cd-review

| Aspect | `agents/cd-review/` (cb-review) | `agents/loop/` (brainstorming) |
|---|---|---|
| Mode | Critical (review existing code) | Divergent (generate new ideas) |
| Wave 1 | Wave A: hostile audit (slices) | Wave α: brainstorm (persona×seed) |
| Wave 2 | Wave B: brainstorm fixes | Wave β: research / verify |
| Wave 3 | Wave C: fix | Wave γ: synthesis (claims + constraints) |
| Slice map | Fixed per repo (S1–S11) | None — each cycle has its own problem brief |
| Ship target | PR to develop → main + CodeRabbit | Synthesis docs + ADVANCE dossiers |
| Cross-cycle memory | None (each day is independent) | `archive/` (novelty, constraints, citations, cycles) |
| Stop condition | Day scope closed | Goal-anchored + novelty-decay + budget cap |
| Two-layer harness | Launcher + day-scope agent | Launcher + cycle-scope agent (same pattern) |

The two loops share the same autonomy model (`LOOP.md` canonical, `RECORD.md` + `day-status.json` resume, separate-process launcher, no HITL inside the worker). They differ in what they produce: cd-review ships code fixes; brainstorming-loop ships verified ideas.
