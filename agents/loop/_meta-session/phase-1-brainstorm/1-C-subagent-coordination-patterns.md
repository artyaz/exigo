# 1-C — Subagent Coordination Patterns (research)

**Task ID:** 1-C
**Scope:** Survey of multi-agent coordination topologies and dispatch patterns, with explicit focus on (a) what survives at "maxed-out parallel subagent count" for both brainstorm (divergence) and research (verification) phases, (b) what fails at scale, and (c) what the mandatory non-parallel Judge/Orchestrator role must do.
**Date of survey:** 2026-07-18
**Companion to:** 1-A (AI brainstorming methods) and 1-B (human brainstorming methods).

The recurring vocabulary used below comes from three converging literatures:
- **Production multi-agent engineering** — Anthropic's June 2025 "How we built our multi-agent research system" post and its Sept 2025 "Effective context engineering for AI agents" follow-up define the *orchestrator-worker* topology and the *context-isolation* discipline now treated as the production default.
- **Multi-agent failure-mode research** — Smit et al. ICML 2024, "Understanding Failure Modes in Multi-Agent Debate" (ICML 2025), "How Sycophancy Shapes Multi-Agent Debate" (Sep 2025) all document *premature consensus*, *sycophancy*, *mode collapse at scale* — the failure modes that determine which patterns are safe to "max out."
- **Cognitive-science multi-agent theory** — Minsky's *Society of Mind* (1986), Grassé's *stigmergy* (1959), the Stanford *Generative Agents* paper (Smallville, 2023) give the durable conceptual frames.

---

## Patterns surveyed

Each entry: **name + 1-sentence description · topology · best for (divergence / convergence / verification / execution) · failure modes · token/latency tradeoff · how "max-N" parallelism changes the dynamics · source**.

---

### 1. Orchestrator-Worker (fan-out / fan-in)
A single lead agent decomposes a task, dispatches N independent worker subagents in parallel, then collects and reconciles their outputs.
- **Topology:** 1-to-N-to-1 (star). Workers never talk to each other; the orchestrator is the only hub.
- **Best for:** Convergence-side *execution* and *verification* of decomposable tasks (Anthropic's Research feature uses exactly this — lead agent plans, Sonnet subagents each explore one branch and return a summary). Strong on research; weak on divergence because workers don't pressure-test each other.
- **Failure modes:** Orchestrator becomes the bottleneck and the single point of failure; if the orchestrator's decomposition is wrong, all N workers are wasted. Workers anchor on the orchestrator's framing if their prompt leaks the orchestrator's prior reasoning (Anthropic's *context engineering* post is explicit that subagents must NOT see the lead's full scratchpad). Cost scales linearly with N.
- **Token / latency tradeoff:** Latency ≈ slowest worker + orchestrator overhead. Token cost = orchestrator tokens + N × worker tokens. Anthropic reports their production multi-agent Research uses ~15× the tokens of a single-agent baseline (Fountain City validation). The wall-clock win is roughly 75% vs sequential (Glukhov).
- **How "max-N" changes it:** More workers = broader coverage *if* the orchestrator can decompose cleanly; past ~10–15 workers the orchestrator's reconciliation step saturates its own context window and quality drops. Best when N matches the natural decomposition count of the task, not an arbitrary "max."
- **Sources:** Anthropic, *How we built our multi-agent research system*, Jun 2025, https://www.anthropic.com/engineering/multi-agent-research-system · Anthropic, *Effective context engineering for AI agents*, Sep 2025, https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents · Fountain City production validation, May 2026, https://fountaincity.tech/resources/blog/anthropic-multi-agent-blueprint-production · agentpatterns.ai, https://agentpatterns.ai/multi-agent/orchestrator-worker

### 2. Map-Reduce for agents
Split a task into independent chunks ("map"), process each in parallel, then merge results under a reducer function ("reduce"). Same shape as orchestrator-worker but the map step is *dynamic* — the chunk count is decided at runtime from the input, not by the orchestrator's judgement.
- **Topology:** 1-to-N-to-1 (same star as #1), but the *N* is data-derived, not judgement-derived.
- **Best for:** Execution on *embarrassingly parallel* inputs (one chunk per file, per document, per idea). LangGraph's `Send` API is the canonical implementation — a node returns a list of `Send(node, arg)` tuples and the runtime spawns one worker per tuple. The reducer is a separate node that consumes the collected state.
- **Failure modes:** Same as orchestrator-worker, plus an additional one: if the chunks aren't truly independent, the reduce step silently produces an inconsistent merge. Reducer design is the hidden hard part — naive concatenation hides contradictions.
- **Token / latency tradeoff:** Latency ≈ slowest chunk; cost = Σ worker tokens + reducer tokens. Better than orchestrator-worker when the chunk count is large (no orchestrator reasoning tax per chunk).
- **How "max-N" changes it:** Scales cleanly to hundreds of chunks *if the reducer is associative* (e.g. counting, top-K selection, dedup). Scales badly when the reducer needs cross-chunk reasoning (e.g. "find the 3 most contradictory ideas across all chunks" — that's O(N²) in the reducer's context).
- **Sources:** LangGraph Send API, https://docs.langchain.com/oss/python/langgraph/graph-api · LangGraph forum on parallel fanouts, Oct 2025, https://forum.langchain.com/t/best-practices-for-parallel-nodes-fanouts/1900 · "Implementing Map-Reduce with LangGraph", https://medium.com/@astropomeai/implementing-map-reduce-with-langgraph-creating-flexible-branches-for-parallel-execution-b6dc44327c0e · Azure Architecture Center, AI Agent Orchestration Patterns, Feb 2026, https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns

### 3. Hierarchical / Tree spawning (recursive agents)
Workers can themselves spawn sub-workers, producing a tree (or graph, if cross-links are allowed) of arbitrary depth.
- **Topology:** Tree (or DAG). Each non-leaf agent is itself an orchestrator for its subtree.
- **Best for:** *Recursive decomposition* of tasks whose structure is unknown at design time (the classic example: "research X" → "research X.1, X.2, X.3" → "for each, find 5 sources" → ...). Used in RecursiveMAS (arXiv:2604.25917), the "Recursive Agent Hive" pattern, and OpenAI Codex's agent recursion (which currently hard-caps depth at 1).
- **Failure modes:** **Infinite recursion** is the canonical one — a Reddit r/AI_Agents thread titled "Multi-Agent System Caught in Infinite Recursion" documents the failure in production. Mitigation requires an explicit *depth limit* and a *stop condition* per node. Second failure: *recursion collapse* — sub-workers re-do the parent's work because the parent's context doesn't fit in the child's, wasting tokens at every level. Third: *coordination overhead compounds* — each level adds latency.
- **Token / latency tradeoff:** Latency = sum of depths × per-level latency (sequential across levels). Token cost = Σ all nodes; explodes exponentially with branching × depth.
- **How "max-N" changes it:** Combining *max-N branching* with *depth > 2* is the most expensive pattern in the survey and the most failure-prone. The honest production guidance (codex issue #9912, emergentmind recursive hive) is: **cap depth at 2**, treat depth-3+ as a smell that the decomposition is wrong.
- **Sources:** RecursiveMAS, arXiv:2604.25917, https://arxiv.org/html/2604.25917v1 · Recursive Agent Hive, https://www.emergentmind.com/topics/recursive-agent-hive · OpenAI Codex issue #9912 "Configurable Maximum Agent Recursion Depth", Jan 2026, https://github.com/openai/codex/issues/9912 · r/AI_Agents "Infinite Recursion" thread, https://www.reddit.com/r/AI_Agents/comments/1nie8u5/help_multiagent_system_caught_in_infinite · Hierarchical MAS overview, https://overcoffee.medium.com/hierarchical-multi-agent-systems-concepts-and-operational-considerations-e06fff0bea8c

### 4. Debate / Tournament (workers argue, judges pick)
N agents each produce an answer, then iterate over K rounds of mutual critique; an external judge (or final vote) picks the winner. Tournament = single-elimination bracket; debate = round-robin.
- **Topology:** N-to-N within a round (everyone sees everyone), with a 1-of-N judge.
- **Best for:** *Convergence* on tasks with a defensible best answer (math, factual QA, code). The Du et al. 2023 MAD paper showed gains on these. *Not* a divergence technique despite the name.
- **Failure modes:** The most-caveated family in the survey. 1-A already cataloged these; summarised: Smit et al. ICML 2024 ("Should We Be Going MAD?") finds debate often fails to beat a single agent that re-reads its own answer; the ICML 2025 "Understanding Failure Modes in Multi-Agent Debate" paper shows debate can *degrade* performance with heterogeneous agents; "How Sycophancy Shapes Multi-Agent Debate" (Sep 2025) shows LLM sycophancy collapses debates into premature consensus; ConsensusAgent (Virginia Tech 2025) catalogs the same. Tournament brackets are slightly safer than open debate because each pairwise round has a forced winner, but the sycophancy failure persists.
- **Token / latency tradeoff:** K rounds × N agents × per-round critique tokens. Expensive *and* sequential across rounds.
- **How "max-N" changes it:** **Badly.** Max-N debate is the worst case — more agents per round means more critiques to process per agent, more sycophancy pressure, and more token cost. Max-N *tournament* (pairwise brackets) is more defensible because each pairwise debate is only 2 agents, but you need N-1 sequential judge calls. Conclusion: never run max-N open debate; if anything, run max-N *single-shot generation* then a single judge bracket.
- **Sources:** Du et al., *Improving Factuality and Reasoning through Multiagent Debate*, ICML 2024, https://arxiv.org/abs/2305.14325 · Smit et al., *Should We Be Going MAD?*, ICML 2024 · Failure modes, arXiv:2509.05396, https://arxiv.org/html/2509.05396v1 · Sycophancy in debate, arXiv:2509.23055, https://arxiv.org/html/2509.23055v1 · Multi-Agent Debate for LLM Judges, arXiv:2510.12697, https://arxiv.org/html/2510.12697v1

### 5. Ensemble / Majority Vote / Best-of-N
N agents independently produce an answer; pick by majority vote (modal answer), or by a verifier's score (best-of-N), or by an aggregate (mean of numerical answers). No inter-agent communication.
- **Topology:** N parallel, N-to-1 reducer. The reducer is *mechanical* (no LLM call) for majority vote; verifier-driven for best-of-N.
- **Best for:** *Convergence* on tasks with a single correct answer. Self-consistency (Wang et al. 2022, see 1-A #1) is the canonical instance. Best-of-N is the standard test-time-scaling trick for verifiable domains.
- **Failure modes:** **Mode collapse** — three recent papers (Verbalized Sampling, arXiv:2510.01171; DIPPER, NUS; "Examining Barriers to Diversity in LLM-Generated Ideas," Deng & Brucks 2026 — cited in 1-A) all show independent LLM samples are *less* diverse than independent human samples, and the gap *widens* with N. So majority vote on independent samples increasingly just returns the model's prior mode as N grows. Best-of-N requires a good verifier; without one it's majority vote in disguise.
- **Token / latency tradeoff:** Latency ≈ slowest sample; cost = N × per-sample. Embarrassingly parallel, cheap to engineer.
- **How "max-N" changes it:** For convergence on a known-correct-answer task, max-N reliably improves (more samples = higher chance one is right). For divergence, max-N *actively hurts* — Deng & Brucks shows the diversity-per-sample drops as you add more samples, so max-N independent sampling is the worst way to brainstorm. **This is the central reason the brainstorm phase cannot just be "N independent subagents answer the same prompt."**
- **Sources:** Verbalized Sampling, arXiv:2510.01171, https://arxiv.org/html/2510.01171v1 · DIPPER (NUS), https://www.comp.nus.edu.sg/~greglau/assets/pdf/arr_dipper.pdf · Deng & Brucks 2026, https://arxiv.org/abs/2602.20408 · Wang et al., Self-Consistency, ICLR 2023, https://arxiv.org/abs/2203.11171

### 6. Mixture of Experts (MoE) — sparse routing
A *router* (small model or LLM call) inspects the input and dispatches it to a sparse subset of K specialised experts out of a pool of N, instead of running all N.
- **Topology:** 1-to-K-of-N (sparse fan-out). The router is the mandatory non-parallel role.
- **Best for:** *Execution* on inputs with clear expertise boundaries (frontend / backend / DB / docs). Originally a *training-time* architecture (Mixtral, DeepSeek-MoE), now used as a *runtime* dispatch pattern in agent systems (CrewAI hierarchical mode with a manager LLM is a runtime MoE).
- **Failure modes:** Router errors cascade — if the router mis-routes, the wrong expert runs and the right one never sees the input. Routing also adds latency and a token cost of its own. Load imbalance: popular experts become a bottleneck.
- **Token / latency tradeoff:** Cost = router + K experts (not N). Latency ≈ router + slowest expert of the K. The whole point is that cost is *sub-linear* in N.
- **How "max-N" changes it:** This is the *only* pattern where "max-N" is structurally safe — you can grow the expert pool to dozens without growing per-request cost, because only K run. But it's *not* a divergence pattern; experts don't generate diverse ideas, they execute specialised subtasks. So max-N MoE belongs in the *execution/research* half, not the *brainstorm* half.
- **Sources:** NVIDIA, *Applying Mixture of Experts in LLM Architectures*, Mar 2024, https://developer.nvidia.com/blog/applying-mixture-of-experts-in-llm-architectures · MoE survey, arXiv:2507.11181, https://arxiv.org/html/2507.11181v1 · IBM, *What is mixture of experts?*, https://www.ibm.com/think/topics/mixture-of-experts · Cameron Wolfe, *MoE LLMs*, https://cameronrwolfe.substack.com/p/moe-llms

### 7. Blackboard architecture
Multiple agents read and write to a single shared "blackboard" (a structured store); agents react to changes on the board rather than to direct messages from each other. Originated in Hearsay-II (1971–1976) speech recognition.
- **Topology:** N-to-N mediated by a shared store. No direct agent-to-agent channels.
- **Best for:** *Synthesis* of partial results from heterogeneous specialists (e.g. one agent writes raw findings, another clusters them, another critiques). LLM variant: arXiv:2510.01285 — a central agent posts requests to a blackboard, subordinate agents pick up partitions.
- **Failure modes:** Write conflicts (two agents update the same slot); unbounded board growth saturates context; "trampling" where loud agents overwrite quiet ones; latency from polling. Needs a schema or conflict-resolution policy.
- **Token / latency tradeoff:** Cost depends on read/write frequency — agents that poll the whole board on every turn are expensive. Async writes are cheap; sync reads can bottleneck.
- **How "max-N" changes it:** Board contention scales super-linearly with N (more writers = more conflicts = more re-reads). Max-N blackboard works only with strong schema + scoped partitions (each agent writes its own slot, reads others' slots on demand).
- **Sources:** Data-Flair, *Blackboard Architecture in Agentic AI*, https://data-flair.training/blogs/blackboard-architecture-in-agentic-ai · Schepis, *Patterns for Democratic Multi-Agent AI: Blackboard*, https://medium.com/@edoardo.schepis/patterns-for-democratic-multi-agent-ai-blackboard-architecture-part-1-69fed2b958b4 · LLM Multi-Agent Blackboard, arXiv:2510.01285, https://arxiv.org/html/2510.01285v1 · mem0.ai, *Multi-Agent Memory Systems*, Mar 2026, https://mem0.ai/blog/multi-agent-memory-systems

### 8. Actor model / message-passing
Each agent is an *actor* with its own mailbox and private state; agents communicate exclusively by sending asynchronous messages. No shared memory. Originated in Hewitt 1973; production lineage is Erlang/Akka.
- **Topology:** N-to-N peer mesh; messages are queued, not broadcast.
- **Best for:** *Long-running, stateful* multi-agent systems (each agent maintains state across many turns). The Akka-on-Elixir community has been advocating this for agents since 2025. Good for *execution* of long pipelines; rarely used for brainstorm.
- **Failure modes:** Deadlocks (A waits for B, B waits for A); message storms; ordering nondeterminism makes debugging hard. Mailboxes can grow unbounded.
- **Token / latency tradeoff:** Latency = message round-trips × per-call latency. Cost = Σ all messages. Cheap per message but messages compound.
- **How "max-N" changes it:** Scales well in principle (each actor is isolated), but *meaningful* inter-agent messages require each receiver to *read* the message into context — so N agents each reading N-1 messages = O(N²) context bloat. Max-N actor systems need scoped subscriptions (an agent only subscribes to a topic), not full mesh.
- **Sources:** *Message Passing and the Actor Model*, dist-prog-book, http://dist-prog-book.com/chapter/3/message-passing.html · Shaman AI agent-actors, https://github.com/shaman-ai/agent-actors/blob/main/launch.md · PradeepL, *Akka Actor Model: A Foundation for Concurrent AI Agents*, Apr 2026, https://pradeepl.com/blog/agentic-ai/akka-actor-model-agentic-ai · Swarm Tools Actor Model, https://www.swarmtools.ai/docs/concepts/actor-model

### 9. Swarm / handoff (OpenAI Swarm, Anthropic multi-agent)
A *lightweight* coordination model where the active agent can *hand off* control to another agent by returning that agent as its next action. No central orchestrator; control flows peer-to-peer via handoffs.
- **Topology:** Ring / mesh of handoffs. Control is single-threaded at any moment — only one agent is active.
- **Best for:** *Routing* across specialist agents (customer support: triage → billing → refund → close). OpenAI Swarm is explicit that this is an *educational* framework, not production; the production version is OpenAI's Agents SDK. Anthropic's multi-agent pattern catalog lists handoff as one of five patterns.
- **Failure modes:** Handoff loops (A hands to B, B hands back to A); "lost in transit" where context needed by the receiver isn't in the handoff; the active agent must know when to hand off, which requires good self-assessment (which LLMs are bad at).
- **Token / latency tradeoff:** Sequential by construction — only one agent active at a time. Cost = Σ active turns. Latency = Σ handoff round-trips.
- **How "max-N" changes it:** Swarm is *inherently sequential*, so "max-N" doesn't really apply — you have a pool of N agents but only 1 is active. Adding more agents to the pool increases routing difficulty (the active agent must choose among more candidates) without increasing parallelism. **Not a max-N pattern.**
- **Sources:** OpenAI Swarm (GitHub), https://github.com/openai/swarm · Galileo, *OpenAI Swarm Framework Guide*, https://galileo.ai/blog/openai-swarm-framework-multi-agents · Strands Agents, *Swarm Multi-Agent Pattern*, https://strandsagents.com/docs/user-guide/concepts/multi-agent/swarm · GuruSup, *Agent Orchestration Patterns: Swarm vs Mesh vs Hierarchical*, May 2026, https://gurusup.com/blog/agent-orchestration-patterns

### 10. CrewAI / AutoGen / LangGraph canonical patterns
The three dominant framework-native patterns:
- **CrewAI:** `Sequential` (agents in a fixed order, each sees prior outputs), `Hierarchical` (a manager agent dynamically delegates), and (in newer versions) `Consensual`. Hierarchical mode is the most-used — a manager LLM decides which agent handles which subtask.
- **AutoGen:** `TwoAgentChat`, `SequentialChat` (carryover summary passes to the next pair), `GroupChat` (a GroupChatManager picks the next speaker — *sequential by design*), and `NestedChat`. The AutoGen team is explicit in GitHub discussion #4215 that GroupChat is sequential; for parallel execution they recommend Mixture-of-Agents.
- **LangGraph:** graph-based — nodes are agents, edges are transitions; parallel branches via `Send` (dynamic fan-out) or via multiple edges from one node (static fan-out). The most flexible of the three; the only one with first-class map-reduce.
- **Topology:** Sequential = pipeline; Hierarchical = star (manager + workers); GroupChat = sequential round-robin; LangGraph parallel = fan-out/fan-in.
- **Best for:** CrewAI hierarchical = execution of pre-defined role pipelines; AutoGen GroupChat = conversational convergence on a task; LangGraph = anything, but you pay the complexity tax.
- **Failure modes:** CrewAI hierarchical mode is notoriously brittle (CrewAI community thread "Does hierarchical process even work?" — the only reliable config is to NOT define a manager agent and just define a manager LLM). AutoGen GroupChat degenerates into two agents talking past each other. LangGraph's flexibility means you can encode any failure mode you like.
- **Token / latency tradeoff:** Sequential = lowest cost, highest latency. Hierarchical = manager tax + worker cost. GroupChat = K rounds × N agents.
- **How "max-N" changes it:** CrewAI hierarchical scales poorly (the manager LLM has to reason about all N workers). AutoGen GroupChat doesn't parallelise. Only LangGraph's `Send`-based fan-out scales to high N cleanly.
- **Sources:** CrewAI Processes docs, https://docs.crewai.com/en/concepts/processes · CrewAI Hierarchical Process, https://docs.crewai.com/v1.15.2/en/learn/hierarchical-process · CrewAI community on hierarchical fragility, https://community.crewai.com/t/does-hierarchical-process-even-work-your-experience-is-highly-appreciated/2690 · AutoGen Group Chat, https://microsoft.github.io/autogen/stable//user-guide/core-user-guide/design-patterns/group-chat.html · AutoGen Conversation Patterns, https://microsoft.github.io/autogen/0.2/docs/tutorial/conversation-patterns · AutoGen parallelization discussion, https://github.com/microsoft/autogen/discussions/4215 · LangGraph Graph API, https://docs.langchain.com/oss/python/langgraph/graph-api

### 11. Society of Mind (Minsky, 1986)
A philosophical architecture: cognition is a swarm of small "agents of the mind," each too simple to be intelligent alone; intelligence *emerges* from their interaction. Critically, there is *no central controller* — instead, *censors* and *suppressors* gate which agent's voice wins at any moment.
- **Topology:** Unstructured swarm with censor/suppressor overlay. Not a topology you deploy; a design philosophy.
- **Best for:** *Conceptual justification* for spawning heterogeneous specialist agents (1-A's persona set is a SoM instantiation). The censor/suppressor idea is the durable part — modern takes (Sutha 2025) argue it's the only part worth keeping.
- **Failure modes:** Read too literally, it suggests ever-finer agent specialisation, which hits coordination overhead fast. The original 1986 machinery is dated; Minsky himself admitted the framework was underspecified.
- **Token / latency tradeoff:** N/A — not an executable pattern.
- **How "max-N" changes it:** The censor/suppressor layer is what makes SoM safe at scale — without it, max-N agents produce noise. **This is the conceptual license for the mandatory Judge/Orchestrator role** that filters subagent output.
- **Sources:** Minsky, *The Society of Mind*, 1986, https://en.wikipedia.org/wiki/Society_of_Mind · Sutha, *Revisiting Minsky's Society of Mind in 2025*, https://suthakamal.substack.com/p/revisiting-minskys-society-of-mind · Singh, *Examining the Society of Mind*, https://www.jfsowa.com/ikl/Singh03.htm · Masood, *Minsky's Society of Mind in 2025*, https://medium.com/@adnanmasood/minskys-society-of-mind-in-2025-durable-ideas-dated-machinery-pragmatic-leadership-lessons-7519d09a5bc9

### 12. Stigmergy — indirect coordination through environment artifacts
Agents don't communicate directly; they *modify a shared environment*, and other agents react to those modifications. Term coined by Grassé (1959) for termite mound-building; the LLM version is "agents read/write a shared file and react to its state."
- **Topology:** N-to-N via an *environment artifact* (file, board, queue). No direct messages.
- **Best for:** *Asynchronous* coordination where agents don't need to be co-temporal. The exigo pattern of a shared worklog file is stigmergic — each subagent reads the log, writes its section, and the next subagent reacts to the updated log.
- **Failure modes:** "Pheromone decay" — without cleanup, old artifacts accumulate and confuse new agents. Conflicting writes. Race conditions when two agents write simultaneously. Loss of intent — the artifact doesn't record *why* a change was made, only *what* changed.
- **Token / latency tradeoff:** Cheap to write; agents re-read only when they need to. Latency is determined by polling frequency.
- **How "max-N" changes it:** **Scales well to high N** because coordination is mediated by the artifact, not by N² messages. The artifact must be structured (schema, sections, timestamps) or it degrades into noise. **This is the canonical pattern for the exigo shared-worklog model** that this very brainstorm session is using.
- **Sources:** Grassé, *La reconstruction du nid*, 1959 — via ScienceDirect, https://www.sciencedirect.com/topics/engineering/stigmergy · arXiv:2601.08129, *Emergent Coordination via Pressure*, https://arxiv.org/html/2601.08129v3 · r/LocalLLaMA, *Stigmergy pattern for multi-agent LLM orchestration*, https://www.reddit.com/r/LocalLLaMA/comments/1qv3o3o/p_stigmergy_pattern_for_multiagent_llm · GitHub discussion, *Production multi-agent system with stigmergy*, https://github.com/orgs/community/discussions/186260 · Zylos research, *Swarm Intelligence for AI Agents*, May 2026, https://zylos.ai/research/2026-05-23-swarm-intelligence-multi-agent-coordination-patterns

### 13. ChatDev / MetaGPT — SOP-driven software-engineering multi-agent
Encode a *Standard Operating Procedure* (waterfall phases, role handoffs, structured artifacts) as the agent topology. ChatDev uses a waterfall (Design → Code → Test → Document) with "chat chains" between adjacent roles; MetaGPT encodes a whole software company (PM, architect, engineer, QA, docs) with structured intermediate artifacts (PRD, design doc, code, test report).
- **Topology:** Sequential pipeline of role-pair chats (ChatDev) or hierarchical-with-SOP (MetaGPT). The SOP *is* the topology.
- **Best for:** *Execution* of well-understood multi-step processes (software dev, content production, research reports). The SOP makes the system legible and debuggable.
- **Failure modes:** Brittle to deviations — if the SOP assumes the PM writes a PRD but the user's request doesn't need one, the whole chain stalls. Agents comply with the SOP format but produce low-quality artifacts. The "Code = SOP(Team)" philosophy of MetaGPT means *the SOP is the program*; if it's wrong, no agent-level intelligence rescues it.
- **Token / latency tradeoff:** Sequential phases, so latency = Σ phase times. Each phase is a multi-turn chat. Expensive but predictable.
- **How "max-N" changes it:** SOPs don't parallelise well by construction — the whole point is the *sequence*. Max-N here means *more agents per phase* (e.g. 3 coders instead of 1), which is the orchestrator-worker pattern inside an SOP shell. The MetaGPT/ChatDev contribution is the SOP shell, not the parallelism.
- **Sources:** MetaGPT, arXiv:2308.00352, https://arxiv.org/html/2308.00352v6 · MetaGPT GitHub, https://github.com/foundationagents/metagpt · ChatDev, arXiv:2307.07924, https://arxiv.org/abs/2307.07924 · IBM, *What is ChatDev?*, https://www.ibm.com/think/topics/chatdev · CodeRabbit, https://www.coderabbit.ai · CodeRabbit on Google Cloud Run, Apr 2025, https://cloud.google.com/blog/products/ai-machine-learning/how-coderabbit-built-its-ai-code-review-agent-with-google-cloud-run

### 14. Stanford Smallville / Generative Agents (Park et al., 2023)
25 LLM-powered agents in a 2D sandbox town, each with a *memory stream* (every observation logged with timestamp + recency + importance + relevance scores), a *reflection* routine (periodically synthesise memories into higher-level abstractions), and a *planning* routine (generate a daily schedule, replan when interrupted).
- **Topology:** N agents in a shared environment; interactions are pairwise and emergent.
- **Best for:** *Simulation* of social dynamics; the architecture (memory + reflection + planning) is portable to any long-running agent.
- **Failure modes:** Memory streams grow unbounded (the paper uses recency/importance/relevance scoring to manage this, but the parameters are hand-tuned). Reflection quality depends on the reflection prompt, which the paper spent significant effort on. Agents drift toward stereotypes without reinforcement.
- **Token / latency tradeoff:** High — each agent runs reflection and planning routinely even when idle. The paper's 25-agent town was expensive to run.
- **How "max-N" changes it:** Scales *linearly* in cost (each agent is independent) but the *interesting* dynamics emerge from agent-to-agent interaction, which is pairwise — so to get N(N-1)/2 potential interactions you need O(N²) agent-time, which doesn't scale. Max-N Smallville-style is more of a simulation than a workflow.
- **Sources:** Park et al., *Generative Agents: Interactive Simulacra of Human Behavior*, UIST 2023, https://arxiv.org/abs/2304.03442 · Stanford HAI, https://hai.stanford.edu/news/computational-agents-exhibit-believable-humanlike-behavior · ACM full text, https://dl.acm.org/doi/fullHtml/10.1145/3586183.3606763

### 15. "Village" / "Town Hall" — short-lived + long-lived agents
A mixed-life-cycle pattern: a few *long-lived* agents (the "elders" / "town council") maintain persistent memory and decision authority, while many *short-lived* agents (the "villagers") are spawned per-task, do the work, report back, and die. The long-lived agents carry institutional memory across tasks; the short-lived agents carry no memory between tasks (preventing cross-task contamination).
- **Topology:** Two-tier: small fixed set of long-lived orchestrators, large fan-out of short-lived workers per task.
- **Best for:** *Cross-task continuity* without paying persistent-memory cost for every worker. This is exactly what exigo's `cd-review` loop does (a persistent LOOP.md orchestrator + per-wave short-lived brainstorm/research/verify subagents).
- **Failure modes:** Long-lived agents' context grows over time (need compaction/reflection à la Smallville). Short-lived agents lose institutional knowledge — every task is a cold start. Authority bias: short-lived agents defer to the long-lived ones even when wrong.
- **Token / latency tradeoff:** Long-lived agents cost ongoing tokens for memory management; short-lived agents cost per-task. Total is dominated by short-lived count × task frequency.
- **How "max-N" changes it:** Scales cleanly — the long-lived tier stays small (3-5), the short-lived tier can be max-N per task. **This is the recommended topology for the brainstorm↔research loop.**
- **Sources:** MindStudio, *AI Agents for Long-Running Tasks* (15-day simulation), May 2026, https://www.mindstudio.ai/blog/ai-agents-long-running-tasks-emergence-experiment · arXiv:2606.07513, *Long-Term Life Simulation and Learning in Agent Societies*, Jun 2026, https://arxiv.org/html/2606.07513v1 · Confluent, *Four Design Patterns for Event-Driven Multi-Agent Systems*, Feb 2025, https://www.confluent.io/blog/event-driven-multi-agent-systems · Microsoft, *Multi-agent patterns*, Jul 2026, https://learn.microsoft.com/en-us/agents/architecture/multi-agent-patterns · Dust.tt, *AI Agent Patterns: The 5 You Need to Know*, May 2026, https://dust.tt/blog/ai-agent-patterns

### 16. AgentVerse / AgentBench / MultiAgentBench
Benchmark/framework trio for evaluating multi-agent systems. Not coordination patterns per se, but they encode the *default topologies* the field measures against.
- **AgentVerse** (Chen et al., ICLR 2024): a framework for assembling multi-agent groups that *dynamically adjust composition* across recruitment (decide who's on the team) → task-solving (parallel/sequential execution) → review (critique). The "recruitment" step is a meta-pattern: the orchestrator decides the team per task, rather than fixing it at design time.
- **AgentBench** (Liu et al., ICLR 2024): 8 environments for evaluating LLMs *as single agents* — operational tasks, web shopping, database, card game, etc. Less about multi-agent topology, more about single-agent capability.
- **MultiAgentBench** (ACL 2025, cited 218×): the multi-agent extension — measures not just task completion but the *quality of collaboration and competition*. The first benchmark to score coordination itself.
- **Topology:** AgentVerse = orchestrator + dynamic team; AgentBench = single-agent; MultiAgentBench = configurable.
- **Best for:** *Evaluation*, not production. But the AgentVerse recruitment-then-solve pattern is portable: spawn a *recruiter* subagent that picks which specialist subagents to fan out to, per task.
- **Failure modes:** Benchmarks measure what's easy to measure (task completion), not what matters for brainstorm (novelty, diversity). MultiAgentBench is the closest to addressing coordination quality.
- **Token / latency tradeoff:** N/A (benchmarks).
- **How "max-N" changes it:** AgentVerse's recruitment step is *exactly* the lever for max-N safely — the recruiter picks N per task, rather than fixing N at design time.
- **Sources:** AgentVerse, arXiv:2308.10848, https://arxiv.org/abs/2308.10848 · AgentVerse OpenReview, https://openreview.net/forum?id=EHg5GDnyq1 · AgentBench, arXiv:2308.03688, https://arxiv.org/abs/2308.03688 · AgentBench GitHub, https://github.com/THUDM/AgentBench · MultiAgentBench, ACL 2025, https://aclanthology.org/2025.acl-long.421.pdf

### 17. EvoAgent / Tournament-of-Prompts (evolutionary multi-agent)
Use an *evolutionary algorithm* to generate/seed the agent population: agents are "individuals," prompts are "genomes," fitness is task performance, crossover/mutation produce the next generation. EvoAgent (NAACL 2025) is the canonical instance; "Tournament of Prompts" applies the same idea to prompt optimization.
- **Topology:** Generation-to-generation, N-per-generation. Within a generation, independent; across generations, sequential.
- **Best for:** *Divergence* over many cycles — each generation's survivors seed the next, so diversity is preserved by selection pressure rather than by random injection. This is the *cross-cycle* pattern that 1-A's evolutionary ideation recommendation points to.
- **Failure modes:** Premature convergence to a local optimum (genetic-algorithm classic). Diversity collapse if the fitness function is too greedy. Mutation rate too high = noise; too low = stagnation.
- **Token / latency tradeoff:** G generations × N agents. Sequential across generations (each needs the prior's fitness), parallel within. Expensive.
- **How "max-N" changes it:** Larger N per generation = more genetic diversity = slower convergence. For brainstorm, *you want slow convergence* — max-N per generation is appropriate. For research/verification, smaller N is better (you don't need genetic diversity, you need correctness).
- **Sources:** EvoAgent, arXiv:2406.14228, https://arxiv.org/abs/2406.14228 · EvoAgent NAACL 2025, https://aclanthology.org/2025.naacl-long.315 · EvoAgent project site, https://evo-agent.github.io · Tournament of Prompts, OpenReview, https://openreview.net/forum?id=Z9OsLgBCDG · Sakana AI Digital Red Queen, https://pub.sakana.ai/drq

---

## Synthesis

### Best pattern for BRAINSTORM phase (max-N parallel)

**Winner: Orchestrator-Worker with mandatory persona-diversification, wrapped in a Stigmergic shared-file coordination layer, with a single non-parallel Judge/Orchestrator acting as the censor/suppressor layer.**

Why not naive fan-out / best-of-N? Because the diversity literature (Deng & Brucks 2026, cited in 1-A) is unambiguous: max-N *independent* samples from the same prompt are *less* diverse than N human samples, and the gap *widens* with N. The bottleneck for the brainstorm half is not generation throughput — it's *diversity preservation under scale*.

The right pattern is therefore **fan-out + diversity pressure**:
1. The **Orchestrator** (long-lived, persistent context) writes a *diversification spec* — the persona set from 1-A (Dreamer, Skeptic, Engineer, Outsider, Cross-Domain Synthesizer), each with a *disagreement mandate*, plus per-subagent seed stimuli (random inputs from 1-A's lateral-thinking family).
2. The **Orchestrator fans out N subagents** where N is "maxed out" — but with the constraint that *no two subagents share the same (persona, seed) tuple*. This is the diversity-pressure lever: max-N parallelism is safe only if the N prompts are themselves diverse.
3. Each subagent runs in **context isolation** (Anthropic's canonical rule): it sees only (a) its persona mandate, (b) its seed stimulus, (c) the problem statement — *not* the orchestrator's scratchpad, *not* other subagents' drafts. This is the single most important rule. Anchoring bias in LLMs is empirically 22–61% (arXiv:2505.15392); leaking parent context guarantees it.
4. Subagents write to the **shared worklog** (stigmergy) — each gets its own slot — and die. They do *not* see each other's slots within the phase. This is the Brainwriting 6-3-5 / NGT "silent generation" rule from 1-B: parallel independent generation *first*, collection *after*.
5. The **Judge** (single, non-parallel) clusters, dedups, and ranks the outputs into a shortlist using the affinity-mapping/KJ pattern from 1-B.

**Topology summary:** 1 long-lived Orchestrator (writes diversification spec) → N short-lived parallel Workers (each isolated, each persona+seed-unique) → 1 long-lived Judge (clusters + ranks) → writes shortlist to worklog → next phase.

The "max-N" lever is safe here *because* the diversity is structural (persona × seed matrix), not statistical (high-temperature sampling). The Deng & Brucks failure mode is bypassed.

### Best pattern for RESEARCH phase (max-N parallel)

**Winner: Map-Reduce with ReAct subagents, scoped to the shortlist from the brainstorm phase, with parallelism bounded by the shortlist size (not arbitrary max).**

The research phase is the *verification* half — its job is to test each top idea's riskiest assumption (1-B's "research after brainstorm" finding). This is exactly what ReAct is for (1-A #4): each subagent gets one idea, runs interleaved reasoning + tool calls (search, code exec, file reads), and returns a verified finding.

The pattern:
1. The **Orchestrator** reads the brainstorm shortlist from the worklog (stigmergy) and emits a `Send(research_worker, idea)` per shortlist item. The map step's N is *the shortlist size*, not arbitrary — this is the key cost-control lever. (1-A's Liang et al. finding: LLMs are already good at novelty, bad at feasibility — so the research phase's job is *feasibility testing*, not exploration.)
2. Each **research worker** runs ReAct with a *bounded tool budget* (5–10 tool calls max) and a *bounded token budget*. It writes its findings back to its own slot in the worklog.
3. The **reduce step** (Judge) reads all worker outputs and produces a verdict per idea: kill / refine / advance. This is where the pre-mortem (1-B #6) lives — for each idea that survives, the Judge runs a prospective-hindsight critique ("it's 6 months later, this idea failed — why?").

**Why not max-N here?** Because research subagents each consume tool budget (latency + cost), and the marginal value drops fast. The right N is the shortlist size, typically 3–7. Spawning 30 research subagents on 3 ideas is just 10 redundant verifications per idea — convergence, not divergence, so Best-of-N applies and you get the Deng & Brucks mode collapse. Better: spawn 1–2 research subagents per idea, each with a different *verification strategy* (one searches for prior art, one searches for failure modes, one writes a falsifying test).

### How to connect the two phases

**Feedback loop:** The research phase's *kill / refine / advance* verdicts feed back into the next brainstorm cycle as *constraints*, not as context.

This is the second-most-important design rule (after context isolation). If the research phase's findings are dumped into the next brainstorm's prompt, the next brainstorm *anchors* on them — the LLM will produce ideas that look like refinements of the killed ideas, not genuinely new directions. This is the Stepladder technique from 1-B (#7): new subagents must prepare *before* seeing prior consensus.

The right connection is therefore:
1. Research phase writes *verdicts* to the worklog: "Idea X killed because Assumption A is false" / "Idea Y advanced, viable path identified" / "Idea Z refined, new direction W opened."
2. The next brainstorm cycle's Orchestrator reads these verdicts and translates them into *constraints for the new diversification spec*: "Do not generate ideas that depend on Assumption A" / "Build on direction W" / "Avoid the family of Idea X."
3. The new brainstorm subagents see the *constraints*, not the *verdicts* and not the *killed ideas themselves*. This preserves novelty (they're not refining killed ideas) while absorbing the research learning (they avoid known-dead-ends).

This is the **Delphi method** pattern from 1-B (#17): multi-round parallel ideation with *anonymised aggregation* between rounds. The aggregation is the constraint extraction, not the raw findings.

### How to "max out" count safely

The three failure modes to avoid (from the task):
1. **Mode collapse / echo chamber** — caused by max-N independent sampling from the same prompt (Deng & Brucks). Fixed by structural diversification (persona × seed matrix) so no two subagents share a (persona, seed) tuple.
2. **Context budget blowup** — caused by subagents reading the parent's full context (anchoring + token cost) or reading each other's outputs (N² context bloat). Fixed by strict context isolation: each subagent sees only (persona mandate, seed, problem statement). The Orchestrator's full scratchpad never leaves the Orchestrator.
3. **Loss of diversity** — caused by premature convergence (debate, sycophancy) or by Judge-side authority bias (Judge's prior leaks into ranking). Fixed by (a) no inter-subagent communication within a phase, (b) Judge uses anonymised/clustered outputs not raw drafts, (c) Judge ranking criteria are pre-declared (1-B #4: anonymous weighted voting with pre-published criteria).

The "max" in max-N is therefore not "spawn as many as the API allows" — it's "spawn as many as the diversification matrix supports, given the persona set × seed set." Concretely: 5 personas × 6 seeds = 30 max-N. Going beyond requires either more personas (risk: personas become stereotyped) or more seeds (risk: seeds become noise).

### Should subagents see each other? within phase / across phase

**Within a phase: NO.** This is non-negotiable. The 1-B finding is unambiguous: Mullen, Johnson & Salas (1991) meta-analysis shows *nominal groups* (independent individuals, pooled) outperform *interactive groups* on both quantity AND quality. The Diehl & Stroebe (1987) failure modes (production blocking, evaluation apprehension, anchoring, free-riding) all require real-time visibility into others' outputs. The Anthropic context-isolation rule is the LLM instantiation of this: subagents in parallel don't see each other's drafts.

The one exception: the Judge's clustering step *must* see all drafts — but the Judge is a separate role, not a subagent peer, and it sees them simultaneously (post-hoc), not streaming.

**Across phases: PARTIALLY, via the Orchestrator's translation.** The next phase's subagents should see the *constraints extracted from* the prior phase, not the prior phase's *raw outputs*. The Orchestrator is the only agent that sees both phases' raw outputs; it translates between them. This is the Stepladder + Delphi pattern from 1-B: cross-round continuity without cross-round contamination.

### Mandatory non-parallel Judge/Orchestrator role

**Yes, mandatory.** The Judge/Orchestrator is the *censor/suppressor* layer from Minsky's Society of Mind (#11), the *manager LLM* from CrewAI hierarchical, the *lead agent* from Anthropic's Research system. It is the single point of convergence in a system otherwise made of divergence.

What it does (non-parallelisable by construction):
1. **Diversification spec authoring** (brainstorm pre-step): writes the persona mandates + seed stimuli. This requires *judgement* about what's missing from the prior cycle, not parallelizable.
2. **Shortlist clustering + ranking** (brainstorm post-step): affinity-maps the N drafts into K clusters, picks the top cluster representatives. Requires seeing all N drafts *simultaneously* — can't be done in parallel.
3. **Decomposition into research tasks** (research pre-step): for each shortlisted idea, identifies the riskiest assumption and writes the research-worker prompt. Judgement, not parallelizable.
4. **Verdict synthesis** (research post-step): reads all research findings, produces kill/refine/advance per idea. Requires cross-idea reasoning.
5. **Constraint extraction for next cycle** (cross-cycle): translates this cycle's verdicts into next cycle's diversification constraints. This is the *learning* step — the thing that makes the loop close.

Why non-parallelisable: every one of these steps requires either (a) seeing all N outputs simultaneously (clustering, ranking, synthesis) or (b) exercising judgement about what to do next (spec authoring, decomposition, constraint extraction). Both are inherently sequential — they are the *reduce* in map-reduce, and reduce is sequential by definition when the reducer needs global view.

The Judge/Orchestrator should be the *long-lived* agent (Village/Town-Hall pattern, #15) — it carries institutional memory across cycles. The workers are *short-lived* — they die after writing to the worklog. This division is what keeps the long-lived agent's context bounded: it only ever sees summaries, never raw worker transcripts (which would blow its context in 2–3 cycles).

### How this maps to the exigo worklog pattern

The exigo `cd-review` loop (the prior art in this repo) already instantiates most of this:
- The `LOOP.md` file is the long-lived Orchestrator's persistent state.
- The `brainstorms/` directory is the stigmergic shared board.
- The `audits/` directory is the research-phase findings.
- Each per-wave subagent (1-A, 1-B, 1-C) is a short-lived worker that reads the worklog, writes its section, dies.
- The worklog itself is the cross-cycle constraint channel — 1-C read 1-A and 1-B's summaries (not their raw scratchpads) and is writing under their constraints.

The brainstorm↔research loop to be designed should formalise this pattern with explicit: persona-mandate specs (brainstorm), assumption-targeted ReAct prompts (research), kill/refine/advance verdicts (Judge), and constraint extraction (Orchestrator for next cycle).

---

## Sources (consolidated)

### Production multi-agent engineering
- Anthropic, *How we built our multi-agent research system*, Jun 2025 — https://www.anthropic.com/engineering/multi-agent-research-system
- Anthropic, *Effective context engineering for AI agents*, Sep 2025 — https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Anthropic, *Building Effective AI Agents: Architecture Patterns* (PDF) — https://resources.anthropic.com/hubfs/Building%20Effective%20AI%20Agents-%20Architecture%20Patterns%20and%20Implementation%20Frameworks.pdf
- The AI Engineer, *How Anthropic Built Multi-Agent Deep Research* — https://theaiengineer.substack.com/p/how-anthropic-built-multi-agent-deep
- Fountain City, *Anthropic's Multi-Agent Blueprint: We Validated It in Production*, May 2026 — https://fountaincity.tech/resources/blog/anthropic-multi-agent-blueprint-production
- ByteByteGo, *How Anthropic Built a Multi-Agent Research System* — https://blog.bytebytego.com/p/how-anthropic-built-a-multi-agent
- ZenML LLMOps Database, *Anthropic: Building a Multi-Agent Research System* — https://www.zenml.io/llmops-database/building-a-multi-agent-research-system-for-complex-information-tasks
- MindStudio, *How Claude Code Parallel Agents Coordinate Through an Orchestrator*, Apr 2026 — https://mindstudio.ai/blog/claude-code-agent-teams-parallel-agents
- MindStudio, *Claude Code Agent Teams Deep Dive: Parallel Shared Task List*, Apr 2026 — https://www.mindstudio.ai/blog/claude-code-agent-teams-parallel-shared-task-list
- MindStudio, *Smart Orchestrator Model to Direct Cheaper Sub-Agent Models*, May 2026 — https://www.mindstudio.ai/blog/smart-orchestrator-cheaper-sub-agent-models-claude-code
- Hidekazu Konishi, *Claude Code Subagents and Multi-Agent Orchestration*, Jun 2026 — https://hidekazu-konishi.com/entry/claude_code_subagents_and_orchestration_guide.html
- AakashX, *Parallel Claude Code Agents: Safe Workflow Guide*, May 2026 — https://www.aakashx.com/blog/parallel-claude-code-agents
- Alireza Rezvani, *From Subagents to Agent Teams* — https://alirezarezvani.medium.com/from-subagents-to-agent-teams-claude-codes-multi-agent-leap-and-what-i-actually-change-97edf83a4d5e
- Claude Platform Docs, *Build an orchestration mode* — https://platform.claude.com/docs/en/build-with-claude/mid-conversation-effort-example

### Pattern catalogs & taxonomies
- ExplainX, *Multi-Agent Orchestration Patterns: Production Guide for 2026*, Jun 2026 — https://explainx.ai/blog/multi-agent-orchestration-patterns-guide-2026
- Azure Architecture Center, *AI Agent Orchestration Patterns*, Feb 2026 — https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns
- Towards AI, *Agent Workflow Patterns — Beyond Anthropic's Playbook* — https://pub.towardsai.net/agent-workflow-patterns-beyond-anthropics-playbook-1bd76a48d63d
- StackAI, *AI Agent Architecture Patterns: Sequential, Parallel, and Hierarchical*, Feb 2026 — https://www.stackai.com/insights/ai-agent-architecture-patterns-sequential-parallel-and-hierarchical-workflows
- GuruSup, *Agent Orchestration Patterns: Swarm vs Mesh vs Hierarchical*, May 2026 — https://gurusup.com/blog/agent-orchestration-patterns
- Glukhov, *Multi-Agent Orchestration Patterns: A Practical Guide* — https://www.glukhov.org/ai-systems/architecture/multi-agent-orchestration-patterns
- Dust.tt, *AI Agent Patterns: The 5 You Need to Know*, May 2026 — https://dust.tt/blog/ai-agent-patterns
- Microsoft, *Multi-agent patterns*, Jul 2026 — https://learn.microsoft.com/en-us/agents/architecture/multi-agent-patterns
- agentpatterns.ai, *Orchestrator-Worker* — https://agentpatterns.ai/multi-agent/orchestrator-worker

### Fan-out failure modes & cost
- Towards AI, *Multi-Agent Fan-Out: When Parallelism Bites Back*, May 2026 — https://pub.towardsai.net/multi-agent-fan-out-when-parallelism-bites-back-c42656dd4d2f
- Synchronized Code Lab, *Multi-Agent AI Systems: When They're Worth It*, Jul 2026 — https://synchronizedcodelab.com/blogs/multi-agent-ai-systems-when-worth-the-cost
- MindStudio, *Parallel Agent Execution vs Sequential Agents*, May 2026 — https://www.mindstudio.ai/blog/parallel-agent-execution-vs-sequential-agents
- Cobus Greyling, *Orchestrating Parallel AI Agents* — https://cobusgreyling.medium.com/orchestrating-parallel-ai-agents-dab96e5f2e61
- Latenode community, *How much does complexity actually cost*, Oct 2025 — https://community.latenode.com/t/how-much-does-complexity-actually-cost-when-youre-running-multiple-autonomous-ai-agents-in-parallel-on-one-subscription/54729
- LinkedIn (Kanis Patel), *Multi-agent AI keeps collapsing back into one agent* — https://www.linkedin.com/pulse/multi-agent-ai-keeps-collapsing-back-one-agent-fair-test-kanis-patel-t5jgc
- arXiv:2507.08944, *Optimizing Sequential Multi-Step Tasks with Parallel LLM*, Jul 2025 — https://arxiv.org/html/2507.08944v1

### Debate failure modes (cross-referenced from 1-A)
- Du et al., *Improving Factuality and Reasoning through Multiagent Debate*, ICML 2024 — https://arxiv.org/abs/2305.14325
- Smit et al., *Should We Be Going MAD?*, ICML 2024
- *Understanding Failure Modes in Multi-Agent Debate*, ICML 2025 — https://arxiv.org/html/2509.05396v1
- *How Sycophancy Shapes Multi-Agent Debate*, Sep 2025 — https://arxiv.org/html/2509.23055v1
- *Multi-Agent Debate for LLM Judges with Adaptive Stability*, arXiv:2510.12697 — https://arxiv.org/html/2510.12697v1
- Amazon Science, *Enhancing LLM-as-a-Judge via Multi-Agent Collaboration* — https://cdn.amazon.science/48/5d/20927f094559a4465916e28f41b5/enhancing-llm-as-a-judge-via-multi-agent-collaboration.pdf
- ModalityDance, *Awesome-Agent-as-a-Judge* — https://github.com/ModalityDance/Awesome-Agent-as-a-Judge

### Diversity & mode collapse
- Verbalized Sampling, arXiv:2510.01171, Oct 2025 — https://arxiv.org/html/2510.01171v1
- DIPPER (NUS) — https://www.comp.nus.edu.sg/~greglau/assets/pdf/arr_dipper.pdf
- Deng & Brucks 2026, *Barriers to Diversity in LLM-Generated Ideas* — https://arxiv.org/abs/2602.20408
- Vilnis & Clark, *Arithmetic Sampling: Parallel Diverse Decoding*, ICML 2023 — https://proceedings.mlr.press/v202/vilnis23a/vilnis23a.pdf

### Anchoring bias
- arXiv:2412.06593, *Anchoring Bias in Large Language Models*, Dec 2024 — https://arxiv.org/html/2412.06593v1
- arXiv:2505.15392, *Understanding the Anchoring Effect of LLM*, Mar 2026 — https://arxiv.org/html/2505.15392v2
- Lyle Tagawa, *LLM Context Biases*, May 2026 — https://lyletagawa.com/posts/llm-context-biases
- MindStudio, *Social Context Anchoring Bias in AI Agents*, Mar 2026 — https://www.mindstudio.ai/blog/social-context-anchoring-bias-ai-agents

### Recursive / hierarchical
- RecursiveMAS, arXiv:2604.25917 — https://arxiv.org/html/2604.25917v1
- Recursive Agent Hive — https://www.emergentmind.com/topics/recursive-agent-hive
- OpenAI Codex issue #9912, *Configurable Maximum Agent Recursion Depth*, Jan 2026 — https://github.com/openai/codex/issues/9912
- r/AI_Agents, *Multi-Agent System Caught in Infinite Recursion* — https://www.reddit.com/r/AI_Agents/comments/1nie8u5/help_multiagent_system_caught_in_infinite
- Hierarchical MAS overview — https://overcoffee.medium.com/hierarchical-multi-agent-systems-concepts-and-operational-considerations-e06fff0bea8c
- Level Up, *Recursive Multi-Agent Systems: From Research Paper to Implementation*, May 2026 — https://levelup.gitconnected.com/recursive-multi-agent-systems-from-research-paper-to-implementation-three-implementations-9262f4bfcd9c
- Towards AI, *Multi-Agent Systems That Stop Talking and Start Thinking*, Apr 2026 — https://pub.towardsai.net/multi-agent-systems-that-stop-talking-and-start-thinking-3a1df0997b20

### Map-Reduce / LangGraph
- LangGraph Graph API — https://docs.langchain.com/oss/python/langgraph/graph-api
- LangGraph forum, *Best practices for parallel nodes (fanouts)*, Oct 2025 — https://forum.langchain.com/t/best-practices-for-parallel-nodes-fanouts/1900
- AstropomeAI, *Implementing Map-Reduce with LangGraph* — https://medium.com/@astropomeai/implementing-map-reduce-with-langgraph-creating-flexible-branches-for-parallel-execution-b6dc44327c0e
- AI Practitioner, *Scaling LangGraph Agents: Parallelization, Subgraphs*, — https://aipractitioner.substack.com/p/scaling-langgraph-agents-parallelization
- Machine Learning Plus, *LangGraph Map-Reduce: Parallel Execution with Send API* — https://machinelearningplus.com/gen-ai/langgraph-map-reduce-parallel-execution

### CrewAI / AutoGen
- CrewAI Processes — https://docs.crewai.com/en/concepts/processes
- CrewAI Hierarchical Process — https://docs.crewai.com/v1.15.2/en/learn/hierarchical-process
- CrewAI community, *Does hierarchical process even work?* — https://community.crewai.com/t/does-hierarchical-process-even-work-your-experience-is-highly-appreciated/2690
- Contracollective, *CrewAI vs AutoGen*, Apr 2026 — https://contracollective.com/blog/crewai-vs-autogen-multi-agent-frameworks-2026
- AutoGen Group Chat — https://microsoft.github.io/autogen/stable//user-guide/core-user-guide/design-patterns/group-chat.html
- AutoGen Conversation Patterns — https://microsoft.github.io/autogen/0.2/docs/tutorial/conversation-patterns
- AutoGen parallelization discussion #4215 — https://github.com/microsoft/autogen/discussions/4215
- Microsoft Agent Framework, *Group Chat Orchestration* — https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/group-chat

### Swarm / handoff
- OpenAI Swarm (GitHub) — https://github.com/openai/swarm
- Galileo, *OpenAI Swarm Framework Guide* — https://galileo.ai/blog/openai-swarm-framework-multi-agents
- Strands Agents, *Swarm Multi-Agent Pattern* — https://strandsagents.com/docs/user-guide/concepts/multi-agent/swarm

### Blackboard / shared memory
- Data-Flair, *Blackboard Architecture in Agentic AI* — https://data-flair.training/blogs/blackboard-architecture-in-agentic-ai
- Schepis, *Patterns for Democratic Multi-Agent AI: Blackboard* — https://medium.com/@edoardo.schepis/patterns-for-democratic-multi-agent-ai-blackboard-architecture-part-1-69fed2b958b4
- arXiv:2510.01285, *LLM-based Multi-Agent Blackboard System* — https://arxiv.org/html/2510.01285v1
- JumpCloud, *Understanding Shared Memory in Multi-Agent Systems*, Mar 2026 — https://jumpcloud.com/it-index/understanding-shared-memory-in-multi-agent-systems
- mem0.ai, *Multi-Agent Memory Systems*, Mar 2026 — https://mem0.ai/blog/multi-agent-memory-systems
- GreenNode, *Best Memory Architecture for Multi-Agent*, Mar 2026 — https://greennode.ai/blog/memory-architecture-for-ai-agents

### Actor model
- *Message Passing and the Actor Model*, dist-prog-book — http://dist-prog-book.com/chapter/3/message-passing.html
- Shaman AI agent-actors — https://github.com/shaman-ai/agent-actors/blob/main/launch.md
- PradeepL, *Akka Actor Model: Foundation for Concurrent AI Agents*, Apr 2026 — https://pradeepl.com/blog/agentic-ai/akka-actor-model-agentic-ai
- Swarm Tools, *Actor Model* — https://www.swarmtools.ai/docs/concepts/actor-model
- Kartikeya Sharma, *Building Multi-Agent AI with the Actor Model* — https://medium.com/@kartikeyasharma/building-a-multi-agent-ai-system-with-the-actor-model-a-deep-dive-into-scalable-concurrent-ai-2e838c9815d9

### Society of Mind
- Minsky, *The Society of Mind*, 1986 — https://en.wikipedia.org/wiki/Society_of_Mind
- Sutha, *Revisiting Minsky's Society of Mind in 2025* — https://suthakamal.substack.com/p/revisiting-minskys-society-of-mind
- Singh, *Examining the Society of Mind* — https://www.jfsowa.com/ikl/Singh03.htm
- Masood, *Minsky's Society of Mind in 2025* — https://medium.com/@adnanmasood/minskys-society-of-mind-in-2025-durable-ideas-dated-machinery-pragmatic-leadership-lessons-7519d09a5bc9
- Principus, *Marvin Minsky: The Society of Mind*, Sep 2025 — https://principus.si/2025/09/12/marvin-minsky-the-society-of-mind

### Stigmergy
- ScienceDirect, *Stigmergy* (Grassé 1959 origin) — https://www.sciencedirect.com/topics/engineering/stigmergy
- arXiv:2601.08129, *Emergent Coordination via Pressure* — https://arxiv.org/html/2601.08129v3
- r/LocalLLaMA, *Stigmergy pattern for multi-agent LLM orchestration* — https://www.reddit.com/r/LocalLLaMA/comments/1qv3o3o/p_stigmergy_pattern_for_multiagent_llm
- GitHub discussion, *Production multi-agent system with stigmergy* — https://github.com/orgs/community/discussions/186260
- Zylos, *Swarm Intelligence for AI Agents*, May 2026 — https://zylos.ai/research/2026-05-23-swarm-intelligence-multi-agent-coordination-patterns
- Medium (jsmith0475), *Collective Stigmergic Optimization* — https://medium.com/@jsmith0475/collective-stigmergic-optimization-leveraging-ant-colony-emergent-properties-for-multi-agent-ai-55fa5e80456a

### ChatDev / MetaGPT / CodeRabbit
- MetaGPT, arXiv:2308.00352 — https://arxiv.org/html/2308.00352v6
- MetaGPT GitHub — https://github.com/foundationagents/metagpt
- ChatDev, arXiv:2307.07924 — https://arxiv.org/abs/2307.07924
- ChatDev ACL 2024 — https://aclanthology.org/2024.acl-long.810.pdf
- IBM, *What is ChatDev?* — https://www.ibm.com/think/topics/chatdev
- Diva-Portal, *Characterizing and improving ChatDev coding performance*, 2025 — https://www.diva-portal.org/smash/get/diva2:1931827/FULLTEXT01.pdf
- CodeRabbit — https://www.coderabbit.ai
- Google Cloud, *How CodeRabbit built its AI code review agent*, Apr 2025 — https://cloud.google.com/blog/products/ai-machine-learning/how-coderabbit-built-its-ai-code-review-agent-with-google-cloud-run
- CodeRabbit, *Pipeline AI vs Agentic AI for Code Reviews*, May 2025 — https://www.coderabbit.ai/blog/pipeline-ai-vs-agentic-ai-for-code-reviews-let-the-model-reason-within-reason

### Smallville / Generative Agents
- Park et al., *Generative Agents: Interactive Simulacra of Human Behavior*, UIST 2023 — https://arxiv.org/abs/2304.03442
- Stanford HAI — https://hai.stanford.edu/news/computational-agents-exhibit-believable-humanlike-behavior
- ACM full text — https://dl.acm.org/doi/fullHtml/10.1145/3586183.3606763
- The Sequence, *Inside Generative Agents* — https://thesequence.substack.com/p/edge-322-inside-generative-agents

### AgentVerse / AgentBench / MultiAgentBench
- AgentVerse, arXiv:2308.10848 — https://arxiv.org/abs/2308.10848
- AgentVerse OpenReview — https://openreview.net/forum?id=EHg5GDnyq1
- AgentBench, arXiv:2308.03688 — https://arxiv.org/abs/2308.03688
- AgentBench GitHub — https://github.com/THUDM/AgentBench
- MultiAgentBench, ACL 2025 — https://aclanthology.org/2025.acl-long.421.pdf
- Emergent Mind, *MultiAgentBench* — https://www.emergentmind.com/topics/multiagentbench
- Galileo, *Benchmarking Multi-Agent AI* — https://galileo.ai/blog/benchmarks-multi-agent-ai

### Evolutionary multi-agent
- EvoAgent, arXiv:2406.14228 — https://arxiv.org/abs/2406.14228
- EvoAgent NAACL 2025 — https://aclanthology.org/2025.naacl-long.315
- EvoAgent project site — https://evo-agent.github.io
- Tournament of Prompts, OpenReview — https://openreview.net/forum?id=Z9OsLgBCDG
- Sakana AI, *Digital Red Queen* — https://pub.sakana.ai/drq

### MoE
- NVIDIA, *Applying MoE in LLM Architectures*, Mar 2024 — https://developer.nvidia.com/blog/applying-mixture-of-experts-in-llm-architectures
- MoE survey, arXiv:2507.11181 — https://arxiv.org/html/2507.11181v1
- IBM, *What is mixture of experts?* — https://www.ibm.com/think/topics/mixture-of-experts
- Cameron Wolfe, *MoE LLMs* — https://cameronrwolfe.substack.com/p/moe-llms

### Long-lived / Village patterns
- MindStudio, *AI Agents for Long-Running Tasks* (15-day simulation), May 2026 — https://www.mindstudio.ai/blog/ai-agents-long-running-tasks-emergence-experiment
- arXiv:2606.07513, *Long-Term Life Simulation and Learning in Agent Societies*, Jun 2026 — https://arxiv.org/html/2606.07513v1
- Confluent, *Four Design Patterns for Event-Driven Multi-Agent Systems*, Feb 2025 — https://www.confluent.io/blog/event-driven-multi-agent-systems
