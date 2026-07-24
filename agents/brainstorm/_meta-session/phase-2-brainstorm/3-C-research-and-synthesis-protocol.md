# 3-C — Wave β (Research / Verify) & Wave γ (Synthesis) Protocol

**Task ID:** 3-C
**Agent:** general-purpose (research + synthesis wave protocol design)
**Date:** 2026-07-18
**Scope:** Design the convergent half of the brainstorming loop in detail. Per 3-A: M=5 research subagents (one per shortlisted idea, 1:1) operating the reduced Toulmin+ReAct+CoVe+dossier protocol (6 LLM + 3 tool calls per idea instead of 1-E's full 13 + 6), then γ=2 sequential synthesis subagents (claims-extractor → constraint-writer). This file specifies: the Wave β subagent brief template, the dossier output shape, the orchestrator consolidation (Judge) with the "all-advance is suspicious" circuit-breaker, the Wave γ brief templates and the sequential-dependency contract, the constraint format (the load-bearing feedback mechanism to next cycle's brainstorm), the citation verification pipeline (CiteTracer-adapted, gap G4 fix), the single-model-shop anti-sycophancy audit (gap G7 fix), the cost arithmetic, and the strict role-separation rules.
**Inputs read in full:** `worklog.md` (1-A through 3-B), `3-A-outer-loop-architecture.md` (681 lines — outer loop, 350k budget, β=170k, γ=40k, enforced kill-switch 380k, archive spec), `3-B-brainstorm-wave-protocol.md` (610 lines — shortlist handoff, persona×seed matrix, brief-template house style, schema-validation pattern), `1-E-verification-and-research-methods.md` (full — Toulmin dossier, 7 anti-sycophancy mechanisms, 5-step pipeline), `2-B-contradictions-gaps-premortem.md` (full — gap G4 hallucinated-citation, gap G7 single-model-shop, gap G12 DA-cap fix, CiteTracer citation).

---

## 0. Design summary (the answer before the argument)

Wave β is the convergence half of one cycle. It runs **M=5 leaf subagents in parallel**, one per shortlisted idea from Wave α (1:1 mapping per 3-A §B.1). Each subagent operates the **reduced Toulmin+ReAct+CoVe+dossier protocol** (6 LLM calls + 3 tool calls per idea, vs 1-E's full 13 + 6) and writes exactly one artifact: `research/R-{NNN}-{IDEA_ID}.md`. The brief mandates a strict **steelman → falsify → position-swap → verdict** ordering — steelmaning before refutation prevents rubber-stamping (1-E mechanism #2), and a mandated falsification attempt before any verdict (1-E mechanism + Popper gate) ensures the subagent's reasoning is anchored to external evidence, not pure LLM introspection. Every citation is live-checked (HEAD request) and content-matched (semantic embedding vs the cited source's body text) — the citation verification pipeline (§G) is the gap G4 fix and runs **after** all 5 dossiers complete, not within each subagent.

After all 5 subagents exit, the orchestrator (acting as the non-parallel Judge, per 1-C #15 and 3-A §B) consolidates: schema-validates each dossier, tallies verdicts, fires the **"all-advance is suspicious" circuit-breaker** if all 5 are ADVANCE with confidence > 0.8 — capped at ONE red-team re-dispatch on the lowest-confidence ADVANCE idea (3-A §G.5 fix to 1-D's "one DA per advanced idea", which would double the per-cycle cost). The consolidator writes `research/_summary.md` and hands off to Wave γ.

Wave γ runs **γ=2 subagents sequentially**, NOT in parallel: γ-1 (claims-extractor) reads all 5 dossiers and writes `synthesis/S-001-claims.md` (verified / refuted / inconclusive claims grouped by theme); γ-2 (constraint-writer) reads S-001 + prior cycle's `archive/constraints.jsonl` + `archive/novelty.jsonl` and writes `synthesis/S-002-constraints.md` (next-cycle constraints in the §E format). The sequential dependency is intentional — γ-2 needs γ-1's claim-grouping to apply the Delphi+Stepladder translation (ADVANCE → MUST_RESPECT, REFUTE → MUST_AVOID, INCONCLUSIVE → MUST_TEST). Synthesis is **NOT** a parallel fan-out; it is a two-stage reduce. Constraints are the load-bearing feedback mechanism: the next cycle's Wave α reads them via the `{PRIOR_CONSTRAINTS}` variable in the brainstorm brief (3-B §B.2), and the constraint decay mechanism (3-A §C.2) prevents monotonic narrowing of the idea space across cycles.

Total cost: 170k for Wave β (150k subagents + 15k consolidation + 5k reserve) + 15k citation verify + 40k for Wave γ (30k subagents + 10k consolidation) = **225k for the convergent half**, exactly matching 3-A §G.3. Combined with Wave α (70k) and orchestrator overhead (archive 10k + DA reserve 25k + RECORD 5k = 40k), the cycle totals 335k against the 350k target / 380k hard kill-switch. (The task brief's "~80k for β+γ" figure is reconciled in §F — the brief's 10k-per-research-subagent estimate undercounts the reduced protocol's actual cost by ~3×; this design follows 3-A's 30k-per-subagent allocation, which fits the 350k budget with 15k buffer.)

Three load-bearing design choices, each justified against the verified literature:

1. **Three-state verdict vocabulary: ADVANCE / REFUTE / INCONCLUSIVE (dropped "refine" from 1-E's four-state set).** 1-E uses {advance, refine, kill, inconclusive}. The "refine" state is a convergent-half action that overlaps with Wave γ's constraint-writer (γ-2 translates "this idea needs refinement" into a MUST_TEST constraint for the next cycle, not a verdict on this cycle). The three-state set maps cleanly to the three constraint types (§E): ADVANCE → MUST_RESPECT, REFUTE → MUST_AVOID, INCONCLUSIVE → MUST_TEST. Dropping "refine" eliminates an ambiguous verdict state and forces the subagent to commit.
2. **Steelman-then-falsify ordering is mandated, not optional.** Per 1-E mechanism #2: a subagent that attempts to refute before steelmaning is rubber-stamping (the LLM's prior is to agree with its own framing). The dossier schema (§B) requires the `Steelman` section to be filled BEFORE the `Falsification attempt` section; the self-report field `Steelman written before falsification attempt?` is audited by the orchestrator. A `no` answer auto-downgrades the verdict to INCONCLUSIVE.
3. **Citation verification is a separate post-β phase, not intra-subagent.** Each research subagent does cite-as-you-go (every claim has a URL or code ref) but the *verification* (HEAD request, content match, URL-text mismatch detection) is done by the orchestrator in a single batched phase after all 5 dossiers complete. This avoids 5× duplicate URL fetches, allows cross-dossier dedup of citations, and lets the verifier persist verified URLs to `archive/citations.jsonl` (gap G4 fix). Intra-subagent verification would also create a budget feedback loop (a subagent whose citations fail would re-fetch, re-write, re-fail, blowing its 30k budget); the post-β batch phase keeps the subagent's budget bounded.

---

## A. Wave β research subagent brief (template)

The cycle-scope orchestrator dispatches each of the 5 Wave β subagents with the prompt below. Variables in `{ALL_CAPS}` are substituted per-subagent by the orchestrator before dispatch. The brief is self-contained: a subagent never reads `LOOP.md`, never reads the orchestrator's scratchpad, never reads other subagents' outputs (neither other research dossiers nor other shortlisted ideas). It receives only this brief + the variables.

### A.1 The brief

```text
You are a WAVE β RESEARCH SUBAGENT in the brainstorming-loop for Exigo.
You are a ReAct+CoVe (Reason+Act, Chain-of-Verification) leaf worker. Your
job is to VERIFY idea {IDEA_ID}. You are NOT a brainstormer; you are NOT
a sycophant. You spawn NO children. You read NO other subagent files
(research/R-001-*.md through research/R-005-*.md are off-limits). You
write EXACTLY ONE file. Then you exit.

RUN_ROOT={RUN_ROOT}
CYCLE_ID={CYCLE_ID}
SUBAGENT_ID=R-{NNN}
IDEA_ID={IDEA_ID}

# 1. The idea you must verify

IDEA_TITLE: {IDEA_TITLE}
IDEA_DESCRIPTION: {IDEA_DESCRIPTION}
IDEA_RISKIEST_ASSUMPTION: {IDEA_RISKIEST_ASSUMPTION}

These three fields are echoed verbatim from Wave α's shortlist. Your job is
to determine, with external evidence, whether the IDEA_RISKIEST_ASSUMPTION
holds (→ ADVANCE), fails (→ REFUTE), or cannot be determined within budget
(→ INCONCLUSIVE).

# 2. The novelty archive (cross-cycle context, read-only)

NOVELTY_ARCHIVE:
{NOVELTY_ARCHIVE}              # compact summary of the most-recent N=200 archived ideas
                                # from archive/novelty.jsonl: {idea_id, idea_text, verdict,
                                # status, cycle_id}. Used to check whether this idea's
                                # riskiest_assumption has been REFUTED in a prior cycle.

If you find an archived idea whose `idea_text` is semantically equivalent
to {IDEA_ID} and whose `verdict` is `refute` with status `proven-refuted`,
your dossier MUST cite that archive entry as grounds and your verdict MUST
be REFUTE unless you have NEW evidence that overturns the prior cycle's
verdict (which you must explain in the Falsification attempt section).

# 3. Your protocol (reduced Toulmin+ReAct+CoVe, 6 LLM + 3 tool calls)

You operate under a STRICT budget of 6 LLM calls + 3 tool calls. The
ordering is MANDATED; deviation auto-downgrades your dossier to
INCONCLUSIVE.

  LLM-1: STEELMAN. Write the strongest version of the idea, in the
         proponent's own words. ~100 words. You CANNOT skip this. A
         dossier that attempts refutation before steelmaning is a
         rubber-stamp (1-E mechanism #2). Save the steelman to your
         output file under the `## Steelman` section.

  LLM-2: TOULMIN DECOMPOSITION. Restate the idea's claim (the
         riskiest-assumption-is-true proposition) in one sentence. List
         the grounds you would need to support it. State the warrant
         (bridge from grounds to claim). State the backing (deeper
         theoretical / empirical foundation). State the qualifier
         (conditions under which the claim holds). State the rebuttal
         (the Popperian falsifier — the single observation that would
         disprove the claim).

  LLM-3: FALSIFICATION PLAN. Pick the SINGLE strongest test of the
         riskiest assumption. State what tool you will invoke (web_search
         / repo_read / code_exec) and what query you will run. State what
         result would REFUTE the idea. State what result would ADVANCE
         it. State what result would be INCONCLUSIVE.

  TOOL-1, TOOL-2, TOOL-3: EXECUTE the falsification plan. You have at
         most 3 tool calls. Cite-as-you-go: every tool result you cite
         in your dossier MUST include the URL (for web_search), the
         file:line (for repo_read), or the exact command + output (for
         code_exec). NO URL = NO GROUNDS = auto-INCONCLUSIVE.

  LLM-4: POSITION-SWAP. Produce TWO readings of the evidence you
         gathered:
           (a) SUPPORTER view: the case for ADVANCE, in good faith, 2-3
               sentences.
           (b) DETRACTOR view: the case for REFUTE, in good faith, 2-3
               sentences.
         Then RECONCILE: which side won, and why, with explicit reference
         to the evidence above. 1-2 sentences.

  LLM-5: VERDICT + CONFIDENCE. Output:
           - Verdict: one of {ADVANCE, REFUTE, INCONCLUSIVE}
           - Confidence: 0.0-1.0, with a one-sentence justification
           - If confidence ∈ [0.4, 0.6] (ambiguous band), you MUST
             output INCONCLUSIVE (verdict-cost asymmetry — see §H.5).

  LLM-6: CONSTRAINT FOR NEXT CYCLE. Translate your verdict into a
         constraint for the next cycle's brainstorm:
           - ADVANCE → MUST_RESPECT: "Next cycle should build on this
             verified claim: <one sentence>."
           - REFUTE  → MUST_AVOID:   "Next cycle should not propose ideas
             that depend on <the falsified assumption>: <one sentence>."
           - INCONCLUSIVE → MUST_TEST: "Next cycle should re-attempt this
             idea with a different falsifier targeting <one sentence>."
         Include a 1-2-sentence rationale linking to your dossier's
         grounds.

# 4. Output

Write your output to EXACTLY this path and no other:
  {RUN_ROOT}/research/R-{NNN}-{IDEA_ID}.md

Use the exact markdown template in §B below. Fill every field. The
orchestrator will schema-validate; missing fields = rejected output = you
re-run (wasted budget). Word budget per dossier: ~800 words total across
all sections. Force brevity; cb-review "delete > abstract". Long dossiers
are penalised at consolidation (the Judge truncates to 1000 words before
reading, per 1-E mechanism #4 verbosity-control).

# 5. What you MUST NOT do (strict role separation, mirror cb-review §3
   and 3-B §H)

- You do NOT brainstorm new ideas. You VERIFY the assigned idea only.
  Generating a "better variant" of the idea is Wave α's job, not yours.
  Your constraint_for_next_cycle tells Wave α what to do with your
  finding; you do not do it yourself.
- You do NOT spawn children. No nested reasoning agents. Your tool_calls
  are: web_search (max 3), repo_read (max 3), code_exec (max 1, for a
  ≤30-line PoC). NO tool_call that fans out (e.g., a single web_search
  that fetches 10 results and parses each is 10+ LLM calls — forbidden).
- You do NOT edit any file outside {RUN_ROOT}/research/R-{NNN}-{IDEA_ID}.md.
- You do NOT read other subagents' dossiers or other shortlisted ideas.
  Anchoring prevention (Mullen 1991, verified by 2-A): if you see
  R-002's verdict on a similar idea, your verdict will be anchored. The
  orchestrator's harness enforces this at the filesystem layer.
- You do NOT LLM-as-judge the idea itself. "Looks good to me" is not a
  verdict. The verdict must be supported by GROUNDS (URLs, code refs,
  calculations), WARRANT, and a SURVIVED FALSIFICATION ATTEMPT. A
  verdict with empty grounds → auto-INCONCLUSIVE.
- You do NOT fabricate tool results. If a tool call fails (rate limit,
  network blip, paywall), retry up to 3 times with exponential backoff
  (5s / 30s / 120s). After 3 failures: if the failed tool was your
  ONLY source for grounds, your dossier is INCONCLUSIVE with reason
  "tool_failure_no_external_grounding" (3-A §E.2.4). If the failed
  tool was a secondary source, proceed with remaining grounds and note
  the missing source in the Qualifier field. The orchestrator NEVER
  fabricates a tool result (1-A #4 ReAct failure mode); a dossier with
  a URL that was never fetched is garbage (3-A §E.2.4 gap G9 fix) and
  you will be blacklisted for the cycle.
- You do NOT cite URLs you have not actually visited via web_search
  (cite-as-you-go rule, 1-E #19). A URL that you copy from your prior
  knowledge without a web_search confirming its existence is a
  hallucinated citation (gap G4). The post-β citation verifier will
  re-fetch every URL; mismatches → auto-INCONCLUSIVE + blacklisting
  after 2 violations in one cycle (3-A §I G4 resolution).
- You do NOT use your verdict to settle a contested empirical claim by
  authority. If the evidence splits 50/50, the verdict is INCONCLUSIVE,
  and the constraint_for_next_cycle MUST specify an adjudication test
  (1-E "handling inconclusive" sub-case 3).

# 6. Hard kill-switch

Your token budget is 30,000 tokens (6,000 prompt + 24,000 output / tool
I/O). At 24,000 output-side tokens the orchestrator hard-stops you and
preserves whatever you have written so far. Partial dossier is better
than no dossier (3-A §E.2.4). The partial dossier is schema-validated
like any other (§C); if it has at least the Steelman + Toulmin Claim +
Verdict sections, it is included in consolidation; otherwise it is
marked `failed` and the orchestrator dispatches a replacement with the
same brief.

# 7. Return contract

After writing your file, exit. Do not return a summary in your final
message; the file IS your return value. The orchestrator reads it from
disk.
```

### A.2 Substitution table (orchestrator fills these in)

| Variable | Source | Per-subagent value |
|---|---|---|
| `{RUN_ROOT}` | `cycle-scope.md` | Same for all 5 subagents in a cycle. |
| `{CYCLE_ID}` | `cycle-scope.md` | e.g., `cycle-007`. Same for all 5. |
| `{NNN}` | dispatch order | `001` through `005`. Assigned in shortlist order from Wave α. |
| `{IDEA_ID}` | Wave α shortlist (`persona-seed-matrix.md` §Shortlist) | e.g., `I-007-003`. 1:1 mapping: each research subagent owns exactly one idea. |
| `{IDEA_TITLE}` | Wave α shortlist | ≤10 words, verbatim from `brainstorm/B-NNN-*.md`. |
| `{IDEA_DESCRIPTION}` | Wave α shortlist | 80-120 words, verbatim. |
| `{IDEA_RISKIEST_ASSUMPTION}` | Wave α shortlist | 1 sentence, verbatim. The research subagent's falsification target. |
| `{NOVELTY_ARCHIVE}` | `archive/novelty.jsonl` compact | Orchestrator compacts to the most-recent N=200 archived ideas (idea_id, idea_text, verdict, status, cycle_id). Older ideas are too unlikely to collide; embedding-cosine at consolidation catches them anyway. |

### A.3 Why the reduced protocol (6 LLM + 3 tool, not 1-E's full 13 + 6)

Per 3-A §G.3 + 2-B's gap G1 resolution: the scout cycle (default, 350k) cannot afford the full 1-E protocol per idea (13 LLM calls + 5-8 tool calls ≈ 64k tokens × 5 ideas = 320k for β alone, exceeding the 170k allocation). The reduced protocol collapses 1-E's 5-step pipeline (Toulmin-decompose / assumption-map+RAT / state-falsifier / run-ReAct-against-falsifier / write-dossier) into 6 LLM calls by (a) merging Toulmin-decompose and assumption-map into LLM-2 (the dossier's Toulmin section IS the decomposition; the riskiest assumption is given to you by Wave α, not re-derived), and (b) merging state-falsifier and run-ReAct into LLM-3 + TOOL-1..3 (the falsification plan IS the falsifier statement, immediately executed by the tools). Self-consistency (1-E #24) is dropped from the worker and moved to the orchestrator's optional 20% random re-verification (§H.6) — sampling N=3 verdicts per idea would triple the per-idea cost.

The full 1-E protocol is reserved for **deep cycles** (3-A §B.2 opt-in, ~727k budget, spans 2 spawns). The reduced protocol is sufficient for ordinary problems because the dossier's structural defenses (4-state → 3-state verdict, mandated steelman, mandated falsification, position-swap, cite-as-you-go) are what make the verdict trustworthy; the *depth* of the protocol (how many ReAct steps, how many self-consistency samples) improves confidence calibration but does not change the rubber-stamp-prevention properties that the structural defenses provide.

---

## B. Wave β dossier output format (`R-{NNN}-{IDEA_ID}.md`)

Each subagent writes its artifact using EXACTLY this markdown template. The orchestrator schema-validates after the subagent exits (§C); missing required fields = the artifact is rejected and the orchestrator either re-dispatches the same subagent with a tightened "fill all fields" reminder or marks it `failed` and dispatches a replacement with the same brief (3-A §E.2.4 garbage handler).

```markdown
# R-{NNN} — dossier on {IDEA_ID}

**Cycle:** {CYCLE_ID}
**Subagent ID:** R-{NNN}
**Idea ID:** {IDEA_ID}
**Started at:** {ISO-8601 timestamp}
**Completed at:** {ISO-8601 timestamp}
**Tokens used:** {input_tokens} in / {output_tokens} out / {tool_calls} tool calls
**Verdict:** {ADVANCE | REFUTE | INCONCLUSIVE}
**Confidence:** {0.0-1.0}

---

## Idea (echoed)

**Title:** {IDEA_TITLE verbatim}
**Description:** {IDEA_DESCRIPTION verbatim}
**Riskiest assumption (echoed):** {IDEA_RISKIEST_ASSUMPTION verbatim}

---

## Steelman

{Strongest version of the idea, in the proponent's own words. ~100 words.
You MUST write this section BEFORE the Falsification attempt section. The
orchestrator audits the timestamp of section completion; reversed order
auto-downgrades the verdict to INCONCLUSIVE.}

---

## Toulmin breakdown

### Claim
{One sentence. The verdict-relevant proposition: "the riskiest assumption
holds / fails / cannot be determined under conditions X." Stated as a
falsifiable proposition, not a verdict label.}

### Grounds (evidence — every entry MUST have a URL or code ref)
- {evidence_type: web_search | repo_read | code_exec | calculation | archive_lookup} | {url_or_file:line_or_command} | {snippet ≤50 words, with quoted text or exact output}
- {evidence_type} | {url_or_file:line_or_command} | {snippet}
- {evidence_type} | {url_or_file:line_or_command} | {snippet}

(Minimum 3 grounds entries. Zero-length grounds ⇒ automatic INCONCLUSIVE.
Every URL must have been actually visited via web_search in this session —
the post-β citation verifier will re-fetch each URL and check semantic
match against your snippet.)

### Warrant
{Why the grounds support the claim. 1-2 sentences. The bridge from
evidence to verdict. If this is missing or hand-wavy, the dossier is
structurally incomplete (1-E mechanism #1).}

### Backing
{Deeper theoretical or empirical foundation for the warrant. 1-2
sentences. E.g., "the warrant holds because of the Liskov Substitution
Principle" or "the warrant holds because the Lean Startup literature
shows X." May reference a textbook, paper, or canonical result — but if
you cite a paper, it goes in Citations below, not here.}

### Qualifier
{Under what conditions the claim holds. 1 sentence. E.g., "for inputs
sized <10^6 elements" or "for HTTP/2 connections with keepalive enabled"
or "under the assumption that the user has not modified the default
config." If your falsification attempt revealed a scope limitation,
state it here.}

### Rebuttal
{Conditions under which the claim fails — the Popperian falsifier. 1-2
sentences. This is the acknowledged exception, NOT a counter-argument
to your own verdict (that's the Detractor view in Position-swap
reconciliation below). E.g., "the claim fails if the input exceeds
10^6 elements, in which case the O(n log n) bound no longer holds within
the 1s budget." Empty rebuttal ⇒ automatic INCONCLUSIVE (1-E mechanism
#1: Toulmin without rebuttal = overconfidence).}

---

## Falsification attempt

**What was tried:** {1-2 sentences. The single strongest test of the
idea's riskiest assumption. Name the tool used (web_search / repo_read /
code_exec) and the exact query or command.}

**Outcome:** {1 sentence. Did the falsifier fire (→ REFUTE) or fail to
fire (→ ADVANCE) or return ambiguous evidence (→ INCONCLUSIVE)? Cite the
specific tool result that drove the outcome.}

**Was the falsification external?** {yes|no}. (If no — i.e., you reasoned
about the idea without invoking any tool — the dossier is auto-downgraded
to INCONCLUSIVE. Pure-LLM-reasoning verdicts are sycophantic by
construction per 1-E's key insight: "an AI agent verifying its own claim
without external signal is theatre.")

---

## Position-swap reconciliation

**Supporter view:** {2-3 sentences. The case for ADVANCE, made in good
faith. Cite the strongest grounds.}

**Detractor view:** {2-3 sentences. The case for REFUTE, made in good
faith. Cite the strongest counter-evidence (which may be a subset of the
grounds, read differently, or a missing piece of evidence you searched
for and could not find).}

**Reconciliation:** {1-2 sentences. Which side won and why, with
explicit reference to the evidence above. If the two views are
irreconcilable within budget, the verdict is INCONCLUSIVE and the
constraint_for_next_cycle MUST specify an adjudication test.}

---

## Verdict

**Verdict:** {ADVANCE | REFUTE | INCONCLUSIVE}
**Confidence:** {0.0-1.0}
**Confidence justification:** {one sentence. E.g., "0.78 — three
independent sources (Convex docs, GitHub issue #4321, my code PoC)
confirm the cron interval; the falsifier (find a sub-1m cron) returned
no evidence after 3 targeted web_searches."}

**Cost spent:** {tool_calls count + tokens + wallclock seconds}

---

## Constraint for next cycle

**Type:** {MUST_RESPECT | MUST_AVOID | MUST_TEST}
  (ADVANCE → MUST_RESPECT; REFUTE → MUST_AVOID; INCONCLUSIVE → MUST_TEST)

**Text:** {one-sentence imperative.}

**Rationale:** {1-2 sentences linking to dossier evidence. E.g., "R-007-003
showed Convex Hobby tier enforces ≥1m cron; the 3 cycle-007 ideas
depending on 30s polling were all REFUTE on this assumption." The
rationale MUST reference dossier grounds by their URL or code_ref.}

**Source idea(s):** {IDEA_ID}

---

## Citations

| # | URL / code ref | Live-check (filled by post-β verifier) | Snippet (≤50 words) |
|---|----------------|----------------------------------------|---------------------|
| 1 | https://...    | (leave blank — verifier fills)         | "..." (verbatim from the source) |
| 2 | https://...    |                                        | "..." |
| 3 | src/foo.ts:42  | n/a (code)                             | `function bar()` returns non-empty for inputs X, Y |
| 4 | archive/I-006-012 | n/a (archive)                       | "verdict=refute, status=proven-refuted, cycle-006" |

---

## Self-report

- **Steelman written before falsification attempt?** {yes|no}. (If no,
  dossier auto-downgraded to INCONCLUSIVE.)
- **Falsification attempt was external (used ≥1 tool_call)?** {yes|no}.
  (If no, dossier auto-downgraded to INCONCLUSIVE.)
- **Position-swap reconciliation completed (supporter + detractor +
  reconciliation all non-empty)?** {yes|no}.
- **Confidence in [0.4, 0.6] ambiguous band?** {yes|no}. (If yes,
  verdict MUST be INCONCLUSIVE per verdict-cost asymmetry §H.5.)
- **Refusals?** {none | "<reason>"}
- **Tool failures?** {none | "<tool>: <failure mode>"}
- **Persona drift?** {none | "<free text — did you start brainstorming
  new variants instead of verifying? Did you start LLM-as-judging the
  idea instead of producing grounds?>"}
```

### B.1 Field rules

- **`Claim`** is NOT the verdict. The claim is the falsifiable proposition the dossier argues for ("the riskiest assumption holds for inputs <10^6"); the verdict is the label applied to that claim (ADVANCE / REFUTE / INCONCLUSIVE). A dossier whose Claim section just says "ADVANCE" has failed the Toulmin decomposition.
- **`Grounds`** minimum 3 entries. The post-β citation verifier re-fetches each URL; entries with hallucinated URLs are flagged and the dossier cannot verdict ADVANCE with confidence > 0.5 (§G.4). Code refs (`src/foo.ts:42`) are not re-fetched but the verifier confirms the file exists and the cited line contains the claimed code (via `repo_read` at verification time).
- **`Warrant`** must be explicit, not "obviously." Per 1-E failure mode (a): "agents fill in a plausible-sounding warrant that doesn't actually hold, and the verifier rubber-stamps it." A warrant of "the grounds obviously support the claim" is a schema-validation failure.
- **`Rebuttal`** is the Popperian falsifier, NOT a counter-argument. Empty rebuttal = auto-INCONCLUSIVE.
- **`Constraint for next cycle`** is the load-bearing handoff to Wave γ-2. Its `Text` field MUST be a one-sentence imperative that the next cycle's Wave α can read via the `{PRIOR_CONSTRAINTS}` variable (3-B §B.2). Vague constraints ("be careful with X") are rejected at γ consolidation.
- **`Confidence ∈ [0.4, 0.6]`** forces INCONCLUSIVE. This is the verdict-cost asymmetry (§H.5): REFUTE costs little if wrong (idea re-emerges via novelty archive); ADVANCE costs a lot if wrong (idea pollutes next cycle). When the subagent is genuinely unsure, the conservative verdict is INCONCLUSIVE, not a coin-flip ADVANCE/REFUTE.

### B.2 Why this shape (and not 1-E's full dossier)

1-E's dossier has 10 fields (verdict, confidence, claim, grounds, warrant, steelman_counter, falsifier, premortem, rebuttal, cost_spent). This design:

- **Collapses** `steelman_counter` into the `Steelman` section (named more explicitly to surface the ordering mandate).
- **Collapses** `falsifier` into the `Rebuttal` field (they are the same thing — the Popperian falsifier IS the rebuttal in Toulmin).
- **Collapses** `premortem` into the `Detractor view` of the Position-swap reconciliation (premortem is "imagine this failed; tell the failure story"; detractor view is "make the case for REFUTE" — same act, different framing).
- **Drops** `verdict` and `confidence` from the Toulmin section into a dedicated `Verdict` section (cleaner separation between argument-structure and verdict-label).
- **Adds** `Constraint for next cycle` as a first-class section (1-E buries this in "handling inconclusive"; this design makes it mandatory for ALL three verdicts, not just INCONCLUSIVE).
- **Adds** `Self-report` with auditable booleans (steelman-before-falsify, external-falsification, ambiguous-band-check) — these are the inputs to the orchestrator's anti-sycophancy circuit-breaker (§C).

The total field count is comparable to 1-E's; the differences are organisational. The reduction in LLM calls (6 vs 13) comes from merging Toulmin-decompose+RAT (the riskiest assumption is given by Wave α, not re-derived) and merging state-falsifier+run-ReAct (the falsification plan IS the falsifier statement, immediately executed) — not from dropping fields.

---

## C. Wave β orchestrator consolidation

After all 5 Wave β subagents exit, the orchestrator (acting as the non-parallel Judge, per 1-C #15 and 3-A §B) consolidates. The consolidation is **not** itself a research subagent — it does not generate new dossiers or new verdicts (anti-anchoring; the Judge reduces, the workers verify). It performs 5 sequential operations: validate → tally → circuit-breaker → aggregate → master-summary.

### C.1 Validate (gap G9 fix — reject garbage)

For each of the 5 artifacts in `{RUN_ROOT}/research/`:

1. **Schema check:** does the file contain the required sections (header / idea-echoed / Steelman / Toulmin-breakdown / Falsification-attempt / Position-swap-reconciliation / Verdict / Constraint-for-next-cycle / Citations / Self-report)? Are all Toulmin sub-sections present (Claim / Grounds / Warrant / Backing / Qualifier / Rebuttal)?
2. **Field-shape check:** is the `Claim` a single sentence? Does `Grounds` have ≥3 entries, each with a URL or code_ref? Is the `Verdict` in {ADVANCE, REFUTE, INCONCLUSIVE}? Is `Confidence` in [0,1]? Is the `Constraint.Type` consistent with the Verdict (ADVANCE→MUST_RESPECT, REFUTE→MUST_AVOID, INCONCLUSIVE→MUST_TEST)?
3. **Ordering audit:** the `Self-report` field `Steelman written before falsification attempt?` MUST be `yes`. If `no`, the dossier is auto-downgraded to INCONCLUSIVE (confidence capped at 0.5) regardless of the subagent's stated verdict.
4. **External-falsification audit:** `Falsification attempt.Was the falsification external?` MUST be `yes`. If `no`, auto-INCONCLUSIVE (1-E key insight: pure-LLM-reasoning verdicts are sycophantic).
5. **Ambiguous-band audit:** if `Confidence ∈ [0.4, 0.6]` and `Verdict ≠ INCONCLUSIVE`, downgrade to INCONCLUSIVE (verdict-cost asymmetry, §H.5).
6. **Grounds-URL existence pre-check:** every `Grounds` URL is HEAD-requested (timeout 5s, batched). 404 / timeout URLs are flagged for the post-β citation verifier (§G) but do NOT auto-fail the dossier at this stage (the verifier does the content-match check; here we only check existence). A dossier with ≥50% of URLs 404ing is auto-INCONCLUSIVE.

**Garbage handling:** artifacts failing schema check are NOT auto-rejected. The orchestrator attempts a single repair: re-dispatch the same subagent with a tightened "fill all required fields" reminder, halved tool budget (1 tool call instead of 3), and the same idea. If the repair also fails, the artifact is marked `failed` and a replacement subagent is dispatched with the same brief but a tightened "cite-as-you-go or do not cite" mandate (3-A §E.2.4). The cycle continues with 5 artifacts (or 4 if the replacement also fails). Wave β requires ≥4 valid dossiers to proceed to Wave γ; below 4, the cycle is marked `state=blocked, blocked_reason="beta_insufficient_dossiers"` and the launcher re-wakes with the residual scope.

### C.2 Tally verdicts

After validation, the orchestrator tallies:

```json
{
  "cycle_id": "cycle-007",
  "verdict_tally": {
    "ADVANCE":      { "count": <int>, "ideas": [I-007-001, ...], "avg_confidence": <float> },
    "REFUTE":       { "count": <int>, "ideas": [I-007-002, ...], "avg_confidence": <float> },
    "INCONCLUSIVE": { "count": <int>, "ideas": [I-007-004, ...], "avg_confidence": <float> }
  },
  "all_advance_high_confidence": <bool>,   // true iff all 5 ADVANCE with avg confidence > 0.8
  "downgrades_applied": [<list of idea_ids auto-downgraded by §C.1 audits>]
}
```

### C.3 Anti-sycophancy circuit-breaker (1-E "all-advance is suspicious" rule, gap G12 fix)

Per 1-D's adaptation of cb-review's "empty CodeRabbit review is suspicious": if `all_advance_high_confidence == true` (all 5 ADVANCE with avg confidence > 0.8), the orchestrator fires ONE red-team re-dispatch:

1. **Select the target:** the ADVANCE idea with the **lowest** individual confidence (most likely sycophantic). E.g., if 5 ideas have confidences [0.85, 0.88, 0.81, 0.92, 0.86], target = I-007-003 (0.81).
2. **Dispatch a fresh subagent** with a tightened brief: same `IDEA_ID`, but the persona is "**Red-Team Auditor**" (not "ReAct+CoVe research subagent"). The Red-Team Auditor's mandate: "Your predecessor advanced this idea with confidence 0.81. Find the falsifier the predecessor missed. Your job is NOT to overturn the verdict — your job is to find the strongest disconfirming evidence. If you find none, the verdict stands. If you find strong disconfirming evidence, demote to INCONCLUSIVE." The Red-Team Auditor has the same 6 LLM + 3 tool budget; output path `{RUN_ROOT}/research/R-006-{IDEA_ID}.md` (the `R-006` slot is reserved for the DA re-dispatch).
3. **Reconcile:**
   - If the Red-Team Auditor's verdict is ADVANCE → original verdict stands; the original dossier is flagged `re-dispatched_and_upheld=true` (auditable).
   - If the Red-Team Auditor's verdict is REFUTE → original is demoted to INCONCLUSIVE (the asymmetry: REFUTE from the red-team is treated as INCONCLUSIVE, not as a flip to REFUTE — the original ADVANCE had some evidence, the red-team's REFUTE is one data point, the conservative merge is INCONCLUSIVE pending an adjudication test).
   - If the Red-Team Auditor's verdict is INCONCLUSIVE → original is demoted to INCONCLUSIVE.
4. **Cap:** the re-dispatch fires at most ONCE per cycle (3-A §G.5 fix to 1-D's "one DA per advanced idea", which would be 5 × 30k = 150k extra and bust the budget). The 25k reserve in 3-A §G.3 covers this one re-dispatch.

This is the **single-model-shop anti-sycophancy fallback** (gap G7 resolution per 3-A §I): we cannot use a different model for the Judge, so we use a different *persona* with a different *rubric* (Red-Team Auditor's rubric is "find disconfirming evidence", not "verify the idea"). Weaker than a different model but concrete and auditable per 3-A §H.5.

### C.4 Aggregate confidence per idea

The orchestrator does NOT re-score confidence. It reads each dossier's `Confidence` field verbatim. The aggregate stats in `_summary.md` (§C.5) are descriptive, not prescriptive — the next cycle's Wave α does not see per-idea confidences (anchoring prevention); it sees only the constraints written by γ-2.

The orchestrator DOES apply a **confidence calibration penalty** (§H.4) based on historical accuracy: if a research subagent's historical ADVANCE verdicts (across cycles, tracked in `archive/cycles.json`) have a <50% rate of being upheld by the next cycle's REFUTE/INCONCLUSIVE on the same idea, the orchestrator applies a 0.1 penalty to that subagent's reported confidence for this cycle's tally. (The dossier's `Confidence` field is unchanged; the tally's `avg_confidence` is the calibrated value.) This is the single-model-shop's substitute for cross-model verification: a subagent that is systematically overconfident gets its confidence discounted in the aggregate, surfacing the unreliability to the launcher.

### C.5 Master research summary (`{RUN_ROOT}/research/_summary.md`)

```markdown
# Research summary — {CYCLE_ID}

## Verdict tally
| Verdict | Count | Ideas | Avg confidence (calibrated) |
|---------|-------|-------|-----------------------------|
| ADVANCE | X | I-007-001, I-007-003 | 0.XX |
| REFUTE  | Y | I-007-002 | 0.XX |
| INCONCLUSIVE | Z | I-007-004, I-007-005 | 0.XX |

## All-advance circuit-breaker
- All-5-ADVANCE-with-conf>0.8? {yes|no}
- Re-dispatch fired? {yes|no, on which idea}
- Re-dispatch outcome? {upheld | demoted-to-INCONCLUSIVE}

## Per-idea dossier summary
### I-007-001 — {title}
- Verdict: ADVANCE, confidence 0.78
- Steelman: {first 50 words of dossier's Steelman section}
- Constraint for next cycle: MUST_RESPECT — "{one-sentence imperative}"
- Key grounds: {top 2 grounds, with URLs}

### I-007-002 — {title}
- Verdict: REFUTE, confidence 0.91
- ...

## Cross-dossier patterns
- {e.g., "R-002 and R-004 both REFUTE on Convex cron ≥1m limitation; R-001
  ADVANCE depends on a different polling mechanism that avoids this."}
- {e.g., "3 of 5 dossiers cite the same arXiv paper (2607.01641); consider
  tagging the paper in the novelty archive for cross-cycle retrieval."}

## Suspicious signals
- {e.g., "R-005's confidence is 0.95 with only 2 grounds entries (the
  minimum is 3); flagged for the post-β citation verifier to scrutinise."}
- {e.g., "R-003's Steelman section is suspiciously similar to R-001's
  Steelman section (cosine 0.88); possible context-poisoning or duplicate
  idea in the shortlist — flag for novelty archive review."}

## Handoff to Wave γ
- 5 valid dossiers ready at {RUN_ROOT}/research/R-001-*.md through R-005-*.md
- Wave γ-1 (claims-extractor) should read all 5 + this summary
- Wave γ-2 (constraint-writer) should read γ-1's output + prior cycle's
  archive/constraints.jsonl (filtered to decay_score ≥ 0.3) +
  archive/novelty.jsonl (compact, last N=200)
```

The summary is written BEFORE Wave γ dispatches. γ-1 reads it as a routing index (so it knows which dossiers are ADVANCE / REFUTE / INCONCLUSIVE without re-parsing each one's header). γ-2 reads it to understand the cross-dossier patterns that should inform constraint grouping.

---

## D. Wave γ synthesis (γ=2 subagents, SEQUENTIAL)

Per 3-A §B.1: γ is **NOT** a parallel fan-out. It is a two-stage reduce. γ-1 (claims-extractor) runs first, writes its output, exits. γ-2 (constraint-writer) is dispatched ONLY after γ-1 completes; it reads γ-1's output as input. The sequential dependency is intentional — γ-2 needs γ-1's thematic grouping of claims to apply the Delphi+Stepladder translation rule (ADVANCE→MUST_RESPECT, REFUTE→MUST_AVOID, INCONCLUSIVE→MUST_TEST). Running them in parallel would force γ-2 to re-do γ-1's grouping work, doubling the cost without parallelism benefit.

### D.1 γ-1: claims-extractor — brief template

```text
You are a WAVE γ SYNTHESIS SUBAGENT (γ-1, claims-extractor) in the
brainstorming-loop for Exigo. You are a LEAF worker. You spawn NO
children. You read EXACTLY 6 files (the 5 research dossiers + the
research summary). You write EXACTLY ONE file. Then you exit.

RUN_ROOT={RUN_ROOT}
CYCLE_ID={CYCLE_ID}
SUBAGENT_ID=S-001

# 1. Your job

EXTRACT CLAIMS from the 5 research dossiers. Group them by theme. Do NOT
verify, do NOT brainstorm, do NOT write constraints, do NOT generate new
ideas. You are a structured summariser, not a judge.

# 2. Inputs (read these and ONLY these)

- {RUN_ROOT}/research/_summary.md (the orchestrator's tally + cross-dossier
  patterns — read this FIRST as a routing index)
- {RUN_ROOT}/research/R-001-{I-001}.md
- {RUN_ROOT}/research/R-002-{I-002}.md
- {RUN_ROOT}/research/R-003-{I-003}.md
- {RUN_ROOT}/research/R-004-{I-004}.md
- {RUN_ROOT}/research/R-005-{I-005}.md

You do NOT read other cycles' archives. You do NOT read Wave α's
brainstorm artifacts. You do NOT read the orchestrator's scratchpad.

# 3. Output

Write your output to EXACTLY this path and no other:
  {RUN_ROOT}/synthesis/S-001-claims.md

Use the markdown template in §D.3 below. Word budget: ~1500 words total.
Force brevity; the constraint-writer (γ-2) needs signal, not prose.

# 4. What you MUST NOT do

- You do NOT verify claims (the research subagents did that).
- You do NOT generate new ideas for the next cycle (Wave α does that).
- You do NOT write constraints (γ-2 does that).
- You do NOT edit any file outside S-001-claims.md.
- You do NOT spawn children.

# 5. Hard kill-switch

Your token budget is 15,000 tokens (3,000 prompt + 12,000 output). At
12,000 output tokens the orchestrator hard-stops you and preserves
whatever you have written. Partial output is better than no output.
```

### D.2 γ-2: constraint-writer — brief template

```text
You are a WAVE γ SYNTHESIS SUBAGENT (γ-2, constraint-writer) in the
brainstorming-loop for Exigo. You are a LEAF worker. You spawn NO
children. You read EXACTLY 4 files (γ-1's claims + the research summary
+ prior cycle's constraints + the novelty archive compact). You write
EXACTLY ONE file. Then you exit.

RUN_ROOT={RUN_ROOT}
CYCLE_ID={CYCLE_ID}
SUBAGENT_ID=S-002

# 1. Your job

WRITE CONSTRAINTS for the next cycle's Wave α brainstorm. Apply the
Delphi+Stepladder translation:
  - Each ADVANCE claim from γ-1's output → a MUST_RESPECT constraint
  - Each REFUTE claim → a MUST_AVOID constraint
  - Each INCONCLUSIVE claim → a MUST_TEST constraint
Apply the constraint-decay rule (3-A §C.2): prior constraints that were
NOT applied this cycle (no idea was rejected for violating them) decay
by 0.15; prior constraints that WERE applied (an idea was rejected or
modified for them) reset to 1.0.

You do NOT verify, you do NOT brainstorm, you do NOT generate ideas.
Constraints are imperatives, not suggestions.

# 2. Inputs (read these and ONLY these)

- {RUN_ROOT}/synthesis/S-001-claims.md (γ-1's output — read FIRST)
- {RUN_ROOT}/research/_summary.md (the orchestrator's tally)
- archive/constraints.jsonl (filtered to decay_score ≥ 0.1 — i.e., all
  non-archived constraints; the orchestrator provides the filtered file
  at {RUN_ROOT}/synthesis/_prior_constraints.jsonl)
- archive/novelty.jsonl (compact, last N=200 — the orchestrator provides
  at {RUN_ROOT}/synthesis/_novelty_compact.jsonl; used to detect
  proposed constraints that would re-tread refuted prior-cycle ideas)

# 3. Output

Write your output to EXACTLY this path and no other:
  {RUN_ROOT}/synthesis/S-002-constraints.md

Use the markdown template in §D.4 below. Word budget: ~1200 words total.
Each constraint is ~50 words (ID + type + source + text + rationale).

# 4. Translation rules (Delphi + Stepladder, per 1-B + 1-E)

For each claim in γ-1's output, write exactly one constraint:

  ADVANCE → MUST_RESPECT
    Text: "Next cycle should build on {verified claim}, respecting
    {scope qualifier from the dossier}."
    Rationale: "{Dossier R-NNN} verified {claim} via {top ground}; the
    falsification attempt failed to overturn it."

  REFUTE → MUST_AVOID
    Text: "Next cycle should not propose ideas that depend on
    {falsified assumption}."
    Rationale: "{Dossier R-NNN} refuted {assumption} via {top ground};
    the falsifier {description} fired."

  INCONCLUSIVE → MUST_TEST
    Text: "Next cycle should re-attempt {idea or assumption} with a
    different falsifier targeting {the missing evidence}."
    Rationale: "{Dossier R-NNN} could not resolve {assumption} within
    budget; the falsification attempt returned {ambiguous evidence
    summary}. The adjudication test is: {one-sentence test specification}."

# 5. Constraint decay (3-A §C.2)

For each prior-cycle constraint in _prior_constraints.jsonl:
  - If a cycle-007 idea was REFUTED for violating it → reset decay_score
    to 1.0 (the constraint is load-bearing).
  - If a cycle-007 idea was ADVANCED without touching it → decay by 0.15.
  - If a cycle-007 idea was INCONCLUSIVE on a related assumption →
    decay by 0.05 (mild decay; the constraint may still be relevant).
  - If decay_score < 0.3 → mark `soft` (next cycle's Wave α MAY relax
    it, but must flag the relaxation in the idea's `riskiest_assumption`
    field per 3-B §B.1).
  - If decay_score < 0.1 → mark `archived` (kept in archive for audit,
    not enforced, not in the {PRIOR_CONSTRAINTS} variable passed to
    Wave α).

# 6. What you MUST NOT do

- You do NOT verify claims (γ-1 + Wave β did that).
- You do NOT generate ideas for the next cycle (Wave α does that).
- You do NOT delete prior constraints (the archive grows monotonically;
  you only update decay_score and tags).
- You do NOT edit any file outside S-002-constraints.md. (The orchestrator
  applies your decay updates to archive/constraints.jsonl in the
  end-of-cycle archive-update step; you only specify them.)
- You do NOT spawn children.

# 7. Hard kill-switch

Your token budget is 15,000 tokens (3,000 prompt + 12,000 output). At
12,000 output tokens the orchestrator hard-stops you and preserves
whatever you have written.
```

### D.3 γ-1 output template (`S-001-claims.md`)

```markdown
# S-001 — claims extracted from {CYCLE_ID} research dossiers

**Cycle:** {CYCLE_ID}
**Subagent ID:** S-001
**Generated at:** {ISO-8601}
**Inputs:** 5 dossiers + research/_summary.md

---

## Verified claims (from ADVANCE dossiers)

### Theme: {theme name, e.g., "incremental indexing under Convex cron"}

#### Claim V-001 (from R-001, idea I-007-001)
- **Claim:** {one sentence, the verified proposition}
- **Confidence:** {from dossier}
- **Scope qualifier:** {from dossier's Qualifier field}
- **Key grounds:** {top 2 grounds with URLs}
- **Rebuttal acknowledged:** {one sentence from dossier's Rebuttal field}
- **Suggested constraint type:** MUST_RESPECT

#### Claim V-002 (from R-003, idea I-007-003)
- ...

### Theme: {another theme}

#### Claim V-003 (from R-001, idea I-007-001)
- ...

---

## Refuted claims (from REFUTE dossiers)

### Theme: {theme}

#### Claim F-001 (from R-002, idea I-007-002)
- **Refuted assumption:** {one sentence}
- **Confidence:** {from dossier}
- **Falsifier that fired:** {from dossier's Falsification attempt}
- **Key grounds:** {top 2 grounds with URLs}
- **Suggested constraint type:** MUST_AVOID

---

## Inconclusive claims (from INCONCLUSIVE dossiers)

### Theme: {theme}

#### Claim U-001 (from R-004, idea I-007-004)
- **Unresolved assumption:** {one sentence}
- **Confidence:** {from dossier}
- **What was tried:** {from dossier's Falsification attempt}
- **What was missing:** {the gap that prevented resolution — synthesised
  by γ-1 across the dossier's Grounds + Rebuttal + Detractor view}
- **Suggested adjudication test:** {one-sentence test specification}
- **Suggested constraint type:** MUST_TEST

---

## Cross-dossier patterns

- {pattern 1, e.g., "3 of 5 dossiers depend on Convex scheduling; 2 of
  those REFUTE on the ≥1m cron limit, 1 ADVANCE uses a different
  mechanism (event-driven, not polling)."}
- {pattern 2, e.g., "R-001 and R-005 both cite arXiv:2607.01641; tag
  this paper in the novelty archive."}

---

## Handoff to γ-2

- {N} verified claims, {M} refuted claims, {K} inconclusive claims
- Each claim has a suggested constraint type and a 1-sentence rationale
- γ-2 should apply the Delphi+Stepladder translation (§D.2 #4) to produce
  S-002-constraints.md
```

### D.4 γ-2 output template (`S-002-constraints.md`)

```markdown
# S-002 — constraints for {CYCLE_ID + 1}'s Wave α

**Cycle:** {CYCLE_ID} (producing constraints for cycle {CYCLE_ID + 1})
**Subagent ID:** S-002
**Generated at:** {ISO-8601}
**Inputs:** S-001-claims.md + research/_summary.md + prior constraints + novelty compact

---

## New constraints (from this cycle's dossiers)

| Constraint ID | Type | Source | Text | Rationale |
|---------------|------|--------|------|-----------|
| C-{CYCLE}-001 | MUST_RESPECT | I-{CYCLE}-001 | "Next cycle should build on {verified claim}, respecting {scope}." | R-{NNN} verified {claim} via {ground}; falsification failed to overturn. |
| C-{CYCLE}-002 | MUST_AVOID | I-{CYCLE}-002 | "Next cycle should not propose ideas that depend on {falsified assumption}." | R-{NNN} refuted {assumption} via {ground}; falsifier fired. |
| C-{CYCLE}-003 | MUST_TEST | I-{CYCLE}-004 | "Next cycle should re-attempt {assumption} with a different falsifier targeting {missing evidence}." | R-{NNN} inconclusive; adjudication test: {spec}. |
| ... | ... | ... | ... | ... |

(One row per claim from S-001-claims.md. Total rows = number of claims
in S-001 = number of dossiers = 5, unless γ-1 split a multi-theme dossier
into multiple claims.)

---

## Prior constraints: decay updates

| Constraint ID | Prior decay_score | New decay_score | Action | Reason |
|---------------|-------------------|-----------------|--------|--------|
| C-006-003 | 0.85 | 1.00 | reaffirm | I-007-002 REFUTED for violating C-006-003. |
| C-006-007 | 0.55 | 0.40 | decay | No cycle-007 idea touched C-006-007. |
| C-005-012 | 0.30 | 0.25 | mark soft | Decay continues; cycle-007 did not apply. Next cycle's Wave α MAY relax. |
| C-004-019 | 0.15 | 0.10 | mark archived | Below archive threshold. Kept for audit, not enforced. |

---

## Constraints passed to next cycle's Wave α

(Orchestrator will write this list to {PRIOR_CONSTRAINTS} variable in
3-B §B.2. Only constraints with decay_score ≥ 0.3 are passed; soft
constraints are passed with a [soft] tag; archived constraints are not
passed.)

- C-{CYCLE}-001 [1.00]: "Next cycle should build on {verified claim}..."
- C-{CYCLE}-002 [1.00]: "Next cycle should not propose ideas that depend on..."
- C-{CYCLE}-003 [1.00]: "Next cycle should re-attempt {assumption}..."
- C-006-003 [1.00]: (reaffirmed prior constraint, verbatim text)
- C-006-007 [0.40]: (decayed prior constraint, verbatim text)
- C-005-012 [0.25, soft]: (soft prior constraint, verbatim text)

---

## Constraint-decay narrative

{2-3 sentences explaining the overall constraint evolution: e.g., "This
cycle added 3 new constraints (1 MUST_RESPECT, 1 MUST_AVOID, 1 MUST_TEST)
and reaffirmed 1 prior constraint (C-006-003 on Convex cron). 4 prior
constraints decayed; 1 was marked soft. The constraint space is narrowing
on the Convex scheduling theme, suggesting the next cycle should explore
non-scheduling approaches (the MUST_TEST constraint C-{CYCLE}-003
specifies the adjudication test for the event-driven alternative).")}
```

### D.5 Sequential dispatch contract

The orchestrator dispatches γ-1 and γ-2 in sequence, NOT in parallel:

1. Dispatch γ-1 with §D.1 brief. Wait for γ-1 to exit and `S-001-claims.md` to be written.
2. Schema-validate `S-001-claims.md` (required sections: Verified claims / Refuted claims / Inconclusive claims / Cross-dossier patterns / Handoff). If invalid, single repair attempt; if repair fails, γ-1 is marked `failed` and Wave γ aborts (cycle marked `state=blocked, blocked_reason="gamma_claims_extract_failed"`).
3. Dispatch γ-2 with §D.2 brief. γ-2 reads `S-001-claims.md` (validated in step 2) + `_prior_constraints.jsonl` (orchestrator-filtered) + `_novelty_compact.jsonl` (orchestrator-compacted). Wait for γ-2 to exit and `S-002-constraints.md` to be written.
4. Schema-validate `S-002-constraints.md` (required sections: New constraints / Prior constraints decay updates / Constraints passed to next cycle / Constraint-decay narrative). If invalid, single repair attempt; if repair fails, γ-2 is marked `failed` and Wave γ aborts (cycle marked `state=blocked, blocked_reason="gamma_constraint_write_failed"`).
5. Orchestrator applies the decay updates to `archive/constraints.jsonl` in the end-of-cycle archive-update step (3-A §C.2). γ-2 does NOT write to the archive directly.

The sequential dependency is the load-bearing constraint: γ-2 cannot apply the Delphi+Stepladder translation without γ-1's thematic grouping. Running them in parallel would force γ-2 to re-do γ-1's grouping (doubling cost) or skip the grouping (degrading constraint quality — without thematic grouping, γ-2 would produce 5 isolated constraints instead of 5 constraints informed by cross-dossier patterns). The 2× wall-clock cost of sequential dispatch is acceptable because γ is the smallest wave (40k tokens, 11% of cycle budget) and the cycle's terminal phase — there is no Wave δ waiting on γ.

---

## E. Constraints format (the bridge to the next cycle)

Constraints are the load-bearing feedback mechanism from Wave γ-2 to next cycle's Wave α. They are read by Wave α subagents via the `{PRIOR_CONSTRAINTS}` variable in the brainstorm brief (3-B §B.2). A constraint that is vague, ambiguous, or unverifiable is functionally useless — Wave α cannot respect a constraint it cannot parse.

### E.1 Constraint format

```
C-{CYCLE}-{NNN} | {MUST_RESPECT | MUST_AVOID | MUST_TEST} | Source: {IDEA_ID(s)} | Text: "{one-sentence imperative}" | Rationale: {1-2 sentences linking to dossier evidence}
```

### E.2 Fields

| Field | Format | Rule |
|---|---|---|
| **Constraint ID** | `C-{CYCLE}-{NNN}` | CYCLE is the cycle number that produced the constraint (e.g., `C-007-003` = 3rd constraint from cycle 7). NNN is zero-padded, monotonically increasing within a cycle. Globally unique across cycles. |
| **Type** | `MUST_RESPECT` / `MUST_AVOID` / `MUST_TEST` | Three-state vocabulary maps 1:1 to the verdict vocabulary (ADVANCE / REFUTE / INCONCLUSIVE). MUST_RESPECT = "build on this verified claim"; MUST_AVOID = "don't depend on this falsified assumption"; MUST_TEST = "re-attempt this unresolved assumption with a different falsifier." |
| **Source** | `I-{CYCLE}-{NNN}` | The idea_id whose dossier produced this constraint. Multiple source idea_ids allowed (comma-separated) if multiple dossiers converged on the same constraint (e.g., 2 REFUTE dossiers on the same Convex cron limit → one MUST_AVOID constraint with `Source: I-007-002, I-007-004`). |
| **Text** | one-sentence imperative | MUST be parseable by Wave α as a yes/no question against a candidate idea ("does this idea respect / avoid / test the constraint?"). Vague text ("be careful with X") is rejected at γ-2 validation. |
| **Rationale** | 1-2 sentences | MUST reference the source dossier by ID (R-{NNN}) and cite the key ground (URL or code_ref) that supports the constraint. This is the audit trail — if a future cycle wants to relax the constraint, the rationale tells it what evidence would need to be overturned. |

### E.3 Persisted shape in `archive/constraints.jsonl`

Each constraint is one line in `archive/constraints.jsonl` (3-A §C.2):

```json
{"constraint_id":"C-007-003","cycle_id":"cycle-007","type":"MUST_AVOID","source_idea_ids":["I-007-014"],"source_verdict":"REFUTE","source_dossier_ids":["R-007-014"],"text":"Do not propose ideas that depend on Convex cron intervals below 1 minute.","rationale":"R-007-014 showed Convex Hobby tier enforces ≥1m cron; the dossier's web_search of docs.convex.dev/scheduling confirmed the limit. 3 cycle-007 ideas depending on 30s polling were all REFUTE on this assumption.","tags":["convex","scheduling","cron","hobby-tier"],"decay_score":1.0,"status":"active","created_at":"2026-07-18T14:49:00Z","last_applied_cycle":"cycle-007","applied_count":1}
```

Fields beyond §E.2:
- `source_verdict`: ADVANCE / REFUTE / INCONCLUSIVE (matches the dossier verdict that produced the constraint).
- `source_dossier_ids`: list of dossier IDs (R-{NNN}) that produced the constraint — the audit trail.
- `tags`: free-form tags for themed retrieval (e.g., "convex", "scheduling", "cron").
- `decay_score`: 1.0 at creation; decays by 0.15 per cycle NOT applied (3-A §C.2). At <0.3 → `status=soft` (Wave α MAY relax with a flag); at <0.1 → `status=archived` (kept for audit, not enforced).
- `last_applied_cycle`: the most-recent cycle in which an idea was REFUTED or modified for violating this constraint. Resets decay_score to 1.0.
- `applied_count`: number of cycles in which the constraint has been applied. A high applied_count means the constraint is load-bearing (ideas keep violating it); a low applied_count means it may be archivable.

### E.4 Example constraints

```
C-007-001 | MUST_RESPECT | Source: I-007-001 | Text: "Next cycle should build on event-driven Convex scheduling (not polling) for ideas requiring sub-minute reactivity." | Rationale: R-007-001 verified via code PoC that Convex `mutation` + `action` chaining achieves ~5s reactivity without cron; the falsifier (find a sub-5s reactivity failure) did not fire after 3 web_searches of the Convex issue tracker.

C-007-003 | MUST_AVOID | Source: I-007-014 | Text: "Do not propose ideas that depend on Convex cron intervals below 1 minute." | Rationale: R-007-014 showed Convex Hobby tier enforces ≥1m cron; 3 cycle-007 ideas depending on 30s polling were all REFUTE.

C-007-005 | MUST_TEST | Source: I-007-004 | Text: "Next cycle should re-attempt the event-driven-vs-polling tradeoff for the user-notification use case with a different falsifier targeting tail-latency at p99." | Rationale: R-007-004 was INCONCLUSIVE on whether event-driven scheduling meets the p99 <2s latency target; the dossier's code PoC tested median latency but not p99. Adjudication test: code PoC with 10k-event synthetic load, measure p99 latency over 5-minute window.

C-006-003 | MUST_AVOID | Source: I-006-012 | Text: "Do not propose ideas that require offline batch processing >1GB on the Hobby tier." | Rationale: R-006-012 confirmed Hobby tier memory limit is 512MB; re-affirmed in cycle 007 when I-007-008 was REFUTED for the same assumption.
```

### E.5 Why three constraint types (not two, not four)

1-E's "handling inconclusive" section treats INCONCLUSIVE as a special case that feeds back as a "re-attempt" instruction. This design promotes it to a first-class constraint type (MUST_TEST), parallel to MUST_RESPECT (ADVANCE) and MUST_AVOID (REFUTE). The three-type vocabulary:

- **Maps 1:1 to the three-state verdict vocabulary** (§0 design choice 1). No translation ambiguity at γ-2.
- **Captures the third feedback path** that 1-E buried: INCONCLUSIVE is not "no feedback" — it's "specific feedback to re-attempt with a different falsifier." Without MUST_TEST, INCONCLUSIVE ideas would be silently dropped, and the next cycle would re-brainstorm the same idea with the same falsifier, hitting the same INCONCLUSIVE verdict. MUST_TEST forces γ-2 to specify the adjudication test, breaking the loop.
- **Does not include a "MUST_RELAX" type** for soft constraints. Relaxation is a property of the constraint's `decay_score` (3-A §C.2), not a separate type. A MUST_AVOID with decay_score <0.3 is relaxable; the relaxation is flagged in the idea's `riskiest_assumption` field per 3-B §B.1.

---

## F. Cost budget for Waves β and γ

### F.1 Reconciliation with 3-A and with the task brief

The task brief suggested:
- Wave β: 5 subagents × ~10k tokens each (ReAct loops + citation checking) = ~50k tokens
- Wave β orchestrator consolidation: ~10k tokens
- Wave γ: 2 subagents × ~10k tokens each = ~20k tokens
- Total Waves β+γ: ~80k tokens
- Verify this + Wave α (~95k) + overhead fits 3-A's 350k budget (should leave ~175k for orchestrator overhead, archive updates, RECORD, day-status).

3-A's actual allocation (the canonical budget this design follows):

| Wave / activity | 3-A allocation | Per-subagent cost | Subagent count |
|---|---|---|---|
| α Brainstorm (subagents) | 55,000 | 5,500 | N=10 |
| α consolidation | 15,000 | (orchestrator) | 1 |
| **β Research (subagents)** | **150,000** | **30,000** | **M=5** |
| **β consolidation** | **15,000** | (orchestrator) | 1 |
| Citation verify (post-β) | 15,000 | (orchestrator) | 1 |
| γ Synthesis (claims, γ-1) | 15,000 | 15,000 | 1 |
| γ Synthesis (constraints, γ-2) | 15,000 | 15,000 | 1 |
| γ consolidation | 10,000 | (orchestrator) | 1 |
| Archive updates | 10,000 | (orchestrator) | 1 |
| Reserve: all-advance DA re-dispatch | 25,000 | 25,000 | 0 or 1 |
| RECORD + day-status writes | 5,000 | (orchestrator) | 1 |
| **Subtotal (target)** | **350,000** | | |
| Crash margin | 30,000 | | |
| **HARD kill-switch** | **380,000** | | |

### F.2 Why the task brief's 10k/subagent is too low

The task brief's "~10k tokens per research subagent" undercounts the actual cost of the reduced Toulmin+ReAct+CoVe+dossier protocol by ~3×. Per 3-A §G.3 and 1-E's reduced protocol, each research subagent requires:

| Component | LLM calls | Tool calls | Tokens |
|---|---|---|---|
| LLM-1: Steelman (~100 words) | 1 | 0 | ~1,500 (500 prompt + 1,000 output) |
| LLM-2: Toulmin decomposition | 1 | 0 | ~2,500 (1,000 prompt + 1,500 output) |
| LLM-3: Falsification plan | 1 | 0 | ~1,500 (1,000 prompt + 500 output) |
| TOOL-1,2,3: web_search / repo_read / code_exec | 0 | 3 | ~9,000 (1,000 prompt + 1,000 output + 1,000 tool-result-input per call × 3; code_exec may be 2k) |
| LLM-4: Position-swap | 1 | 0 | ~2,500 (1,500 prompt with grounds + 1,000 output) |
| LLM-5: Verdict + confidence | 1 | 0 | ~1,500 (1,000 prompt + 500 output) |
| LLM-6: Constraint for next cycle | 1 | 0 | ~1,500 (1,000 prompt + 500 output) |
| Dossier write (final markdown assembly) | (folded into LLM-6) | 0 | ~0 |
| **Subtotal** | **6** | **3** | **~20,000** |
| Overhead (prompt reuse, harness, retries) | | | ~5,000 |
| Citation pre-check (intra-subagent HEAD requests) | | | ~2,000 |
| Buffer for retries (tool failure backoff) | | | ~3,000 |
| **Per-subagent total** | **6** | **3** | **~30,000** |

The 10k figure would require either (a) dropping 3 of the 6 LLM calls (losing the steelman-before-falsify ordering and the position-swap reconciliation — the two anti-sycophancy mechanisms that are load-bearing per §0 design choice 2), or (b) dropping 2 of the 3 tool calls (losing external grounding — the dossier would be pure-LLM-reasoning, which 1-E's key insight calls "theatre"). Neither is acceptable.

**This design follows 3-A's 30k-per-subagent allocation.** The task brief's 80k total for β+γ is reconciled upward to 3-A's 205k (β 165k + γ 40k), matching the canonical budget.

### F.3 Wave β cost breakdown

```
Per subagent: 30,000 tokens
  = 6 LLM calls × ~2,000 tokens avg (11,000)
  + 3 tool calls × ~3,000 tokens avg (9,000)
  + overhead / retries / citation pre-check (10,000)

Wave β subagent total: 30,000 × 5 = 150,000 tokens
Wave β consolidation:  15,000 tokens
                       (validate 4k + tally 1k + circuit-breaker 5k
                        + aggregate 1k + _summary.md write 4k)
Reserve (DA re-dispatch, 0 or 1): 25,000 tokens
                                  ─────────────
Wave β TOTAL (no DA):  165,000 tokens (47% of 350k)
Wave β TOTAL (with DA): 190,000 tokens (54% of 350k)
```

### F.4 Wave γ cost breakdown

```
γ-1 (claims-extractor): 15,000 tokens
  = 3,000 prompt (brief + 6 input files)
  + 12,000 output (S-001-claims.md, ~1500 words)

γ-2 (constraint-writer): 15,000 tokens
  = 3,000 prompt (brief + 4 input files)
  + 12,000 output (S-002-constraints.md, ~1200 words)

Wave γ subagent total: 30,000 tokens
Wave γ consolidation:  10,000 tokens
                       (schema-validate S-001 + S-002 + apply decay
                        updates to archive + write handoff section)
                       ─────────────
Wave γ TOTAL:          40,000 tokens (11% of 350k)
```

### F.5 Citation verification cost breakdown

```
Post-β citation verify: 15,000 tokens
  = ~25 citations (5 dossiers × ~5 cites each)
  × ~600 tokens per citation (HEAD + fetch + embed + LLM semantic-match)
  + 5,000 overhead (orchestrator LLM calls for mismatch detection)
```

### F.6 Total cycle budget reconciliation

| Wave / activity | Tokens | Cumulative |
|---|---|---|
| α Brainstorm (subagents) | 55,000 | 55,000 |
| α consolidation | 15,000 | 70,000 |
| β Research (subagents) | 150,000 | 220,000 |
| β consolidation | 15,000 | 235,000 |
| Citation verify (post-β) | 15,000 | 250,000 |
| γ Synthesis (subagents, sequential) | 30,000 | 280,000 |
| γ consolidation | 10,000 | 290,000 |
| Archive updates (novelty + constraints + cycles) | 10,000 | 300,000 |
| Reserve: all-advance DA re-dispatch (0 or 1) | 25,000 (worst case) | 325,000 |
| RECORD + day-status writes | 5,000 | 330,000 |
| **Subtotal (target, with DA fired)** | **330,000** | |
| Buffer to 350k target | 20,000 | 350,000 |
| Crash margin to 380k kill-switch | 30,000 | 380,000 |

✅ Wave β (165k without DA, 190k with DA) + Wave γ (40k) + citation verify (15k) = 220k-245k for the convergent half, fitting within 3-A's 350k cycle budget with 20k buffer to target and 50k buffer to kill-switch. Combined with Wave α (70k) and orchestrator overhead (archive 10k + DA reserve 25k + RECORD 5k = 40k), the cycle totals 330k against the 350k target. ✅

The task brief's expectation of "~175k for orchestrator overhead, archive updates, RECORD, day-status" is **not realised**: the actual overhead is ~40k (archive 10k + DA reserve 25k + RECORD 5k), not 175k. The task brief's estimate understates the cost of the research protocol by ~3× (per §F.2) and overstates the available overhead by ~4×. This design follows 3-A's canonical allocation; the 20k buffer to target / 50k buffer to kill-switch is sufficient for the cycle's needs.

### F.7 Deep-cycle variant (3-A §B.2 opt-in)

For "deep" cycles (~727k budget, opt-in per 3-A), Wave β uses the **full 1-E protocol** (13 LLM + 6 tool calls per idea ≈ 64k per subagent × 5 = 320k for β subagents + 30k consolidation + 50k DA reserve = 400k for β alone). Wave γ is unchanged (40k — synthesis does not deepen with more research depth; the constraint-writing task is the same regardless of dossier depth). The deep cycle's extra budget goes to Wave β and the D2/C2 second divergence/convergence pulses (3-A §B.2). Deep cycles span 2 spawns via mid-cycle checkpointing (3-A §E.2): spawn 1 runs α + β (≈ 470k), exits cleanly; spawn 2 (re-wake) runs γ + citation verify + archive updates (≈ 257k).

---

## G. Citation verification pipeline (resolves 2-B gap 4)

### G.1 The problem (gap G4 restated)

2-B's gap G4: Phase 1's "re-fetch verification" only checks URL existence. A research subagent can cite a real arXiv paper that doesn't contain the attributed claim. The ICLR 2026 desk-reject queue (600+ submissions for fabricated references, per CiteTracer arXiv:2605.08583) shows this is operational, not theoretical. The fix: a CiteTracer-adapted post-β verification pipeline that checks (a) URL existence, (b) URL content actually supports the claim, (c) URL text matches the citation's claimed title (anti-hallucinated-citation per 2-B gap 4).

### G.2 The pipeline (7 steps)

The orchestrator runs the citation verification pipeline AFTER all 5 Wave β subagents complete and BEFORE Wave γ dispatches. The pipeline is a single batched phase (not intra-subagent) to avoid 5× duplicate URL fetches and to enable cross-dossier dedup.

**Step 1: Extract every URL from every dossier.**

Scan each `R-{NNN}-*.md` file's `## Citations` table and `### Grounds (evidence)` list. Collect every URL into a flat list `{dossier_id, claim_summary, url, snippet}`. Code refs (`src/foo.ts:42`) are NOT URLs and are verified separately (step 5). Archive lookups (`archive/I-006-012`) are NOT URLs and are verified by checking `archive/novelty.jsonl` for the cited idea_id (step 6).

**Step 2: HEAD request each URL (timeout 10s).**

For each URL, send a HEAD request. Classify:
- `200 OK` → proceed to step 3
- `404 / 410 / 451` → mark `URL_NOT_FOUND`; the dossier cannot verdict ADVANCE with confidence > 0.5 (§G.4 below)
- `403 / 429` → retry with GET request after 30s backoff (some sites block HEAD); if still fails, mark `URL_FORBIDDEN`
- `timeout` (>10s) → mark `URL_TIMEOUT`
- `5xx` → retry once after 60s; if still fails, mark `URL_SERVER_ERROR`

**Step 3: For 200-OK URLs, fetch body text and check semantic match against the claim.**

Fetch the URL's body text (HTML → plaintext via simple parser, or PDF → first-page text via `pdftotext` for arXiv). Truncate to 10,000 characters (Larson's virtual-file abstraction per 3-A §H.6 — large tool responses are virtualised, not inlined). Embed via the same embedding model as `archive/novelty.jsonl` (3-A §C.2: `text-embedding-3-small` or local Sentence-Transformer). Compute cosine similarity between the URL's body embedding and the dossier's `claim_summary` embedding (the dossier's Claim + the snippet in the grounds entry).

- **cosine ≥ 0.6** → `VERIFIED` (the URL content semantically supports the claim)
- **cosine ∈ [0.3, 0.6]** → `PARTIAL` (the URL is topically related but does not directly support the claim; flag for LLM spot-check in step 7)
- **cosine < 0.3** → `MISMATCH` (the URL does not support the claim; hallucinated citation)

The 0.6 threshold is calibrated against CiteTracer's 97.1% accuracy benchmark (arXiv:2605.08583) — CiteTracer uses field-level matching rather than embedding cosine, but the embedding-cosine approach is a tractable approximation given exigo's single-model-shop constraint. The threshold may be tuned in future cycles based on the rate of false positives (verified citations that γ-2 marks as irrelevant) vs false negatives (mismatched citations that γ-2 marks as relevant).

**Step 4: For non-200 / timeout URLs, mark UNVERIFIED.**

A dossier with ≥1 UNVERIFIED citation cannot verdict ADVANCE with confidence > 0.5 (§G.4). The dossier is NOT auto-rejected — the verdict stands, but the confidence is capped. This is the verdict-cost asymmetry (§H.5) applied at the citation level: a high-confidence ADVANCE on a dossier with unverifiable citations is suspicious; capping the confidence forces γ-2 to translate it into a weaker MUST_RESPECT constraint (or, if the dossier's other grounds are strong enough, the cap has no effect and the constraint is unchanged).

**Step 5: URL-text mismatch detection (anti-hallucinated-citation per 2-B gap 4).**

For each 200-OK URL, extract the page's `<title>` (for HTML) or the paper's title (for arXiv PDFs, parsed from the first-page text). Compare against the citation's claimed title (the title the dossier's snippet attributes to the source — extracted from the grounds entry's snippet text, e.g., "Per CiteTracer (Li, Lin & Ma, arXiv:2605.08583, 'Source or It Didn't Happen')...").

Use a single LLM call (Judge persona, temperature 0.3) with the prompt:

```
You are a citation verifier. Compare:
  - URL page title: "{extracted title}"
  - Citation claimed title: "{claimed title from dossier snippet}"
Are these the same work? Answer JSON: {"same_work": true|false, "confidence": 0.0-1.0, "reason": "<one sentence>"}
```

If `same_work == false` with `confidence ≥ 0.7` → mark `URL_TEXT_MISMATCH`. This catches the canonical hallucinated-citation failure mode: the dossier cites "Smith et al., 'Deep Learning for Code Review', ICSE 2024" with a URL that actually points to a different paper by Smith on a different topic. The URL is real (200 OK); the citation is hallucinated.

**Step 6: Verify code refs and archive lookups.**

For code refs (`src/foo.ts:42`): the verifier runs `repo_read` on the cited file:line. If the file does not exist or the cited line does not contain code matching the dossier's snippet, mark `CODE_REF_INVALID`. If the file exists but the cited line has drifted (the codebase changed since the dossier was written — unlikely within a single cycle but possible across cycles), mark `CODE_REF_DRIFTED` and note the current line content.

For archive lookups (`archive/I-006-012`): the verifier checks `archive/novelty.jsonl` for the cited idea_id. If the idea_id does not exist, mark `ARCHIVE_LOOKUP_INVALID`. If the idea exists but its `verdict` field does not match what the dossier claims (e.g., the dossier says "I-006-012 was REFUTE" but the archive says "I-006-012 was ADVANCE"), mark `ARCHIVE_LOOKUP_MISMATCH`.

**Step 7: LLM spot-check for PARTIAL matches.**

For citations marked `PARTIAL` (cosine ∈ [0.3, 0.6]), the orchestrator runs a single LLM call per citation (Judge persona, temperature 0.3) with the prompt:

```
You are a citation verifier. The dossier cites this URL in support of this claim:
  - URL: {url}
  - URL body (first 2000 chars): "{body}"
  - Claim being supported: "{claim_summary}"
  - Dossier's snippet: "{snippet}"
Does the URL body actually support the claim? Answer JSON: {"supports": true|false, "confidence": 0.0-1.0, "reason": "<one sentence>"}
```

If `supports == false` with `confidence ≥ 0.7` → reclassify as `MISMATCH`. If `supports == true` → reclassify as `VERIFIED`. If `supports == false` with `confidence < 0.7` → leave as `PARTIAL` (ambiguous; the dossier's verdict is not auto-downgraded but the citation is flagged in `_summary.md`'s "Suspicious signals" section).

### G.3 Output: `verified.jsonl` and `refuted.jsonl`

```jsonl
// {RUN_ROOT}/citations/verified.jsonl
{"dossier_id":"R-007-003","claim_summary":"Convex Hobby tier enforces ≥1m cron","url":"https://docs.convex.dev/scheduling/cron-jobs","fetched_at":"2026-07-18T14:33:11Z","http_status":200,"content_match_score":0.82,"page_title":"Cron Jobs - Convex","citation_claimed_title":"Convex docs","url_text_match":true,"status":"VERIFIED"}
{"dossier_id":"R-007-003","claim_summary":"...","url":"https://...","status":"VERIFIED"}

// {RUN_ROOT}/citations/refuted.jsonl
{"dossier_id":"R-007-005","claim_summary":"...","url":"https://arxiv.org/abs/2607.99999","fetched_at":null,"http_status":404,"reason":"URL_NOT_FOUND","status":"REFUTED"}
{"dossier_id":"R-007-005","claim_summary":"...","url":"https://arxiv.org/abs/2605.08583","fetched_at":"...","http_status":200,"content_match_score":0.18,"page_title":"Source or It Didn't Happen","citation_claimed_title":"Multi-Agent Citation Framework","url_text_match":true,"reason":"CONTENT_MISMATCH","status":"REFUTED"}
```

### G.4 Confidence cap for dossiers with UNVERIFIED / MISMATCH citations

For each dossier, after the pipeline completes:

- If the dossier has ≥1 `MISMATCH` or `URL_TEXT_MISMATCH` citation → confidence is capped at 0.5 (the dossier cannot verdict ADVANCE with confidence > 0.5; if the stated verdict is ADVANCE with confidence > 0.5, the orchestrator downgrades the confidence to 0.5 in the tally). If the dossier has ≥2 such citations, the dossier is auto-downgraded to INCONCLUSIVE (gap G4 resolution per 3-A §I: "2+ hallucinated citations from same subagent in one cycle ⇒ subagent blacklisted").
- If the dossier has ≥1 `UNVERIFIED` citation (404 / timeout / forbidden) but no `MISMATCH` → confidence is capped at 0.5 (the dossier cannot verdict ADVANCE with confidence > 0.5). The dossier is NOT auto-downgraded — the citation may be temporarily unreachable, not hallucinated.
- If all citations are `VERIFIED` or `PARTIAL` (with no `MISMATCH`) → no cap.

The 0.5 cap is the verdict-cost asymmetry (§H.5) applied at the citation level: a high-confidence ADVANCE on a dossier with unverifiable citations is suspicious; capping the confidence forces γ-2 to translate it into a weaker MUST_RESPECT constraint.

### G.5 Cross-cycle persistence (`archive/citations.jsonl`)

To avoid re-verifying the same URL across cycles, the orchestrator persists verified citations to `agents/loop/brainstorming-loop/archive/citations.jsonl`:

```jsonl
{"url":"https://docs.convex.dev/scheduling/cron-jobs","url_hash":"sha256:...","first_verified_at":"2026-07-18T14:33:11Z","last_verified_at":"2026-07-18T14:33:11Z","http_status":200,"content_match_score":0.82,"page_title":"Cron Jobs - Convex","verified_count":1,"cycles_used":["cycle-007"]}
```

Before re-fetching a URL in step 2, the orchestrator checks `archive/citations.jsonl` for the URL's hash. If the URL was verified within the last 7 days, the cached result is reused (no re-fetch). If the URL was verified >7 days ago, it is re-fetched (the web changes; a 7-day TTL balances freshness vs cost). If the URL was previously `REFUTED`, it is re-verified every cycle (a refuted URL may have been fixed; the dossier's claim may now be supportable).

This persistence reduces the citation-verify cost from ~15k tokens (full pipeline) to ~5k tokens (cache hits + new URLs only) in steady state, after cycle 2-3 when most common URLs (Convex docs, arXiv papers cited repeatedly) are cached.

### G.6 CiteTracer adaptation note

CiteTracer (arXiv:2605.08583) uses a 12-code taxonomy (Real / Potential / Hallucinated citations) and a multi-agent architecture (Reference Extractor → Cascading Evidence Collector → Field Matcher → Class-Specialist Judgers). This design adapts CiteTracer's *intent* (content-level verification, not just URL existence) but uses a simpler single-orchestrator pipeline because:

- CiteTracer's multi-agent architecture (4 agents per citation) costs ~2,400 tokens per citation × 25 citations = 60k tokens, exceeding the 15k citation-verify budget. The embedding-cosine approach (step 3) costs ~600 tokens per citation.
- CiteTracer's 12-code taxonomy is designed for academic-paper citation auditing (where field-level matching matters — author, year, title, venue, page numbers). Exigo's dossiers cite a mix of academic papers, documentation pages, GitHub issues, and code refs. The 3-state `VERIFIED / PARTIAL / MISMATCH` taxonomy is sufficient for the loop's needs.
- CiteTracer's 97.1% accuracy is the benchmark; the embedding-cosine approach is calibrated to match it (the 0.6 threshold was chosen to roughly match CiteTracer's precision on the same benchmark, per spot-checks in the design phase). Future cycles may tune the threshold based on observed false-positive/negative rates.

The full CiteTracer pipeline is reserved for **deep cycles** (3-A §B.2 opt-in) where the extra 45k tokens (60k - 15k) is affordable and the contested-claim stakes justify the higher accuracy.

---

## H. Anti-sycophancy audit (resolves 2-B gap 7 — single-model shop)

### H.1 The problem (gap G7 restated)

2-B's gap G7: 1-E's anti-sycophancy mechanism #6 ("different judge model than proposer model where possible") cannot be applied in exigo's single-model setup (grok-only). Self-preference bias (Panickssery et al. ICLR 2025) means the same LLM family is biased toward its own outputs. The fix per 3-A §I: explicit acceptance of the self-preference risk + reliance on the OTHER six 1-E mechanisms + structural mitigations (different prompt persona, different rubric, different temperature). This section specifies the concrete single-model anti-sycophancy mechanisms for Waves β and γ.

### H.2 Mechanism inventory (8 mechanisms)

| # | Mechanism | Where in this design | 1-E reference |
|---|---|---|---|
| 1 | **3-state verdict dossier, not binary** | §0 design choice 1, §B Verdict section | 1-E mechanism #1 (4-state; this design drops "refine") |
| 2 | **Steelman-then-falsify ordering (mandated, audited)** | §A.1 LLM-1 → LLM-3 ordering; §B Self-report `Steelman written before falsification attempt?`; §C.1 ordering audit | 1-E mechanism #2 |
| 3 | **Mandated external falsification (Popper gate)** | §A.1 LLM-3 + TOOL-1..3; §B Self-report `Falsification attempt was external?`; §C.1 external-falsification audit | 1-E mechanism + Popper gate (§Synthesis step 3) |
| 4 | **Position-swap reconciliation** | §A.1 LLM-4; §B Position-swap section (supporter + detractor + reconciliation) | 1-E mechanism #4 |
| 5 | **Pre-declared rubric (the dossier schema IS the rubric)** | §B (the schema is committed in this design file, BEFORE any dossier is written; the orchestrator schema-validates against it) | 1-E mechanism #3 |
| 6 | **"All-advance is suspicious" re-dispatch (capped at 1)** | §C.3 circuit-breaker | 1-E mechanism #5; 3-A §G.5 cap |
| 7 | **Cite-as-you-go with re-fetch + content verification** | §A.1 TOOL-1..3 cite-as-you-go mandate; §G post-β citation verification pipeline | 1-E mechanism #7 |
| 8 | **Verdict-cost asymmetry (default to INCONCLUSIVE when uncertain)** | §B.1 Confidence field rule; §C.1 ambiguous-band audit; §G.4 confidence cap for unverifiable citations | NEW (this design); derived from 1-E's "inconclusive handling" + Popper |

### H.3 Single-model-shop structural mitigations (3-A §I G7 resolution)

Beyond the 8 mechanisms above, this design applies 3-A's structural mitigations for the single-model-shop constraint:

- **Different prompt persona for the Judge.** Wave β workers are dispatched as "ReAct+CoVe research subagent" (§A.1). The orchestrator's consolidation step (§C) is dispatched as "skeptic auditor looking for sycophancy signals." The DA re-dispatch (§C.3) is dispatched as "Red-Team Auditor." Three distinct personas, three distinct mandates. Same LLM, different framing.
- **Different rubric.** Workers' rubric is the Toulmin dossier schema (§B). The Judge's rubric is the schema-validation + circuit-breaker rules (§C). The Red-Team Auditor's rubric is "find the falsifier the predecessor missed." Three distinct rubrics.
- **Different temperature.** Workers at temperature 0.7 (generative, exploring evidence). Judge at temperature 0.3 (deterministic, applying rules consistently). Red-Team Auditor at temperature 0.5 (mixed — needs to explore disconfirming evidence but apply the rubric consistently). Per 3-A §I: weaker than a different model, but concrete and auditable.

### H.4 Confidence calibration (NEW, this design)

The orchestrator tracks per-subagent historical confidence vs verdict accuracy across cycles, using `archive/cycles.json` (3-A §C.2). For each research subagent (identified by `SUBAGENT_ID`), the orchestrator computes:

- **Historical ADVANCE-upheld rate:** of the subagent's past ADVANCE verdicts, how many were upheld by the next cycle's REFUTE/INCONCLUSIVE on the same idea? (An ADVANCE is "upheld" if the next cycle's dossier on the same idea is also ADVANCE, or if the idea is implemented and works; "not upheld" if the next cycle REFUTEs it or it is implemented and fails.)
- **Calibration penalty:** if the subagent's historical ADVANCE-upheld rate is <50% (i.e., the subagent is systematically overconfident), apply a 0.1 penalty to that subagent's reported confidence for this cycle's tally. If <30%, apply a 0.2 penalty. If <10% (the subagent is almost always wrong when it says ADVANCE), apply a 0.3 penalty AND flag the subagent for persona-prompt refinement in RECORD.md.

The penalty is applied to the orchestrator's `avg_confidence` tally (§C.2), NOT to the dossier's `Confidence` field (which is the subagent's self-report and is preserved verbatim for audit). This surfaces the subagent's unreliability to the launcher (who reads `_summary.md` between cycles) without rewriting history.

This is the single-model-shop's substitute for cross-model verification: we cannot ask a different model to re-verify, so we track the same model's historical accuracy and discount its confidence when it is systematically wrong. The tracking requires ≥3 cycles of history to be meaningful; the first 3 cycles of any session apply no calibration penalty (the data is too sparse).

### H.5 Verdict-cost asymmetry (NEW, this design)

The verdict vocabulary's three states have asymmetric costs if wrong:

- **REFUTE if wrong** (the idea was actually good): the idea is preserved in `archive/novelty.jsonl` with status `refuted` (3-A §C.2). A future cycle's Wave α may re-mutate the idea via the "mutation-from-prior-shortlist" seed flavor (3-B §A.3 cycle mod 5 = 4). The cost is one cycle of delay. Low cost.
- **ADVANCE if wrong** (the idea was actually bad): the idea is promoted to MUST_RESPECT in next cycle's constraints (§E). Wave α generates ideas that build on the false claim. The pollution propagates for ≥1 cycle until a future dossier REFUTEs the original claim (which requires the future dossier to overcome the MUST_RESPECT constraint's anchoring). High cost.
- **INCONCLUSIVE if wrong** (the idea was actually resolvable within budget): the idea is preserved in `archive/novelty.jsonl` with status `inconclusive`. A future cycle re-attempts with a different falsifier (per the MUST_TEST constraint). The cost is one cycle of delay. Low cost.

Given the asymmetry (ADVANCE-wrong is high-cost; REFUTE-wrong and INCONCLUSIVE-wrong are low-cost), the conservative default when uncertain is **INCONCLUSIVE**, not a coin-flip ADVANCE/REFUTE. This is formalised as:

- **Ambiguous-band rule:** if the dossier's `Confidence ∈ [0.4, 0.6]`, the verdict MUST be INCONCLUSIVE (§B.1, §C.1 ambiguous-band audit).
- **Citation-cap rule:** if the dossier has ≥1 UNVERIFIED / MISMATCH citation, confidence is capped at 0.5, forcing the verdict into the ambiguous band → INCONCLUSIVE (§G.4).
- **Position-swap irreconcilable rule:** if the dossier's Position-swap reconciliation concludes the supporter and detractor views are irreconcilable within budget, the verdict MUST be INCONCLUSIVE (§A.1 LLM-4, §B Position-swap field rule).

These three rules together make INCONCLUSIVE the default for genuinely uncertain dossiers, preventing the LLM's prior (which is to agree with its own framing → ADVANCE) from rubber-stamping.

### H.6 Random re-verification (NEW, this design)

To catch drift and context-poisoning that the structural mechanisms miss, the orchestrator randomly re-verifies 20% of ADVANCE verdicts:

1. After §C.2 tally, the orchestrator selects 20% of ADVANCE-dossiers at random (e.g., if 3 ADVANCE, select 1 at random; if 5 ADVANCE, select 1; if 1 ADVANCE, select 0 — the 20% rounds down).
2. For each selected dossier, the orchestrator dispatches a fresh research subagent with the same `IDEA_ID` but NO prior context (cold start — the fresh subagent does not see the original dossier). The fresh subagent uses the same §A.1 brief, output path `{RUN_ROOT}/research/R-{NNN+5}-{IDEA_ID}-reverification.md`.
3. The orchestrator compares the fresh verdict to the original:
   - **Same verdict (ADVANCE-ADVANCE):** original stands. The fresh dossier is appended to `archive/novelty.jsonl` as a corroborating data point.
   - **Different verdict (ADVANCE-REFUTE or ADVANCE-INCONCLUSIVE):** original is downgraded to INCONCLUSIVE. The constraint_for_next_cycle is rewritten as MUST_TEST (not MUST_RESPECT), specifying the disagreement as the adjudication test.
4. The 20% rate is calibrated to cost ~6k tokens per cycle (1 re-verification × 30k × 0.2 = 6k expected; in practice, 0 or 1 re-verification per cycle). This is folded into the §F.3 reserve.

This mechanism is the single-model-shop's substitute for self-consistency sampling (1-E #24): instead of sampling N=3 verdicts from the same subagent (which would share the same bias), we sample N=2 verdicts from two cold-start subagents (which have independent contexts). The cost is ~6k tokens per cycle (vs 60k for N=3 self-consistency on every idea), acceptable within the budget.

### H.7 Why these mechanisms are sufficient (and what they miss)

These 8 + 3 + 1 = 12 mechanisms are sufficient to make sycophantic rubber-stamping *detectable* and *costly* (in the dossier-quality sense), even in a single-model shop. They are NOT sufficient to make sycophancy *impossible* — that requires a different model for the Judge role, which exigo does not have. The acceptance per 3-A §I G7 is: weaker than a different model, but concrete and auditable. The audit trail (dossier schema, self-report booleans, citation verification logs, calibration history, re-verification logs) makes sycophancy *visible* to the launcher between cycles, who can intervene (close the loop, switch models, refine persona prompts) if the sycophancy rate is too high.

What these mechanisms miss:
- **A systematically-biased LLM that produces plausible-looking-but-wrong grounds** (e.g., a code PoC that confabulates output). The post-β citation verifier catches confabulated URLs (404 / content-mismatch) but does NOT catch confabulated code PoC output (the verifier re-runs the code only if the dossier cites a code ref via `src/foo.ts:42`, not if the dossier claims "I ran a code PoC and it returned X" without a code ref). Mitigation: §B.1 Grounds field rule requires every code-related ground to have a code ref, not just a claim of "I ran a PoC." A dossier with a code PoC claim but no code ref is auto-INCONCLUSIVE.
- **A subtle framing leak** where the Wave β subagent's framing is anchored on the Wave α subagent's framing (the dossier's `IDEA_DESCRIPTION` is echoed verbatim from the shortlist, which may bias the research toward the proposer's framing). Mitigation: the steelman-then-falsify ordering (mechanism #2) forces the research subagent to first construct the strongest version of the idea (which may differ from the proposer's framing) before attempting to refute it. The position-swap (mechanism #4) forces the research subagent to also construct the detractor view (which is structurally incompatible with the proposer's framing).
- **Adversarial collaboration** for genuinely contested 50/50-split ideas (1-E #15's narrow exception). This design treats all 50/50-split dossiers as INCONCLUSIVE with a MUST_TEST constraint specifying an adjudication test; the actual adversarial collaboration (two research subagents steelmanning opposite sides + an adjudicator) is a future v2 feature per 3-A §J ("Does NOT do multi-agent debate... the narrow exception (1-E's adversarial collaboration for 50/50-split contested ideas) is a future v2 feature, not part of the default architecture").

---

## I. What these waves do NOT do (strict role separation, mirror cb-review §3 and 3-B §H)

cb-review §3: *"Reviewers do not spawn brainstormers. Brainstormers do not edit product code. Fixers do not re-open design when a brainstorm package already chose an approach."* The brainstorming loop's Waves β and γ inherit this discipline verbatim, adapted to the research/synthesize wave names.

### I.1 Research subagents do NOT brainstorm new ideas

- The research subagent's job is to VERIFY the assigned idea, not to generate variants. Generating a "better variant" is Wave α's job (the next cycle's Wave α, seeded by the MUST_TEST constraint from this cycle's γ-2).
- The research subagent's `Constraint for next cycle` (§B) tells Wave α what to do with the finding; the research subagent does not do it itself.
- A research subagent that emits a new idea in its dossier (e.g., "a better variant would be...") has the new-idea text stripped at §C.1 schema validation (the `Constraint for next cycle.Text` field is parsed for imperatives addressed to "next cycle"; anything else is dropped).

### I.2 Research subagents do NOT spawn children

- No nested reasoning agents. The research subagent's tool_calls are: `web_search` (max 3), `repo_read` (max 3), `code_exec` (max 1, for a ≤30-line PoC). NO tool_call that fans out (e.g., a single `web_search` that fetches 10 results and parses each is 10+ LLM calls — explicitly forbidden, per 3-A §J).
- Recursive MAS (1-C #3) is the canonical failure mode this rule prevents. The Wave β subagent is a LEAF worker; it writes one file and exits.

### I.3 Research subagents do NOT edit any file outside `{RUN_ROOT}/research/R-{NNN}-{IDEA_ID}.md`

- The artifact path is hard-coded in the brief (§A.1 step 4).
- The orchestrator's harness (the in-process subagent spawner) enforces this at the filesystem layer: the subagent's write permissions are scoped to its one artifact path.
- No research subagent writes to `archive/novelty.jsonl` (orchestrator-only, at end-of-cycle), `archive/constraints.jsonl` (orchestrator-only, applying γ-2's decay updates), `archive/citations.jsonl` (orchestrator-only, in the post-β citation verify phase), `synthesis/S-*.md` (γ subagents only), `research/_summary.md` (orchestrator-only, at §C.5), `RECORD.md` (orchestrator-only), `day-status.json` (orchestrator-only), or any other research subagent's `R-{other-NNN}-*.md`.

### I.4 Research subagents do NOT read other subagents' dossiers

- Anchoring prevention (Mullen 1991, verified by 2-A): if research subagent R-002 sees R-001's verdict on a similar idea, R-002's verdict will be anchored on R-001's framing rather than an independent verification.
- The brief (§A.1 step 5) explicitly lists the off-limits paths (`research/R-001-*.md` through `research/R-005-*.md` are off-limits to any subagent that is not R-001 through R-005 respectively).
- The orchestrator's harness enforces this at the filesystem layer: each research subagent's read permissions are scoped to its own artifact (for resume after crash, per 3-A §E.2.3) + the shared variables (`IDEA_TITLE`, `IDEA_DESCRIPTION`, `IDEA_RISKIEST_ASSUMPTION`, `NOVELTY_ARCHIVE`) which are passed in the prompt, not read from disk.
- The orchestrator (consolidation step) IS allowed to read all 5 dossiers — but only AFTER all 5 have exited. The orchestrator's consolidation LLM call does not see the subagents' transcripts, only their final artifacts.

### I.5 Synthesis subagents do NOT verify

- γ-1 (claims-extractor) reads the 5 dossiers and extracts claims; it does NOT re-verify them. The dossiers' verdicts are taken as input.
- γ-2 (constraint-writer) reads γ-1's output and writes constraints; it does NOT re-verify the claims or re-judge the dossiers.
- If γ-1 or γ-2 disagrees with a dossier's verdict (e.g., γ-1 thinks an ADVANCE dossier should have been REFUTE), the disagreement is logged in `S-001-claims.md`'s "Suspicious signals" section for the launcher's between-cycle review — but the dossier's verdict is NOT changed by γ. Only the orchestrator's §C.3 circuit-breaker or §H.6 random re-verification can change a dossier's verdict, and only within Wave β.

### I.6 Synthesis subagents do NOT generate ideas for the next cycle

- γ-2 writes CONSTRAINTS, not ideas. A constraint is a one-sentence imperative addressed to next cycle's Wave α (§E). γ-2 does not propose specific ideas; it tells Wave α what to respect / avoid / test.
- If γ-2 emits a specific idea in `S-002-constraints.md` (e.g., "next cycle should brainstorm an event-driven notification system"), the idea text is stripped at γ consolidation schema-validation (the constraint `Text` field is parsed for imperatives; specific idea proposals are dropped). The constraint becomes "next cycle should respect that event-driven scheduling is a verified alternative to polling" (the abstract imperative, not the specific idea).
- This rule prevents γ-2 from becoming a shadow brainstormer. The next cycle's Wave α generates the ideas; γ-2 sets the constraints within which the ideas are generated. Roles do not bleed (cb-review §3 analog).

### I.7 The orchestrator (Judge role) during Wave β consolidation is NOT a research subagent

- The orchestrator's §C consolidation does NOT generate new dossiers or new verdicts. It validates, tallies, fires the circuit-breaker, aggregates, and writes `_summary.md`. The DA re-dispatch (§C.3) generates a new dossier, but it does so by dispatching a NEW research subagent (the Red-Team Auditor) — the orchestrator itself does not write the dossier.
- The orchestrator's §C.5 `_summary.md` is a routing index for γ-1, NOT a verdict. The verdicts are in the dossiers; `_summary.md` tallies them.

### I.8 The orchestrator during Wave γ consolidation is NOT a constraint-writer

- The orchestrator's §D.5 step 5 (apply decay updates to `archive/constraints.jsonl`) is a mechanical application of γ-2's specified decay updates. The orchestrator does NOT write new constraints or modify γ-2's constraint text.
- If γ-2's `S-002-constraints.md` is invalid (fails schema validation), the orchestrator does NOT fix it; it dispatches a single repair attempt (§D.5 step 4). If the repair fails, the cycle is marked `state=blocked, blocked_reason="gamma_constraint_write_failed"` and the launcher re-wakes with the residual scope.

---

## J. Handoff to the final LOOP.md author

This file specifies Waves β and γ in detail. The following are out of scope here and must be specified by the final `LOOP.md` author (or in a sibling Phase-2 file):

1. **The full CiteTracer-adapted citation-verification pipeline** for deep cycles (§G.6 notes the adaptation; the deep-cycle variant with CiteTracer's 12-code taxonomy and 4-agent architecture is reserved for deep cycles and specified in a sibling research task per 3-A §K.4).
2. **The compaction prompt for the long-lived orchestrator** (3-A §K.5; 2-B's R2 research task). The orchestrator's context grows across waves within a cycle and across cycles within a session; the 80% threshold compaction (Larson pattern, 3-A §H.6) needs a concrete prompt.
3. **The mid-cycle checkpoint resume contract for Wave β** (3-A §E.2; 2-B's R3 research task). This file references the checkpoint store (`checkpoints/beta-R-{NNN}.json`) but does not specify the resume contract in detail; 3-A §E.2.3 specifies the general pattern.
4. **The exact embedding model** for the citation content-match (§G.2 step 3). This design defers to 3-A §C.2's choice (`text-embedding-3-small` or local Sentence-Transformer); the final choice is an implementation detail.
5. **The deep-cycle Wave β brief** (full 1-E protocol, 13 LLM + 6 tool calls per idea). This file specifies the scout-cycle reduced protocol (§A.1); the deep-cycle variant is structurally similar but with more LLM calls (added self-consistency, added reflexion, added second falsification attempt) and is specified in 3-A §B.2 + 1-E's full protocol.
6. **The `LOOP.md` document itself.** This file specifies Waves β and γ; `LOOP.md` is the canonical protocol the cycle-scope orchestrator reads at spawn time. It should be derived from this file + 3-A + 3-B + cb-review's `LOOP.md` structure.

---

## K. Sources (re-cited from Phase 1 for load-bearing claims)

### Primary load-bearing

- **1-E — Verification & Research Methods** (full file). Toulmin dossier (method #22), 5-step pipeline (Synthesis section), 7 anti-sycophancy mechanisms, inconclusive handling (3 sub-cases), "all-advance is suspicious" rule. Load-bearing for §A (brief template), §B (dossier shape), §C.3 (circuit-breaker), §H (anti-sycophancy audit).
- **2-B — Contradictions, Gaps, Pre-mortem** (full file). Gap G4 (hallucinated-citation content verification), gap G7 (single-model-shop anti-sycophancy), gap G12 (DA re-dispatch cap), CiteTracer citation, Waxell enforcement-not-alerts. Load-bearing for §G (citation pipeline), §H (anti-sycophancy), §F (cost).
- **3-A — Outer Loop Architecture** (full file). N=10, M=5, γ=2; 350k cycle budget; β allocation 170k (150k subagents + 15k consolidation + 5k reserve); γ allocation 40k (30k subagents + 10k consolidation); citation verify 15k; enforced kill-switch 380k; archive spec (`archive/novelty.jsonl`, `archive/constraints.jsonl`, `archive/citations.jsonl`); phase-state-machine (§E.2); "all-advance is suspicious" cap at 1 (§G.5); single-model-shop structural mitigations (§I G7); deep-cycle opt-in (§B.2). Load-bearing for the entire numerical superstructure and the role-separation rules.
- **3-B — Wave α (Brainstorm) Protocol** (full file). Shortlist handoff (§I), persona×seed matrix (§A), brief-template house style (§B), schema-validation pattern (§D.1), failure-mode handlers (§G), strict role-separation rules (§H). Load-bearing for §A.2 (`{IDEA_*}` variables come from 3-B's shortlist), §I (role-separation mirrors 3-B §H), §F.1 (Wave α budget reconciliation).
- **1-D — cb-review autonomy extraction** (full file). 14-item extraction + 8 invariant rules. "All-advance is suspicious" rule (cb-review's "empty CodeRabbit review is suspicious" analog). Strict A→B→C wave separation. Load-bearing for §C.3 (circuit-breaker), §I (role separation).

### Secondary (re-cited from 1-A, 1-B, 1-C, 2-A for the dossier fields and failure-mode handlers)

- **Toulmin, *The Uses of Argument*, 1958** — claim / grounds / warrant / backing / qualifier / rebuttal. Load-bearing for §B Toulmin breakdown (Purdue OWL: https://owl.purdue.edu/owl/general_writing/academic_writing/historical_perspectives_on_argumentation/toulmin_argument.html).
- **Popper / Falsifiability (IEP)** — https://iep.utm.edu/pop-sci · https://en.wikipedia.org/wiki/Falsifiability. Load-bearing for §A.1 LLM-3 falsification plan, §B Rebuttal field (the Popperian falsifier).
- **Yao et al., ReAct (arXiv:2210.03629)** — https://arxiv.org/abs/2210.03629. Load-bearing for §A.1 ReAct+CoVe protocol.
- **Chain-of-Verification (CoVe, arXiv:2309.11495)** — https://arxiv.org/abs/2309.11495. Load-bearing for §A.1 CoVe verification loop.
- **Li, Lin & Ma, CiteTracer (arXiv:2605.08583)** — https://arxiv.org/html/2605.08583v1. 12-code taxonomy, 97.1% accuracy, ICLR 2026 desk-reject queue. Load-bearing for §G citation verification pipeline.
- **Mullen, Johnson & Salas 1991** — https://psycnet.apa.org/record/1991-24145-001. Nominal silent generation outperforms interactive groups. Load-bearing for §I.4 anchoring prevention.
- **Wang & Yin, Devil's Advocate (IUI 2024)** — https://mingyin.org/paper/IUI-24/devil.pdf. Unbound DA collapses to sycophancy. Load-bearing for §C.3 Red-Team Auditor mandate.
- **Panickssery et al., Self-preference bias (ICLR 2025)** — https://arxiv.org/html/2410.21819v1. Load-bearing for §H single-model-shop problem statement.
- **Larson (Will), Context window compaction (Dec 2025)** — https://lethain.com/agents-context-compaction. 80% threshold, virtual file abstraction. Load-bearing for §G.2 step 3 (citation body truncation to 10k chars).
- **Waxell, AI Agent Token Budget Enforcement (Apr 2026)** — https://waxell.ai/blog/ai-agent-token-budget-enforcement. Enforcement not alerts. Load-bearing for §A.1 step 6 hard kill-switch.
- **Liang et al., LLMs Generate Novel Research Ideas (NeurIPS 2024)** — https://arxiv.org/html/2409.04109v1. LLMs over-rate novelty, under-rate feasibility. Load-bearing for §H.5 verdict-cost asymmetry (the verifier down-weights LLM self-assessment).
- **Hou, Wang, Zhao & Wang, When Agents Do Not Stop (arXiv:2607.01641)** — https://arxiv.org/abs/2607.01641. IAL-Scan. Load-bearing for §C.1 garbage handler (never abandon a cycle half-judged).
- **Anthropic, Multi-agent research system (Jun 2025)** — https://www.anthropic.com/engineering/multi-agent-research-system. Orchestrator-worker, separate context windows, 15× multiplier. Load-bearing for §A (1:1 mapping of research subagent to idea), §I.4 (context isolation).
- **Klein, Performing a Project Premortem (HBR 2007)** — https://hbr.org/2007/09/performing-a-project-premortem. Load-bearing for §B Detractor view (premortem framing).
- **Steelmanning** — https://themindcollection.com/steelmanning-how-to-discover-the-truth-by-helping-your-opponent. Load-bearing for §A.1 LLM-1 steelman, §B Steelman section.

### In-repo paths read in full for this task

- `/home/z/my-project/worklog.md` (1-A through 3-B Stage Summaries)
- `/home/z/my-project/repo/exigo/agents/loop/_meta/phase-2-brainstorm/3-A-outer-loop-architecture.md` (full — 681 lines)
- `/home/z/my-project/repo/exigo/agents/loop/_meta/phase-2-brainstorm/3-B-brainstorm-wave-protocol.md` (full — 610 lines)
- `/home/z/my-project/repo/exigo/agents/loop/_meta/phase-1-brainstorm/1-E-verification-and-research-methods.md` (full — 392 lines)
- `/home/z/my-project/repo/exigo/agents/loop/_meta/phase-1-research/2-B-contradictions-gaps-premortem.md` (full — 326 lines)
- `/home/z/my-project/repo/exigo/agents/loop/_meta/phase-1-brainstorm/1-A-ai-brainstorming-methods.md` (skimmed — persona set, lateral-thinking family)
- `/home/z/my-project/repo/exigo/agents/loop/_meta/phase-1-brainstorm/1-B-human-brainstorming-methods.md` (skimmed — Delphi, Stepladder)
- `/home/z/my-project/repo/exigo/agents/loop/_meta/phase-1-brainstorm/1-C-subagent-coordination-patterns.md` (skimmed — orchestrator-worker, Judge non-parallel)
- `/home/z/my-project/repo/exigo/agents/loop/_meta/phase-1-brainstorm/1-D-cb-review-autonomy-extraction.md` (skimmed — invariant rules, "all-advance is suspicious")
- `/home/z/my-project/repo/exigo/agents/loop/_meta/phase-1-research/2-A-claim-verification.md` (skimmed — Deng/Brucks/Toubia corrections)
