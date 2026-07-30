# Kill-and-resume oracle — cold-launcher resume proof

Implements loop-forge §11.3:

> Mid-canary, the orchestrator kills the target loop at a random `last_step`
> (from the target's declared `last_step_vocabulary` — C-001-004a). The
> orchestrator then verifies a cold launcher can resume from `day-status.json` +
> `RECORD.md` "Stopped at" alone. If resume fails, the canary FAILS.

Harness: [`../kill_resume_oracle.py`](../kill_resume_oracle.py)
Machine results: [`kill-resume-results.json`](./kill-resume-results.json)

## Why 4 trials and not 1

A single kill point can pass by luck — kill during a step that happens to be
cheap and idempotent and resume looks trivially fine. Four points sampled from
across the cycle (seeded `20260730`, so the selection is reproducible) test the
resume contract at genuinely different phases: before verification, mid-fix,
mid-review, and after synthesis.

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

| Trial | Killed at | Kill exit | `last_step` on disk | Resume exit | Resume state | Gate outcomes | Refutations | Cold resume |
|-------|-----------|:---------:|---------------------|:-----------:|--------------|---------------|:-----------:|-------------|
| 1 | `constraints_written` | 137 | `constraints_written` | 0 | `complete` | P-001 PASS · P-002 VETO | 1 | **SUCCESS** |
| 2 | `citation_verify` | 137 | `citation_verify` | 0 | `complete` | P-001 PASS · P-002 VETO | 1 | **SUCCESS** |
| 3 | `wave_f_dispatched:P-001` | 137 | `wave_f_dispatched:P-001` | 0 | `complete` | P-001 PASS · P-002 VETO | 1 | **SUCCESS** |
| 4 | `wave_d_dispatched:P-002:round_1` | 137 | `wave_d_dispatched:P-002:round_1` | 0 | `complete` | P-001 PASS · P-002 VETO | 1 | **SUCCESS** |

Reference (uninterrupted) run: `state=complete`, `P-001 PASS`, `P-002 VETO`,
`refutations=1`, `reverted=true`.

**Every trial reproduced the reference outcome exactly.** Resume did not lose the
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

## Two bugs the oracle found

Both are now fixed in the shipped artifacts. Recording them because a passing
oracle that found nothing would be weaker evidence than a passing oracle that
found something.

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
before appending. The oracle's `refutations=1` column is the regression test:
across 4 kills and 4 resumes the count never moved off 1.

## What this proves and what it does not

**Proves:** the composed loop's resume contract is real. Its declared step
vocabulary is sufficient to reconstruct position after an ungraceful kill at
several distinct phases, its side effects are idempotent under replay, and its
central property (the gate veto) survives interruption.

**Does not prove:** that a *live* cycle with real LLM subagents resumes as
cleanly. The canary drives the protocol's state machine deterministically; real
waves add non-determinism in subagent output. The resume contract is what is
under test here, not the waves' content. First live cycle should re-run this
oracle against real artifacts.
