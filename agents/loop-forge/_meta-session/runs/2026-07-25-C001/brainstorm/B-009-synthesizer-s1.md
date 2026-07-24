# B-009 — synthesizer / s1

## Subagent meta
- cycle-001, B-009, synthesizer, s1; 2026-07-25 14:03→14:11Z
- sources: cd-review/LOOP.md §3,§4,§5,§6,§7,§7.5,§10.2; brainstorm/LOOP.md §3,§4,§5,§5.1,§5.4,§6.3,§7,§7.2,§7.3

## Problem echoed
Design a loop that creates other loops — universal, combinable, mid-task-extracting, autonomy-enabling.

## Inherited constraints echoed
- (none — first cycle, novelty archive empty)

## Ideas

### I-001-LFC: Author-Wave with constraint-paired sections
- Pattern A (cd-review): §7 Wave C — disjoint file ownership, "execute not re-litigate."
- Pattern B (brainstorm): §7.2 γ-2 — ADVANCE→MUST_RESPECT, REFUTE→MUST_AVOID, INCONCLUSIVE→MUST_TEST.
- Synthesis: Forge Author Wave — each subagent writes one section of a target `agents/<name>/LOOP.md` under disjoint section ownership (like a fix pack), paired with exactly one constraint translated via γ-2's rule. Author executes only; later waves audit.
- What neither alone does: Wave C ships code with no spec; γ-2 writes unexecuted constraints; the pairing closes the spec→implementation gap.
- Riskiest assumption: loop-design constraints are as testable as code-fix constraints.
- Warrant: every LOOP.md section already implicitly answers "must do X"; pairing exposes gaps.

### I-002-LFC: (lens × persona) coverage matrix audit
- Pattern A (cd-review): §7.5 Wave D — 4 fixed lenses (correctness, clarity, consistency, tests).
- Pattern B (brainstorm): §5.1 persona×seed matrix — 5 personas × 2 seeds = 10 disjoint tuples.
- Synthesis: Forge audit wave fans N subagents over the (lens, persona) cross-product — lens fixes WHAT, persona fixes HOW. Findings carry cd-review P0–P3 severity AND brainstorm §6.1 falsifier line. Mode-collapse trips if ≥50% of cells converge.
- What neither alone does: Wave D lenses are static and few; personas are divergent but undirected; the cross-product multiplies coverage without redundancy.
- Riskiest assumption: lenses and personas are orthogonal (multiplicative, not redundant).
- Warrant: §5.1 proves ordinary personas + seed diversity prevent mode collapse; fixed lenses add the orthogonal axis cd-review needs.

### I-003-LFC: Loop-portfolio map
- Pattern A (cd-review): §4 default slice map — codebase decomposed into S1..S11.
- Pattern B (brainstorm): §7.3 `archive/novelty.jsonl` — warrant_hash, embedding, 4-state status per idea.
- Synthesis: `portfolio.md` decomposes design-space of loops into archetypes (L1 critical, L2 divergent, L3 verification, L4 distillation, L5 composition…), like S1..S11. Every authored loop gets an archive entry keyed by slot. Forge cycles detect uncovered slots and force generation there; mode-collapse trips when 2+ recent loops hit the same slot.
- What neither alone does: slice map covers code, not design-space; novelty archive remembers ideas without partitioning; the portfolio partitions AND remembers — targeting "what kind of loop hasn't been written," not just "what hasn't been thought of."
- Riskiest assumption: loop archetypes form a finite enumerable set.
- Warrant: exigo's two existing LOOP.md files already exhibit an emergent critical-vs-divergent taxonomy.

### I-004-LFC: Ship-boundary self-review DA
- Pattern A (cd-review): §10.2 ship protocol — CodeRabbit iterate, `@coderabbitai review` re-trigger, hard cap 5 rounds.
- Pattern B (brainstorm): §6.3 all-advance DA re-dispatch — one extra adversarial subagent with tightened mandate.
- Synthesis: Forge "self-review DA" fires at the ship boundary (forge→`agents/<name>/LOOP.md`) when a predicate trips: cosine-similarity to any existing LOOP.md > 0.85, OR all reviewers ADVANCE with zero P0/P1, OR wave-count matches a sibling. When tripped, ONE adversarial subagent re-audits with mandate "find the falsifier missed." Hard cap: 1 DA per cycle, 3 ship rounds before `fatal_blocked`.
- What neither alone does: CodeRabbit iterates on code diffs only; all-advance DA catches rubber-stamping at research time only; the synthesis catches "LOOP.md is a clone with renamed sections" at ship.
- Riskiest assumption: "looks too similar to an existing loop" is detectable at usable precision.
- Warrant: §5.4 already uses cosine ≥ 0.85 for dedup; it generalizes to LOOP.md-to-LOOP.md comparison.

## Self-report
- Ideas generated: 4; skipped as duplicate: 0 (archive empty); mutations: 0; constraint violations: 0.
- Discipline: each idea pairs one cd-review pattern + one brainstorm pattern into a single named deliverable (not "do A then B").
