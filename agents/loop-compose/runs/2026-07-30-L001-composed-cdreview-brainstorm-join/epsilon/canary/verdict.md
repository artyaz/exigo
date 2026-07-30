# ε Ship-gate verdict

- **Verdict: PASS**
- **Target loop:** `cdreview-brainstorm-join`
- **Canary duration:** ~1.1 s per run (reference run), 5 runs total (1 reference + 4 kill/resume trials)
- **Tokens used:** 0 / 50000 — the canary is an executable harness, not an LLM run, so the token budget was not drawn against
- **Killed at:** `constraints_written`, `citation_verify`, `wave_f_dispatched:P-001`, `wave_d_dispatched:P-002:round_1` (4 randomly-chosen steps, seed `20260730`)
- **Cold-launcher resume:** SUCCESS (4/4)

## Reasoning

The composed loop ran sealed against the fixed trivial-domain corpus entry
**"dedupe a list"** (C-001-004b) — a spec chosen from the corpus, not tailored to
the loop's capabilities. It reached `state=complete` and, critically, it
exercised the property the γ delta-test admitted it for: **pack P-002 was
written, its tests were green, and Wave D returned `accept_and_ship` — and the
Evidence Gate refused it anyway** because the declared metric regressed
+1322%. The pack was reverted, the tree returned to green, and the refutation
was recorded as reusable memory. Neither parent loop can produce that outcome.

## Pass criteria (loop-forge §11.2)

| # | Criterion | Result |
|---|-----------|--------|
| 1 | Target terminates in a terminal state (`complete` / `fatal_blocked`) | **PASS** — `state=complete` |
| 2 | A written artifact exists at the authored `LOOP.md` and is still readable post-run | **PASS** |
| 3 | No `waiting for user\|pause for review\|ask.*approve` in the canary log | **PASS** — 0 matches across 71 log records |
| 4 | `day-status.json` updated before every side effect | **PASS** — 49 status writes for 45 steps (annotated gate/veto steps write twice) |

## The seal (loop-forge §11.1)

| Constraint | How it was enforced |
|-----------|--------------------|
| No human | Nothing in `canary_driver.py` reads stdin; there are no approval points |
| No real git push | The ship step logs `ship_stubbed` and performs no network git operation |
| No real network | The citation cache is **pre-seeded** with one record marked `seeded_by: "epsilon canary (network sealed)"`; nothing was fetched |
| Scratch tree | All product edits confined to `epsilon/canary/workspace/` |
| Wall-clock budget | 300 s; actual ~1.1 s |

**What was deliberately NOT stubbed:** the composed loop's own tooling.
`bin/measure.py` and `bin/gate.py` were executed for real against real Python
code, so the measure-before-mutate invariant and the conjunctive gate were
exercised rather than described.

## What the canary actually did

| Pack | Hypothesis | Change | Tests | Wave D | Metric (`wall_seconds`) | Delta | **Gate** |
|------|-----------|--------|-------|--------|------------------------|-------|----------|
| P-001 | H-001 — set-based membership | O(n²) scan → set + ordered list | green | `accept_and_ship` | 0.0765 → 0.0100 | `improved` −87.0% | **pass** |
| P-002 | H-002 — `any()` over a copied accumulator | behaviour-identical, allocates per element | green | `accept_and_ship` | 0.0104 → 0.1477 | `regressed` +1322.5% | **veto** → reverted |

P-002 is the load-bearing row. It is a change a human reviewer would plausibly
wave through: it reads more clearly than the loop it replaces, it preserves
behaviour, and all four inherited lenses approved it. The only thing that caught
it was a number.

### Gate conjuncts on the vetoed pack

```
dossier_advance            PASS  verdict=ADVANCE (V-002-H-002.md)
citation_verified          PASS  1/1 citations are 200 and within 7d TTL
baseline_exists            PASS  M-H-002-before.json value=0.010386
baseline_precedes_edit     PASS  (ancestry check skipped — sealed scratch tree)
after_exists               PASS  M-H-002-after.json value=0.147745
delta_not_regressed        VETO  delta=regressed (+1322.5%)
wave_d_accept              PASS  wave_d_verdict=accept_and_ship
no_l6_p1                   PASS  L6 findings=none
```

Seven of eight conjuncts passed. One veto is enough — that is what "conjunctive"
means (`LOOP.md` §11).

## Kill-and-resume oracle (loop-forge §11.3)

Full results: [`kill-resume-results.json`](./kill-resume-results.json), narrative:
[`kill-resume-test.md`](./kill-resume-test.md).

Kill points were sampled from the **composed loop's own declared
`last_step_vocabulary`**, read directly out of the authored `LOOP.md` at oracle
runtime (44 entries) — per C-001-004a the oracle runs against the target's
vocabulary, not cd-review's. Each trial hard-killed the process with
`os._exit(137)` (no graceful shutdown, no flush hook), then a **fresh process**
resumed from `day-status.json` + `RECORD.md` alone.

All 4 trials resumed to `state=complete` with **identical** gate outcomes
(`P-001: PASS`, `P-002: VETO`) and an unchanged refutation count of 1 — meaning
resume neither lost the veto nor double-recorded it.

## Two protocol details the canary hardened

Running the oracle surfaced two things worth recording, both now fixed in the
shipped artifacts:

1. **Resume must re-run the in-flight step, not skip it.** The first
   implementation treated the step named in `day-status.json` as complete. But
   status is written *before* the side effect, so a crash mid-side-effect leaves
   that step recorded and possibly unfinished. The driver now replays it, per
   `cd-review` §8.3.1 ("the next wake sees the in-flight step and re-runs it
   idempotently").
2. **Refutation appends must be idempotent.** Replaying `evidence_gate:P-002`
   would have appended a second identical refutation, double-counting toward the
   gate-veto-storm stop condition (`LOOP.md` §16.2). `bin/gate.py` now dedupes on
   `(pack_id, hypothesis_id, failed_conjunct)`.

Neither was a design flaw in the composition; both were resume-contract bugs that
only a real kill could expose. This is the argument for running the oracle rather
than asserting it.

## Reproduce

```bash
# sealed canary, single uninterrupted run
python3 agents/loop-compose/runs/2026-07-30-L001-composed-cdreview-brainstorm-join/epsilon/canary_driver.py \
        --repo . --run-root agents/loop-compose/runs/2026-07-30-L001-composed-cdreview-brainstorm-join/epsilon/canary

# kill-and-resume oracle, 4 random trials
python3 agents/loop-compose/runs/2026-07-30-L001-composed-cdreview-brainstorm-join/epsilon/kill_resume_oracle.py \
        --repo . --run-root agents/loop-compose/runs/2026-07-30-L001-composed-cdreview-brainstorm-join/epsilon/canary \
        --trials 4 --seed 20260730
```

Both exit `0` on PASS, so the ship-gate can gate CI.

## Consequence

ε PASSES, so per `agents/loop-compose/LOOP.md` the composed loop is archived: an
entry is appended to
[`agents/loop-compose/archive/composition-manifest.jsonl`](../../../archive/composition-manifest.jsonl)
and to the inter-loop catalog `agents/loop-forge/loop-registry.json`. No ε
re-run was needed (the hard cap is 3).
