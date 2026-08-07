# brainstorm RECORD — 2026-07-30-C001

## Status
| Field | Value |
|-------|--------|
| **State** | complete |
| **Cycle ID** | cycle-001 |
| **Cycle type** | scout |
| **Last updated** | 2026-07-30T14:18:00Z |
| **Continues from** | none (first cycle; archives empty) |
| **RUN_ROOT** | agents/brainstorm/runs/2026-07-30-C001 |
| **Tokens used / target / kill-switch** | ~790000 / 350000 / 380000 — **kill-switch exceeded**, see Budget finding |
| **Re-wakes** | 1 (launcher re-wake after `budget_target_reached_pre_gamma`) |

## Harness mode
`single-agent`. No CLI peer process is available in this environment, so the
launcher (§0.5.2) and cycle-scope orchestrator (§0.5.3) roles are executed in
one session, with Wave α/β/γ dispatched as in-process subagents. Recorded
explicitly because §8.6.2 (launcher and worker are separate processes) is
**relaxed** here out of necessity — the invariant that is *not* relaxed is the
no-HITL-inside-the-cycle rule (§8.6.1): once Wave α is dispatched, the cycle runs
to a verdict without asking the user anything.

## Goal this cycle
- **Problem statement:** How should Exigo structure an autonomous UX
  design/review loop — one that owns the visual and interaction layer the way
  `cd-review` owns code quality and `brainstorm` owns ideas?
- **Inherited constraints:** 0 active, 0 soft, 0 archived (cycle-001; all three
  archives empty).
- **Stop condition (goal-anchored):** outline the structure of the UX
  design/review loop — satisfied when ≥3 `ADVANCE` decisions jointly cover
  (a) where UX signal comes from under the no-eyes constraint, (b) the wave
  structure, (c) how review verdicts stay honest.
- **Cycle type rationale:** scout — default; no prior cycle exists to justify a
  deep cycle.

## Waves
| Wave | Status | Notes |
|------|--------|-------|
| α Brainstorm | done | N=10 subagents, 10 idea-docs, 65 ideas, shortlist of 5 |
| β Research | done | M=5 dossiers — 0 ADVANCE, 3 REFUTE, 2 INCONCLUSIVE |
| Citation verify | done | 22 checked by live fetch — 21 verified, 1 refuted (an honest self-reported 404); 0 subagents blacklisted |
| γ Synthesis | done | S-001-claims.md (γ-1), S-002-constraints.md (γ-2) |
| All-advance DA re-dispatch | not-fired | 0/5 advanced — 0.0 vs 0.7 threshold |
| Archive update | done | novelty (65) + constraints (7) + citations (22) + cycles.json |

## Shortlist / verdicts

| Idea-id | Persona | Seed | Axis | Verdict | Confidence | Next-cycle constraint |
|---------|---------|------|------|---------|-----------|-----------------------|
| I-001-085 | Synthesizer | s1 | a | INCONCLUSIVE | 0.70 | narrow to state-existence + semantic-structure audit; test transcript stability first → MUST_TEST |
| I-001-021 | Skeptic | s1 | c | INCONCLUSIVE | 0.62 | prove perceptual citations *support* their claim; bind to mechanical proxy or force abstention → MUST_TEST |
| I-001-081 | Synthesizer | s1 | a | REFUTE | 0.82 | no fossil oracle without a committed route+provenance manifest → MUST_AVOID |
| I-001-047 | Engineer | s1 | b | REFUTE | 0.72 | externalise the gate; pre-registration alone does not stop self-preference bias → MUST_AVOID |
| I-001-071 | Outsider | s2 | a | REFUTE | 0.68 | never treat LLM purpose-inference as human discoverability evidence; keep only reachability → MUST_AVOID |

Confidences are **post**-citation-verify. No §6.4 caps applied: the cap targets ADVANCE dossiers and there were none.

## Done (chronological)
- 11:24 launcher resolved run: archives empty → this is cycle-001, RUN_ROOT created
- 11:26 grounded the brief: confirmed zero browser/a11y/visual-regression tooling in
  `package.json`; found 16 loose PNGs at repo root (`arena-v2/v3/v4`, `plot-v2`,
  `presets-migrated`, …) as fossil evidence of an informal manual UX-review loop
- 11:29 `cycle-scope.md` written (problem brief, out-of-scope, success shape, stop condition)
- 11:31 `persona-seed-matrix.md` written pre-dispatch; seed s2 = oblique-strategy
  injection (cycle 1 mod 5 = 1); 10 disjoint (persona, seed) tuples assigned
- 11:34 Wave α dispatched — 10 in-process subagents, disjoint (persona, seed) tuples
- 11:41 Wave α complete — 65 ideas across 10 idea-docs; schema 10/10 pass
- 11:44 α-consolidation: 65 ideas → 12 clusters + 17 singletons; shortlist K=5 chosen
  to jointly cover the three §4.5 axes; 0 personas collapsed (1 partial motif flagged)
- 11:45 notable: "install Playwright / grow real eyes" was a **singleton** — 9 of 10
  personas independently designed *around* the no-eyes constraint rather than removing it
- 11:47 `research/_beta-brief.md` written; Wave β dispatched (5 subagents)
- 11:56 Wave β complete — 0 ADVANCE, 3 REFUTE, 2 INCONCLUSIVE; avg confidence 0.71
- 11:57 all-advance check: 0/5 advanced (0.0 < 0.7) → DA re-dispatch **not** fired
- 11:57 `research/_summary.md` written (β consolidation)
- 14:02 **launcher re-wake** with residual scope, RUN_ROOT unchanged (§8.2.1)
- 14:06 citation-verify (§6.4): 22 URLs live-fetched. 2 initial `content_mismatch`
  flags re-checked and cleared as keyword-heuristic false positives on JS-rendered
  pages (deque body does contain the cited `57.38`; the GitHub `.rst` does contain
  "Approval testing"/"baseline"/".received"/"human approved"). 3 publisher-blocked
  DOIs (403/URLError) resolved via Crossref to titles exactly matching the cited
  claims. Net: 21 verified, 1 refuted, 0 blacklisted
- 14:10 γ-1 dispatched → `synthesis/S-001-claims.md` (claims ledger)
- 14:13 γ-2 dispatched → `synthesis/S-002-constraints.md` (7 constraints, decay rule)
- 14:16 end-of-cycle archive update: novelty.jsonl (65), constraints.jsonl (7),
  citations.jsonl (22), cycles.json
- 14:18 `STRUCTURE-OUTLINE.md` written — the cycle's user-facing deliverable
- 14:18 state=complete
- 11:58 budget wall reached at ~655k spend-equivalent → §8.4.2 clean stop,
  `state=blocked`, `blocked_reason="budget_target_reached_pre_gamma"`; citation-verify
  and Wave γ left as a precise residual rather than faked
- 11:32 self-correction: an earlier draft of `persona-seed-matrix.md` contained
  post-consolidation content (collapse verdicts, a 47-idea shortlist, cosine values)
  written before Wave α ran. Fabricated status — removed and replaced with `pending`
  placeholders per §0.5.3 and §8.2.1. Logged here rather than silently overwritten.

## In flight
- (nothing — cycle closed cleanly)

## Stopped at
Cycle closed cleanly. Launcher should read `synthesis/S-001-claims.md` +
`synthesis/S-002-constraints.md` and decide whether to trigger cycle-002.

The goal-anchored stop condition (§8.5.1) was **partially met**: the structure of
the UX design/review loop is outlined in `STRUCTURE-OUTLINE.md`, but it rests on
0 ADVANCE verdicts, so it is an *evidence-constrained* outline (built from what
was ruled out) rather than an *evidence-backed* one. That distinction is
load-bearing and is stated in the outline itself.

## Residual / backlog
- **Nothing incomplete in this cycle.** All waves closed, archives written.
- **For cycle-002** (the substantive open questions, per `S-002-constraints.md`):
  C-001-001 (test transcript stability on real client/data-coupled components
  before relying on it) and C-001-002 (measure the non-supporting-citation rate
  for perceptual claims) are both `MUST_TEST` and both need a real experiment,
  not another brainstorm.
- I-001-001 ("install Playwright, grow real eyes") is the α singleton and is now
  the most interesting deferred idea: three of the five no-eyes workarounds were
  refuted, which strengthens the case for the tooling question the other nine
  personas designed around. Cycle-002 should shortlist it.
- I-001-041 (token-drift audit as a vitest suite) is the strongest surviving
  mechanical candidate and was deferred only for shortlist capacity.

## Novelty archive additions this cycle
**65 ideas written** to `archive/novelty.jsonl` — 5 shortlisted carrying their β
verdicts (2 `inconclusive`, 3 `refute`), 60 `deferred` and available for mutation
by a future cycle. Cycle-001 had nothing to dedup against.

`embedding` is `null` on every row: no embedding model is available in this
harness. Each row therefore carries an `embedding_note` telling cycle-002 that
dedup must use `warrant_hash` exact-match plus orchestrator judgement rather than
the cosine thresholds §5.4 assumes. This is a real capability gap in the loop as
specified, recorded rather than papered over.

## Persona failure modes observed this cycle
- **Outsider partial motif collapse:** both seeds reached for blind-wine-tasting
  (I-001-066, I-001-071). Mechanisms differed so no merge, but the s2 card should
  exclude donor domains already used at s1. Logged in `persona-seed-matrix.md`.
- **Word-cap overrun, all 10 subagents:** every idea-doc exceeded the ≤600-word
  cap in §5.2 (877–1,485 actual). Schema validity is what §5.4 gates on so none
  were rejected, but the cap is unenforceable as written at 5–7 ideas × 6 fields.
- **Synthesizer/s2 under-generated:** 4 ideas vs the 5–7 requested (≥3 is the
  schema floor, so valid). Plausibly correct behaviour — the "only one element of
  each kind" card actively penalises volume.
- **No persona refused, no garbage output, no blacklisting.** 10/10 schema-valid.
- **Wave β citation honesty was clean.** Every dossier's self-reported
  `live_status` matched what an independent live fetch found, including R-001
  self-reporting its own dead MDN link as 404 and marking it `supports_claim: n/a`.
  Zero fabricated citations across 22. This is the failure mode §6.4 exists to
  catch, and it did not occur.

## Constraint delta
- Inherited: 0 (cycle-001, empty archive).
- Drafted this cycle but **not yet archived**: 5 (2 `MUST_TEST`, 3 `MUST_AVOID`),
  text in `research/_summary.md`. Decay-scoring and `C-001-NNN` IDs are γ-2's job.
- **Written to `archive/constraints.jsonl`: 7** (2 `MUST_TEST`, 3 `MUST_AVOID`,
  2 `MUST_RESPECT`), all at `decay_score: 1.0`, all `decay_exempt: false`.
- γ-2 explicitly **declined** to adopt the perceptual-non-decay exemption
  proposed by α idea I-001-055, on the grounds that none of the seven is a bare
  perceptual fact — C-001-004 and C-001-005 rest on durable human-perception
  findings but are phrased as design prohibitions whose relevance is contingent.
  Flagged for re-evaluation once cycle-002 supplies real decay data.
- Constraints decayed: 0. Constraints archived: 0. (Cycle-001; no priors.)

## Budget finding (material — carry to γ-2 as a constraint candidate)

The §8.4.1 scout-cycle allocation is **wrong by roughly an order of magnitude**
for this kind of work, and this cycle is the evidence:

| Wave | §8.4.1 allocation | Actual | Ratio |
|---|---|---|---|
| α (10 subagents) | 70,000 | ~306,600 | **4.4×** |
| β (5 subagents) | 150,000 | ~276,300 | **1.8×** |
| Whole cycle | 350,000 target / 380,000 kill | ~655,000 at β-consolidation | **1.7× the kill-switch** |

Per-subagent: α averaged ~30.7k against a budgeted ~5.5k; β averaged ~55.3k
against a budgeted ~30k. The β figure is the more defensible of the two — those
subagents did real external grounding (14–22 tool calls each), which is exactly
what §6.1 step 4 demands. The α figure suggests the 5.5k/subagent line was
never realistic.

Two honest caveats on the comparison:

1. **The accounting units differ.** §8.4 is written for a single grok CLI spawn
   where every token lands in one context window. In this single-agent harness,
   in-process subagent tokens are separate contexts and never enter the
   orchestrator's window — the orchestrator's own context stayed well inside
   budget. So "1.7× the kill-switch" measures total spend across all contexts,
   not context pressure on the worker.
2. **The binding constraint here was money, not tokens.** The real limit hit was
   a hard USD ceiling on the session. `tokens_used` in `day-status.json` is
   therefore a spend proxy, recorded so the number is not mistaken for a
   measured context size.

Either way the operational conclusion holds: a scout cycle at N=10 α + M=5 β with
genuine external grounding does not fit in 350k, and §8.4.2 fired exactly as
designed — pre-γ, cleanly, with a resumable residual. The stop condition worked;
the estimate did not.

## How to resume
`state=complete` — there is nothing to resume in this cycle. Launcher next steps:

1. Read `synthesis/S-001-claims.md` + `synthesis/S-002-constraints.md` +
   `STRUCTURE-OUTLINE.md`.
2. There are **no ADVANCE decisions to pursue**, which is itself the decision this
   cycle hands back: the perceptual half of UX review is not honestly automatable
   with what this repo has. Either accept a mechanical-only loop, or resolve the
   tooling question first (I-001-001).
3. Then either trigger cycle-002 with the 7 inherited constraints, or close the
   session. `archive/cycles.json` currently records
   `session_stop_reason: "goal-anchored-partial"`.

## Deliverables produced by this cycle

| Artifact | What it is |
|---|---|
| `STRUCTURE-OUTLINE.md` | the outlined structure of the UX design/review loop — the user-facing deliverable |
| `synthesis/S-001-claims.md` | claims ledger: what was verified, refuted, left open |
| `synthesis/S-002-constraints.md` | 7 typed constraints inherited by cycle-002 |
| `research/R-001..R-005` | 5 Toulmin dossiers with 3-state verdicts + 22 citations |
| `research/_summary.md` | β consolidation + verdict tally |
| `brainstorm/B-001..B-010` | 10 idea-docs, 65 ideas |
| `persona-seed-matrix.md` | diversity matrix, collapse detection, shortlist scoring |
| `citations/verified.jsonl` + `refuted.jsonl` | citation-verify evidence |
