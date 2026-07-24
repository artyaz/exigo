# 1-A — AI Brainstorming Methods (research)

**Task ID:** 1-A
**Scope:** Survey of AI/LLM-side brainstorming techniques, with focus on what works when an orchestrator spawns many subagents that alternate brainstorm ↔ research.
**Date of survey:** 2026-07-18

---

## Techniques surveyed

Each entry: name + 1-sentence description · strengths (divergence / convergence / critique / novelty) · parallelizes? · includes verification? · when it fails · source.

### 1. Self-Consistency (Wang et al. 2022)
Sample N independent chain-of-thought traces from the same prompt at high temperature, then majority-vote the final answer.
- **Strengths:** Pure convergence. Excellent at single-correct-answer reasoning (math, factual QA). Reduces variance of greedy decoding.
- **Parallelizes?** Perfectly — N independent samples, embarrassingly parallel.
- **Includes verification?** No external verification; the "vote" is the only check, and it assumes a single correct answer exists.
- **When it fails:** Useless for genuinely generative tasks where there is no majority to converge on. Tends to reinforce the model's prior mode rather than explore it — sampling diversity is shallow (see #11 below). Not a brainstorming technique despite surface resemblance.
- **Source:** Wang et al., *Self-Consistency Improves Chain of Thought Reasoning in Language Models*, ICLR 2023. https://arxiv.org/abs/2203.11171

### 2. Tree of Thoughts — ToT (Yao et al. 2023)
Treat intermediate reasoning steps as nodes in a search tree; the model generates multiple candidate next-steps, self-evaluates each, and runs BFS/DFS with backtracking.
- **Strengths:** Divergence (branching) + convergence (pruning) + critique (self-evaluation), all in one loop. Explicit look-ahead and backtracking.
- **Parallelizes?** Yes — branches are independent and can be sampled concurrently; evaluation can also be batched.
- **Includes verification?** Partial — the self-evaluator scores branches but doesn't consult external evidence. Combine with ReAct (§4) for true verification.
- **When it fails:** Self-evaluation is the bottleneck: the same model that proposed the thought judges it, so it can't see its own blind spots. Cost grows exponentially with depth. The Princeton authors show diminishing returns past modest branching factors.
- **Source:** Yao et al., *Tree of Thoughts: Deliberate Problem Solving with Large Language Models*, NeurIPS 2023. https://arxiv.org/abs/2305.10601 · code https://github.com/princeton-nlp/tree-of-thought-llm

### 3. Graph of Thoughts — GoT (Besta et al. 2023)
Generalizes ToT to a graph: thoughts can be merged, refined, and looped back, not just expanded as a tree.
- **Strengths:** Same as ToT plus the ability to *combine* partial solutions — important for synthesis-style brainstorming where the best idea is a recombination of two mediocre ones.
- **Parallelizes?** Yes — graph nodes can be evaluated in parallel; aggregation is the synchronization point.
- **Includes verification?** Same as ToT — internal scoring only.
- **When it fails:** Same self-evaluator problem as ToT, plus the aggregation topology adds engineering complexity with marginal gains unless the task genuinely benefits from merging (e.g. multi-source synthesis). Besta's own "Demystifying Chains, Trees, and Graphs of Thoughts" survey (2024) shows GoT's advantage is concentrated on merge-friendly tasks.
- **Source:** Besta et al., *Graph of Thoughts: Solving Elaborate Problems with Large Language Models*, AAAI 2024. https://arxiv.org/abs/2308.09687 · survey https://htor.inf.ethz.ch/publications/img/besta-topologies.pdf

### 4. ReAct (Yao et al. 2022)
Interleave *Reasoning* traces and *Acting* (tool calls: search, retrieval, code execution) so the model grounds each step in evidence.
- **Strengths:** This is the canonical **research/verification** primitive. Without it, brainstorming stays in the model's prior. Adds external truth to the loop.
- **Parallelizes?** Yes — multiple ReAct subagents can run independently and report back.
- **Includes verification?** By construction — the whole point is to call tools that verify.
- **When it fails:** Tool calls have latency/cost that compounds per step. Agents drift into "search rabbit holes" without a budget. Also, the model trusts whatever the tool returns (Wikipedia says X → accepts X), so it doesn't catch tool-side errors.
- **Source:** Yao et al., *ReAct: Synergizing Reasoning and Acting in Language Models*, ICLR 2023. https://arxiv.org/abs/2210.03629 · site https://react-lm.github.io

### 5. Reflexion (Shinn et al. 2023)
After a failed trial, the agent writes a verbal self-reflection ("what went wrong, what to try instead") into an episodic memory buffer, then retries with that reflection in context.
- **Strengths:** This is the **loop-closure** primitive. Turns a single trial into a multi-trial learning process without weight updates. Pairs naturally with ReAct.
- **Parallelizes?** Across trials, no (it's sequential by design — trial N+1 depends on trial N's reflection). Across subagents with shared memory, partially.
- **Includes verification?** Depends on the env signal: if the env returns success/failure, yes; if it's pure self-critique, no.
- **When it fails:** Self-reflections accumulate and eventually saturate the context window. The agent can also "learn the wrong lesson" from a misleading env signal. Huang et al. (2023, "Large Language Models Cannot Self-Correct Reasoning Yet") showed that without external feedback, LLM self-correction often *degrades* performance — Reflexion needs a real env signal to be more than theatre.
- **Source:** Shinn et al., *Reflexion: Language Agents with Verbal Reinforcement Learning*, NeurIPS 2023. https://arxiv.org/abs/2303.11366 · code https://github.com/noahshinn/reflexion

### 6. Multi-Agent Debate — MAD (Du et al. 2023)
Multiple LLM instances each generate an answer, then take turns critiquing and revising in light of the others' answers, over K rounds.
- **Strengths:** Convergence + critique. On factuality/reasoning benchmarks it improved over single-agent CoT in the original paper.
- **Parallelizes?** Yes across agents within a round; rounds are sequential.
- **Includes verification?** Internal only — agents check each other's claims, but no external tools unless bolted on.
- **When it fails:** **This is the most-caveated technique in the 2024–2025 literature.** Smit et al. ICML 2024 ("Should We Be Going MAD?") found multi-agent debate often *fails to beat* a single agent that just re-reads its own answer. "Understanding Failure Modes in Multi-Agent Debate" (ICML 2025, https://arxiv.org/html/2509.05396v1) shows debate can *degrade* performance, especially with heterogeneous agents. "How Sycophancy Shapes Multi-Agent Debate" (Sep 2025, https://arxiv.org/html/2509.23055v1) finds LLM sycophancy collapses debates into premature consensus. ConsensusAgent (Virginia Tech, 2025) catalogs the same sycophancy/consensus failure modes. **Practical upshot:** naive "two agents argue" is fragile; you need an explicit *anti-sycophancy* mechanism (judge persona, secret ground truth, fixed disagreement budget).
- **Source:** Du et al., *Improving Factuality and Reasoning in Language Models through Multiagent Debate*, ICML 2024. https://arxiv.org/abs/2305.14325 · failure modes https://arxiv.org/html/2509.05396v1 · sycophancy https://arxiv.org/html/2509.23055v1

### 7. Society of Mind (Minsky 1986; revisited 2025)
Cognition as a swarm of specialised "agents of the mind" with censors/suppressors that gate which agent's voice wins at any moment. Not an algorithm — a design philosophy for multi-agent LLM systems.
- **Strengths:** Provides the conceptual justification for spawning heterogeneous roles and letting a meta-controller pick. Inspires explicit censor/suppressor layers (e.g. a "relevance" agent that vetoes off-topic brainstorm outputs).
- **Parallelizes?** Conceptually yes.
- **Includes verification?** The censor layer is a soft verification, but it's all internal.
- **When it fails:** Read too literally, it suggests ever-finer agent specialisation, which hits a coordination overhead ceiling fast. Modern takes (Sutha 2025) argue the durable part is the censor/suppressor idea, not the swarm size.
- **Source:** Minsky, *The Society of Mind*, 1986. https://en.wikipedia.org/wiki/Society_of_Mind · 2025 retrospective https://suthakamal.substack.com/p/revisiting-minskys-society-of-mind

### 8. Persona-based prompting (Devil's Advocate, Socratic, Expert, Naive user, etc.)
Assign the LLM an explicit role/voice before it answers; spawn one subagent per persona.
- **Strengths:** **This is the cheapest, highest-leverage divergence technique.** A 2025 Cambridge *Design Science* paper found multi-persona prompting significantly increases design-concept diversity over single-persona. The IUI-24 devil's-advocate study shows an LLM in the DA role measurably improves group-decision quality by amplifying minority opinions. The DEBATE NLG-eval framework (Kim & Kim 2024) uses a DA agent in the scoring loop and substantially improves evaluation quality.
- **Parallelizes?** Perfectly — each persona is an independent subagent.
- **Includes verification?** No — purely generative. Must be paired with a verifier role or a ReAct research step.
- **When it fails:** Personas collapse into the same LLM prior if the prompt framing is weak ("you are an expert" alone ≈ no-op). Personas can also drift toward stereotypes (the "naive user" becomes a strawman). Mitigation: give each persona a concrete disagreement *mandate*, not just a label.
- **Source:** Wang & Yin, *Enhancing AI-Assisted Group Decision Making through LLM-Powered Devil's Advocate*, IUI 2024. https://mingyin.org/paper/IUI-24/devil.pdf · Kim & Kim, *DEBATE: Devil's Advocate-Based Assessment and Text Evaluation*, 2024. https://arxiv.org/html/2405.09935v1 · Cambridge Design Science, *Enhancing design concept diversity: multi-persona prompting strategies for LLMs*, 2025. https://www.cambridge.org/core/journals/design-science/article/enhancing-design-concept-diversity-multipersona-prompting-strategies-for-large-language-models/3B346E253508337A4EE899499BE49D9B

### 9. Random stimulation / Oblique Strategies / de Bono's PO / TRIZ — "ask random questions, answer differently"
Family of lateral-thinking techniques that inject a deliberately *unrelated* stimulus (random word, provocative statement, inventive principle) to force a re-framing.
- **de Bono Random Input:** pick a random noun, force a connection to the problem. (creativiteach.me/random-input)
- **de Bono PO (Provocative Operation):** make a deliberately wrong/absurd statement, then extract a useful idea from it. (mycoted.com/Provocation; debono.com)
- **Oblique Strategies (Eno & Schmidt 1975):** deck of ~100 aphorisms ("Honour thy error as a hidden intention") drawn at random to break creative deadlocks. (obliquestrategies.ca)
- **TRIZ (Altshuller, 1946+):** 40 inventive principles + a contradiction matrix distilled from ~400k patents. More structured than the others — given a contradiction (improve X worsens Y), look up which of the 40 principles historically resolved it.
- **Strengths:** Pure divergence + novelty. Each forces the model out of its prior mode by introducing a constraint that has no semantic relation to the problem.
- **Parallelizes?** Yes — each subagent draws a different random stimulus and answers independently.
- **Includes verification?** No — purely generative. The output is usually raw material that needs downstream filtering.
- **When it fails:** The 2026 Stanford/Cornell study "Examining and Addressing Barriers to Diversity in LLM-Generated Ideas" (Deng & Brucks, https://arxiv.org/abs/2602.20408) shows that *naive independent LLM samples are less diverse than independent human samples* — i.e. random injection alone does not overcome the LLM's mode-collapse tendency; you need to pair it with explicit diversification (personas, prompt mutation, varied temperatures). TRIZ papers report mixed results: TRIZ-GPT (arXiv:2408.05897, 2024) helps on well-bounded engineering problems; TRIZBENCH (ACL Findings 2026) shows LLMs are still weak at *selecting* the right inventive principle even when they know the catalogue. Oblique Strategies has no controlled-trial evidence in LLMs that the author found, but practitioner consensus is that it helps when the model is *stuck* and is wasted when it isn't.
- **Sources:**
  - de Bono — https://en.wikipedia.org/wiki/Lateral_thinking · https://www.debono.com/serious-creativity-article · https://www.mycoted.com/Provocation
  - Oblique Strategies — https://obliquestrategies.ca/ · https://tarreyn.substack.com/p/oblique-strategies
  - TRIZ — https://www.triz40.com/triz-method.php · TRIZ-GPT https://arxiv.org/html/2408.05897v1 · TRIZBENCH https://aclanthology.org/2026.findings-acl.1798.pdf · LLM+TRIZ eval https://www.cambridge.org/core/journals/proceedings-of-the-design-society/article/evaluating-triz-with-and-without-llm-support-an-experimental-study-on-engineering-problemsolving/09B3955101E1013E73E8EB6C528DAE56

### 10. Ensemble / Best-of-N / Majority voting vs. diversity-seeking sampling
Best-of-N samples N outputs and picks the one the reward model scores highest; majority voting picks the modal answer. Both are *convergence* techniques — they trade diversity for reliability.
- **Strengths:** Convergence. With a good verifier, BoN is the simplest reliable test-time-scaling trick. Majority voting is essentially self-consistency (#1).
- **Parallelizes?** Perfectly.
- **Includes verification?** BoN requires a reward model or verifier — that's the verification step. Majority voting does not.
- **When it fails:** Three recent papers land hard on the diversity point:
  1. **DIPPER** (NUS, https://www.comp.nus.edu.sg/~greglau/assets/pdf/arr_dipper.pdf) shows *diversity-in-prompts* beats *self-ensemble* under BoN. I.e. varying the prompt across samples > reusing the same prompt.
  2. **"On the Effect of Sampling Diversity in Scaling LLM Inference"** (OpenReview https://openreview.net/forum?id=wcOkpQG4RO) shows sampling diversity improves BoN performance.
  3. **"Examining and Addressing Barriers to Diversity in LLM-Generated Ideas"** (Deng & Brucks 2026) shows LLM samples are systematically less diverse than human samples, and the gap *widens* at scale.
  Net: BoN/majority is for picking the best answer; *brainstorming* needs the opposite — explicitly diversity-seeking sampling (personas, prompt mutation, high temperature + diverse seeds, DIPPER-style prompt variation).
- **Sources:** DIPPER https://www.comp.nus.edu.sg/~greglau/assets/pdf/arr_dipper.pdf · sampling diversity https://openreview.net/forum?id=wcOkpQG4RO · BoN scalable https://arxiv.org/html/2502.18581v1 · LLM-Ensemble repo https://github.com/junchenzhi/Awesome-LLM-Ensemble · diversity barrier https://arxiv.org/abs/2602.20408 · LLM homogenization https://www.sciencedirect.com/science/article/pii/S294988212500091X

### 11. Constitutional AI / self-critique loops (Bai et al. 2022, Anthropic)
The model (a) critiques its own draft against a written list of principles, (b) revises, (c) repeats; the resulting preference data can also be used for RLAIF.
- **Strengths:** Critique + convergence. The "constitution" is a portable, editable spec — exactly the kind of thing a loop controller can swap per task. Self-critique loops are the *convergence half* of a brainstorm↔research rhythm.
- **Parallelizes?** Critique of N candidate ideas by N reviewer subagents — yes.
- **Includes verification?** Internal — the constitution encodes the spec, but there's no tool use unless ReAct is added.
- **When it fails:** Self-critique with no external signal degrades into rubber-stamping (Huang et al. 2023). The constitution has to actually *disagree* with the model's defaults to do work; vague principles ("be helpful") are no-ops.
- **Source:** Bai et al., *Constitutional AI: Harmlessness from AI Feedback*, 2022. https://arxiv.org/abs/2212.08073 · Anthropic v2 paper https://www-cdn.anthropic.com/7512771452629584566b6303311496c262da1006/Anthropic_ConstitutionalAI_v2.pdf

### 12. Self-Refine (Madaan et al. 2023)
Same model generates feedback on its own output, then refines, in a loop — a single-agent degenerate case of Constitutional AI.
- **Strengths:** Cheap, no extra model needed. Convergence + critique.
- **Parallelizes?** Sequential by design.
- **Includes verification?** No — purely self-referential.
- **When it fails:** Same self-blind-spot problem as everything in this family. The Madaan paper itself shows gains concentrate on tasks where the model can *recognise* an error even if it couldn't *avoid* it (e.g. code, math) — for open-ended ideation the gains are small. Often outperformed by a *separate* reviewer model.
- **Source:** Madaan et al., *Self-Refine: Iterative Refinement with Self-Feedback*, NeurIPS 2023. https://arxiv.org/abs/2303.17651 · site https://selfrefine.info

### 13. Idea marathon / iterative ideation with mutation
Generate a *population* of ideas, score them, keep the best, mutate/crossover them with an LLM as the mutation operator, repeat for K generations. Direct borrow from evolutionary search; DeepMind's FunSearch is the flagship example.
- **Strengths:** Novelty + divergence at the *population* level (not just per-sample). Mutations explicitly push outside the prior generation's mode. Tracks novelty across iterations, not just within one.
- **Parallelizes?** Yes — population members and mutations are independent per generation.
- **Includes verification?** Requires a fitness function. If the fitness function is an LLM judge, that's the verification; if it's an external evaluator (compile, run tests, retrieve evidence), it's real verification.
- **When it fails:** "Revolutionizing Research via Novel Idea Development with LLM Agents" (EMNLP 2025 Findings, https://aclanthology.org/2025.findings-emnlp.477.pdf) shows the mutation operator has to be *strongly* diversifying or the population collapses to a single attractor within 3–5 generations. Population size and mutation strength both need explicit anti-collapse pressure (novelty bonuses, novelty archives).
- **Sources:** Revolutionizing Research https://arxiv.org/html/2410.13185v3 · LLM-Driven Evolutionary Search survey https://www.emergentmind.com/topics/llm-driven-evolutionary-search · LLM-Driven Evolutionary Program Search (FunSearch lineage) https://www.researchgate.net/publication/407540701

### 14. ResearchAgent (Baek et al., NAACL 2025) — concrete instantiation of the brainstorm↔review rhythm
LLM ideation agent that iteratively defines problems, proposes methods, designs experiments, and refines via dedicated ReviewingAgents whose criteria are elicited from human judgements.
- **Strengths:** This is the *closest existing system to the loop being designed*. It already separates ideation from reviewing agents, runs them iteratively, and grounds ideation in literature retrieval.
- **Parallelizes?** Reviewing agents can run in parallel across idea dimensions (novelty / feasibility / clarity).
- **Includes verification?** Literature retrieval + reviewer agents = yes.
- **When it fails:** Reviewer agents share the same underlying model as the ideator, so reviewer blind spots mirror ideator blind spots. Reported gains are largest on "creative, valid, clear" idea rewrites — feasibility gains are smaller, mirroring the Liang 2024 finding (§15) that LLM ideas are novel-but-not-feasible.
- **Source:** Baek et al., *ResearchAgent: Iterative Research Idea Generation over Scientific Literature with LLMs*, NAACL 2025. https://arxiv.org/abs/2404.07738 · code https://github.com/JinheonBaek/ResearchAgent

### 15. SciAgents (Buebler/Coughlin, MIT, 2024)
Multi-agent LLM system with a knowledge-graph backbone that generates, critiques, and refines scientific hypotheses autonomously. Agents specialise as ontologist, hypothesiser, critic, planner.
- **Strengths:** Most ambitious existing example of a *heterogeneous multi-agent brainstorm↔research* system. Demonstrates that role-specialised agents + shared KG memory can produce hypotheses a single agent won't.
- **Parallelizes?** Yes — agents run concurrently with KG as the shared state.
- **Includes verification?** Yes — KG-grounded; critic agent checks consistency against the graph.
- **When it fails:** Domain-specific (designed for materials science). The KG is a strong prior — it can also constrain novelty by anchoring agents to existing ontology.
- **Source:** Buehler group, *SciAgents: Automating Scientific Discovery Through Bioinspired Multi-Agent Intelligent Graph Reasoning*, 2024. https://pmc.ncbi.nlm.nih.gov/articles/PMC12138853

### 16. "Can LLMs Generate Novel Research Ideas?" — Liang et al. 2024 (Stanford)
Year-long study: 100 LLM-generated ideas vs. 79 NLP researcher ideas, all scored by NLP experts on novelty, feasibility, excitement, effectiveness.
- **Headline finding:** LLM ideas rated **significantly more novel** (p<0.05) than human-expert ideas, but **slightly weaker on feasibility**.
- **Critical caveats the paper itself raises (and that directly motivate this loop design):**
  1. **Idea duplication / homogenization:** LLM-generated ideas overlap with each other much more than human ideas do — the model has a strong attractor and converges to it.
  2. **Excitement ≠ feasibility:** LLMs optimise for "sounds exciting", which experts reward on novelty but penalise on feasibility. The research/verification half of the loop exists to catch this.
  3. **Self-evaluation gap:** LLMs were poor at ranking which of their own ideas were best — an external evaluator (or a ReAct-grounded verification step) is needed.
- **Implication for the loop:** Pure brainstorm is *already* good at novelty; the bottleneck is the *research/verification half* that filters for feasibility and the *diversity mechanism* that prevents LLM idea-collapse. This is the single most important paper for justifying the loop's existence.
- **Source:** Liang et al., *Can LLMs Generate Novel Research Ideas? A Large-Scale Human Study with 100+ NLP Researchers*, ICLR 2025 (arXiv Sep 2024). https://arxiv.org/abs/2409.04109 · ICLR PDF https://proceedings.iclr.cc/paper_files/paper/2025/file/ea94957d81b1c1caf87ef5319fa6b467-Paper-Conference.pdf

### 17. Divergence↔Convergence rhythm — Design Thinking "Double Diamond"
Two diamonds: Discover (diverge) → Define (converge) → Develop (diverge) → Deliver (converge). The shape is the lesson: alternate expansion and contraction; never do them simultaneously.
- **Strengths:** This is the *meta-pattern* the loop should obey. Maps cleanly onto a brainstorm↔research alternation: brainstorm = diverge, research = converge. A second brainstorm pass = diverge again, this time seeded with the surviving ideas + their critiques.
- **Parallelizes?** Diverge phases parallelize perfectly; converge phases need a synchronisation point.
- **Includes verification?** Converge = verification, by construction.
- **When it fails:** Two classic failure modes — (a) *premature convergence*: skip the diverge phase and jump to the first idea; (b) *endless divergence*: never converge, generate ideas forever. The loop needs explicit *budgets* per phase.
- **Source:** British Design Council, *Double Diamond* (2005). https://en.wikipedia.org/wiki/Double_Diamond_(design_process_model) · divergence vs convergence https://www.mural.co/blog/divergent-convergent-thinking

### Bonus 18. "Exploring the Design of Multi-Agent LLM Dialogues for Scientific Ideation" (SIGDIAL 2025)
Direct empirical study of what helps in multi-agent scientific ideation: agent diversity (persona injection), agent parallelism (in critique), and agent interaction patterns.
- **Headline:** Agent diversity (personas) and parallelism both measurably improve idea quality, but the interaction pattern matters — too much back-and-forth between agents *reduces* diversity (consistent with §6 sycophancy findings).
- **Source:** https://aclanthology.org/2025.sigdial-1.26.pdf

---

## Synthesis — recommended mix for a brainstorm↔research loop

The loop being designed alternates **brainstorm (diverge) → research/verify (converge) → brainstorm (re-diverge seeded by prior cycle) → …**. The five techniques below are the smallest set that covers all four quadrants of the design space (divergence, convergence, critique, novelty-across-cycles) and that *compose* cleanly.

1. **Persona-based parallel subagents** (technique #8) — *the divergence engine.*
   Spawn N subagents with mandated disagreement roles (see persona set below). This is the cheapest, most evidence-backed divergence technique (Cambridge 2025, SIGDIAL 2025). Beats naive parallel sampling because it explicitly attacks the LLM mode-collapse documented in Liang 2024 and Deng & Brucks 2026.

2. **Tree of Thoughts (lightweight, breadth-limited)** (technique #2) — *the within-subagent diverge/critique.*
   Each persona subagent doesn't emit one idea — it branches, self-scores, and returns its top-k. Keeps per-subagent depth shallow (2–3 levels) to avoid the self-evaluator blind-spot failure mode. The role of ToT here is *per-persona depth*, not global search.

3. **ReAct with retrieval + tools** (technique #4) — *the research/verify half of the loop.*
   Every surviving idea from the brainstorm phase gets passed to a ReAct subagent that retrieves evidence, runs checks, queries the codebase, looks for prior art. This is the *only* technique in the survey that adds external truth. Without it, the loop is just an LLM talking to itself (which Liang 2024 shows cannot self-rank).

4. **Reflexion-style episodic memory between cycles** (technique #5) — *the loop-closure.*
   After research/verify, write a structured reflection ("idea A failed verification because X; idea B is promising but needs Y") into a memory buffer that seeds the *next* brainstorm cycle. This is what turns a parallel fan-out into an actual *loop* that learns. Critically: only reflections backed by the env (ReAct results, not just self-critique) get stored, to avoid the Huang 2023 self-correction-noise problem.

5. **Evolutionary mutation across cycles** (technique #13) — *the cross-cycle novelty pressure.*
   Treat surviving ideas + their critiques as a *population*. Each new brainstorm cycle doesn't start from scratch — it mutates and recombines surviving ideas (LLM as mutation operator), with an explicit novelty bonus against ideas already in the archive. Without this, cycles 2+ will just regenerate cycle 1's attractor. The EMNLP 2025 finding (need strong diversifying mutations) is the design constraint here.

**Why these five and not others?**
- *Self-consistency (#1) and Best-of-N/majority (#10)* are convergence tools that assume a single correct answer; brainstorming has no single answer, so they're actively counter-productive in the diverge phase. Use BoN only inside the *verify* phase, to pick the most-likely-correct fact among several retrieved candidates.
- *Multi-agent debate (#6)* is excluded from the core mix because the 2024–2025 failure-mode literature is too damning; its benefits are subsumed by persona subagents (#8) + a Devil's Advocate persona specifically. If debate is used at all, it should be *one round only*, between two pre-assigned opposing personas, with a third judge — not an open-ended debate.
- *Constitutional AI / Self-Refine (#11, #12)* are folded into the Devil's Advocate persona + ReAct verification, rather than run as separate self-critique loops, because self-critique alone is unreliable (Huang 2023).
- *Graph of Thoughts (#3)* is held in reserve as an upgrade to #2 only if the task genuinely benefits from merging partial ideas — premature for v1.
- *Double Diamond (#17)* is the *meta-rhythm*, not a technique to mix in — it's the loop's *shape*, not an ingredient.

---

## Persona / role set for parallel subagents

The smallest set that maximises idea diversity. Five roles, each with a *disagreement mandate* (a label with no mandate is a no-op — see §8 failures). Each is spawned as a subagent in the diverge phase.

| # | Role | One-line mandate | Divergence function |
|---|------|------------------|---------------------|
| 1 | **The Dreamer** | "Generate the most ambitious version of this idea. No constraints, no feasibility check. 'Yes-and' everything." | Pure divergence, removes prior-mode pruning |
| 2 | **The Skeptic / Devil's Advocate** | "For each idea, list the single most likely reason it will fail. Propose the variant that survives that failure." | Critique-driven divergence; attacks the attractor |
| 3 | **The Engineer** | "Assume the idea ships in 6 weeks to the exigo repo. What is the simplest implementation? What does that reveal about the idea's real shape?" | Feasibility-grounded divergence; counterweights Dreamer |
| 4 | **The Outsider** | "Explain this to a smart 12-year-old, then ask the 3 questions the 12-year-old would ask. Answer each with a new idea." | Reframing divergence; breaks expert-mode priors |
| 5 | **The Cross-Domain Synthesizer** | "Import one analogy from a different field (biology, urban planning, music theory, etc.). Build the idea on that analogy." | Remote-association divergence; the de Bono "random input" lever, but aimed rather than random |

**Why this set, and not more:**
- Five is enough to cover the four divergence modes (unconstrained, critique-driven, feasibility-driven, reframing, remote-association) without redundancy.
- More than five tends to produce overlapping ideas — diminishing returns documented in the SIGDIAL 2025 multi-agent ideation study.
- Roles 1–4 are universal; role 5 is the explicit "ask random questions differently" channel — see next section.
- A **sixth** optional role — **The Historian** ("what's been tried in exigo's `loops/`, `agents/`, and prior `cd-review` runs?") — is *not* a brainstorm role; it belongs to the *research* phase as a ReAct subagent. Putting it in brainstorm would collapse the diverge phase into retrieval.

**Operational rules for spawning:**
- Run all five in *parallel* (not sequentially). Sequential persona application tends to let the LLM anchor on the first persona's framing; parallel forces independent generation.
- Each persona gets its own context window with *only* the shared task brief, *not* the other personas' outputs (to prevent sycophantic collapse, §6).
- The orchestrator collects all outputs and dedups/merges before passing to the verify phase.

---

## Note on "ask random questions, answer differently"

**What the literature calls this:**
- **de Bono's "Random Input"** — pick a random noun, force a connection to the problem. The oldest and most explicit formulation. (https://creativiteach.me/creative-thinking-strategies/random-input; https://en.wikipedia.org/wiki/Lateral_thinking)
- **de Bono's "PO" (Provocative Operation)** — make a deliberately absurd statement, then extract a useful idea from it. The generalisation of Random Input. (https://www.mycoted.com/Provocation; https://www.debono.com/serious-creativity-article)
- **Brian Eno & Peter Schmidt's "Oblique Strategies"** (1975) — a deck of ~100 aphorisms drawn at random to break a creative deadlock. The artistic-community version of Random Input. (https://obliquestrategies.ca/)
- **TRIZ** (Altshuller, 1946+) — the *structured* cousin: rather than a random stimulus, it offers 40 inventive principles + a contradiction matrix. (https://www.triz40.com/triz-method.php)
- In the LLM literature specifically, the operational equivalent is **prompt mutation / paraphrase sampling for diversity** — DIPPER (NUS) and the OpenReview "Sampling Diversity" paper both show that varying the prompt across samples beats reusing it.
- In evolutionary-LLM work (FunSearch lineage, "Revolutionizing Research via Novel Idea Development" EMNLP 2025), it's called **mutation** — the LLM is the mutation operator that perturbs a parent idea.

**Does it actually work, vs. just generating diverse completions?**
Mixed, and the answer is nuanced:

- **When it works:** Random injection works when the model is *stuck in a local mode* — i.e. when naive temperature-sampling returns near-duplicate answers. The random stimulus is a *lever* that pries the model out of its attractor. This is exactly the use case where de Bono, Oblique Strategies, and TRIZ were designed for humans, and the same logic applies.
- **When it doesn't:** The 2026 Stanford/Cornell study "Examining and Addressing Barriers to Diversity in LLM-Generated Ideas" (Deng & Brucks, https://arxiv.org/abs/2602.20408) shows that *naive independent LLM samples are systematically less diverse than independent human samples, and the gap widens at scale.* So if "ask random questions" is implemented as "just sample N times with high temperature," it will *not* rescue diversity — the model's prior pulls everything back.
- **What makes it actually effective:** Pairing random injection with *explicit diversification pressure*. DIPPER shows diverse *prompts* beat diverse *samples-from-the-same-prompt*. The persona approach (#8) is the most reliable form of prompt diversification. Random stimuli (de Bono, Oblique, TRIZ) are a *second* diversification lever on top of that — used inside the Cross-Domain Synthesizer persona (#5 above), not as a replacement for personas.
- **TRIZ specifically:** Has the strongest empirical backing of the structured-random family for *engineering* problems — TRIZ-GPT (arXiv:2408.05897, 2024) and the Cambridge LLM+TRIZ eval (2026) both show gains on bounded engineering problems, but TRIZBENCH (ACL Findings 2026) shows LLMs are still weak at *selecting* the right inventive principle. So TRIZ works as a *checklist prompt* ("for each of the 40 principles, would it apply?"), not as a single-shot lookup.

**Bottom line for the loop design:**
The user's instinct is right but the implementation matters. "Ask random questions, answer differently" *is* a real and named technique (de Bono Random Input / PO; Oblique Strategies; TRIZ; LLM prompt mutation). It is genuinely effective *as a divergence lever* — but only when (a) it's deployed against a model that's already stuck, and (b) it's paired with explicit persona/seed diversification, not relied on alone. The recommended home for it in the loop is **persona #5 (Cross-Domain Synthesizer)**, which turns the random-stimulus concept into an *aimed* stimulus: instead of a random noun, the synthesizer pulls an analogy from a specified remote domain. That keeps the novelty benefit while removing the "random didn't land" noise. Pure-random injection (Oblique Strategies card draw) is a fallback to deploy only when the synthesizer's output is too close to the prior generation's mode.

---

## Sources

### Core techniques
- Self-Consistency — Wang et al. 2022/2023, ICLR. https://arxiv.org/abs/2203.11171
- Tree of Thoughts — Yao et al. 2023, NeurIPS. https://arxiv.org/abs/2305.10601 · https://github.com/princeton-nlp/tree-of-thought-llm
- Graph of Thoughts — Besta et al. 2023/2024, AAAI. https://arxiv.org/abs/2308.09687
- Demystifying CoT/ToT/GoT — Besta et al. survey. https://htor.inf.ethz.ch/publications/img/besta-topologies.pdf
- ReAct — Yao et al. 2022/2023, ICLR. https://arxiv.org/abs/2210.03629 · https://react-lm.github.io
- Reflexion — Shinn et al. 2023, NeurIPS. https://arxiv.org/abs/2303.11366 · https://github.com/noahshinn/reflexion
- Multi-Agent Debate — Du et al. 2023/2024, ICML. https://arxiv.org/abs/2305.14325 · https://composable-models.github.io/llm_debate
- Constitutional AI — Bai et al. 2022, Anthropic. https://arxiv.org/abs/2212.08073 · https://www-cdn.anthropic.com/7512771452629584566b6303311496c262da1006/Anthropic_ConstitutionalAI_v2.pdf
- Self-Refine — Madaan et al. 2023, NeurIPS. https://arxiv.org/abs/2303.17651 · https://selfrefine.info
- Society of Mind — Minsky 1986. https://en.wikipedia.org/wiki/Society_of_Mind · 2025 retrospective https://suthakamal.substack.com/p/revisiting-minskys-society-of-mind

### Multi-agent debate failure modes (2024–2025)
- Should We Be Going MAD? — Smit et al. ICML 2024. https://proceedings.mlr.press/v235/smit24a.html
- Understanding Failure Modes in Multi-Agent Debate — 2025. https://arxiv.org/html/2509.05396v1 · https://icml.cc/virtual/2025/49332
- How Sycophancy Shapes Multi-Agent Debate — Sep 2025. https://arxiv.org/html/2509.23055v1
- ConsensusAgent — Virginia Tech 2025. https://people.cs.vt.edu/naren/papers/CONSENSAGENT.pdf

### Persona & devil's advocate
- Enhancing AI-Assisted Group Decision Making through LLM-Powered Devil's Advocate — IUI 2024. https://mingyin.org/paper/IUI-24/devil.pdf
- DEBATE: Devil's Advocate-Based Assessment and Text Evaluation — Kim & Kim 2024. https://arxiv.org/html/2405.09935v1
- Enhancing design concept diversity: multi-persona prompting strategies for LLMs — Cambridge Design Science 2025. https://www.cambridge.org/core/journals/design-science/article/enhancing-design-concept-diversity-multipersona-prompting-strategies-for-large-language-models/3B346E253508337A4EE899499BE49D9B
- Exploring the Design of Multi-Agent LLM Dialogues for Scientific Ideation — SIGDIAL 2025. https://aclanthology.org/2025.sigdial-1.26.pdf

### Lateral thinking, random input, Oblique Strategies, TRIZ
- Lateral thinking — Wikipedia. https://en.wikipedia.org/wiki/Lateral_thinking
- de Bono, "Serious Creativity". https://www.debono.com/serious-creativity-article
- Provocation (PO) — mycoted. https://www.mycoted.com/Provocation
- Random Input — creativiteach. https://creativiteach.me/creative-thinking-strategies/random-input
- Oblique Strategies generator. https://obliquestrategies.ca/
- TRIZ method overview. https://www.triz40.com/triz-method.php
- TRIZ-GPT — 2024. https://arxiv.org/html/2408.05897v1
- Evaluating TRIZ with and without LLM support — Cambridge 2026. https://www.cambridge.org/core/journals/proceedings-of-the-design-society/article/evaluating-triz-with-and-without-llm-support-an-experimental-study-on-engineering-problemsolving/09B3955101E1013E73E8EB6C528DAE56
- TRIZBENCH — ACL Findings 2026. https://aclanthology.org/2026.findings-acl.1798.pdf

### Best-of-N, ensemble, sampling diversity
- DIPPER: Diversity in Prompts for Producing LLM Outputs — NUS. https://www.comp.nus.edu.sg/~greglau/assets/pdf/arr_dipper.pdf
- On the Effect of Sampling Diversity in Scaling LLM Inference. https://openreview.net/forum?id=wcOkpQG4RO
- Scalable Best-of-N Selection for LLMs — 2025. https://arxiv.org/html/2502.18581v1
- Awesome-LLM-Ensemble (repo). https://github.com/junchenzhi/Awesome-LLM-Ensemble
- Majority of the Bests: Improving BoN via Bootstrapping — NeurIPS 2025. https://neurips.cc/virtual/2025/poster/117285
- Homogenizing effect of LLMs on divergent writing — 2025. https://www.sciencedirect.com/science/article/pii/S294988212500091X

### LLM idea generation, novelty, diversity (2024–2026)
- Can LLMs Generate Novel Research Ideas? — Liang et al. ICLR 2025 / arXiv Sep 2024. https://arxiv.org/abs/2409.04109 · ICLR PDF https://proceedings.iclr.cc/paper_files/paper/2025/file/ea94957d81b1c1caf87ef5319fa6b467-Paper-Conference.pdf
- Examining and Addressing Barriers to Diversity in LLM-Generated Ideas — Deng & Brucks 2026. https://arxiv.org/abs/2602.20408 · https://www.researchgate.net/publication/401178492
- LiveIdeaBench: Evaluating LLMs' divergent thinking — Nature Comms 2026. https://www.nature.com/articles/s41467-026-70245-1
- LLMs and creativity: AI responses show less variety than human responses — TechXplore Mar 2026. https://techxplore.com/news/2026-03-llms-creativity-ai-responses-variety.html
- Awesome-scientific-idea-generation (repo, paper list). https://github.com/Superbooming/Awesome-scientific-idea-generation
- Awesome-LLM-Scientific-Discovery (repo). https://github.com/HKUST-KnowComp/Awesome-LLM-Scientific-Discovery
- Large Language Models for Scientific Idea Generation (survey) — Feb 2026. https://arxiv.org/html/2511.07448v2
- Deep Ideation: Designing LLM Agents to Generate Novel [scientific ideas] — Nov 2025. https://arxiv.org/html/2511.02238v1

### Iterative ideation, mutation, evolutionary LLM search
- ResearchAgent: Iterative Research Idea Generation — Baek et al. NAACL 2025. https://arxiv.org/abs/2404.07738 · https://github.com/JinheonBaek/ResearchAgent
- SciAgents: Automating Scientific Discovery — MIT 2024. https://pmc.ncbi.nlm.nih.gov/articles/PMC12138853
- Revolutionizing Research via Novel Idea Development with LLM Agents — EMNLP 2025 Findings. https://arxiv.org/html/2410.13185v3 · https://aclanthology.org/2025.findings-emnlp.477.pdf
- LLM-Driven Evolutionary Search (survey). https://www.emergentmind.com/topics/llm-driven-evolutionary-search
- LLM-Driven Evolutionary Program Search: From FunSearch to Automated Scientific Discovery. https://www.researchgate.net/publication/407540701
- Nova: Iterative Planning and Search for LLM creativity — Oct 2024. https://arxiv.org/html/2410.14255v1
- Iterative Deepening Sampling for LLMs — Feb 2025. https://arxiv.org/html/2502.05449v1
- Iterative Multi-Agent Brainstorming (pattern catalogue). https://agentic-patterns.com/patterns/iterative-multi-agent-brainstorming

### Design thinking rhythm
- Double Diamond — Wikipedia. https://en.wikipedia.org/wiki/Double_Diamond_(design_process_model)
- Divergent vs convergent thinking — Mural. https://www.mural.co/blog/divergent-convergent-thinking
- Double Diamond in practice — AAM 2024. https://www.aam-us.org/2024/04/05/learning-from-the-double-diamond-how-divergent-and-convergent-thinking-can-improve-collaboration-and-problem-solving-in-museums
