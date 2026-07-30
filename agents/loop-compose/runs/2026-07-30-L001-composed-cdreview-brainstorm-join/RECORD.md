# loop-compose RECORD — 2026-07-30-L001-composed-cdreview-brainstorm-join

## Status

`complete` — composed loop authored, ε canary PASSED, archived.

## Goal this run

Author one composed loop covering **code review, optimization and improvement**
as a single autonomous protocol, and ship it through the ε canary. Goal-anchored
stop condition: 1 composed loop passes ε. Met.

## Inputs

| Port | Value |
|------|-------|
| `loop-a-port` | `agents/cd-review/` |
| `loop-b-port` | `agents/brainstorm/` |
| `composition-contract-port` | [`composition-contract.md`](./composition-contract.md) |

## Outputs

| Port | Value |
|------|-------|
| `composed-loop-port` | [`agents/cdreview-brainstorm-join/`](../../../cdreview-brainstorm-join/) |
| `composition-manifest-port` | [`agents/loop-compose/archive/composition-manifest.jsonl`](../../archive/composition-manifest.jsonl) entry `CM-001` |

## Waves

| Wave | What happened | Artifacts |
|------|---------------|-----------|
| **α** Pair-enumerate | Parsed both parents' real `ports:` blocks (cd-review 3 in / 6 out, brainstorm 4 in / 7 out) and enumerated **45** candidate bindings in both directions | [`alpha/`](./alpha/) |
| **β** Verdict | **16 COMPOSE / 8 CONFLICT / 21 ORTHOGONAL**. 5 COMPOSE edges semantically admissible, 2 PRIMARY. All 8 CONFLICTs were one class, resolved without refuse-to-ship | [`beta/verdicts.md`](./beta/verdicts.md) |
| **γ** Delta-test | Port-anchored capability probe: composed **8/8**, cd-review **2/8**, brainstorm **2/8**. 4 classes absent from **both** parents. Verdict **ADMIT** | [`gamma/`](./gamma/) |
| **δ** Author | Wrote `LOOP.md` (22 sections + the header `ports:` block, each paired with exactly one of the contract's 23 constraints — no orphans either way), `README.md`, `EVIDENCE-LENS.md`, `bin/measure.py`, `bin/gate.py`, archive + runs skeletons, registry sidecar | [`agents/cdreview-brainstorm-join/`](../../../cdreview-brainstorm-join/) |
| **ε** Ship-gate | Sealed canary on the fixed corpus entry "dedupe a list". Terminal `state=complete`. Kill-and-resume oracle: **4/4 SUCCESS**. Verdict **PASS**, 0 re-runs | [`epsilon/canary/verdict.md`](./epsilon/canary/verdict.md) |
| **Archive** | Appended `CM-001` to the composition manifest; appended the loop to the inter-loop catalog | [`archive/`](../../archive/) |

## The composition in one table

|  | can ship code | can prove a claim | can measure the effect |
|---|:---:|:---:|:---:|
| `cd-review` (loop A) | ✅ | ❌ | ❌ |
| `brainstorm` (loop B) | ❌ | ✅ | ❌ |
| `cdreview-brainstorm-join` | ✅ | ✅ | ✅ |

Bound edges — exactly two, one each way, which is what makes it a join:

```
forward :  cd-review.audit-port        ──digest──▶  brainstorm.problem-statement-port
feedback:  brainstorm.constraints-port ──digest──▶  cd-review.slice-map-port
```

## Done (chronological)

1. Read `agents/loop-compose/LOOP.md` and the two parents' port blocks; confirmed
   the pair is complementary in the dimension the request named.
2. Wrote `compose-scope.md` and initialised `day-status.json` at `init`.
3. Built [`alpha/enumerate_bindings.py`](./alpha/enumerate_bindings.py) — a
   dependency-free parser that reads the parents' `ports:` blocks out of their
   real `LOOP.md` files. Wave α/β verdicts are **computed, not asserted**.
4. α: 45 candidates (`6×4 + 7×3`). β: 16/8/21.
5. Diagnosed the CONFLICT class: both parents export `record-port` and
   `day-status-port`; a composed loop has one orchestrator, so binding a
   parent's status/record file as data is a single-writer collision on the
   resume contract that C-001-can-04 makes load-bearing. Resolved by namespace
   (the composed loop owns one of each, plus its own `last_step_vocabulary`).
6. Wrote the finalised composition contract, including a full specification of
   the composed interface and a 23-constraint set for δ to pair sections against.
7. γ: built [`gamma/delta_test.py`](./gamma/delta_test.py), a port-anchored
   capability probe requiring **both** port evidence and wave evidence per
   artifact class. Ran it in `--mode contract`: **ADMIT**.
8. δ: authored the composed loop. Re-ran the delta-test in `--mode authored`:
   **ADMIT** at 8/8, proving δ delivered what γ promised.
9. ε: built and ran the sealed canary + kill-and-resume oracle. **PASS**.
10. Archived `CM-001`; appended to the inter-loop catalog; incremented the two
    founders' `composition_count` (catalog metadata only).

## Verdicts

| Gate | Verdict |
|------|---------|
| β composition verdict | COMPOSE on 2 bound edges; CONFLICT resolved by namespace |
| γ delta-test (contract) | **ADMIT** — 8/8 vs 2/8 vs 2/8, non-degenerate |
| γ delta-test (authored) | **ADMIT** — δ delivered the promised interface |
| ε canary | **PASS** — terminal `complete`, 4/4 cold resumes |
| Loop-acceptance | **FORGE** |

## Valuable notes

**The degenerate-composition trap was real here.** `cd-review` already contains a
brainstorm wave (its Wave B). A naive `audit → brainstorm` pipe would have been
"cd-review with a fancier Wave B" — precisely the B-003 I-003-DELTA failure mode
the delta-test exists to catch. The property had to be anchored on **measurement**,
which is structurally absent from both parents. That is also what the user's word
"optimization" demands: an optimization you did not measure is just a change you
liked.

**The canary earned its keep.** It did not merely confirm the happy path — it drove
a second pack (`P-002`) that was written, green, and approved by all four
inherited lenses, and watched the Evidence Gate refuse it on a +1322% metric
regression, revert it, and continue. That is the composed capability, executed
rather than described.

**The oracle found two real bugs**, both in the resume contract rather than the
composition:

1. Resume was skipping the in-flight step. Since status is written *before* the
   side effect, a crash mid-effect leaves that step recorded but unfinished —
   skipping it loses work silently. Fixed to replay it, per `cd-review` §8.3.1.
2. Replaying the gate double-recorded the refutation, which would have
   double-counted toward the gate-veto-storm stop condition. `bin/gate.py` now
   dedupes on `(pack_id, hypothesis_id, failed_conjunct)`.

A passing oracle that found nothing would have been weaker evidence.

**Where the new loop is weakest**, recorded honestly rather than smoothed over:
the whole edifice rests on the honesty of the metric declared in Wave H. A
subagent that wants its hypothesis to ship can pick a metric that improves for
unrelated reasons (delete comments to reduce LOC, test a getter to raise
coverage). Mitigations exist — metric declared before verification, L6 relevance
check, noise thresholds, veto-storm detection — but none is *demonstrated* to
catch a deliberately gamed metric. Carried as `C-J-022` (`MUST_TEST`).

## Stopped at

`scope_complete` — goal-anchored stop condition met (1 composed loop passed ε).

## Residual / backlog

- **`C-J-022` (MUST_TEST)** — metric-gaming. Promote to `MUST_RESPECT` once a
  real cycle records a caught bad-metric case with
  `failed_conjunct: metric_irrelevant`. If three cycles pass with gamed metrics
  shipping undetected, L6 needs a stronger instrument — candidate: require the
  dossier to *predict* the metric numerically and treat a large prediction miss
  as a veto.
- **3 deferred bindings** (`fixes-port → problem-statement-port`,
  `dossiers-port → slice-map-port`, `claims-port → slice-map-port`) are COMPOSE
  and semantically admissible but left unbound to keep the dataflow
  single-purpose. Candidates for a second cycle.
- **Extraction candidate** — `bin/measure.py` is reusable by any loop wanting a
  before/after gate. On a second caller, file the itch and extract it (the
  composed loop has `remaining_extraction_depth: 2`).
- **First live cycle** should re-run the kill-resume oracle against real
  subagent artifacts; the canary tests the state machine deterministically and
  does not cover non-determinism in wave content.
- **`enumerate_bindings.py` and `delta_test.py` are candidates for promotion** to
  a shared `agents/loop-compose/bin/` so future compositions reuse them instead
  of re-deriving. Left in the run root this cycle to avoid mutating the loop
  being executed.

## PRs / commits

Branch `feat/loop-cdreview-brainstorm-join`. No product code touched — additions
are confined to `agents/**` plus one `.gitignore` line for canary scratch
bytecode, so `npm run check` and the vitest suite are unaffected (zero
`.ts`/`.tsx`/`.js` files changed).
