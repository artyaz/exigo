---
loop_id: cdreview-brainstorm-join
title: Evidence-Gated Optimization Loop
parent_loops: [cd-review, brainstorm]
mutation_operator: compose
composed_by: loop-compose
composed_operator: join_on_archive        # ⋈
composed_at: 2026-07-30
remaining_extraction_depth: 2
ports:
  inputs:
    - {name: repo-port, type: directory-path, required: true, description: "Path to the exigo repo root (read + git-write access)."}
    - {name: improvement-goal-port, type: text, required: true, description: "One-sentence improvement goal + the goal-anchored stop condition. Written by the launcher into cycle-scope.md §Goal."}
    - {name: slice-map-port, type: text, required: false, default: "agents/cd-review/REVIEW-LENS.md + cd-review §4 default S1–S11", description: "Codebase partition. Defaults to the parent slice map; re-aimed each cycle by prior-constraints-port (§4)."}
    - {name: prior-constraints-port, type: jsonl, required: false, path: "agents/cdreview-brainstorm-join/archive/constraints.jsonl", description: "Inherited constraints filtered to decay_score ≥ 0.3 plus [soft]-tagged. Drives §4 slice re-aim and Wave H seeding."}
    - {name: prior-measurements-port, type: jsonl, required: false, path: "agents/cdreview-brainstorm-join/archive/measurements.jsonl", description: "Cross-cycle metric history. Used by Wave M to detect metric drift and by §16 to detect measurement plateau."}
    - {name: verified-improvements-port, type: jsonl, required: false, path: "agents/cdreview-brainstorm-join/archive/verified-improvements.jsonl", description: "Stare decisis: claims already ADVANCEd or REFUTEd in earlier cycles. Read at §1, appended at §12. This is the join."}
    - {name: novelty-archive-port, type: jsonl, required: false, path: "agents/cdreview-brainstorm-join/archive/novelty.jsonl", description: "Cross-cycle hypothesis memory (warrant_hash + embedding) for Wave H dedup."}
    - {name: cycle-type-port, type: enum, values: [scout, deep], required: false, default: scout, description: "Scout = 350k tokens / 1 spawn. Deep = ~727k over 2 spawns via mid-cycle checkpointing (§13.4)."}
  outputs:
    - {name: audit-port, type: markdown-files, path: "agents/cdreview-brainstorm-join/runs/<RUN_ID>/audits/slices/S<N>.md", description: "Wave A findings (P0–P3, code:line, measurability declared)."}
    - {name: hypotheses-port, type: markdown-files, path: "agents/cdreview-brainstorm-join/runs/<RUN_ID>/hypotheses/H-<NNN>-<persona>-<seed>.md", description: "Wave H improvement hypotheses, persona × seed diversified."}
    - {name: dossiers-port, type: markdown-files, path: "agents/cdreview-brainstorm-join/runs/<RUN_ID>/dossiers/V-<NNN>-<hyp_id>.md", description: "Wave V Toulmin dossiers with 3-state verdict."}
    - {name: measurements-port, type: jsonl, path: "agents/cdreview-brainstorm-join/runs/<RUN_ID>/measure/measurements.jsonl", description: "Wave M before/after records and computed deltas."}
    - {name: refutations-port, type: jsonl, path: "agents/cdreview-brainstorm-join/runs/<RUN_ID>/gate/refutations.jsonl", description: "Evidence-Gate vetoes: changes that were written and green but blocked. Negative results are first-class output."}
    - {name: verified-improvements-port, type: jsonl, path: "agents/cdreview-brainstorm-join/archive/verified-improvements.jsonl", description: "Appended at end-of-cycle. Same port name as the input — cycle N+1 reads what cycle N proved."}
    - {name: constraints-port, type: markdown-file, path: "agents/cdreview-brainstorm-join/runs/<RUN_ID>/synthesis/S-002-constraints.md", description: "Wave S next-cycle constraints (MUST_RESPECT/MUST_AVOID/MUST_TEST) with decay scores."}
    - {name: citations-port, type: jsonl, path: "agents/cdreview-brainstorm-join/archive/citations.jsonl", description: "Citation verification cache, 7-day TTL."}
    - {name: fixes-port, type: git-diff, description: "Wave F edits shipped as PR diff(s) to develop → main."}
    - {name: pr-port, type: github-pr-url, description: "Open PR(s) with CodeRabbit review iteration."}
    - {name: record-port, type: markdown-file, path: "agents/cdreview-brainstorm-join/runs/<RUN_ID>/RECORD.md", description: "Cycle narrative + Stopped at + Residual + per-pack gate verdicts. SINGLE writer (§0)."}
    - {name: day-status-port, type: json-file, path: "agents/cdreview-brainstorm-join/runs/<RUN_ID>/day-status.json", description: "Thin launcher poll file. SINGLE writer (§0). Shape per cd-review §0.5.4 (C-001-can-04)."}
last_step_vocabulary:
  # This loop's OWN vocabulary (C-001-004a). NOT cd-review §10.7's GitHub-specific
  # list and NOT brainstorm's wave-phase list. The canary oracle runs against THIS.
  - init
  - cycle_scope_written
  - stare_decisis_loaded
  - slice_map_resolved
  - wave_a_dispatched
  - wave_a_collected
  - findings_clustered
  - wave_h_dispatched
  - wave_h_collected
  - hypothesis_shortlist_written
  - wave_v_dispatched
  - wave_v_collected
  - citation_verify
  - alladvance_redispatch_check
  - verdict_recorded:{HYP_ID}:{advance|refute|inconclusive}
  - metric_declared:{HYP_ID}
  - measure_before:{HYP_ID}
  - pack_consolidated:{PACK_ID}
  - wave_f_dispatched:{PACK_ID}
  - wave_f_collected:{PACK_ID}
  - verify_done:{PACK_ID}
  - measure_after:{PACK_ID}
  - delta_computed:{PACK_ID}:{improved|neutral|regressed}
  - wave_d_dispatched:{PACK_ID}:round_{N}
  - wave_d_collected:{PACK_ID}:round_{N}
  - wave_d_verdict:{PACK_ID}:{send_back|fix_and_proceed|accept_and_ship}
  - evidence_gate:{PACK_ID}:{pass|veto}
  - ship_blocked:{PACK_ID}:{reason}
  - reverted:{PACK_ID}
  - constraints_written
  - develop_pushed
  - develop_pr_open:{PR_NUMBER}
  - develop_ci_green:{PR_NUMBER}
  - develop_merged:{PR_NUMBER}
  - main_pr_open:{PR_NUMBER}
  - cr_poll_{N}:{PR_NUMBER}
  - cr_round_{N}_fix_pushed:{PR_NUMBER}
  - main_ci_green:{PR_NUMBER}
  - main_merged:{PR_NUMBER}
  - archive_update_started
  - archive_update_complete
  - record_finalized
  - next_pack
  - scope_complete
lineage:
  parent_loops: [cd-review, brainstorm]
  no_self_composition: true
  no_parent_mutation: true
  composed_by: loop-compose
  composition_run: agents/loop-compose/runs/2026-07-30-L001-composed-cdreview-brainstorm-join
  depth_derivation: "min(parent depths) − 1 = min(3, 3) − 1 = 2"
---

# Evidence-Gated Optimization Loop (`cdreview-brainstorm-join`)

Continuous **audit → hypothesise → verify → measure → fix → review → gate →
synthesise → ship** loop for Exigo.

This loop is the typed-port composition of `agents/cd-review/` (loop A) and
`agents/brainstorm/` (loop B) under the `join_on_archive ⋈` operator, authored
by `agents/loop-compose/`. Its reason to exist is a gap neither parent covers:

| | can ship code | can prove a claim | can measure the effect |
|---|:---:|:---:|:---:|
| `cd-review` | ✅ | ❌ | ❌ |
| `brainstorm` | ❌ | ✅ | ❌ |
| **this loop** | ✅ | ✅ | ✅ |

`cd-review` ships fixes but its Wave B design step carries no external
grounding, no citations and no 3-state verdict, and nothing in it asks whether
a shipped change *improved* anything. `brainstorm` produces verified dossiers
but has no repo-write port, so it ships nothing. This loop closes the circuit:
**a diff may only ship when a verified claim justifies it and a measurement
confirms it.**

The delta-test that admitted this composition, with its full evidence audit
trail, is at
[`agents/loop-compose/runs/2026-07-30-L001-composed-cdreview-brainstorm-join/gamma/`](../loop-compose/runs/2026-07-30-L001-composed-cdreview-brainstorm-join/gamma/).

---

## 0. Directory layout — single-writer resume contract

*Paired constraint: **C-J-002** — exactly one writer owns `RECORD.md` and
`day-status.json`.*

Wave β of the composing run found that all 8 CONFLICT verdicts between the two
parents were the same class: **both parents export a `record-port` and a
`day-status-port`.** A composed loop has one orchestrator, so it must have one
record and one status file, or the resume contract that C-001-can-04 makes
load-bearing silently forks.

```text
agents/cdreview-brainstorm-join/
  LOOP.md                            ← this file (single source of truth)
  README.md                          ← short overview + pointer here
  EVIDENCE-LENS.md                   ← the L6 reviewer brief (§10)
  loop-registry.json                 ← sidecar: this loop's catalog entry
  bin/
    measure.py                       ← Wave M metric harness (§8)
    gate.py                          ← Evidence Gate evaluator (§11)
    selftest.py                      ← negative controls for every gate conjunct (§11.3)
  archive/                           ← cross-cycle memory (persists across runs)
    verified-improvements.jsonl       ← stare decisis: proved / refuted claims
    measurements.jsonl                ← metric history across cycles
    novelty.jsonl                     ← hypothesis warrant_hash + embedding
    constraints.jsonl                 ← next-cycle constraints with decay scores
    citations.jsonl                   ← citation cache, 7-day TTL
    cycles.json                       ← cycle index
    README.md
  runs/
    .gitkeep
    README.md
    YYYY-MM-DD-JNNN/                 ← one cycle ("J" for join)
      RECORD.md                      ← THE record. One writer: the orchestrator.
      cycle-scope.md                 ← launcher-written brief (read-only in-cycle)
      day-status.json                ← THE status file. One writer.
      slice-aim.md                   ← §4 output: which slices, and why, this cycle
      persona-seed-matrix.md         ← Wave H diversification matrix
      audits/
        slices/S<N>.md               ← Wave A findings
        clusters.md                  ← orchestrator's finding clusters
        verify-<PACK_ID>.md          ← npm run check + npm run test output
        pre-pr/<PACK_ID>-lens<N>.md  ← Wave D per-lens reviews
        pre-pr/<PACK_ID>.md          ← Wave D consolidated verdict
        fixes/<PACK_ID>.md           ← Wave F fix reports (Status: done marker)
      hypotheses/H-<NNN>-<persona>-<seed>.md
      dossiers/V-<NNN>-<hyp_id>.md
      measure/
        M-<hyp_id>-before.json       ← written BEFORE any edit (§8)
        M-<hyp_id>-after.json
        measurements.jsonl           ← flattened records + computed deltas
      gate/
        gate-<PACK_ID>.md            ← Evidence Gate verdict
        refutations.jsonl            ← vetoed changes (negative results)
      synthesis/
        S-001-claims.md
        S-002-constraints.md
      citations/{verified,refuted}.jsonl
      checkpoints/<wave>-<artifact_id>.json
```

**RUN_ROOT discipline.** In-cycle, agents write ONLY under `$RUN_ROOT`. The
cross-cycle `archive/` is updated only by the orchestrator's end-of-cycle
archive-update step (§14). Mid-cycle reads from `archive/` are allowed
(stare decisis, novelty dedup, citation cache, metric history); mid-cycle
writes are forbidden.

**Parent directories are read-only.** `agents/cd-review/**` and
`agents/brainstorm/**` are never written by this loop (`no_parent_mutation`,
§18). Reading the parent slice map and lens catalogue is expected.

---

## 0.5 Harness — optional CLI layer, mandatory single-agent fallback

*Paired constraint: **C-J-003** — no human in the loop inside the cycle-scope
agent.*

Inherited from `cd-review` §0.5 unchanged in structure.

| Layer | How it starts | Job | When |
|-------|---------------|-----|------|
| **Launcher (L‑1)** | User or scheduler | Resolve run, detect harness, spawn/wake the cycle-scope agent, poll `day-status.json` only | **Optional** — only when the host can spawn a peer CLI |
| **Cycle-scope agent (L0)** | Spawned by launcher, or invoked directly as the only agent | Execute this `LOOP.md` end to end: waves, gate, ship, record | **Always** |

Wave workers are in-process subagents of L0. They never spawn children.

### 0.5.1 Mode detection

L0 reads `$RUN_ROOT/audits/harness-mode.json` first (same shape as cd-review
§0.5.2) and adapts: `cli_layer` → behave as cycle-scope only, launcher owns
re-wake; `single_agent` → behave as both, and on context exhaustion leave a
precise `Stopped at` so the next invocation resumes cleanly.

### 0.5.2 No-human rule (hard)

- **Do not pause to ask "should I continue?"** Continue, ship, or set
  `state=fatal_blocked` with a precise `blocked_reason` and exit non-zero.
- **Do not print "waiting for user" and stop.** That is an agent bug, not a
  protocol state.
- **Do not require a human to merge a PR, or to re-trigger CodeRabbit.**
- **A REFUTE verdict is not an escalation.** It is a result. Record it in
  `refutations-port` and move to the next pack (§11).

---

## 1. Starting a cycle

*Paired constraint: **C-J-004** — cycle init resolves the slice map from the
prior cycle's constraints before dispatching Wave A.*

1. `RUN_ID=YYYY-MM-DD-J<NNN>`; create `$RUN_ROOT` per §0. Never delete prior runs.
2. Scaffold `RECORD.md` (§13.1) and initialise `day-status.json` with
   `last_step=init`.
3. **Load stare decisis** → `last_step=stare_decisis_loaded`. Read
   `archive/verified-improvements.jsonl`. Any hypothesis whose `warrant_hash`
   matches a prior `REFUTE` is **pre-refuted**: Wave H may not re-propose it,
   and if it appears anyway, Wave V short-circuits to `REFUTE` citing the prior
   cycle. This is the join's payoff — a claim refuted in cycle 3 stays refuted
   in cycle 9 without spending a wave re-deriving it.
4. **Resolve the slice aim** (§4) → `last_step=slice_map_resolved`.
5. Dispatch Wave A.

---

## 2. North-star and non-goals

*Paired constraint: **C-J-005** — "optimization" means measured.*

### North-star (ordered)

Inherited from `cd-review` §2 — a codebase that is **readable → clear → short →
consistent → correct** — with one addition that reorders nothing but gates
everything:

> **6. Justified.** Every change traces to a verified claim and a measured
> effect.

### The vocabulary rule (load-bearing)

| Word | Requires |
|------|----------|
| **fix** | a finding + a passing `npm run check` / `npm run test` |
| **improvement** | a fix + an `ADVANCE` dossier with ≥1 verified citation |
| **optimization** | an improvement + a before/after measurement showing `improved` |

An unmeasured change may ship as a **fix**. It may **not** be recorded in
`verified-improvements.jsonl` as an improvement, and it may **not** be described
as an optimization in `RECORD.md`. Mislabelling is a protocol violation caught
by the L6 lens (§10) — this is the loop's defence against the pleasant fiction
that everything it touched got better.

### Non-goals

- Not a feature factory. New capability is `brainstorm`'s job.
- Not a rewrite engine. Delete > abstract; surgical > sweeping.
- Not a benchmark suite. Wave M measures *the metric the dossier declared*, not
  everything measurable.

---

## 3. Architecture (strict wave separation)

*Paired constraint: **C-J-006** — one-directional wave separation, disjoint
ownership.*

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  L-1  LAUNCHER (optional)  · detect harness · poll day-status.json only  │
└───────────────────────────────┬──────────────────────────────────────────┘
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  L0  CYCLE-SCOPE ORCHESTRATOR (no human in the loop)                     │
│  stare decisis · slice aim · dispatch waves · own the GATE · ship        │
│  write RECORD.md + day-status.json before every side effect             │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ in-process subagents, no grandchildren
   ┌─────────┬─────────┬────────┼────────┬─────────┬──────────┬───────────┐
   ▼         ▼         ▼        ▼        ▼         ▼          ▼           ▼
 WAVE A   WAVE H    WAVE V   WAVE M   WAVE F   WAVE D    GATE G      WAVE S
 audit    hypoth.   verify   measure   fix     4+1 lens  (solo)     synth+ship
 findings hypoth.   verdicts metrics   edits   reviews   admit/veto constraints
```

| Wave | Role | Reads | Writes | Children |
|------|------|-------|--------|:--------:|
| **A** | Hostile slice auditor | slice code + `AGENTS.md` | `audits/slices/S*.md` | No |
| **H** | Improvement hypothesiser | clusters + novelty archive | `hypotheses/H-*.md` | No |
| **V** | Verifier (Toulmin) | one hypothesis + web + code PoC | `dossiers/V-*.md` | No |
| **M** | Metric harness | dossier's declared metric | `measure/M-*.json` | No |
| **F** | Surgical fixer | ADVANCE dossier + pack | product code + `audits/fixes/*.md` | No |
| **D** | Pre-PR reviewer (L1–L4 + **L6**) | staged diff + `AGENTS.md` + `.coderabbit.yaml` + dossier + measurements | `audits/pre-pr/*` | No |
| **G** | Evidence Gate | dossier + measurements + Wave D verdict | `gate/gate-*.md`, `gate/refutations.jsonl` | — (orchestrator solo) |
| **S** | Synthesiser | dossiers + gate verdicts | `synthesis/S-00*.md` | No |

**Disjoint ownership, stated as prohibitions:** A does not hypothesise. H does
not verify. V does not edit code. M does not judge. F does not re-open design.
D does not re-verify claims. G does not author. S does not measure.

Two capped exceptions, inherited from `brainstorm` §8: the all-advance devil's
advocate (§7.4) and the ship-boundary self-review, each at most once per cycle.

---

## 4. Slice aim (the feedback edge)

*Paired constraint: **C-J-007** — the slice map is an input port, defaulted from
the parent, re-aimed by constraints, never hardcoded here.*

`slice-map-port` defaults to `cd-review` §4's S1–S11 partition. Before Wave A,
the orchestrator writes `$RUN_ROOT/slice-aim.md` selecting **which** slices this
cycle audits and **which lens** to weight, using, in priority order:

1. `MUST_TEST` constraints from `prior-constraints-port` (decay_score ≥ 0.3) —
   a constraint that says "test whether X" names the slice that owns X.
2. `prior-measurements-port` — slices whose metrics **regressed** or plateaued
   since the last cycle outrank untouched slices.
3. Round-robin over slices not audited in the last 3 cycles (starvation guard).

This is the `brainstorm.constraints-port → cd-review.slice-map-port` binding —
the feedback edge that makes this a **join** rather than a one-shot pipe. Without
it the loop re-audits the same slices forever and the archives never pay for
themselves.

`slice-aim.md` records the chosen slices *and the rejected ones with a reason*,
so a reader can tell deliberate focus from accidental blindness.

---

## 5. Wave A — Hostile audit (findings only)

*Paired constraint: **C-J-008** — findings only, and every finding declares its
measurability.*

Disposition, adversarial tricks and quota are inherited from `cd-review` §5
verbatim in spirit: **assume the codebase is troubled; empty praise is failure.**
One addition — the `Metric` field:

```text
OUTPUT format in audits/slices/{SLICE_ID}.md
## Slice {SLICE_ID}
## Files reviewed
## Findings
### F-{SLICE_ID}-{nnn}: title
- Severity: P0|P1|P2|P3
- Category: readability|clarity|brevity|consistency|bug|security|perf
- Location: path:lines
- Evidence:
- Why it hurts north star:
- Metric: <measurable: name the metric and the command> | <not-measurable: why>
- Sketch (1–3 bullets, not a design doc):
- Effort: S|M|L
## Patterns
## Recommended hypothesis clusters (group related findings)
## Explicit non-issues
```

**Severity** (inherited from `cd-review` §5.3):

| Sev | Meaning |
|-----|---------|
| P0 | Security, data loss, auth bypass, likely prod crash |
| P1 | Clear bug or severe clarity/consistency debt on hot path |
| P2 | Meaningful clarity/brevity win |
| P3 | Polish |

**The `Metric` field is not optional and `not-measurable` is a legitimate
answer.** Forcing a metric onto a readability finding is exactly the
metric-gaming failure mode C-J-022 flags. A `not-measurable` finding can still
ship as a **fix** (§2); it simply cannot be recorded as an optimization.

Auditors do NOT edit code and do NOT propose hypotheses. Orchestrator then
clusters findings → `audits/clusters.md`, `last_step=findings_clustered`.

---

## 6. Wave H — Hypothesise (divergent, persona × seed)

*Paired constraint: **C-J-009** — disjoint (persona, seed) tuples, required not
advisory.*

Inherited from `brainstorm` Wave α. Each cluster from §5 gets hypotheses from
subagents holding **disjoint (persona, seed) tuples**, recorded in
`persona-seed-matrix.md`. Structural diversity is required because independent
LLM samples collapse in diversity without it (Deng, Brucks & Toubia 2026 — the
same citation that grounds `brainstorm` §7.1).

Default N = 10 (5 personas × 2 seeds) for a scout cycle. Personas are inherited
from `brainstorm`: dreamer, skeptic, engineer, outsider, synthesizer.

Each hypothesis doc:

```text
# H-{NNN}-{persona}-{seed}
- hypothesis_id: H-{NNN}
- addresses: [F-{SLICE_ID}-{nnn}, …]
- claim: one sentence — what will improve and why
- warrant: why the claim should hold (the reasoning, not the evidence)
- warrant_hash: sha256 of the normalised claim+warrant (novelty dedup key)
- declared_metric: {name, command, direction: lower_is_better|higher_is_better, unit}
- riskiest_assumption:
- change_surface: the files/functions this would touch (bounds Wave F)
- parent_hypothesis: H-{NNN} | null
```

**Novelty dedup:** before writing, check `warrant_hash` against
`archive/novelty.jsonl`. A hash matching a prior `REFUTE` is **pre-refuted**
(§1.3) and must not be re-proposed. Cosine similarity > 0.85 to an existing
warrant is a duplicate — mutate the seed and retry once, then drop.

`declared_metric` is written **here**, before verification and long before any
edit. That ordering is what makes the measurement honest: the metric is chosen
to test the claim, not chosen afterwards to flatter the diff.

Orchestrator shortlists M = 5 → `hypothesis_shortlist_written`.

---

## 7. Wave V — Verify (Toulmin dossier + 3-state verdict)

*Paired constraint: **C-J-010** — 3-state verdict + ≥1 citation verified within
the cache TTL; no ship without ADVANCE.*

Inherited from `brainstorm` Wave β. One subagent per shortlisted hypothesis,
producing a Toulmin-shaped dossier at `dossiers/V-<NNN>-<hyp_id>.md`:

```text
# V-{NNN} — {hypothesis_id}
- claim:            (from H)
- grounds:          evidence gathered (code reading, PoC, external sources)
- warrant:          why grounds support claim
- qualifier:        confidence 0.00–1.00
- rebuttal:         the strongest case against
- backing:          citations (url + fetched_at + status + quoted line)
- verdict:          ADVANCE | REFUTE | INCONCLUSIVE
- declared_metric:  (echoed from H — Wave M reads it from here)
- change_surface:   (echoed from H — Wave F may not exceed it)
```

### 7.1 Verdict semantics

| Verdict | Meaning | Downstream |
|---------|---------|------------|
| `ADVANCE` | grounds support the claim; rebuttal survivable | eligible for Wave M → F |
| `REFUTE` | grounds contradict the claim, or the rebuttal is decisive | **never** reaches Wave F; appended to `verified-improvements.jsonl` as a negative result |
| `INCONCLUSIVE` | cannot be settled within budget | not shipped this cycle; becomes a `MUST_TEST` constraint (§12) |

### 7.2 Citation verification

Each dossier needs **≥1 citation verified within the 7-day TTL** of
`archive/citations.jsonl`. Verification = fetched, HTTP 200, and the cited
claim quotable from the body. A cache hit inside TTL counts. Non-200 citations
cap the dossier's `qualifier` at 0.50 (inherited from `brainstorm`'s
citation-integrity rule) — a capped dossier can still ADVANCE, but §11 records
the cap.

`last_step=citation_verify` runs after collection, before verdicts are final.

### 7.3 Refuting an in-repo claim needs in-repo grounds

External citations establish that a technique is sound in general. They do not
establish that it applies *here*. For any hypothesis touching Exigo-specific
architecture (the dual Convex/Prisma database, the two AI call-site paths, the
`shared/` cross-runtime boundary, plan-limit SSOT — see `AGENTS.md`), grounds
MUST include at least one in-repo observation with a `path:line` citation.

### 7.4 All-advance devil's advocate (capped, once per cycle)

If **every** shortlisted hypothesis returns `ADVANCE`, that is suspicious rather
than fortunate. Fire one DA subagent against the highest-`qualifier` dossier
with a mandate to find the decisive rebuttal. Capped at one per cycle
(`alladvance_redispatch_check`).

---

## 8. Wave M — Measure (the capability neither parent has)

*Paired constraint: **C-J-011** — the before-measurement is on disk before any
product code is edited.*

### 8.1 Ordering is the whole point

```
metric_declared:{HYP_ID}   ← metric fixed in Wave H, echoed by Wave V
measure_before:{HYP_ID}    ← baseline captured and COMMITTED TO DISK
wave_f_dispatched          ← only now may product code be edited
measure_after:{PACK_ID}
delta_computed:{PACK_ID}:{improved|neutral|regressed}
```

**A before-measurement taken after the fix is a protocol violation**, not a
recoverable slip. If `M-<id>-before.json` is missing when Wave F completes, the
Evidence Gate vetoes the pack (§11) and the orchestrator records
`ship_blocked:{PACK_ID}:missing_baseline`. The pack may be re-run next cycle
from a clean tree.

This ordering is enforceable on resume because `measure_before` precedes
`wave_f_dispatched` in the declared `last_step_vocabulary`: a cold launcher
that reads `last_step=wave_f_dispatched` with no `M-*-before.json` on disk knows
the invariant was broken and vetoes rather than guessing.

### 8.2 Metric catalogue (Exigo-grounded)

`declared_metric.command` must be drawn from this catalogue, or the dossier must
justify a new entry. Commands are the repo's real ones (`AGENTS.md`):

| Metric | Command | Direction | Notes |
|--------|---------|-----------|-------|
| `typecheck_errors` | `npm run check` | lower | 0 is the floor; use for "did this remove suppressions" |
| `test_pass_count` | `npm run test` | higher | regression guard, not an improvement metric on its own |
| `coverage_pct` | `npm run test:coverage` | higher | V8 coverage; per-file when the change surface is one file |
| `test_wall_seconds` | `npm run test` | lower | median of 3 runs; noisy — see §8.3 |
| `loc_touched_surface` | `git diff --stat` on `change_surface` | lower | "delete > abstract" made countable |
| `exported_symbols` | ripgrep count of `export ` in `change_surface` | lower | API-surface shrinkage |
| `max_function_loc` | script over `change_surface` | lower | the god-function metric |
| `duplicate_blocks` | `jscpd`-style scan over `change_surface` | lower | copy-paste debt |
| `convex_fn_count` | count of exported Convex functions in slice | lower | dual-system consolidation |
| `bundle_kb_route` | `npm run build` route output | lower | only for `src/app/**` changes |

### 8.3 Noise discipline

A metric whose run-to-run variance exceeds the claimed delta measures nothing.

- Wall-clock and bundle metrics: **median of 3 runs**, and record all 3.
- The delta call is `improved` only when
  `|after − before| > 2 × stdev(baseline runs)`; otherwise `neutral`.
- `regressed` on the declared metric is an automatic Gate veto (§11) even if
  Wave D loved the diff.

### 8.4 Record shape

`measure/M-<hyp_id>-before.json` / `-after.json`:

```json
{
  "hypothesis_id": "H-003",
  "pack_id": "P-002",
  "phase": "before",
  "metric": {"name": "max_function_loc", "command": "…", "direction": "lower_is_better", "unit": "lines"},
  "runs": [82, 82, 82],
  "value": 82,
  "stdev": 0.0,
  "git_sha": "…",
  "captured_at": "ISO-8601"
}
```

Flattened into `measure/measurements.jsonl` with the computed delta, then merged
into `archive/measurements.jsonl` at §14. The archive is what lets §16 detect a
**measurement plateau** — the loop's signal that it has stopped finding
improvements worth shipping.

---

## 9. Wave F — Fix (ADVANCE only, bounded surface)

*Paired constraint: **C-J-012** — no REFUTE/INCONCLUSIVE implementations, no
scope beyond the declared change surface.*

Inherited from `cd-review` Wave C. Fixers receive the pack, the ADVANCE dossier,
and the `change_surface` from §6.

Hard bounds:

- **ADVANCE only.** A fixer handed a REFUTE/INCONCLUSIVE dossier must refuse and
  return `blocked_reason=verdict_not_advance`.
- **Change surface is a ceiling.** Editing outside `change_surface` invalidates
  the measurement (the metric was declared against that surface). Needed
  expansion → return to orchestrator, do not self-authorise.
- **Do not re-open design.** A better idea is a finding for next cycle, not a
  pivot mid-fix.

Then the orchestrator runs the inherited verify step (`cd-review` §7.3):
`npm run check`, then `npm run test`. Either failing returns the pack to Wave F
with the error log; Wave D is not reached. On green:
`audits/verify-<PACK_ID>.md`, `last_step=verify_done:{PACK_ID}`, then Wave M's
after-measurement.

---

## 10. Wave D — Pre-PR review (4 inherited lenses + mandatory L6)

*Paired constraint: **C-J-013** — the Evidence lens is mandatory and can veto
alone.*

Lenses **L1–L4** (and optional **L5**) are inherited unchanged from
`agents/cd-review/REVIEW-LENS.md`: correctness & security, readability, repo
consistency, tests & edge cases, optional UI/a11y. Lenses are independent and
run in parallel; each sees only its own brief.

**L6 — Evidence & measurement integrity** is new, mandatory, and the only lens
that can veto on its own. Its brief is [`EVIDENCE-LENS.md`](./EVIDENCE-LENS.md).
It is the only reviewer that sees the dossier and the measurement records
alongside the diff, and it answers:

1. **Traceability** — does every hunk trace to the dossier's claim? Unexplained
   hunks are P1.
2. **Surface** — did the diff stay inside `change_surface`?
3. **Metric relevance** — does the declared metric actually test the claim, or
   is it a metric that moves for unrelated reasons? *(C-J-022: this is the
   loop's weakest point — see §19.)*
4. **Ordering** — is `M-*-before.json`'s `git_sha` an ancestor of the diff?
5. **Label honesty** — is anything called an optimization that lacks a measured
   `improved`? (§2 vocabulary rule.)
6. **Citation integrity** — does the dossier's ≥1 verified citation exist, 200,
   and actually support the claim as quoted?

### 10.1 Consolidation & acceptance gate

Inherited from `cd-review` §7.5.3 — dedupe by `path:lineRange` + root cause, max
severity wins:

| Verdict | Condition | Action |
|---------|-----------|--------|
| `send_back_to_wave_F` | any P0/P1 remains, **or any L6 finding at P1+** | Wave F fixes only the flagged findings; Wave D re-runs on touched files |
| `fix_and_proceed` | P2 remaining, cheap | orchestrator fixes inline, re-runs Wave D on touched files |
| `accept_and_ship` | only P3 nits or zero findings | proceed to the Evidence Gate (§11) |

**Hard cap: 3 Wave D rounds per pack.** Round 3 still P0/P1 →
`state=fatal_blocked`, `blocked_reason=wave_d_round_3_p1`, pack left on its
branch unmerged, offending finding IDs in `RECORD.md` "Stopped at".

**A re-run after send-back re-runs Wave M's after-measurement too.** The diff
changed, so the previous measurement is stale.

---

## 11. Wave G — The Evidence Gate

*Paired constraint: **C-J-014** — conjunctive gate; REFUTE vetoes a written,
green, lens-approved diff.*

Orchestrator solo. Evaluated by [`bin/gate.py`](./bin/gate.py) so the decision
is mechanical and reproducible rather than a judgement call at the end of a long
context.

```
SHIP  IFF  dossier.verdict == ADVANCE
      AND  dossier has ≥1 citation verified within TTL
      AND  M-<id>-before.json exists AND its git_sha is an ancestor of HEAD
      AND  M-<id>-after.json exists for the same metric
      AND  delta ∈ {improved, neutral}          # regressed ⇒ veto
      AND  wave_d_verdict == accept_and_ship
      AND  no L6 finding at P1 or above
```

Every conjunct is a veto. `last_step=evidence_gate:{PACK_ID}:{pass|veto}` is
written for **both** outcomes — a veto that skipped straight to `ship_blocked`
would leave a declared vocabulary entry unused, i.e. the implementation
contradicting its own header.

No conjunct may be skipped. A check that reports `PASS` without executing is
worse than no check, because it launders an untested assumption into evidence.

### 11.1 On veto

This is the behaviour that distinguishes this loop from `cd-review`, so it is
spelled out: **the code is already written, `npm run check` and `npm run test`
are green, and four lenses approved it. It still does not ship.**

1. Append to `gate/refutations.jsonl`:

```json
{
  "pack_id": "P-002", "hypothesis_id": "H-003",
  "failed_conjunct": "delta_regressed",
  "detail": "max_function_loc 82 → 91 (higher_is_worse)",
  "diff_sha": "…", "verdict_at": "ISO-8601",
  "disposition": "reverted"
}
```

2. `git revert` / drop the branch. The tree returns to the pre-pack state.
3. Write `ship_blocked:{PACK_ID}:{reason}`, then `reverted:{PACK_ID}`.
4. Append the negative result to `archive/verified-improvements.jsonl` with
   `outcome: refuted_at_gate` so a future cycle does not re-attempt it (§1.3).
5. **Continue to the next pack.** A veto is a result, not a blocker
   (§0.5.2). It never sets `fatal_blocked`.

### 11.2 Negative results are output, not waste

A vetoed pack produced a verified refutation, a measurement, and a durable
"don't try this" record. That is the loop's second product and the reason
`refutations-port` is a declared output port rather than a log file.

---

### 11.3 The gate must be falsifiable

[`bin/selftest.py`](./bin/selftest.py) drives **every** conjunct to failure on
purpose, plus a positive control proving the happy path still ships. A gate whose
conjuncts have never been observed to fail is a claim, not a test.

Two cases exist specifically to pin fail-OPEN regressions that were found in
review and must not return:

| Case | The bug it pins |
|------|-----------------|
| stray `accept_and_ship` in prose before the real verdict | an unanchored leftmost regex read the *first* verdict token anywhere in the file, so a vocabulary legend or a sentence like *"this would normally be accept_and_ship, but…"* could outrank the recorded verdict |
| no labelled verdict at all | absent evidence must fail **closed**; defaulting to ship is the one failure mode this loop exists to prevent |
| baseline SHA not an ancestor of HEAD | the ancestry conjunct was once skippable and reported `PASS` without checking anything |

Run it in CI alongside the measurement harness:

```bash
python3 agents/cdreview-brainstorm-join/bin/selftest.py    # exit 0 = all conjuncts falsifiable
```

---

## 12. Wave S — Synthesise, then ship

*Paired constraint: **C-J-015** — constraints are written before the ship step.*

### 12.1 Synthesise first (ordering is deliberate)

1. `synthesis/S-001-claims.md` — verified / refuted / inconclusive claims by
   theme, each with source dossier, gate outcome and measured delta.
2. `synthesis/S-002-constraints.md` — next-cycle constraints with decay scores:

| Type | Sourced from |
|------|--------------|
| `MUST_RESPECT` | ADVANCE + gate-passed + measured `improved` |
| `MUST_AVOID` | REFUTE, and gate vetoes |
| `MUST_TEST` | INCONCLUSIVE, and `neutral` deltas worth re-measuring |

`last_step=constraints_written`. **Before** the ship step, so a crash during
ship loses a PR but never loses the cycle's learning. This is the inverse of
the natural ordering and it is the point: ship state is recoverable from
GitHub, synthesis state is not.

### 12.2 Then ship

Inherited from `cd-review` §10.2: branch `improve/<RUN_ID>-<PACK_ID>`, push,
`gh pr create` against `develop`, CI green, merge, then a `main` PR with
CodeRabbit iteration (`cr_poll_{N}` → `cr_round_{N}_fix_pushed`) until residual
is empty, then `main_merged`.

Resilience policy (rate limits, CodeRabbit silence, 5xx, non-fast-forward,
round-5 residual) is inherited from `cd-review` §10.6 unchanged.

**The PR body MUST include the evidence block** — dossier verdict, the verified
citation, the declared metric, and the before → after → delta. A reviewer
should be able to see *why* the change is believed to be an improvement without
opening the run directory.

---

## 13. Record and resume contract

*Paired constraint: **C-J-016** — cd-review §0.5.4 shape, this loop's own step
names, written before every side effect.*

### 13.1 `day-status.json`

```json
{
  "state": "running|shipping|waiting_coderabbit|blocked|fatal_blocked|complete|budget_exhausted",
  "scope_id": "cycle-scope-1",
  "last_step": "see last_step_vocabulary in the header",
  "run_id": "YYYY-MM-DD-JNNN",
  "pack_id": "P-002",
  "hypothesis_id": "H-003",
  "gate": {"P-002": "pass|veto|pending"},
  "measurements": {"H-003": {"before": 82, "after": 74, "delta": "improved"}},
  "branch": "improve/2026-07-30-J001-P-002",
  "prs": {"develop": 123, "main": 124},
  "coderabbit_round": 1,
  "wave_d_round": 1,
  "blocked_reason": null,
  "resume_hint": "one-line instruction for the next wake",
  "updated_at": "ISO-8601"
}
```

Terminal states are `complete` and `fatal_blocked` (the universal contract from
`cd-review` §10.5). `state=running` with a stale `last_step` is a protocol
violation; the next wake treats it as a crash and resumes from the persisted
`last_step`.

### 13.2 Continuity invariants (hard)

Inherited from `cd-review` §8.3, plus two this loop adds:

1. `day-status.json` is written **before** side effects (push, PR, merge, CR
   comment, and — new — **before any product-code edit**).
2. Side effects are idempotent (`--force-with-lease`, `gh pr list --head` before
   create, re-postable CR comment).
3. Shipped waves are never re-run: `audits/fixes/<PACK_ID>.md` carries
   `Status: done`; Wave A/H/V outputs are skipped when the file exists non-empty.
4. PR numbers persist in `prs`.
5. `RECORD.md` is append-only within a run.
6. **New — measurements are immutable.** `M-*-before.json` is never rewritten.
   A re-measure writes `M-*-before.r2.json` and records why. Silently
   overwriting a baseline is how a loop lies to itself.
7. **New — the gate is re-derivable.** `bin/gate.py` recomputes the verdict from
   on-disk artifacts alone, so a resumed agent never has to trust a remembered
   decision.

### 13.3 `RECORD.md`

Sections: `Status`, `Goal this cycle`, `Slice aim`, `Waves`, `Hypotheses &
verdicts`, `Measurements`, `Gate verdicts`, `Done (chronological)`,
`In flight`, `Stopped at`, `Residual / backlog`, `Valuable notes`,
`PRs / commits`.

### 13.4 Checkpoints and deep cycles

Per-artifact checkpoints at `checkpoints/<wave>-<artifact_id>.json`. A `deep`
cycle (`cycle-type-port=deep`) checkpoints mid-cycle after
`wave_v_collected` and resumes in a second spawn (~727k across two), inherited
from `brainstorm` §8.4.3.

---

## 14. Archives (cross-cycle memory)

*Paired constraint: **C-J-017** — four archives; mid-cycle writes forbidden.*

| File | Grows | Purpose |
|------|-------|---------|
| `verified-improvements.jsonl` | append-only | **the join.** Every claim with its verdict, gate outcome and measured delta. Read at §1.3 for stare decisis; written at end-of-cycle. |
| `measurements.jsonl` | append-only | metric history per slice/metric. Powers §4 re-aim and §16 plateau detection. |
| `novelty.jsonl` | append-only | `warrant_hash` + embedding + status for Wave H dedup. |
| `constraints.jsonl` | decay-scored | next-cycle constraints; decay reduces score each cycle a constraint goes unused. |
| `citations.jsonl` | 7-day TTL | citation verification cache. |
| `cycles.json` | index | cycle id, started/ended, status, tokens, `session_stop_reason`. |

Reversal is allowed and must be explicit: a later entry may carry
`reverses: <earlier_id>` with a reason. Entries are never deleted — a loop that
edits its own history cannot be audited.

---

## 15. The 8 invariant rules of autonomy (adapted)

*Paired constraint: **C-J-018** — restated in adapted form; removing any one
ends autonomy.*

1. **No human in the loop inside the cycle-scope agent.** Continue, ship, or
   leave `Stopped at` + `day-status.json`.
2. **Launcher and cycle-scope agent are separate processes.** The launcher polls
   `day-status.json` + `RECORD.md` and never ingests the worker's transcript.
3. **`day-status.json` + `RECORD.md` "Stopped at" + `checkpoints/<latest>.json`
   is the ONLY resume contract**, against *this* loop's declared
   `last_step_vocabulary` (C-001-004a).
4. **Strict one-directional wave separation + disjoint ownership** (§3), with
   exactly two capped exceptions: the all-advance DA (§7.4) and the
   ship-boundary self-review.
5. **Converge and ship properly.** The Evidence Gate (§11) is mandatory and
   must not be bypassed. "All-advance is suspicious" — fire the capped DA.
6. **Scope-sized spawns with contiguous ownership.** One spawn = one cycle
   (A→H→V→M→F→D→G→S). Scout 350k / kill-switch 380k; deep ~727k over 2 spawns.
7. **Single source of truth.** This `LOOP.md` is canonical; `runs/` folders are
   immutable history; `archive/` is the only cross-cycle memory;
   `loop-registry.json` is the inter-loop catalog.
8. **Structural diversity pressure.** Every Wave H subagent holds a disjoint
   (persona, seed) tuple (§6).

### 15.1 The 9th invariant, specific to this loop

9. **Measurement precedes mutation.** The baseline is on disk before product
   code is edited (§8.1), measurements are immutable (§13.2.6), and the gate is
   re-derivable from disk (§13.2.7). Remove this and the loop keeps shipping —
   it just stops being able to tell whether it is helping.

---

## 16. Stop conditions (3 layers + blast radius)

*Paired constraint: **C-J-019** — goal-anchored, novelty-decay, budget-anchored,
plus a blast-radius kill-switch.*

### 16.1 Goal-anchored

From `improvement-goal-port`, e.g. "ship 3 measured optimizations", "raise
`coverage_pct` on S1 above 80", "eliminate suppressions in `convex/**`".

### 16.2 Novelty-decay and measurement-plateau (self-termination)

- **Hypothesis novelty:** new hypotheses minus `novelty.jsonl` duplicates = 0
  for 3 consecutive cycles → `complete`,
  `session_stop_reason="novelty-decay-3-consecutive"`.
- **Measurement plateau (new):** 3 consecutive cycles where every gate-passed
  pack measured `neutral` → `complete`,
  `session_stop_reason="measurement-plateau"`. The loop found nothing worth
  shipping, which is a legitimate finish, not a failure.
- **Constraint exhaustion:** >50% of `constraints.jsonl` at `decay_score < 0.3`
  → `stop_reason="constraint-exhaustion"`.
- **Gate-veto storm (new):** 5 consecutive gate vetoes → `blocked`,
  `blocked_reason="gate_veto_storm"`. Either the hypothesis quality or the
  metric choice is systematically wrong; that needs a fresh slice aim, not more
  packs.

### 16.3 Budget-anchored (hard backstop)

- Per-cycle kill-switch: **380k tokens**.
- Max cycles per session: **10**.
- Max tokens per session: **4M**.

### 16.4 Blast radius

`MAX_OPEN_PRS=10`, `MAX_FS_MUTATIONS_OUTSIDE_RUNROOT=20`,
`MAX_REVERTS_PER_CYCLE=5`. Hitting any → `state=budget_exhausted`, clean exit.

---

## 17. Conventions (enforce)

*Paired constraint: **C-J-020** — fixed vocabulary, IDs, run-ID format, budgets.*

| Area | Rule |
|------|------|
| Hypothesis verdict | 3-state UPPERCASE: `ADVANCE` / `REFUTE` / `INCONCLUSIVE` |
| Gate verdict | `pass` / `veto` (lowercase, machine-read by `bin/gate.py`) |
| Delta call | `improved` / `neutral` / `regressed` |
| Wave D verdict | `send_back_to_wave_F` / `fix_and_proceed` / `accept_and_ship` |
| Constraint types | `MUST_RESPECT` / `MUST_AVOID` / `MUST_TEST` |
| Severity | `P0` / `P1` / `P2` / `P3` (inherited, §5) |
| Run IDs | `runs/YYYY-MM-DD-JNNN/` — **J** for join, disambiguating from cd-review dates, brainstorm `C`, loop-forge `L` |
| Finding IDs | `F-{SLICE_ID}-{nnn}` |
| Hypothesis IDs | `H-{nnn}` |
| Dossier IDs | `V-{nnn}` |
| Pack IDs | `P-{nnn}` |
| Constraint IDs | `C-J-{nnn}` |
| Branches | `improve/<RUN_ID>-<PACK_ID>` |
| Commit style | lowercase, informal, human — per `AGENTS.md` |
| Token budget | scout 350k / kill-switch 380k; deep ~727k over 2 spawns |
| Wave parallelism | A: one per slice in aim. H: N=10 (5 personas × 2 seeds). V: M=5. M: orchestrator + harness. F: one per pack. D: 4 lenses + L6 (+L5 optional). G: orchestrator solo. S: 2 sequential. |
| Pre-push gate | `npm run check` then `npm run test` — never ship red |

---

## 18. Lineage

*Paired constraint: **C-J-021** — no self-composition, no parent mutation.*

| Field | Value |
|-------|-------|
| `loop_id` | `cdreview-brainstorm-join` |
| `parent_loops` | `cd-review`, `brainstorm` |
| `mutation_operator` | `compose` |
| `composed_by` | `loop-compose` |
| `composed_operator` | `join_on_archive ⋈` |
| `remaining_extraction_depth` | `2` — derived `min(parent depths) − 1 = min(3,3) − 1` |
| `composition_run` | [`agents/loop-compose/runs/2026-07-30-L001-composed-cdreview-brainstorm-join/`](../loop-compose/runs/2026-07-30-L001-composed-cdreview-brainstorm-join/) |

**`no_self_composition`** — this loop may not be composed with itself. Its
`audit-port` may not be bound to its own `improvement-goal-port`; that produces
a loop that audits its own audits.

**`no_parent_mutation`** — this loop never writes to `agents/cd-review/**` or
`agents/brainstorm/**`. It reads the parent slice map (§4) and the parent lens
catalogue (§10). If a parent's protocol needs to change, that is a `cd-review`
or `brainstorm` cycle's job, filed as a finding, not an edit from here.

**Extraction budget** — at depth 2, this loop may extract a sibling loop
(depth 1), and that sibling may extract one more (depth 0). Then extraction
stops. The likeliest extraction candidate is already visible: **the measurement
harness** (§8) is reusable by any loop that wants a before/after gate, and if a
second caller ever needs it, that is the itch to file.

---

## 19. Open risk (`MUST_TEST`)

*Paired constraint: **C-J-022** — metric-gaming is the known weak point.*

The loop's integrity rests on the honesty of one choice: **the metric declared
in Wave H.** A subagent that wants its hypothesis to ship can pick a metric that
improves for reasons unrelated to the claim — reduce `loc_touched_surface` by
deleting a comment, raise `coverage_pct` by testing a getter.

Current mitigations: the metric is declared **before** verification and long
before the edit (§6); L6 checks metric *relevance*, not just presence (§10);
`regressed` is an automatic veto (§8.3); the gate-veto storm condition catches
systematic metric failure (§16.2).

None of these are yet demonstrated to catch a *deliberately* gamed metric.
C-J-022 stays `MUST_TEST` until a cycle records a caught bad-metric case in
`refutations.jsonl` with `failed_conjunct: metric_irrelevant`. On that evidence
it is promoted to `MUST_RESPECT`; if three cycles pass with gamed metrics
shipping undetected, L6 needs a stronger instrument (candidate: require the
metric to be *predicted* numerically in the dossier, and treat a large
prediction miss as a veto).

---

## 20. History

*Paired constraint: **C-J-023** — every loop carries a provenance table.*

| Date | Note |
|------|------|
| 2026-07-30 | Loop authored by `agents/loop-compose/` run `2026-07-30-L001` as the `join_on_archive ⋈` composition of `cd-review` (loop A) and `brainstorm` (loop B). Wave α enumerated 45 candidate port bindings from the parents' real `ports:` blocks; Wave β returned 16 COMPOSE / 8 CONFLICT / 21 ORTHOGONAL, of which 2 were bound: `cd-review.audit-port → brainstorm.problem-statement-port` (forward) and `brainstorm.constraints-port → cd-review.slice-map-port` (feedback). All 8 CONFLICTs were the resume-contract single-writer class, resolved by this loop owning one `RECORD.md` + one `day-status.json` + its own `last_step_vocabulary`. Wave γ's port-anchored delta-test scored composed 8/8 vs `cd-review` 2/8 vs `brainstorm` 2/8, with 4 artifact classes (`before_measurement`, `after_measurement`, `measured_delta`, `refutation_veto`) absent from **both** parents — verdict ADMIT. Wave ε canary: sealed run on the fixed trivial-domain corpus (C-001-004b, "dedupe a list") with a real SIGKILL mid-cycle and cold-launcher resume. |
