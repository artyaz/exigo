# 3-A — Outer Loop Architecture

**Task ID:** 3-A
**Agent:** general-purpose (outer loop architecture design)
**Date:** 2026-07-18
**Scope:** Design the outer-loop architecture for the brainstorming loop, modeled on cb-review's autonomy pattern (1-D §0.5) but explicitly resolving the 7 must-address gaps from 2-B's pre-mortem (cost runaway, outer-loop termination, novelty archive, hallucinated-citation content verification, mid-cycle re-entrancy, orchestrator context compaction, single-model-shop anti-sycophancy).
**Inputs read in full:** `worklog.md` (1-A through 2-B), `1-D-cb-review-autonomy-extraction.md`, `2-B-contradictions-gaps-premortem.md`, `agents/cd-review/LOOP.md` (§0–§12, for house style + spawn shape + RECORD template).

---

## 0. Design summary (the answer before the argument)

The architecture is a two-layer harness (L-1 launcher + L0 cycle-scope orchestrator) running three strict one-directional waves per cycle: **α Brainstorm → β Research → γ Synthesis**. Per-cycle token budget is **350k** (matching cb-review's day-scope), achieved via a **tiered-budget + reduced-rhythm** combination (option (b)+(c) from 2-B's cost-ceiling answer): the default cycle is a "scout" cycle at 350k; "deep" cycles (full 1-E protocol, ~727k) are opt-in and explicitly span 2 spawns via mid-cycle checkpointing (gap G5). Within a 350k scout cycle: **N=10 brainstorm subagents** (5 personas × 2 seeds), **M=5 research subagents** (one per shortlisted idea), **γ=2 synthesis subagents** (one extracts claims, one writes constraints). An enforced 380k token kill-switch (Waxell: alerts don't work, enforcement does) is the per-cycle backstop. The outer loop terminates via goal-anchored + novelty-decay + budget-anchored combination (gap G2). Anti-sycophancy in a single-model shop is achieved by structural means (different prompt persona + different rubric + different temperature 0.3 judge / 0.7 workers + the other six 1-E mechanisms) — gap G7 explicitly accepted as "weaker than a different model, but the structural mitigation is concrete and auditable".

---

## A. Two-layer harness (port from cb-review §0.5)

### A.1 Launcher role (L-1, thin, user-triggered)

The launcher is the user's interactive session. It is **the only place a human appears**. Its jobs are bounded and small:

1. **Resolve run** — pick the latest `agents/brainstorm/runs/YYYY-MM-DD-CNNN/` (or user-specified). Read `RECORD.md` (`Status`, `Stopped at`, `Residual`, `Shortlist / verdicts`) and `day-status.json`. Skim the latest synthesis doc + novelty archive *only enough* to know whether the prior cycle closed cleanly and what constraints the next cycle inherits.
2. **Decide cycle scope** — package one cycle's worth of work (problem statement + inherited constraints + stop condition) sized for ~350k tokens of agent context. Write the scope into `$RUN_ROOT/cycle-scope.md` (goal, problem statement, inherited constraints, stop conditions, cycle type = scout|deep).
3. **Spawn separate agent** — invoke the cycle-scope orchestrator as a peer `grok` process (NOT a subagent of the launcher). Background it.
4. **Supervise without stealing context** — poll `day-status.json` + `RECORD.md` "Stopped at" only. Never ingest the worker's session JSONL. If the worker exits or stalls before the cycle is closed, re-wake with a resume brief.
5. **Between cycles (active-curator role)** — read the just-completed cycle's `synthesis/S-001.md` (claims) + `synthesis/S-002.md` (constraints) + `research/R-*.md` dossiers for `advance`-verdicted ideas. Decide which `advance` ideas to pursue (the loop's verdict is a *recommendation*, not a decision). Then either trigger the next cycle or close the loop. This is HITL **between cycles**, not inside a cycle — same as cb-review's "between day-scopes" HITL and does not violate invariant rule #1.

The launcher does NOT do: idea generation, research, judgment, dossier reading inside a running cycle, constraint extraction, novelty-archive updates. All of that is the cycle-scope orchestrator's job. The launcher's context stays thin enough to re-wake many times across many cycles.

### A.2 Cycle-scope orchestrator role (L0, autonomous, no HITL)

The cycle-scope orchestrator is the autonomous agent. It is spawned (not subagent'd) by the launcher. Its jobs:

1. **Execute `LOOP.md` end-to-end for one cycle**: Wave α (brainstorm) → Wave β (research) → Wave γ (synthesis) → post-research citation verification → novelty archive + constraint archive updates → write synthesis docs → update `RECORD.md` + `day-status.json` → exit `state=complete`.
2. **Dispatch the three waves via in-process subagents** (Wave α: N=10 parallel; Wave β: M=5 parallel; Wave γ: γ=2 parallel). The orchestrator never edits an idea-doc or dossier directly — it consolidates, judges, and writes synthesis docs and archives.
3. **Hold the Judge role** (non-parallel, per 1-C/1-E): clusters Wave α outputs into a shortlist, runs the post-research verdict loop, decides kill/refine/advance/inconclusive per idea, runs the "all-advance is suspicious" check.
4. **Honor the 380k enforced kill-switch**: if `tokens_used ≥ 380k` mid-cycle, stop cleanly, write `state=blocked`, `blocked_reason="budget_exhausted_mid_<phase>"`, `Stopped at = "resume Wave <phase>, subagent <id> not yet dispatched"` in `RECORD.md`, exit. The launcher re-wakes with the residual.
5. **Update `day-status.json` + `RECORD.md` after every material step** (every subagent completion, every checkpoint-worthy phase transition).

The orchestrator does NOT do: ask the user "should I continue?", wait for human input mid-cycle, ship PRs, edit product code, spawn nested reasoning agents (only tool_calls).

### A.3 Spawn mechanism (mirror cb-review §0.5.2)

The launcher spawns the cycle-scope orchestrator as a peer process:

```bash
grok -p "$(cat <<'EOF'
You are the brainstorming-loop CYCLE-SCOPE ORCHESTRATOR for Exigo.
Read and obey agents/brainstorm/LOOP.md entirely.
RUN_ROOT=agents/brainstorm/runs/YYYY-MM-DD-CNNN
CYCLE_ID=cycle-NNN
PROBLEM_STATEMENT={…}
INHERITED_CONSTRAINTS={from archive/constraints.jsonl, latest K}
CYCLE_TYPE=scout  # or "deep" — scout is default; deep requires explicit launcher opt-in
STOP_CONDITION={goal-anchored OR "novelty-decay-3-consecutive" OR "max-cycles-N"}
HARD_BUDGET_TOKENS=380000   # enforced kill-switch; target spend 350k

NO HUMAN IN THE LOOP. Do not pause for "should I continue?".
Continue, ship the synthesis, or leave Stopped at + day-status.json if truly blocked
(permissions, missing secrets, tool failure after ≥3 retries, budget exhausted mid-phase).

Use in-process subagents for waves α (N=10), β (M=5), γ (γ=2) as LOOP.md allows.
After Wave β, run CiteTracer-style citation content verification (mandatory).
After Wave γ, update archive/novelty.jsonl + archive/constraints.jsonl + archive/cycles.json.
Write progress to RECORD.md and $RUN_ROOT/day-status.json after every material step.

If you stop before the cycle is closed, leave Stopped at + next action in RECORD.md
so a cold launcher can re-wake you with the residual scope.
EOF
)" --cwd <repo> --output-format json --yolo
```

Background it; poll only `day-status.json` + `RECORD.md` "Stopped at"; never ingest the worker's session JSONL.

### A.4 day-status.json analog

Lives at `$RUN_ROOT/day-status.json` (launcher-readable). Replaces cb-review's `{running, shipping, waiting_coderabbit, blocked, complete}` with a brainstorming-specific state set. Adds `tokens_used` and `tokens_budget` for the enforced kill-switch (gap G1 fix). Adds `phase` for the mid-cycle re-entrancy contract (gap G5 fix).

```json
{
  "state": "running|brainstorming|researching|synthesizing|blocked|complete",
  "cycle_id": "cycle-007",
  "cycle_type": "scout|deep",
  "phase": "alpha|alpha_consolidating|beta|beta_consolidating|gamma|citation_verify|archive_update|done",
  "last_checkpoint": "B-007 written by Dreamer/s2",
  "shortlist_size": null,
  "verdicts_pending": 0,
  "next_cycle_constraints_extracted": false,
  "tokens_used": 0,
  "tokens_budget": 380000,
  "tokens_target": 350000,
  "alladvance_redispatch_fired": false,
  "blocked_reason": null,
  "updated_at": "2026-07-18T14:32:11Z"
}
```

State semantics:

| state | meaning | next valid transitions |
|---|---|---|
| `running` | orchestrator spawned, scaffolding | → `brainstorming` |
| `brainstorming` | Wave α in progress | → `researching` (α consolidated, shortlist written) |
| `researching` | Wave β in progress | → `synthesizing` (β consolidated, verdicts written) |
| `synthesizing` | Wave γ + citation verify + archive update in progress | → `complete` |
| `blocked` | orchestrator stopped early (budget / tool failure / permissions) | → `running` (launcher re-wake with residual) |
| `complete` | cycle closed cleanly; synthesis docs + archives written | → terminal (launcher starts next cycle or closes loop) |

### A.5 Why "cycle-scope" not "day-scope"

cb-review's "day-scope" maps cleanly to a calendar day because the unit of work (audits + fixes for that date) is bounded by the day's code surface. The brainstorming loop's unit of work is **one full α→β→γ cycle**, which:

- May complete in 30 minutes (a fast scout cycle on a small problem) or run for 4+ hours (a deep cycle on a contested problem).
- Spans multiple short-lived subagent generations within a single coherent ownership scope (the cycle's shortlist + verdicts + constraints).
- Has a natural *logical* endpoint (synthesis docs written, archives updated) that does not align with wall-clock boundaries.
- May need to resume mid-wave across process restarts (gap G5) — the resume contract is scoped to the cycle, not the day.

The dated folder pattern is preserved but the segment after the date is the cycle number, not "the day's work": `runs/YYYY-MM-DD-CNNN/` where `CNNN` is a zero-padded cycle counter (resets only on a user-declared "new session"). Multiple cycles on the same calendar day are common; one cycle spanning two calendar days (deep cycle + crash + resume) is also valid. The launcher's `RUN_ROOT` is `runs/YYYY-MM-DD-CNNN/`, set at spawn time, immutable for the cycle's lifetime.

---

## B. Outer loop topology (concrete)

```
L-1 LAUNCHER (user-triggered, thin)
   │
   │  1. resolve run + read RECORD/day-status
   │  2. decide cycle scope (~350k tokens, scout|deep)
   │  3. spawn peer grok process with cycle brief
   │  4. poll day-status.json + RECORD.md only
   │  5. between cycles: read synthesis doc, advance ideas, close or trigger next
   │
   ▼  grok CLI / harness (separate process)
┌─────────────────────────────────────────────────────────────────┐
│  L0  CYCLE-SCOPE ORCHESTRATOR (no HITL, 380k hard kill-switch)   │
│  reads LOOP.md + inherited constraints + novelty archive         │
│  dispatches waves · consolidates · judges · writes archives      │
└──────────────────────────────────────────────────────────────────┘
   │
   ▼  subagents (in-process, context-isolated, write-only-artifact)
┌─────────────────────────────────────────────────────────────────┐
│  WAVE α — BRAINSTORM                          budget: 70k        │
│  N = 10 parallel persona×seed subagents                         │
│  5 personas (Dreamer / Skeptic / Engineer / Outsider /          │
│   Cross-Domain Synthesizer) × 2 seeds each                      │
│  → divergent idea generation, one idea-doc per subagent          │
│  → NO children, NO cross-talk, NO orchestrator scratchpad leak   │
│  → each writes brainstorm/B-NNN-{persona}-{seed}.md              │
└──────────────────────────────────────────────────────────────────┘
   │
   ▼  orchestrator consolidates (Judge, non-parallel): cluster + dedup
      vs novelty archive → shortlist of 5 → checkpoint
┌─────────────────────────────────────────────────────────────────┐
│  WAVE β — RESEARCH / VERIFY                   budget: 170k       │
│  M = 5 parallel ReAct+CoVe subagents                            │
│  → one idea per worker (1:1 mapping, idea-id owned by worker)   │
│  → reduced Toulmin+RAT+ReAct+dossier protocol (~30k per idea)    │
│  → external grounding (web_search, repo read, code PoC)          │
│  → cite-as-you-go; Toulmin-shaped 4-state dossier output         │
│  → each writes research/R-NNN-{idea-id}.md                       │
└──────────────────────────────────────────────────────────────────┘
   │
   ▼  orchestrator consolidates (Judge, non-parallel): kill/refine/
      advance/inconclusive per idea + "all-advance is suspicious"
      check → if fired, ONE DA re-dispatch (capped, not one per idea)
      → checkpoint
┌─────────────────────────────────────────────────────────────────┐
│  POST-β CITATION VERIFY                        budget: 15k       │
│  CiteTracer-adapted content verification                        │
│  → re-fetch every URL in every dossier's `grounds`              │
│  → semantic match: does the cited source's abstract / first-page │
│     text actually support the attributed claim?                  │
│  → fail ⇒ auto-inconclusive + dossier flagged                    │
│  → writes citations/verified.jsonl + citations/refuted.jsonl     │
└──────────────────────────────────────────────────────────────────┘
   │
   ▼  checkpoint
┌─────────────────────────────────────────────────────────────────┐
│  WAVE γ — SYNTHESIS                           budget: 40k        │
│  γ = 2 subagents (NOT max-N — inherently sequential reduce)     │
│  → S-001: extract verified / refuted / inconclusive claims      │
│           from the dossier set, grouped by theme                 │
│  → S-002: extract next-cycle constraints (Delphi + Stepladder    │
│           translation: kill reasons → "do not depend on A")      │
│  → both write synthesis/S-001.md + synthesis/S-002.md            │
└──────────────────────────────────────────────────────────────────┘
   │
   ▼  orchestrator: update archive/novelty.jsonl + archive/constraints.jsonl
      + archive/cycles.json; update RECORD.md + day-status.json
   │
   ▼  decide: another cycle? (per stop conditions §F)
      → if yes: state=complete; launcher triggers next cycle
      → if no:  state=complete; launcher closes loop
```

### B.1 Concrete numbers

| Parameter | Value | Justification |
|---|---|---|
| **N (brainstorm subagents)** | 10 | 5 personas (1-A's set) × 2 seeds. 2-B's correction (C6): the 5×6=30 max-N was a Phase-1 guess, not evidence. 10 keeps N small enough for the budget (10 × ~5k = 50k of generation cost) while preserving structural diversity (no two subagents share persona+seed per 1-C). |
| **M (research subagents)** | 5 | = shortlist cap. 1-C's "shortlist size IS the right N"; 2-B's G12 fix: cap shortlist at 5 (not 7) to fit budget. One research worker per idea (1:1) per 1-E. |
| **γ (synthesis subagents)** | 2 | NOT max-N. Synthesis is inherently sequential reduce (1-C: affinity mapping + constraint extraction are Judge-side). Splitting into 2 (claims-extractor + constraint-writer) parallelises the two independent reduces without over-fanning. |
| **Brainstorm budget (α)** | 70k (20%) | N=10 × 5.5k each (1.5k brief + 3k generation + 1k finalisation) + orchestrator consolidation 15k. |
| **Research budget (β)** | 170k (49%) | M=5 × 30k each (reduced protocol: 6 LLM calls × 2k + 3 tool calls × 3k + 6k dossier writing) + orchestrator consolidation 15k + 5k reserve. |
| **Citation verify budget** | 15k (4%) | CiteTracer-adapted content verification — URL re-fetch + semantic match for ~25 citations (5 dossiers × ~5 cites each). |
| **Synthesis budget (γ)** | 40k (11%) | γ=2 × 15k each + orchestrator consolidation 10k. |
| **Reserve + archives** | 30k (9%) | Novelty archive embedding writes, constraint archive writes, cycles.json update, RECORD/day-status updates. |
| **All-advance DA re-dispatch** | 25k (7%) | Capped at ONE DA re-dispatch per cycle (not one per advanced idea — gap G12 fix). 25k = one reduced-protocol research subagent. If > 5 ideas are advanced, only 1 re-dispatch fires (chosen by lowest confidence). |
| **TOTAL target** | **350k** | Matches cb-review's day-scope budget. |
| **HARD kill-switch** | **380k** | 30k (8.6%) crash margin. Waxell: alerts don't work — only enforcement does. At 380k the orchestrator stops cleanly. |

### B.2 Tiered budget (gap G1 fix)

Two cycle types coexist:

- **Scout cycle (default, 350k):** the numbers above. Reduced protocol per idea (6 LLM calls + 3 tool calls instead of 1-E's full 13 + 6). Used for ~80% of cycles. Sufficient for ordinary problems.
- **Deep cycle (opt-in, ~727k over 2 spawns):** full 1-E protocol per idea (~64k per idea × 5 ideas + full D1/C1/D2/C2/Judge phases ≈ 727k). Triggered by launcher opt-in when (a) the problem is genuinely novel/contested AND (b) the prior scout cycle's shortlist contained ≥ 2 ideas marked `advance` with confidence ≥ 0.7. Spans two spawns via mid-cycle checkpointing (gap G5): spawn 1 runs α + β (≈ 450k), exits cleanly with `state=blocked, blocked_reason="deep_cycle_pause_between_alpha_beta"`, `Stopped at = "resume Wave γ with verdicts from R-001..R-005"`. Spawn 2 (re-wake) runs γ + post-β citation verify + archive updates (≈ 277k).

This resolves 2-B's C10 contradiction: the 350k budget holds for the default cycle type; the 727k budget is explicit, opt-in, and architecturally split across two spawns rather than silently blowing the budget.

### B.3 Enforced kill-switch (gap G1 / F3 / F16 fix)

- The orchestrator checks `tokens_used` after every subagent completion and every checkpoint-worthy transition (see §E).
- If `tokens_used ≥ 350k` AND the cycle is not in `synthesizing` or later: stop cleanly, `state=blocked`, `blocked_reason="budget_target_reached_pre_gamma"`. The launcher re-wakes the next spawn with `cycle_type=deep` automatically if the cycle had shown promise (≥ 2 ideas advanced).
- If `tokens_used ≥ 380k` at any point: hard stop, `state=blocked`, `blocked_reason="budget_hard_kill_switch"`. No further subagent dispatches; current subagent (if any) is allowed to finish writing its artifact, then the orchestrator exits.
- Per 2-B's Waxell citation: alerts don't work — enforcement does. The orchestrator does NOT ask the user "should I continue?" under any circumstance.

---

## C. Directory layout (port + adapt from cb-review §0)

```text
agents/brainstorm/
  LOOP.md                          ← canonical protocol (separate task to write)
  archive/
    novelty.jsonl                  ← idea hashes + status (proven/refuted/inconclusive)
    constraints.jsonl              ← next-cycle constraints (cross-cycle memory, Delphi+Stepladder)
    cycles.json                    ← cycle index: id, started_at, ended_at, idea_count, status, tokens_used, cycle_type
  runs/
    YYYY-MM-DD-CNNN/               ← one cycle run (cycle number NNN, zero-padded)
      RECORD.md                    ← cycle narrative + Stopped at + Residual + Shortlist/verdicts
      cycle-scope.md               ← launcher-written brief (goal, problem, inherited constraints, stop conditions)
      day-status.json              ← thin launcher poll file (see §A.4)
      persona-seed-matrix.md       ← diversification matrix for this cycle (which persona×seed each B-NNN used)
      brainstorm/
        B-001-dreamer-s1.md        ← per-subagent idea-doc
        B-002-dreamer-s2.md
        B-003-skeptic-s1.md
        B-004-skeptic-s2.md
        B-005-engineer-s1.md
        B-006-engineer-s2.md
        B-007-outsider-s1.md
        B-008-outsider-s2.md
        B-009-synthesizer-s1.md
        B-010-synthesizer-s2.md
      research/
        R-001-I-001.md             ← per-idea Toulmin-shaped 4-state dossier
        R-002-I-002.md
        R-003-I-003.md
        R-004-I-004.md
        R-005-I-005.md
        R-006-I-003.md             ← (optional, the all-advance DA re-dispatch for idea I-003)
      synthesis/
        S-001.md                   ← verified / refuted / inconclusive claims, grouped by theme
        S-002.md                   ← next-cycle constraints (Delphi + Stepladder translation)
      citations/
        verified.jsonl             ← each line: {dossier_id, claim, url, fetched_at, content_match_score}
        refuted.jsonl              ← each line: {dossier_id, claim, url, reason, content_match_score}
      checkpoints/
        alpha-B-001.json           ← per-subagent durable-progress checkpoint (gap G5)
        alpha-B-002.json
        ...
        beta-R-001.json
        ...
```

### C.1 File-purpose rules (mirror cb-review §0)

- **`LOOP.md` is canonical protocol.** Dated `runs/YYYY-MM-DD-CNNN/` folders are immutable history. Nothing canonical at repo root or under `loops/`. (Invariant rule #7.)
- **`archive/` is the cross-cycle memory.** It is the ONLY thing that persists across `runs/` folders. `novelty.jsonl` grows monotonically (idea hashes + status); `constraints.jsonl` grows monotonically (new constraints appended, never deleted — decay is by *tagging*, see §F); `cycles.json` is the cycle index.
- **Do not nest `brainstorm/` under `research/`.** Brainstorm = idea-docs (divergent); research = dossiers (convergent). Same separation discipline as cb-review's "do not nest brainstorms under audits/".
- **`checkpoints/` is a phase-state-machine artifact store** (gap G5). Each checkpoint file is a small JSON snapshot of the orchestrator's durable-progress state at a checkpoint-worthy transition. Not human-readable; only used by the resume protocol (§E).
- **RUN_ROOT discipline:** `RUN_ROOT=agents/brainstorm/runs/YYYY-MM-DD-CNNN` is the only path agents write to during a cycle. Never write artifacts at `archive/` *during* a cycle except via the orchestrator's end-of-cycle archive-update step.

### C.2 Cross-cycle artifacts (`archive/`)

#### `archive/novelty.jsonl` (gap G3 fix)

One line per idea ever produced across all cycles:

```json
{"idea_id":"I-001","cycle_id":"cycle-001","persona":"dreamer","seed":"s1","problem_hash":"sha256:...","idea_text":"…","embedding":[0.0123,…],"warrant_hash":"sha256:...","verdict":"advance","confidence":0.78,"status":"proven","updated_at":"…"}
```

- `embedding` is a vector from a small embedding model (e.g., `text-embedding-3-small` or a local Sentence-Transformer). Used for cosine-similarity dedup against new ideas.
- `warrant_hash` is `sha256` of the `warrant` field from the idea's Toulmin decomposition (per 1-E #22). Two ideas with the same warrant are duplicates even if surface text differs. Secondary check against embedding traps (2-B's LinkedIn/Anir Sharma caveat).
- `status` ∈ `{proven, refuted, inconclusive, advance, kill}`. Updated when the verdict on the idea changes (e.g., an `advance` idea later proven by an external PoC).

#### `archive/constraints.jsonl` (gap G11 fix)

One line per constraint ever extracted:

```json
{"constraint_id":"C-001","cycle_id":"cycle-002","source_idea_id":"I-007","source_verdict":"kill","source_reason":"assumption A unsupported","text":"Do not generate ideas that depend on Assumption A","tags":["assumption-A","kill-derived"],"decay_score":1.0,"created_at":"…","last_applied_cycle":"cycle-005"}
```

- `decay_score` starts at 1.0 and decays by 0.15 per cycle the constraint is NOT applied (i.e., no idea was rejected for violating it). At `decay_score < 0.3` the constraint is marked `soft` (orchestrator MAY relax it). At `decay_score < 0.1` it is marked `archived` (kept for audit, not enforced). This fixes 2-B's G11 (constraint accumulation / monotonic narrowing) without deleting history.
- `tags` allow themed constraint retrieval (e.g., "all constraints derived from killed assumptions about caching").

#### `archive/cycles.json`

```json
{
  "cycles": [
    {"id":"cycle-001","started_at":"…","ended_at":"…","run_root":"runs/2026-07-18-C001","cycle_type":"scout","idea_count":10,"shortlist_count":5,"advance_count":2,"kill_count":2,"inconclusive_count":1,"tokens_used":348211,"status":"complete","stop_reason":"goal-anchored-met"},
    ...
  ],
  "session_stop_condition": "find 3 ideas worth implementing OR max 10 cycles",
  "cycles_remaining": 7
}
```

---

## D. RECORD.md template (port + adapt from cb-review §8.1)

```markdown
# brainstorming-loop RECORD — YYYY-MM-DD-CNNN

## Status
- State: in_progress | paused | complete
- Cycle ID: cycle-NNN
- Cycle type: scout | deep
- Last updated: ISO timestamp
- Continues from: (prior cycle-id or none)
- RUN_ROOT: agents/brainstorm/runs/YYYY-MM-DD-CNNN

## Goal this cycle
- Problem statement: …
- Inherited constraints: (count + tag list, e.g., "3 active, 1 soft, 0 archived")
- Stop condition (user-supplied at session start): …
- Cycle type rationale: (scout: default; deep: triggered by prior cycle's ≥2 advance≥0.7)

## Waves
| Wave | Status | Notes |
|------|--------|-------|
| α Brainstorm | pending|done | N=10 subagents, 10 idea-docs, shortlist of 5 |
| β Research | pending|done | M=5 dossiers, X advance, Y kill, Z inconclusive |
| Citation verify | pending|done | CiteTracer-adapted; X verified, Y refuted |
| γ Synthesis | pending|done | S-001 claims, S-002 constraints |
| All-advance DA re-dispatch | not-fired|fired-once | (if fired: which idea, why) |

## Shortlist / verdicts
| Idea-id | Persona | Seed | Verdict | Confidence | Next-cycle constraint |
|---------|---------|------|---------|------------|-----------------------|
| I-001 | Dreamer | s1 | advance | 0.78 | — |
| I-002 | Skeptic | s1 | kill | — | "Avoid assumption A" → C-012 |
| I-003 | Engineer | s1 | advance | 0.71 | — |
| I-004 | Outsider | s2 | inconclusive | — | "Re-attempt with falsifier B" → C-013 |
| I-005 | Synthesizer | s1 | advance | 0.69 | — |

## Done (chronological)
- 14:01 spawned cycle-scope orchestrator; cycle-scope.md written
- 14:08 Wave α dispatched (10 subagents in parallel)
- 14:14 Wave α completed; shortlist of 5 written to persona-seed-matrix.md
- 14:15 Wave β dispatched (5 subagents in parallel)
- 14:32 Wave β completed; verdicts consolidated
- 14:33 all-advance check: 3/5 advance (>70% threshold) → re-dispatch ONE DA on I-005 (lowest confidence)
- 14:41 DA re-dispatch completed; I-005 verdict reaffirmed as advance (0.61)
- 14:42 Citation verify: 22 verified, 3 refuted (all in R-002, I-002 dossier already killed)
- 14:44 Wave γ dispatched (2 subagents)
- 14:49 Wave γ completed; S-001 + S-002 written
- 14:50 archive/novelty.jsonl + archive/constraints.jsonl + archive/cycles.json updated
- 14:51 tokens_used=347,891 (under 350k target, under 380k kill-switch)
- 14:51 state=complete

## In flight
- (nothing — cycle closed cleanly)

## Stopped at
- (if state=complete: "cycle closed cleanly; launcher to read synthesis/S-001.md + S-002.md and decide next cycle")
- (if state=blocked: exact next action, e.g., "Wave β incomplete; R-003 not yet dispatched; resume with one research subagent on idea I-003, assumption A12, REACT_BUDGET=30k")

## Residual / backlog
- (ideas deferred for a future cycle, e.g., "I-004 inconclusive; next cycle should re-attempt with falsifier B")

## Novelty archive additions this cycle
- I-001..I-010 added; 2 marked duplicate of prior-cycle ideas (cosine > 0.88 with cycle-006 I-002 and I-007); both demoted out of shortlist

## Persona failure modes observed this cycle
- "Dreamer/s2 collapsed to Engineer-mode after first idea" → tag for persona-prompt refinement
- "Skeptic/s1 was insufficiently adversarial (DA re-dispatch needed)" → tighten disagreement mandate

## Constraint delta
- Constraints added this cycle: 2 (C-012 "avoid assumption A", C-013 "re-attempt I-004 with falsifier B")
- Constraints decayed this cycle: 1 (C-007 from cycle-004 → soft, decay_score 0.25)
- Constraints archived this cycle: 0

## How to resume
- If state=complete: launcher reads synthesis/S-001.md + S-002.md between cycles; decides which advance-verdicted ideas to pursue; triggers next cycle OR closes loop per stop conditions.
- If state=blocked: launcher re-wakes cycle-scope orchestrator with `RUN_ROOT` unchanged + `Stopped at` as the residual scope.
```

The orchestrator updates `RECORD.md` at: cycle start, end of each wave, after each checkpoint-worthy transition (§E), after the all-advance DA re-dispatch, after citation verify, after archive updates, and at cycle pause/stop. **"Never invent status"** rule (cb-review §8.2 step 5) holds verbatim.

---

## E. Resume protocol (port + adapt from cb-review §8.2)

### E.1 Between-cycle resume (cb-review §8.2 ported verbatim, wave names adapted)

1. Open latest `agents/brainstorm/runs/*/RECORD.md` (or user-specified cycle-id).
2. Read `Stopped at`, `Residual`, and `$RUN_ROOT/day-status.json` if present.
3. **Launcher:** re-wake a cycle-scope orchestrator with the residual scope (§A.3). **Cycle-scope:** continue mid-wave / mid-verdict without waiting for a human.
4. Continue that run **or** create a new dated folder (`runs/YYYY-MM-DD-C{NNN+1}/`) and link "continues from" cycle-NNN in the new `RECORD.md`.
5. Never invent status — update `RECORD` (and `day-status.json`) after every material step.

### E.2 Mid-wave re-entrancy (gap G5 fix — new, NOT in cb-review)

cb-review's resume contract is between-cycle only. The brainstorming loop adds finer-grained mid-wave checkpointing via a phase-state-machine (Wayland Zhang, "Mid-Turn Checkpointing in a Long-Running Agent Loop", April 2026, cited in 2-B).

#### E.2.1 Phase-state-machine

The cycle-scope orchestrator's lifecycle has 8 phases (mapping Zhang's 8-phase machine to the brainstorming loop):

| Zhang phase | Brainstorming-loop phase | Idle for timeout? | Checkpoint-worthy transitions out |
|---|---|---|---|
| `Setup` | orchestrator spawning, scaffolding | no | → `ExecutingTools` (Wave α dispatch) |
| `ExecutingTools` | Wave α / β / γ subagents running | no | → next `ExecutingTools` (next subagent) / → `AwaitingLLM` (consolidation) |
| `AwaitingLLM` | orchestrator consolidating (Judge role) | **yes** | → `ExecutingTools` (next wave) / → `Done` |
| `RetryingLLM` | retrying a failed LLM call | no | → `AwaitingLLM` / → `Compacting` |
| `Compacting` | context compaction (§G) | no | → `AwaitingLLM` |
| `AwaitingApproval` | (UNUSED — would be HITL; violates invariant rule #1) | n/a | n/a |
| `ForceStop` | kill-switch fired (380k) or user-cancelled | **yes** | → `Done` (exit cleanly) |
| `Done` | cycle closed (`state=complete` or `state=blocked`) | terminal | — |

#### E.2.2 Checkpoint-worthy transitions (the only ones that write to `checkpoints/`)

Per Zhang's rule: **only transitions that produce a durable artifact on disk are checkpoint-worthy**. Intra-LLM-stream checkpoints produce garbage (the LLM is mid-generation). The 3 checkpoint-worthy transitions:

1. **`ExecutingTools` → next `ExecutingTools`** (a subagent finished writing its artifact). Checkpoint file: `checkpoints/<wave>-<artifact-id>.json` with `{phase, artifact_path, tokens_used_at_checkpoint, next_subagent_to_dispatch}`.
2. **`AwaitingLLM` success → `ExecutingTools`** (consolidation finished, shortlist/verdicts written). Checkpoint file: `checkpoints/<wave>-consolidation.json` with `{phase, output_artifact_path, tokens_used_at_checkpoint}`.
3. **`Compacting` → `AwaitingLLM`** (compaction finished, context summarised). Checkpoint file: `checkpoints/compaction-<n>.json` with `{phase, summarised_context_path, tokens_used_at_checkpoint, tokens_saved}`.

All other transitions are NOT checkpointed — they're recomputed on resume.

#### E.2.3 Resume from mid-wave crash

When the launcher re-wakes the orchestrator after a mid-wave crash:

1. The orchestrator reads `day-status.json` (`state`, `phase`, `last_checkpoint`).
2. It reads the latest checkpoint file referenced by `last_checkpoint`.
3. It scans `$RUN_ROOT/<wave>/` for which artifacts exist on disk.
4. It dispatches ONLY the subagents whose artifacts are missing.

Example: Wave α has N=10 subagents. Crash occurred after 7 completed. On resume: orchestrator scans `brainstorm/B-*.md`, finds `B-001` through `B-007`, dispatches `B-008`, `B-009`, `B-010` only. **No re-execution** of completed subagents — this is Zhang's "tool side effects can't be undone, naive retry double-charges the bill" rule.

Example: Wave β has M=5 subagents. Crash occurred mid-`R-003` (the subagent had made 4 of 6 LLM calls). On resume: the partial `R-003` dossier (if any) is discarded (intra-LLM-stream checkpoints are garbage per Zhang). `R-003` is re-dispatched from scratch with the same brief. `R-001`, `R-002`, `R-004`, `R-005` are NOT re-dispatched (artifacts exist on disk).

#### E.2.4 Tool-failure retry contract (gap G10 fix, new)

If a subagent's tool call fails (web_search rate-limit, network blip, paywall), the subagent retries up to 3 times with exponential backoff (5s / 30s / 120s). After 3 failures:
- If the failed tool was the *only* source for the dossier's `grounds` field: dossier is marked `inconclusive`, `reason="tool_failure_no_external_grounding"`. Feeds back as a constraint (per 1-E's inconclusive handling): "Re-attempt idea I-NNN in next cycle with alternative source for claim X".
- If the failed tool was a secondary source: dossier proceeds with remaining grounds, but the missing source is noted in the dossier's `qualifier` field ("confidence reduced; source Y unavailable").

The orchestrator NEVER fabricates a tool result (1-A #4's ReAct failure mode). A subagent that returns a dossier with `grounds` containing a URL that was never actually fetched is treated as garbage output (gap G9 fix): the dossier is discarded, the subagent is blacklisted for the cycle, and a replacement subagent is dispatched with the same brief but a tightened "cite-as-you-go or do not cite" mandate.

---

## F. Stop conditions for the outer loop (gap G2 fix)

The cycle has a well-defined completion criterion (1-D's adaptation: shortlist converged, every idea has a verdict, next-cycle constraints extracted). The **outer loop** (sequence of cycles) needs its own stop conditions. Three layers, combined:

### F.1 Goal-anchored (user-supplied at session start)

The launcher writes the stop condition into `cycle-scope.md` at the start of every session. Examples:
- "Find 3 ideas worth implementing" — loop stops when 3 ideas are marked `advance` with confidence ≥ 0.7 AND verified by external PoC.
- "Exhaust the design space for problem X" — loop stops when 3 consecutive cycles produce 0 new `proven` ideas (see F.2).
- "Compare approaches A, B, C for problem X" — loop stops when each approach has at least one `advance`-verdicted idea with a comparative dossier.

The orchestrator checks the stop condition at end-of-cycle (after `synthesis/S-002.md` is written). If met: `state=complete`, `cycles.json.session_stop_reason="goal-anchored-met"`.

### F.2 Novelty-decay-anchored (loop self-terminates)

Even without a user-supplied goal, the loop self-terminates if it stops producing new ideas:

- **Per-cycle novelty delta:** the orchestrator computes (new ideas in this cycle's shortlist) − (ideas in this cycle's shortlist flagged as duplicates of prior-cycle ideas via the novelty archive). If the delta is 0 for 3 consecutive cycles, the loop terminates: `state=complete`, `cycles.json.session_stop_reason="novelty-decay-3-consecutive"`.
- **Constraint-decay signal:** if `archive/constraints.jsonl` has > 50% of constraints at `decay_score < 0.3` (the idea space is over-narrowed per 2-B's G11), the loop terminates: `state=complete`, `stop_reason="constraint-exhaustion"`.

This is the evolutionary-search termination pattern (FunSearch's fitness-plateau detector, cited in 2-B). It prevents F1 (loop produces the same 10 ideas every cycle) and F6 (loop never terminates).

### F.3 Budget-anchored (hard backstop)

- **Max cycles per session:** 10 (default; user can override at session start). After 10 cycles the loop terminates regardless of goal/novelty state: `stop_reason="max-cycles-reached"`.
- **Max tokens per session:** 4M (sum across all cycles in a session). After 4M tokens the loop terminates: `stop_reason="max-tokens-reached"`.
- **Per-cycle hard kill-switch:** 380k (see §B.3) — this stops a single cycle, not the loop. If a cycle hits the kill-switch, the launcher decides whether to re-wake (with `cycle_type=deep` for a promising scout that ran out of budget) or close the loop.

### F.4 User cancels

The user can cancel the loop between cycles (never inside a cycle — invariant rule #1). The launcher writes `cycles.json.session_stop_reason="user-cancelled"` and stops triggering new cycles.

### F.5 Infinite-loop guard (gap G2 + 2-B's arXiv:2607.01641 IAL-Scan finding)

The combination of F.1 + F.2 + F.3 makes infinite loops *impossible*:
- F.1 bounds the loop by user intent.
- F.2 bounds the loop by diminishing returns (3-cycle novelty decay).
- F.3 bounds the loop by hard caps (10 cycles / 4M tokens).

If all three fail to fire (a bug in the orchestrator's stop-condition check), the user-cancel backstop (F.4) applies. The arXiv:2607.01641 IAL-Scan finding (68 confirmed infinite-loop failures across 47 of 6,549 LLM agent repos) makes this multi-layer termination non-optional.

---

## G. Cost budget per cycle (gap G1 explicit resolution)

### G.1 The 727k problem (2-B's C10 contradiction, restated)

2-B computed that 1-E's full protocol per idea (~13 LLM calls + 5-8 tool calls = ~64k tokens) × 5 ideas + D1/C1/D2/C2/Judge phases ≈ **727k tokens per cycle**. This is 2.1× cb-review's 300k-350k day-scope budget that 1-D's adaptation preserved verbatim. The "all-advance is suspicious" re-dispatch (5 extra DA subagents × ~64k each = 320k) doubles this to ~1M tokens — 3× the budget.

### G.2 Resolution: tiered budget + reduced rhythm (2-B's options (b)+(c), picked and justified)

I pick **option (b) reduced rhythm + option (c) tiered budget** in combination. Justification for NOT picking the alternatives:

- **(a) Multi-day-scope cycles:** would require every cycle to span 2-3 spawns with mid-cycle checkpointing. This adds complexity to every cycle. The default case (ordinary problems) doesn't need it; only deep cycles on contested problems do. Adopting (a) universally would make every cycle pay the checkpointing overhead.
- **(d) Smart-orchestrator + cheap-workers:** exigo is single-model-shop (gap G7). The "cheap workers" would have to be the same grok model with a thinner prompt, which doesn't actually buy the 4-5x cost reduction MindStudio's pattern relies on (their pattern uses a *genuinely cheaper model* for workers, e.g., Haiku vs Sonnet). Without a cheaper model, the saving is illusory.

So: **the default cycle is a "scout" cycle at 350k tokens** (reduced rhythm: 6 LLM calls + 3 tool calls per idea instead of 13 + 6; shortlist capped at 5 instead of 7; D2/C2 skipped — D1 is single-pulse nominal silent generation per 2-A's correction of 1-B's brainwriting-6-3-5 ranking; the C1+Judge consolidation serves as the convergence). **A "deep" cycle at ~727k tokens** (full 1-E protocol, full D1/C1/D2/C2/Judge rhythm) is opt-in, triggered by the launcher when the prior scout cycle showed ≥ 2 ideas advanced with confidence ≥ 0.7. Deep cycles span 2 spawns via mid-cycle checkpointing (§E.2).

### G.3 Per-wave allocation for a scout cycle (350k target / 380k kill-switch)

| Wave / activity | Tokens | % of target | Per-subagent cost | Subagent count |
|---|---|---|---|---|
| α Brainstorm | 70,000 | 20% | ~5,500 | N=10 (parallel) |
| α consolidation (Judge) | 15,000 | 4% | (orchestrator) | 1 |
| β Research | 150,000 | 43% | ~30,000 | M=5 (parallel) |
| β consolidation (Judge) | 15,000 | 4% | (orchestrator) | 1 |
| Citation verify (CiteTracer-adapted) | 15,000 | 4% | (orchestrator) | 1 |
| γ Synthesis (claims) | 15,000 | 4% | 15,000 | γ₁=1 |
| γ Synthesis (constraints) | 15,000 | 4% | 15,000 | γ₂=1 |
| γ consolidation | 10,000 | 3% | (orchestrator) | 1 |
| Archive updates (novelty + constraints + cycles) | 10,000 | 3% | (orchestrator) | 1 |
| Reserve: all-advance DA re-dispatch (capped at 1) | 25,000 | 7% | 25,000 | 0 or 1 |
| RECORD + day-status writes | 5,000 | 1% | (orchestrator) | 1 |
| **Subtotal (target)** | **350,000** | **100%** | | |
| Crash margin | 30,000 | 9% | (orchestrator) | — |
| **HARD kill-switch** | **380,000** | | | |

### G.4 Subagent cap per wave (given the budget)

- **Wave α:** N ≤ 10. Formula: `N = floor((α_budget - α_consolidation) / per_subagent_cost) = floor((70k - 15k) / 5.5k) = 10`. Increasing N requires either a larger α_budget or a smaller per-subagent cost (which sacrifices idea-doc depth).
- **Wave β:** M ≤ 5. Formula: `M = floor((β_budget - β_consolidation) / per_subagent_cost) = floor((150k - 15k) / 30k) = 4.5 → 5` (with 5k reserve). M is also bounded by the shortlist cap (= 5).
- **Wave γ:** γ ≤ 2. γ is NOT a parallel fan-out; it's two independent reduces. Increasing γ would require splitting the synthesis task into more independent reduces, which the task does not naturally support (claims and constraints are the two reduces; further splitting produces sub-reduces that need to be re-merged, adding cost without parallelism benefit).

### G.5 The "all-advance is suspicious" re-dispatch (gap G12 fix)

1-E's rule (re-dispatch one DA per advanced idea) doubles per-cycle cost. Fixed by **capping at ONE re-dispatch per cycle**, fired only if `advance_count / shortlist_size > 0.7` (i.e., 4 of 5 advanced). The single DA re-dispatch targets the advanced idea with the **lowest confidence** (most likely sycophantic). If the DA fails to overturn the verdict, the idea stays `advance` with a `re-dispatched_and_upheld` flag in the dossier (auditable). If the DA overturns, the idea is demoted to `inconclusive` and feeds back as a constraint.

This trades 1-E's "re-dispatch every advanced idea" (5 × 64k = 320k extra) for "re-dispatch one" (25k extra), saving ~295k per problematic cycle. The cost: weaker sycophancy detection (we only catch the worst offender, not all of them). Mitigation: the other 6 anti-sycophancy mechanisms (4-state dossier, mandated steelman, pre-declared rubric, position-swap, cite-as-you-go with content verification, single-model-shop structural split per §H rule 5) still apply per-idea.

---

## H. The 7 invariant rules of autonomy (port from 1-D, with adaptation notes)

These are the load-bearing rules. Remove any one and the loop stops being autonomous. For each rule: cb-review's wording (1-D), the brainstorming-loop adaptation, and whether it holds verbatim / adapted / new.

### H.1 No human in the loop inside the cycle-scope agent

- **cb-review:** *"No human in the loop. Do not pause for 'should I continue?' — continue, ship, or leave a precise `Stopped at` + `day-status.json` if truly blocked (permissions, missing secrets, merge conflict needing human)."* (§0.5.3)
- **Brainstorming-loop adaptation:** Holds verbatim. Exceptions list changes — drop "merge conflict needing human" (no code edits), add "tool failure after ≥3 retries" and "budget exhausted mid-phase" (the 380k kill-switch). The "agent's job to wait properly / converge properly" rule maps to: do not abandon a cycle half-judged; do not ask the human to "review the shortlist later"; the Judge verdict loop is mandatory.
- **Verdict:** ✅ holds (verbatim wording, adapted exceptions).

### H.2 Launcher and cycle-scope agent are separate processes; launcher never ingests the worker's transcript

- **cb-review:** The launcher polls only `day-status.json` + `RECORD.md` "Stopped at". This keeps the launcher's context thin enough to re-wake many times, and keeps the worker autonomous (no parent watching its scratchpad). (§0.5.1, §0.5.2 step 4)
- **Brainstorming-loop adaptation:** Holds verbatim. The launcher additionally reads `synthesis/S-001.md` + `synthesis/S-002.md` + `advance`-verdicted dossiers **between cycles** (active-curator role, §A.1 step 5) — but this is *between* cycles, never *inside* a cycle. The launcher never reads `brainstorm/B-*.md` (raw idea-docs), never reads `checkpoints/*.json`, never reads the orchestrator's session JSONL.
- **Verdict:** ✅ holds (verbatim principle, expanded between-cycle read set).

### H.3 `day-status.json` + `RECORD.md` "Stopped at" is the ONLY resume contract

- **cb-review:** Without these two artifacts a cold launcher cannot re-wake the worker — it would have to re-brief from scratch, which requires a human. The rule "never invent status — update RECORD (and day-status) after every material step" is what makes the contract trustworthy. (§0.5.4, §8.2 step 5)
- **Brainstorming-loop adaptation:** Holds, **extended with mid-wave checkpoints** (gap G5 fix). The resume contract now includes `day-status.json` + `RECORD.md` "Stopped at" + `checkpoints/<latest>.json`. The `checkpoints/` directory did not exist in cb-review (its waves are short, mid-wave crash is unlikely). The brainstorming loop's Wave β (M=5 × 30k each = 150k tokens) is long enough that mid-wave crash is likely, so the checkpoint store is added. The "never invent status" rule holds verbatim.
- **Verdict:** ✅ holds (extended, not weakened).

### H.4 Strict one-directional wave separation + disjoint ownership

- **cb-review:** Wave A cannot spawn Wave B; Wave B cannot edit product code; Wave C cannot re-open design. Parallel workers (Wave C fixers) own disjoint file sets. (§3, §7.1)
- **Brainstorming-loop adaptation:** Holds verbatim. Wave names change: α (brainstorm) → β (research) → γ (synthesis). Disjoint ownership unit changes from "files" to "idea-ids + persona×seed pairs" (1-D's adaptation). No-re-litigation rules: (a) research subagents do not re-open the brainstorm phase (they only kill/refine/advance ideas from the shortlist); (b) synthesis does not re-open research verdicts; (c) the all-advance DA re-dispatch (§G.5) is the *only* exception — it re-runs research on one already-verdicted idea, with a tightened disagreement mandate.
- **Verdict:** ✅ holds (verbatim principle, adapted wave names + ownership unit).

### H.5 The agent's job to wait properly / converge properly

- **cb-review:** Do not abandon a PR half-reviewed, do not ask a human to "check later", the 5m/10m/10-30m CodeRabbit wait loops are mandatory. (§10.2 4c, §10.2 4d)
- **Brainstorming-loop adaptation:** Holds. The analog of CodeRabbit's external wait loop is the **internal Judge verdict loop**: after Wave β, the orchestrator must produce kill/refine/advance/inconclusive for every shortlisted idea before Wave γ. The analog of "empty CR is suspicious" is "all-advance verdict is suspicious" (1-D's adaptation) — fired if `advance_count / shortlist_size > 0.7`, triggering ONE capped DA re-dispatch (§G.5 fix). The analog of "do not abandon half-reviewed" is "do not abandon a cycle half-judged" — if the 380k kill-switch fires mid-β, the orchestrator writes `Stopped at` for each un-verdicted idea and exits cleanly.
- **Verdict:** ✅ holds (analog mapping, identical principle).

### H.6 Scope-sized spawns with contiguous ownership

- **cb-review:** One spawn = roughly 300k-350k tokens of agent context for the worker. "One day's work" = a large, coherent chunk where multi-pack / multi-slice progress is OK; contiguous ownership preferred. (§0.5.2 step 2, §0.5.3)
- **Brainstorming-loop adaptation:** **Adapted: cycle-scope, not day-scope (§A.5).** One spawn = one cycle (α→β→γ). Default cycle budget = 350k tokens (matches cb-review's day-scope). Deep cycle budget = ~727k, explicitly spanning 2 spawns via mid-cycle checkpointing. Contiguous ownership = one cycle's shortlist + verdicts + constraints, NOT tiny one-idea chores. The unit of contiguous ownership changes from "disjoint file packs" to "one full cycle (or a partial cycle's residual)".
- **Verdict:** ⚠️ adapted (cycle-scope not day-scope; tiered budget; deep cycles explicitly span 2 spawns). The principle (scope-sized, contiguous ownership, not tiny chores) holds; the parameters change.

### H.7 Single source of truth

- **cb-review:** `LOOP.md` is canonical protocol; dated `YYYY-MM-DD/` folders are immutable run history; nothing canonical at repo root. (Preamble, §0, §1.4, §1.5)
- **Brainstorming-loop adaptation:** Holds verbatim. New loop lives at `agents/brainstorm/LOOP.md`. Dated runs under `runs/YYYY-MM-DD-CNNN/`. The cross-cycle `archive/` directory is canonical for *cross-cycle memory* (novelty, constraints, cycle index) — it is the only thing that persists across runs. Nothing canonical at repo root or under `loops/`. Same history-table convention at the end of `LOOP.md`.
- **Verdict:** ✅ holds (verbatim principle, new path).

### H.8 (NEW) Structural diversity pressure — the brainstorming loop's 8th invariant

cb-review does not need diversity pressure — its reviewers are inherently diverse because they own disjoint slices of the codebase. The brainstorming loop's workers share the idea-space (the same problem statement), so without explicit structural diversification they collapse to mode (Deng & Brucks 2026, verified by 2-A with the corrected "knowledge-partitioning mechanism" reading). This is the only place where the brainstorming loop is **strictly more constrained** than cb-review.

- **Rule:** every Wave α subagent is dispatched with a disjoint (persona, seed) tuple. No two subagents share persona+seed. The persona set is 1-A's 5 (Dreamer, Skeptic, Engineer, Outsider, Cross-Domain Synthesizer) with explicit disagreement mandates (A9 fix: an unbound DA persona collapses to sycophantic agreement per Wang & Yin IUI 2024). Seeds are drawn from a per-cycle seed pool (random stimuli from 1-A's lateral-thinking family, with 1-B's Oblique Strategies / TRIZ / Random Input as fallback when the synthesizer's output is too close to the prior mode). The persona×seed matrix is written to `$RUN_ROOT/persona-seed-matrix.md` BEFORE Wave α dispatches, so a mid-wave crash can resume the missing subagents with their original tuples.
- **Verdict:** ⚠️ NEW invariant (cb-review does not have it; brainstorming loop requires it).

---

## I. Resolution summary for 2-B's 7 must-address gaps

| # | Gap (from 2-B) | Where addressed in this design | Resolution |
|---|---|---|---|
| G1 | Cost runaway (~727k per cycle vs 350k budget) | §B.2 tiered budget + §G explicit per-wave allocation | Default scout cycle = 350k (reduced rhythm: 6 LLM + 3 tool per idea, shortlist cap 5, D2/C2 skipped). Deep cycle = 727k opt-in, spans 2 spawns. Hard kill-switch at 380k (Waxell enforcement, not alerts). |
| G2 | Outer-loop termination | §F (three layers + IAL guard) | Goal-anchored (user-supplied) + novelty-decay (3 consecutive cycles with 0 new proven ideas) + budget-anchored (10 cycles / 4M tokens hard cap). Infinite-loop impossible per arXiv:2607.01641. |
| G3 | Novelty archive + cross-cycle dedup | §C.2 `archive/novelty.jsonl` + §C.2 `archive/constraints.jsonl` | Embedding cosine similarity (primary, threshold 0.85) + Toulmin-warrant hash (secondary, catches semantic duplicates embeddings miss). Both live in `archive/`, the only cross-cycle store. Constraint decay score (G11 fix) prevents monotonic narrowing. |
| G4 | Hallucinated-citation content verification | §B post-β citation verify step + §C `citations/verified.jsonl` `refuted.jsonl` | CiteTracer-adapted (arXiv:2605.08583): re-fetch every URL in every dossier's `grounds`; semantic match between dossier's `summary` and cited source's abstract / first-page text. Fail ⇒ auto-inconclusive + dossier flagged. 2+ hallucinated citations from same subagent in one cycle ⇒ subagent blacklisted. |
| G5 | Mid-cycle re-entrancy | §E.2 phase-state-machine + §C `checkpoints/` directory | Wayland Zhang's 8-phase machine mapped to brainstorming-loop phases. 3 checkpoint-worthy transitions (subagent-completes, consolidation-finishes, compaction-finishes). Resume scans `brainstorm/` `research/` `synthesis/` for existing artifacts and dispatches only the missing ones. Tool side effects can't be undone — no naive retry. |
| G6 | Orchestrator context compaction | §H rule 6 + checkpoint-worthy `Compacting→AwaitingLLM` transition | Will Larson pattern: 80% threshold triggers compaction. "Virtual file" abstraction for large tool responses > 10k tokens (citations dumps, full dossier reads). Compaction keeps: (a) current cycle's shortlist + verdicts, (b) prior 3 cycles' synthesis docs (summarised), (c) full novelty archive (compact JSONL), (d) full constraint archive (compact JSONL with decay scores). Drops: (a) raw subagent transcripts, (b) prior-cycle raw artifacts (kept on disk, summarised in context). |
| G7 | Single-model-shop anti-sycophancy | §H rule 5 + §G.5 capped re-dispatch | Picked 2-B's option (c) (explicit acceptance + reliance on the other 6 mechanisms) PLUS a structural fix: orchestrator/Judge uses a different PROMPT PERSONA than workers + different rubric + different temperature (0.3 for Judge, 0.7 for workers). Weaker than a different model but concrete and auditable. All-advance re-dispatch capped at 1 per cycle (not 1 per advanced idea) to fit budget. |

---

## J. What this design deliberately does NOT do (non-goals)

- **Does NOT spawn nested reasoning agents.** Wave α/β/γ subagents are leaf workers. They may invoke tool_calls (web_search, repo read, code PoC runner) but never spawn a nested LLM-reasoning subagent. This preserves cb-review's "no nested brainstorm spawn" rule (1-C's recursive-MAS failure mode guard).
- **Does NOT run Wave α and Wave β concurrently.** Strict one-directional wave separation (invariant rule #4). Wave β needs Wave α's shortlist as input.
- **Does NOT edit product code.** The brainstorming loop's "ship" target is `synthesis/S-001.md` + `synthesis/S-002.md` + the dossiers for `advance`-verdicted ideas. The launcher (between cycles) is where any "implement this idea" decision happens, and that implementation is out-of-scope for this loop.
- **Does NOT do multi-agent debate.** Per 1-A's exclusion + 2-A's verification of the failure-mode literature. The Devil's Advocate persona (#2 in 1-A's set) and the all-advance DA re-dispatch (§G.5) provide the adversarial pressure without MAD's failure modes (Smit ICML 2024, ICML 2025, Yao Sep 2025). The narrow exception (1-E's adversarial collaboration for 50/50-split contested ideas) is a future v2 feature, not part of the default architecture.
- **Does NOT delete prior cycle folders.** `runs/YYYY-MM-DD-CNNN/` is immutable history. The cross-cycle `archive/` is the only thing that grows. (Invariant rule #7.)
- **Does NOT use a second model.** Single-model-shop (gap G7 accepted). The structural mitigations (different persona, rubric, temperature) are the substitute; a future v2 may add a second model for the Judge role if the structural mitigations prove insufficient in practice.

---

## K. What this design leaves to other Phase-2 subagents (handoff)

This file specifies the outer-loop architecture. The following are out of scope here and must be designed by sibling Phase-2 subagents (or in the final `LOOP.md`):

1. **Wave α subagent brief template** (the actual prompt sent to each Dreamer/Skeptic/Engineer/Outsider/Synthesizer × seed₁/seed₂ worker). The persona mandates from 1-A §persona-set + 2-A's "ordinary personas + CoT" correction + the disagreement mandate from A9.
2. **Wave β subagent brief template** (the actual prompt sent to each ReAct+CoVe research worker). The reduced Toulmin+RAT+ReAct+dossier protocol (6 LLM calls + 3 tool calls per idea, vs 1-E's full 13 + 6).
3. **Wave γ subagent brief template** (claims-extractor + constraint-writer prompts). The Delphi+Stepladder translation rule: kill reasons → "do not depend on A" constraints; inconclusive reasons → "re-attempt with falsifier B" constraints.
4. **CiteTracer-adapted citation-verification pipeline** (full spec). 2-B's R1 research task. Which of CiteTracer's 12 codes are mandatory for the loop's dossiers; the semantic-match threshold for "URL content actually supports the claim".
5. **Compaction prompt for the long-lived orchestrator** (full spec). 2-B's R2 research task. The exact prompt that fires at the 80% threshold; the "virtual file" abstraction for large tool responses.
6. **FunSearch-style island-based population model** (optional v2). 2-B's R4 research task. Whether the loop should adopt islands (K=5, max 25 ideas per island, periodic crossover) as the cross-cycle diversity mechanism instead of (or in addition to) the embedding-based novelty archive.
7. **The `LOOP.md` document itself.** This file specifies the architecture; `LOOP.md` is the canonical protocol the cycle-scope orchestrator reads at spawn time. It should be derived from this file + cb-review's `LOOP.md` structure (§0 directory layout, §0.5 harness, §1 starting clean, §2 north-star, §3 wave separation, §4 wave briefs, §5 RECORD, §6 resume, §7 stop conditions, §8 history).

---

## Sources

### Primary (read in full for this task)

- `/home/z/my-project/worklog.md` (1-A through 2-B Stage Summaries — full context)
- `/home/z/my-project/repo/exigo/agents/brainstorm/_meta-session/phase-1-brainstorm/1-D-cb-review-autonomy-extraction.md` (full — 14-item extraction + 7 invariant rules)
- `/home/z/my-project/repo/exigo/agents/brainstorm/_meta-session/phase-1-research/2-B-contradictions-gaps-premortem.md` (full — 10 contradictions, 13 gaps, 12 assumptions, 16 pre-mortem scenarios, 7 must-address gaps, 7 design-question answers)
- `/home/z/my-project/repo/exigo/agents/cd-review/LOOP.md` (§0–§12, for house style + spawn shape + RECORD template + ship protocol + history-table convention)
- `/home/z/my-project/repo/exigo/agents/brainstorm/_meta-session/phase-1-brainstorm/1-A-ai-brainstorming-methods.md` (persona set, lines 201-207; lateral-thinking family)
- `/home/z/my-project/repo/exigo/agents/brainstorm/_meta-session/phase-1-brainstorm/1-C-subagent-coordination-patterns.md` (orchestrator-worker topology, persona×seed matrix, lines 189-199)
- `/home/z/my-project/repo/exigo/agents/brainstorm/_meta-session/phase-1-brainstorm/1-E-verification-and-research-methods.md` (Toulmin-shaped 4-state dossier, anti-sycophancy mechanisms, full vs reduced protocol)

### Secondary (re-cited from 2-B's source list for the gap resolutions)

- Waxell, *AI Agent Token Budget Enforcement* (Apr 2026) — gap G1 enforcement-not-alerts
- Anthropic, *How we built our multi-agent research system* (Jun 2025) — orchestrator-worker, separate context windows, 15x multiplier
- Larson (Will), *Building an internal agent: Context window compaction* (Dec 2025) — gap G6 80% threshold + virtual file
- Zhang (Wayland), *Mid-Turn Checkpointing in a Long-Running Agent Loop* (Apr 2026) — gap G5 8-phase state machine + checkpoint-worthy transitions
- Li, Lin & Ma, *CiteTracer* (arXiv:2605.08583, May 2026) — gap G4 hallucinated-citation content verification
- Hou, Wang, Zhao & Wang, *When Agents Do Not Stop* (arXiv:2607.01641, Jul 2026) — gap G2 IAL-Scan, multi-layer termination non-optional
- MindStudio, *Smart Orchestrator Model to Direct Cheaper Sub-Agent Models* (May 2026) — gap G7 single-model-shop fallback analysis
- DeepMind, *FunSearch* (Dec 2023) — gap G2 + G3 fitness-plateau termination, island-based archive (v2)
- Deng, Brucks & Toubia 2026 — knowledge-partitioning mechanism (verified by 2-A; re-anchored per C4)
- Mullen, Johnson & Salas 1991 — nominal silent generation (verified by 2-A; inverts 1-B's brainwriting-6-3-5 ranking)
- Wang & Yin IUI 2024 — Devil's Advocate needs a concrete disagreement mandate (gap A9 fix)
- Panickssery et al. ICLR 2025 — self-preference bias (gap G7 root cause)
