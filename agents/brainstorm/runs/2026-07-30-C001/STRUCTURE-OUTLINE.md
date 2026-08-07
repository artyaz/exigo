# Structure outline — UX design/review loop (`ux-review`)

Produced by brainstorm cycle-001 (`agents/brainstorm/runs/2026-07-30-C001`).
This is the **outline** the cycle was asked for. It is not the canonical
protocol: authoring `agents/ux-review/LOOP.md` is `loop-forge`'s δ wave (see §9).

## 0. Read this first — the honesty caveat

The cycle returned **0 ADVANCE, 3 REFUTE, 2 INCONCLUSIVE**. So this outline is
**evidence-constrained, not evidence-backed**: its shape is derived from what was
*ruled out* on fetched external evidence, plus the narrower mechanism each
refutation left standing. Every structural choice below traces to a dossier.

Nothing here is a verified recommendation to build. Two `MUST_TEST` constraints
(C-001-001, C-001-002) must be settled by experiment before this becomes a real
`LOOP.md`.

## 1. The finding that determines the whole shape

Four of five dossiers independently converged on one split, from different
directions:

> **The mechanical half of UX review is groundable in this repo. The perceptual
> half is not honestly automatable here.**

| Dossier | Mechanical half — works | Perceptual half — fails |
|---|---|---|
| R-001 | state-existence + semantic-structure audit from source | contrast / focus-visible / meaningful-sequence are **0%** transcript-visible (Deque); no DOM env (`vitest environment:'node'`); 41/107 components are `"use client"`; `<div>`:semantic ≈ 2.7:1 |
| R-002 | citation non-support is auto-detectable for mechanical claims | no ground-truth artifact exists for a `file:line` to entail a "feel"/hierarchy claim — the gate degrades to presence-checking exactly where it's needed |
| R-004 | cd-review's objective exit-code gate is externalisable | self-preference bias persists under **entirely objective** criteria (judges up to **50%** more likely to pass their own failing output, arXiv 2604.06996), driven causally by self-*recognition* (arXiv 2404.13076) |
| R-005 | reachability ("is every promised affordance present?") | LLM first-click diverges from real users in **53%** of tasks, n=3431 (arXiv 2605.18302); LLM heuristic eval finds ~**21%** of expert issues, with hallucinated false positives |

**Consequence:** a UX loop here must either scope itself honestly to the
mechanical half, or obtain a perceptual signal **it does not author**. Any design
that quietly lets an eyeless reviewer narrate perceptual judgements is the
failure mode the evidence predicts.

## 2. Proposed identity

```yaml
loop_id: ux-review
parent_loops: [cd-review, brainstorm]
mutation_operator: compose        # cd-review's critical genome + brainstorm's persona diversity
remaining_extraction_depth: 3
```

Sibling to `cd-review` (which owns code quality) — same two-layer launcher /
scope-agent harness, same RECORD + day-status resume contract, same immutable
dated runs. It owns the **visual and interaction layer**, honestly bounded.

## 3. Typed ports (canonical invariant loop-forge C-001-can-02)

```yaml
ports:
  inputs:
    - {name: surface-manifest-port, type: json, required: true,
       description: "route x declared-state matrix built by wave σ from src/app/"}
    - {name: repo-port, type: path, required: true}
    - {name: prior-constraints-port, type: jsonl, required: false}
    - {name: baseline-port, type: json, required: false,
       description: "provenance-gated baselines ONLY (§6). Absent by default — the 16 root PNGs do not qualify."}
  outputs:
    - {name: mechanical-findings-port, type: markdown-files,
       description: "MECHANICAL-class findings, each with file:line"}
    - {name: perceptual-register-port, type: markdown-file,
       description: "bound claims + explicit abstentions. Never merged with mechanical findings."}
    - {name: gate-verdict-port, type: json,
       description: "externally-authored gate result: exit codes the proposer cannot write"}
    - {name: record-port, type: markdown-file}
    - {name: day-status-port, type: json-file}
```

## 4. Wave structure

Not brainstorm's α→β→γ, and not cd-review's audit→fix. R-004 refuted
"audit→propose→gate with pre-registered criteria" *as sufficient* — but its
salvage kept the directional shape while requiring the gate be externalised.

```text
σ  SURVEY (deterministic, no LLM judgement)
   Build the route × declared-state manifest from src/app/ + _components/.
   Answers "what surfaces exist and what states does each declare?"
   Prerequisite per C-001-001: first prove components render to a STABLE
   transcript at all. If they do not, the loop stops here and says so.
        │
        ▼
μ  MECHANICAL AUDIT (N parallel, disjoint route slices)
   MECHANICAL-class findings only, every one with file:line:
     · design-token drift (hard-coded hex / off-scale spacing vs Tailwind v4)
     · state completeness (loading / empty / error branches present?)
     · semantic structure (heading order, landmarks, control names)
     · reachability punch-list  ← the claim-free survivor of R-005
     · static a11y via next lint + jsx-a11y
   Gated by deterministic tools that already exist: vitest, tsc, next lint.
        │
        ▼
π  PERCEPTUAL LANE (hard-walled, ABSTAIN by default)
   May only speak when it binds a claim to a checkable mechanical proxy.
   Otherwise it abstains — and abstention is a first-class recorded outcome,
   not a failure. This is the structural answer to §1.
   ⚠ Carries C-001-002 and the Abstention Inflation risk (arXiv 2507.16199):
     adding an abstain option can cause models to abstain even when correct.
     Unresolved — see §8.
        │
        ▼
δ  PROPOSE (author changes for CONFIRMED MECHANICAL findings only)
        │
        ▼
ε  EXTERNAL GATE  ← the load-bearing correction from R-004
   A separate persona/turn with NO authorship memory of δ, plus objective
   signals the proposer cannot author (`npm run check`, `npm run test` exit
   codes). Pre-registered criteria are kept but are explicitly NOT relied on
   as the defence — R-004 showed self-preference survives objective criteria.
```

`last_step_vocabulary` (each forged loop declares its own, per C-001-can-04):
`init, surface_manifest_written, sigma_stability_probed, mu_dispatched,
mu_consolidated, pi_dispatched, pi_registered, delta_authored, epsilon_gated,
record_finalized, scope_complete`.

## 5. Two ledgers that refuse to sum

There is **no single aggregate "UX score."** Supported by the composite-indicator
literature on non-compensatory aggregation (R-002: Greco 2018, Mutz 2022) —
compensatory schemes let a strong dimension mask a weak one, and averaging a
deterministic count with an unverifiable judgement launders the second into the
first.

| Ledger | Contents | Verdicts |
|---|---|---|
| Mechanical scorecard | deterministic counts, each `file:line` | `PASS` / `FAIL` (tool-anchored) |
| Perceptual register | bound claims + explicit abstentions | `BOUND` / `ABSTAIN` |

They are reported side by side, never merged.

## 6. Baselines are provenance-gated

R-003 **refuted** using the 16 root PNGs as a golden-master oracle. The evidence
is unambiguous: all 16 landed in a single un-iterated commit (`43e273b`,
2026-06-20); `calltree` and `sales-nocode` name nothing in `src/`; `arena`,
`plot`, `ide` are exercise widgets, not routes; every mappable route was modified
*after* capture (07-17/18, 06-22/24); capture scopes are inconsistent (518px crops
vs 1200px full pages); and they are referenced nowhere in `src/`.

The salvage: **a baseline is an oracle only if its provenance is recorded.** So
if baselines are wanted, generate them fresh under a recorded capture contract
(route, viewport, state, commit, date) and discard any fossil older than the
source it claims to bless. Do not adopt the existing PNGs.

## 7. Hard prohibitions (from the `MUST_AVOID` constraints)

- **C-001-003** — no baseline oracle without a committed route+provenance manifest.
- **C-001-004** — never let the proposer author its own gate signal; pre-registration alone is not a defence.
- **C-001-005** — never treat an LLM's failure to name a screen's purpose as evidence of *human* discoverability failure.
- Inherited from the brief: no second LLM provider; no human reviewer inside the worker (HITL lives in the launcher, between cycles); no mutation of `cd-review` or `brainstorm`.

## 8. Open before this can be authored

1. **C-001-001 (`MUST_TEST`)** — can this repo's client/data-coupled components
   (41/107 are `"use client"`, many with Convex/Clerk/tRPC coupling) be rendered
   to a *stable* transcript at all? `vitest` runs `environment: 'node'` with no
   jsdom. If the answer is no, wave σ cannot be built as described.
2. **C-001-002 (`MUST_TEST`)** — measure the non-supporting-citation rate for
   perceptual claims, and decide between binding-to-proxy vs forced abstention
   without triggering Abstention Inflation.
3. **The tooling question (deferred idea I-001-001).** Installing real browser
   tooling was proposed by exactly **1 of 10** personas — nine designed *around*
   the no-eyes constraint. Three of those workarounds were then refuted. That
   asymmetry is the cycle's strongest hint: the honest unblock is probably to
   give the loop real eyes, not to keep synthesising a substitute. Cycle-002
   should shortlist it.

## 9. Path to a real `LOOP.md`

1. Resolve §8.1 and §8.2 by experiment (not by another brainstorm).
2. Run brainstorm cycle-002 with the 7 inherited constraints, shortlisting
   I-001-001 (real tooling) and I-001-041 (token-drift vitest suite).
3. Hand the surviving ADVANCE decisions to `loop-forge` (`agents/loop-forge/LOOP.md`),
   whose δ wave authors `agents/ux-review/LOOP.md` with constraint-paired sections,
   and whose ε wave canary-tests it before it ships.

## Provenance

| Input | Where |
|---|---|
| 65 ideas, 10 personas × seeds | `brainstorm/B-001..B-010` |
| 5 Toulmin dossiers, 22 verified citations | `research/R-001..R-005` |
| Claims ledger | `synthesis/S-001-claims.md` |
| 7 typed constraints | `synthesis/S-002-constraints.md` |
| Cycle narrative + budget finding | `RECORD.md` |
