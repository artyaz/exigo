# 1-B — Human Brainstorming Methods (research)

**Task ID:** 1-B
**Scope:** Survey of human-side brainstorming / Creative-Problem-Solving techniques, with explicit focus on (a) which ones parallelize cleanly across multiple participants → mapping humans → AI subagents, and (b) which convergence/critique steps from human practice should be mandatory in the AI loop.
**Date of survey:** 2026-07-18

---

## Methods surveyed

Each entry: name + 1-sentence description · divergence/convergence phase · does it include an explicit critique/verify step? · does it parallelize across multiple participants? · group size designed for · known failure modes · source.

The recurring failure-mode vocabulary used below — **production blocking** (turn-taking blocks idea generation), **evaluation apprehension** (fear of being judged suppresses ideas), **free-riding / social loafing**, **anchoring** (first idea spoken dominates), **groupthink** — comes from Diehl & Stroebe's classic JPSR 1987 productivity-loss studies, summarised in Mullen, Johnson & Salas's 1991 meta-analysis (cited 1400+ times).

---

### 1. Osborn-Parnes CPS (Creative Problem Solving, 1953–1967)
The original 6-step creative process: **Mess-Finding → Fact-Finding → Problem-Finding → Idea-Finding → Solution-Finding → Acceptance-Finding**, where each step alternates a divergent sub-phase (generate many) with a convergent sub-phase (select/cluster).
- **Phase:** Both — by design every step is a divergence→convergence pair. This is the canonical "rhythm" we want to copy.
- **Critique/verify step?** Yes — convergent sub-phases are explicit selection+evaluation, and the final Acceptance-Finding step is a deliberate critique of feasibility/adoption barriers.
- **Parallelizes?** Partially — the divergent sub-phases can be done in parallel by multiple participants; the convergent sub-phases are typically a group activity (and the source of most failure modes).
- **Group size:** Originally designed for 5–12; works at any size if divergence is done individually first.
- **Failure modes:** Without enforced individual divergence first, the convergent phases collapse into groupthink; the structure is heavy (6 steps × 2 phases = 12 sub-stages) and teams routinely skip convergence steps to "get to ideas faster."
- **Source:** Osborn, *Applied Imagination*, 1953/1963. Parnes, Noller & Biondi, *Guide to Creative Action*, 1977. Creative Education Foundation, https://www.creativeeducationfoundation.org/what-is-cps ; Berkeley CPS handbook, https://brdo.berkeley.edu/sites/default/files/cps_handbook.pdf ; JSTOR overview https://www.jstor.org/stable/25062298

### 2. Alex Osborn's 4 Rules of Brainstorming (1953)
The four ideation rules originally proposed for the divergent phase of CPS: **(1) Focus on quantity, not quality; (2) Withhold criticism; (3) Welcome wild/unusual ideas; (4) Combine and improve on others' ideas.**
- **Phase:** Pure divergence — these are the rules *of* the divergent phase.
- **Critique/verify step?** Explicitly NO — rule 2 forbids criticism *during* divergence. Critique is deferred to a separate convergence phase. This is a feature, not a bug: separating generate-from-evaluate is the entire point.
- **Parallelizes?** Surface reading suggests yes (everyone brainstorms together). Empirical reality: NO — see #16 NGT and the Mullen 1991 meta-analysis. The four rules are necessary but not sufficient; without an enforced silent/written generation step, the rules don't actually deliver their promised gains.
- **Group size:** Osborn advocated 5–10; research shows nominal groups (individuals working alone, pooled) outperform interactive groups of any size on quantity *and* quality.
- **Failure modes:** Production blocking, evaluation apprehension, social loafing — all empirically demonstrated as productivity losses even when the four rules are followed. The rules don't cure the medium; verbal real-time brainstorming is structurally broken regardless of rules.
- **Source:** Osborn, *Applied Imagination* (1953). Regent University retrospective, https://www.regent.edu/journal/journal-of-transformative-innovation/the-history-of-brainstorming-alex-osborn ; The Decision Lab summary, https://thedecisionlab.com/reference-guide/management/brainstorming

### 3. Design Thinking Double Diamond (Design Council, 2005)
Two back-to-back divergence→convergence diamonds: **Discover** (diverge — explore the problem widely) → **Define** (converge — frame the specific problem) → **Develop** (diverge — explore solutions) → **Deliver** (converge — prototype, test, ship).
- **Phase:** Both — the whole point is two divergence→convergence cycles, the first on the *problem*, the second on the *solution*.
- **Critique/verify step?** Yes — Define and Deliver are convergent; Deliver specifically requires building/testing prototypes against users (external verification).
- **Parallelizes?** Discover and Develop divergence can be parallel across participants; Define and Deliver convergence are typically small-group.
- **Group size:** 4–8 typical; the model is process-level so it scales.
- **Failure modes:** Teams routinely collapse the first diamond ("we already know the problem") and start at Develop, generating many solutions to the wrong problem. The "double" in Double Diamond is the innovation — without it you get solution-first fix.
- **Source:** British Design Council, *The Double Diamond*, 2005. https://www.designcouncil.org.uk/resources/the-double-diamond ; Wikipedia https://en.wikipedia.org/wiki/Double_Diamond_(design_process_model) ; critique/update https://uxdesign.cc/beyond-the-double-diamond-thinking-about-a-better-design-process-model-de4fdb902cf

### 4. SCAMPER (Eberle, 1971 — building on Osborn)
A checklist of seven idea-mutation operators applied to an existing concept: **S**ubstitute, **C**ombine, **A**dapt, **M**odify/Magnify/Minify, **P**ut to another use, **E**liminate, **R**everse.
- **Phase:** Divergence (it's an ideation checklist).
- **Critique/verify step?** No — pure generation; needs a separate convergence step.
- **Parallelizes?** Perfectly — each operator can be assigned to a different subagent (7 subagents, one per letter), or each subagent can run all 7. Either way the work is independent and parallel.
- **Group size:** 1–∞; designed as an individual tool but scales linearly.
- **Failure modes:** Mechanical application produces shallow variants ("substitute the color") rather than conceptual jumps. Quality depends on how richly each operator is interpreted. Easy to game the checklist without producing real novelty.
- **Source:** Eberle, *SCAMPER: Creative Games and Activities for Imagination Development*, 1971. The Decision Lab, https://thedecisionlab.com/reference-guide/philosophy/scamper ; IxDF, https://ixdf.org/literature/article/learn-how-to-use-the-best-ideation-methods-scamper

### 5. de Bono's Six Thinking Hats (1985)
Six coloured hats, each forcing a single thinking mode: **White** (facts/data), **Red** (feelings/intuition), **Black** (critique/risks), **Yellow** (optimism/benefits), **Green** (creativity/alternatives), **Blue** (process/meta). De Bono calls this "**parallel thinking**" — everyone wears the same hat at the same time instead of arguing from different modes.
- **Phase:** Both — Green and Yellow are divergent, Black and White are convergent, Blue is meta/process. The sequence of hats is itself a divergence→convergence rhythm.
- **Critique/verify step?** Yes — the Black Hat is explicitly the critique step, isolated so it can't poison divergence.
- **Parallelizes?** YES — and explicitly designed to. The whole point of "parallel thinking" is that participants align on a mode rather than argue across modes. Maps cleanly to AI: spawn one subagent per hat, all addressing the same question from their assigned mode.
- **Group size:** 4–20; works at any size.
- **Failure modes:** Becomes a ritual (people just label their pre-existing opinion with a hat). The Black Hat gets over-used by skeptics and the Green Hat gets under-used. Sequential hat order matters — starting with Black kills divergence.
- **Source:** de Bono, *Six Thinking Hats*, 1985. https://en.wikipedia.org/wiki/Six_Thinking_Hats ; Bitesize Learning primer, https://www.bitesizelearning.co.uk/resources/six-thinking-hats-technique

### 6. de Bono's Lateral Thinking — PO & Random Entry (1967)
Family of techniques for provoking new patterns: **Random Entry** (pick a random noun, force a connection to the problem), **PO / Provocative Operation** (state a deliberately absurd/impossible claim, then extract a useful idea from it), **Concept Challenge** (question why an obvious assumption must hold).
- **Phase:** Divergence — provocation-only; needs a separate extraction/convergence step.
- **Critique/verify step?** No (the provocation is deliberately *wrong*; the verification is a separate "harvesting" step).
- **Parallelizes?** Yes — each subagent can be given a different random stimulus or provocation and work independently. This is the home for the user's "ask random questions, answer differently" instinct.
- **Group size:** 1–∞.
- **Failure modes:** Without disciplined "harvesting" the absurd statements stay absurd. Random words often produce superficial associations. Easy to confuse with mere wackiness. (1-A's research note: Deng & Brucks 2026 shows naive random stimulation is insufficient for LLMs — must be paired with persona/seed diversification.)
- **Source:** de Bono, *The Use of Lateral Thinking*, 1967; *Lateral Thinking: A Textbook of Creativity*, 1970. de Bono Group, https://www.debonogroup.com/services/core-programs/lateral-thinking ; PO, https://grokipedia.com/page/Po_(lateral_thinking) ; de Bono, *Serious Creativity*, https://www.debono.com/serious-creativity-article

### 7. TRIZ — 40 Inventive Principles & Contradictions (Altshuller, 1946+)
A patent-mining-derived toolkit for inventive problem solving: state your problem as a **technical contradiction** (improving parameter A worsens parameter B), look up the contradiction in the 39×39 Altshuller matrix, receive a shortlist of the 40 inventive principles most likely to resolve it (e.g. #15 Dynamics, #35 Parameter change). Includes **Ideal Final Result (IFR)** framing: "the system solves the problem itself, with no added mechanism."
- **Phase:** Mostly divergence (the principles are idea-generation triggers), with a strong convergence frame (the IFR forces a specific target).
- **Critique/verify step?** The IFR is a critique-of-the-current-direction step ("why isn't the solution already free?"). The contradiction matrix is itself a verification that you've identified the right tension.
- **Parallelizes?** Yes — different subagents can attack different contradictions, or apply different principles to the same contradiction.
- **Group size:** 1–∞; originally an individual engineer's toolkit.
- **Failure modes:** Hard to learn (the 40 principles need training to apply non-mechanically). Most useful for *engineering* contradictions; weak for human/behavioural problems. Can degenerate into a checklist ritual.
- **Source:** Altshuller, *Creativity as an Exact Science*, 1984. https://en.wikipedia.org/wiki/TRIZ ; 40 principles with examples, https://www.triz40.com/aff_Principles_TRIZ.php ; TRIZ Journal on IFR, https://the-trizjournal.com/innovation-methods/innovation-triz-theory-inventive-problem-solving/find-ideal-final-result

### 8. Disney Method — Dreamer / Realist / Critic (Dilts, 1994; from Walt Disney's practice)
Three sequential roles applied to a goal: **Dreamer** (unconstrained "what if" — what would we love?), **Realist** (how could we actually build this?), **Critic** (what's wrong with this plan / what would make it fail?).
- **Phase:** Both — Dreamer diverges, Realist converges toward a plan, Critic converges by critique. A complete divergence→plan→critique cycle.
- **Critique/verify step?** YES — the Critic role is explicit and mandatory; the method fails without it. Disney reportedly ran the three roles in separate physical rooms to prevent mode-bleed.
- **Parallelizes?** Partially — the three roles are sequential (Critic needs Realist's plan to attack), but *within* each role, multiple subagents can run in parallel (e.g. three Dreamers dream independently, then a Realist consolidates).
- **Group size:** 1–8; can be done solo by switching chairs/rooms, or as a small group.
- **Failure modes:** The Critic dominates if not isolated (people live in Black-Hat mode by default). The Dreamer produces fantasy if not followed by Realist. Most failures = skipping a role.
- **Source:** Dilts, *Strategies of Genius Vol. 1* (on Walt Disney), 1994. Designorate, https://www.designorate.com/disneys-creative-strategy ; APM, https://www.apm.org.uk/news/a-creativity-strategy-modelled-from-walt-disney-imagineering

### 9. Disney variant — "Three Homes" (Just Imagine → Get Real → Make Plans)
A modern relabelling of the Disney method used in some coaching/innovation-training material, framing the three roles as physical "homes" or rooms you walk between: **Just Imagine** (= Dreamer, pure divergence), **Get Real** (= Realist, feasibility), **Make Plans** (= Critic-Realist hybrid, action planning and risk-spotting).
- **Phase:** Both — same Dreamer→Realist→Critic structure as #8; the "Make Plans" third room sometimes collapses Critic + Realist into a single planning step.
- **Critique/verify step?** Yes — "Get Real" + "Make Plans" together encode the critique/feasibility step.
- **Parallelizes?** Same as #8.
- **Group size:** Same as #8.
- **Failure modes:** Same as #8, plus the relabelling sometimes drops the dedicated Critic (folding it into "Make Plans"), weakening the critique step. Note: this variant has weak canonical-web presence — it appears in training materials rather than peer-reviewed sources, so I'm treating it as a framing variant of Disney rather than a separate method.
- **Source:** Treat as variant of Dilts (1994); see #8. (Direct canonical source not located in survey — flagged for Phase-1-Research verification.)

### 10. Reverse Brainstorming / "Worst Idea" (multiple origins; popularised by IDEO-style design thinking)
Invert the problem: instead of "how do we solve X?", ask "**how do we cause / worsen X?**" Generate many bad ideas, then flip each into a solution by inversion. The "Worst Possible Idea" variant deliberately generates terrible ideas to remove evaluation apprehension.
- **Phase:** Divergence (the bad-idea generation) followed by a convergent inversion step.
- **Critique/verify step?** Implicit — the inversion step is a critique of the bad idea; the method forces a reframe that often surfaces the real failure mode.
- **Parallelizes?** Yes — bad-idea generation is independent per participant.
- **Group size:** 3–10.
- **Failure modes:** Can produce shallow inversions ("do the opposite"). The "fun" framing sometimes degenerates into jokes with no usable output. Needs the inversion step or it's just a complaint session.
- **Source:** IxDF, https://ixdf.org/literature/topics/worst-possible-idea ; Miro, https://miro.com/brainstorming/what-is-reverse-brainstorming ; Canva, https://www.canva.com/learn/reverse-brainstorming

### 11. Five Whys (Taiichi Ohno / Toyota, ~1950s)
Ask "why?" repeatedly (typically five times) to drill from a symptom down to its **root cause**. Used as a problem-framing tool *before* brainstorming solutions, to ensure you're solving the real problem.
- **Phase:** Convergence on the *problem* (it's a diagnostic, not an ideation tool). Often used as the bridge between problem-finding and idea-finding in CPS.
- **Critique/verify step?** Yes — each "why" is a verification of the previous layer's causality. The endpoint (root cause) is the verified problem statement.
- **Parallelizes?** Yes — multiple independent Five-Whys chains can be run on the same symptom; their convergence (or divergence) is itself diagnostic.
- **Group size:** 1–6.
- **Failure modes:** "Five" is a heuristic, not a law — stopping at 5 can under-shoot or over-shoot the root cause. Each "why" is a hypothesis, not a fact; without verification against evidence the chain drifts into rationalisation. Wikipedia and Taproot both flag it as a poor standalone RCA tool — needs evidence.
- **Source:** Ohno, *Toyota Production System*, 1988. https://en.wikipedia.org/wiki/Five_whys ; Lean Enterprise Institute, https://www.lean.org/the-lean-post/articles/five-whys-animation ; Taproot critique, https://taproot.com/example-of-5-whys-is-this-root-cause-analysis

### 12. "How Might We…" (HMW) reframing (P&G 1970s → IDEO → Stanford d.school)
Reformulate a problem/opportunity as an open question starting with "How might we…". The phrasing forces optimism ("might") and collective agency ("we") and turns a stuck complaint into an actionable design challenge.
- **Phase:** Convergence on the *problem frame* — it's the bridge between Define (Double Diamond diamond 1) and Develop (diamond 2). Often used to seed an ideation session.
- **Critique/verify step?** No (it's a framing tool); but a good HMW is itself a small act of critique (it rejects bad framings).
- **Parallelizes?** Yes — multiple subagents can each generate HMW framings independently; their framings then become seeds for parallel ideation.
- **Group size:** 1–∞.
- **Failure modes:** Bad HMWs are either too narrow ("HMW make the button 2px bigger?") or too broad ("HMW solve climate change?"). Easy to confuse HMW generation with idea generation. Needs a curation step (cluster HMWs, pick the most generative).
- **Source:** Origin traced to Min Basadur at P&G in the 1970s, popularised by IDEO. NN/G, https://www.nngroup.com/articles/how-might-we-questions ; Stanford d.school, https://dschool.stanford.edu/tools/how-might-we-questions ; IDEO Design Kit, https://www.designkit.org/methods/how-might-we.html

### 13. Attribute Listing & Morphological Analysis (Zwicky, 1948+)
Decompose a product/idea into its key **attributes** (material, shape, mechanism, target user, etc.), list multiple **values** for each attribute, then systematically explore combinations (the morphological box). Forces consideration of design space you'd otherwise miss.
- **Phase:** Divergence (the combinatorial explosion is the point).
- **Critique/verify step?** Implicit — the box surfaces impossible combinations, which is a weak form of critique. But typically a separate selection step is needed.
- **Parallelizes?** PERFECTLY — each cell of the morphological box is an independent idea-generation task. Different subagents can be assigned different cells.
- **Group size:** 1–∞.
- **Failure modes:** Combinatorial explosion (N attributes × M values each = M^N cells). Most combinations are nonsensical. The technique generates volume, not quality — needs strong downstream selection. Easy to pick the wrong attributes and miss the whole interesting space.
- **Source:** Zwicky, *Discovery, Invention, Research through the Morphological Approach*, 1969. MindTools, https://www.mindtools.com/aryydrc/attribute-listing-and-morphological-analysis ; Mycoted, https://www.mycoted.com/Morphological_Analysis

### 14. Mind Mapping / Concept Mapping (Buzan, 1960s; Novak, 1972)
Radial visual diagram: central concept at the middle, branches for major sub-concepts, sub-branches for detail. **Mind maps** (Buzan) are free-form and associative; **concept maps** (Novak) are more structured and label the relationships between nodes ("—causes→", "—is-a→").
- **Phase:** Both — drawing the map is divergent (you keep adding branches); reading the map's structure is convergent (clusters and gaps become visible).
- **Critique/verify step?** Weak — the map reveals gaps and contradictions but doesn't enforce a critique step.
- **Parallelizes?** Yes — multiple participants can build maps independently and then merge, or build different branches of the same map in parallel. The merge is the convergence step.
- **Group size:** 1–∞; originally an individual note-taking tool.
- **Failure modes:** Maps drift into "everything connects to everything" with no actionable structure. Visual aesthetics get prioritised over content. Hard to read others' maps without explanation.
- **Source:** Buzan, *Use Your Head*, 1974. https://en.wikipedia.org/wiki/Mind_map ; Novak concept maps, https://en.wikipedia.org/wiki/Concept_map ; Tony Buzan archive, https://tonybuzan.com

### 15. Crazy Eights (Google Ventures Design Sprint, ~2010)
Each participant folds a sheet of paper into 8 panels and sketches **8 distinct solutions in 8 minutes** (1 minute per sketch). Forces rapid, low-fidelity, divergent output.
- **Phase:** Pure divergence.
- **Critique/verify step?** No — it's purely generative. The downstream "decide" phase of the design sprint is the convergence.
- **Parallelizes?** YES — by construction; everyone sketches alone, silently, in parallel. The time pressure is the active ingredient.
- **Group size:** 3–8 typical.
- **Failure modes:** Quality-vs-speed tradeoff can produce shallow sketches. Participants who can't draw disengage. The 8-minute timer is the whole point — relaxing it kills the technique.
- **Source:** Google Ventures Design Sprint Kit, https://designsprintkit.withgoogle.com/methodology/phase3-sketch/crazy-8s ; UX Planet, https://uxplanet.org/generate-crazy-ideas-with-this-design-sprint-method-c6a36a16c3d5

### 16. Brainwriting 6-3-5 (Rohrbach, 1968)
**Six participants write 3 ideas each in 5 minutes on a worksheet, then pass the sheet to the next person**, who reads and adds 3 more (building on or diverging from what's there). Six rounds × 3 ideas × 6 people = **108 ideas in 30 minutes**.
- **Phase:** Divergence (with mild cross-pollination between rounds).
- **Critique/verify step?** No — the rounds are pure generation; the passing mechanic is for inspiration, not critique.
- **Parallelizes?** **YES — this is the canonical parallel analog.** Each 5-minute round is parallel silent work; the sheet-passing is a structured handoff that simulates "yes-and" without the production blocking of verbal brainstorming. Maps directly to: N subagents each generate K ideas in isolation, then receive the prior subagent's idea sheet as context for round 2.
- **Group size:** Originally 6 (hence the name), but scales: 6(x)-3-5 variants use any number of participants.
- **Failure modes:** Participants anchor on the prior sheet's ideas (a controlled form of anchoring — can be a feature or a bug). Idea duplication across sheets. Requires literacy/writing speed; in AI terms, requires the "worksheet" to be a clean shared data structure.
- **Source:** Rohrbach, *Kreativ nach Regeln — Methode 635, eine neue Technik zum Lösen von Problemen*, 1968 (German). Wikipedia, https://en.wikipedia.org/wiki/6-3-5_Brainwriting ; Zapier explainer, https://zapier.com/blog/brainwriting ; Hochschule Luzern, https://rcc.hslu.ch/en/tools/three-utilities/methods/zeige/6%28x%29-3-5-Method

### 17. Nominal Group Technique — NGT (Delbecq & Van de Ven, 1971)
Four-step structured group decision process: **(1) Silent generation** of ideas in writing (each participant alone); **(2) Round-robin recording** — each person offers one idea in turn, posted publicly, NO discussion; **(3) Clarification/grouping** — only now can ideas be discussed, merged, clustered; **(4) Voting/ranking** — anonymous weighted vote to prioritise.
- **Phase:** Both — steps 1 & 2 are divergence, steps 3 & 4 are convergence.
- **Critique/verify step?** YES — step 3 is discussion/critique; step 4 is the prioritisation verdict. NGT is the most explicit divergence→critique→vote structure in the survey.
- **Parallelizes?** **YES — "nominal" means the group does NOT actually brainstorm together.** Step 1 is fully parallel silent work; step 2 is a strict no-discussion collection; even step 4 (voting) is independent per participant. The only non-parallel step is step 3 (discussion), which in an AI loop becomes "the orchestrator reads all ideas and produces a critique/clustering" — no real-time discussion needed.
- **Group size:** 5–9 typical; designed for small face-to-face groups.
- **Failure modes:** Step 3 (discussion) re-introduces production blocking and authority bias if a dominant voice takes over. Anonymous voting is essential — non-anonymous voting collapses to the senior person's preference.
- **Source:** Delbecq & Van de Ven, *A Group Process Model for Problem Identification and Program Planning*, 1971. PMC how-to, https://pmc.ncbi.nlm.nih.gov/articles/PMC4909789 ; Wikipedia, https://en.wikipedia.org/wiki/Nominal_group_technique

### 18. Delphi Method (Dalkey & Helmer, RAND, 1950s)
Iterative anonymous expert consensus: **Round 1** — each expert independently answers/questions; **Round 2** — each expert receives an anonymised summary of all answers and revises; **Rounds 3+** — repeat until convergence. Anonymity removes authority bias; iteration removes first-mover advantage.
- **Phase:** Alternating — each round is divergence (experts answer alone) → convergence (orchestrator aggregates) → divergence (experts revise).
- **Critique/verify step?** YES — each round after the first forces experts to confront and respond to the aggregate, which is a structured critique. The iteration is the verification.
- **Parallelizes?** **YES — by design.** Each expert works alone, in parallel, every round. The orchestrator is the only sequential bottleneck (aggregation between rounds). Maps directly to: N subagents → orchestrator anonymises/summarises → N subagents brainstorm again with the summary visible.
- **Group size:** 7–15 experts typical; up to 50 in some panels.
- **Failure modes:** Slow (multi-round, days to weeks). "Consensus" can mean the modal answer rather than the best answer — the method converges but doesn't verify against ground truth. Drop-out between rounds biases the final panel. Experts can converge on a shared mistake ("collective wisdom of the uninformed crowd of experts").
- **Source:** Dalkey & Helmer, *An Experimental Application of the Delphi Method to the Use of Experts*, RAND 1963. RAND methodological guidance, https://www.rand.org/pubs/tools/TLA3082-1.html ; Wikipedia, https://en.wikipedia.org/wiki/Delphi_method

### 19. Affinity Mapping / KJ Method (Kawakita, 1960s)
Post-ideation clustering technique: write each idea on a sticky note, then **silently group related notes into clusters** without labelling the clusters first, then name the clusters. Surfaces themes that weren't visible in the linear idea list.
- **Phase:** Convergence — applied AFTER divergence to make sense of the pile.
- **Critique/verify step?** Implicit — the clustering is a soft critique (some ideas get absorbed into others; some get orphaned). Often a precursor to an explicit prioritisation vote.
- **Parallelizes?** YES — multiple participants can cluster the same pile independently; comparing their clusterings is itself a convergence step (where they agree = robust theme; where they disagree = interesting edge cases). For AI: spawn K clustering subagents, each producing an independent clustering, then merge.
- **Group size:** 1–10; commonly done solo or in small groups.
- **Failure modes:** Clustering is subjective — different people produce different themes. Forced clustering produces "miscellaneous" buckets. Best used as one input to prioritisation, not as the verdict.
- **Source:** Kawakita, *The Original KJ Method*, 1967 (Japanese). ASQ, https://asq.org/quality-resources/affinity ; IxDF, https://ixdf.org/literature/topics/affinity-diagrams ; Miro, https://miro.com/blog/create-affinity-diagrams

### 20. Stepladder Technique (Rogelberg et al., 1992)
Anti-anchoring decision structure: **(1)** the problem is presented to all; **(2)** each member individually generates their solution BEFORE any group discussion; **(3)** two members enter the "core group" and present their solutions to each other; **(4)** a third member joins, presents their solution (already prepared) to the pair, then they discuss; **(5)** repeat until all members have joined. Only after everyone has joined and presented can the group decide together.
- **Phase:** Divergence (individual prep) → convergence (staged discussion).
- **Critique/verify step?** Implicit — each new entrant's prepared solution is a critique of whatever consensus the prior subgroup was forming.
- **Parallelizes?** The individual-prep phase YES (everyone prepares alone, in parallel). The joining/discussion phase is sequential by design — that's the whole point (each new voice is heard before the group can converge).
- **Group size:** 4–8.
- **Failure modes:** Time-consuming. The first two entrants still form a mini-anchoring pair. Pressure to conform on joining. For AI: the "joining" step is the interesting part — it's a controlled way to inject late dissent.
- **Source:** Rogelberg, Barnes-Farrell & Lowe, *The Stepladder Technique: An Alternative Group Structure Facilitating Effective Group Decision Making*, 1992. ResearchGate, https://www.researchgate.net/publication/220027183_The_Stepladder_Technique_An_Alternative_Group_Structure_Facilitating_Effective_Group_Decision_Making ; Creately primer, https://creately.com/guides/stepladder-technique

### 21. Constraint Bombing / Substitutionboxing / Constraint-Based Ideation
Family of techniques that **deliberately impose artificial constraints** to force lateral thinking: "design it for a 5-year-old", "build it in 24 hours for $0", "make it work with only 3 components", "what if it had to run on a 1990 phone?" The constraint forces the brain out of its default path. (A 2022 Wiley meta-analysis of 111 studies, cited 57 times, confirms that *increasing* constraints generally *boosts* creative output — the "constraints-creativity paradox".)
- **Phase:** Divergence — the constraint is a seed for idea generation.
- **Critique/verify step?** No (constraint is generative, not evaluative).
- **Parallelizes?** YES — different subagents can be assigned different constraints, producing orthogonal idea sets.
- **Group size:** 1–∞.
- **Failure modes:** Too many constraints at once produce nothing. Constraints that are too tight produce trivial solutions. Constraints that are too loose produce no effect. Requires curation of the constraint set.
- **Source:** Stokes, *Creativity from Constraints: The Psychology of Breakthrough*, 2006. Wiley meta-analysis (Haught-Tromp, 2022), https://onlinelibrary.wiley.com/doi/full/10.1002/job.2655 ; Rachel Audige primer, https://rachelaudige.medium.com/trying-to-innovate-embrace-constraints-4d8853186c45

### 22. Oblique Strategies (Eno & Schmidt, 1975)
A deck of ~100 cards, each bearing a short, oblique prompt ("Honour thy error as a hidden intention", "Use an unacceptable colour", "State the problem in words as clearly as possible", "What would your closest friend do?"). Draw a card when stuck; let the prompt reframe your approach.
- **Phase:** Divergence (specifically: unblocking stuck divergence).
- **Critique/verify step?** No — purely generative prompts.
- **Parallelizes?** YES — each subagent can draw a different card and apply it independently. The randomness is the active ingredient.
- **Group size:** 1 (designed as a solo artist's tool); scales trivially to any N.
- **Failure modes:** Cards can become a tic-tac-toe of "oblique-ness" without producing usable output. Effect depends on the user's willingness to genuinely engage the prompt rather than rationalise past it.
- **Source:** Eno & Schmidt, *Oblique Strategies*, 1975. Wikipedia, https://en.wikipedia.org/wiki/Oblique_Strategies ; The Marginalian overview, https://www.themarginalian.org/2014/01/22/brian-eno-visual-music-oblique-strategies ; enoshop, https://enoshop.co.uk/products/oblique-strategies

### 23. "Yes, and…" (improv rule)
The foundational improvisation rule: accept what your scene partner offered ("yes") and add to it ("and"). The opposite of "yes, but…" (which blocks). Forces collaborative accumulation instead of critique.
- **Phase:** Divergence (collaborative accumulation).
- **Critique/verify step?** Explicitly NO during ideation — that's the point. Critique is deferred to a separate phase.
- **Parallelizes?** Partially — "yes-and" is inherently sequential (you build on what the previous person said). But in a written/async form: each subagent receives a random idea from the pool and must produce a "yes-and" extension, then passes its output back to the pool. This is brainwriting with a "yes-and" rule.
- **Group size:** 2–10 typical (improv scenes); scales with the async-pool adaptation.
- **Failure modes:** "Yes-and" without a critique phase produces escalating fantasy (the scene spirals into nonsense). Some participants smuggle in "yes, but" by rephrasing. Needs an explicit stop-and-critique phase or it never converges.
- **Source:** Improv tradition; Johnstone, *Impro: Improvisation and the Theatre*, 1979. Wikipedia, https://en.wikipedia.org/wiki/Yes,_and_... ; Medium primer, https://medium.com/improv4/saying-yes-and-a-principle-for-improv-business-life-fd050bccf7e3

---

## Synthesis — what to port to an AI parallel-subagent loop

### Methods that parallelize cleanly → use as-is

Ranked by how directly they map to a spawn-N-subagents-in-parallel architecture:

1. **Brainwriting 6-3-5 (#16)** — the canonical parallel analog. Each round = N subagents × K ideas in isolation; pass context to next round. The 5-minute timer maps to a token/time budget per subagent. **Use this as the divergence primitive.**
2. **Nominal Group Technique (#17)** — the most rigorous divergence→critique→vote structure in the survey. The "nominal" in NGT literally means "the group is in name only; ideation is individual". Silent generation (parallel) → round-robin collection (orchestrator) → clarification (orchestrator + devil's advocate subagent) → anonymous voting (parallel). **Use NGT as the outer loop skeleton.**
3. **Delphi (#18)** — multi-round parallel ideation with anonymised aggregation between rounds. Solves the "second-pulse divergence" problem (after critique, how do you re-stimulate without anchoring on the prior consensus?). **Use Delphi as the inter-cycle structure: cycle N's anonymised summary seeds cycle N+1.**
4. **Affinity mapping / KJ (#19)** — post-ideation clustering. Spawn K clustering subagents independently, then merge clusterings (where they agree = robust theme; where they disagree = edge case worth re-diverging on). **Use KJ as the convergence primitive.**
5. **Self-brainstorming / nominal groups (Mullen 1991 meta-analytic finding)** — individuals working alone, pooled, *outperform* interactive groups on quantity AND quality. **This is the empirical license to skip real-time interaction entirely** — the AI loop does NOT need to simulate a discussion.
6. **Crazy Eights (#15)** — parallel rapid sketching by construction. Maps to: each subagent produces K idea-stubs in tight time/token budget before any elaboration.
7. **Six Thinking Hats (#5)** — de Bono explicitly named this "parallel thinking". Spawn one subagent per hat, all addressing the same question from their assigned mode. **Use as the persona-specialisation layer** (pairs cleanly with 1-A's persona-based prompting finding).
8. **Morphological analysis (#13)** — each cell of the box is an independent generation task. **Use for systematic coverage** when the design space is decomposable.
9. **SCAMPER (#4)** — seven parallel mutation operators; assign one operator per subagent or have each subagent run all seven.
10. **Oblique Strategies / Random Entry / PO (#6, #22)** — each subagent draws a different random stimulus. **Use as the anti-mode-collapse injection** (pairs with 1-A's diversity-pressure finding).
11. **Reverse brainstorming / Worst Idea (#10)** — parallel bad-idea generation, then orchestrator-side inversion. Useful as a periodic re-divergence tactic.
12. **Constraint bombing (#21)** — each subagent receives a different artificial constraint, producing orthogonal idea sets. **Use as a diversity-injection mechanism** between cycles.

### Methods that need adaptation

| Method | Why it doesn't parallelize directly | Adaptation for AI loop |
|---|---|---|
| Verbal/free-discussion brainstorming (Osborn's classic #2) | Production blocking is structural — turn-taking blocks generation. Mullen 1991 shows interactive groups underperform nominal groups. | Replace entirely with brainwriting/NGT silent generation. Never let subagents see each other's outputs during the divergence phase. |
| Round-robin NGT discussion (step 3 of #17) | Real-time discussion doesn't parallelize. | The discussion becomes "the orchestrator reads all ideas and emits a critique/clustering" — no actual multi-turn discussion needed. A devil's-advocate subagent plays the role of the critical voice. |
| "Yes, and…" improv (#23) | Inherently sequential (you build on the prior offer). | Async pool version: each subagent pulls one idea from the pool and must emit a "yes-and" extension; pushes back to pool. Iterate. |
| Stepladder (#20) | The joining sequence is sequential by design. | Spawn all subagents in parallel, but reveal prior subagents' outputs to later-joining subagents in a controlled order. Useful as a deliberate anti-anchoring mechanism for the second divergence pulse. |
| Disney method (#8) | Three roles are sequential (Critic needs Realist's plan). | Within each role, parallelise. Roles themselves run sequentially: Dreamer → Realist → Critic. |
| Multi-agent debate (already covered by 1-A) | Doesn't parallelise well across rounds; failure modes too severe. | Avoid. Replace with NGT-style anonymous collection + a single devil's-advocate subagent + a judge step (1-A's recommendation). |
| Mind mapping (#14) | The visual/radial structure is hard to compose in parallel. | Use as a representation, not a process: each subagent emits its branch independently; orchestrator stitches into a shared tree. |

### Mandatory convergence/critique steps from human practice

These should be NON-OPTIONAL in the AI loop, pulled directly from the human literature:

1. **Silent written generation first (NGT step 1, brainwriting, Mullen's nominal groups).** Subagents must NOT see each other's outputs during the divergence phase. This eliminates production blocking and anchoring at the source. Without this, every other technique degrades.
2. **Round-robin collection without discussion (NGT step 2).** The orchestrator collects all ideas before any critique. This prevents premature convergence on the first-spoken idea.
3. **Affinity clustering before voting (KJ / NGT step 3).** Group similar ideas before scoring. Without this, vote-splitting kills good ideas that appear in 3 variants while a single mediocre idea wins by default.
4. **Anonymous voting/ranking (NGT step 4).** Each subagent scores independently, without seeing other subagents' scores. Authority/anchoring bias removed. The orchestrator aggregates.
5. **A dedicated Devil's Advocate / Critic role (Disney Critic, Black Hat, NGT discussion).** One subagent MUST argue against the leading idea. Non-optional. (Pairs with 1-A's persona #2 Devil's Advocate.)
6. **Pre-mortem before commitment (Klein).** Before any idea exits the brainstorm phase, a subagent must imagine the idea has already failed and generate the failure story. This is the strongest known critique primitive — Klein's research shows prospective hindsight surfaces ~30% more risks than forward planning.
7. **Stepladder-style second divergence (Delphi round 2).** After critique, re-diverge — but new subagent contributions must be prepared BEFORE they see the prior round's consensus. Prevents the second round from just agreeing with the first.
8. **Iteration with anonymised aggregation (Delphi).** Cycles repeat with each subagent seeing only the anonymised aggregate of the prior cycle, not individual contributions. Removes authority bias across cycles.

---

## Minimum viable divergence↔convergence rhythm

(Inside ONE brainstorm phase, before research even starts.)

The Osborn-Parnes CPS structure alternates divergence↔convergence at *every* step — the alternation is the method. A single "generate ideas then pick one" pass is NOT a rhythm; it's a single shot. The minimum viable rhythm inside one brainstorm phase is **two divergence pulses separated by a critique/clustering convergence, closed by an anonymous vote**:

```
┌──────────────────────────────────────────────────────────────────┐
│  BRAINSTORM PHASE (one phase, before research)                  │
│                                                                  │
│  [D1] DIVERGE (pulse 1, silent, parallel)                       │
│       N subagents × K ideas each, NO cross-visibility            │
│       ≡ Brainwriting 6-3-5 round 1 / NGT step 1                  │
│              │                                                  │
│              ▼                                                  │
│  [C1] CONVERGE (collect + cluster + critique)                   │
│       Orchestrator: dedup, affinity-cluster (KJ)                 │
│       Devil's-advocate subagent: attack top clusters             │
│       Pre-mortem subagent: imagine each top idea failed          │
│       ≡ NGT steps 2+3 / Disney Critic / Klein pre-mortem         │
│              │                                                  │
│              ▼                                                  │
│  [D2] DIVERGE (pulse 2, silent, parallel, seeded)               │
│       Same N subagents (or fresh ones) generate K MORE ideas     │
│       Each sees only the ANONYMISED C1 aggregate                 │
│       (Stepladder rule: prepare before seeing prior consensus)   │
│       ≡ Delphi round 2 / Brainwriting round 2                    │
│              │                                                  │
│              ▼                                                  │
│  [C2] CONVERGE (cluster + vote)                                 │
│       Orchestrator: dedup, re-cluster                            │
│       Anonymous weighted vote across all subagents (NGT step 4)  │
│              │                                                  │
│              ▼                                                  │
│  → OUTPUT: top M ideas exit to RESEARCH phase                   │
└──────────────────────────────────────────────────────────────────┘
```

**Why two pulses, not one?**
- 1-A's research shows LLM idea-similarity/duplication is the real failure mode (Deng & Brucks 2026; Liang et al. 2024). A single divergence pulse collapses onto the LLM's prior mode. The second pulse, seeded with the anonymised critique of pulse 1, is what produces the off-mode ideas.
- Critique without re-divergence is pure destruction — it kills ideas without replacing them. The Delphi structure (every round = diverge → converge → re-diverge) is the minimal fix.
- Mullen 1991 + Diehl & Stroebe 1987 show that nominal-group re-divergence (parallel silent work, no real-time interaction) outperforms interactive discussion. So the second pulse must ALSO be silent/parallel — not a "discussion" of the critique.

**Why a vote at the end, not just a top-pick?**
- NGT's anonymous voting step is what prevents the orchestrator (or the loudest subagent) from imposing its preference. The vote IS the convergence verdict.

**Why a pre-mortem specifically at C1?**
- Klein's prospective hindsight is the highest-yield critique primitive per unit effort. It catches the LLM-optimism bias (1-A's note: LLMs are good at novelty, bad at feasibility). The pre-mortem is the feasibility gate.

This is the **minimum** viable rhythm. CPS itself would have more alternations; Double Diamond would have a full problem-space diamond before the solution diamond. But for one brainstorm PHASE, D1 → C1 → D2 → C2 → vote is the smallest structure that:
- forces parallel silent generation (kills production blocking),
- enforces a critique step (kills premature convergence),
- re-stimulates divergence after critique (kills mode collapse),
- closes with an anonymous verdict (kills authority bias).

---

## How humans do "research after brainstorm"

(rapid prototyping, assumption testing, pre-mortems — and what AI should copy)

The human literature on "what to do after you have candidate ideas" is remarkably consistent across design thinking, lean startup, and decision-analysis traditions. The shared pattern is: **don't research the idea; research the idea's riskiest assumption.**

### 1. Rapid prototyping (Design Thinking Deliver phase, IDEO, GV Design Sprint)
Build the cheapest possible representation of the idea that lets a user/stakeholder react to it. Paper sketch. Wizard-of-Oz. Cardboard mockup. Landing page. The point is not to test the idea as a whole — it's to test the *one assumption* the idea most depends on, at the lowest possible cost. HBS online: rapid prototyping "empowers you to test your assumptions and answer key questions early—and repeatedly—throughout the product development process."
- **AI translation:** after brainstorm, don't send subagents to "look up stuff about each idea". Send them to identify the *riskiest assumption* of each top idea and then build the cheapest possible artifact (code sketch, spec snippet, counterexample, fake-door test) that could falsify it. This is 1-A's ReAct-as-verification half, operationalised.

### 2. Assumption mapping / assumption testing (IDEO Design Kit)
List every assumption the idea implicitly makes ("users will want this", "the API supports this", "this is legal"). Rank by **uncertainty × impact**. Test the top one first. This prevents teams from polishing assumptions that don't matter while the load-bearing assumption goes untested.
- **AI translation:** a dedicated subagent enumerates assumptions per top idea; a second subagent ranks by uncertainty × impact; a third (ReAct, web search, code exec) tests the top-ranked assumption. Loop until the idea is killed or its load-bearing assumption is verified.

### 3. Pre-mortem (Gary Klein, 2007)
Before committing resources, imagine it's 6–12 months later and the project has FAILED. Each participant writes down, independently and in detail, every reason it failed. Klein's research shows this "prospective hindsight" surfaces ~30% more risks than forward-looking risk-listing, because the imagined-failure frame breaks the team's optimism bias.
- **AI translation:** already mandatory at C1 above (the convergence step). It is the single highest-leverage critique primitive in the human literature and should be non-optional at the brainstorm→research handoff.

### 4. Five Whys on the *problem* (not the solution)
Before locking in a solution, run Five Whys on the original problem to verify you're solving the root cause and not a symptom. This is problem-space verification, separate from solution-space testing.
- **AI translation:** a verification subagent runs Five Whys on the problem framing and checks whether each top idea actually addresses the root-cause layer. Ideas that address only surface symptoms get down-ranked.

### 5. Smoke test / fake-door test (lean startup tradition)
Before building anything, test demand for the idea: a landing page describing the idea, a "sign up to be notified" button, a fake listing. If nobody clicks, the idea is dead — and you've spent $0 and 2 hours instead of 6 months.
- **AI translation:** for ideas where the load-bearing assumption is about *desirability* (vs. feasibility), the research half should run the cheapest possible external probe — a web search for prior art, a repo search for existing implementations, a quick check of whether anyone has already solved this. This is the ReAct-research step's "does this already exist?" sub-task.

### 6. The "smallest falsifiable experiment" rule
Across all of the above, the operating principle is: identify a falsifiable claim the idea makes, run the smallest experiment that could disprove it, kill or keep based on the result.
- **AI translation:** every idea that exits the brainstorm phase carries a falsifiable claim. The research phase's job is to design and execute the smallest experiment that could falsify that claim — using web search, code execution, prior-art lookup, or counterexample search. Ideas that survive proceed; ideas that don't are killed and (per 1-A's Reflexion note) the failure reason is written to memory for the next brainstorm cycle.

### What AI should specifically NOT copy from human post-brainstorm practice
- **Long consensus meetings to "decide which idea to pursue".** NGT's anonymous vote is faster and better. Don't simulate the meeting.
- **PowerPoint business-case decks.** Pure waste. Replace with assumption-map + cheapest-falsifiable-experiment.
- **Pilot programs with N=1 and no control.** Replace with the smoke-test / fake-door pattern (cheap, falsifiable).

---

## Sources

### Primary methods (canonical)
- Osborn, *Applied Imagination* (1953). Creative Education Foundation, https://www.creativeeducationfoundation.org/what-is-cps
- Berkeley CPS handbook, https://brdo.berkeley.edu/sites/default/files/cps_handbook.pdf
- JSTOR CPS overview, https://www.jstor.org/stable/25062298
- Design Council, *The Double Diamond* (2005), https://www.designcouncil.org.uk/resources/the-double-diamond and https://www.designcouncil.org.uk/resources/framework-for-innovation
- Wikipedia, *Double Diamond (design process model)*, https://en.wikipedia.org/wiki/Double_Diamond_(design_process_model)
- Eberle, *SCAMPER* (1971); The Decision Lab, https://thedecisionlab.com/reference-guide/philosophy/scamper ; IxDF, https://ixdf.org/literature/article/learn-how-to-use-the-best-ideation-methods-scamper
- de Bono, *Six Thinking Hats* (1985), https://en.wikipedia.org/wiki/Six_Thinking_Hats ; Bitesize Learning, https://www.bitesizelearning.co.uk/resources/six-thinking-hats-technique
- de Bono, *The Use of Lateral Thinking* (1967); de Bono Group, https://www.debonogroup.com/services/core-programs/lateral-thinking ; PO, https://grokipedia.com/page/Po_(lateral_thinking) ; *Serious Creativity*, https://www.debono.com/serious-creativity-article
- Altshuller / TRIZ: https://en.wikipedia.org/wiki/TRIZ ; 40 Principles, https://www.triz40.com/aff_Principles_TRIZ.php ; IFR, https://the-trizjournal.com/innovation-methods/innovation-triz-theory-inventive-problem-solving/find-ideal-final-result
- Dilts, *Strategies of Genius Vol. 1* (1994); Designorate, https://www.designorate.com/disneys-creative-strategy ; APM, https://www.apm.org.uk/news/a-creativity-strategy-modelled-from-walt-disney-imagineering
- IxDF, *Worst Possible Idea*, https://ixdf.org/literature/topics/worst-possible-idea ; Miro, *Reverse Brainstorming*, https://miro.com/brainstorming/what-is-reverse-brainstorming ; Canva, https://www.canva.com/learn/reverse-brainstorming
- Ohno / Toyota Production System; Wikipedia, *Five Whys*, https://en.wikipedia.org/wiki/Five_whys ; Lean Enterprise Institute, https://www.lean.org/the-lean-post/articles/five-whys-animation ; Taproot critique, https://taproot.com/example-of-5-whys-is-this-root-cause-analysis
- NN/G, *Using "How Might We" Questions*, https://www.nngroup.com/articles/how-might-we-questions ; Stanford d.school, https://dschool.stanford.edu/tools/how-might-we-questions ; IDEO Design Kit, https://www.designkit.org/methods/how-might-we.html
- Zwicky, *Morphological Analysis*; MindTools, https://www.mindtools.com/aryydrc/attribute-listing-and-morphological-analysis ; Mycoted, https://www.mycoted.com/Morphological_Analysis
- Buzan, *Mind Mapping*; Wikipedia, https://en.wikipedia.org/wiki/Mind_map ; Tony Buzan, https://tonybuzan.com
- GV Design Sprint, *Crazy 8s*, https://designsprintkit.withgoogle.com/methodology/phase3-sketch/crazy-8s ; UX Planet, https://uxplanet.org/generate-crazy-ideas-with-this-design-sprint-method-c6a36a16c3d5
- Rohrbach, *Methode 635* (1968); Wikipedia, https://en.wikipedia.org/wiki/6-3-5_Brainwriting ; Zapier, https://zapier.com/blog/brainwriting ; Hochschule Luzern, https://rcc.hslu.ch/en/tools/three-utilities/methods/zeige/6%28x%29-3-5-Method
- Delbecq & Van de Ven, NGT; PMC how-to, https://pmc.ncbi.nlm.nih.gov/articles/PMC4909789 ; Wikipedia, https://en.wikipedia.org/wiki/Nominal_group_technique ; 6sigma.us, https://www.6sigma.us/six-sigma-in-focus/nominal-group-technique
- RAND, *Delphi Method*, https://www.rand.org/pubs/tools/TLA3082-1.html ; Wikipedia, https://en.wikipedia.org/wiki/Delphi_method
- Kawakita, KJ Method; ASQ, https://asq.org/quality-resources/affinity ; IxDF, https://ixdf.org/literature/topics/affinity-diagrams ; Miro, https://miro.com/blog/create-affinity-diagrams
- Rogelberg et al., *Stepladder Technique* (1992), https://www.researchgate.net/publication/220027183_The_Stepladder_Technique_An_Alternative_Group_Structure_Facilitating_Effective_Group_Decision_Making ; Creately, https://creately.com/guides/stepladder-technique
- Eno & Schmidt, *Oblique Strategies* (1975); Wikipedia, https://en.wikipedia.org/wiki/Oblique_Strategies ; The Marginalian, https://www.themarginalian.org/2014/01/22/brian-eno-visual-music-oblique-strategies
- Johnstone, *Impro* (1979); Wikipedia, *Yes, and…*, https://en.wikipedia.org/wiki/Yes,_and_...

### Failure-mode / empirical literature
- Diehl & Stroebe, *Productivity Loss in Brainstorming Groups* (JPSR 1987), https://www.uni-muenster.de/imperia/md/content/psyifp/aeechterhoff/wintersemester2011-12/seminarthemenfelderdersozialpsychologie/08_diehl_stoebe_productivityloss-brainstorming_jpsp1987.pdf
- Mullen, Johnson & Salas, *Productivity Loss in Brainstorming Groups: A Meta-Analytic Integration* (1991, cited 1400+ times), https://dynamic.decorrespondent.nl/downloads/michiel-de-hoog/Mullen-1991-Productivity-Loss-in-Brainstorming-Groups.pdf ; Semantic Scholar, https://www.semanticscholar.org/paper/Productivity-loss-in-brainstorming-groups%3A-A-Mullen-Johnson/07513a625318b626b3534a7fb9d3e298b6f98744
- PMC, *Exposure to Ideas, Evaluation Apprehension, and Incubation* (production blocking review), https://pmc.ncbi.nlm.nih.gov/articles/PMC6620827
- DTIC, *Effects of Evaluation and Production Blocking* (1992), https://apps.dtic.mil/sti/citations/ADA265495
- Innovative Human Capital, *The Myth of Brainstorming*, https://www.innovativehumancapital.com/article/the-myth-of-brainstorming-why-traditional-idea-generation-methods-fail-organizations
- Wiley meta-analysis, *Rethinking outside the box: meta-analysis of constraints and creativity* (2022), https://onlinelibrary.wiley.com/doi/full/10.1002/job.2655
- ScienceDirect, *Creativity from constraints* (2022), https://www.sciencedirect.com/science/article/abs/pii/S1871187122001870

### Post-brainstorm (research/verification) literature
- Klein, *Performing a Project Premortem* (HBR 2007), http://homepages.se.edu/cvonbergen/files/2013/01/Performing-a-Project-Premortem.pdf ; The Uncertainty Project, https://www.theuncertaintyproject.org/tools/pre-mortem ; Skillpacks, https://www.skillpacks.com/premortem
- HBS Online, *Exploring Rapid Prototyping Methods & Best Practices*, https://online.hbs.edu/blog/post/rapid-prototyping
- Mural, *Prototyping: a guide to the 4th stage of design thinking*, https://www.mural.co/blog/design-thinking-prototype
- IxDF, *5 Stages in the Design Thinking Process*, https://ixdf.org/literature/article/5-stages-in-the-design-thinking-process
