# 2-B — Contradictions, Gaps, Pre-mortem

**Task ID:** 2-B
**Agent:** general-purpose (Phase 1 devil's advocate / pre-mortem)
**Date:** 2026-07-18
**Scope:** Find contradictions between Phase 1 files, surface gaps the brainstorm missed, expose unspoken assumptions, run a structured pre-mortem of the proposed loop, and answer seven load-bearing design questions. Read all five Phase 1 brainstorm files (`1-A`–`1-E`) and the 2-A claim verification. Complement the academic literature with practitioner / engineering sources Phase 1 under-cited.
**Method:** (a) Cross-comparison of the five Phase 1 brainstorm files + 2-A; (b) per-cycle token-cost arithmetic from first principles (Phase 1 never did this); (c) web search for practitioner sources on agent-loop cost runaway, mid-cycle checkpointing, context compaction, citation-hallucination detection, novelty archives, infinite-loop detection, multi-agent framework production failures.

---

## Contradictions between Phase 1 files

The five brainstorm files were run in parallel with only a thin cross-reference contract (the shared `worklog.md`). They mostly agree, but they also disagree in load-bearing places. Table below shows the contradictions that *matter* for the LOOP.md design — i.e. contradictions where Phase 2 cannot just pick one side without justification.

| # | Claim A | Claim B | Files | Why it matters / resolution |
|---|---|---|---|---|
| C1 | "Brainwriting 6-3-5 is the canonical divergence primitive" (ranked #1 in 1-B's synthesis, line 232). | "Pure nominal silent generation outperforms interactive groups of any kind, *including brainwriting*" (2-A's verification of Mullen 1991; 1-B itself acknowledges this at line 236 — "the empirical license to skip real-time interaction entirely"). | 1-B (synthesis) vs 1-B (own text) + 2-A | 1-B's synthesis inverts its own evidence. The CB-writeup of 1-B even ranks pure nominal #5 below brainwriting. **Resolution:** adopt 2-A's correction — D1 = pure nominal silent generation; brainwriting-style sheet-passing only for the cross-cycle re-stimulation handoff (D2 or cycle N+1). This is also Mullen 1991's strongest finding (1417 citations). |
| C2 | D2 diverge = "single-shot re-stimulation seeded with anonymised C1 aggregate" (1-B line 294–298; 1-D's adaptation: "D2 subagents prepare BEFORE seeing D1's raw ideas"). | "SIGDIAL 2025 finding: deeper interaction *enriches* diversity (not reduces)" — D2 should be a 2–3-round ideation-critique-revision loop (2-A's correction). | 1-B + 1-D vs 2-A | The "Stepladder = single-shot" reading of 1-B/1-D is in tension with the verified SIGDIAL 2025 evidence. **Resolution:** Stepladder = "prepare before seeing prior consensus" but does NOT forbid subsequent rounds; D2 = 2–3 rounds of ideation↔critique-revision with diverse critic personas. |
| C3 | "Subagents must NOT see the lead's full scratchpad" attributed to Anthropic (1-C line 25, 193, 231). | "Anthropic's actual claim is about *separate context windows for parallelism*, not explicit information-hiding from the orchestrator. The stronger isolation rule is a Phase 1 design choice" (2-A claim 7). | 1-C vs 2-A | Phase 1 over-attributed. The isolation rule still stands but should be justified by the human nominal-group literature (Mullen 1991) + LLM anchoring-bias research (arXiv:2505.15392), NOT by Anthropic. **Resolution:** LOOP.md citation corrected; rule unchanged. |
| C4 | "Deng & Brucks 2026 shows the diversity *gap widens at scale*" — cited as load-bearing justification for structural (persona × seed) rather than statistical diversification (1-A line 100, 236; 1-C line 61, 188; 1-D final paragraph). | "The paper uses N=99/N=83 and does not test or report a 'widens with N' effect. The mechanism predicts it but the paper does not measure it" (2-A claim 1). | 1-A + 1-C + 1-D vs 2-A | Phase 1 cited a non-finding as load-bearing. **Resolution:** keep the structural-diversification choice but re-anchor it on (a) DIPPER (diversity-in-prompts beats self-ensemble) and (b) the *knowledge-partitioning* mechanism in Deng/Brucks/Toubia 2026 — not on the unmeasured "widens-with-N" sub-claim. |
| C5 | "Multi-agent debate is excluded from the core mix because the 2024–2025 failure-mode literature is too damning; its benefits are subsumed by persona subagents + Devil's Advocate" (1-A line 190; 1-C line 254). | "Adversarial collaboration (Kahneman 2022) is the *only legitimate use of debate* in the loop" for contested ideas where evidence split 50/50 (1-E line 282). | 1-A + 1-C vs 1-E | 1-A/1-C say "never debate"; 1-E says "debate (as adversarial collaboration) for one specific case". The contradiction is small but real. **Resolution:** LOOP.md should adopt 1-E's narrow exception — adversarial collaboration (pre-registered adjudication test, two steelmanning subagents, one adjudicator) for contested ideas, never open-ended MAD. |
| C6 | "5 personas × 6 seeds = 30 max-N. Going beyond requires either more personas or more seeds." (1-C line 234, presented as fact). | "More than five [personas] tends to produce overlapping ideas — diminishing returns documented in the SIGDIAL 2025 multi-agent ideation study." (1-A line 211). But 2-A refuted the SIGDIAL 2025 reading — the paper actually finds deeper interaction *enriches* diversity. | 1-A vs 1-C vs 2-A | The 30 max-N is not grounded. 1-A's "diminishing returns" justification was the (now-refuted) SIGDIAL paraphrase. **Resolution:** the 5-persona × 6-seed count is a Phase 1 design *guess*, not an evidence-based limit. Phase 2 must either (a) cite different evidence for the cap or (b) explicitly mark it as a tunable parameter. |
| C7 | "The Judge/Orchestrator should be the *long-lived* agent (Village/Town-Hall pattern, #15) — it carries institutional memory across cycles" (1-C line 257). | "The Orchestrator is the mandatory non-parallel Judge... N research workers fan out, one Judge reduces." (1-E line 309) — singular Judge. The Village pattern (1-C #15) is "small fixed set of long-lived orchestrators". | 1-C vs 1-E | Are there one or several long-lived orchestrators? Phase 1 is silent. **Resolution:** the loop has ONE long-lived Judge/Orchestrator (per 1-E); the Village pattern's "elders" are collapsed into the single Judge + the dated-folder worklog (stigmergy). 1-C's "small fixed set" reading should be dropped. |
| C8 | "Pre-declare the rubric + falsifier before the research runs — the judge commits to its kill criteria *before* seeing the evidence" (1-E line 292). | "Judge uses anonymised/clustered outputs not raw drafts" (1-C line 232) + the Judge clusters + ranks after all drafts are in (1-C line 250). | 1-E vs 1-C | When does the Judge commit the rubric? Before seeing the shortlist (per 1-E) but the Judge also has to cluster + rank the shortlist (per 1-C). Phase 1 doesn't say whether the rubric is committed pre-shortlist or pre-research. **Resolution:** two-stage commit — Judge pre-declares the *rubric* before research workers run; Judge sees the *shortlist* only after research dossiers are in. This is closer to pre-registration in clinical trials (commit analysis plan before unblinding, not before patient recruitment). |
| C9 | "Different judge model than proposer model where possible" (1-E line 295, 308; anti-sycophancy mechanism #6). | The exigo loop runs on a single model (the `grok` CLI per 1-D); the LOOP.md preamble and the cb-review precedent both assume one-model operation. | 1-E vs 1-D (implicit) | The "different model" rule can't be applied in a single-model shop. 1-E's fallback ("use a different *persona* with a different rubric") doesn't actually break self-preference bias — the same model is still judging its own prior outputs. **Resolution:** Phase 2 must either (a) specify a second model for the Judge role (cost implication), (b) accept the self-preference risk and rely on the *other* six anti-sycophancy mechanisms, or (c) use a smaller / different-family model for the Judge (cheaper, partially breaks bias — MindStudio's "smart model + cheap sub-agents" pattern, see Sources). |
| C10 | cb-review's day-scope budget = 300k–350k tokens (1-D line 17, 102; reused verbatim for the brainstorming loop). | Per-cycle token cost from 1-E's own protocol = ~13 LLM calls + 5–8 tool calls per idea × 5 shortlisted ideas + D1/C1/D2/C2/Judge phases ≈ **700k+ tokens per cycle** (full arithmetic below). | 1-D vs 1-E | One cycle ≈ 2× the day-scope budget. Phase 1 never did this arithmetic. **Resolution:** the most important contradiction in Phase 1; see Gap G1 and the cost-ceiling answer below. |

---

## Coverage gaps

Phase 1 surveyed the academic literature thoroughly (148+ citations across 5 files) but did not address the following design questions that any production loop must answer. Ordered by load-bearing-ness.

**G1. Per-cycle token-cost arithmetic.** No Phase 1 file did the math. 1-E specifies "~13 LLM calls + 5–8 tool calls per idea" (line 242); 1-C specifies N=M=3–7 research subagents; 1-D specifies a 300k–350k token day-scope. Per-cycle token cost from 1-E's own protocol is ~700k+ (see answer to "Cost ceiling" below). Phase 1 did not detect that **one cycle blows the day-scope budget by ~2×**. This is the single most load-bearing gap.

**G2. Outer-loop termination.** cb-review has a natural endpoint (the day's audits are done; PRs merged; `state=complete`). Brainstorming has no natural endpoint — there are always more ideas. 1-D adapted stop-conditions for the *cycle* level ("a cycle is complete when shortlist converged, every idea has a verdict, constraints extracted") but said nothing about when the *outer loop* stops. Practitioner literature (MindStudio "Agent Loops Explained: Trigger, Action, Stop Condition"; arXiv:2607.01641 "When Agents Do Not Stop") treats missing stop conditions as the canonical infinite-loop failure mode.

**G3. Cross-cycle novelty archive / duplicate detection.** 1-A line 125 mentions "novelty bonuses, novelty archives" in the evolutionary-LLM section. 1-C line 253 mentions "constraint extraction for next cycle" as the *learning* step. But Phase 1 never specifies:
- What data structure stores prior-cycle ideas? (worklog only? embeddings DB? content hash?)
- How is "novelty" computed? (cosine similarity? exact-match? Toulmin-warrant overlap?)
- What's the dedup threshold? (too strict kills variation; too loose lets the same idea re-enter every cycle)
- Where does the archive live across dated `YYYY-MM-DD/` folders?
- FunSearch / AlphaEvolve use *island-based population models* with MAP-Elites-style quality-diversity archives (per DeepMind blog + AlphaEvolve papers) — Phase 1 cites these but doesn't adapt the mechanism.

**G4. Hallucinated-citation *detection*.** 1-E line 296 says "every URL in the dossier is re-fetched by a separate verifier subagent; mismatched support ⇒ hallucination flag ⇒ automatic `inconclusive` + re-dispatch." But re-fetch verifies the *URL exists*, not that the *URL says what the agent claims*. A research subagent can cite a real arXiv paper that does not contain the claim attributed to it. Phase 1 has no mechanism for this. Recent practitioner literature (CiteTracer, arXiv:2605.08583, May 2026) builds a *multi-agent* detector with a 12-code taxonomy (Real / Potential / Hallucinated citations), 97.1% accuracy on a 2,450-citation benchmark, validated against 957 real-world fabricated citations drawn from ICLR 2026 desk-reject queue. ICLR 2026 chairs flagged **600+ submissions** for fabricated references (per the CiteTracer paper) — this is not a small problem. Phase 1's "re-fetch" rule is insufficient.

**G5. Re-entrancy / mid-cycle checkpoint.** 1-D's stop-condition adaptation (line 91) says: "Stopping early (budget exhausted mid-verdict) leaves: `day-status.state=blocked`, `blocked_reason='budget_exhausted_mid_verdict'`, `RECORD.Stopped at = 'research verdict pending for idea {id}; re-dispatch one research worker with same assumption and react budget X'`." This is *between-cycle* resume. But what about *mid-phase* resume? If a D1 subagent crashed after generating 3 of 5 ideas, do we re-run from scratch? If a research subagent crashed mid-Toulmin-pipeline, where's its intermediate state stored? cb-review's cb-review precedent doesn't have this problem (its waves are short). The brainstorming loop's research phase (13 LLM calls per idea) is long enough that mid-phase crash is likely. Practitioner literature (Wayland Zhang "Mid-Turn Checkpointing in a Long-Running Agent Loop", April 2026) solves this with a phase-state-machine + checkpoint-worthy transitions — Phase 1 doesn't reference this work.

**G6. Long-lived orchestrator context compaction.** 1-C line 257 says the Judge/Orchestrator is "long-lived" and "carries institutional memory across cycles." 1-C line 154 (Smallville pattern) acknowledges "Long-lived agents' context grows over time (need compaction/reflection à la Smallville)" but does not spec it. The orchestrator must read the prior cycle's `synthesis/{cycle-id}.md`, the novelty archive, the constraint archive — across N cycles its context grows monotonically. Practitioner literature (Will Larson, "Building an internal agent: Context window compaction", Dec 2025; arXiv:2605.23296 "Parallel Context Compaction for Long-Horizon LLM Agent", 2026) treats compaction as a non-optional production discipline. Phase 1 says "need compaction" but doesn't spec the trigger, the prompt, or the abstraction (Larson's "virtual file" for large tool responses is a concrete pattern Phase 1 missed).

**G7. Human-visible output.** cb-review ships PRs (code mergeable into `main`) — the human's payoff is concrete and machine-checkable. The brainstorming loop's "ship" target is `synthesis/{cycle-id}.md` (1-D line 61) — a markdown doc with next-cycle constraints and a shortlist with verdicts. What does the human *do* with this? Read it? Pick an idea to pursue? Forward it to another agent? Phase 1 doesn't say. The launcher role (per 1-D's adaptation of cb-review) is preserved but the launcher's *job* changes from "trigger Wave A→B→C→ship" to "trigger a brainstorming cycle and receive... what?" Phase 1 implicitly assumes the human reads the synthesis doc, but this is a HITL violation under 1-D's rule #1 if the worker has to wait. The launcher is supposed to be thin (per cb-review §0.5) — but the launcher must do *something* with the synthesis doc.

**G8. User / launcher role for the brainstorming loop.** cb-review's launcher is the user (a developer who wants their code audited). The brainstorming loop's launcher is... the same user? Then the user's *job* is to (a) supply a problem statement, (b) trigger cycles, (c) consume synthesis docs. But (c) is unspecified — does the user *act* on the ideas? If yes, the user becomes a peer in the loop, which contradicts 1-D's "no HITL inside the worker" rule. If no, the loop produces ideas nobody uses, which is the academic "LLM ideas are novel but nobody builds them" failure mode (Si et al. ICLR 2025) at the system level. Phase 1 has no theory of the user's role.

**G9. Failure recovery when a research subagent returns garbage.** 1-E handles *inconclusive* verdicts (3 sub-cases, line 278–282) but not *garbage* — incoherent / off-topic / empty / non-dossier-shaped outputs. How does the Orchestrator detect that a research subagent went off the rails (e.g., wrote a 3000-word essay about a different idea because it mis-parsed the brief)? 1-E's "all-advance is suspicious" rule (line 294) catches sycophancy but not garbage. Practitioner literature treats this as a schema-validation problem (Larson's "virtual file" abstraction enforces shape) — Phase 1 doesn't.

**G10. Tool / web_search failure handling.** 1-A #4 (ReAct failure modes) flags "search-rabbit-hole drift without a budget" and "the agent invents a *plausible* tool result if the call fails silently". 1-E's protocol has a per-idea tool budget (5–8 calls) but no per-tool-call *failure* handling. If web_search returns empty (rate-limited, paywall, network blip), what does the research subagent do? Re-run? Mark `inconclusive`? Invent a result? Phase 1 doesn't say. The Infinite Agentic Loops paper (arXiv:2607.01641) shows that tool-failure→retry loops are a major IAL failure mode.

**G11. Constraint accumulation / monotonic narrowing.** 1-C line 216–223 says research verdicts feed back to the next cycle as *constraints* ("Do not generate ideas that depend on Assumption A", "Avoid the family of Idea X"). This is the Delphi + Stepladder pattern. But constraints accumulate monotonically — by cycle 5 the constraint set may be so restrictive that the only legal ideas are trivial or already-discovered. Phase 1 has no constraint-decay mechanism. Production evolutionary systems (FunSearch, AlphaEvolve) use *island-based* populations where each island has its own constraint set, periodically re-mixing — Phase 1 doesn't adapt this.

**G12. Budget for "all-advance is suspicious" re-dispatch.** 1-E line 294 + 1-D line 109 say: if >70% of verdicts are `advance`, re-dispatch one Devil's Advocate research worker per advanced idea. With a shortlist of 5 ideas, that's 5 additional research subagents (each ~70k tokens per G1) = ~350k tokens. This single re-dispatch doubles the per-cycle cost. Phase 1 didn't budget for it.

**G13. Ethical / safety / dual-use considerations.** Phase 1 doesn't discuss: what if the loop produces an idea whose implementation causes harm? What if a research subagent scrapes paywalled content? What if the loop's output is used to make decisions about people? These are not theoretical — the ICLR 2026 desk-reject queue (per CiteTracer) shows that LLM-generated citation fabrication is already an operational problem at venue scale.

---

## Unspoken assumptions

These are claims Phase 1 *implicitly* depends on but never states. Each is load-bearing; if any one is false, the loop fails differently than Phase 1 predicts.

| # | Assumption | Why it might not hold | Phase 1 evidence it's load-bearing |
|---|---|---|---|
| A1 | **Subagents are deterministic enough to compare.** The whole "all-advance is suspicious" + position-swap + self-consistency(N=3) edifice assumes that two subagents running the same prompt produce comparable outputs. | LLMs are stochastic; the same prompt at the same temperature produces different outputs. Deng & Brucks 2026 (cited in 1-A/1-C) actually shows LLM outputs *collapse* to a prior mode — so two "different" subagents may produce near-identical outputs that the Judge reads as "diverse". | 1-E's anti-sycophancy mechanisms #4 and #7 (position-swap, self-consistency); 1-C's clustering + ranking. |
| A2 | **The orchestrator has unlimited context.** 1-C says the orchestrator is "long-lived" and "carries institutional memory across cycles." But context is finite (1M tokens on the most generous models). 1-C line 154 admits "Long-lived agents' context grows over time" but treats compaction as a Smallville-style future problem. | Will Larson's article shows even 1M-token contexts run out in production; the compaction prompt is non-trivial; the "virtual file" abstraction is necessary. | 1-C's long-lived Judge/Orchestrator; 1-D's "carries institutional memory across cycles" via dated folders. |
| A3 | **LLM calls don't fail mid-wave.** Phase 1's wave separation assumes each subagent completes and writes its artifact. If 2 of 5 D1 subagents crash (rate-limit, network, bad tool result), the wave is incomplete and the Orchestrator's clustering step has only 3 outputs. | Production multi-agent systems routinely lose 5–10% of subagents to rate-limits / context-overflow / tool failures. Anthropic's own post (verified) mentions this. | 1-C's "Subagents write to the shared worklog (stigmergy) — each gets its own slot — and die"; 1-E's dossier contract assumes every shortlisted idea gets a dossier. |
| A4 | **The launcher can resume cleanly from `day-status.json` + `RECORD.md`.** cb-review's resume contract assumes the worker stopped at a clean phase boundary. The brainstorming loop's worker may stop mid-research-pipeline (13 LLM calls into one idea's dossier). | The "Stopped at" line in `RECORD.md` becomes meaningless if the worker stopped at LLM-call #7 of 13 — the launcher has to re-run from scratch (waste) or have a finer-grained checkpoint (not speced). | 1-D's invariant rule #3 + the "stopped mid-verdict" example (line 91). |
| A5 | **The Judge is honest about its own uncertainty.** 1-E's dossier has a `confidence` 0.0–1.0 field, and the "all-advance is suspicious" rule triggers if all confidences > 0.85. But the Judge is the same LLM that just produced the verdict — it can be uniformly over-confident (Panickssery ICLR 2025 self-preference bias). | The calibration literature on LLM self-confidence is damning — LLMs are systematically over-confident on novel / open-ended tasks (Si et al. ICLR 2025 verified by 2-A). | 1-E's `confidence` field, the "all-advance is suspicious" rule (line 294, 266). |
| A6 | **A "persona × seed" matrix produces structurally diverse outputs.** 1-A/1-C's whole diversity-pressure argument rests on this. But the same model with persona A (Dreamer) and persona B (Skeptic) may produce ideas that are *stylistically* different but *substantively* similar (same underlying assumption, different framing). | Deng & Brucks 2026 mechanism: LLMs aggregate knowledge into a unified distribution; personas perturb the surface, not the underlying mode. 2-A's correction confirms this. | 1-A's persona set, 1-C's "no two subagents share (persona, seed)" rule (line 192), 1-D's "disjoint persona × seed matrix" (line 55). |
| A7 | **The novelty archive is searchable across cycles.** 1-A mentions novelty archives (line 125) but doesn't say whether they're text-search, embedding-search, or hash-search. If embedding-search, which embedding model? If hash-search, what granularity? | If the archive is just markdown files in dated folders, the orchestrator has to re-read all prior synthesis docs every cycle — context bloat. If it's embeddings, the embedding model has its own biases (cosine similarity traps, per LinkedIn/Anir Sharma article). | 1-A's "novelty archive" mention; 1-C's "carries institutional memory across cycles". |
| A8 | **The 5-phase rhythm (D1→C1→D2→C2→vote) is the *minimum* viable, not the *maximum*.** 1-B's "minimum viable rhythm" (line 276) presents 5 phases as the smallest structure that works. But if per-cycle cost is ~700k tokens (per G1), the "minimum" rhythm is unaffordable; you'd need a *reduced* rhythm (e.g., D1→C1→vote, skip D2/C2) for cost-constrained cycles. | Production budget realities (per Waxell $47K incident, Augmentcode 43x cost multiplier). | 1-B's "minimum viable rhythm"; 1-E's ~13 LLM calls per idea. |
| A9 | **A " Devil's Advocate" persona actually disagrees.** 1-A persona #2, 1-B mandatory convergence step #5, 1-E anti-sycophancy mechanism #2 all rely on a DA subagent producing genuine disagreement. But Wang & Yin IUI 2024 (verified by 2-A) shows the DA *only* improves decisions when bound by a *concrete disagreement mandate*; an un-bound DA collapses to sycophantic agreement ("actually on reflection this is fine"). | Smit ICML 2024 + ICML 2025 failure modes + Yao Sep 2025 sycophancy literature (all verified by 2-A) — debate / critique without ground truth collapses to premature consensus. | 1-A persona #2, 1-B #5, 1-E #2. |
| A10 | **The "kill / refine / advance / inconclusive" 4-state dossier gives enough resolution.** 1-E line 265 says 4 states (not 2) kill the easy-yes default. But a research subagent's verdict on a complex design idea is rarely *one* of these — it's usually "advance the core, refine the implementation, kill the side-condition." Phase 1's single-verdict-per-idea rule loses this nuance. | Real research verdicts are multi-dimensional; 1-E itself acknowledges this in the dossier fields (`warrant`, `rebuttal`, `qualifier`). | 1-E's verdict shape; 1-D's "every surviving idea has a kill/refine/advance verdict". |
| A11 | **The orchestrator can read all prior cycle synthesis docs.** 1-D's adaptation preserves the "dated folder" pattern. After 20 cycles the orchestrator is reading 20 synthesis docs + 20 shortlists + 20 verdict sets + the constraint archive + the novelty archive. | cb-review's day-scope runs in 1 day; the brainstorming loop's outer loop runs over weeks/months. The accumulator is different. | 1-D's stop-condition adaptation; 1-C's stigmergy + long-lived orchestrator. |
| A12 | **The user actually wants the loop's output.** Phase 1 assumes the loop's purpose is to produce novel + feasible ideas. But the Si et al. ICLR 2025 finding (verified by 2-A) is that LLM ideas are *already* more novel than human-expert ideas — the bottleneck is feasibility. If the loop is producing ideas nobody uses (because the user can't act on them), the novelty is wasted. | The "novel but unused" problem is the academic version of the same issue. | 1-A's justification for the research phase; 1-D's adaptation of cb-review's autonomy pattern. |

---

## Pre-mortem (6 months out — what went wrong)

Imagine the loop shipped and 6 months later it produces garbage. The pre-mortem asks: what's the most likely root cause? Table below is the structured pre-mortem. The "Phase 1 missed it because" column is the meta-cause — *why didn't Phase 1 catch this?*

| # | Failure scenario (6 months out) | Most likely root cause | Phase 1 missed it because |
|---|---|---|---|
| F1 | Loop produces the same 10 ideas every cycle | No novelty archive spec (G3); cross-cycle diversity pressure is mentioned but not concretely designed. Constraint extraction (1-C) is monotonic — old constraints accumulate but no mechanism deletes obsolete ones. | 1-A mentions "novelty archives" in a one-line nod to FunSearch; 1-C says "constraint extraction" but doesn't say how to detect duplicates. Phase 1 treated the archive as a future implementation detail, not a load-bearing design decision. |
| F2 | Research phase rubber-stamps everything (all-advance every cycle) | "All-advance is suspicious" re-dispatch is *reactive* (post-hoc), not *proactive*. The structural-diversification rule (different judge model than proposer) can't be applied in a single-model shop (G5 + C9). The DA persona collapses to sycophantic agreement without a *concrete* disagreement mandate (A9). | 1-E acknowledges sycophancy in theory but relies on a "different model" fallback that doesn't apply to exigo's single-model setup. Phase 1 didn't pressure-test the anti-sycophancy stack against its own single-model constraint. |
| F3 | Token cost explodes mid-cycle | Nobody did the per-cycle token math (G1). One cycle ≈ 700k+ tokens vs 300k–350k day-scope budget = 2× over. The "all-advance is suspicious" re-dispatch alone can double the cost (G12). The Anthropic 15x multiplier (verified) compounds this. | Phase 1 treated cost as a per-idea budget (1-E: "~13 LLM calls per idea") rather than a per-cycle budget. 1-D reused cb-review's 300k–350k number without checking it scales to a brainstorming cycle. |
| F4 | Orchestrator's context fills up after 5 cycles | Long-lived orchestrator with no compaction spec (G6). The orchestrator reads prior cycle synthesis docs + shortlist + verdicts + constraint archive + novelty archive every cycle — by cycle 5, this is 50k+ tokens of "remembered context" alone. | 1-C mentions Smallville's memory stream as inspiration but doesn't adapt it. 1-D preserves cb-review's day-scope framing where context growth isn't an issue (worker is short-lived). Phase 1 didn't notice that the brainstorming loop's outer loop changes the long-lived-agent dynamics. |
| F5 | Subagents anchor on parent's brief | Even with "context isolation," the persona mandate itself leaks the orchestrator's framing. The Dreamer is told to dream → the Dreamer dreams. The persona assignment *is* a form of anchoring, and the seed stimulus is read in the same context as the problem statement. | 1-C's context-isolation rule hides the orchestrator's scratchpad but doesn't hide the *framing* (persona mandate + problem statement + seed). Phase 1 didn't distinguish "scratchpad leak" from "framing leak." Deng & Brucks 2026's mechanism (LLMs aggregate into a unified distribution) predicts framing leak even under perfect context isolation. |
| F6 | Loop never terminates | No outer-loop termination condition (G2). The "cycle complete" criterion (1-D line 91) only closes a cycle, not the loop. The user can always start another cycle. After 6 months, the loop has run 200 cycles and produced 1000 ideas — none of which the user has acted on. | 1-D adapted cb-review's stop-conditions for the cycle level but not the loop level. Phase 1 implicitly assumed "the user stops it when they're done" — but that's a HITL violation under 1-D's rule #1 if the worker has to wait. |
| F7 | Hallucinated citations slip through into synthesis docs | Re-fetch verifies URL existence, not URL content. A research subagent can cite a real arXiv paper that doesn't contain the attributed claim. Practitioner literature (CiteTracer arXiv:2605.08583) shows ICLR 2026 had 600+ submissions desk-rejected for fabricated references — this is operational, not theoretical. | 1-E's "cite-as-you-go with re-fetch verification" is URL-existence-only. Phase 1 didn't reference the citation-hallucination-detection literature (CiteTracer, MDPI 2026, CheckIfExist) even though some of these were in 1-E's source list. |
| F8 | Loop produces ideas the user doesn't want | No specification of the user's role / preferences (G8). The loop generates "novel + feasible" ideas but for whom? The Si et al. ICLR 2025 finding (LLMs already produce novel ideas) implies the loop is solving a problem the user may not have. | Phase 1 doesn't specify the user's input beyond the initial problem statement. The launcher role (per 1-D's cb-review adaptation) is preserved but the launcher's *job* changes from "trigger Wave A→B→C→ship" to "trigger brainstorming cycles and consume synthesis docs" — and "consume" is unspecified. |
| F9 | Research subagent returns garbage (incoherent / off-topic / non-dossier-shaped output) | No detection mechanism (G9). The Orchestrator's clustering step assumes all D1 outputs are valid idea-docs; the Judge's verdict step assumes all research dossiers are valid dossiers. A garbage research subagent poisons the verdict set. | 1-E handles *inconclusive* verdicts (3 sub-cases) but not *garbage* outputs. Phase 1 didn't distinguish "the subagent tried but couldn't decide" from "the subagent went off the rails." |
| F10 | Loop runs forever on a hard problem (every cycle = inconclusive) | "Inconclusive" verdicts feed back as constraints, but if every cycle is inconclusive, the loop never makes progress (G11 + A8). Constraints accumulate, narrowing the idea space, but no constraint-decay mechanism exists. | 1-E's inconclusive handling (line 278–282) assumes the *next* cycle will resolve it. Phase 1 didn't model the failure mode where N consecutive cycles are all inconclusive. |
| F11 | Cross-cycle novelty decays (cycle 20 ideas are all variations of cycle 1 ideas) | Constraint accumulation narrows the idea space (G11). The novelty archive is text-search-only (no embeddings) so it can't catch semantic duplicates. The 5-persona × 6-seed matrix produces structurally similar outputs (A6). | 1-A mentions FunSearch's "novelty archive" but doesn't spec it. 1-C's constraint-extraction is monotonic. Phase 1 treated cross-cycle diversity as a 1-C concern (coordination) rather than a 1-A concern (technique). |
| F12 | Subagent recursion explodes (research subagent spawns tool calls that spawn tool calls) | 1-D says "a research subagent MAY spawn a single `tool_call` but never a nested reasoning agent" — but tool-call fan-out can still explode cost. A web_search returning 10 results that each get fetched and parsed is 10 + 10 = 20 LLM calls, not 1. | 1-D's rule is honored in letter but tool-call fan-out is unbounded. Phase 1 didn't specify a per-tool-call budget distinct from the per-idea budget. |
| F13 | A research subagent fails to terminate (ReAct infinite loop) | 1-A mentions "search-rabbit-hole drift without a budget" as a ReAct failure mode but 1-E's budget is per-idea (call-count), not per-subagent (wall-clock + token-count). If the subagent loops, it loops until per-idea budget is exhausted — but the loop may have done 0 useful work. | 1-E's budget is LLM-call-count, not wall-clock or token-count. The Infinite Agentic Loops paper (arXiv:2607.01641, Jul 2026) found 68 confirmed IAL failures across 47 of 6,549 LLM agent repos — Phase 1 didn't cite this. |
| F14 | Loop produces only "safe" / lowest-common-denominator ideas | NGT vote + clustering + Devil's Advocate + pre-mortem + steelman + inconclusive-handling ALL push toward the consensus middle. The loop has *more* convergence pressure than divergence pressure. The "novel → feasible → relevant → diverse → honest" north-star (1-D line 79) is a tie-breaker, not a primary criterion. | Phase 1's anti-sycophancy mechanisms all push toward "kill" or "inconclusive" but none push toward "this idea is too boring." 1-D's north-star puts novelty #1 but the convergence mechanisms enforce feasibility, relevance, and honesty at novelty's expense. |
| F15 | Long-running loops forget early findings (cycle 30 has lost cycle 1's constraints) | The novelty archive is mentioned but no spec; the constraint archive is mentioned but no spec (G3). After 30 cycles, the orchestrator can't remember why cycle 1's Idea X was killed. | 1-A and 1-C both mention archives but neither specs them. Phase 1 treated the archive as "the worklog handles it" — but the worklog is per-cycle, not cross-cycle. |
| F16 | Cost runaway / $47k-style incident (Waxell) | No per-cycle *enforced* cost ceiling (only a 300k–350k *target* per day-scope). No detection of "this cycle is burning 2× the expected tokens." No mid-cycle kill switch if a wave goes long. | Phase 1 inherited cb-review's "300k–350k budget" without adding an *enforcement* mechanism. Practitioner literature (Waxell, Augmentcode, Unblocked) treats enforcement — not alerts — as the discipline that prevents runaway. Phase 1 has neither. |

---

## Answers to specific questions

### Termination — how should the loop terminate?

cb-review terminates per-day-scope (the day's audits are done). The brainstorming loop has no natural endpoint — there are always more ideas. Three layers of termination are needed:

1. **Cycle-level termination** (already in 1-D): a cycle is complete when shortlist converged, every idea has a verdict, next-cycle constraints are extracted. This is well-specified.
2. **Day-scope-level termination** (already in 1-D, per cb-review): the worker stops when budget exhausted or scope complete. The launcher re-wakes between day-scopes. This is well-specified.
3. **Outer-loop-level termination** (MISSING): when does the user stop triggering new cycles? Phase 1 is silent. Three options:
   - **(a) Goal-anchored**: the user supplies a "stop condition" at session start (e.g., "find 3 ideas worth implementing" or "exhaust the design space for problem X"). The loop terminates when the stop condition is met. Practitioner literature (MindStudio "Agent Loops Explained: Trigger, Action, Stop Condition") treats this as the canonical pattern.
   - **(b) Novelty-decay-anchored**: the loop terminates when cycle N's ideas have > X% semantic overlap with prior-cycle ideas (the novelty archive can compute this). This is the evolutionary-search termination pattern (FunSearch / AlphaEvolve use a fitness-plateau detector).
   - **(c) Budget-anchored**: the loop terminates after N cycles or N tokens. Crude but predictable.
   
   **Recommendation:** combine (a) and (b). The user supplies a stop condition at session start; the loop also self-terminates if novelty decays below a threshold for 3 consecutive cycles. (c) is a fallback. The IAL-Scan finding (68 confirmed infinite-loop failures across 47 of 6,549 LLM agent repos — arXiv:2607.01641) makes this non-optional.

### Cost ceiling — what's the analog of cb-review's 300k–350k?

Phase 1's per-cycle token arithmetic (computed from 1-E's own protocol):

| Phase | What happens | Tokens (rough) |
|---|---|---|
| D1 (diverge pulse 1) | 5 personas × (2k brief + 5k generation) | 35k |
| C1 (converge 1) | Orchestrator reads 25 ideas (25k) + clusters (10k) + Devil's Advocate (28k) + pre-mortem (28k) | 91k |
| D2 (diverge pulse 2) | 5 personas × (2k brief + 5k C1 aggregate + 5k generation) | 60k |
| C2 (converge 2) | Like C1 (91k) + 5-persona vote (55k) | 146k |
| Research (1-E protocol) | 5 shortlisted ideas × (~13 LLM calls × 3k + 6 tool calls × 5k) = 5 × ~64k | 320k |
| Judge verdict + dossier review | Orchestrator reads 5 dossiers (50k) + produces verdicts (15k) | 65k |
| Synthesis (next-cycle constraints) | Orchestrator writes synthesis doc | 10k |
| **TOTAL per cycle** | | **~727k** |

This is **~2.1× the 300k–350k day-scope budget** that 1-D's adaptation preserved verbatim. Even with aggressive cuts (skip D2, skip pre-mortem, shortlist of 3, minimal research protocol), one cycle is ~400–500k tokens — still over budget.

The "all-advance is suspicious" re-dispatch alone (5 extra DA research subagents × ~64k each) adds 320k — pushing a single cycle to **~1M tokens**, or ~3× the day-scope budget.

The Anthropic multiplier compounds this: their own research (verified) says multi-agent systems use ~15× the tokens of single-chat. Unblocked's analysis: SWE-bench agent runs vary 30× in tokens, full runs are ~1000× ordinary code chat; models self-predict their own cost at correlation 0.39 or lower (i.e., the agent CANNOT estimate its own spend).

**Recommendation:** Phase 2 must pick one of:
- **(a) Multi-day-scope cycles**: break the cb-review parity; allow one cycle to span 2–3 day-scope spawns. This requires mid-cycle checkpointing (G5).
- **(b) Reduced rhythm**: drop D2/C2 (single-pulse rhythm), reduce shortlist to 3, use a *reduced* research protocol (5 LLM calls + 2 tool calls per idea instead of 13 + 6). This sacrifices dossier quality (1-E's anti-sycophancy mechanisms weaken).
- **(c) Tiered budget**: define a "scout" cycle (D1+C1+vote, 3 ideas, minimal research, ~150k tokens) and a "deep" cycle (full rhythm, 5 ideas, full research, ~727k tokens). Alternate or trigger deep cycles on demand.
- **(d) Smart-orchestrator + cheap-workers**: orchestrator runs on the expensive model; D1/C1/D2/C2 workers run on a cheaper model. This breaks the "different model than proposer" anti-sycophancy rule (C9) but is the practitioner-default (MindStudio pattern, see Sources).

**The 300k–350k-per-cycle budget cannot hold under Phase 1's own protocol.** This is the single most important finding of this pre-mortem.

### Avoiding duplicate ideas across cycles — novelty archive?

Phase 1 mentions novelty archives (1-A line 125) but doesn't spec them. Three concrete options, ranked by feasibility for exigo:

1. **Embedding-based novelty archive** (recommended): maintain a vector DB (or jsonl of `{idea_id, persona, seed, problem_statement, idea_text, embedding, cycle_id, verdict}`) across cycles. New ideas get embedded; cosine similarity vs the archive computed before the idea is accepted into the shortlist. Threshold ~0.85 → flag as duplicate. Use a small embedding model (e.g., `text-embedding-3-small` or local Sentence-Transformer). Caveats: cosine similarity has known traps (LinkedIn / Anir Sharma article in Sources) — use min-hash or LSH as a secondary check.
2. **Toulmin-warrant hash**: hash the `warrant` field of each idea's Toulmin decomposition (per 1-E #22). Two ideas with the same warrant are duplicates even if surface text differs. Catches semantic duplicates that embeddings miss.
3. **FunSearch-style island-based population**: maintain K "islands," each with its own constraint set + persona subset. Periodically re-mix islands (crossover). This is the production evolutionary-search pattern (FunSearch, AlphaEvolve — per DeepMind blog + AlphaEvolve papers).

**Recommendation:** combine (1) and (2). Use embedding cosine similarity as the primary dedup, Toulmin-warrant hash as a secondary check. (3) is more ambitious — Phase 2 should consider it for v2.

### Hallucinated citations — how to detect?

Phase 1's "re-fetch verification" only checks URL existence. A research subagent can cite a real arXiv paper that doesn't contain the attributed claim. Recent practitioner literature solves this:

- **CiteTracer (arXiv:2605.08583, May 2026)**: multi-agent detector with 12-code taxonomy (Real / Potential / Hallucinated citations). 97.1% accuracy on 2,450-citation benchmark; 97.1% detection on 957 real-world fabricated citations from ICLR 2026 desk-reject queue. Uses (a) Reference Extractor → parses citations into field-level records; (b) Cascading Evidence Collector → cache lookup, URL fetch, scholar connectors, web search; (c) Field Matcher → deterministic field-level matching; (d) Class-Specialist Judgers → route ambiguous cases.
- **MDPI 2026 "Evaluating Integrity of LLM-Generated Citations"**: taxonomy + audit framework.
- **CheckIfExist (arXiv:2602.15871, 2026)**: existence-checking for cited works.

The ICLR 2026 desk-reject queue of 600+ submissions (per CiteTracer paper) shows this is operational, not theoretical.

**Recommendation:** Phase 2 should adapt CiteTracer's pipeline as the *mandatory* post-research verification step. Each dossier's `grounds` field gets re-checked: (a) URL exists (Phase 1's current rule), (b) URL content actually supports the claim (semantic match between dossier's `summary` and the cited source's abstract / first-page text). Failure of (b) → automatic `inconclusive` + the dossier is flagged for human review if the same subagent produces 2+ hallucinated citations in one cycle.

### Re-entrancy — can a stopped loop resume mid-cycle?

Phase 1's resume contract (1-D line 91) handles *between-cycle* resume ("research verdict pending for idea {id}; re-dispatch one research worker"). It does not handle *mid-phase* resume. If a D1 subagent crashed after generating 3 of 5 ideas, or a research subagent crashed mid-Toulmin-pipeline (LLM-call #7 of 13), the resume contract is silent.

Practitioner literature (Wayland Zhang "Mid-Turn Checkpointing in a Long-Running Agent Loop", April 2026) solves this with a *phase state machine*:
- Eight active phases (Setup, Done, ExecutingTools, RetryingLLM, Compacting, AwaitingApproval, AwaitingLLM, ForceStop) + one transient (InjectingMessage).
- Three checkpoint-worthy transitions (ExecutingTools→next, Compacting→AwaitingLLM, AwaitingLLM success/error→retry); explicitly *rejects* others (would thrash the session store).
- Phase asymmetry: only some phases count as "idle" for timeout purposes. The watchdog reads the phase and stops counting when the loop enters a non-idle phase.
- Key insight: "Tool calls have side effects. The crash at minute 9 doesn't undo any of it. Restarting the turn from scratch re-executes tools that already ran, usually with stale arguments."

**Recommendation:** Phase 2 must add a phase-state-machine to the day-scope worker. Concrete checkpoint-worthy transitions for the brainstorming loop:
- D1: checkpoint after each persona-subagent completes (5 checkpoints per D1).
- C1: checkpoint after clustering, after DA critique, after pre-mortem (3 checkpoints per C1).
- D2/C2: similar.
- Research: checkpoint after each LLM call within a research subagent (13 per idea, but only ~3–4 are "durable progress" — Toulmin-decompose done, RAT-selected, falsifier-stated, dossier-written). Per Zhang's rule, only durable-progress transitions are checkpoint-worthy; intra-LLM-stream checkpoints produce garbage.
- Synthesis: checkpoint after each constraint extracted.

This adds storage overhead (one checkpoint file per durable transition) but enables mid-cycle resume — which Phase 1 silently assumed was possible but didn't spec.

### Human-visible output — what does the loop ship?

cb-review ships PRs (code mergeable into `main`) — concrete and machine-checkable. The brainstorming loop's "ship" target (1-D line 61) is `synthesis/{cycle-id}.md` — a markdown doc with next-cycle constraints and a shortlist with verdicts. But what does the human *do* with this?

Three options:

1. **Decision package**: the synthesis doc is a decision package — the human reads it and picks 0–N ideas to pursue. This is a HITL step but it's *between cycles*, not *inside a cycle* (so it doesn't violate 1-D's rule #1). The launcher's job: read the synthesis doc, decide which ideas to advance (the loop's "advance" verdict is a recommendation, not a decision), then either (a) trigger another cycle or (b) close the loop.
2. **Idea archive**: the loop produces an idea archive over time. The human queries it ("what ideas did we have for X?"). The loop's "ship" target is the archive, not the per-cycle synthesis doc. The human's job: query the archive when needed.
3. **Research dossier**: each `advance`-verdicted idea ships with its full Toulmin-shaped dossier (per 1-E). The human reads the dossier and decides whether to implement. The loop's "ship" target is the dossier set, not the synthesis doc.

**Recommendation:** combine (1) and (3). The loop ships per-cycle synthesis doc + the dossiers for each `advance`-verdicted idea. The launcher's job is to read the synthesis doc between cycles and decide which `advance`-verdicted ideas to actually pursue. This is the cb-review analog: cb-review ships code; the brainstorming loop ships decision packages + research dossiers. The launcher remains thin (per cb-review §0.5) but its role is concrete: consume synthesis docs between cycles.

### User / launcher role — who is the user and what's their job?

cb-review's launcher is the user (a developer who wants their code audited). The brainstorming loop's launcher is... the same user? Then the user's job is to (a) supply a problem statement, (b) trigger cycles, (c) consume synthesis docs (per the answer above). But (c) is a HITL step that Phase 1 didn't model.

Three roles the user can play:

1. **Passive observer**: the user triggers the loop, walks away, comes back to a stack of synthesis docs. The loop runs autonomously for N cycles, produces a decision-package archive, and stops when novelty decays (per the termination answer). The user queries the archive when needed.
2. **Active curator**: the user reads each cycle's synthesis doc, picks ideas to advance, and the loop's next cycle is seeded with the user's picks. This is HITL but between cycles (not inside a cycle).
3. **Problem-statement supplier only**: the user supplies the problem statement at session start and never touches the loop again. The loop runs until termination, produces a final archive, and the user reads it. This is the most autonomous but the most likely to produce ideas the user doesn't want (F8).

**Recommendation:** the user plays role (2) — active curator, between cycles only. The launcher (per 1-D's cb-review adaptation) is the user-triggered thin session that triggers cycles and consumes synthesis docs. The user does NOT touch the worker (per 1-D's rule #1). The launcher's job is to (a) trigger cycles, (b) read synthesis docs, (c) decide whether to advance ideas or close the loop. This is a thin role but a real one — and it's the only way to close the F8 failure mode (loop produces ideas the user doesn't want).

The "no human in the loop" rule (1-D #1) applies to the *worker*, not the *launcher*. cb-review's launcher is also human-triggered and human-resumed; the brainstorming loop's launcher is the same. The launcher's HITL is *between cycles*, not *inside* a cycle — same as cb-review's "between day-scopes" HITL.

---

## 7 most important gaps Phase 2 must address

Ordered by load-bearing-ness. Each gap is a design question Phase 2 *must* answer before writing LOOP.md.

1. **Per-cycle cost ceiling + enforcement (G1, F3, F16).** Phase 1's own protocol blows the day-scope budget by ~2×. Phase 2 must (a) pick one of the four budget options above (multi-day-scope, reduced rhythm, tiered budget, smart-orchestrator-cheap-workers), (b) add an *enforced* per-cycle kill switch (not just an alert — Waxell's $47K incident shows alerts don't work), (c) budget for the "all-advance is suspicious" re-dispatch (G12). The Anthropic 15x multiplier (verified) makes this the single most load-bearing gap.

2. **Outer-loop termination condition (G2, F6).** Phase 1 has cycle-level and day-scope-level termination but no outer-loop-level. Phase 2 must pick one (or a combination) of: goal-anchored (user supplies stop condition at session start), novelty-decay-anchored (loop self-terminates when 3 consecutive cycles have > X% semantic overlap), or budget-anchored (N cycles or N tokens). The arXiv:2607.01641 IAL-Scan finding (68 confirmed infinite-loop failures across 47 of 6,549 LLM agent repos) makes this non-optional.

3. **Novelty archive + cross-cycle duplicate detection (G3, F1, F11, F15).** Phase 1 mentions "novelty archives" but doesn't spec them. Phase 2 must specify: data structure (vector DB + Toulmin-warrant hash), embedding model, dedup threshold, where the archive lives across dated folders. Without this, the loop produces the same 10 ideas every cycle (F1) and forgets early findings (F15).

4. **Hallucinated-citation *content* verification (G4, F7).** Phase 1's "re-fetch" checks URL existence, not URL content. Phase 2 must adapt CiteTracer (arXiv:2605.08583) or equivalent as the mandatory post-research verification step. Each dossier's `grounds` field gets re-checked: (a) URL exists, (b) URL content actually supports the claim. The ICLR 2026 desk-reject queue (600+ submissions) shows this is operational, not theoretical.

5. **Mid-cycle re-entrancy via phase-state-machine (G5, F13).** Phase 1's resume contract is between-cycle only. Phase 2 must add Wayland Zhang's phase-state-machine (8 phases + checkpoint-worthy transitions) so a crashed research subagent doesn't lose 7 of 13 LLM calls' worth of work. Tool side effects (per Zhang) can't be undone — naive retry double-charges the bill and re-runs side effects. The Infinite Agentic Loops paper (arXiv:2607.01641) shows mid-loop crash is a top failure mode.

6. **Long-lived orchestrator context compaction (G6, F4).** Phase 1 says the orchestrator is "long-lived" but doesn't spec compaction. Phase 2 must adopt Will Larson's pattern: 80% threshold triggers compaction, "virtual file" abstraction for large tool responses, compaction prompt adapted from Claude Code (per Larson). The orchestrator's context grows monotonically across cycles; without compaction it saturates by cycle 5.

7. **Single-model-shop anti-sycophancy fallback (C9, F2, A9).** Phase 1's "different judge model than proposer" rule (1-E #6) can't be applied in exigo's single-model setup. Phase 2 must specify (a) a second model for the Judge role (cost implication), OR (b) a cheaper / different-family model for the Judge (MindStudio smart-orchestrator-cheap-workers pattern), OR (c) explicit acceptance of the self-preference risk + reliance on the *other* six anti-sycophancy mechanisms (4-state dossier, mandated steelman, pre-declared rubric, position-swap, all-advance-suspicious, cite-as-you-go). Without this, F2 (rubber-stamping) is the most likely 6-month failure.

---

## Phase 1 recommendations that need to be qualified or backed off

These are Phase 1 recommendations that are *not wrong* but are *over-stated* or *under-constrained*. Phase 2 should qualify them.

1. **1-D's "Reuse the 300k–350k budget verbatim."** Backed off per Gap G1 + answer to cost ceiling. The budget doesn't fit Phase 1's own per-cycle protocol. Phase 2 must either reduce the per-cycle protocol or expand the budget.

2. **1-B's "Brainwriting 6-3-5 as the canonical divergence primitive" (#1 in synthesis).** Backed off per C1 + 2-A's verification of Mullen 1991. Pure nominal silent generation is the empirically strongest primitive; brainwriting is for cross-cycle re-stimulation only.

3. **1-A/1-C's "Deng & Brucks 2026 shows the diversity gap widens at scale."** Backed off per C4 + 2-A's verification. The paper doesn't measure this. Keep the structural-diversification choice but re-anchor on DIPPER + the knowledge-partitioning mechanism.

4. **1-A's "5 personas × 6 seeds = 30 max-N" (1-C line 234).** Backed off per C6. The 30 cap is a Phase 1 guess, not an evidence-based limit. Phase 2 should mark it as a tunable parameter and either find different evidence for the cap or drop it.

5. **1-E's "Different judge model than proposer where possible."** Backed off per C9 + Gap G7. This rule can't be applied in exigo's single-model shop. Phase 2 must specify the fallback (cheaper model / explicit acceptance / reliance on other mechanisms).

6. **1-D's "all-advance verdict is suspicious → re-dispatch one DA research worker per advanced idea."** Qualified per G12. This re-dispatch doubles the per-cycle cost. Phase 2 must either (a) budget for it explicitly, (b) cap the number of re-dispatches per cycle (e.g., 2 max), or (c) trigger it less aggressively (e.g., > 80% advance instead of > 70%).

7. **1-E's "~13 LLM calls + 5–8 tool calls per idea."** Backed off per Gap G1. This is the *full* Toulmin + RAT + ReAct + self-consistency + smoke-test + dossier protocol. Phase 2 must specify a *reduced* protocol (e.g., 6 LLM calls + 2 tool calls per idea) for cost-constrained cycles, and reserve the full protocol for genuinely novel or contested ideas.

8. **1-A's "Multi-agent debate excluded entirely."** Backed off per C5. 1-E's narrow exception (adversarial collaboration for contested ideas) is correct; Phase 2 should adopt it explicitly.

9. **1-D's "Stopped at = research verdict pending for idea {id}"** (between-cycle resume only).** Backed off per Gap G5. Mid-phase crash is likely; Phase 2 must add finer-grained checkpoints.

10. **1-C's "Subagents must NOT see the lead's full scratchpad" (attributed to Anthropic).** Backed off per C3. The rule still stands but should be justified by Mullen 1991 + LLM anchoring bias, not by Anthropic.

---

## Additional research needed before writing LOOP.md

Phase 1 + 2-A + this pre-mortem cover most of the design space, but three specific research tasks remain:

1. **CiteTracer-style citation-verification pipeline for the loop's research phase.** Read the CiteTracer paper in full (arXiv:2605.08583), evaluate its 12-code taxonomy, decide which codes are mandatory for the loop's dossiers. The ICLR 2026 desk-reject queue (600+ submissions) makes this operational. **Estimated effort:** 1 subagent, ~30 min, primary-source read + adaptation sketch.

2. **Compaction-prompt design for the long-lived orchestrator.** Read Will Larson's article + the Reddit-cited Claude Code compaction prompt in full. Design the orchestrator's compaction trigger (80% threshold?), the compaction prompt (what to keep, what to summarize, what to drop), and the "virtual file" abstraction for large tool responses. **Estimated effort:** 1 subagent, ~45 min, primary-source read + adaptation sketch.

3. **Phase-state-machine for the day-scope worker.** Read Wayland Zhang's mid-turn-checkpointing article in full. Map the 8 phases (Setup, Done, ExecutingTools, RetryingLLM, Compacting, AwaitingApproval, AwaitingLLM, ForceStop) to the brainstorming loop's phases (D1, C1, D2, C2, Judge, Research, Synthesis). Identify which transitions are checkpoint-worthy. Decide whether the watchdog logic (only `AwaitingLLM` and `ForceStop` count as idle) ports directly. **Estimated effort:** 1 subagent, ~45 min, primary-source read + adaptation sketch.

A fourth, optional research task:

4. **FunSearch / AlphaEvolve island-based population model for cross-cycle diversity.** Read DeepMind's FunSearch blog + AlphaEvolve paper. Decide whether the loop should adopt islands (K=5, max 25 ideas per island, periodic crossover) as the cross-cycle diversity mechanism. This is more ambitious than the embedding-based novelty archive (answer to G3) and may be a v2 feature. **Estimated effort:** 1 subagent, ~60 min, primary-source read + feasibility sketch.

No other significant research is needed. Phase 1 + 2-A + this pre-mortem + the four tasks above give Phase 2 enough to write LOOP.md.

---

## Sources

### Primary practitioner / engineering sources (new in 2-B)

- Waxell, *AI Agent Token Budget Enforcement: Why Alerts Fail and What Actually Works*, Apr 2026 — https://waxell.ai/blog/ai-agent-token-budget-enforcement (the $47k / 11-day / 4-agent LangChain incident; per-request vs per-loop cost math; observability vs enforcement distinction)
- Augment Code, *AI Agent Loop Token Costs: How to Constrain Context*, 2026 — https://www.augmentcode.com/guides/ai-agent-loop-token-cost-context-constraints (cost formula `Total_naive = N×S + u×N(N+1)/2 + r×N(N-1)/2`; 43.3× single-pass cost on a 10-step loop; "30,400 of 48,400 tokens came from tool results alone, 39.9–59.7% removable"; AGENTS.md increases inference cost 20%+)
- Unblocked (Pilarinos), *The Auto-Loop Tax: Why Self-Running AI Agents Burn More Tokens, Not Fewer*, Jun 2026 — https://getunblocked.com/blog/agent-auto-loop-token-cost (Anthropic's 15× multiplier verified; SWE-bench 30× variance, 1000× vs ordinary chat; models self-predict cost at r ≤ 0.39; Goldman 24× token-demand forecast; Epoch AI 9×–900× per-token price drop)
- Anthropic, *How we built our multi-agent research system*, Jun 2025 — https://www.anthropic.com/engineering/multi-agent-research-system (verified: orchestrator-worker pattern, subagents provide compression via separate context windows, multi-agent Opus+Sonnet outperformed single-agent Opus by 90.2% on internal research eval, three factors explained 95% of BrowseComp variance)
- Larson (Will), *Building an internal agent: Context window compaction*, Dec 2025 — https://lethain.com/agents-context-compaction (80% threshold triggers compaction; "virtual file" abstraction for tool responses > 10k tokens; Reddit-cited Claude Code compaction prompt; file_read + file_regex as base tools; "files as a core internal construct")
- Zhang (Wayland), *Mid-Turn Checkpointing in a Long-Running Agent Loop*, Apr 2026 — https://waylandz.com/blog/mid-turn-checkpointing (8-phase state machine; only 3 transitions are checkpoint-worthy; tool side effects can't be undone; "throwing away in-memory state is paying the bill twice"; phase asymmetry — only `AwaitingLLM` and `ForceStop` count as idle)
- Li, Lin & Ma, *Source or It Didn't Happen: A Multi-Agent Framework for Citation Hallucination Detection* (CiteTracer), arXiv:2605.08583, May 2026 — https://arxiv.org/html/2605.08583v1 (12-code taxonomy Real/Potential/Hallucinated; 97.1% accuracy on 2,450-citation benchmark; 97.1% detection on 957 real-world fabricated citations from ICLR 2026; ICLR 2026 desk-reject queue 600+ submissions for fabricated references)
- Hou, Wang, Zhao & Wang, *When Agents Do Not Stop: Uncovering Infinite Agentic Loops in LLM Agents*, arXiv:2607.01641, Jul 2026 — https://arxiv.org/abs/2607.01641 (IAL-Scan static analysis; 68 confirmed IAL failures across 47 of 6,549 LLM agent repos; 91.9% precision; "agents may repeatedly execute model calls, tools, workflow transitions, or agent handoffs when the feedback path is not effectively bounded")
- MindStudio, *Smart Orchestrator Model to Direct Cheaper Sub-Agent Models*, May 2026 — https://www.mindstudio.ai/blog/smart-orchestrator-cheaper-sub-agent-models-claude-code (the production-default cost-reduction pattern; orchestrator on expensive model, workers on cheap model)
- MindStudio, *Agent Loops Explained: Trigger, Action, and Stop Condition*, 2026 — https://www.mindstudio.ai/blog/agent-loops-explained-trigger-action-stop-condition (trigger-action-stop-condition framework; treats missing stop conditions as canonical infinite-loop failure mode)
- DeepMind, *FunSearch: Making new discoveries in mathematical sciences*, Dec 2023 — https://deepmind.google/blog/funsearch-making-new-discoveries-in-mathematical-science/ (island-based population model; MAP-Elites-style quality-diversity archive)
- Emergent Mind, *FunSearch Algorithm: LLM-Guided Evolutionary Search*, Jan 2026 — https://www.emergentmind.com/topics/funsearch-algorithm (FunSearch + AlphaEvolve overview; "up to 25 algorithms across five islands by default; candidate selection balances exploitation and exploration")
- arXiv:2605.23296, *Parallel Context Compaction for Long-Horizon LLM Agent*, 2026 — https://arxiv.org/html/2605.23296v1 (parallel compaction strategy; complements Larson's serial approach)

### Cross-references from Phase 1 (re-cited for convenience)

- Anthropic, *Effective context engineering for AI agents*, Sep 2025 — https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents (verified by 2-A; separate-context-windows rule for parallelism — *not* the stronger "subagents must not see orchestrator's scratchpad" rule Phase 1 over-attributed)
- Mullen, Johnson & Salas 1991 — https://psycnet.apa.org/record/1991-24145-001 (nominal groups outperform interactive groups including brainwriting — 2-A's correction to 1-B's synthesis)
- Deng, Brucks & Toubia 2026 — https://arxiv.org/abs/2602.20408 (knowledge-partitioning mechanism; ordinary personas outperform celebrity personas; CoT prompting reduces LLM fixation — 2-A's correction to 1-A's "gap widens at scale" over-reading)
- Panickssery et al. ICLR 2025, self-preference bias — https://arxiv.org/html/2410.21819v1 (the single-model-shop anti-sycophancy problem)
- Si, Yang & Hashimoto ICLR 2025 — https://arxiv.org/abs/2409.04109 (the "novelty gap is slight, not dramatic" correction from 2-A; LLMs are poor at ranking their own ideas — justifies the research phase but warns against overselling the feasibility gap)
- All other Phase 1 sources (1-A through 1-E + 2-A) — see respective files

### Sources searched but not load-bearing for 2-B

- CrewAI community, *Does hierarchical process even work?* — https://community.crewai.com/t/does-hierarchical-process-even-work-your-experience-is-highly-appreciated/2690 (production-brittleness anecdote; 1-C already cites this)
- LangGraph issue #5860 "not truly parallel" — https://github.com/langchain-ai/langgraph/issues/5860 (production-fan-out-bug anecdote)
- LangGraph issue #3617 "parallel execution doesn't seem to work" — https://github.com/langchain-ai/langgraph/issues/3617 (same)
- OpenAI Codex issue #9912 "Configurable Maximum Agent Recursion Depth" — https://github.com/openai/codex/issues/9912 (recursion-depth-cap discussion; 1-C already cites this)
- OpenAI Codex issue #19831 "stuck in a thinking loop, drained all" — https://github.com/openai/codex/issues/19831 (production infinite-loop incident)
- Reddit r/AI_Agents, *The "Infinite Loop" fear is real* — https://www.reddit.com/r/AI_Agents/comments/1qnavt9/the_infinite_loop_fear_is_re (practitioner consensus that IALs are common)
- arXiv:2510.27313, *LLM generation novelty through the lens of semantic* — https://arxiv.org/html/2510.27313v2 (semantic-novelty measurement; relevant to novelty-archive spec)
- LinkedIn (Anir Sharma), *Cosine Similarity Limitations in Text Embeddings* — https://www.linkedin.com/posts/anirshar_embedding-similarity-traps-cosine-isnt-a (cosine-similarity traps; why the novelty archive should use min-hash / LSH as secondary check)
