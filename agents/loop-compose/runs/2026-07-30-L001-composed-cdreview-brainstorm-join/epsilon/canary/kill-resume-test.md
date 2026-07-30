# Kill-and-resume oracle — cold-launcher resume proof

Implements loop-forge §11.3:

> Mid-canary, the orchestrator kills the target loop at a random `last_step`
> (from the target's declared `last_step_vocabulary` — C-001-004a). The
> orchestrator then verifies a cold launcher can resume from `day-status.json` +
> `RECORD.md` "Stopped at" alone. If resume fails, the canary FAILS.

Harness: [`../kill_resume_oracle.py`](../kill_resume_oracle.py)
Machine results: [`kill-resume-results.json`](./kill-resume-results.json)

## Why 8 trials, half of them fixed

A single kill point can pass by luck — kill during a step that happens to be cheap
and idempotent and resume looks trivially fine. Four points sampled from across the
cycle (seeded `20260730`, so the selection is reproducible) test the resume contract
at genuinely different phases: before verification, mid-fix, mid-review, and after
synthesis.

Random sampling alone is not enough, though, and this oracle learned that the hard
way. Its first run passed with four random points while a real resume bug was live
on the gate-veto path (§"Bugs the oracle found", item 3) — none of the four picks
happened to land there. So the trial set is now **half fixed, half random**: the
four labels the veto path persists are permanent regression points, and four more
are sampled randomly for coverage the fixed set doesn't anticipate.

The oracle also asserts every fixed label actually *fired* (`all_substate_labels_fired`).
If the driver stops writing one, that is reported as drift — otherwise the oracle
would quietly test less than it claims, which is the same failure it exists to catch.

## Kill points are drawn from the target's OWN vocabulary

Per C-001-004a the oracle must run against the composed loop's declared step
names, not the parent's. The harness therefore **parses
`last_step_vocabulary` out of the authored
`agents/cdreview-brainstorm-join/LOOP.md` at runtime** (44 entries) and samples
from the intersection of that vocabulary with the steps this canary actually
executes. A trial can never target a step that never happens, and it can never
target a cd-review step name that this loop does not declare.

## The kill is a hard kill

`os._exit(137)` — no `atexit` hooks, no buffer flush, no graceful shutdown, no
chance for the driver to tidy up on the way out. Whatever is on disk at that
instant is all the resuming process gets. The resume then runs as a **separate
OS process** with no shared memory or state.

## Results

| # | Killed at | Kind | Kill exit | `last_step` on disk | Resume exit | State | Gate outcomes | Refut. | Cold resume |
|---|-----------|------|:---------:|---------------------|:-----------:|-------|---------------|:------:|-------------|
| 1 | `evidence_gate:P-001:pass` | **fixed** | 137 | `evidence_gate:P-001:pass` | 0 | `complete` | P-001 PASS · P-002 VETO | 1 | **SUCCESS** |
| 2 | `evidence_gate:P-002:veto` | **fixed** | 137 | `evidence_gate:P-002:veto` | 0 | `complete` | P-001 PASS · P-002 VETO | 1 | **SUCCESS** |
| 3 | `ship_blocked:P-002:delta_not_regressed` | **fixed** | 137 | `ship_blocked:P-002:delta_not_regressed` | 0 | `complete` | P-001 PASS · P-002 VETO | 1 | **SUCCESS** |
| 4 | `reverted:P-002` | **fixed** | 137 | `reverted:P-002` | 0 | `complete` | P-001 PASS · P-002 VETO | 1 | **SUCCESS** |
| 5 | `constraints_written` | random | 137 | `constraints_written` | 0 | `complete` | P-001 PASS · P-002 VETO | 1 | **SUCCESS** |
| 6 | `citation_verify` | random | 137 | `citation_verify` | 0 | `complete` | P-001 PASS · P-002 VETO | 1 | **SUCCESS** |
| 7 | `wave_f_dispatched:P-001` | random | 137 | `wave_f_dispatched:P-001` | 0 | `complete` | P-001 PASS · P-002 VETO | 1 | **SUCCESS** |
| 8 | `wave_d_dispatched:P-002:round_1` | random | 137 | `wave_d_dispatched:P-002:round_1` | 0 | `complete` | P-001 PASS · P-002 VETO | 1 | **SUCCESS** |

Reference (uninterrupted) run: `state=complete`, `P-001 PASS`, `P-002 VETO`,
`refutations=1`, `reverted=true`.

**All 8 trials reproduced the reference outcome exactly.** Resume did not lose the
veto, did not lose the pass, and did not double-record the refutation.

## Trial 3 is the interesting one

`wave_f_dispatched:P-001` is the step immediately before product code is edited —
the riskiest span in the whole protocol, because it sits between the baseline
measurement and the mutation. It is precisely where the measure-before-mutate
invariant (`LOOP.md` §8.1) could be silently broken by a crash.

It resumed correctly because the invariant is encoded in the **ordering of the
declared vocabulary**: `measure_before:{HYP_ID}` precedes
`wave_f_dispatched:{PACK_ID}`. A cold launcher reading
`last_step=wave_f_dispatched:P-001` knows the baseline must already exist on
disk; if it did not, the loop would veto rather than guess (`LOOP.md` §8.1). The
resume contract is not just "which step was I on" — it carries the invariant
with it.

## Bugs the oracle found

All fixed in the shipped artifacts. Recording them because a passing oracle that
found nothing would be weaker evidence than a passing oracle that found something —
and because item 3 is a case where the oracle itself was too weak.

### 1. Resume skipped the in-flight step

**Symptom:** the first implementation computed `resumed_past = STEPS[:index+1]`,
treating the step named in `day-status.json` as finished.

**Why it is wrong:** the continuity invariant writes status *before* the side
effect (`LOOP.md` §13.2.1). So a process killed during a side effect leaves that
step recorded but half-done. Skipping it loses work silently — the worst failure
mode for an autonomous loop, because nothing reports an error.

**Fix:** exclusive slice, `STEPS[:index]`. The in-flight step is **replayed**,
matching `cd-review` §8.3.1: *"If the process dies during the side effect, the
next wake sees the in-flight step and re-runs it idempotently."*

### 2. Replaying the gate double-recorded the refutation

**Symptom:** once the in-flight step was replayed, killing at or near
`evidence_gate:P-002` appended a second identical record to
`gate/refutations.jsonl`.

**Why it is wrong:** the gate-veto-storm stop condition counts consecutive vetoes
(`LOOP.md` §16.2). Duplicate refutations from ordinary crash-recovery would trip
a stop condition that is supposed to signal a real systematic problem — a loop
that halts itself because it restarted twice.

**Fix:** `bin/gate.py` dedupes on `(pack_id, hypothesis_id, failed_conjunct)`
before appending. The oracle's `Refut.` column is the regression test: across 8
kills and 8 resumes the count never moved off 1.

### 3. Resume silently replayed the whole cycle after a gate veto

**Found by:** code review, *after* this ship-gate had already passed. Not by the
oracle.

**Symptom:** the veto path persists `ship_blocked:P-002:delta_not_regressed` and
then `reverted:P-002`. The label normaliser stripped a single trailing `:segment`
and checked the remainder against `STEPS`; `"reverted"` is not a step, so `last`
fell through unmatched, the skip-set stayed empty, and resume re-ran **everything
from `init`**.

**Why it is wrong:** measurable corruption, not just wasted work — the `RECORD.md`
header was written a second time (it is append-only, §13.2.5), gate lines were
re-appended, and because baselines already existed, `bin/measure.py` correctly
refused to overwrite them and wrote `M-*-before.r2.json` with
`remeasure_reason: "unspecified"`. An undocumented re-measure is a **P1** finding
under this loop's own `EVIDENCE-LENS.md` §4. The bug made the loop generate
artifacts its own review lens would reject.

**Why the oracle missed it:** its four random kill points all landed on steps whose
replay happened to be harmless, and `matches_reference` compared final gate
outcomes — which a full replay reproduces correctly. The oracle was measuring
convergence, not resumption.

**Fix, three parts:**
- `SUBSTATE_OWNER` maps `ship_blocked:<pack>` and `reverted:<pack>` back to
  `evidence_gate:<pack>`.
- An unmappable label now **fails loudly** as
  `fatal_blocked / unmappable_last_step` rather than restarting. Silent restart was
  the real defect; a wrong answer that announces itself is recoverable.
- `init` writes the `RECORD.md` header only when absent, so the record survives a
  replay even if step resolution regresses again.
- The four veto-path labels became fixed kill points, reachable via a new
  `--kill-after-status` mode that fires immediately after a status is persisted and
  *before* the side effect — the exact ordering the replay semantics exist for.

## What this proves and what it does not

**Proves:** the composed loop's resume contract is real. Its declared step
vocabulary — including its sub-state labels — is sufficient to reconstruct position
after an ungraceful kill at eight distinct points, its side effects are idempotent
under replay, and its central property (the gate veto) survives interruption.

**Does not prove:** that a *live* cycle with real LLM subagents resumes as cleanly.
The canary drives the protocol's state machine deterministically; real waves add
non-determinism in subagent output. The resume contract is what is under test here,
not the waves' content. The first live cycle should re-run this oracle against real
artifacts.

**And a standing caveat:** this oracle passed once while a resume bug was live. It
is stronger now — fixed regression points, a fired-label assertion, and a
loud-failure path — but "the oracle passed" still means "no bug of a kind this
oracle models". Item 3 was found by reading the code, which remains the check that
catches what the harness does not model.
