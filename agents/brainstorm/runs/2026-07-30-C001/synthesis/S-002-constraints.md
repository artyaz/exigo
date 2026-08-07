# S-002 — Cycle cycle-001 Constraints

## New constraints (created this cycle)

### C-001-001: Reframe the a11y-transcript from "an eye for UX quality" to a narrow source-level state-existence + semantic-structure audit, and first test whether this repo's client/data-coupled components render to a stable transcript at all.
- Type: MUST_TEST
- Source idea / dossier: I-001-085, R-001
- Evidence: contrast (30% of issues), focus-visible, and meaningful-sequence are 0% transcript-visible [Deque]; repo has no DOM env (`vitest environment:'node'`), 41/107 components are `"use client"`, `<div>`:semantic = 2.7:1 — static derivation is inaccurate and thin.
- decay_score: 1.0
- decay_exempt: false

### C-001-002: Prove a PERCEPTUAL verdict's citation actually *supports* rather than merely accompanies its claim — bind perceptual ADVANCE to a checkable mechanical proxy or force explicit abstention, and measure the non-supporting-citation rate before trusting the gate.
- Type: MUST_TEST
- Source idea / dossier: I-001-021, R-002
- Evidence: no ground-truth artifact lets a `file:line` quote entail a feel/hierarchy claim, so the gate degrades to presence-checking exactly where needed; default-REJECT may induce Abstention Inflation [arxiv 2507.16199].
- decay_score: 1.0
- decay_exempt: false

### C-001-003: Do not treat the root PNGs as an oracle unless a committed manifest first pins each screenshot to a live route AND records verified capture provenance and date, discarding any fossil older than the source it claims to bless.
- Type: MUST_AVOID
- Source idea / dossier: I-001-081, R-003
- Evidence: R-003 falsified — all 16 PNGs in one un-iterated commit `43e273b` (2026-06-20); names denote widgets not routes; every mappable route modified AFTER capture (07-17/18, 06-22/24); mixed crop scopes; 0 refs in `src/`.
- decay_score: 1.0
- decay_exempt: false

### C-001-004: Externalise the review gate — use a separate persona/turn with no authorship memory, or a signal the proposer cannot author — because pre-registered/frozen criteria alone do not stop same-run self-preference bias.
- Type: MUST_AVOID
- Source idea / dossier: I-001-047, R-004
- Evidence: R-004 falsified — self-preference bias persists under *entirely objective* criteria (judges up to 50% more likely to pass their own failing output [arxiv 2604.06996]); bias is causally driven by self-*recognition* [2404.13076], a channel pre-registration cannot touch.
- decay_score: 1.0
- decay_exempt: false

### C-001-005: Do not treat an LLM's inability to name a stripped screen's purpose as evidence of human discoverability failure; if the probe is kept, restrict it to the correlation-free reachability check.
- Type: MUST_AVOID
- Source idea / dossier: I-001-071, R-005
- Evidence: R-005 falsified — GPT first-click diverges from real users in 53% of tasks (n=3431) [arxiv 2605.18302]; heuristic-eval LLMs find only ~21% of expert issues with hallucinated false positives; stripping removes the rendered copy/layout humans judge.
- decay_score: 1.0
- decay_exempt: false

### C-001-006: Budget a scout cycle at N=10 α + M=5 β with genuine external grounding at ~650k, not 350k — allot α ~30k/subagent (not 5.5k) and β ~55k/subagent (not 30k), and treat §8.4.1 as superseded by this cycle's measurement.
- Type: MUST_RESPECT
- Source idea / dossier: cycle process (RECORD.md Budget finding)
- Evidence: α ran ~306.6k vs 70k budgeted (4.4×); β ran ~276.3k vs 150k (1.8×); whole cycle hit ~655k at β-consolidation (1.7× the 380k kill-switch) and stopped cleanly pre-γ, forcing a resume.
- decay_score: 1.0
- decay_exempt: false

### C-001-007: Enforce the §5.2 ≤600-word idea-doc cap mechanically at schema-validation time (or raise the cap to a value the 5–7-idea × 6-field format can actually meet), since a purely advisory cap is ignored.
- Type: MUST_RESPECT
- Source idea / dossier: cycle process (RECORD.md Persona failure modes)
- Evidence: all 10 Wave α idea-docs overran the cap (877–1,485 words actual); §5.4 gates on schema validity only, so 0 were rejected — the cap was unenforceable as written.
- decay_score: 1.0
- decay_exempt: false

## Constraints passed to next cycle's Wave α
(filtered to decay_score >= 0.3 — all 7 this cycle)
- C-001-001 (MUST_TEST), C-001-002 (MUST_TEST), C-001-003 (MUST_AVOID), C-001-004 (MUST_AVOID), C-001-005 (MUST_AVOID), C-001-006 (MUST_RESPECT), C-001-007 (MUST_RESPECT)

## Constraints decayed this cycle
- none (cycle-001; no prior constraints existed)

## Constraints archived this cycle
- none (cycle-001)

## Decay rule recorded for future cycles
A constraint starts at `decay_score: 1.0`. In each subsequent cycle: if it is *applied* (an idea is rejected for violating it) it holds at 1.0; if *not applied* it decays by 0.15/cycle. At `< 0.3` tag `[soft]`; at `< 0.1` tag `[archived]`.

**decay_exempt judgement — I set `decay_exempt: false` on all seven.** The candidate rule from I-001-055 (perceptual facts should not decay) is sound in principle, but none of these seven is a bare perceptual fact: C-001-001/002 are *test* mandates (a test can be satisfied or made obsolete by new tooling), C-001-003/007 are mechanical/provenance rules (they can go stale), and C-001-006 is a budget number that must re-measure. C-001-004 and C-001-005 rest on durable human-perception findings (self-recognition bias; LLM-vs-human click divergence), but each is phrased as a *design prohibition* whose relevance is contingent on the loop still using a same-run judge or a purpose-inference probe — so it should decay if no future idea triggers it rather than persist unconditionally. I therefore decline to adopt the exemption this cycle, but recommend re-evaluating it for C-001-004/005 once a second cycle gives real decay data to test the rule against.

## Note for the next cycle's problem brief
With 0 ADVANCE, cycle-002 should stop trying to synthesize a perceptual eye from source alone and instead brainstorm the two strongest deferred candidates. First, re-examine I-001-001 ("install real browser tooling / grow real eyes") — the α singleton, now materially more attractive because three of the five no-eyes workarounds (R-003/004/005) were refuted, meaning the tooling question the other nine personas designed *around* is likely the real unblock. Second, shortlist I-001-041 ("token-drift audit as a vitest suite"), the most shippable mechanical check and a concrete instance of the "mechanical-only, honestly scoped" design space that four of five dossiers converged on. Frame the brief so any proposal claiming perceptual judgement must supply an external signal the loop does not author (per C-001-004).
