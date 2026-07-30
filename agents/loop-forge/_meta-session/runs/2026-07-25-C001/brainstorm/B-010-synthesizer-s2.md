# B-010 — synthesizer / s2

## Subagent meta
- cycle_id: cycle-001
- subagent_id: B-010
- persona: cross-domain synthesizer
- seed: s2
- started_at: 2026-07-25T00:00Z
- completed_at: 2026-07-25T00:00Z

## Oblique strategy applied
Combine two known patterns; install at a scale neither source inhabited (per-loop, per-portfolio, inter-loop, lifecycle).

## Problem echoed
Design a loop that creates other loops — universal, combinable, mid-task extractable; agent sets autonomy per target domain.

## Inherited constraints echoed
- Two-layer harness shared by cd-review and brainstorm.
- Embedding composition exists (cd-review Wave B = brainstorm sub-loop).
- Novelty archive empty for cycle-001.

## Ideas

### I-001-001: Portfolio-decay catalog of generated loops
- Pattern A: brainstorm/LOOP.md §7.2 — γ-2 decay_scores constraints (1.0→0); scale = per-constraint.
- Pattern B: cd-review/LOOP.md §7.1 — master.md assigns fix packs with disjoint file ownership; scale = per-pack.
- Target scale: per-portfolio.
- Synthesis: each generated loop is a portfolio entry owning a disjoint slice of "loop design space" (auditor-loop, brainstorm-loop, fix-loop). Re-use by a downstream domain keeps decay_score 1.0; unused loops decay 0.15/run, become `[experimental]` <0.3, archived <0.1.
- Achievement: bounds the catalog against template proliferation.
- Riskiest assumption: a meaningful "design-space slice" can be assigned per loop.
- Warrant: both sources prove decay + disjoint ownership cuts clutter without loss.

### I-001-002: Inter-loop constraint propagation via shared status ledger
- Pattern A: brainstorm/LOOP.md §7.2 — verdicts map to MUST_RESPECT/MUST_AVOID/MUST_TEST; scale = per-idea.
- Pattern B: cd-review/LOOP.md §0.5.4 — day-status.json, crash-safe, updated before side-effects; scale = per-step.
- Target scale: inter-loop.
- Synthesis: every generated loop writes a shared `portfolio-status.json` before its first side-effect. Its terminating verdict (converge/ship/refuse/inconclusive) becomes a MUST_RESPECT/MUST_AVOID/MUST_TEST constraint routed to the next loop generated for an adjacent target domain.
- Achievement: turns the generated-loop population into a self-educating ecosystem.
- Riskiest assumption: "adjacent target domain" can be computed cheaply.
- Warrant: both sources prove verdicts and status files are cheap, routinely consumed.

### I-001-003: Persona × seed at loop-template granularity
- Pattern A: brainstorm/LOOP.md §5.1 — disjoint (persona, seed) tuples per subagent prevent mode collapse; scale = per-subagent.
- Pattern B: cd-review/LOOP.md §3 — strict wave separation sequences a day's work; scale = per-day.
- Target scale: per-loop (whole lifecycle).
- Synthesis: each candidate loop gets a disjoint (persona, seed) tuple — auditor-persona for security, dreamer-persona for greenfield, engineer-persona for refactor — applied across the whole wave-sequence. No two loops for the same target domain in the same cycle share persona+seed.
- Achievement: prevents loop-forge from converging on one canonical loop shape.
- Riskiest assumption: persona × seed varies meaningfully at loop granularity, not just subagent.
- Warrant: brainstorm's matrix already diversifies idea-space per Deng-Brucks-Toubia; lifting one level preserves it.

### I-001-004: Lifecycle kill-switch budget on generated loops
- Pattern A: brainstorm/LOOP.md §5.2 — every subagent brief carries a hard kill-switch (3–4k tokens); scale = per-subagent.
- Pattern B: cd-review/LOOP.md §7.5 — Wave D 4-lens pre-PR review gates ship vs block; scale = per-PR.
- Target scale: lifecycle.
- Synthesis: each generated loop gets a total lifecycle token budget (across all cycles, not per-subagent) plus a pre-ship 4-lens gate. When cumulative lifecycle tokens cross the budget, the loop self-terminates regardless of which subagent is consuming. The gate fires at loop convergence, not per-PR.
- Achievement: makes loop-forge safe to spawn where no human can kill runaway loops.
- Riskiest assumption: lifecycle budgets can be predicted per-target-domain.
- Warrant: both sources prove kill-switches and gates compose with the two-layer harness.

## Self-report
- Ideas generated: 4
- Ideas skipped as duplicate of novelty archive: 0
- Mutations of prior-cycle ideas: 0
- Constraint violations caught and corrected: 0
