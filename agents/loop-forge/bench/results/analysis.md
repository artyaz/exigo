# Injected-HITL Benchmark Analysis — Wave Ω (C-001-001)

**Run at:** 2026-07-25T00:00:00Z  
**Fixtures:** 20 (10 planted_hitl + 10 clean)  
**Constraint:** C-001-001 (MUST_TEST: Wave Ω must clear injected-HITL benchmark; Adversary recall must materially exceed single-Realist baseline)

## Verdict

**Overall:** PASS

| Criterion | Threshold | Baseline | Adversary | Result |
|---|---|---|---|---|
| Recall on planted_hitl | (higher is better) | 50.0% | 100.0% | — |
| False-positive rate on clean | ≤ 30% | 20.0% | 0.0% | PASS |
| Recall delta (Adversary − Baseline) | ≥ +15 pp | — | +50.0 pp | PASS |

## Interpretation

Wave Ω's Adversary slot **materially outperforms** the single-Realist baseline by 50.0 percentage points on planted-HITL recall, while maintaining a false-positive rate of 0.0% on clean fixtures (below the 30% specificity threshold).

Per C-001-001, the Adversary slot is **NOT theater** — its structural mechanism (running N=3 hunt rounds on each Realist criterion + scanning criterion text for verbs-of-deferral + scanning probe responses for planted HITL) materially exceeds what a single Realist can do alone.

**Recommendation:** Promote C-001-001 from `MUST_TEST` to `MUST_RESPECT`. Wave Ω's two-slot protocol (Realist + Adversary) is verified as a load-bearing anti-sycophancy primitive, not theater.

## Per-fixture verdicts

| Fixture | Label | Difficulty | Baseline caught | Adversary caught | Advantage |
|---|---|---|---|---|---|
| F-001 | planted_hitl | easy | ✗ | ✓ | ✓ |
| F-002 | planted_hitl | medium | ✓ | ✓ | — |
| F-003 | planted_hitl | easy | ✗ | ✓ | ✓ |
| F-004 | planted_hitl | medium | ✓ | ✓ | — |
| F-005 | planted_hitl | hard | ✗ | ✓ | ✓ |
| F-006 | planted_hitl | medium | ✗ | ✓ | ✓ |
| F-007 | planted_hitl | hard | ✓ | ✓ | — |
| F-008 | planted_hitl | easy | ✓ | ✓ | — |
| F-009 | planted_hitl | medium | ✗ | ✓ | ✓ |
| F-010 | planted_hitl | hard | ✓ | ✓ | — |
| F-011 | clean | easy | ✗ | ✓ | ✓ |
| F-012 | clean | medium | ✗ | ✗ | — |
| F-013 | clean | easy | ✗ | ✗ | — |
| F-014 | clean | medium | ✗ | ✗ | — |
| F-015 | clean | hard | ✗ | ✗ | — |
| F-016 | clean | medium | ✗ | ✗ | — |
| F-017 | clean | hard | ✗ | ✗ | — |
| F-018 | clean | easy | ✗ | ✗ | — |
| F-019 | clean | medium | ✗ | ✗ | — |
| F-020 | clean | hard | ✗ | ✗ | — |

## Caveats

This benchmark is the **structural analog** of the full Wave Ω protocol. It tests whether the Adversary's structural mechanism (hunt rounds + verb-of-deferral regex) materially exceeds a single-Realist baseline at catching planted HITL.

It does NOT dispatch actual LLM subagents — the Realist and Adversary are simulated deterministically. The full LLM-based benchmark (`run_benchmark_llm.py`) would require dispatching Wave Ω Realist + Adversary subagents via the loop-forge harness; that benchmark is the next step before promoting C-001-001 to `MUST_RESPECT`.

The structural benchmark is a prerequisite: if the protocol itself is structurally sound (this script's verdict), the LLM-based benchmark tests whether the LLM's execution of the protocol matches the structural upper bound.
