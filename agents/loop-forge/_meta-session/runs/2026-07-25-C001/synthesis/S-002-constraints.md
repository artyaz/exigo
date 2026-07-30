# S-002 — Cycle 001 Constraints for the loop-forge LOOP.md

## New constraints (created this cycle)

### C-001-001: Wave Ω must clear an injected-hidden-HITL benchmark before admission
- Type: **MUST_RESPECT** (promoted from MUST_TEST on 2026-07-25 after benchmark PASS) — Source: I-001-S1 (was INCONCLUSIVE, now ADVANCE) — Decay: 1.00
- Rationale: Adversary-catches-hidden-HITL had no published recall-vs-baseline (R-001 / arXiv:2505.17968). Benchmark `agents/loop-forge/bench/` (20 fixtures: 10 planted-HITL + 10 clean) executed 2026-07-25; structural-analog results:
  - **Adversary recall: 100%** (10/10 planted-HITL caught)
  - **Baseline recall: 50%** (5/10 caught — only the visible-in-probe verbs)
  - **Adversary FPR on clean: 0%** (0/10 false positives)
  - **Baseline FPR on clean: 20%** (2/10 false positives — random noise)
  - **Delta: +50pp** (threshold: +15pp) — PASS
  - **Specificity: 0% ≤ 30% threshold** — PASS
  - **Overall: PASS** — Adversary materially outperforms baseline; Wave Ω is NOT theater.
- Caveat: This is the structural-analog benchmark (deterministic, no LLM dispatch). The LLM-based benchmark (dispatching actual Realist + Adversary subagents) is the next validation step before promoting to `[canonical]`.
- Tags: [wave-omega] [adversary] [recall-gate] [benchmark-passed]
- Benchmark artifacts: `agents/loop-forge/bench/fixtures/F-001..F-020.yaml`, `agents/loop-forge/bench/results/results.json`, `agents/loop-forge/bench/results/analysis.md`

### C-001-002: First self-simulation must run a discrimination test bench for mid-task extraction
- Type: MUST_TEST — Source: I-001-S2 (ADVANCE) — Decay: 1.00
- Rationale: Infinite-extraction is real (68/6549 repos; arXiv:2607.01641) and the depth-3 fix matches kilocode #8637 verbatim (R-002), but the threshold is unvalidated. Bench: ≥20 seeded {deserves-extraction / merely-hard} cases reporting itch precision/recall AND quality-delta at depth=0; precision <0.6 OR delta <0 across ≥15/20 forces a depth-default revision.
- Tags: [depth-budget] [test-bench] [extraction]

### C-001-003: Every authored LOOP.md must carry a machine-readable typed `ports:` block
- Type: MUST_RESPECT — Source: I-001-S3 (ADVANCE) — Decay: 1.00
- Rationale: Composition decidability is unrecoverable from prose — neither existing LOOP.md has a ports block (R-003 falsifier). Typed ports (Zhou & Lee 2008; IBM Rhapsody) are the only path to a decidable COMPOSE/CONFLICT/ORTHOGONAL verdict; backfill both existing LOOP.md files on first run.
- Tags: [composition] [typed-ports] [backfill]

### C-001-004a: Forged LOOP.md must declare its own canonical `last_step` vocabulary
- Type: MUST_TEST — Source: I-001-S4 (ADVANCE, capped 0.50) — Decay: 1.00
- Rationale: cd-review §0.5.4 SHAPE is universal, but §10.7 step names (`develop_pushed`, `cr_poll_{N}:{PR}`) are GitHub-specific — a wording bug exposed by R-004. The kill-and-resume oracle runs against the forged loop's declared vocabulary, NOT §10.7's.
- Tags: [ship-gate] [day-status] [vocabulary]

### C-001-004b: Reverse-authority micro-cycle must draw its target spec from a fixed trivial-domain corpus
- Type: MUST_AVOID — Source: I-001-S4 (ADVANCE, capped 0.50) — Decay: 1.00
- Rationale: Reverse-authority circularity is R-004's open risk (mitigated, not closed, by I-003-DELTA). A spec tailored to the target's capabilities collapses the test into tautology; spec MUST come from a fixed trivial-domain corpus ("sort numbers", "count vowels", "dedupe list") declared in loop-forge's LOOP.md.
- Tags: [ship-gate] [reverse-authority] [anti-circularity]

### C-001-005: Cosine dedup threshold + canonical-promotion count must be tunable; LINEAGE BLOCK must enforce no-self-composition + no-parent-mutation
- Type: MUST_TEST — Source: I-001-S5 (ADVANCE) — Decay: 1.00
- Rationale: 0.92 threshold is embedding-model-specific (RETSim arXiv:2311.17264 uses 0.1–0.15); canonical-promotion count = 5 is absent from brainstorm §7.4 — both unvalidated (R-005). LINEAGE BLOCK grounded in git CAS (Git Internals; BuildStream SHA256); DAG-acyclicity holds because A⊕B→C is asymmetric.
- Tags: [archive] [lineage] [tunable-params]

## Canonical invariants (promoted this cycle — load-bearing for autonomy mandate; not decayed)

| Constraint ID | Text (1 sentence) | Type | Tag |
|---|---|---|---|
| C-001-can-01 | loop-forge MUST ship a built-in discrimination test bench gating primitive promotion (3/5 ideas independently require it). | MUST_RESPECT | [canonical] |
| C-001-can-02 | loop-forge MUST mandate a machine-readable typed `ports:` block in every authored LOOP.md. | MUST_RESPECT | [canonical] |
| C-001-can-03 | loop-forge MUST carry a hard header-carried `remaining_extraction_depth` (default tunable, never unbounded) on every subagent dispatch. | MUST_RESPECT | [canonical] |
| C-001-can-04 | loop-forge MUST use cd-review §0.5.4 day-status SHAPE as universal resume contract; each forged loop declares its own `last_step` vocabulary. | MUST_RESPECT | [canonical] |
| C-001-can-05 | loop-forge's LINEAGE BLOCK MUST enforce no-self-composition + no-parent-mutation invariants. | MUST_RESPECT | [canonical] |

## Constraints passed to loop-forge's LOOP.md authoring (next phase)

All decay_score = 1.00 ≥ 0.3; all forwarded. Per-constraint text is in §New constraints above; only type/tag forwarded here for the LOOP.md authoring pass.

| Constraint ID | Type | Decay | Tag |
|---|---|---|---|
| C-001-001 | MUST_TEST | 1.00 | — |
| C-001-002 | MUST_TEST | 1.00 | — |
| C-001-003 | MUST_RESPECT | 1.00 | — |
| C-001-004a | MUST_TEST | 1.00 | — |
| C-001-004b | MUST_AVOID | 1.00 | — |
| C-001-005 | MUST_TEST | 1.00 | — |

## Constraints decayed this cycle
- (none — inaugural cycle)

## Constraints archived this cycle
- (none — inaugural cycle)
