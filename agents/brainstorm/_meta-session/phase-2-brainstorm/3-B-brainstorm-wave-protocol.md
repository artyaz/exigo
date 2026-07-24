# 3-B — Wave α (Brainstorm) Protocol

**Task ID:** 3-B
**Agent:** general-purpose (brainstorm wave protocol design)
**Date:** 2026-07-18
**Scope:** Design the divergent half of the brainstorming loop in detail. Per 3-A: N=10 parallel subagents (5 personas × 2 seeds), 350k cycle budget with α allocated 70k (55k subagents + 15k consolidation). This file specifies: the persona×seed matrix, the subagent brief template, the idea-doc output shape, the orchestrator consolidation (Judge) step, the diversity-pressure mechanism, the cost arithmetic, the failure-mode handlers, and the strict role-separation rules.
**Inputs read in full:** `worklog.md` (1-A through 3-A), `3-A-outer-loop-architecture.md` (full), `1-A-ai-brainstorming-methods.md` (persona set, lateral-thinking family), `1-B-human-brainstorming-methods.md` (Disney/Six Hats/SCAMPER/TRIZ/Stepladder/brainwriting), `1-C-subagent-coordination-patterns.md` (persona×seed matrix, orchestrator-worker), `1-D-cb-review-autonomy-extraction.md` (14-item extraction + 8 invariant rules), `1-E-verification-and-research-methods.md` (Toulmin dossier), `2-A-claim-verification.md` (Deng/Brucks/Toubia corrections; ordinary-persona + CoT intervention), `2-B-contradictions-gaps-premortem.md` (16 pre-mortem scenarios, A9 DA-mandate fix, G3 novelty archive spec).

---

## 0. Design summary (the answer before the argument)

Wave α is the divergent half of one cycle. It runs **N=10 leaf subagents in parallel**, each dispatched with a disjoint (persona, seed) tuple from a 5×2 matrix. Subagents never see each other's outputs (Mullen 1991 nominal-group rule, verified by 2-A). Each writes exactly one artifact: `brainstorm/B-NNN-{persona}-{seed}.md`. After all 10 complete, the orchestrator (acting as the non-parallel Judge) consolidates: clusters by embedding cosine ≥ 0.85, dedups against the novelty archive (embedding cosine ≥ 0.85 OR Toulmin-warrant hash collision), and selects a shortlist of K=5 by the 4-axis rubric (novelty / diversity / specificity / actionability). Non-shortlisted ideas are archived with status `deferred`, not deleted (they may re-emerge as mutations in future cycles). Diversity pressure is structural (5 personas × 2 seeds, no shared tuple) **and** temporal (seed-2 flavor rotates per cycle; specialist persona rotates in every 3 cycles; mode-collapse detector forces a refresh cycle if shortlist overlap with prior cycle exceeds 50%). Total cost: 70k tokens, matching 3-A's allocation.

Three load-bearing design choices, each justified against the verified literature:

1. **Ordinary personas, not celebrity** (2-A's correction of 1-A's persona #5). The Cross-Domain Synthesizer pulls analogies from *ordinary* remote-domain roles (biology teacher, urban planner, machinist) — not from "Steve Jobs" or "Richard Feynman." Per Deng/Brucks/Toubia 2026 (Claim 1 verified by 2-A): ordinary personas + CoT prompting closes the LLM-vs-human diversity gap; celebrity personas do not.
2. **CoT-structured briefs** (2-A's verification: "Chain-of-Thought prompting reduces fixation in LLMs only"). Every subagent brief mandates a 3-step CoT structure: (a) restate the problem in your persona's frame, (b) generate candidate ideas, (c) self-check each against the novelty archive hashes. Skipping (a) collapses to mode (Deng/Brucks mechanism: LLMs aggregate knowledge into a unified distribution); skipping (c) re-emits duplicates.
3. **Disagreement mandate on every persona, not just the Skeptic** (2-B's A9 fix; Wang & Yin IUI 2024: "an unbound DA persona collapses to sycophantic agreement"). The Skeptic's mandate is the strongest ("critique-then-mutate"); the other 4 have weaker-but-explicit mandates (Dreamer must "yes-and past the obvious," Engineer must "ship-in-6-weeks realism," Outsider must "ask the 12-year-old's question," Synthesizer must "import an analogy from a non-overlapping domain").

---

## A. Persona set (5 personas × 2 seeds = 10 subagents per cycle)

### A.1 The 5 personas

Each persona is **ordinary** (per 2-A), not celebrity. Each carries a **named brainstorm technique** from 1-A/1-B's verified repertoire, an **explicit disagreement mandate** (per A9), a **must-NOT-do list** (strict role separation), and a **seed strategy** (seed 1 = control, seed 2 = rotated treatment).

| # | Persona | 1-sentence role | Assigned technique | Disagreement mandate | Must NOT do | Seed strategy |
|---|---|---|---|---|---|---|
| 1 | **Dreamer** | Generate the most ambitious version of the idea; no feasibility check, "yes-and" past the obvious. | Disney Dreamer role + de Bono **PO / Provocative Operation** (1-A #6, 1-B #8): state a deliberately absurd claim, then extract a useful idea from it. | "For each idea you produce, also produce a *more ambitious* variant that goes one step further. Do NOT prune your own ideas for feasibility — the Skeptic subagent handles feasibility. A Dreamer idea that survives your own feasibility filter is a no-op." | No feasibility filter. No critique. No safety self-censorship (the orchestrator's selection step is where dual-use concerns are evaluated, not the diverge subagent). No reading of other subagents' outputs. No spawning children. | s1 = problem as-stated. s2 = rotated treatment (see §E.1). |
| 2 | **Skeptic / Devil's Advocate** | For each idea, list the single most likely reason it will fail; then propose the variant that survives that failure. | Disney Critic + de Bono **Black Hat** (1-B #5, #8) + **pre-mortem** (Klein, 1-B #22): prospective hindsight — "imagine this idea already shipped and failed; tell the failure story; then mutate the idea to survive it." | **Bound** (A9 fix): "You MUST produce a mutated variant for every critique. A critique with no mutated variant is a no-op and will be rejected by the orchestrator. Your disagreement is with the *failure mode*, not with the existence of the idea — you are divergent, not convergent." | No "kill the idea" verdicts (research wave does that). No ranking. No research / web_search (you do not verify claims; you hypothesise failure modes from internal reasoning only). No reading other subagents' outputs. | s1 = problem as-stated. s2 = rotated treatment, with the additional twist that s2's seed stimulus is a *prior-cycle shortlisted idea* to pre-mortem. |
| 3 | **Engineer** | Assume the idea ships in 6 weeks to the exigo repo. What is the simplest implementation? What does that reveal about the idea's real shape? | Disney Realist + **SCAMPER** mutation operators (1-B #4): for each candidate idea, apply at least 2 of {Substitute, Combine, Adapt, Modify, Put-to-another-use, Eliminate, Reverse} and emit the mutated variant. | "Your mutation must change the idea's *structure*, not just its wording. A SCAMPER-'Modify' that rewords the title is a no-op. State which operator you applied in the `parent_idea` field." | No "this is infeasible" verdicts. No deep implementation plans (the research wave does PoC). No critique of *other* personas' ideas. No reading other subagents' outputs. | s1 = problem as-stated. s2 = rotated treatment + a constraint-bombing stimulus ("design it to run on a 1990 phone" / "in 24 hours for $0" / "for a 5-year-old") per 1-B #21. |
| 4 | **Outsider** | Explain the problem to a smart 12-year-old, then ask the 3 questions the 12-year-old would ask. Answer each with a new idea. | de Bono **Six Hats White+Red** (1-B #5) + **Random Entry** (1-A #6, 1-B #6) + **constraint bombing** (1-B #21): force a naive reframing by inserting an artificial constraint or a random noun. | "You MUST ask at least one question that an expert in this domain would never ask. Expert-mode priors are the attractor you are paid to escape." | No "this is too naive" self-rejection. No domain-expert jargon. No reading other subagents' outputs. | s1 = problem as-stated. s2 = rotated treatment + a random-noun injection from a fixed Oblique-Strategies-style deck (1-A #22). |
| 5 | **Cross-Domain Synthesizer** | Import one analogy from a non-overlapping domain (biology, urban planning, music theory, etc.). Build the idea on that analogy. | **TRIZ 40 inventive principles** (1-A #6, 1-B #6) + remote-association analogy. Per 2-A: pull the analogy from an *ordinary* remote-domain role (biology teacher, urban planner, machinist, conductor), NOT a celebrity. Per TRIZBENCH (ACL Findings 2026): use TRIZ as a *checklist prompt* ("for each of the 40 principles, would it apply?"), not a single-shot lookup. | "The imported analogy MUST come from a domain disjoint from the problem's native domain. 'Software engineering idea from a software engineering analogy' is a no-op. State the source domain explicitly in the idea description." | No feasibility filter. No critique. No celebrity personas. No reading other subagents' outputs. | s1 = problem as-stated. s2 = rotated treatment + a named source domain drawn from a per-cycle domain pool (biology / urban planning / music theory / ecology / linguistics / materials science / …). |

### A.2 Why these 5, not more

- 1-A's set covers the four divergence modes (unconstrained, critique-driven, feasibility-grounded, reframing, remote-association) without redundancy.
- Adding a 6th persona (Historian, Ethicist, etc.) within the budget cap of N=10 means either 6 personas × ~1.5 seeds (drops the control/treatment structure) or 6 × 2 = 12 subagents (over N=10). The specialist-rotation mechanism (§E.3) is the right way to inject a 6th persona periodically without busting N=10.
- 2-A verified that the 5×6=30 max-N (1-C's claim) was a Phase-1 guess, not evidence; 3-A's N=10 is the budget-driven cap. 5×2 is the structurally complete matrix at N=10.

### A.3 Seed-2 rotation schedule (per §E.1)

Within a cycle, all 5 personas share the **same seed-2 flavor** (preserves the control/treatment signal: persona-s1 vs persona-s2 differs only by seed, so the orchestrator can measure the seed's effect). The seed-2 flavor rotates across cycles:

| Cycle mod 5 | Seed-2 flavor | Source | Why |
|---|---|---|---|
| 0 | **Oblique-strategy card injection** | Brian Eno & Peter Schmidt 1975 (1-A #22) | Breaks fixation on a stuck mode; canonical anti-anchor lever. |
| 1 | **Opposite-goal / reverse brainstorming** | 1-B #10 ("Worst Idea") | Forces the model to construct the failure mode explicitly, then invert. Pairs with the Skeptic persona (s2 = pre-mortem a prior-cycle shortlisted idea). |
| 2 | **Distant-domain analogy injection** | de Bono Random Input + 1-A Cross-Domain | Forces the Synthesizer's specialty on every persona; tests whether the persona×seed matrix's diversity is robust to a non-native stimulus. |
| 3 | **Constraint bombing** | 1-B #21 (artificial constraints) | Constraints-creativity paradox (Wiley 2022 meta-analysis): adding constraints boosts output. Tightens idea specificity. |
| 4 | **Mutation-from-prior-shortlist** | Evolutionary LLM ideation (FunSearch lineage, 1-A #15) | Cross-cycle learning: each persona re-diverges from a different prior-cycle shortlisted idea. Requires cycle N>1; for cycle 1, falls back to oblique-strategy. |

This rotation is the primary cross-cycle diversity-pressure mechanism (§E.1 details the implementation).

---

## B. Subagent brief template

The cycle-scope orchestrator dispatches each of the 10 Wave α subagents with the prompt below. Variables in `{ALL_CAPS}` are substituted per-subagent by the orchestrator before dispatch. The brief is self-contained: a subagent never reads `LOOP.md`, never reads the orchestrator's scratchpad, never reads other subagents' outputs. It receives only this brief + the variables.

### B.1 The brief

```text
You are a WAVE α BRAINSTORM SUBAGENT in the brainstorming-loop for Exigo.
You are a LEAF worker. You spawn NO children. You read NO other subagent
files. You write EXACTLY ONE file. Then you exit.

RUN_ROOT={RUN_ROOT}
CYCLE_ID={CYCLE_ID}
SUBAGENT_ID=B-{NNN}
PERSONA={PERSONA}              # one of: dreamer | skeptic | engineer | outsider | synthesizer
SEED={SEED}                    # one of: s1 | s2

# 1. Your persona and disagreement mandate

{PERSONA_MANDATE}              # the per-persona paragraph from §A.1 (role + technique + disagreement mandate + must-NOT-do)

You are operating under Chain-of-Thought structuring (verified intervention
for LLM fixation per Deng/Brucks/Toubia 2026). Your output MUST follow the
3-step CoT structure:
  (a) Restate the problem in your persona's frame (1-2 sentences).
  (b) Generate {QUANTITY_TARGET} candidate ideas, applying your assigned
      technique explicitly (state which technique operator you applied
      for each idea — e.g., "SCAMPER: Modify", "PO: 'what if X were free?'",
      "TRIZ principle #15: Dynamics").
  (c) Self-check each idea against the novelty archive hashes below; mark
      any idea that matches an archived hash as `parent_idea=ARCHIVE-I-NNN`
      (mutation) or skip it (verbatim duplicate). Skipping counts toward
      your `skipped_duplicates` self-report.

# 2. The problem

PROBLEM_BRIEF:
{PROBLEM_BRIEF}

# 3. Prior constraints (inherited from previous cycle's synthesis)

These are CONSTRAINTS, not ideas. You MUST respect them: do not generate
ideas that violate them. You MAY generate ideas that *relax* a constraint,
but you MUST flag the relaxation in the idea's `riskiest_assumption` field
("relaxes constraint C-NNN: <reason>").

PRIOR_CONSTRAINTS:
{PRIOR_CONSTRAINTS}            # newline-separated list; "C-NNN: <text> [decay_score=X.XX]"

# 4. Novelty archive hashes (cross-cycle dedup)

For each idea you generate, compute sha256(idea_title + " " + idea_description)
and compare to the hashes below. If your idea's hash matches: either (a)
mutate it (mark parent_idea=ARCHIVE-I-NNN) or (b) skip it. Do NOT emit
verbatim duplicates.

NOVELTY_ARCHIVE_HASHES:
{NOVELTY_ARCHIVE_HASHES}       # newline-separated list of sha256 hashes from archive/novelty.jsonl

# 5. Your seed

SEED={SEED}
{SEED_STIMULUS}                # s1: "The problem as-stated. No additional stimulus."
                                # s2: depends on cycle's seed-2 flavor (see §A.3):
                                #     oblique-strategy card / opposite-goal prompt / distant-domain analogy
                                #     / constraint-bombing constraint / mutation-parent-idea-id

# 6. Output

Write your output to EXACTLY this path and no other:
  {RUN_ROOT}/brainstorm/B-{NNN}-{PERSONA}-{SEED}.md

Use the exact markdown template in §C below. Fill every field. The
orchestrator will schema-validate; missing fields = rejected output = you
re-run (wasted budget). Word budget per idea: 150-200 words across all
fields combined (force brevity; cb-review "delete > abstract"). Quantity
target: {QUANTITY_TARGET} ideas (justification: 5-7 per subagent × 10
subagents = 50-70 ideas pre-cluster; clustering at cosine ≥ 0.85 yields
~10-15 clusters; shortlist of 5 from 10-15 clusters is healthy selection
pressure). Cap: 7 ideas. Floor: 5 ideas. If you cannot generate 5 novel
ideas, generate 3 and self-report `under_floor=true` with a reason.

# 7. What you MUST NOT do (strict role separation, mirror cb-review §3)

- You do NOT research, verify, or critique ideas (except the Skeptic's
  critique-then-mutate, which is your divergence function, not a verdict).
- You do NOT spawn children. No nested reasoning agents, no tool_calls
  that fan out, no recursive subagents.
- You do NOT edit any file outside {RUN_ROOT}/brainstorm/B-{NNN}-{PERSONA}-{SEED}.md.
- You do NOT read other subagents' outputs
  ({RUN_ROOT}/brainstorm/B-001-*.md through B-010-*.md are off-limits).
  Anchoring prevention (Mullen 1991, verified by 2-A).
- You do NOT rank, score, or shortlist your own ideas. The orchestrator's
  consolidation step does that.
- You do NOT call web_search, repo read, or any external tool. Wave α is
  pure internal generation. (External grounding belongs to Wave β.)
- You do NOT safety-filter your own ideas. Dual-use / safety evaluation is
  the orchestrator's role at consolidation, not the diverge subagent's.
  If you refuse to brainstorm on safety grounds, you must (a) emit the
  refusal reason in your self-report and (b) exit cleanly so the
  orchestrator can fall back to a different persona (§G.4).

# 8. Hard kill-switch

Your token budget is 5500 tokens (1500 prompt + 4000 output). At 4000
output tokens the orchestrator hard-stops you and preserves whatever you
have written so far. Partial output is better than no output (§G.5).

# 9. Return contract

After writing your file, exit. Do not return a summary in your final
message; the file IS your return value. The orchestrator reads it from
disk.
```

### B.2 Substitution table (orchestrator fills these in)

| Variable | Source | Per-subagent value |
|---|---|---|
| `{RUN_ROOT}` | `cycle-scope.md` | Same for all 10 subagents in a cycle. |
| `{CYCLE_ID}` | `cycle-scope.md` | e.g., `cycle-003`. Same for all 10. |
| `{NNN}` | persona×seed matrix | `001` through `010`, assigned per the matrix in `persona-seed-matrix.md` (3-A §C). |
| `{PERSONA}` | persona×seed matrix | `dreamer` / `skeptic` / `engineer` / `outsider` / `synthesizer`. |
| `{PERSONA_MANDATE}` | §A.1 row for this persona | The full paragraph (role + technique + disagreement mandate + must-NOT-do). |
| `{SEED}` | persona×seed matrix | `s1` (control) or `s2` (treatment). |
| `{SEED_STIMULUS}` | cycle's seed-2 flavor (§A.3) | For s1: "The problem as-stated. No additional stimulus." For s2: the rotated treatment prompt (oblique-strategy card / opposite-goal prompt / distant-domain analogy / constraint-bombing constraint / mutation-parent-idea-id). |
| `{PROBLEM_BRIEF}` | `cycle-scope.md` | Same for all 10. |
| `{PRIOR_CONSTRAINTS}` | `archive/constraints.jsonl` filtered to `decay_score ≥ 0.3` | Same for all 10 (with decay scores visible so the subagent knows which are soft). |
| `{NOVELTY_ARCHIVE_HASHES}` | `archive/novelty.jsonl` `idea_text` hashes | Same for all 10. The list grows monotonically across cycles; orchestrator compacts it to the most-recent N=200 hashes (older hashes are extremely unlikely to collide with fresh ideas, and embedding cosine at consolidation catches them anyway). |
| `{QUANTITY_TARGET}` | this file (§B.1 step 6) | `5-7` for all 10 subagents. |

### B.3 Quantity target justification

5-7 ideas per subagent:
- **Floor (5):** below 5 × 10 subagents = 50 total ideas, the cluster step has too few inputs to find ~10-15 clusters, and the shortlist of 5 has too little selection pressure (every cluster advances).
- **Cap (7):** above 7 × 10 = 70 total ideas, per-idea quality drops (the subagent is filling quota with low-effort ideas), and the per-subagent output budget (4k tokens) cannot fit 8+ ideas at the 150-200-word-per-idea floor.
- **Sweet spot (5-7):** 50-70 total ideas → ~10-15 clusters at cosine ≥ 0.85 → shortlist of 5 is the top ~33-50% of clusters. Healthy selection pressure without over-pruning.

---

## C. Output file format (`B-NNN-PERSONA-SEED.md`)

Each subagent writes its artifact using EXACTLY this markdown template. The orchestrator schema-validates after the subagent exits; missing required fields = the artifact is rejected (§G.1) and the orchestrator either re-dispatches the same subagent with a tightened "fill all fields" reminder or marks it `failed` and falls back to a different persona (§G.4).

```markdown
# B-{NNN} — {PERSONA} — {SEED}

**Cycle:** {CYCLE_ID}
**Subagent ID:** B-{NNN}
**Persona:** {PERSONA}
**Seed:** {SEED} ({seed-2-flavor-name if s2, else "control"})
**Tokens used:** {input_tokens} in / {output_tokens} out
**Generated at:** {ISO-8601 timestamp}

---

## Problem brief (echoed)

{PROBLEM_BRIEF verbatim}

---

## Prior constraints (echoed, with decay scores)

{PRIOR_CONSTRAINTS verbatim, one per line, with [decay_score=X.XX] tag}

---

## CoT step (a): Restated in {PERSONA} frame

{1-2 sentences. The persona's reading of the problem.}

---

## CoT step (b): Candidate ideas

### I-{NNN}-01 — {title, ≤10 words}

**Description:** {one paragraph, 80-120 words. What the idea is.}

**Why novel:** {1 sentence. How this differs from the most-similar prior-cycle idea OR "no prior-cycle idea addresses {X}". Cite the closest archive idea by ID if applicable.}

**Riskiest assumption:** {1 sentence. The single assumption that, if false, kills the idea. Must be falsifiable at low cost (a research wave can verify it).}

**Technique applied:** {e.g., "PO: 'what if compute were free?'"; "SCAMPER: Combine"; "TRIZ #15: Dynamics"; "Random Entry noun: 'mycorrhiza'"; "Six Hats: White+Red"}

**Parent idea:** {ARCHIVE-I-NNN if this is a mutation of an archived idea; "—" if original}

---

### I-{NNN}-02 — {title}

{... same fields ...}

---

{... repeat for I-{NNN}-03 through I-{NNN}-0N, where N ∈ [5,7] ...}

---

## CoT step (c): Self-check vs novelty archive

I generated **{N}** ideas.
- **{M}** were skipped as verbatim duplicates of archived hashes (sha256 collision).
- **{K}** were marked as mutations of prior-cycle ideas (`parent_idea=ARCHIVE-I-NNN`).
- **{N-M-K}** were original (no parent).

**Under floor?** {true|false}. If true, reason: {free text, 1-2 sentences}.

**Refusals?** {none | "<refusal reason>"}. If non-none, the orchestrator will fall back to a different persona per §G.4.

---

## Self-report

- **Persona fidelity:** Did you stay in {PERSONA} mode for all {N} ideas? {yes|no}. If no, which idea(s) drifted and to which persona? {free text}.
- **Seed effect (s2 only):** Did the seed-2 stimulus ({seed-2-flavor-name}) measurably shift your idea set vs what you would have produced under s1? {yes|no|unclear}. {1-sentence elaboration}.
- **Failure modes observed in your own output:** {free text, optional. E.g., "Idea 03 is borderline feasibility-filtered — I almost pruned it but didn't."}
```

### C.1 Field rules

- **`id`**: format `I-{NNN}-{NN}` where the first `NNN` is the subagent's number (001-010) and the second `NN` is the idea's index within the subagent (01-07). Globally unique within the cycle. The orchestrator re-keys to `I-{cycle-NNN}-{global-NNN}` at consolidation (so cycle-003's shortlist ideas are `I-003-001` through `I-003-005`).
- **`title`**: ≤10 words. Imperative or declarative, not a question.
- **`description`**: 80-120 words. One paragraph. No bullet lists. The research wave will read this; if it is vague, the research wave cannot falsify the assumption.
- **`why novel`**: must reference the closest prior-cycle idea by archive ID. If the subagent cannot find a close match in the hash list (because the hash list is compacted to N=200), it writes "no close match in hash list; orchestrator to verify at consolidation." The orchestrator's embedding-cosine check (§D.1) is the authoritative novelty test.
- **`riskiest assumption`**: must be falsifiable. "Users will adopt this" is not falsifiable at low cost. "An O(log n) lookup exists for this access pattern" is. If the subagent cannot state a falsifiable assumption, the idea is rejected at consolidation.
- **`technique applied`**: must name the operator (PO statement, SCAMPER verb, TRIZ principle number, Random Entry noun, Six Hats color). An idea with no named technique is suspect (the subagent may have skipped step (b) of the CoT and just free-associated).
- **`parent idea`**: `ARCHIVE-I-NNN` (mutation of an archived idea), `B-{other-NNN}-I-{NN}` (mutation of a same-cycle peer's idea — **forbidden**, anchoring violation, subagent should never have seen peer's output), or `—` (original).

---

## D. Orchestrator consolidation (Judge / convergence step)

After all 10 Wave α subagents exit, the orchestrator (acting as the non-parallel Judge, per 1-C #15 and 3-A §B) consolidates. The consolidation is **not** itself a brainstorm subagent — it does not generate new ideas (anti-anchoring, §D.4). It performs 4 sequential operations: validate → cluster → dedup-against-archive → shortlist-select.

### D.1 Validate (gap G9 fix — reject garbage)

For each of the 10 artifacts in `{RUN_ROOT}/brainstorm/`:

1. **Schema check:** does the file contain the required sections (header / problem-brief / prior-constraints / CoT-step-a / CoT-step-b / CoT-step-c / self-report)? Are all `I-{NNN}-{NN}` idea blocks complete with all 6 required fields (id / title / description / why-novel / riskiest-assumption / technique / parent-idea)?
2. **Field-shape check:** is `title` ≤10 words? Is `description` 80-120 words? Is `riskiest_assumption` falsifiable (heuristic: contains a verb of measurement or existence — "exists", "is O(f(n))", "returns non-empty", "scores above X")?
3. **Persona-fidelity check:** does the self-report claim `yes` to "stayed in persona mode"? If `no`, flag the artifact `persona_drift=true` and down-weight its ideas at shortlist selection (§D.4) — do not reject, because the drifted ideas may still be novel.
4. **Refusal check:** if `Refusals?` is non-none, the artifact is marked `refused`. The orchestrator falls back per §G.4 (dispatch a replacement subagent with a different persona).

**Garbage handling:** artifacts failing schema check are NOT auto-rejected. The orchestrator attempts a single repair: re-dispatch the same subagent with a tightened "fill all required fields" reminder, halved quantity target (3 ideas), and the same persona×seed. If the repair also fails, the artifact is marked `failed` and excluded from clustering. The cycle continues with 9 artifacts. (Per 2-B's G9: garbage detection is schema-validation; this is the schema.)

### D.2 Cluster (affinity mapping, KJ-style)

1. **Embed all ideas.** Compute an embedding vector for each `{title} + " " + {description}` from every valid artifact. Use the same embedding model as `archive/novelty.jsonl` (3-A §C.2: `text-embedding-3-small` or a local Sentence-Transformer).
2. **Cluster by cosine similarity.** Greedy agglomerative clustering: start with each idea as its own cluster; merge the two clusters with the highest pairwise cosine if ≥ 0.85; repeat until no merge exceeds 0.85. (Threshold 0.85 per 3-A §I G3.)
3. **LLM-side semantic merge (secondary):** for clusters where embedding cosine is between 0.75 and 0.85 (the "borderline" band), run a single LLM call: "Are these two ideas substantively the same idea, or different ideas that happen to share vocabulary? Answer yes/no with 1-sentence reason." If yes, merge. If no, keep separate. This catches the LinkedIn/Anir-Sharma cosine-trap caveat (2-B's G3) where two ideas use similar words for different concepts.
4. **Cluster metadata:** for each cluster, the orchestrator writes `{cluster_id, member_idea_ids, centroid_embedding, cluster_label (1-3 word auto-label)}` to `{RUN_ROOT}/persona-seed-matrix.md` (appended as a `## Clusters` section).

### D.3 Dedup against novelty archive (cross-cycle)

For every cluster centroid, compute cosine similarity against every idea in `archive/novelty.jsonl`:

- **Cosine ≥ 0.90 vs an archived idea with status `proven` or `advance`:** the cluster is a known-good idea. **Skip from shortlist** (it has already advanced or been proven; re-advancing it is mode collapse). Archive the cluster's member ideas as `deferred, duplicate_of=ARCHIVE-I-NNN`.
- **Cosine ≥ 0.90 vs an archived idea with status `refuted` or `kill`:** the cluster is a known-bad idea. **Skip from shortlist.** Archive as `deferred, duplicate_of=ARCHIVE-I-NNN, prior_verdict=kill`. (Future-cycle mutations are still allowed; the parent is just labeled.)
- **Cosine ≥ 0.90 vs an archived idea with status `inconclusive`:** the cluster is a re-emergence of an unresolved idea. **Eligible for shortlist** (the research wave will re-attempt with a different falsifier, per the prior cycle's constraint feedback).
- **Cosine < 0.90 vs all archived ideas:** the cluster is novel. **Eligible for shortlist.**
- **Toulmin-warrant hash collision** (per 3-A §C.2 `warrant_hash` field): even if cosine < 0.90, if the warrant hash matches, the cluster is a semantic duplicate. Treat as cosine ≥ 0.90. (Secondary check; catches the cosine-trap's inverse — two ideas with different vocabulary but identical load-bearing assumption.)

### D.4 Shortlist-select (K=5)

From the pool of eligible clusters (those that survived D.3), select K=5 by the 4-axis rubric. Per 2-B's C8 (two-stage commit): the rubric is pre-declared in `cycle-scope.md` at cycle start, BEFORE the orchestrator sees any brainstorm output. The orchestrator commits to the rubric, then scores.

**The 4 axes (ordered, lexicographic):**

1. **Novelty** (primary): cluster centroid cosine vs the closest archived idea. Lower cosine = more novel. Hard floor: cosine < 0.85 (else skip — already deduped in D.3 but the floor catches edge cases).
2. **Diversity within shortlist** (secondary): the selected shortlist of 5 should span the maximum embedding-volume. Greedy: pick the highest-novelty cluster first; for each subsequent pick, choose the cluster whose centroid is farthest (max-min cosine distance) from the already-picked centroids. This is the MAP-Elites quality-diversity rule (3-A §C.2 references FunSearch).
3. **Specificity** (tertiary): penalize clusters whose member ideas' `description` fields average <80 words (the floor) or whose `riskiest_assumption` fails the falsifiability heuristic (D.1 step 2). A vague idea is not actionable by the research wave.
4. **Actionability** (quaternary): the research wave must be able to verify it in ~30k tokens (one research subagent). Penalize clusters whose `riskiest_assumption` requires building a full system to test ("build a 10k-user deployment to measure adoption"). Favor clusters whose `riskiest_assumption` is testable with a single web_search + a small PoC.

**Anti-anchoring (per F5 / D anti-anchoring rule):** the orchestrator's consolidation prompt is structured so the orchestrator **cannot inject its own ideas**. Specifically:
- The consolidation LLM call's prompt contains ONLY: the cluster list (with member idea IDs + centroids + cluster labels), the novelty archive embeddings (for cosine computation), the rubric, and the instruction "select K=5; do not generate new ideas; do not modify idea text; do not add ideas not present in the cluster list."
- The orchestrator's own scratchpad (the cycle-scope brief, the persona mandates, any notes) is NOT in the consolidation prompt. Only the cluster list is.
- A schema check after consolidation: the shortlist must be a subset of the cluster list. If the orchestrator emits an idea ID not in the cluster list, it is rejected and the consolidation re-runs with a tightened "subset only" reminder.

**Shortlist output:** the orchestrator writes `{RUN_ROOT}/persona-seed-matrix.md` (appended as `## Shortlist` section) with the 5 selected cluster IDs, their representative idea (the highest-novelty member), and the 4-axis scores. The shortlist is the input to Wave β.

### D.5 Non-shortlisted ideas: archive as `deferred`, do NOT delete

Every idea that did NOT make the shortlist is appended to `archive/novelty.jsonl` with status `deferred`. The orchestrator writes one line per idea:

```json
{"idea_id":"I-003-027","cycle_id":"cycle-003","persona":"outsider","seed":"s2","problem_hash":"sha256:...","idea_text":"…","embedding":[0.0123,…],"warrant_hash":"sha256:...","verdict":"deferred","confidence":null,"status":"deferred","cluster_id":"C-003-007","shortlisted":false,"deferred_reason":"low-novelty|low-specificity|low-actionability|duplicate-of-ARCHIVE-I-NNN","updated_at":"…"}
```

**Why `deferred` and not `deleted`:** per 3-A §C.2 (novelty archive grows monotonically) + 2-B's G11 fix (constraint decay prevents monotonic narrowing; the analog for ideas is that deferred ideas may re-emerge as mutations in future cycles when the seed-2 flavor is "mutation-from-prior-shortlist" — §A.3 cycle mod 5 = 4). Deleting would lose the cross-cycle memory; deferring preserves it at zero enforcement cost (deferred ideas are not in the shortlist, so they cost nothing in Wave β).

---

## E. Diversity pressure (1-D's 8th invariant, 3-A's H.8)

cb-review's reviewers are inherently diverse (disjoint file slices). The brainstorming loop's workers share the idea-space, so without explicit structural diversification they collapse to mode (Deng/Brucks/Toubia 2026, knowledge-partitioning mechanism verified by 2-A). Four concrete mechanisms:

### E.1 Per-cycle seed-2 rotation (the primary mechanism)

The seed-2 flavor rotates across cycles per the schedule in §A.3. Implementation:

- The orchestrator computes `cycle_mod_5 = cycle_number % 5` at Wave α dispatch.
- For each of the 5 s2 subagents, the `{SEED_STIMULUS}` variable is filled from a per-flavor prompt bank:
  - **mod 0 (oblique-strategy):** draw 1 card from the Oblique Strategies deck (1-A #22) — e.g., "Honor thy error as a hidden intention." Inject as: "Apply this oblique strategy to the problem: '{card}'."
  - **mod 1 (opposite-goal):** "Reverse the problem. Brainstorm: how would you guarantee this FAILS? Then invert each failure-idea to a success-idea."
  - **mod 2 (distant-domain analogy):** "Import an analogy from {domain-from-pool}. The domain pool rotates per cycle independently of this seed flavor."
  - **mod 3 (constraint bombing):** "Add this artificial constraint: '{constraint-from-pool}'. Generate ideas that satisfy the constraint. (Constraint-creativity paradox, Wiley 2022 meta-analysis.)"
  - **mod 4 (mutation-from-prior-shortlist):** "Take idea {prior-cycle-shortlist-I-NNN} from cycle {N-1}'s shortlist. Generate a mutation of it." (Requires cycle N>1; for cycle 1, fall back to mod 0.)
- The seed-2 flavor is written to `persona-seed-matrix.md` BEFORE Wave α dispatches, so a mid-wave crash can resume with the same flavor.

### E.2 Novelty archive (cross-cycle memory)

- **Every idea content-hashed.** `sha256(title + " " + description)`. Hash is written to `archive/novelty.jsonl` at the orchestrator's end-of-cycle archive-update step.
- **Subagents receive the hash list** (`{NOVELTY_ARCHIVE_HASHES}` variable, §B.2). Subagents must NOT emit ideas whose hash matches an archived hash verbatim. Mutations are allowed (and tagged with `parent_idea`).
- **Hash list is compacted to N=200 most recent.** Older hashes are extremely unlikely to collide with fresh ideas (idea text drifts over cycles as the problem space evolves), and the orchestrator's embedding-cosine check at consolidation (§D.3) catches semantic duplicates that the hash check misses.
- **Authoritative novelty test is at consolidation, not at subagent.** The subagent's hash check is a fast pre-filter; the orchestrator's embedding cosine + Toulmin-warrant hash is the authoritative test (§D.3). This is because the subagent only sees hashes, not embeddings; it cannot compute cosine similarity itself.

### E.3 Specialist persona rotation (every 3 cycles)

Every 3rd cycle (cycle 3, 6, 9, …), one of the 5 base personas is swapped out for a **specialist persona** drawn from a rotating pool:

| Cycle | Specialist swapped in | Replaces | Why |
|---|---|---|---|
| 3, 13, 23, … | **Security Auditor** | Engineer | Injects threat-modeling perspective; checks ideas for adversarial failure modes the base Engineer misses. |
| 6, 16, 26, … | **ML Researcher** | Synthesizer | Injects current-ML-literature perspective; checks ideas against SOTA techniques. |
| 9, 19, 29, … | **Product Manager** | Outsider | Injects user-adoption perspective; checks ideas for "would a user actually use this?" |
| 12, 22, 32, … | **Domain Historian** | Dreamer | Injects "what's been tried before in this domain and failed" perspective; prevents re-discovering known-bad ideas. |

- The specialist gets the same brief template (§B.1) with a persona-specific mandate paragraph.
- Only 1 specialist swaps in per cycle (5 personas stay at 5; the matrix is still 5×2 = 10 subagents).
- The swap is logged in `persona-seed-matrix.md` so the orchestrator's consolidation step knows which persona produced which artifact.
- The specialist's persona mandate includes the same disagreement mandate structure as the base personas (per A9 — an unbound specialist collapses to sycophancy too).

### E.4 Mode-collapse detector (the safety net)

If the structural mechanisms (E.1-E.3) fail and the loop starts producing the same ideas cycle after cycle, the mode-collapse detector catches it:

- **At end-of-cycle consolidation (after D.4):** the orchestrator computes the embedding centroid of the cycle's shortlist. Compute cosine similarity to the prior cycle's shortlist centroid.
- **If cosine ≥ 0.70 (i.e., > 50% semantic overlap, since 0.70 cosine is roughly the "same idea family" threshold):** trigger a **refresh cycle** for cycle N+1.
- **Refresh cycle behavior:** the seed-2 flavor for cycle N+1 is forced to a special `mode-collapse-breaker` flavor: "Generate an idea that deliberately breaks the pattern of the previous shortlist. State the pattern you are breaking." The persona×seed matrix is also perturbed: each persona's s2 stimulus is a different prior-cycle shortlisted idea to mutate *away from* (not toward).
- **Three-strikes rule:** if the mode-collapse detector triggers 3 cycles in a row, the loop terminates per 3-A §F.2 (novelty-decay-anchored, 3 consecutive cycles with 0 new proven ideas). The launcher reports `stop_reason="novelty-decay-3-consecutive"`.

---

## F. Cost budget for Wave α

### F.1 Reconciliation with 3-A

3-A allocated **70k tokens** to Wave α (3-A §G.3): 55k for 10 subagents + 15k for orchestrator consolidation. The task brief suggested "10 subagents × ~3k prompt + ~5k output = 80k + 15k consolidation = 95k," which is 25k over 3-A's allocation. Reconciliation:

| Line item | Task brief suggestion | This design (matches 3-A) | Justification for tightening |
|---|---|---|---|
| Per-subagent prompt | 3,000 | **1,500** | The brief template (§B.1) is reusable across all 10 subagents; only the variables differ. The variables (PROBLEM_BRIEF, PRIOR_CONSTRAINTS, NOVELTY_ARCHIVE_HASHES, PERSONA_MANDATE) total ~1,000-1,200 tokens; the template skeleton is ~300 tokens. Tighter prompt forces brevity (cb-review "delete > abstract"). |
| Per-subagent output | 5,000 | **4,000** | 5-7 ideas × 150-200 words = 750-1,400 words = ~1,000-2,000 tokens of idea content + ~500 tokens of header/echoed-problem/CoT-step-a + ~200 tokens of self-report = ~1,700-2,700 tokens. 4,000 is a comfortable ceiling (the hard kill-switch, §G.5) with margin for the 7-idea upper bound. |
| Per-subagent total | 8,000 | **5,500** | Matches 3-A §G.3. |
| 10 subagents | 80,000 | **55,000** | 5,500 × 10. |
| Orchestrator consolidation | 15,000 | **15,000** | Unchanged: validate (3k) + cluster (4k, includes LLM-side semantic merge calls for borderline band) + dedup-against-archive (3k) + shortlist-select (3k) + persona-seed-matrix.md + shortlist writes (2k). |
| **Wave α total** | **95,000** | **70,000** | Matches 3-A §G.3. |

### F.2 Per-subagent cost breakdown

```
Per subagent: 5,500 tokens
  = 1,500 prompt (template skeleton 300 + variables 1,200)
  + 4,000 output (ideas 2,700 + header/CoT/self-report 1,300)

Wave α subagent total: 5,500 × 10 = 55,000 tokens
Wave α consolidation:  15,000 tokens
                       ─────────────
Wave α TOTAL:          70,000 tokens (20% of 350k cycle budget)
```

### F.3 Fits within 3-A's overall cycle budget

3-A §G.3 allocates the 350k cycle budget as:

| Wave / activity | 3-A allocation | This design's spend | Δ |
|---|---|---|---|
| α Brainstorm (subagents) | 55,000 | 55,000 | 0 |
| α consolidation | 15,000 | 15,000 | 0 |
| β Research | 150,000 | (out of scope for 3-B) | — |
| β consolidation | 15,000 | (out of scope) | — |
| Citation verify | 15,000 | (out of scope) | — |
| γ Synthesis | 30,000 | (out of scope) | — |
| γ consolidation | 10,000 | (out of scope) | — |
| Archive updates | 10,000 | (out of scope; the α-side of this — appending deferred ideas to novelty.jsonl — is folded into the 15k α consolidation) | — |
| Reserve (DA re-dispatch) | 25,000 | (out of scope) | — |
| RECORD writes | 5,000 | (out of scope; the α-side — persona-seed-matrix.md + shortlist section — is folded into the 15k α consolidation) | — |
| Crash margin | 30,000 | (out of scope) | — |
| **TOTAL** | **350,000** | **70,000 for Wave α** | α is exactly 20% of cycle, matching 3-A. |

✅ Wave α at 70k fits within 3-A's 350k cycle budget with no reallocation required.

### F.4 Deep-cycle variant (3-A §B.2 opt-in)

For "deep" cycles (~727k budget, opt-in per 3-A), Wave α is unchanged: still 10 subagents, still 70k. The deep cycle's extra budget goes to Wave β (full 1-E protocol, 13 LLM calls + 6 tool calls per idea instead of 6 + 3) and the D2/C2 second divergence/convergence pulses that the scout cycle skips. Wave α is the same in both cycle types because the divergence side is already at the budget-driven cap (N=10); making it "deeper" would require either more subagents (over N=10) or more ideas per subagent (over the 7-idea cap, which degrades quality). Deep-cycle divergence is achieved by the seed-2 rotation across cycles, not by intra-cycle expansion.

---

## G. Failure modes (per 2-B's pre-mortem)

Each row maps a 2-B pre-mortem scenario to a concrete handler in this design.

| 2-B scenario | This design's handler |
|---|---|
| **F9 / G9 — Subagent returns garbage (incoherent, off-topic, non-dossier-shaped).** | §D.1 schema validation. Required sections + required fields + field-shape rules (title ≤10 words, description 80-120 words, falsifiable riskiest-assumption). Failed schema → single repair attempt (re-dispatch with tightened reminder + halved quantity target) → if repair fails, mark `failed`, exclude from clustering, continue with 9 artifacts. Garbage does NOT abort the cycle. |
| **F5 — Subagent anchors on parent brief (the persona mandate + problem statement is itself a form of anchoring; Deng/Brucks mechanism predicts framing leak even under perfect context isolation).** | §A.3 seed-2 rotation. The s1 control subagent gets the problem as-stated; the s2 treatment subagent gets a rotated stimulus (oblique-strategy / opposite-goal / distant-domain / constraint-bombing / mutation-parent). The s2 stimulus is in a different frame than the problem statement, forcing the subagent out of the problem's native attractor. Plus §B.1 step 7: subagent does NOT read other subagents' outputs (Mullen 1991 nominal-group rule, anchoring prevention at the source). |
| **F1 / F11 — All 10 subagents produce the same idea (mode collapse).** | §E.4 mode-collapse detector. At end-of-cycle consolidation, compute shortlist centroid cosine vs prior cycle's shortlist centroid. If cosine ≥ 0.70, trigger refresh cycle for N+1 with `mode-collapse-breaker` seed flavor. Three consecutive triggers → loop terminates per 3-A §F.2. |
| **Safety refusal (subagent refuses to brainstorm on safety grounds — not explicitly in 2-B's 16 scenarios but a known LLM failure mode).** | §B.1 step 7 + §C self-report `Refusals?` field + §D.1 refusal check. Subagent must (a) emit refusal reason in self-report and (b) exit cleanly. Orchestrator falls back per §G.4 below: dispatch a replacement subagent with a different persona from the same cycle's matrix (e.g., if Dreamer refused, dispatch an extra Engineer with the same seed). If the replacement also refuses, the cycle continues with 9 artifacts. Refusal does NOT abort the cycle. |
| **F3 / F16 — Subagent runs over budget (token cost explodes mid-subagent).** | §B.1 step 8 + §G.5 below. Hard kill-switch at 4,000 output tokens per subagent. The orchestrator stops the subagent and preserves whatever has been written to disk so far (partial idea-doc is better than no idea-doc). The partial doc is schema-validated like any other (§D.1); if it has at least 1 complete idea block, it is included in clustering. If 0 complete idea blocks, the subagent is marked `failed` and excluded. |
| **F14 — Loop produces only "safe" / lowest-common-denominator ideas (NGT vote + clustering + DA + pre-mortem + steelman + inconclusive-handling ALL push toward the consensus middle).** | §D.4 diversity-within-shortlist axis (MAP-Elites quality-diversity rule: pick the cluster farthest from already-picked centroids) + §E.1 seed-2 rotation (the opposite-goal and constraint-bombing flavors actively push away from the consensus middle) + §E.3 specialist rotation (the Security Auditor / ML Researcher / PM / Historian inject non-consensus perspectives). The Dreamer's "no feasibility filter" mandate (§A.1) is also a divergence-pressure valve against F14. |
| **A1 — Subagents are stochastic; two "different" subagents may produce near-identical outputs that the Judge reads as "diverse".** | §D.2 clustering catches this: if two subagents produce the same idea, they end up in the same cluster, and the cluster has multiple members. The shortlist picks cluster centroids, not individual ideas, so mode-collapse across subagents is detected at consolidation. Plus §D.3 dedup-against-archive catches cross-cycle mode collapse. |
| **A9 — Devil's Advocate persona collapses to sycophantic agreement without a concrete disagreement mandate.** | §A.1 Skeptic row: disagreement mandate is **bound** — "You MUST produce a mutated variant for every critique. A critique with no mutated variant is a no-op and will be rejected by the orchestrator." Plus §D.1 schema check: every Skeptic idea must have a `technique applied` field naming the critique-then-mutate operator (PO statement / pre-mortem failure story / Black-Hat risk). An unbound DA is detectable at schema validation. |

### G.1 Garbage / incomplete output (F9 / G9) — detailed handler

Schema validation runs immediately after each subagent exits. The validation is a single LLM call with a strict output schema (JSON, not free-text):

```json
{
  "artifact_path": "{RUN_ROOT}/brainstorm/B-NNN-{persona}-{seed}.md",
  "valid": true|false,
  "missing_sections": ["..."],
  "missing_fields_per_idea": {"I-NNN-01": ["riskiest_assumption"], ...},
  "field_shape_violations": ["I-NNN-02 title is 15 words (cap 10)", ...],
  "persona_drift": true|false,
  "refused": true|false,
  "refusal_reason": "..." | null,
  "ideas_count": N,
  "under_floor": true|false
}
```

If `valid=false` and the subagent is not `refused`: repair attempt. If `refused=true`: fall back per §G.4. If `valid=true`: include in clustering.

### G.2 Anchoring on parent brief (F5) — detailed handler

The seed-2 rotation (§A.3) is the primary defense. Secondary: the brief template (§B.1) is structured so the persona mandate is read FIRST (before the problem brief), so the subagent's frame is set by the persona before it sees the problem. Tertiary: the `{SEED_STIMULUS}` for s2 is always in a different frame than the problem (an oblique-strategy card is aphoristic; an opposite-goal prompt is interrogative; a constraint-bombing constraint is prescriptive; a mutation-parent-idea is referential). The frame mismatch between problem and stimulus forces the subagent to bridge them, which is the divergence act.

### G.3 All 10 produce the same idea (F1 / F11) — detailed handler

The mode-collapse detector (§E.4) catches this at end-of-cycle. Intra-cycle detection is also possible: if the orchestrator's clustering step (§D.2) produces 1 cluster with 10+ members and 0 other clusters, the cycle is a mode-collapse event. The orchestrator writes `Stopped at = "Wave α mode-collapsed to 1 cluster; refresh cycle required"` to RECORD.md, exits with `state=blocked, blocked_reason="alpha_mode_collapse"`, and the launcher re-wakes with a forced `mode-collapse-breaker` seed-2 flavor for the next cycle.

### G.4 Safety refusal — detailed handler

If a subagent's self-report `Refusals?` is non-none:
1. The artifact is marked `refused` and excluded from clustering.
2. The orchestrator dispatches a replacement subagent with a **different persona** from the same cycle's matrix, same seed. The replacement's persona mandate is tightened: "Your predecessor refused to brainstorm on safety grounds. You are a different persona; brainstorm from your persona's frame without safety-filtering (the orchestrator evaluates safety at consolidation, not you)."
3. If the replacement also refuses, the cycle continues with 9 (or 8, etc.) artifacts. Wave α does not require all 10; the floor is 7 valid artifacts (a cycle with < 7 valid artifacts is marked `state=blocked, blocked_reason="alpha_insufficient_artifacts"` and the launcher decides whether to re-wake).
4. Refusal is logged in RECORD.md under "Persona failure modes observed this cycle" with the persona, seed, and refusal reason — for persona-prompt refinement across cycles.

### G.5 Budget overrun — detailed handler

Hard kill-switch at 4,000 output tokens per subagent. Implementation: the orchestrator monitors each subagent's output token count in real time; at 4,000 it sends a `stop` signal and the subagent's harness flushes whatever has been written to disk. The subagent does NOT get to finish its current idea block. Partial idea blocks are NOT included in clustering (they fail schema validation under §D.1). The orchestrator's self-report field `Tokens used` records the actual count, and the orchestrator's consolidation step counts only complete idea blocks.

If a subagent consistently overruns (across cycles), its persona mandate is flagged for prompt refinement in RECORD.md "Persona failure modes observed."

---

## H. What this wave does NOT do (strict role separation, mirror cb-review §3)

cb-review §3: *"Reviewers do not spawn brainstormers. Brainstormers do not edit product code. Fixers do not re-open design when a brainstorm package already chose an approach."* The brainstorming loop's Wave α inherits this discipline verbatim, adapted to the diverge/research/synthesize wave names.

### H.1 Brainstorm subagents do NOT research, verify, or critique ideas

- No `web_search`, no `repo read`, no `code PoC runner`. Wave α is pure internal generation.
- The Skeptic's "critique-then-mutate" is a **divergence function** (it produces new ideas by mutating around a failure mode), not a verdict. The Skeptic does not "kill" ideas; the research wave does.
- No subagent ranks, scores, or shortlists its own ideas. The orchestrator's consolidation step (§D) does that.

### H.2 Brainstorm subagents do NOT spawn children

- No nested reasoning agents.
- No `tool_call` fan-out (a single `tool_call` to web_search that returns 10 results, each of which is fetched and parsed, is 10+ LLM calls — explicitly forbidden in Wave α; allowed only in Wave β per 3-A §J).
- Recursive MAS (1-C #3) is the canonical failure mode this rule prevents.

### H.3 Brainstorm subagents do NOT edit any file outside `{RUN_ROOT}/brainstorm/B-{NNN}-*.md`

- The artifact path is hard-coded in the brief (§B.1 step 6).
- The orchestrator's harness (the in-process subagent spawner) enforces this at the filesystem layer: the subagent's write permissions are scoped to its one artifact path.
- No subagent writes to `archive/novelty.jsonl` (orchestrator-only, at end-of-cycle), `archive/constraints.jsonl` (orchestrator-only), `persona-seed-matrix.md` (orchestrator-only), `RECORD.md` (orchestrator-only), or any other subagent's `B-{other-NNN}-*.md`.

### H.4 Brainstorm subagents do NOT read other subagents' outputs

- Anchoring prevention (Mullen 1991, verified by 2-A): if subagent B-002 (Skeptic-s1) sees B-001 (Dreamer-s1)'s ideas before generating its own, B-002's "critique" will be anchored on B-001's framing rather than an independent critique.
- The brief (§B.1 step 7) explicitly lists the off-limits paths.
- The orchestrator's harness enforces this at the filesystem layer: each subagent's read permissions are scoped to its own artifact + the shared variables (`PROBLEM_BRIEF`, `PRIOR_CONSTRAINTS`, `NOVELTY_ARCHIVE_HASHES`) which are passed in the prompt, not read from disk.
- The orchestrator (consolidation step) IS allowed to read all 10 artifacts — but only AFTER all 10 have exited. The orchestrator's consolidation LLM call does not see the subagents' transcripts, only their final artifacts.

### H.5 The orchestrator (consolidation step) is NOT itself a brainstorm subagent

- Per §D.4 anti-anchoring: the consolidation prompt contains ONLY the cluster list, the novelty archive embeddings, the rubric, and the "select K=5; do not generate new ideas" instruction. The orchestrator's own scratchpad (cycle-scope brief, persona mandates, notes) is NOT in the consolidation prompt.
- The orchestrator does NOT generate new ideas during consolidation. If the consolidation LLM call emits an idea ID not in the cluster list, it is rejected and the consolidation re-runs with a tightened "subset only" reminder.
- The orchestrator does NOT mutate ideas during consolidation. It selects cluster representatives verbatim. Mutation is the diverge subagents' job; the orchestrator's job is to pick.
- This rule is the analog of cb-review's "the master-pack consolidator does not write fix code; the fixers do." The orchestrator consolidates; the subagents diverge. Roles do not bleed.

---

## I. Handoff to Wave β

Wave α's output is the **shortlist of 5 cluster representatives**, written to `{RUN_ROOT}/persona-seed-matrix.md` `## Shortlist` section. Each shortlist entry has:

```markdown
### Shortlist slot {1-5}: cluster {C-NNN-NNN}

- **Representative idea:** I-{NNN}-{NN} (from B-{NNN}-{persona}-{seed})
- **Cluster size:** {N} ideas merged
- **Novelty score:** {cosine vs closest archived idea, 0.00-1.00; lower = more novel}
- **Diversity score:** {min cosine distance to already-picked shortlist centroids}
- **Specificity score:** {0.0-1.0, penalty for vague descriptions or non-falsifiable assumptions}
- **Actionability score:** {0.0-1.0, penalty for assumptions requiring full-system deployment to test}
- **Member ideas:** I-{NNN}-{NN}, I-{NNN}-{NN}, ...
```

Wave β (research) reads this section, dispatches one research subagent per shortlist slot (M=5, 1:1 mapping per 3-A §B.1), and each research subagent reads ONLY its assigned cluster's representative idea + member ideas. The research wave's brief (designed by sibling Phase-2 subagent 3-C) takes over from here.

---

## J. Sources (re-cited from Phase 1 for load-bearing claims)

### Primary load-bearing

- **Deng, Brucks & Toubia 2026** — *Examining and Addressing Barriers to Diversity in LLM-Generated Ideas.* arXiv:2602.20408. Verified by 2-A Claim 1: ordinary personas + CoT prompting closes the LLM-vs-human diversity gap; celebrity personas do not. Knowledge-partitioning mechanism is the load-bearing rationale for the 5×2 persona×seed matrix (§A, §E).
- **Mullen, Johnson & Salas 1991** — meta-analysis (1417 citations). Verified by 2-A Claim 2: nominal silent generation outperforms interactive groups. Load-bearing for §B.1 step 7 (no cross-reading) and §H.4.
- **Wang & Yin IUI 2024** — *Enhancing AI-Assisted Group Decision Making through LLM-Powered Devil's Advocate.* Load-bearing for §A.1 Skeptic disagreement mandate (A9 fix: an unbound DA collapses to sycophancy).
- **de Bono, Six Thinking Hats (1985)** + **Disney Method (Dilts 1994)** + **SCAMPER (Eberle 1971)** + **TRIZ (Altshuller 1946+)** + **Oblique Strategies (Eno & Schmidt 1975)** — all from 1-B's verified human-brainstorming survey. Load-bearing for the per-persona technique assignments (§A.1).
- **Klein, *Performing a Project Premortem* (HBR 2007)** — prospective hindsight. Load-bearing for the Skeptic's pre-mortem technique.
- **Waxell, *AI Agent Token Budget Enforcement* (Apr 2026)** — enforcement, not alerts. Load-bearing for §G.5 hard kill-switch.
- **3-A outer-loop architecture** — N=10, M=5, γ=2; 350k cycle budget; α allocation 70k; persona×seed matrix; novelty archive spec; checkpoints/; H.8 diversity-pressure invariant. Load-bearing for the entire numerical superstructure.

### Secondary (re-cited from 1-A, 1-B, 1-C, 2-A, 2-B for the technique assignments and failure-mode handlers)

- DIPPER (NUS, EMNLP 2025) — diversity-in-prompts beats self-ensemble.
- Liang/Si et al. ICLR 2025 — LLM ideas more novel, slightly weaker on feasibility.
- Cambridge Design Science 2025 — multi-persona prompting increases design-concept diversity.
- Anderson et al. 2024 + Moon et al. 2025 + Verbalized Sampling (arXiv:2510.01171) — LLM mode collapse / homogenization.
- Smit et al. ICML 2024 + ICML 2025 + Yao Sep 2025 — multi-agent debate failure modes (why we do NOT do MAD in Wave α).
- FunSearch (DeepMind 2023) — MAP-Elites quality-diversity archive (analog for §D.4 diversity-within-shortlist axis).
- Wiley 2022 meta-analysis (111 studies) — constraints-creativity paradox (load-bearing for §A.3 constraint-bombing seed flavor).
- Anthropic, *How we built our multi-agent research system* (Jun 2025) — orchestrator-worker topology, context isolation.

### In-repo paths read in full for this task

- `/home/z/my-project/worklog.md` (1-A through 3-A Stage Summaries)
- `/home/z/my-project/repo/exigo/agents/loop/_meta/phase-2-brainstorm/3-A-outer-loop-architecture.md` (full — 681 lines)
- `/home/z/my-project/repo/exigo/agents/loop/_meta/phase-1-brainstorm/1-A-ai-brainstorming-methods.md` (persona set, lateral-thinking family)
- `/home/z/my-project/repo/exigo/agents/loop/_meta/phase-1-brainstorm/1-B-human-brainstorming-methods.md` (Disney/Six Hats/SCAMPER/TRIZ/Stepladder/brainwriting)
- `/home/z/my-project/repo/exigo/agents/loop/_meta/phase-1-brainstorm/1-C-subagent-coordination-patterns.md` (orchestrator-worker, persona×seed matrix)
- `/home/z/my-project/repo/exigo/agents/loop/_meta/phase-1-brainstorm/1-D-cb-review-autonomy-extraction.md` (14-item extraction + 8 invariant rules)
- `/home/z/my-project/repo/exigo/agents/loop/_meta/phase-1-brainstorm/1-E-verification-and-research-methods.md` (Toulmin dossier, anti-sycophancy mechanisms)
- `/home/z/my-project/repo/exigo/agents/loop/_meta/phase-1-research/2-A-claim-verification.md` (Deng/Brucks/Toubia corrections; ordinary-persona + CoT intervention)
- `/home/z/my-project/repo/exigo/agents/loop/_meta/phase-1-research/2-B-contradictions-gaps-premortem.md` (16 pre-mortem scenarios, A9 DA-mandate fix, G3 novelty archive spec, F5 anchoring, F9 garbage, F11 mode collapse, F14 LCD, F16 cost runaway)
