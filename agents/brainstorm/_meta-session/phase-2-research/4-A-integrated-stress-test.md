# 4-A — Integrated Stress Test of the Phase 2 Design

**Task ID:** 4-A
**Agent:** general-purpose (integrated stress test)
**Date:** 2026-07-18
**Scope:** The final stress-test pass before `LOOP.md` is written. Read 3-A (outer loop, 681 lines), 3-B (Wave α, 610 lines), and 3-C (Waves β+γ, 1336 lines) *together* as one integrated design and find the ONE thing (or, realistically, the top cluster of things) that would make `LOOP.md` broken or unrunnable if shipped as-is. Re-run 2-B's 16 pre-mortem scenarios against the integrated design. Compare against cb-review's `LOOP.md` §0–§12 to identify missing sections. End with a one-paragraph sanity check: would a fresh agent succeed on cycle 1?
**Inputs read in full:** `worklog.md` (1-A through 3-C Stage Summaries), `3-A-outer-loop-architecture.md`, `3-B-brainstorm-wave-protocol.md`, `3-C-research-and-synthesis-protocol.md`, `2-B-contradictions-gaps-premortem.md` (16 pre-mortem rows), `agents/cd-review/LOOP.md` (§0–§12, for the section-completeness check).

---

## TL;DR (the answer before the argument)

The Phase 2 design is *architecturally* coherent — the 3 files resolve all 7 of 2-B's must-address gaps and adopt a consistent persona×seed → shortlist → dossier → constraint pipeline. But it has **5 must-fix-before-shipping integration bugs** that would each make `LOOP.md` unrunnable as-is. The single most damaging is a **synthesis-file-path mismatch**: 3-A's launcher (§A.1 step 5, §B diagram, §C directory layout) reads `synthesis/S-001.md` + `synthesis/S-002.md`, but 3-C (§D.1 step 3, §D.2 step 3, §D.5) writes `synthesis/S-001-claims.md` + `synthesis/S-002-constraints.md`. The launcher literally cannot find the cycle's output. The other 4 (verdict-vocabulary mismatch, citation-verify wave-ordering contradiction, `archive/citations.jsonl` mid-cycle write violating 3-A's own RUN_ROOT discipline, `deferred` status missing from 3-A's novelty.jsonl enum) are equally concrete and each blocks one path through the loop.

---

## A. Integration consistency check (3-A × 3-B × 3-C)

I cross-read the 3 Phase 2 design files looking for: numbers that disagree, briefs that contradict, file paths that disagree, persona names/counts that disagree, and wave-ordering issues. Below are the integration bugs found, ranked by damage. (Items A.1–A.5 are the load-bearing ones; A.6–A.15 are smaller but worth flagging.)

### A.1 Synthesis file paths: `S-001.md` vs `S-001-claims.md` — CRITICAL

- **3-A §A.1 step 5 (launcher between cycles):** "read the just-completed cycle's `synthesis/S-001.md` (claims) + `synthesis/S-002.md` (constraints)…"
- **3-A §B diagram (line 184-186):** "→ S-001: extract verified / refuted / inconclusive claims … → S-002: extract next-cycle constraints … → both write synthesis/S-001.md + synthesis/S-002.md"
- **3-A §C directory layout (lines 264-266):** `synthesis/S-001.md` and `synthesis/S-002.md` (no suffix).
- **3-A §I G6 resolution table** and **3-A §K.7 handoff** also reference `S-001.md` / `S-002.md`.

vs.

- **3-C §D.1 step 3 (γ-1 brief):** "Write your output to EXACTLY this path and no other: `{RUN_ROOT}/synthesis/S-001-claims.md`"
- **3-C §D.2 step 3 (γ-2 brief):** "{RUN_ROOT}/synthesis/S-002-constraints.md"
- **3-C §D.5 step 2-4:** schema-validate `S-001-claims.md` then `S-002-constraints.md`.

**The launcher reads files that the synthesis subagents never write.** A cycle that runs end-to-end will produce `S-001-claims.md` + `S-002-constraints.md`, but the launcher (per 3-A) will look for `S-001.md` + `S-002.md`, fail to find them, and either crash or treat the cycle as having no output. This is the single most damaging integration bug: it breaks the launcher ↔ cycle-scope contract.

### A.2 Verdict vocabulary: 4-state lowercase vs 3-state UPPERCASE — CRITICAL

- **3-A §A.2 (orchestrator role, step 3):** "decides kill/refine/advance/inconclusive per idea"
- **3-A §B diagram (line 164-166):** "kill/refine/advance/inconclusive per idea + 'all-advance is suspicious' check"
- **3-A §C.2 `archive/novelty.jsonl` schema:** `"status" ∈ {proven, refuted, inconclusive, advance, kill}` — lowercase, 5-state including `kill`.
- **3-A §D RECORD.md template (Shortlist/verdicts table):** lowercase `advance`, `kill`, `inconclusive`.

vs.

- **3-C §0 design choice 1:** "Three-state verdict vocabulary: ADVANCE / REFUTE / INCONCLUSIVE (dropped 'refine' from 1-E's four-state set)."
- **3-C §A.1 LLM-5 (research subagent brief):** "Verdict: one of {ADVANCE, REFUTE, INCONCLUSIVE}"
- **3-C §B dossier template:** `**Verdict:** {ADVANCE | REFUTE | INCONCLUSIVE}`
- **3-C §C.2 tally JSON:** `"ADVANCE"`, `"REFUTE"`, `"INCONCLUSIVE"` (uppercase).
- **3-C §E.3 `archive/constraints.jsonl` schema:** `"source_verdict":"REFUTE"` (uppercase, matching 3-C).
- **3-C §E.5:** "Maps 1:1 to the three-state verdict vocabulary."

**Three concrete consequences:**
1. **`kill` (3-A) vs `REFUTE` (3-C)** for the same concept. The orchestrator (per 3-A) thinks in `kill`; the research subagents (per 3-C) think in `REFUTE`. Some translation layer is needed at the orchestrator boundary, but neither file specifies one.
2. **`refine` exists in 3-A but is dropped in 3-C.** If the orchestrator expects `refine` verdicts (per 3-A §A.2) and the research subagents never produce them (per 3-C §A.1), the orchestrator's tally will be 3-state but the orchestrator's mental model is 4-state. This is more than cosmetic — 1-E's `refine` was a real verdict state with semantic meaning ("this idea is promising but needs revision before being passed forward"), and 3-C explicitly drops it because "it overlaps with Wave γ-2's constraint-writer." If the orchestrator (per 3-A) still expects to handle `refine` verdicts, the handling code path is dead but the expectation is unmet.
3. **Cross-archive schema inconsistency.** `archive/novelty.jsonl` (3-A's schema) uses lowercase verdicts; `archive/constraints.jsonl` (3-C's schema) uses uppercase `source_verdict`. A future agent reading both archives has to know to case-fold. The `deferred` status (3-B §D.5) is a 4th consequence (see A.5 below).

3-C's vocabulary is the better design (3 states map 1:1 to 3 constraint types MUST_RESPECT/MUST_AVOID/MUST_TEST; `refine` was genuinely ambiguous). The fix is to propagate 3-C's vocabulary back through 3-A. But as shipped, the two files disagree.

### A.3 Citation-verify wave ordering: 3-A §A.2 text vs 3-A §B diagram vs 3-C — CRITICAL

- **3-A §A.2 step 1 (orchestrator role):** "Execute `LOOP.md` end-to-end for one cycle: Wave α (brainstorm) → Wave β (research) → Wave γ (synthesis) → post-research citation verification → novelty archive + constraint archive updates → write synthesis docs → update `RECORD.md` + `day-status.json` → exit `state=complete`." (γ **before** citation verify)

vs.

- **3-A §B diagram (lines 154-195):** α → α consolidation → β → β consolidation → **post-β citation verify** → γ → archive updates → done. (citation verify **before** γ)
- **3-A §G.3 budget table:** "Citation verify (post-β) 15,000" — listed between β and γ, consistent with §B diagram.
- **3-C §0 design summary:** "After all 5 subagents exit, the orchestrator … consolidates … writes `research/_summary.md` and hands off to Wave γ." (implying β → γ directly, ambiguous on citation-verify placement)
- **3-C §G.2 step 1:** "The orchestrator runs the citation verification pipeline AFTER all 5 Wave β subagents complete and BEFORE Wave γ dispatches." (citation verify **before** γ — matches 3-A §B diagram)

**3-A §A.2 is internally inconsistent with 3-A §B/§G.3 and with 3-C.** The canonical order (per the budget table and the diagram and 3-C) is β → citation-verify → γ, but the orchestrator's role description in §A.2 inverts it to γ → citation-verify. A fresh agent reading §A.2 first would dispatch γ before verifying citations, then discover the γ-1 claims-extractor is reading dossiers whose citations haven't been verified yet, then have to either re-run γ after citation-verify (burning the γ budget) or accept unverified citations into the synthesis docs (defeating gap G4's fix).

There's also a deeper ordering question that neither file answers: **citation-verify can cap an ADVANCE dossier's confidence to 0.5 (3-C §G.4), which can flip the all-advance circuit-breaker (§C.3) on or off.** If citation-verify runs *before* the circuit-breaker check (as 3-C §C.3 implies — the circuit-breaker is part of β consolidation, before citation-verify), the circuit-breaker sees the un-capped confidences. If it runs *after*, the circuit-breaker sees the capped confidences. 3-C §C.3 step 1 says "Select the target: the ADVANCE idea with the lowest individual confidence" — but which confidence, pre-cap or post-cap? 3-C doesn't say.

### A.4 `archive/citations.jsonl` mid-cycle write violates 3-A's RUN_ROOT discipline — HIGH

- **3-A §C.1 (file-purpose rules):** "RUN_ROOT discipline: `RUN_ROOT=agents/loop/brainstorming-loop/runs/YYYY-MM-DD-CNNN` is the only path agents write to during a cycle. **Never write artifacts at `archive/` *during* a cycle except via the orchestrator's end-of-cycle archive-update step.**"

vs.

- **3-C §G.5 (cross-cycle persistence):** "the orchestrator persists verified citations to `agents/loop/brainstorming-loop/archive/citations.jsonl`" — and §G.2 says the citation pipeline runs **AFTER all 5 Wave β subagents complete and BEFORE Wave γ dispatches**, i.e. **mid-cycle**, not at the end-of-cycle archive-update step.
- **3-C §G.5 step 2:** "Before re-fetching a URL in step 2, the orchestrator checks `archive/citations.jsonl` for the URL's hash." — also a mid-cycle *read* from `archive/`, which 3-A §C.1 doesn't address but is consistent with "archive is the only cross-cycle store."
- **3-A §C directory layout:** does NOT list `archive/citations.jsonl` at all (only `novelty.jsonl`, `constraints.jsonl`, `cycles.json`).

**3-C introduces a 4th archive file that 3-A's directory layout doesn't list, and writes to it mid-cycle in violation of 3-A's explicit RUN_ROOT discipline.** The intent is good (cross-cycle citation cache → 7-day TTL → reduces verify cost from 15k to ~5k in steady state), but the implementation breaks 3-A's invariant rule #7 (single source of truth: archive grows only at end-of-cycle).

### A.5 `deferred` status missing from 3-A's novelty.jsonl enum — HIGH

- **3-A §C.2 `archive/novelty.jsonl` schema:** `"status" ∈ {proven, refuted, inconclusive, advance, kill}`. (5-state, lowercase.)
- **3-B §D.5 (non-shortlisted ideas):** writes ideas with `"verdict":"deferred","confidence":null,"status":"deferred"`. (Adds a 6th status, `deferred`, that 3-A's enum doesn't include.)
- **3-B §D.3 (dedup-against-archive):** handles `proven`/`advance` (skip), `refuted`/`kill` (skip), `inconclusive` (eligible) — but is **silent on `deferred`**. A `deferred` archived idea (a prior-cycle non-shortlisted idea) has no dedup rule. Should a new idea that's cosine ≥ 0.90 with a `deferred` archived idea be (a) skipped (treated like proven/advance — the prior cycle already saw it and didn't advance it), (b) eligible (treated like inconclusive — the prior cycle didn't reject it, just didn't shortlist it), or (c) something else?

3-B's intent (deferred = "preserved for future mutation, not rejected") suggests (b) eligible. But the rule isn't written. A fresh agent implementing 3-B §D.3 will hit a `deferred` status in `archive/novelty.jsonl` (because 3-B §D.5 put it there) and not know what to do.

### A.6 Wave β budget arithmetic: 170k (3-A) vs 165k no-DA / 190k with-DA (3-C) — MEDIUM

- **3-A §B.1 table:** "Research budget (β) | 170k (49%) | M=5 × 30k each … + orchestrator consolidation 15k + **5k reserve**."
- **3-A §B diagram (line 155):** "WAVE β — RESEARCH / VERIFY budget: 170k"
- **3-A §G.3 budget table:** β subagents 150k + β consolidation 15k = 165k (no separate "5k reserve" line). The next line is "Reserve: all-advance DA re-dispatch (capped at 1) | 25k".

vs.

- **3-C §F.1 (reconciliation table):** "β Research (subagents) | 150,000 | 30,000 | M=5" + "β consolidation | 15,000" = 165k. The 25k DA reserve is a separate line item.
- **3-C §F.3:** "Wave β TOTAL (no DA): 165,000 tokens (47% of 350k). Wave β TOTAL (with DA): 190,000 tokens (54% of 350k)."

**3-A's "5k reserve" embedded inside the β budget line is not the 25k DA reserve (which is a separate line item in both 3-A and 3-C). What is the 5k for?** 3-A §B.1 says "+5k reserve" without specifying its purpose. 3-C treats β as exactly 165k (no embedded reserve). The 5k discrepancy is small but unexplained; if it's the buffer for §C.1's "single repair attempt" on a failed research dossier, that should be stated. If it's redundant with the 30k crash margin, it should be deleted.

The downstream consequence: a fresh agent reading 3-A §B.1 thinks β=170k; reading 3-A §G.3 thinks β=165k+separate 25k DA reserve; reading 3-C thinks β=165k no-DA / 190k with-DA. The cycle kill-switch arithmetic (380k) tolerates this 5k ambiguity, but the per-wave kill-switch (3-A §B.3: "if `tokens_used ≥ 350k` AND the cycle is not in `synthesizing` or later: stop cleanly") depends on which phase the orchestrator thinks it's in, and the phase boundaries are budget-driven.

### A.7 `decay_score ≥ 0.3` (Wave α input) vs `decay_score ≥ 0.1` (γ-2 input) vs `≥ 0.3 + [soft] tag` (γ-2 output) — MEDIUM

Three different filter thresholds appear:

- **3-B §B.2 (`{PRIOR_CONSTRAINTS}` source):** "`archive/constraints.jsonl` filtered to `decay_score ≥ 0.3`" — i.e., Wave α sees only enforced constraints, NOT soft ones.
- **3-C §D.2 step 2 (γ-2 inputs):** "`archive/constraints.jsonl` (filtered to `decay_score ≥ 0.1` — i.e., all non-archived constraints)" — i.e., γ-2 sees both enforced AND soft constraints.
- **3-C §D.4 step 4 (γ-2 output, "Constraints passed to next cycle's Wave α"):** "Only constraints with `decay_score ≥ 0.3` are passed; **soft constraints are passed with a [soft] tag**; archived constraints are not passed." — i.e., γ-2's output to Wave α INCLUDES soft constraints (with a tag).

**3-B says Wave α receives constraints with `decay_score ≥ 0.3` (no soft). 3-C §D.4 says γ-2's output (which becomes Wave α's input) includes soft constraints with a `[soft]` tag. These contradict.**

The intent (probably) is: γ-2 writes the full set including soft-tagged; Wave α's orchestrator-filter then strips the soft ones before substituting into the `{PRIOR_CONSTRAINTS}` variable. But this isn't stated, and a fresh agent reading 3-B §B.2 alone would write an orchestrator filter that drops soft constraints, while a fresh agent reading 3-C §D.4 alone would let them through. The result is that Wave α may or may not see soft constraints, depending on which file the implementer follows.

### A.8 `R-006` slot collision between DA re-dispatch and 20% random re-verification — MEDIUM

- **3-A §C directory layout:** `R-006-I-003.md ← (optional, the all-advance DA re-dispatch for idea I-003)` — R-006 is reserved for the DA re-dispatch.
- **3-C §C.3 step 2:** "output path `{RUN_ROOT}/research/R-006-{IDEA_ID}.md` (the `R-006` slot is reserved for the DA re-dispatch)."
- **3-C §H.6 step 2 (random re-verification):** "output path `{RUN_ROOT}/research/R-{NNN+5}-{IDEA_ID}-reverification.md`." With M=5 (R-001..R-005), NNN+5 = R-006 for the first re-verification.

**If both the DA re-dispatch (§C.3) AND the 20% random re-verification (§H.6) fire in the same cycle — which is possible when all 5 verdicts are ADVANCE with high confidence — both write to a path starting with `R-006`.** The DA re-dispatch path is `R-006-{IDEA_ID}.md`; the re-verification path is `R-006-{IDEA_ID}-reverification.md`. The paths differ by suffix, so the writes themselves don't collide. BUT: the dedup-against-archive logic, the citation verifier (which scans `research/R-*.md`), and γ-1's input file list (3-C §D.1 step 2 explicitly lists R-001 through R-005) all need to know whether R-006 exists and what to do with it.

3-C §D.1 step 2 (γ-1 inputs) says "read EXACTLY 6 files (the 5 research dossiers + the research summary)" — i.e., γ-1 ignores R-006 entirely. But the DA re-dispatch's verdict CAN demote the original ADVANCE to INCONCLUSIVE (3-C §C.3 step 3), which changes the tally that γ-1 reads in `_summary.md`. So the DA re-dispatch's effect reaches γ-1 via `_summary.md`, not via the R-006 file directly. OK — but 3-C §D.1 doesn't say "ignore R-006 even if it exists"; it says "read 5 dossiers." A fresh agent implementing γ-1 might defensively glob `research/R-*.md` and pick up R-006 + R-006-*-reverification.md as 7 inputs instead of 5, breaking the brief's "EXACTLY 6 files" rule.

### A.9 Deep-cycle spawn-1 cost: 450k (3-A) vs 470k (3-C) — MEDIUM

- **3-A §B.2 (deep cycle split):** "spawn 1 runs α + β (≈ 450k), exits cleanly with `state=blocked` … Spawn 2 (re-wake) runs γ + post-β citation verify + archive updates (≈ 277k)."
- **3-C §F.7 (deep cycle split):** "spawn 1 runs α + β (≈ 470k), exits cleanly; spawn 2 (re-wake) runs γ + citation verify + archive updates (≈ 257k)."

Both sum to 727k, but the split differs by 20k. The 20k discrepancy matters because the deep cycle's spawn-1 hard kill-switch (380k? or a deep-cycle-specific 450k?) isn't specified — if spawn 1 hits 380k mid-β on a deep cycle, the cycle is blocked, and the launcher re-wakes with `cycle_type=deep` again, but the deep cycle was already opt-in. The 20k matters because β alone in a deep cycle is 400k (3-C §F.7), which **exceeds the 380k per-cycle kill-switch**. So a deep cycle's spawn 1 cannot complete β within one spawn's kill-switch — it MUST checkpoint mid-β. But 3-A §E.2 specifies checkpoint-worthy transitions only at subagent-completes and consolidation-finishes, not at "subagent N of M completes within a wave." A deep cycle with M=5 subagents at 64k each means the 5th subagent's checkpoint (after 4 × 64k = 256k already spent) puts the orchestrator at ~256k + α 70k + consolidation = ~330k, just under 380k. The 5th subagent's 64k push would take it to ~394k — **over the 380k kill-switch**. The deep cycle's spawn-1 budget is structurally infeasible under the 380k hard kill-switch unless the kill-switch is waived for deep cycles, which neither file states.

### A.10 D2/C2 in deep cycles: budget unaccounted for — MEDIUM

- **3-A §B.2:** "deep cycle … full D1/C1/D2/C2/Judge phases ≈ 727k"
- **3-A §G.2:** "the 'deep' cycle at ~727k tokens (full 1-E protocol, **full D1/C1/D2/C2/Judge rhythm**) is opt-in"
- **3-B §F.4:** "For 'deep' cycles (~727k budget, opt-in per 3-A), Wave α is unchanged: still 10 subagents, still 70k. The deep cycle's extra budget goes to Wave β (full 1-E protocol, 13 LLM calls + 6 tool calls per idea instead of 6 + 3) **and the D2/C2 second divergence/convergence pulses that the scout cycle skips.**"
- **3-C §F.7:** "The deep cycle's extra budget goes to Wave β and the D2/C2 second divergence/convergence pulses (3-A §B.2)."

But none of 3-A, 3-B, or 3-C actually budgets D2/C2. 3-C §F.7 breaks down the deep cycle as: β=400k (320k subagents + 30k consolidation + 50k DA reserve) + γ=40k + citation=15k + α=70k + overhead=40k = 565k. That leaves 727k − 565k = **162k unaccounted for D2/C2**. 2-B's per-cycle arithmetic (which 3-A §G.1 restates as the deep-cycle cost) put D2 at 60k and C2 at 146k = 206k. So 162k is *less than* 2-B's D2+C2 estimate, meaning the deep cycle's 727k figure is either (a) wrong (it should be ~770k = 565k + 206k), or (b) silently using a reduced D2/C2 rhythm. Either way, **the deep cycle's budget doesn't add up to 727k under any concrete decomposition**.

### A.11 `phase` field ambiguity: brainstorm-wave phases vs Zhang phase-state-machine phases — LOW

3-A uses the word "phase" for two different concepts:

- **3-A §A.4 `day-status.json` `phase` field:** `"alpha|alpha_consolidating|beta|beta_consolidating|gamma|citation_verify|archive_update|done"` — brainstorm-wave-specific.
- **3-A §E.2.1 phase-state-machine (Zhang):** `Setup|ExecutingTools|AwaitingLLM|RetryingLLM|Compacting|AwaitingApproval|ForceStop|Done` — generic.

The §E.2.1 table maps Zhang phases to brainstorming-loop phases, but the relationship between `day-status.json.phase` and Zhang's machine state is never stated. A mid-wave crash leaves `day-status.json.phase = "beta"` (say), but Zhang's machine state could be `ExecutingTools` (a subagent was running) or `AwaitingLLM` (consolidation was running). The resume contract (3-A §E.2.3) says "the orchestrator reads `day-status.json` (`state`, `phase`, `last_checkpoint`)" — so it reads the brainstorm-wave phase. But it also reads `last_checkpoint` (e.g., `"B-007 written by Dreamer/s2"`), which is subagent-granularity. The Zhang machine state is never persisted to disk; it's implicit in `last_checkpoint`. This works, but it's confusing — two different "phase" vocabularies in the same file.

Also: the `phase` enum has `gamma` (single value), not `gamma_1_claims` / `gamma_2_constraints`. A crash mid-γ-2 leaves `phase = "gamma"`, and on resume the orchestrator has to scan `synthesis/S-001-claims.md` to determine whether γ-1 finished. 3-A §E.2.3 step 3 says "scans `$RUN_ROOT/<wave>/` for which artifacts exist on disk" — so this is the resume mechanism — but it's an extra step that could be avoided by splitting `gamma` into `gamma_1` / `gamma_2` in the phase enum.

### A.12 Persona×seed matrix section structure not in 3-A's directory layout — LOW

- **3-A §C** shows `persona-seed-matrix.md` as a single file (no section breakdown).
- **3-B §A.3** says "The seed-2 flavor is written to `persona-seed-matrix.md` BEFORE Wave α dispatches."
- **3-B §D.2 step 4** says cluster metadata is "appended as a `## Clusters` section."
- **3-B §D.4** says the shortlist is "appended as `## Shortlist` section."

So `persona-seed-matrix.md` has (at least) 3 sections: (1) the matrix itself (persona×seed assignments + seed-2 flavor), (2) `## Clusters`, (3) `## Shortlist`. 3-A's directory layout doesn't document this internal structure. Minor, but a fresh agent scaffolding the file at cycle start doesn't know the section template.

### A.13 `archive/novelty.jsonl` status enum includes `advance` and `kill` but 3-C uses `ADVANCE`/`REFUTE` — LOW

(Subset of A.2, but worth separating because the fix-location is different.) 3-A §C.2 says `"status" ∈ {proven, refuted, inconclusive, advance, kill}`. 3-C §C.2 tally JSON uses uppercase verdict keys (`"ADVANCE"`, `"REFUTE"`, `"INCONCLUSIVE"`). 3-C §E.3 `archive/constraints.jsonl` schema uses `"source_verdict":"REFUTE"` (uppercase). The two archive files use different cases for the same concept. 3-A's `archive/novelty.jsonl` should be updated to use uppercase ADVANCE/REFUTE/INCONCLUSIVE to match 3-C's `archive/constraints.jsonl`.

### A.14 Embedding model unspecified — LOW

- **3-A §C.2:** "an embedding vector from a small embedding model (e.g., `text-embedding-3-small` or a local Sentence-Transformer)."
- **3-B §D.2 step 1:** "Use the same embedding model as `archive/novelty.jsonl`."
- **3-C §G.2 step 3:** "Embed via the same embedding model as `archive/novelty.jsonl`."
- **3-C §J.4 (handoff):** "The exact embedding model for the citation content-match (§G.2 step 3). This design defers to 3-A §C.2's choice … the final choice is an implementation detail."

The embedding model is never committed. If the implementation switches models mid-session (e.g., starts with `text-embedding-3-small`, switches to a local Sentence-Transformer for cost reasons), all prior cycle embeddings become incomparable — cosine dedup breaks. 3-C §J.4 punts to "implementation detail," but the choice has to be made *before cycle 1* and never changed, or the archive is invalid. This is an implementation decision that needs to be a LOOP.md invariant, not an implementation detail.

### A.15 `cycle_mod_5` and `cycle_mod_12` (specialist rotation) start conditions unspecified — LOW

- **3-B §A.3:** "cycle mod 5 = 0 → oblique-strategy … cycle mod 5 = 4 → mutation-from-prior-shortlist (Requires cycle N>1; for cycle 1, falls back to oblique-strategy)."
- **3-B §E.3:** "Every 3rd cycle (cycle 3, 6, 9, …), one of the 5 base personas is swapped out."

What's `cycle` here — 0-indexed or 1-indexed? If 1-indexed, cycle 1 mod 5 = 1 → opposite-goal (no fallback needed — opposite-goal doesn't require prior cycle). If 0-indexed, cycle 0 mod 5 = 0 → oblique-strategy. 3-B §A.3 doesn't say. The fallback for mod 5 = 4 only fires if N=1 and mod 5 = 4, which is impossible (1 mod 5 = 1), so the fallback is dead code as written — suggesting the author assumed 0-indexed (cycle 0 = oblique-strategy, cycle 4 = mutation, fallback for cycle 0-as-cycle-4 is impossible). Either way, the cycle numbering convention is unstated. 3-A's `runs/YYYY-MM-DD-CNNN/` uses zero-padded `CNNN` but doesn't say whether counting starts at 000 or 001.

---

## B. Failure scenarios end-to-end (re-do 2-B's 16 pre-mortem rows)

Re-evaluating each of 2-B's 16 pre-mortem scenarios against the integrated Phase 2 design. "Resolved?" = does the design prevent this failure? "Residual?" = what's still broken even with the fix.

| # | Pre-mortem scenario (2-B) | Phase 2 resolution | Still broken? |
|---|---|---|---|
| **F1** | Loop produces the same 10 ideas every cycle | 3-A §C.2 `archive/novelty.jsonl` (embedding + warrant hash); 3-B §A.3 seed-2 rotation (5-cycle period); 3-B §E.3 specialist persona rotation (every 3 cycles); 3-B §E.4 mode-collapse detector (cosine ≥ 0.70 vs prior shortlist centroid → refresh; 3-strike → terminate); 3-A §F.2 novelty-decay-3-consecutive termination. | **Mostly resolved.** Two residuals: (a) the `deferred` status is in the archive (3-B §D.5) but not in 3-A's status enum, so dedup-against-archive (3-B §D.3) doesn't know what to do with `deferred` ideas (see A.5); (b) the embedding model is unspecified (A.14) — if it changes mid-session, cross-cycle cosine comparisons break. |
| **F2** | Research rubber-stamps everything (all-advance every cycle) | 3-C §0 design choice 1 (3-state dossier drops "refine"); 3-C §A.1 LLM-1→LLM-3 mandated steelman-then-falsify ordering; 3-C §C.1 external-falsification audit (auto-INCONCLUSIVE if no tool call); 3-C §A.1 LLM-4 position-swap; 3-C §C.3 all-advance circuit-breaker (capped at 1 DA re-dispatch); 3-C §H.6 20% random re-verification; 3-C §H.4 confidence calibration; 3-C §H.5 verdict-cost asymmetry (ambiguous band → INCONCLUSIVE); 3-C §G post-β citation verify (caps ADVANCE confidence at 0.5 if citation MISMATCH). | **Mostly resolved** — this is the most-defended failure mode in the design (13 anti-sycophancy mechanisms). Residual: in a single-model shop, the Red-Team Auditor (§C.3) and the random re-verification (§H.6) use the *same model* with a different persona/rubric/temperature. If the model has a systematic pro-ADVANCE bias that survives persona/rubric/temperature perturbation, all 13 mechanisms fail together. 3-A §I G7 acknowledges this ("weaker than a different model, but concrete and auditable") — accepted risk, not a design bug. |
| **F3** | Token cost explodes mid-cycle | 3-A §B.2 tiered budget (scout 350k / deep 727k opt-in); 3-A §B.3 enforced 380k kill-switch (Waxell: enforcement not alerts); 3-A §G.5 DA re-dispatch capped at 1 (not 1 per advanced idea, saving ~295k per problematic cycle); 3-C §A.1 step 6 30k per-subagent kill-switch; 3-B §B.1 step 8 4k per-subagent output kill-switch. | **Resolved.** The 380k kill-switch is checked after every subagent completion (3-A §B.3), so mid-wave cost explosions are caught at subagent granularity. |
| **F4** | Orchestrator's context fills up after 5 cycles | 3-A §I G6 resolution: Larson 80% threshold + virtual file abstraction + `Compacting→AwaitingLLM` checkpoint (§E.2.1). 3-A §H.6 rule 6: compaction keeps (current cycle's shortlist+verdicts, prior 3 cycles' synthesis docs summarised, full novelty+constraint archive compact). | **Partially resolved.** 3-A §K.5 explicitly hands off the compaction prompt design to "the final LOOP.md author or sibling Phase-2 subagents" as 2-B's R2 research task — the compaction *mechanism* (when to fire, what to keep) is specified, but the compaction *prompt* (the actual LLM call that summarises the orchestrator's context) is not designed. Without the prompt, the orchestrator doesn't know HOW to compact — only WHEN. |
| **F5** | Subagents anchor on parent's brief | 3-B §A.3 seed-2 rotation (5 flavors); 3-B §B.1 step 7 (no peer reads, Mullen 1991); 3-B §G.2 detailed handler (persona mandate read FIRST, before problem brief). | **Mostly resolved.** Residual: the seed-2 stimuli themselves (Oblique Strategies cards, opposite-goal prompts, etc.) are written once and reused across cycles. If the orchestrator's seed-bank becomes a stale attractor across 10+ cycles, the seed-2 rotation stops diversifying. No mechanism refreshes the seed-bank itself. |
| **F6** | Loop never terminates | 3-A §F.1 goal-anchored (user-supplied stop condition); 3-A §F.2 novelty-decay-3-consecutive (self-terminate); 3-A §F.3 budget-anchored (10 cycles / 4M tokens hard cap); 3-A §F.4 user-cancel between cycles; 3-A §F.5 multi-layer IAL-Scan guard. | **Resolved.** Three independent termination layers + user backstop. |
| **F7** | Hallucinated citations slip through | 3-C §G 7-step CiteTracer-adapted pipeline (URL existence + content cosine ≥0.6 + URL-text mismatch detection + code-ref verification + archive-lookup verification + LLM spot-check for PARTIAL); 3-C §G.4 confidence cap (≥1 MISMATCH → cap 0.5; ≥2 MISMATCH → auto-INCONCLUSIVE + blacklisting); 3-C §G.5 cross-cycle `archive/citations.jsonl` 7-day TTL cache. | **Partially resolved.** Two residuals: (a) the 0.6 cosine threshold is "calibrated against CiteTracer's 97.1% accuracy" but CiteTracer uses field-level matching, not embedding cosine — the adaptation is explicitly "weaker" (3-C §G.6), and the threshold is a design-phase estimate, not validated. No feedback loop tunes the threshold based on observed false-positive/negative rates. (b) The pipeline uses the embedding model (A.14), which is unspecified — if it changes, the 0.6 threshold may need re-calibration. |
| **F8** | Loop produces ideas the user doesn't want | 3-A §A.1 step 5 (launcher between-cycle active-curator role: read synthesis docs + advance dossiers, decide which to pursue, trigger next cycle or close). | **Partially resolved.** Two residuals: (a) **the launcher reads `synthesis/S-001.md` + `synthesis/S-002.md` (3-A), but 3-C writes `S-001-claims.md` + `S-002-constraints.md` (A.1) — the launcher literally cannot find the files to read.** This is the most damaging F8 residual: the active-curator role is specified but its input contract is broken. (b) The launcher's decision protocol ("decide which advance ideas to pursue") is described as a job but not as a procedure — there's no checklist for HOW the launcher decides. cb-review's launcher has §10.0 launcher checklist; the brainstorming loop's launcher has §A.1 step 1-5 prose. |
| **F9** | Research subagent returns garbage | 3-C §C.1 schema validation (9 checks: schema / field-shape / ordering / external-falsification / ambiguous-band / grounds-URL existence); single repair attempt with halved tool budget; replacement subagent with tightened "cite-as-you-go or do not cite" mandate; floor of 4 valid dossiers to proceed to γ. | **Resolved.** |
| **F10** | Loop runs forever on a hard problem (all inconclusive) | 3-C §E.5 MUST_TEST constraint type (INCONCLUSIVE → MUST_TEST with adjudication test spec); 3-A §F.2 novelty-decay-3-consecutive termination (0 new proven ideas for 3 cycles → terminate). | **Partially resolved.** Residual: if every cycle produces 5 INCONCLUSIVE → 5 MUST_TEST constraints → next cycle's 5 ideas each target one MUST_TEST → all 5 come back INCONCLUSIVE again, the loop burns 3 cycles (~1M tokens) before F.2's novelty-decay termination fires. The MUST_TEST constraint is supposed to specify an "adjudication test" that breaks the loop, but if the adjudication test itself comes back inconclusive (because the test was poorly specified by γ-2), the loop is stuck. No mechanism detects "MUST_TEST constraints are not converging" earlier than 3 cycles. |
| **F11** | Cross-cycle novelty decays (cycle 20 ≈ cycle 1) | 3-A §C.2 embedding cosine + Toulmin warrant hash (primary + secondary dedup); 3-B §A.3 seed-2 rotation (5-cycle period); 3-B §E.3 specialist rotation (every 3 cycles); 3-B §E.4 mode-collapse detector; 3-C §E constraint decay (prevents monotonic narrowing). | **Resolved.** |
| **F12** | Subagent recursion explodes (tool-call fan-out) | 3-C §A.1 step 5 (explicit tool caps: web_search max 3, repo_read max 3, code_exec max 1, ≤30-line PoC); 3-B §B.1 step 7 (Wave α: NO tool calls at all); 3-C §I.2 (no nested reasoning agents, no fan-out tool_call). | **Resolved.** |
| **F13** | Research subagent fails to terminate (ReAct infinite loop) | 3-C §A.1 step 6 (30k token hard kill-switch per subagent; partial output preserved); 3-A §E.2.4 tool-failure retry contract (3 retries with 5s/30s/120s backoff, then INCONCLUSIVE). | **Partially resolved.** Residual: the 30k kill-switch is **token**-based, not wall-clock-based. If a subagent's `web_search` tool call hangs (returns slowly without erroring), the token count doesn't increase — only wall-clock does. 3-A §E.2.4 specifies backoff for tool *failures* (rate limit, network blip, paywall), but a slow-but-not-failed tool call (e.g., a 5-minute web_search response) has no timeout. A hung tool call could leave the subagent stuck indefinitely without triggering the 30k kill-switch. |
| **F14** | Loop produces only "safe" / lowest-common-denominator ideas | 3-B §D.4 MAP-Elites diversity-within-shortlist axis (max-min cosine distance); 3-B §A.3 opposite-goal seed flavor (cycle mod 5 = 1); 3-B §A.3 constraint-bombing flavor (cycle mod 5 = 3); 3-B §E.3 specialist rotation (Security Auditor / ML Researcher / PM / Domain Historian); 3-B §A.1 Dreamer "no feasibility filter" mandate. | **Mostly resolved.** Residual: the diversity axis is "diversity WITHIN shortlist" (intra-cycle), not "diversity vs prior cycles" (cross-cycle). If all 10 Wave α subagents produce slightly-different-but-conceptually-similar LCD ideas, the diversity axis picks the 5 most-different from each other — but they could all be LCD-style relative to prior cycles. The dedup-against-archive (3-B §D.3) catches cosine ≥ 0.90 duplicates but not 0.70-0.90 "conceptually similar" ideas. The mode-collapse detector (§E.4) catches it at cosine ≥ 0.70 vs prior shortlist *centroid*, but only fires after the cycle completes. |
| **F15** | Long-running loops forget early findings (cycle 30 loses cycle 1's constraints) | 3-A §C.2 archive/novelty.jsonl + archive/constraints.jsonl (monotonic growth); 3-C §E.5 constraint decay (decay_score < 0.1 → archived, kept for audit not enforced); 3-B §B.2 novelty archive hash list compacted to N=200 most recent. | **Partially resolved.** Residual: archived constraints (decay_score < 0.1) are "kept for audit, not enforced" — but no mechanism *consults* the archived constraints when a new idea would re-tread them. The dedup-against-archive (3-B §D.3) checks novelty.jsonl, not constraints.jsonl. A cycle-30 idea that violates a cycle-1 archived constraint (e.g., depends on an assumption that was REFUTE in cycle 1) will not be flagged unless the cycle-1 *idea* is also in novelty.jsonl with `refuted` status AND cosine ≥ 0.90 to the new idea. If the cycle-1 idea's text has drifted (different vocabulary, same warrant), the cosine check misses it and the warrant-hash check is the only backstop — but warrant hashes require the new idea's warrant to be computed, which happens at consolidation, not at subagent. So the cycle-30 subagent doesn't see the cycle-1 archived constraint at all. |
| **F16** | Cost runaway / $47k-style incident (Waxell) | 3-A §B.3 enforced 380k per-cycle kill-switch; 3-A §F.3 4M per-session cap; 3-A §F.3 10-cycle per-session cap; 3-C §A.1 step 6 30k per-subagent kill-switch; 3-B §B.1 step 8 4k per-subagent kill-switch. | **Resolved.** |

**Summary of B:** 9 of 16 fully resolved (F3, F6, F9, F11, F12, F16 + the trivially-resolved ones). 6 partially resolved (F4, F7, F8, F10, F13, F15). 1 mostly resolved with structural residual (F2, accepted as single-model-shop risk). The 6 partials are the residual risk surface that LOOP.md must call out as "known limitations."

---

## C. What's missing from LOOP.md (vs cb-review §0–§12)

Mapping cb-review's `LOOP.md` section structure against what Phase 2 actually produced:

| § | cb-review section | Produced by Phase 2? | Status |
|---|---|---|---|
| §0 | Directory layout | **Yes** — 3-A §C | ✓ Produced. Minor: 3-A §C doesn't list `archive/citations.jsonl` (3-C §G.5 introduces it), `research/_summary.md` (3-C §C.5), `synthesis/_prior_constraints.jsonl` / `_novelty_compact.jsonl` (3-C §D.2), or the internal section structure of `persona-seed-matrix.md` (3-B §A.3/§D.2/§D.4). LOOP.md §0 must consolidate these. |
| §0.5 | Harness (launcher vs day-scope) | **Yes** — 3-A §A.1 (launcher), §A.2 (cycle-scope orchestrator), §A.3 (spawn command), §A.4 (day-status.json) | ✓ Produced. Minor: the spawn command in 3-A §A.3 uses `--yolo` and `--output-format json` but doesn't specify the working directory or how the orchestrator's session JSONL is stored (cb-review §0.5.2 specifies these). |
| §1 | Starting clean (new day / new run) | **Partially** — 3-A §C gives the directory layout; 3-A §A.1 step 1-2 describes the launcher's first action. | ⚠️ Missing: the explicit "when user says start, do X" procedure with bash commands (cb-review §1.1-1.5). 3-A §A.1 step 1 says "Resolve run — pick the latest …" but doesn't give the `mkdir -p` commands or the scaffold-RECORD.md step. LOOP.md §1 must add this. |
| §2 | North-star and non-goals | **No** — neither 3-A, 3-B, nor 3-C specifies the loop's north-star criteria. 1-D proposed "novel → feasible → relevant → diverse → honest" but Phase 2 never adopted it. 3-A §J lists "what this design deliberately does NOT do" but as design non-goals (no nested reasoning, no Wave α/β concurrency, no code edits, no MAD, no prior-folder deletion, no second model), not as a §2-style north-star. | ❌ **Missing.** LOOP.md §2 must specify: (a) the ordered north-star criteria (e.g., 1-D's "novel → feasible → relevant → diverse → honest" or a Phase-2-refined version); (b) the non-goals list (port 3-A §J + add "not a code-generation loop," "not a single-shot idea generator," "not a debate system"). Without §2, the orchestrator has no tie-breaker when the 4-axis rubric (3-B §D.4) produces ties. |
| §3 | Architecture (strict wave separation) | **Yes** — 3-A §B (topology), 3-B §H (Wave α role separation), 3-C §I (Wave β+γ role separation) | ✓ Produced. |
| §4 | Default Exigo slice map | **N/A** for brainstorming (no slices). The analog is the persona×seed matrix (3-B §A). | ✓ N/A (replaced by persona×seed matrix). LOOP.md §4 should explicitly say "this loop has no slice map; the diversification unit is the persona×seed pair (see §5)." |
| §5 | Wave A brief (hostile audit) | **Yes** — 3-B §B (Wave α brief template) | ✓ Produced (as Wave α, not Wave A). |
| §6 | Wave B brief (brainstorm) | **Yes** — 3-C §A (Wave β brief template) | ✓ Produced (as Wave β, not Wave B). |
| §7 | Wave C brief (fix) | **Yes** — 3-C §D (Wave γ brief templates, γ-1 and γ-2) | ✓ Produced (as Wave γ, not Wave C). |
| §8 | RECORD.md template | **Yes** — 3-A §D | ✓ Produced. Minor: 3-A §D's RECORD template uses lowercase verdicts (`advance`, `kill`, `inconclusive`) — must be updated to 3-C's uppercase vocabulary (A.2). |
| §9 | Skills registry | **No** — neither 3-A, 3-B, nor 3-C has a skills registry. | ❌ **Missing.** cb-review §9 lists "Clarity → Karpathy, Security → authz every path, AI/SSE → prompt registry, Architecture → shared/, React UI → extract hooks." The brainstorming loop's research subagents use tools (`web_search`, `repo_read`, `code_exec`) — a §9-style registry would specify: which tool for which evidence type (Convex docs → `web_search docs.convex.dev`, code behavior → `repo_read` + `code_exec`, prior-cycle ideas → `archive/novelty.jsonl` lookup). Without §9, research subagents have to rediscover the tool-choice heuristic each cycle. |
| §10 | Orchestrator checklist | **Partially** — 3-A §A.2 lists the orchestrator's jobs as prose. 3-A §B.3, §E.2, §G.5 specify kill-switch / checkpoint / DA-cap rules. But no explicit `10.0 launcher checklist` / `10.1 cycle-scope checklist` / `10.2 ship protocol` like cb-review §10. | ⚠️ **Missing as a checklist.** LOOP.md §10 must add: (a) §10.0 launcher checklist (port cb-review §10.0, adapted: resolve run, decide cycle scope, spawn, poll, between-cycle active-curator); (b) §10.1 cycle-scope orchestrator checklist (scaffold runs/, write persona-seed-matrix, dispatch α, consolidate, dispatch β, consolidate, citation-verify, dispatch γ-1, validate, dispatch γ-2, validate, archive updates, RECORD, exit); (c) §10.2 ship protocol — the brainstorming loop's "ship" is `synthesis/S-001-claims.md` + `S-002-constraints.md` + advance dossiers (NOT a PR); the "ship protocol" is the end-of-cycle archive-update + state=complete transition. cb-review §10.2's CodeRabbit wait loop has no analog; the closest is 3-C §C.3's all-advance circuit-breaker (mandatory DA re-dispatch before exit). |
| §11 | Exigo conventions (enforce) | **No** — neither 3-A, 3-B, nor 3-C consolidates the loop's conventions into a §11-style table. | ❌ **Missing.** LOOP.md §11 should specify: idea-doc field rules (3-B §C.1), dossier field rules (3-C §B.1), constraint format (3-C §E.1), persona-name casing (`dreamer`/`skeptic`/`engineer`/`outsider`/`synthesizer` lowercase per 3-B §B.1), idea-id format (`I-{cycle-NNN}-{global-NNN}` per 3-B §C.1), constraint-id format (`C-{cycle-NNN}-{NNN}` per 3-C §E.2), verdict casing (UPPERCASE per 3-C), archive status casing (lowercase per 3-A — but see A.2/A.13 for the contradiction). Without §11, each implementer picks their own casing and the archives become inconsistent. |
| §12 | History | **No** — fresh loop, no history yet. | ❌ **Missing (write fresh).** LOOP.md §12 should start with a single row: `2026-07-18 | Initial design (Phase 1 brainstorm + research + Phase 2 brainstorm + research + this stress-test); architecture per 3-A, Wave α per 3-B, Waves β+γ per 3-C.` |

**Summary of C:** 6 sections fully produced (§0, §0.5, §3, §5/§6/§7 as Wave α/β/γ, §8). 3 sections partially produced (§1, §4-as-N/A, §10). 4 sections missing entirely (§2 north-star, §9 skills registry, §11 conventions, §12 history). The missing §2 (north-star) is the most damaging omission — without it, the orchestrator has no tie-breaker for shortlist selection when the 4-axis rubric (3-B §D.4) produces ties, and the launcher has no criterion for "which advance ideas to pursue" (F8 residual).

---

## D. Critical must-fix-before-shipping list (TOP 5)

The 5 things that, if not fixed, would make `LOOP.md` broken or unrunnable. Ordered by damage.

### D.1 Synthesis file path mismatch (A.1) — BLOCKER

- **What's broken:** 3-A's launcher (§A.1 step 5, §B diagram, §C directory layout, §I G6, §K.7) reads `synthesis/S-001.md` + `synthesis/S-002.md`. 3-C's γ-1 (§D.1 step 3) and γ-2 (§D.2 step 3) write `synthesis/S-001-claims.md` + `synthesis/S-002-constraints.md`. The launcher literally cannot find the cycle's output files.
- **The exact fix:** Adopt 3-C's suffixed names (`S-001-claims.md`, `S-002-constraints.md`) — they're more descriptive and 3-C is the more recent spec. Update 3-A §A.1 step 5, §A.2 step 1, §B diagram (lines 184-186), §C directory layout (lines 264-266), §I G6, and §K.7 to use the suffixed names. LOOP.md §0 directory layout and §0.5 launcher role must use the suffixed names.
- **Which file/section needs the change:** 3-A §A.1, §A.2, §B, §C, §I, §K.7. (3-C is correct as-is.)

### D.2 Verdict vocabulary mismatch (A.2, A.13) — BLOCKER

- **What's broken:** 3-A uses 4-state lowercase `kill/refine/advance/inconclusive` (§A.2, §B diagram, §C.2 novelty.jsonl schema, §D RECORD template). 3-C uses 3-state UPPERCASE `ADVANCE/REFUTE/INCONCLUSIVE` (§0, §A.1, §B, §C.2, §E.3). The orchestrator (3-A's mental model) and the research subagents (3-C's vocabulary) speak different languages, and the two archive files (`novelty.jsonl` lowercase, `constraints.jsonl` uppercase) disagree on casing for the same concept.
- **The exact fix:** Adopt 3-C's 3-state UPPERCASE vocabulary (it drops the ambiguous `refine` and maps 1:1 to constraint types MUST_RESPECT/MUST_AVOID/MUST_TEST). Propagate it through 3-A: update §A.2 ("decides ADVANCE/REFUTE/INCONCLUSIVE per idea"), §B diagram, §C.2 `archive/novelty.jsonl` schema (`"status" ∈ {proven, refuted, inconclusive, ADVANCE, REFUTE}` — note: `proven`/`refuted`/`inconclusive` are *status* values tracking the idea's lifecycle, distinct from the *verdict* vocabulary; keep these lowercase to distinguish status from verdict), §D RECORD template (use UPPERCASE verdicts in the Shortlist/verdicts table). Add a one-sentence note in 3-A §C.2 clarifying: "verdict ∈ {ADVANCE, REFUTE, INCONCLUSIVE} (UPPERCASE, the research subagent's label); status ∈ {proven, refuted, inconclusive, deferred} (lowercase, the archive's lifecycle state). The two are orthogonal: an ADVANCE-verdicted idea has status `advance` initially, may later become `proven` (verified by external PoC) or `refuted` (overturned by a future cycle)."
- **Which file/section needs the change:** 3-A §A.2, §B, §C.2, §D, §G.5. (3-C is correct as-is.)

### D.3 Citation-verify wave-ordering contradiction (A.3) — BLOCKER

- **What's broken:** 3-A §A.2 says "Wave α → Wave β → Wave γ → post-research citation verification" (γ before citation-verify). 3-A §B diagram and §G.3 budget table say "β → post-β citation verify → γ" (citation-verify before γ). 3-C §G.2 says "AFTER all 5 Wave β subagents complete and BEFORE Wave γ dispatches" (matches §B diagram). 3-A is internally inconsistent, and the inconsistency affects whether the all-advance circuit-breaker (3-C §C.3) sees pre-cap or post-cap confidences.
- **The exact fix:** Standardize on **β → β-consolidation → citation-verify → γ** (matches 3-A §B diagram, 3-A §G.3, and 3-C §G.2). Update 3-A §A.2 step 1 to read: "Wave α (brainstorm) → Wave β (research) → post-β citation verification → Wave γ (synthesis) → novelty archive + constraint archive updates → update RECORD.md + day-status.json → exit." Additionally, specify in 3-C §C.3 that the circuit-breaker fires **after** citation-verify (so it sees post-cap confidences) — this is the safer ordering because it means the DA re-dispatch targets the ADVANCE idea whose confidence survived citation-verify, not the one that was capped down to 0.5 (which would already be auto-INCONCLUSIVE per §G.4).
- **Which file/section needs the change:** 3-A §A.2 step 1 (rewrite the wave-ordering sentence). 3-C §C.3 (add a sentence: "The circuit-breaker fires after citation-verify completes; the lowest-confidence ADVANCE is selected from the post-cap confidence values.").

### D.4 `archive/citations.jsonl` mid-cycle write violates 3-A's RUN_ROOT discipline (A.4) — HIGH

- **What's broken:** 3-A §C.1 says "Never write artifacts at `archive/` *during* a cycle except via the orchestrator's end-of-cycle archive-update step." 3-C §G.5 has the post-β citation verifier (which runs mid-cycle, between β and γ) write to `archive/citations.jsonl` AND read from it (for the 7-day TTL cache). 3-A's directory layout doesn't list `archive/citations.jsonl` at all.
- **The exact fix:** Option (a) (preferred): move the `archive/citations.jsonl` write to the end-of-cycle archive-update step. During the cycle, the citation verifier writes only to `citations/verified.jsonl` + `citations/refuted.jsonl` (in RUN_ROOT). At end-of-cycle, the orchestrator merges these into `archive/citations.jsonl` (deduplicating by URL hash, updating `last_verified_at` for cached entries). The 7-day TTL cache read also moves to end-of-cycle: the verifier checks `citations/verified.jsonl` from the *prior cycle's* RUN_ROOT (via the `cycles.json` index) for cached URLs, not `archive/citations.jsonl` mid-cycle. Option (b) (simpler but weaker): update 3-A §C.1 to explicitly allow mid-cycle archive writes from the orchestrator's citation-verify phase, and add `archive/citations.jsonl` to 3-A §C directory layout. Option (a) preserves the invariant; option (b) weakens it. Pick (a).
- **Which file/section needs the change:** 3-C §G.2 (move the cache-read to consult prior RUN_ROOT, not `archive/`), §G.5 (move the cache-write to end-of-cycle archive-update step). 3-A §C.1 (no change — the invariant holds). 3-A §C directory layout (add `archive/citations.jsonl` as an end-of-cycle artifact).

### D.5 `deferred` status missing from 3-A's novelty.jsonl enum + dedup rule missing in 3-B (A.5) — HIGH

- **What's broken:** 3-A §C.2 says `status ∈ {proven, refuted, inconclusive, advance, kill}`. 3-B §D.5 writes non-shortlisted ideas with `status: "deferred"`. 3-B §D.3 (dedup-against-archive) handles `proven`/`advance` (skip), `refuted`/`kill` (skip), `inconclusive` (eligible) — but is silent on `deferred`. A `deferred` archived idea has no dedup rule.
- **The exact fix:** (a) Add `deferred` to 3-A §C.2's status enum: `status ∈ {proven, refuted, inconclusive, advance, deferred}` (drop `kill` per D.2's vocabulary fix; `deferred` replaces it as the "not shortlisted" state). (b) Add a `deferred` row to 3-B §D.3's dedup rules: "Cosine ≥ 0.90 vs an archived idea with status `deferred`: the cluster is a re-emergence of a prior-cycle non-shortlisted idea. **Eligible for shortlist** (the prior cycle didn't reject it, just didn't pick it — re-shortlisting is allowed and may surface a previously-overlooked idea). Tag the cluster `deferred_reemergence=true` in `persona-seed-matrix.md` `## Shortlist` section for audit."
- **Which file/section needs the change:** 3-A §C.2 (status enum). 3-B §D.3 (add `deferred` row).

---

### Honorable mentions (not in top 5, but worth fixing in LOOP.md)

- **D.6** Wave β budget arithmetic: 3-A's "5k reserve" embedded in the β line is unexplained (A.6). Fix: delete the "5k reserve" from 3-A §B.1 and §G.3 — β = 165k (150k subagents + 15k consolidation), 25k DA reserve is separate.
- **D.7** `decay_score` threshold mismatch for what Wave α receives (A.7): 3-B says ≥0.3 (excludes soft), 3-C §D.4 says soft ARE passed with [soft] tag. Fix: standardize on "Wave α receives constraints with `decay_score ≥ 0.3` + soft constraints tagged `[soft]`" (matches 3-C §D.4 — the soft tag lets Wave α relax with a flag per 3-B §B.1). Update 3-B §B.2's `{PRIOR_CONSTRAINTS}` source description.
- **D.8** R-006 slot collision risk (A.8): DA re-dispatch uses `R-006-{IDEA_ID}.md`, random re-verification uses `R-{NNN+5}-{IDEA_ID}-reverification.md` = `R-006-{IDEA_ID}-reverification.md`. Fix: rename random re-verification to `R-9{NNN}-{IDEA_ID}-reverification.md` (use the 9xx range to avoid collision with the 6xx DA range).
- **D.9** Deep-cycle spawn-1 cost 450k vs 470k (A.9) + D2/C2 budget unaccounted (A.10): the deep cycle's 727k figure doesn't decompose cleanly. Fix: either (a) revise the deep-cycle total to ~770k (565k + 206k for D2/C2 per 2-B's arithmetic), or (b) explicitly drop D2/C2 from the deep cycle (deep cycle = scout cycle + full 1-E protocol only, no D2/C2) and update 3-A §B.2, §G.2 + 3-B §F.4 + 3-C §F.7.
- **D.10** `phase` enum doesn't distinguish γ-1 from γ-2 (A.11): split `gamma` into `gamma_1_claims` / `gamma_2_constraints` in 3-A §A.4's phase enum for cleaner mid-γ resume.
- **D.11** Embedding model unspecified (A.14): commit to one model (`text-embedding-3-small` or a named local Sentence-Transformer) in LOOP.md §11 as an invariant — "the embedding model is fixed at session start and never changed; changing it invalidates all prior cycle embeddings."
- **D.12** Cycle numbering convention unspecified (A.15): state in LOOP.md §1 that cycles are 1-indexed (cycle 1 is the first cycle of a session) and `cycle_mod_5` / `cycle_mod_12` use 1-indexed cycle numbers.

---

## E. One-paragraph sanity check

If a fresh agent was given `LOOP.md` (as designed) and told "run cycle 1 on the problem 'how do we improve the exigo exercise runtime?'", would they succeed? Walking through the steps: **(1)** Launcher reads latest run (none exists — cycle 1), creates `runs/2026-07-18-C001/`, writes `cycle-scope.md` with the problem statement + empty inherited constraints, spawns the cycle-scope orchestrator with `CYCLE_TYPE=scout`, `HARD_BUDGET_TOKENS=380000` per 3-A §A.3 — succeeds. **(2)** Orchestrator reads `LOOP.md`, reads `archive/` (empty), writes `persona-seed-matrix.md` with the 5×2 matrix + seed-2 flavor = opposite-goal (cycle 1 mod 5 = 1 per 3-B §A.3), dispatches Wave α (10 parallel subagents) per 3-B §B.1 — succeeds. **(3)** Orchestrator consolidates: validates schemas, clusters by embedding cosine ≥ 0.85, dedups against (empty) archive, shortlists 5 by 4-axis rubric, writes `## Shortlist` to `persona-seed-matrix.md` — succeeds. **(4)** Orchestrator dispatches Wave β (5 parallel research subagents, one per shortlisted idea) per 3-C §A.1 — succeeds. **(5)** Orchestrator consolidates β: validates dossiers, tallies verdicts, maybe fires all-advance circuit-breaker (1 DA re-dispatch on lowest-confidence ADVANCE), writes `research/_summary.md` — succeeds. **(6)** Orchestrator runs post-β citation verify per 3-C §G, writes `citations/verified.jsonl` + `citations/refuted.jsonl` — **STUCK POINT 1**: 3-C §G.5 also says to write `archive/citations.jsonl` mid-cycle, but 3-A §C.1 forbids mid-cycle archive writes (D.4). The orchestrator either skips the cache write (breaking the 7-day TTL optimization for cycle 2+) or breaks the invariant; the spec doesn't say which. **(7)** Orchestrator dispatches γ-1 (claims-extractor), validates output, dispatches γ-2 (constraint-writer), validates output — succeeds. **(8)** Orchestrator applies γ-2's decay updates to `archive/constraints.jsonl`, appends new constraints + novelty entries + cycle index, updates RECORD.md + day-status.json, exits `state=complete` — succeeds. **(9)** Launcher re-reads day-status.json (complete), reads RECORD.md, attempts to read `synthesis/S-001.md` + `synthesis/S-002.md` per 3-A §A.1 step 5 — **STUCK POINT 2 (FATAL)**: 3-C wrote `synthesis/S-001-claims.md` + `synthesis/S-002-constraints.md` (D.1); the files 3-A told the launcher to read do not exist. The launcher cannot perform its active-curator role (F8) because its input contract is broken. **(10)** Even if the path bug were fixed, the launcher would then face **STUCK POINT 3**: 3-A §A.1 step 5 says "Decide which advance ideas to pursue" but specifies no decision procedure — no checklist, no rubric, no tie-breaker. The launcher is told to be an "active curator" but given no curation criteria (LOOP.md §2 north-star is missing per C). **Verdict:** the fresh agent would successfully run the cycle (modulo Stuck Point 1, which is recoverable), but the launcher would fail at Stuck Point 2 (fatal — file path mismatch) and get stuck at Stuck Point 3 (no decision protocol). The cycle's output would be written to disk but never consumed by the launcher, breaking the loop's outer iteration. Fix D.1 (path mismatch), D.2 (vocabulary), and add LOOP.md §2 (north-star) + §10.0 (launcher checklist) before shipping.
