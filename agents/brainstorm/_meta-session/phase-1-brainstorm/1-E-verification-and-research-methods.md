# 1-E — Verification & Research Methods (research)

**Task ID:** 1-E
**Scope:** Survey of AI/research-verification methods strong enough to be the convergence half of a brainstorm↔research loop. The loop's bottleneck is *not* the brainstorm half (Liang et al. 2024 shows LLMs are already good at novelty) — it is the verify/research half that filters for feasibility and prevents the loop from being a sycophantic rubber-stamp.
**Date of survey:** 2026-07-18

---

## Methods surveyed

Each entry: name + 1-sentence description · what kind of idea it can verify (factual / design / code / prediction / creative) · parallelizes? · known failure modes · cost (tool calls / tokens / time) · source.

### 1. ReAct — Reason+Act (Yao et al. 2022)
Interleave *Reasoning* traces and *Acting* (tool calls — web search, retrieval, code execution) so the model grounds each step in evidence from outside its own prior.
- **Can verify:** factual claims, design assumptions that decompose into lookup-able sub-questions, code (via execution), and predictions with measurable variables. Not useful for purely creative/aesthetic ideas.
- **Parallelizes?** Yes — multiple ReAct subagents run independently and report back; this is the canonical fan-out research primitive (Anthropic's multi-agent research system, June 2025, uses exactly this for breadth-first exploration).
- **Failure modes:** (a) search-rabbit-hole drift without a budget; (b) unconditional trust in tool output ("Wikipedia says X → accepts X") so tool-side errors propagate; (c) the agent invents a *plausible* tool result if the call fails silently; (d) cost compounds per step (each step ≈ 1 search + 1 LLM call).
- **Cost:** ~3–8 tool calls per sub-question × 1 LLM call per step; with 5-step budget typical research subagent ≈ 5 searches + 5 generations (~10–15k tokens out).
- **Source:** Yao et al., *ReAct: Synergizing Reasoning and Acting in Language Models*, ICLR 2023. https://arxiv.org/abs/2210.03629 · Anthropic, *How we built our multi-agent research system*, June 2025. https://www.anthropic.com/engineering/multi-agent-research-system

### 2. Reflexion (Shinn et al. 2023)
After a failed research trial, the agent writes a verbal self-reflection ("what went wrong, what to try instead") into an episodic memory buffer, then retries with that reflection in context — verbal RL without weight updates.
- **Can verify:** anything with an environment signal (code runs/doesn't, test passes/fails, search returns/doesn't). Useless for verification when the only signal is the agent's own opinion.
- **Parallelizes?** Across trials, **no** — trial N+1 depends on trial N's reflection (inherently sequential). Across subagents with shared memory, partially (different subagents can read the same reflection log).
- **Failure modes:** **Huang et al. ICLR 2024 ("LLMs Cannot Self-Correct Reasoning Yet", 1154 citations) shows that without external feedback, LLM self-correction *degrades* accuracy** — Reflexion needs a real env signal or it is theatre. Reflections also saturate the context window over many trials, and the agent can "learn the wrong lesson" from a misleading env signal.
- **Cost:** multiplies the per-trial cost by K (number of reflection rounds); ~K× the ReAct cost above.
- **Source:** Shinn et al., *Reflexion: Language Agents with Verbal Reinforcement Learning*, NeurIPS 2023. https://arxiv.org/abs/2303.11366 · Huang et al., *Large Language Models Cannot Self-Correct Reasoning Yet*, ICLR 2024. https://arxiv.org/abs/2310.01798

### 3. Chain-of-Verification — CoVe (Dhuliawala et al. 2023)
After drafting an initial response, the LLM (i) plans verification questions about its own claims, (ii) answers them independently (often via retrieval), (iii) cross-checks the original draft against the verification answers, and (iv) revises inconsistencies.
- **Can verify:** factual claims (the paper benchmarks Wikidata list QA, MultiSpanQA, longform generation). Extendable to design predictions that decompose into checkable sub-claims. Weak on creative ideas and on predictions with no ground truth.
- **Parallelizes?** Yes — the paper explicitly notes the verification queries are independent and can be parallelised across subagents. This is the natural fan-out shape.
- **Failure modes:** (a) the verification questions inherit the original draft's framing, so shared blind spots survive; (b) self-verification with the *same* model is the Huang-2024 trap — CoVe works best with an *external* verifier or retrieval; (c) OpenReview reviewers report CoVe "reduces hallucination, at a cost of slightly worse helpfulness" — i.e. it can over-correct and refuse valid claims; (d) no help when the *correct* answer is not in the retrieval corpus.
- **Cost:** ~1 draft + N verification queries + 1 cross-check + 1 revision ≈ (N+3) LLM calls; N typically 3–6, so ~6–9 calls per claim-set.
- **Source:** Dhuliawala et al., *Chain-of-Verification Reduces Hallucination in Large Language Models*, ACL Findings 2024. https://arxiv.org/abs/2309.11495 · OpenReview. https://openreview.net/forum?id=VP20ZB6DHL

### 4. Self-RAG (Asai et al. 2023)
Train the LLM to emit "reflection tokens" that decide *when* to retrieve, *what* to retrieve, and *whether* the retrieved passage actually supports the generation. Retrieval becomes self-gated and self-critiqued.
- **Can verify:** factual claims (paper benchmarks FactScore, PubMedQA, ALCE). Not a design/code/creative verifier unless the training distribution covers those.
- **Parallelizes?** Yes at the document level (multiple retrieved passages scored independently), no at the per-token reflection loop (sequential within one generation).
- **Failure modes:** (a) requires a *trained* reflection-token capability — off-the-shelf models don't have it, so prompt-only Self-RAG is a weaker approximation; (b) medium post & paper note "Self-RAG will introduce more overhead in terms of inference" — more tokens, more retrievals; (c) the self-critique is still the same model's prior, so it inherits that prior's confidence-miscalibration; (d) degrades on out-of-distribution retrieval (e.g. private code repos it wasn't trained against).
- **Cost:** ~1.5–2× inference tokens vs. vanilla RAG; ~2–3× retrievals per query because of the retrieve/critique/re-retrieve loop.
- **Source:** Asai et al., *Self-RAG: Learning to Retrieve, Generate, and Critique to Improve their Factuality*, ICLR 2024. https://arxiv.org/abs/2310.11511 · project. https://selfrag.github.io

### 5. Corrective RAG — CRAG (Yan et al. 2024)
A lightweight retrieval evaluator scores retrieved documents as *correct / ambiguous / incorrect*; on ambiguous/incorrect, CRAG falls back to web search and strips the low-confidence spans before generation.
- **Can verify:** factual claims with retrievable ground truth. Useful as a defensive layer *inside* the research subagent's retrieval tool, not as a standalone idea-verifier.
- **Parallelizes?** Yes — evaluator scoring is per-document and parallelisable; the corrective web-search fallback is sequential.
- **Failure modes:** (a) the retrieval evaluator is itself an LLM/scorer and inherits its biases; (b) the "correct / ambiguous / incorrect" threshold is hand-tuned and brittle across domains; (c) if the web-search fallback also returns garbage, CRAG has no further correction layer; (d) when ground truth simply isn't on the web (novel idea, private codebase), CRAG falls back to web search and *introduces* irrelevant noise.
- **Cost:** 1 retrieval + N evaluator calls + up to 1 web-search fallback + 1 generation ≈ vanilla RAG + ~30–50% overhead.
- **Source:** Yan et al., *Corrective Retrieval Augmented Generation*, ICML 2024. https://arxiv.org/abs/2401.15884 · code. https://github.com/HuskyInSalt/CRAG

### 6. Tree of Thoughts as verifier (Yao et al. 2023; SELT 2025 lineage)
Use ToT not to *generate* ideas but to *score* them: expand each idea into its consequences (look-ahead branches), have a self-evaluator score each branch, prune branches whose consequences are incoherent, ungrounded, or self-contradictory.
- **Can verify:** design ideas, predictions, reasoning chains. Less useful for purely factual claims (ReAct/CoVe are better) and useless for aesthetic creative judgements.
- **Parallelizes?** Yes — branches are independent and can be sampled concurrently; evaluation can be batched. (1-A already noted this.)
- **Failure modes:** (a) **the self-evaluator is the same model that proposed the thought, so it can't see its own blind spots** (1-A's caveat); (b) cost grows exponentially with depth, and the Princeton authors show diminishing returns past modest branching factors; (c) SELT-style MCTS variants compound the evaluator-bias problem — a wrong heuristic at the root propagates; (d) verifies *internal coherence*, not external truth.
- **Cost:** O(b^d) where b is branching factor, d is depth — even modest b=3, d=3 = 27 LLM calls per idea.
- **Source:** Yao et al., *Tree of Thoughts: Deliberate Problem Solving with Large Language Models*, NeurIPS 2023. https://arxiv.org/abs/2305.10601 · SELT (Self-Evaluation LLM Tree Search), 2025. https://arxiv.org/html/2510.09988v1

### 7. LLM-as-judge / LLM-as-evaluator (Zheng et al. NeurIPS 2023; bias literature 2024–2025)
Use a strong LLM to score/rank candidate outputs against a rubric. The workhorse automated evaluator for LLM systems since 2023.
- **Can verify:** almost any idea type *if* the rubric is well-specified — design feasibility, code quality, argument coherence, creative merit. The verifier-of-last-resort when no ground truth exists.
- **Parallelizes?** Yes — N judgements can be batched; pairwise comparisons across M ideas are O(M²) but each pair is independent.
- **Failure modes — **the most-caveated verifier in the literature**:**
  - **Position bias** (preferring first or last in pairwise comparison) — rigorously quantified in "A Systematic Study of Position Bias in LLM-as-a-Judge" (290 citations, IJCNLP 2025): mitigation is *position-swapping* (judge both orders, flag disagreement).
  - **Verbosity bias** — favouring longer responses regardless of quality (Zheng et al. NeurIPS 2023, MT-Bench).
  - **Self-preference / self-enhancement bias** — judges score outputs *they themselves generated* higher (Panickssery et al. 249 citations, ICLR 2025; Liu et al. 2024 "Justice or Prejudice?").
  - **Authority bias** — preferring claims that cite authoritative sources, even fabricated ones.
  - **Moderation bias** — converging to neutral middle-of-scale answers.
  - **Sycophancy** — judges converge to the answer they think the questioner wants (ties to 1-A's MAD-sycophancy finding).
  - Survey: "A survey on LLM-as-a-judge" (ScienceDirect 2026, 1714 citations) catalogs all five biases with mitigations.
- **Cost:** ~1 LLM call per judgement; ~M(M-1)/2 calls for full pairwise over M ideas. Cheap in $ but expensive in *bias-fragility*.
- **Source:** Zheng et al., *Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena*, NeurIPS 2023. https://neurips.cc/virtual/2023/poster/73434 · Position bias study, IJCNLP 2025. https://arxiv.org/html/2406.07791v7 · Self-preference bias, ICLR 2025. https://arxiv.org/html/2410.21819v1 · Survey. https://www.sciencedirect.com/science/article/pii/S2666675825004564

### 8. Multi-agent critic / debate-as-verification (Du et al. 2023; failure-mode literature 2024–2026)
Spawn K agents that each generate an answer, then take turns critiquing and revising in light of the others, over R rounds. The hope: peer pressure converges to truth.
- **Can verify:** factual reasoning, design tradeoffs, code reviews. *Not* creative taste (debate kills diversity — see 1-A).
- **Parallelizes?** Yes across agents within a round; rounds are sequential. K×R total turns.
- **Failure modes — **the most-damning verdict in the 2024–2026 literature**:**
  - **Smit et al. ICML 2024 ("Should We Be Going MAD?", 123 citations):** multi-agent debate "often fails to beat a single agent that just re-reads its own answer." Cost rises, quality does not.
  - **"Understanding Failure Modes in Multi-Agent Debate" (ICML 2025):** debate can *degrade* performance via **error propagation** (one agent's wrong claim gets picked up by others) and **sycophancy in heterogeneous groups**.
  - **"How Sycophancy Shapes Multi-Agent Debate" (Sep 2025):** LLMs' inherent sycophancy "collapses debates into premature consensus."
  - **"The Cost of Consensus: Isolated Self-Correction Prevails" (ACM 2026):** "multi-agent debate can paradoxically decrease accuracy over time as agents succumb to peer pressure."
  - **Reddit field report (r/artificial):** "When I made LLMs argue with each other, they started confidently fabricating. Most of the actual work is in the verification layer, not the debate."
  - **1-A's upshot:** naive "two agents argue" is fragile; if used at all, must be one round, two pre-assigned opposing personas, third-party judge with position-swap — which is exactly what personas #1+#2+orchestrator already provide without the debate failure modes.
- **Cost:** K×R LLM calls + 1 judge call. 4 agents × 3 rounds = 12 calls per idea — high cost, often negative ROI per Smit 2024.
- **Source:** Du et al., *Improving Factuality and Reasoning through Multiagent Debate*, ICML 2024. https://arxiv.org/abs/2305.14325 · Smit et al., *Should We Be Going MAD?*, ICML 2024. https://proceedings.mlr.press/v235/smit24a.html · ICML 2025 failure modes. https://arxiv.org/html/2509.05396v1 · Sycophancy in debate. https://arxiv.org/abs/2509.23055 · Cost of consensus. https://dl.acm.org/doi/10.1145/3786335.3813137

### 9. Constitutional AI / self-critique (Bai et al. 2022; Self-Refine Madaan et al. 2023)
The model critiques its own output against an explicit list of principles ("constitution") or rubric, then revises. Self-Refine is the prompt-time version; Constitutional AI is the training-time version.
- **Can verify:** rubric-checkable properties (helpfulness, harmlessness, format compliance, code-style). *Not* truth — the model is grading its own homework.
- **Parallelizes?** Self-Refine's critique-and-revise loop is sequential per artifact; parallelisable across artifacts.
- **Failure modes:** (a) **Huang et al. 2024 trap** — without external signal, self-critique *degrades* accuracy; (b) Self-Refine (5056 citations) catalogs 35 distinct failure cases including the model amplifying its initial error during revision; (c) principles rubrics drift toward "safety theatre" — over-refusing valid claims; (d) Anthropic's own CAI paper shows RL-from-AI-feedback can reward-hack the critic; (e) sycophantic to the constitution's *framing* — if the principle is poorly worded, critique converges on the wrong target.
- **Cost:** 1 critique + 1 revision per round × R rounds ≈ 2R calls per artifact. Cheap.
- **Source:** Bai et al., *Constitutional AI: Harmlessness from AI Feedback*, arXiv 2022. https://arxiv.org/abs/2212.08073 · Madaan et al., *Self-Refine: Iterative Refinement with Self-Feedback*, NeurIPS 2023. https://selfrefine.info · Huang et al., *LLMs Cannot Self-Correct Reasoning Yet*, ICLR 2024. https://arxiv.org/abs/2310.01798

### 10. Devil's advocate / red-team agent (IUI 2024; promptfoo/DeepTeam 2024–2026)
Assign one subagent the explicit role of *trying to break the idea* — find counterexamples, surface risks, attack assumptions. Distinct from "debate" because there's no back-and-forth: the DA writes a single critique report.
- **Can verify:** design ideas, code (security/correctness), business assumptions, predictions. Less useful for purely factual lookups (ReAct wins there).
- **Parallelizes?** Yes — one DA per idea, fully parallel; or one DA per *attack vector* per idea (cost/risk/tech/market) for finer-grained fan-out.
- **Failure modes:** (a) **the DA persona collapses into the same LLM prior** if the prompt is weak ("you are critical" alone ≈ no-op — 1-A's persona finding); (b) confirmation bias in reverse — the DA finds *any* flaw and over-weights it, killing good ideas; (c) **sycophancy inversion** — the DA agrees with the proposer anyway ("actually on reflection this is fine"); (d) red-team literature (Microsoft Foundry, promptfoo, DeepTeam) emphasizes that red-teaming without a *threat model* becomes a shotgun of low-value attacks; (e) IUI-24 finding: DA improves group decision quality *only* when the DA is bound by a concrete disagreement mandate, not just a label.
- **Cost:** 1 subagent × 1 critique report per idea ≈ 1 ReAct-equivalent research subagent. Cheap.
- **Source:** Wang & Yin, *Enhancing AI-Assisted Group Decision Making through LLM-Powered Devil's Advocate*, IUI 2024. https://mingyin.org/paper/IUI-24/devil.pdf · promptfoo red-team guide. https://www.promptfoo.dev/docs/red-team · DeepTeam. https://github.com/confident-ai/deepteam · Microsoft AI Red Teaming Agent. https://learn.microsoft.com/en-us/azure/foundry/concepts/ai-red-teaming-agent

### 11. Pre-mortem — prospective hindsight (Klein 2007)
"Assume this idea has shipped and failed catastrophically 6 months from now. Generate the *most likely* reason why." Prospective hindsight surfaces ~30% more risks than forward planning (Mitchell & Klein, cited in Klein 2007 HBR).
- **Can verify:** design ideas, project plans, predictions, code architecture. *Not* factual claims (no time dimension).
- **Parallelizes?** Yes — N independent pre-mortem subagents, each writing its own failure narrative, then aggregate. (1-B #6 made this non-optional at brainstorm→research handoff.)
- **Failure modes:** (a) hallucinates failure modes that aren't actually likely (generic "users didn't adopt it"); (b) consensus collapse — multiple DAs converge on the same top risk if they share context; mitigation is **strict context isolation** (1-C); (c) becomes a rubber-stamp if the prompt invites only plausible-sounding failures rather than specific, falsifiable failure modes; (d) Klein's own caveat: pre-mortem *finds* risks, doesn't *rank* them — needs a separate severity-scoring step.
- **Cost:** 1 subagent × 1 narrative per idea. Very cheap; ~1 LLM call.
- **Source:** Klein, *Performing a Project Premortem*, HBR Sept 2007. https://hbr.org/2007/09/performing-a-project-premortem · Mitchell et al. prospective hindsight study (cited therein).

### 12. Scientific-method scaffold — hypothesis → prediction → test → analyze (canonical; SciAgents MIT 2024)
Force the agent to express the idea as a *falsifiable hypothesis*, derive a *concrete prediction*, design the *smallest test* that could falsify it, run the test (tool/code/search), and analyze the residual.
- **Can verify:** predictions, design assumptions with measurable variables, code claims (via tests), causal claims. *Not* aesthetic or pure-novelty claims.
- **Parallelizes?** Yes across ideas (one scaffold per idea, parallel fan-out). No within an idea (the four steps are sequential — they are the scientific method).
- **Failure modes:** (a) the agent generates a *non-falsifiable* hypothesis and the scaffold can't catch it without a Popperian gate (see #14); (b) the "smallest test" is often not the *most informative* test — agents pick the test most likely to confirm; (c) SciAgents (MIT 2024, Buehler et al., 372 citations) shows multi-agent graph reasoning can autonomously generate+refine+critique hypotheses, but the verification step still needs an external signal (knowledge graph, code, or experiment); (d) "Autonomous Agents for Scientific Discovery" review (2026) notes the field's reproducibility crisis — agents report positive results that don't replicate.
- **Cost:** 1 hypothesis + 1 prediction + 1 test-design + 1 test-run + 1 analysis ≈ 5 LLM calls + 1 tool call per idea. Medium.
- **Source:** canonical (Popper / Kuhn / Feynman). · Buehler et al., *SciAgents: Automating Scientific Discovery through Multi-Agent Intelligent Graph Reasoning*, Advanced Materials 2025. https://advanced.onlinelibrary.wiley.com/doi/10.1002/adma.202413523 · *Autonomous Agents for Scientific Discovery*, arXiv 2026. https://arxiv.org/html/2510.09901v2

### 13. Falsificationist approach — Popper
The criterion of scientific status is **not** "can we find evidence for it?" but "what observation would prove it *wrong*, and have we tried to find that observation?" Verification is impossible; only disconfirmation is informative. Confirmation is cheap and biased.
- **Can verify:** claims that entail testable predictions. *Not* tautologies, unfalsifiable claims, pure taste.
- **Parallelizes?** Yes — N independent disconfirmation attempts per idea, parallel fan-out.
- **Failure modes:** (a) agents perform *mock* falsification — they describe a hypothetical disconfirming observation without actually seeking it; (b) Popper is a philosophy, not an algorithm — needs the scientific-method scaffold (#12) to operationalise; (c) over-applied to non-empirical claims (design taste, ethical values) where falsification is the wrong frame; (d) asymmetric cost: real falsification requires real tests (code runs, experiments, user studies), which is the budget-burner.
- **Cost:** low cost to *state* the falsifier; high cost to *execute* it. The execution cost is the point.
- **Source:** Popper, *The Logic of Scientific Discovery*, 1934/1959. https://en.wikipedia.org/wiki/Karl_Popper · IEP entry. https://iep.utm.edu/pop-sci · Falsifiability. https://en.wikipedia.org/wiki/Falsifiability

### 14. Steelmanning before critique
Reconstruct the opponent's argument in its *strongest possible form* before attacking it. The discipline of charity: if you can't state the steelman in words the proponent would endorse, you haven't understood it.
- **Can verify:** the *rigor* of a critique, not the truth of the original claim. Used as a pre-step to devil's-advocate (#10) to prevent strawman attacks.
- **Parallelizes?** Yes — but steelmanning must be done *before* critique in each subagent's pipeline; the order is sequential within a subagent.
- **Failure modes:** (a) **steelman-as-rubber-stamp** — the agent writes a flattering steelman and then agrees with it (sycophancy); (b) the steelman drifts toward the LLM's prior (the "strongest form" the LLM finds convincing is the form *it* finds convincing); (c) collapses into strawman if the prompt is lazy; (d) philosophical critiques (r/askphilosophy thread) note steelmanning can *strengthen* a bad idea by giving it more rigorous form than its proponents would — useful in adversarial collaboration but dangerous in a brainstorm filter.
- **Cost:** 1 extra LLM call per critique (steelman step). Cheap.
- **Source:** Steelmanning. https://themindcollection.com/steelmanning-how-to-discover-the-truth-by-helping-your-opponent · Grokipedia entry. https://grokipedia.com/page/the_steel_man · Philosophical pros/cons. https://www.reddit.com/r/askphilosophy/comments/12g2uet

### 15. Adversarial collaboration (Kahneman)
Two researchers with opposing views jointly design an experiment that *both* agree would adjudicate the dispute, run it, and pre-commit to publishing the result regardless of who was right. Kahneman's protocol for breaking deadlocked debates.
- **Can verify:** contested empirical claims, design tradeoffs where two schools disagree. *Not* ideas where no shared test is possible.
- **Parallelizes?** Partially — the *design* phase is sequential (negotiation), the *execution* phase can be parallel (run multiple agreed tests).
- **Failure modes:** (a) the protocol collapses if one side won't pre-commit to abide by the result (Kahneman's own experience with noise research — see "Reflections on adversarial collaboration," PMC 2025); (b) the two sides fail to agree on a falsifiable test — adversarial collaboration reveals the dispute is *not* empirical, only ideological; (c) Nature 2025 editorial notes adversarial collaborations advance science "but only if all sides can accept being wrong" — LLM agents lack the stake that makes humans accept loss; (d) "Theoretical adversarial collaboration: a template" (arXiv 2026) notes pure-theory disputes need a different protocol than empirical ones.
- **Cost:** high — multiple negotiation rounds + the actual experiment. ~5–15 LLM calls per dispute minimum.
- **Source:** Kahneman, *Adversarial Collaboration*, Edge lecture 2022. https://www.edge.org/adversarial-collaboration-daniel-kahneman · Adversarial Collaboration Project, UPenn. https://web.sas.upenn.edu/adcollabproject · Reflections (PMC 2025). https://pmc.ncbi.nlm.nih.gov/articles/PMC12748294 · Nature editorial. https://www.nature.com/articles/d41586-025-01379-3 · Theoretical template (arXiv 2026). https://arxiv.org/html/2607.16374v1

### 16. Assumption mapping + Riskiest-Assumption Test (RAT)
Decompose an idea into its underlying assumptions (desirability / viability / feasibility / usability), map them on an importance×uncertainty grid, identify the **single riskiest assumption**, and design the smallest experiment that could kill it. (Strategyzer / Laura Klein / Lean Startup lineage.)
- **Can verify:** design ideas, business models, product predictions, technical architecture. *Not* pure factual lookups.
- **Parallelizes?** Yes — each assumption can be tested by an independent subagent. RAT's insight is *sequential prioritisation* (test the riskiest *first*, then stop), so parallelism is across-assumption-within-the-riskiest-batch, not across all assumptions.
- **Failure modes:** (a) agents map obvious assumptions and miss the load-bearing one (the one that, if false, kills everything); (b) the "smallest test" is not the most informative — agents pick the test most likely to confirm (confirmation bias again); (c) assumes you can decompose the idea into discrete assumptions — for genuinely emergent/creative ideas the assumption graph is itself uncertain; (d) RAT is a *priority rule*, not a verifier — it tells you *what* to test, not *how* to test.
- **Cost:** 1 assumption-map + 1 RAT selection + K tests ≈ (K+2) calls per idea.
- **Source:** Strategyzer, *How Assumptions Mapping Can Focus Your Teams*. https://www.strategyzer.com/library/how-assumptions-mapping-can-focus-your-teams-on-running-experiments-that-matter · Riskiest Assumption Canvas. https://uxdesign.cc/riskiest-assumption-canvas-73ec0e2e0abc · Model Thinkers entry. https://modelthinkers.com/mental-model/riskiest-assumption-test

### 17. Build-Measure-Learn — Lean Startup loop (Ries 2011)
The smallest possible loop: build the thinnest viable test of the idea, measure the relevant signal, learn (kill/pivot/persevere). The unit of progress is *validated learning*, not shipped features.
- **Can verify:** ideas that can be operationalised as a runnable artefact (code PoC, mockup, smoke test). *Not* literature claims.
- **Parallelizes?** Yes across ideas (each idea gets its own BML loop). No within a loop (B→M→L is sequential by design).
- **Failure modes:** (a) "build" too much — agents build a full implementation when a smoke test would do (Strategyzer: "Don't Build When You Build-Measure-Learn"); (b) measure the wrong metric — vanity metrics that can't falsify the assumption; (c) "learn" degenerates into rationalisation — the agent always pivots to "persevere, the data was noisy"; (d) the loop never terminates — agents keep pivoting forever (mitigation: budget cap + kill criterion declared *before* the loop starts).
- **Cost:** 1 build + 1 measure + 1 learn verdict per cycle × C cycles. If build involves code execution, the build cost dominates.
- **Source:** Ries, *The Lean Startup*, 2011. https://theleanstartup.com/principles · Strategyzer, *Don't Build When You Build-Measure-Learn*. https://www.strategyzer.com/library/dont-build-when-you-build-measure-learn · Wikipedia. https://en.wikipedia.org/wiki/Lean_startup

### 18. Evidence types — what's admissible for "proof"?
For each claim, ask what *type* of evidence is admissible, and refuse to declare "proven" if only weaker types are available. Ranked by epistemic force:
  - **Empirical:** direct measurement (code run, benchmark, user study). Strongest.
  - **Theoretical:** derivation from established first principles (math proof, logical argument). Strong, but depends on the principles.
  - **Analogical:** "system X works this way, our system is structurally similar, therefore..." Admissible as a *hypothesis-generator*, never as proof. (Cambridge Design Science 2026: LLMs do analogical reasoning surprisingly well but analogies are evidence *for trying*, not evidence *of truth*.)
  - **Exemplar:** "a known system does this" — case-study evidence. One exemplar is anecdote; multiple exemplars with active contrast is a comparison.
  - **Counter-example:** a single concrete case where the claim is false *disproves* universal claims (mathematics' gold standard for disproof). Disconfirming power is high; confirming power is zero.
- **Can verify:** any claim, by *classifying* it and demanding the matching evidence type. The framework is a *gate*, not a verifier.
- **Parallelizes?** Yes — one subagent per evidence type per claim.
- **Failure modes:** (a) agents hallucinate exemplars (the citation-hallucination problem, #21); (b) agents treat analogical evidence as if it were empirical; (c) absence-of-evidence is treated as evidence-of-absence; (d) the typology is *advisory* — agents still have to actually go fetch the evidence.
- **Cost:** 1 classification call + 1 fetch per admissible type per claim.
- **Source:** Cambridge *Analogical Reasoning with LLMs*, Design Science 2026. https://www.cambridge.org/core/journals/design-science/article/analogical-reasoning-with-large-language-models/ · Counterexample (mathematics). https://en.wikipedia.org/wiki/Counterexample · Goel, *Design, Analogy, and Creativity*. https://static.aminer.org/pdf/PDF/000/874/767/design_analogy_and_creativity.pdf

### 19. Cite-as-you-go — every claim needs a URL or code ref (Exigo convention)
A *procedural* rule, not a method: every factual claim in a research output must carry either (a) a URL the verifier can re-fetch, or (b) a code/file reference the verifier can re-execute. Unsourced claims are *ipso facto* unverified and treated as "novel hypothesis" pending PoC.
- **Can verify:** factual claims (via URL), code claims (via ref). *Not* design taste or pure-novelty claims (those need a different admissibility rule — see #18).
- **Parallelizes?** Yes — citation-checking is per-claim and embarrassingly parallel.
- **Failure modes:** (a) **hallucinated citations** — the dominant failure mode (Nature 2025 analysis: "tens of thousands of publications from 2025 might include invalid references generated by AI"; arXiv tightened its policy to ban authors for a year for hallucinated references; MDPI 2026 study tested 9 LLMs and found systematic fabrication); (b) real URL but the cited source doesn't say what the agent claims it says (the *citation-support* problem); (c) URL rot / paywalls block the verifier's re-fetch; (d) citation goes to a secondary source that itself mis-cites the primary.
- **Cost:** ~1 URL-fetch per claim to verify (URL liveness + claim-support check). Cheap if URLs are honest, expensive if hallucination-rate is high (re-dispatch).
- **Source:** arXiv hallucinated-references policy. https://library.smu.edu.sg/topics-insights/arxiv-tightens-policy-hallucinated-references · MDPI *Evaluating the Integrity of LLM-Generated Citations* 2026. https://www.mdpi.com/2306-5729/11/5/122 · CheckIfExist (arXiv 2026). https://arxiv.org/html/2602.15871v1 · Nature 2025 analysis (cited in reddit summary). https://www.reddit.com/r/technology/comments/1sd0khs

### 20. FactScore / TruthfulQA / FACTEVAL — automated factuality scoring
Three reference benchmarks for *automated* factuality: **FactScore** (Min et al. EMNLP 2023, 1660 citations) decomposes a generation into atomic facts and scores the percentage supported by a trusted source; **TruthfulQA** (Lin et al. ACL 2022, 4274 citations) measures whether models imitate human falsehoods on 817 adversarial questions; **FACTEVAL** (NAACL 2025) measures fact-verification robustness under perturbations.
- **Can verify:** factual claims with a trusted atomic-fact source (FactScore), common-misconception questions (TruthfulQA), fact-verification robustness (FACTEVAL). *Not* design/code/creative.
- **Parallelizes?** Yes — atomic-fact scoring is per-claim and parallel.
- **Failure modes:** (a) FactScore depends on the *retriever* — if retrieval misses the supporting source, the atomic fact is scored unsupported even if true; (b) TruthfulQA's 817 questions are static and well-known → benchmark leakage; (c) all three measure factuality in narrow domains and don't transfer to novel claims; (d) FactScore's atomic-fact decomposition is itself an LLM call and inherits its biases; (e) the metric is *precision* (no unsupported claims), not *recall* (no missing claims) — an agent can score perfectly by saying nothing.
- **Cost:** FactScore ~1 atomic-decomposition + 1 retrieval + 1 entailment-check per atomic fact (~5–10 atomic facts per generation). Medium.
- **Source:** Min et al., *FActScore: Fine-grained Atomic Evaluation of Factual Precision*, EMNLP 2023. https://arxiv.org/abs/2305.14251 · Lin et al., *TruthfulQA*, ACL 2022. https://arxiv.org/abs/2109.07958 · FACTEVAL, NAACL 2025. https://aclanthology.org/2025.naacl-long.534.pdf · code. https://github.com/shmsw25/factscore

### 21. Scratchpad / show-your-work (Nye et al. 2021; Adnan 2024 engineering writeup)
Force the agent to write its intermediate reasoning to a *visible* scratchpad before producing its verdict. The scratchpad is the audit trail — the verifier (human or LLM) checks the steps, not just the conclusion.
- **Can verify:** reasoning chains, multi-step deductions, code (by reading the trace). *Not* a verifier in itself; it's a *verifiability enabler* — without a scratchpad you can't audit, with one you can.
- **Parallelizes?** Yes — scratchpads are per-subagent and parallel.
- **Failure modes:** (a) **scratchpad-as-theatre** — the agent writes a plausible-looking trace that doesn't actually determine its conclusion (post-hoc rationalisation; LessWrong 2025 "Do reasoning models use their scratchpad like we do?"); (b) *longer* scratchpads don't mean *better* verification — verbosity bias (cf. #7) inflates judge confidence; (c) the scratchpad leaks information across context-isolated subagents if it's not strictly scoped (1-C's context-isolation rule); (d) CoT-verification literature (arXiv 2510.09312, Oct 2025) shows that black-box CoT verification is *unreliable* — the trace can be correct while the answer is wrong, or vice versa.
- **Cost:** ~1.5–2× output tokens vs. direct answer. Cheap.
- **Source:** Nye et al., *Show Your Work: Scratchpads for Intermediate Computation with Language Models*, 2021. · Adnan, *Engineering Trustworthy LM Agents with Scratchpads and Verifiers*, 2024. https://medium.com/@adnanmasood/engineering-trustworthy-lm-agents-with-scratchpads-and-verifiers-5c1084533be7 · CoT verification (arXiv Oct 2025). https://arxiv.org/html/2510.09312v1 · LessWrong scratchpad analysis. https://www.lesswrong.com/posts/ywzLszRuGRDpabjCk

### 22. Toulmin model of argumentation
Decompose any argument into six components — **claim, grounds (evidence), warrant (the bridge from grounds to claim), backing (support for the warrant), qualifier (the claim's strength/scope), rebuttal (acknowledged exceptions)** — and verify each component independently. The Toulmin frame is the structural check that "the argument has a warrant, not just a claim and a Google hit."
- **Can verify:** any argument-structured idea — design rationale, code-design justifications, business cases, research hypotheses. *Not* raw factual lookups (those need ReAct/CoVe).
- **Parallelizes?** Yes — one Toulmin-decomposition subagent per idea, then each of the 6 components can be verified by an independent subagent.
- **Failure modes:** (a) the warrant is the hard part — agents fill in a plausible-sounding warrant that doesn't actually hold, and the verifier rubber-stamps it; (b) Toulmin decomposes *structure*, not *truth* — a structurally-complete argument can still be wrong; (c) agents omit the rebuttal step (it's optional in Toulmin), and omission correlates with overconfidence; (d) backing is conflated with grounds (the distinction is subtle and LLMs blur it).
- **Cost:** 1 decomposition + up to 6 component-verifications per idea ≈ 7 calls. Medium.
- **Source:** Toulmin, *The Uses of Argument*, 1958. · Purdue OWL. https://owl.purdue.edu/owl/general_writing/academic_writing/historical_perspectives_on_argumentation/toulmin_argument.html · Blinn writing center. https://www.blinn.edu/writing-centers/wide/toulmin-argument.html

### 23. Verification of *novel* ideas — when no literature answer exists
Not a single method but a *composite*: when an idea is genuinely novel (Liang et al. 2024 showed LLMs are *better* than human experts at novelty but *worse* at feasibility), the verifier cannot grep the literature. The admissible evidence types collapse to:
  - **Code PoC** (Build-Measure-Learn #17) — the strongest: a runnable artefact either exhibits the claimed property or doesn't.
  - **Formal proof / type-checking** — for code/math claims, formal verification (CoqPilot, "vericoding" Kleppmann 2025) gives the strongest possible evidence.
  - **Analogical reasoning** (#18) — "structurally similar system X exhibits the property, here is the structural mapping." Cambridge Design Science 2026 shows LLMs do this surprisingly well, but analogies are *hypothesis-generators*, not proof.
  - **Reduction to a known result** — "novel idea N reduces to known theorem K under transformation T," then prove T.
  - **Negative-result search** — "in the past 5 years, has anyone tried N and failed?" If yes, that's strong disconfirming evidence; if no, that's weak confirming evidence (absence of failure ≠ presence of success).
- **Can verify:** novel design, novel code architecture, novel research directions. *Not* novel factual claims about the world (those are empirical and need data).
- **Parallelizes?** Yes across the five evidence types.
- **Failure modes:** (a) agents *confabulate* a code PoC that doesn't actually run (1-D's "all-advance verdict is suspicious" rule catches this); (b) the analogical mapping is sloppy — surface similarity mistaken for structural similarity; (c) the "negative-result search" returns no failures because the search is shallow, not because no one failed; (d) Liang et al. 2024 finding — LLMs *over-rate* their own novel ideas' novelty (4.84 vs 5.64 vs humans on a 1–10 scale) and *under-rate* their feasibility, so the verifier needs to *down-weight* novelty self-reports and *up-weight* feasibility tests.
- **Cost:** high — code PoC alone is ~10–50 LLM calls + execution. This is the budget-burner of the research phase.
- **Source:** Liang et al., *Can LLMs Generate Novel Research Ideas?*, NeurIPS 2024. https://arxiv.org/html/2409.04109v1 · Cambridge analogical reasoning (Design Science 2026). https://www.cambridge.org/core/journals/design-science/article/analogical-reasoning-with-large-language-models/ · Kleppmann, *AI will make formal verification go mainstream*, 2025. https://martin.kleppmann.com/2025/12/08/ai-formal-verification.html · CoqPilot (arXiv 2024). https://arxiv.org/html/2410.19605v1 · Rethinking Verification for LLM Code (OpenReview 2025). https://openreview.net/forum?id=Gp2vgxWROE

### 24. Self-consistency as a verifier (Wang et al. 2022 — bonus)
Sample N independent reasoning traces for the *same* claim and check if the conclusions agree. High agreement → high confidence. Low agreement → flag for deeper verification.
- **Can verify:** single-correct-answer reasoning (math, factual QA, code correctness). *Not* design/creative (no majority to converge on).
- **Parallelizes?** Perfectly — N independent samples.
- **Failure modes:** (a) reinforces the model's *prior mode* rather than truth — sampling diversity is shallow (1-A's Deng & Brucks 2026 citation); (b) gives false confidence when the model is systematically wrong (unanimous wrong answers); (c) useless for genuinely generative tasks (1-A).
- **Cost:** N LLM calls per claim; N=5–10 typical.
- **Source:** Wang et al., *Self-Consistency Improves Chain of Thought Reasoning*, ICLR 2023. https://arxiv.org/abs/2203.11171

---

## Synthesis

### Minimum viable research/verify protocol for ONE idea

For one brainstormed idea, the research subagent runs a **5-step pipeline** — ordered, not parallelisable *within* the subagent but each step's internals may fan out:

1. **Toulmin-decompose** (method #22): write the idea as claim + grounds + warrant + backing + qualifier + rebuttal. If the warrant is missing or the rebuttal is omitted, mark the idea **structurally incomplete** and return it to the brainstorm pool (do not advance to step 2).
2. **Assumption-map + RAT** (#16): decompose into 5–10 assumptions, identify the single **riskiest** assumption (highest impact × highest uncertainty). This becomes the falsification target.
3. **State the falsifier** (#13, Popper): write the *single observation* that would disprove the idea. If no falsifier can be stated, the idea is non-empirical → return to brainstorm with the "unfalsifiable" tag (don't kill it, but don't advance it either — see "inconclusive" handling below).
4. **Run ReAct against the falsifier** (#1) with cite-as-you-go (#19) enforced: every retrieved claim carries a URL; every code claim carries a file ref. **Budget: 5 tool calls + 1 self-consistency check (#24, N=3) on the final verdict.** If the falsifier is *empirical* and code-runnable, also run a Build-Measure-Learn smoke test (#17). If it is *novel* (no literature), execute a code PoC (#23) as the primary evidence.
5. **Write a Toulmin-shaped dossier** (see "Verdict shape" below): verdict label + grounds-with-citations + steelmanned counter-argument + rebuttal + pre-mortem of "what if I'm wrong" + confidence qualifier.

Total: ~1 Toulmin + 1 RAT + 1 falsifier-statement + 5 ReAct steps + 3 self-consistency + 1 smoke-test + 1 dossier ≈ **~13 LLM calls + 5–8 tool calls per idea.** Bounded budget is the only thing that makes the loop tractable.

### How to "prove" a novel idea with no literature answer

There is no such thing as *proof* for a novel design idea — only **evidence of escalating force**. Rank admissible evidence from weakest to strongest:

1. **Analogical** (#18): "structurally similar system X exhibits property P." Useful as a *hypothesis-strengthener*, never sufficient alone.
2. **Exemplar** (#18): "known system Y already does this in domain D." A single exemplar is anecdote; ≥3 exemplars with active contrast is comparison evidence.
3. **Negative-result search** (#23): "no documented failure of approach A in past 5 years." Weak confirming evidence.
4. **Reasoning trace + Toulmin warrant** (#22): a coherent argument from established principles. Strong but depends on the principles' validity.
5. **Code PoC / smoke test** (#17, #23): a runnable artefact that exhibits the claimed property. **The default bar for "proven" in the exigo loop** — strong enough to ship a code change.
6. **Formal verification / type-checking** (#23): a machine-checked proof. The strongest evidence available to an AI agent. Reserve for high-stakes (correctness of algorithmic cores, security invariants).

The minimum bar for advancing a novel idea to the next brainstorm cycle as "proven" = **code PoC + 1 steelmanned counter-argument + 1 pre-mortem of the PoC's own blind spots**. Below that bar, the idea is "promising" or "inconclusive," not "proven."

### Verdict shape — binary vs dossier

**The verdict must be a dossier, not a binary.** A binary kill/advance verdict is precisely what enables sycophantic rubber-stamping — the judge looks at the idea, says "looks good," returns `advance`. A dossier forces the judge to *show its work* (method #21) and makes sycophancy detectable.

**Required dossier fields** (Toulmin-shaped, 1-D's "all-advance is suspicious" rule applied):

| Field | Purpose |
|---|---|
| `verdict` | one of `{advance, refine, kill, inconclusive}` — *four* states, not two, so the judge can't collapse to the easy yes |
| `confidence` | 0.0–1.0, with a *calibration check* (if all verdicts in a wave have confidence > 0.85, flag the wave for re-judging — sycophancy signal) |
| `claim` | the idea, restated in the judge's own words (catches misreading) |
| `grounds` | list of `{evidence_type, source_url_or_code_ref, summary}` — every entry must have a URL or code ref (#19); zero-length grounds ⇒ automatic `inconclusive` |
| `warrant` | the bridge from grounds to verdict, explicit (Toulmin #22) |
| `steelman_counter` | the strongest counter-argument, in the proponent's own words (#14) — required even on `advance` |
| `falsifier` | the observation that *would* disprove the verdict (#13) — required; empty falsifier ⇒ automatic `inconclusive` |
| `premortem` | "if the verdict is wrong 6 months from now, the most likely reason is…" (#11) |
| `rebuttal` | Toulmin rebuttal — acknowledged exceptions to the verdict (#22) |
| `cost_spent` | tool calls + tokens + wallclock actually used — for budget feedback into next cycle |

### Handling inconclusive verdicts in the loop

**Do not kill inconclusive ideas.** An inconclusive verdict usually means the idea is *too-ambitiously framed* or *under-specified*, not wrong. Three sub-cases, with three different feedback shapes:

1. **Inconclusive because no falsifier could be stated** → the idea is non-empirical. Feed back to brainstorm as a *constraint*: "the next brainstorm cycle should re-frame idea I₁₃ in empirical terms, OR find an empirical neighbour of I₁₃ that captures the same intent."
2. **Inconclusive because the falsifier exists but couldn't be tested within budget** → the idea is too ambitious for this cycle. Feed back as a *budget-constraint*: "idea I₁₃ requires K× the per-idea budget; either (a) promote to a dedicated deep-research cycle, or (b) decompose into smaller ideas I₁₃.a/b/c each testable within budget."
3. **Inconclusive because evidence split 50/50** → the idea is genuinely contested. Feed back as an *adversarial-collaboration seed* (#15): spawn two research subagents in the next cycle, one steelmanning each side, with a pre-agreed adjudication test. This is the only legitimate use of debate in the loop (and it's *adversarial collaboration*, not free-form MAD — see #8's failure modes).

The Orchestrator (per 1-C) translates inconclusive verdicts into *diversification constraints* for the next brainstorm cycle — NOT into context the brainstormers see directly (which would cause anchoring). This is the Delphi + Stepladder pattern from 1-B applied to the research→brainstorm handoff.

### Anti-sycophancy mechanisms

The research phase degenerates into a rubber-stamp when the judge LLM returns `advance` for everything because (a) it's the polite answer, (b) the proposer's framing is convincing, (c) no ground truth exists to push back against. Five structural defenses, in order of leverage:

1. **Make the verdict a 4-state dossier, not a binary** (above) — kills the easy-yes default and forces the judge to show work.
2. **Mandate a steelman counter-argument even on `advance`** (#14) — if the judge can't generate a plausible counter, the verdict is downgraded to `inconclusive`. The DA persona from 1-A (#2) is the structural version of this.
3. **Pre-declare the rubric + falsifier before the research runs** — the judge commits to its kill criteria *before* seeing the evidence, so it can't retcon the rubric to fit a convenient `advance`. This is the pre-registration pattern from clinical trials, ported to AI judges.
4. **Position-swap + verbosity-control for any LLM-as-judge call** (#7) — every pairwise judgement runs in both orders; if the two orders disagree, the verdict is `inconclusive`. Verbose outputs are *truncated* to the length of the shorter candidate before scoring.
5. **"All-advance is suspicious" rule** (from 1-D's cb-review extraction) — if a wave returns >70% `advance` verdicts, the Orchestrator re-dispatches one Devil's-Advocate research worker per advanced idea with the explicit mandate "find the falsifier that the previous research missed." This is the analog of cb-review's "empty CodeRabbit review is suspicious."
6. **Different judge model than proposer model where possible** (#7 self-preference bias) — the judge should not be the same LLM family that proposed the idea. Where this isn't possible (single-model shop), use a different *persona* with a different rubric, and report it in the dossier's `judge_provenance` field.
7. **Cite-as-you-go with re-fetch verification** (#19) — every URL in the dossier is re-fetched by a separate verifier subagent; mismatched support ⇒ hallucination flag ⇒ automatic `inconclusive` + re-dispatch.

### N research subagents on M ideas (mapping)

Given M ideas (post-shortlist, typically 3–7 per 1-C) and N research subagents:

- **N = M is the default** — one research subagent per idea, full Toulmin pipeline each. This is the Anthropic multi-agent research default (3–5 subagents) and matches 1-C's "shortlist size IS the right N."
- **N < M only when budget-constrained** — if the per-cycle token budget caps N below M, *do not* halve each subagent's budget to cover all M; instead **select the M' ≤ N highest-leverage ideas** (by RAT-ranked riskiest assumption, #16) and defer the rest to the next cycle with a `deferred` tag. Halving budgets destroys the dossier quality that makes the verdict trustworthy.
- **N > M only for genuinely novel or genuinely contested ideas** — spawn 2–3 redundant subagents per idea for:
  - **Novel ideas** (#23) where one subagent's code PoC might be a confabulation — second subagent independently re-derives the PoC; disagreement ⇒ `inconclusive`.
  - **Contested ideas** where evidence split 50/50 — adversarial-collaboration pair (one subagent per side) + 1 adjudicator.
  - **High-stakes ideas** (security, correctness of algorithmic cores) — redundant coverage with **different judge models** to break self-preference bias (#7).
- **Redundant coverage is never free-text-identical** — if two subagents run the same ReAct plan, they'll get the same answer (and the same bias). Redundant subagents must use **different search queries, different tool orderings, and ideally different model families**. This is the structural-diversification rule from 1-A/#1-C applied to the research phase.
- **The Orchestrator is the mandatory non-parallel Judge** (1-C's pattern, 1-D's invariant #4) — N research workers fan out, one Judge reduces. The Judge is the Minsky censor/suppressor layer; without it, N independent dossiers do not converge into a verdict set.

### Key insight for the loop design

The verification literature converges on a single uncomfortable finding: **every LLM-only verifier is a sycophant waiting to happen.** Huang 2024 (LLMs can't self-correct), the 2024–2026 multi-agent-debate failure literature (Smit 2024, ICML 2025, sycophancy-collapse 2025, Cost-of-Consensus 2026), the LLM-as-judge bias literature (position/verbosity/self-preference, three papers totalling 2000+ citations), and the hallucinated-citation literature (arXiv banning authors, Nature finding tens of thousands of affected papers) — all say the same thing: **an AI agent verifying its own claim without external signal is theatre.**

Therefore the brainstorm↔research loop's convergence half is *not* an LLM-verifier. It is a **Toulmin-shaped dossier pipeline that (a) forces external grounding via ReAct + cite-as-you-go, (b) forces falsifier-statement before evidence-gathering (Popper gate), (c) forces a steelman counter even on advance (anti-sycophancy), (d) uses a non-parallel Judge with position-swap and "all-advance is suspicious" re-dispatch, and (e) reserves code PoC + formal verification as the only admissible evidence for novel claims.** The dossier is the loop's currency — binary verdicts are not.

This connects to 1-D's autonomy pattern: cb-review's "empty CodeRabbit review is suspicious" becomes "all-advance research verdict is suspicious"; cb-review's strict A→B→C wave separation becomes strict brainstorm→research→judge wave separation with the Judge doing the cross-wave constraint extraction that 1-C identified as the Delphi/Stepladder pattern. The research phase is the load-bearing half of the loop, and it is *strictly more constrained* than the brainstorm half — every brainstorm-side freedom (high-temp sampling, persona play, lateral input) has a research-side structural defense (falsifier gate, steelman mandate, redundant multi-model coverage, cite-as-you-go with re-fetch).

---

## Sources

- ReAct: https://arxiv.org/abs/2210.03629 · https://react-lm.github.io
- Anthropic multi-agent research system: https://www.anthropic.com/engineering/multi-agent-research-system
- Reflexion: https://arxiv.org/abs/2303.11366 · https://github.com/noahshinn/reflexion
- Huang et al. (LLMs Cannot Self-Correct Reasoning Yet): https://arxiv.org/abs/2310.01798
- Chain-of-Verification (CoVe): https://arxiv.org/abs/2309.11495 · OpenReview: https://openreview.net/forum?id=VP20ZB6DHL
- Self-RAG: https://arxiv.org/abs/2310.11511 · https://selfrag.github.io · https://proceedings.iclr.cc/paper_files/paper/2024/file/25f7be9694d7b32d5cc670927b8091e1-Paper-Conference.pdf
- CRAG (Corrective RAG): https://arxiv.org/abs/2401.15884 · https://github.com/HuskyInSalt/CRAG
- Tree of Thoughts: https://arxiv.org/abs/2305.10601 · SELT: https://arxiv.org/html/2510.09988v1
- LLM-as-judge (Zheng, MT-Bench): https://neurips.cc/virtual/2023/poster/73434
- Position bias study (IJCNLP 2025): https://arxiv.org/html/2406.07791v7 · https://aclanthology.org/2025.ijcnlp-long.18.pdf
- Self-preference bias (Panickssery et al., ICLR 2025): https://arxiv.org/html/2410.21819v1 · https://openreview.net/forum?id=Ns8zGZ0lmM
- Justice or Prejudice? (Liu et al.): https://llm-judge-bias.github.io · https://aclanthology.org/2024.emnlp-main.474.pdf
- Survey on LLM-as-a-judge: https://www.sciencedirect.com/science/article/pii/S2666675825004564
- 5 Biases That Can Silently Kill LLM Evaluations: https://www.sebastiansigl.com/blog/llm-judge-biases-and-how-to-fix-them
- LLM-as-a-Judge in 2026: https://futureagi.com/blog/llm-as-a-judge
- Multi-Agent Debate (Du et al.): https://arxiv.org/abs/2305.14325 · https://composable-models.github.io/llm_debate
- Smit et al. (Should We Be Going MAD?): https://proceedings.mlr.press/v235/smit24a.html · https://arxiv.org/pdf/2311.17371
- ICML 2025 Failure Modes in MAD: https://arxiv.org/html/2509.05396v1
- How Sycophancy Shapes MAD: https://arxiv.org/abs/2509.23055
- Cost of Consensus (ACM 2026): https://dl.acm.org/doi/10.1145/3786335.3813137
- When and Why Does MAD Fail (OpenReview 2026): https://openreview.net/forum?id=haqIrUbgMG
- Debate or Vote (84 citations): https://openreview.net/forum?id=iUjGNJzrF1
- Constitutional AI: https://arxiv.org/abs/2212.08073
- Self-Refine: https://selfrefine.info · https://papers.nips.cc/paper_files/paper/2023/hash/91edff07232fb1b55a505a9e9f6c0ff3-Abstract-Conference.html
- Devil's Advocate (Wang & Yin, IUI 2024): https://mingyin.org/paper/IUI-24/devil.pdf
- DEBATE (Kim & Kim, DA-based eval): https://arxiv.org/html/2405.09935v1
- AI Red Teaming guide (promptfoo): https://www.promptfoo.dev/docs/red-team
- DeepTeam red-team framework: https://github.com/confident-ai/deepteam
- Microsoft AI Red Teaming Agent: https://learn.microsoft.com/en-us/azure/foundry/concepts/ai-red-teaming-agent
- 8 Red Teaming Strategies: https://galileo.ai/blog/llm-red-teaming-strategies
- Klein pre-mortem (HBR 2007): https://hbr.org/2007/09/performing-a-project-premortem
- Pre-mortem (nesslabs): https://nesslabs.com/pre-mortem-anticipating-failure-with-prospective-hindsight
- Pre-mortem 30% finding: https://get-alfred.ai/blog/pre-mortem-technique
- SciAgents (Buehler et al., Adv. Mat. 2025): https://advanced.onlinelibrary.wiley.com/doi/10.1002/adma.202413523 · code: https://github.com/lamm-mit/SciAgentsDiscovery
- Autonomous Agents for Scientific Discovery: https://arxiv.org/html/2510.09901v2
- Popper / Falsifiability (IEP): https://iep.utm.edu/pop-sci · https://en.wikipedia.org/wiki/Falsifiability
- Steelmanning: https://themindcollection.com/steelmanning-how-to-discover-the-truth-by-helping-your-opponent · https://grokipedia.com/page/the_steel_man
- Kahneman adversarial collaboration (Edge 2022): https://www.edge.org/adversarial-collaboration-daniel-kahneman
- Adversarial Collaboration Project (UPenn): https://web.sas.upenn.edu/adcollabproject
- Reflections on adversarial collaboration (PMC 2025): https://pmc.ncbi.nlm.nih.gov/articles/PMC12748294
- Nature editorial on adversarial collaboration (2025): https://www.nature.com/articles/d41586-025-01379-3
- Theoretical adversarial collaboration template (arXiv 2026): https://arxiv.org/html/2607.16374v1
- Wikipedia: adversarial collaboration: https://en.wikipedia.org/wiki/Adversarial_collaboration
- Strategyzer Assumptions Mapping: https://www.strategyzer.com/library/how-assumptions-mapping-can-focus-your-teams-on-running-experiments-that-matter
- Riskiest Assumption Canvas: https://uxdesign.cc/riskiest-assumption-canvas-73ec0e2e0abc
- Model Thinkers RAT entry: https://modelthinkers.com/mental-model/riskiest-assumption-test
- Lean Startup principles: https://theleanstartup.com/principles
- Strategyzer Don't Build When You Build-Measure-Learn: https://www.strategyzer.com/library/dont-build-when-you-build-measure-learn
- Wikipedia: lean startup: https://en.wikipedia.org/wiki/Lean_startup
- FActScore (Min et al. EMNLP 2023): https://arxiv.org/abs/2305.14251 · https://github.com/shmsw25/factscore
- TruthfulQA (Lin et al. ACL 2022): https://arxiv.org/abs/2109.07958 · https://github.com/sylinrl/truthfulqa
- FACTEVAL (NAACL 2025): https://aclanthology.org/2025.naacl-long.534.pdf
- Scratchpads & verifiers (Adnan 2024): https://medium.com/@adnanmasood/engineering-trustworthy-lm-agents-with-scratchpads-and-verifiers-5c1084533be7
- CoT verification (arXiv Oct 2025): https://arxiv.org/html/2510.09312v1
- LessWrong: do reasoning models use their scratchpad? https://www.lesswrong.com/posts/ywzLszRuGRDpabjCk
- Toulmin (Purdue OWL): https://owl.purdue.edu/owl/general_writing/academic_writing/historical_perspectives_on_argumentation/toulmin_argument.html
- Toulmin model overview: https://www.ciris.info/learningcenter/toulmins-model
- Liang et al. (LLMs Generate Novel Research Ideas, NeurIPS 2024): https://arxiv.org/html/2409.04109v1 · https://openreview.net/forum?id=M23dTGWCZy
- Analogical reasoning with LLMs (Cambridge Design Science 2026): https://www.cambridge.org/core/journals/design-science/article/analogical-reasoning-with-large-language-models/
- Counterexample (mathematics): https://en.wikipedia.org/wiki/Counterexample · Disproof by counterexample: https://studywell.com/proof/disproof-by-counterexample
- Kleppmann (AI formal verification, 2025): https://martin.kleppmann.com/2025/12/08/ai-formal-verification.html
- CoqPilot (arXiv 2024): https://arxiv.org/html/2410.19605v1
- Rethinking Verification for LLM Code (OpenReview 2025): https://openreview.net/forum?id=Gp2vgxWROE
- Formal verification of LLM code (arXiv 2025): https://arxiv.org/html/2507.13290v2
- arXiv hallucinated-references policy: https://library.smu.edu.sg/topics-insights/arxiv-tightens-policy-hallucinated-references
- Evaluating Integrity of LLM-Generated Citations (MDPI 2026): https://www.mdpi.com/2306-5729/11/5/122
- CheckIfExist (arXiv 2026): https://arxiv.org/html/2602.15871v1
- Self-Consistency (Wang et al. ICLR 2023): https://arxiv.org/abs/2203.11171
- Mullen 1991 nominal-group meta-analysis: https://psycnet.apa.org/record/1991-24145-001
- Cross-references to 1-A (AI brainstorming), 1-B (human brainstorming), 1-C (subagent coordination), 1-D (cb-review autonomy extraction) — see worklog.md
