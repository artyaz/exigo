# Evidence-Gated Optimization Loop (`agents/cdreview-brainstorm-join/`)

Continuous **audit → hypothesise → verify → measure → fix → review → gate →
synthesise → ship** loop for Exigo.

This loop is the typed-port composition of `agents/cd-review/` and
`agents/brainstorm/` under the `join_on_archive ⋈` operator, authored by
`agents/loop-compose/`.

## The gap it fills

| | can ship code | can prove a claim | can measure the effect |
|---|:---:|:---:|:---:|
| `cd-review` | ✅ | ❌ | ❌ |
| `brainstorm` | ❌ | ✅ | ❌ |
| **this loop** | ✅ | ✅ | ✅ |

`cd-review` ships fixes, but its design step carries no citations and no verdict,
and nothing in it asks whether a shipped change *improved* anything.
`brainstorm` produces verified dossiers but has no repo-write port, so it ships
nothing. Here, **a diff may only ship when a verified claim justifies it and a
measurement confirms it.**

The one-line summary of what makes it different: *a REFUTE verdict or a
regressed metric will veto a diff that is already written, green, and approved by
four reviewers.*

## Quick links

- **Canonical protocol:** [`LOOP.md`](./LOOP.md) — single source of truth, read this first
- **The new review lens:** [`EVIDENCE-LENS.md`](./EVIDENCE-LENS.md) — L6, evidence & measurement integrity
- **Measurement harness:** [`bin/measure.py`](./bin/measure.py) — Wave M (§8)
- **Gate evaluator:** [`bin/gate.py`](./bin/gate.py) — the Evidence Gate (§11)
- **Gate negative controls:** [`bin/selftest.py`](./bin/selftest.py) — drives every conjunct to failure, so the gate is falsifiable rather than decorative
- **Cross-cycle memory:** [`archive/`](./archive/) — verified improvements, measurements, novelty, constraints
- **Per-cycle runs:** [`runs/YYYY-MM-DD-JNNN/`](./runs/) — immutable dated artifacts
- **How it was composed:** [`agents/loop-compose/runs/2026-07-30-L001-composed-cdreview-brainstorm-join/`](../loop-compose/runs/2026-07-30-L001-composed-cdreview-brainstorm-join/)

## The vocabulary rule

The loop is strict about three words, because the distinction is the whole point
(`LOOP.md` §2):

| Word | Requires |
|------|----------|
| **fix** | a finding + green `npm run check` / `npm run test` |
| **improvement** | a fix + an `ADVANCE` dossier with ≥1 verified citation |
| **optimization** | an improvement + a before/after measurement showing `improved` |

Unmeasured changes still ship — as fixes. They just may not be *called*
optimizations. Mislabelling is caught by the L6 lens.

## How it works (one paragraph)

A launcher supplies the repo path and a one-sentence improvement goal. The
cycle-scope agent loads **stare decisis** from `archive/verified-improvements.jsonl`
(anything refuted in an earlier cycle is pre-refuted and may not be
re-proposed), resolves which slices to audit from the prior cycle's constraints
(the feedback edge), then runs Wave A (hostile audit, findings only, each finding
declaring whether it is measurable) → Wave H (improvement hypotheses from 10
subagents on disjoint persona × seed tuples, each declaring its metric *up
front*) → Wave V (Toulmin dossiers with ADVANCE/REFUTE/INCONCLUSIVE and citation
verification) → **Wave M (baseline measurement, committed to disk before any code
is edited)** → Wave F (surgical fixes, ADVANCE only, bounded by the declared
change surface) → Wave D (four inherited lenses plus the mandatory L6 evidence
lens) → **the Evidence Gate (conjunctive; any failed conjunct reverts the pack
and records a refutation)** → Wave S (write next-cycle constraints *first*, then
ship develop → main with CodeRabbit iteration). The archives are the join:
measurements accumulate across cycles, and constraints re-aim the next audit.

## How to start

```bash
grok -p "$(cat <<'EOF'
You are the cdreview-brainstorm-join CYCLE-SCOPE ORCHESTRATOR for Exigo.
Read and obey agents/cdreview-brainstorm-join/LOOP.md entirely.
RUN_ROOT=agents/cdreview-brainstorm-join/runs/2026-07-31-J001
REPO=.
IMPROVEMENT_GOAL="ship 3 measured optimizations in convex/** without regressing coverage"
CYCLE_TYPE=scout
HARD_BUDGET_TOKENS=380000
NO HUMAN IN THE LOOP. Do not pause for "should I continue?".
A REFUTE verdict or a gate veto is a RESULT, not a blocker — record it and continue.
EOF
)" --cwd <repo> --output-format json --yolo
```

Single-agent mode (no peer CLI available) is the mandatory fallback and works the
same way — the one agent owns both launcher and cycle-scope roles (`LOOP.md` §0.5).

## Known weak point

The loop's integrity rests on one honest choice: **the metric declared in Wave
H.** A subagent that wants its hypothesis to ship could pick a metric that
improves for unrelated reasons. Mitigations are in place (metric declared before
verification, L6 relevance check, noise thresholds, gate-veto-storm detection),
but none is yet *demonstrated* to catch a deliberately gamed metric. That is
tracked as `C-J-022` (`MUST_TEST`) in `LOOP.md` §19 and is the first thing to
harden once real cycles produce evidence.
