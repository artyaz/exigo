# Wave β Research Summary — Cycle 001

## Tally (post-citation-verify)

| Dossier | Idea-id | Verdict | Confidence (post-cap) | Citation issues | Cap applied? |
|---------|---------|---------|------------------------|------------------|--------------|
| R-001 | I-001-S1 (Wave Ω recon + adversarial slots) | INCONCLUSIVE | 0.62 | 0 mismatches | no |
| R-002 | I-001-S2 (mid-task extraction protocol) | ADVANCE | ~0.75 (inferred; not explicit in dossier) | 1 content_mismatch (anchor too narrow) | no |
| R-003 | I-001-S3 (typed ports + 3-state verdict + delta-test) | ADVANCE | 0.72 | 1 content_mismatch (PDF parse failure) | no |
| R-004 | I-001-S4 (canary ship gate + reverse-authority + day-status oracle) | ADVANCE | **0.50** (capped from 0.68) | 3 non-200 (403/404 — bot-protection + URL-regex artifact) | yes (§6.4 step 2) |
| R-005 | I-001-S5 (loop-genome archive: 6 artifacts) | ADVANCE | 0.78 | 1 fetch_failed (debian wiki timeout) | no |

Totals: advance=4, refute=0, inconclusive=1. Shortlist convergence rate 4/5 = 0.80. Average confidence (post-cap) = (0.62 + 0.75 + 0.72 + 0.50 + 0.78) / 5 = 0.674.

## All-advance circuit-breaker (§6.3 step 4)

- Threshold: `advance_count / shortlist_size > 0.7` AND `all advance confidences > 0.7`.
- 4/5 = 0.8 > 0.7 ✓ (first condition met).
- Advance confidences: 0.75, 0.72, 0.50 (capped), 0.78. R-004 @ 0.50 is NOT > 0.7.
- AND-condition fails. **DA re-dispatch does NOT fire.**

## Subagent blacklist check (§6.4 step 6)

Threshold: ≥2 `content_mismatch` or `mismatch` flags per subagent per cycle.
- R-001: 0
- R-002: 1 (kilocode page exists at 200, but my anchor terms "recursion"/"subagent" weren't in the first 5000 chars — anchor-too-narrow false positive)
- R-003: 1 (Columbia PDF — my body-fetch returned binary, anchor match failed — parse failure, not hallucination)
- R-004: 3 non-200 (403/404 — all real URLs; bot-protection + URL-regex artifact at `(`). Non-200 caps confidence but does NOT count toward blacklist per §6.4.
- R-005: 1 fetch_failed (debian wiki timeout — transient)

**No subagent blacklisted.** All 3 R-004 failures are non-200, not content_mismatch. All 5 dossiers stand.

## Per-idea verdict + constraint

### R-001 — I-001-S1 (Wave Ω domain reconnaissance + adversarial autonomy-criteria slots)
- Verdict: INCONCLUSIVE
- Confidence: 0.62
- Justification (1 sentence): Probe→criteria half is empirically contested (arXiv:2505.17968 Bayes beats LLM at black-box inference; arXiv:2604.17609 shows 30-80pp discover/exploit gap); Adversary-catches-hidden-HITL half has structural precedent (brainstorm §6.3 DA re-dispatch) but no published evidence an LLM adversary reliably catches structurally-hidden HITL.
- Constraint: **MUST_TEST** — Wave Ω must be tested against an injected-hidden-HITL benchmark (a domain with a planted HITL step); Adversary's recall must materially exceed a single-Realist baseline. Else presumed theater; replace with a non-LLM oracle (static analyzer over LOOP.md flagging verbs-of-deferral).

### R-002 — I-001-S2 (Loop-itch + depth-budget + checkpointable extraction)
- Verdict: ADVANCE
- Confidence: ~0.75 (inferred from dossier strength; not explicit in dossier — gap flagged for γ)
- Justification (1 sentence): Failure mode (unbounded recursive loop extraction) is real and measured (arXiv:2607.01641 IAL-Scan, 68 failures across 47/6549 repos); proposed fix (hard, header-carried `remaining_extraction_depth` default 3) matches an independent production system's recommended fix verbatim including threshold value (Kilo-Org/kilocode #8637).
- Constraint: **MUST_TEST** — First self-simulation (Wave γ) MUST include a discrimination test bench: ≥20 seeded sub-problems labeled {deserves-extraction / merely-hard} with ground truth; report itch-filing precision/recall AND quality-delta(extracted) − quality-delta(inlined) at depth=0. If precision <0.6 OR delta <0 across ≥15/20 cases, depth default must be revised (down to 2 with stricter itch criteria, or up to 4).

### R-003 — I-001-S3 (Typed ports + 3-state composition verdict + delta-test)
- Verdict: ADVANCE
- Confidence: 0.72
- Justification (1 sentence): Each mechanism grounded in decades-old literature (Zhou & Lee 2008 actor port interfaces; IBM Rhapsody contract ports; Stanford SEP compositionality = ablation); 3-state verdict is canonical in exigo (brainstorm §0); riskiest assumption (decidability from prose) is self-repairing — the idea itself mandates typed-port blocks, but only for forward-authored loops.
- Constraint: **MUST_RESPECT** — loop-forge MUST mandate a machine-readable `ports:` block (typed input + output ports) in every authored LOOP.md AND backfill it into brainstorm/LOOP.md + cd-review/LOOP.md on its first run. Else COMPOSE/CONFLICT/ORTHOGONAL verdict is undecidable.

### R-004 — I-001-S4 (Canary ship gate + reverse-authority micro-cycle + day-status oracle)
- Verdict: ADVANCE (capped)
- Confidence: 0.50 (capped from 0.68 per §6.4 — 3 non-200 citations)
- Justification (1 sentence): Each sub-mechanism individually well-grounded in industry/runtime-verification literature; cd-review §0.5.4 SHAPE (state/last_step/blocked_reason/resume_hint) IS the correct interface (R-004's original §10.7 claim was a wording bug — §10.7 step names are GitHub-specific, but §0.5.4 SHAPE is universal); reverse-authority circularity is the genuine open risk, mitigated but not closed by I-003-DELTA baseline-delta-test.
- Constraint: **MUST_TEST + MUST_AVOID** (two constraints emitted)
  - MUST_TEST: Forged LOOP.md MUST declare its own canonical `last_step` vocabulary in a header block; loop-forge kill-and-resume oracle MUST run against that declared vocabulary, NOT against cd-review §10.7's step names.
  - MUST_AVOID: The reverse-authority micro-cycle MUST NOT use a `loop-spec.md` tailored to the target loop's known capabilities; the spec MUST be drawn from a fixed corpus of trivial target domains ("sort numbers", "count vowels", "dedupe list") declared in loop-forge's own LOOP.md.

### R-005 — I-001-S5 (Loop-genome archive: 6 artifacts)
- Verdict: ADVANCE
- Confidence: 0.78
- Justification (1 sentence): Five of six artifacts are faithful scale-lifts of grounded exigo primitives (brainstorm archive quartet, §7.4 decay_score, §8.5.2 constraint-exhaustion stop, cd-review §0 single-source + §0.5.4 + §8.3 continuity invariants); LINEAGE BLOCK grounded in git's content-addressable commit graph (Git Internals, BuildStream CAS-by-SHA256); DAG-acyclicity holds because constructive composition A⊕B→C is provably asymmetric (unlike apt depends/rdepends symmetric edges that can cycle).
- Constraint: **MUST_TEST** — Make cosine dedup threshold (0.92) and canonical-promotion count (5 loops) tunable parameters in loop-novelty.jsonl + loop-constraints.jsonl schemas; add a no-self-composition + no-parent-mutation invariant to the LINEAGE BLOCK.

## Cross-cutting observations (for γ-1 claims extractor)

1. **Four ideas jointly cover all 6 success-shape dimensions.** R-001 covers (2) recon + (3) decision-making; R-002 covers (5) mid-task extraction; R-003 covers (4) composition; R-004 covers ship-boundary verification; R-005 covers (7) cross-cycle archive + lineage. The two-layer harness (success-shape dim 1) is inherited as baseline.

2. **Three of five dossiers produced MUST_TEST constraints, not MUST_RESPECT.** Only R-003 produced MUST_RESPECT (typed ports backfill). This is a signal that the design is mostly sound but several primitives need empirical validation before they can be promoted to MUST_RESPECT invariants. The γ-2 constraint writer should treat the MUST_TEST constraints as gates for the loop-forge loop's first self-run, not as invariants of the LOOP.md text itself.

3. **The loop-forge loop must include a built-in discrimination test bench.** Both R-001 and R-002 independently arrived at the same primitive: a labeled dataset of test cases (hidden-HITL or deserves-extraction) that the loop must pass before its corresponding mechanism is admitted as MUST_RESPECT. This is a meta-design-pattern: the loop-forge loop carries its own test suite that gates primitive promotion.

4. **R-004's §10.7 wording bug is a load-bearing finding.** It exposes that the cd-review day-status vocabulary is domain-specific, not universal. Loop-forge's LOOP.md must require each forged loop to declare its OWN `last_step` vocabulary in a header block; loop-forge's canary oracle runs against THAT vocabulary. This is a structural correction to R-004's original idea, not a refutation.

5. **All 5 dossiers cite the existing exigo LOOP.md files heavily** (cd-review §0.5, §4, §8.6; brainstorm §0, §6.3, §7.4, §8.5, §8.6). This validates the cycle-scope.md decision to ground the design in the existing two-loop pattern rather than inventing from scratch.

## Next-cycle constraints summary

| ID | Type | Text (1 sentence) | Source |
|----|------|-------------------|--------|
| C-001-001 | MUST_TEST | Wave Ω must be tested against an injected-hidden-HITL benchmark and demonstrate Adversary recall materially above a single-Realist baseline; else presumed theater and replaced by a non-LLM oracle. | I-001-S1 (R-001) |
| C-001-002 | MUST_TEST | First self-simulation (Wave γ) MUST include a discrimination test bench: ≥20 seeded sub-problems labeled {deserves-extraction / merely-hard}; report itch-filing precision/recall AND quality-delta at depth=0. If precision <0.6 OR delta <0 across ≥15/20 cases, depth default revised. | I-001-S2 (R-002) |
| C-001-003 | MUST_RESPECT | loop-forge MUST mandate a machine-readable `ports:` block (typed input + output ports) in every authored LOOP.md AND backfill it into brainstorm/LOOP.md + cd-review/LOOP.md on its first run. | I-001-S3 (R-003) |
| C-001-004a | MUST_TEST | Forged LOOP.md MUST declare its own canonical `last_step` vocabulary; loop-forge's kill-and-resume oracle runs against that vocabulary, NOT cd-review §10.7's step names. | I-001-S4 (R-004) |
| C-001-004b | MUST_AVOID | The reverse-authority micro-cycle MUST NOT use a `loop-spec.md` tailored to the target's known capabilities; the spec MUST be drawn from a fixed corpus of trivial target domains. | I-001-S4 (R-004) |
| C-001-005 | MUST_TEST | Make cosine dedup threshold (0.92) and canonical-promotion count (5 loops) tunable parameters in loop-novelty.jsonl + loop-constraints.jsonl schemas; add no-self-composition + no-parent-mutation invariant to LINEAGE BLOCK. | I-001-S5 (R-005) |
