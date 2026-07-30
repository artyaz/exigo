# S-001 — Cycle cycle-001 Claims Ledger

Scope: 5 dossiers on a proposed UX design/review loop. Outcome 0 ADVANCE / 3 REFUTE / 2 INCONCLUSIVE. Citation-verify (§6.4): 21/22 verified; 1 honest dead link (R-001 [6], self-reported 404, `n/a`); no fabrication, no blacklist, no confidence caps.

## Verified claims (post-citation-verify)

### Theme A: Measurement architecture is sound (mechanical half)
- Non-summation is the principled aggregation for incommensurable measures — compensatory schemes let a strong dimension mask a weak one; only non-compensatory preserves incommensurability. Source: I-001-021, R-002. Conf: 0.62 (dossier).
- Evidence-typing + citation-gated default-REJECT is a proven local idiom — the repo already runs `file:line`+severity+default-negative for code review. Source: I-001-021, R-002. Conf: 0.62.
- Non-support of a citation IS automatically detectable for mechanical claims (NLI/AutoAIS/CAQA; repo §6.4 uses embedding-cosine<0.6, a semantic not presence check). Source: I-001-021, R-002. Conf: 0.62.
- State-existence auditing (does a loading/empty/error state exist?) is answerable from source with zero render fidelity; `role="status"` and ~43 empty/error strings do serialize. Source: I-001-085, R-001. Conf: 0.70.
- cd-review externalises its objective gate (`npm run check`+`test`, exit codes) as a separate prior stage run by separate subagents who "do not see each other." Source: I-001-047, R-004. Conf: 0.72.

## Refuted claims (from REFUTE dossiers)

### Theme B: Perceptual grounding fails — every mechanism that claimed human-perception proxy died
- Refuted: the 16 root PNGs are a usable golden-master oracle. Source: I-001-081, R-003. Falsifier: all 16 in one un-iterated commit `43e273b` 2026-06-20; names denote widgets not routes (`calltree`/`sales-nocode` = 0 files); every mappable route modified AFTER capture (07-17/18, 06-22/24); mixed crop scopes; orphaned (0 refs in `src/`).
- Refuted: pre-registered/frozen criteria + adversary persona suffice for an honest same-run self-graded gate. Source: I-001-047, R-004. Falsifier: self-preference bias persists under *entirely objective* criteria — judges up to 50% more likely to mark their own failing output as satisfied [arxiv 2604.06996]; bias is causally driven by self-*recognition* [2404.13076], a channel pre-registration cannot touch.
- Refuted: an LLM's failure to name a stripped screen's purpose signals *human* discoverability failure. Source: I-001-071, R-005. Falsifier: GPT first-click diverges from real users in 53% of tasks (n=3431) [arxiv 2605.18302]; heuristic-eval LLMs find only ~21% of expert issues with hallucinated false positives; stripping removes the rendered copy/layout humans actually judge.

## Inconclusive claims (from INCONCLUSIVE dossiers)

### Theme C: Grounded mechanically, unverifiable perceptually
- Inconclusive: a11y transcript is a perceptual substrate for UX quality. Source: I-001-085, R-001. Missing: contrast (30% of issues, invisible to text) / focus-visible / meaningful-sequence are 0% transcript-visible [Deque]; repo has no DOM env (`vitest environment:'node'`), 41/107 components are `"use client"`, `<div>`:semantic = 2.7:1 — static derivation is both inaccurate and thin.
- Inconclusive: citation gate defeats theatre for PERCEPTUAL verdicts. Source: I-001-021, R-002. Missing: no ground-truth artifact for a `file:line` quote to entail a feel/hierarchy claim, so the gate degrades to presence-checking exactly where needed; default-REJECT may itself induce Abstention Inflation [arxiv 2507.16199].

## Cross-cutting observations
- **The mechanical/perceptual split is an empirical result, not a prediction.** 4 of 5 dossiers independently reach it: the mechanical half of UX review is groundable in this repo, the perceptual half is not honestly automatable here. Evidence: R-001 (structural lint yes / contrast-spacing-focus no), R-002 (citation entailment works for mechanical / no artifact for perceptual), R-004 (objective exit-code anchor externalisable / subjective gate leaks via self-recognition), R-005 (reachability yes / purpose-comprehension doesn't correlate with humans).
- **Shared load-bearing failure mode:** any single-model, same-run loop where proposer=judge cannot self-verify perception — R-004's self-recognition finding constrains *all* such designs; R-002/R-005 are the same hole in citation and inference form.
- **Repo-specific ground truth is thin/stale:** no render infra (R-001), no route-mappable baselines (R-003) — perceptual mechanisms lack anything to anchor against.

## Surviving salvage (what each refutation left intact)
- R-003 → "a baseline is an oracle *only if* provenance is recorded" (approval-testing warrant survives; needs a committed manifest pinning each screenshot to a live route + verified date). Converges with α Skeptic's I-001-026 provenance-lock.
- R-004 → the directional audit→propose→gate shape and adversary/null-result reframing survive; the gate must be externalised (separate persona with no authorship memory, or a signal the proposer cannot author).
- R-005 → the correlation-free **reachability punch-list** (is every promised affordance present and reachable?) survives; it makes no human-perception claim.
- R-001 → source-level **state-existence audit + semantic-structure lint** survives (test first whether client/data-coupled components render to a stable transcript at all).
- R-002 → **evidence-typing + refuse-to-sum** survives cleanly; bind perceptual ADVANCE to a checkable mechanical proxy or force explicit abstention.
