# Brainstorming Loop (`brainstorm`)

Continuous **brainstorm → research → synthesize → brainstorm** loop for Exigo.

This is the **divergent** counterpart to `agents/cd-review/` (which is the **critical** counterpart). The cd-review loop optimizes an existing codebase for readability, clarity, brevity, consistency, correctness. The brainstorming loop generates, pressure-tests, and converges on **new ideas** that have not been written down yet — product features, architecture directions, research questions, design decisions.

The loop alternates two phases forever (until a stop condition fires):

1. **Brainstorm** (divergent, max-N parallel subagents) — generate many candidate ideas, structurally diversified by persona × seed to avoid mode collapse.
2. **Research** (convergent, max-N parallel subagents) — verify each shortlisted idea with external grounding (web search, code PoCs, citations), produce a Toulmin-shaped dossier with a 3-state verdict (`ADVANCE` / `REFUTE` / `INCONCLUSIVE`).
3. **Synthesize** (small, γ=2 sequential subagents) — extract verified claims and write constraints for the next cycle's brainstorm.
4. Repeat with the new constraints. The novelty archive and constraint archive are the cross-cycle memory.

This file is the **single source of truth** for the loop. Dated run artifacts live under:

```text
agents/brainstorm/runs/YYYY-MM-DD-CNNN/
```

**Two agent layers** run this protocol (mirrors `agents/cd-review/LOOP.md` §0.5, adapted for cycle-scope rather than day-scope):

1. **Launcher session** (user-triggered, thin) — picks the latest run, sizes one cycle of work, spawns a **separate** cycle-scope agent via CLI / harness, wakes it if it stalls, and **between cycles** acts as the active curator (decides which `ADVANCE` ideas to pursue).
2. **Cycle-scope agent** (autonomous, no human in the loop) — owns one full α→β→γ cycle, dispatches waves as in-process subagents, judges the shortlist, writes synthesis docs, updates the cross-cycle archives.

---

## 0. Directory layout

```text
agents/brainstorm/
  LOOP.md                              ← this file (always current protocol)
  README.md                            ← short overview + pointer to LOOP.md
  archive/                             ← cross-cycle memory (persists across runs)
    novelty.jsonl                      ← idea hashes + embeddings + status (monotone grow)
    constraints.jsonl                  ← next-cycle constraints with decay scores
    cycles.json                        ← cycle index: id, started_at, ended_at, status, tokens
    citations.jsonl                    ← cross-cycle citation verification cache (7-day TTL)
    README.md                          ← explains each archive file
  runs/
    .gitkeep
    README.md
    YYYY-MM-DD-CNNN/                   ← one cycle run (cycle number NNN, zero-padded)
      RECORD.md                        ← cycle narrative + Stopped at + Residual + verdicts
      cycle-scope.md                   ← launcher-written brief (goal, problem, stop conditions)
      day-status.json                  ← thin launcher poll file (state, phase, tokens_used)
      persona-seed-matrix.md           ← diversification matrix for this cycle
      brainstorm/
        B-001-dreamer-s1.md            ← per-subagent idea-doc
        ... (10 total per scout cycle)
      research/
        R-001-I-001.md                 ← per-idea Toulmin dossier (3-state verdict)
        ... (5 total per scout cycle)
        R-006-I-NNN.md                 ← (optional) capped DA re-dispatch
        _summary.md                    ← orchestrator's β-consolidation summary
      synthesis/
        S-001-claims.md                ← γ-1 output: verified/refuted/inconclusive claims by theme
        S-002-constraints.md           ← γ-2 output: next-cycle constraints (Delphi+Stepladder)
      citations/
        verified.jsonl                 ← per-cycle verified citations (merged to archive at end)
        refuted.jsonl                  ← per-cycle refuted citations (merged to archive at end)
      checkpoints/
        alpha-B-001.json               ← per-subagent durable-progress checkpoint
        ...
```

**Do not nest `brainstorm/` under `research/`.** Brainstorm = idea-docs (divergent). Research = dossiers (convergent). Same separation discipline as `agents/cd-review/LOOP.md` §0 ("Audits = findings. Brainstorms = how to fix.").

**RUN_ROOT discipline:** during a cycle, agents write ONLY to `$RUN_ROOT` (`agents/brainstorm/runs/YYYY-MM-DD-CNNN/`). The cross-cycle `archive/` is updated **only** by the orchestrator's end-of-cycle archive-update step. Mid-cycle reads from `archive/` are allowed (novelty dedup, constraint retrieval, citation cache lookup); mid-cycle writes to `archive/` are forbidden.

---

## 0.5 Harness: launcher vs cycle-scope agent

### 0.5.1 Roles

| Layer | How it starts | Job | Context discipline |
|-------|---------------|-----|--------------------|
| **Launcher** | User triggers the loop in an interactive agent session | Pick latest run, size one cycle of work, spawn a **separate** cycle-scope agent, poll `day-status.json` + `RECORD.md` only, wake the worker if it stalls, **between cycles** read synthesis docs and decide which `ADVANCE` ideas to pursue | Keep thin: status files + synthesis docs only — **do not** ingest the worker's full transcript, raw idea-docs, or checkpoints |
| **Cycle-scope agent** | Spawned by launcher (CLI / harness, peer process) | Execute this `LOOP.md` end-to-end for one cycle: waves α/β/γ, consolidation, citation verify, archive update, write RECORD + day-status | Full working context; **no human in the loop**; honors 380k token hard kill-switch |

In-process subagents of the cycle-scope agent (Wave α/β/γ workers) are leaf workers. They do **not** replace the cycle-scope agent, do **not** spawn nested agents, and do **not** see the orchestrator's scratchpad.

### 0.5.2 Launcher protocol (user-triggered)

When the user starts or continues the loop in the launcher session:

```text
1. RESOLVE RUN
   - Prefer user-specified cycle-id; else pick the latest agents/brainstorm/runs/YYYY-MM-DD-CNNN/.
   - Read RECORD.md (Status, Stopped at, Residual, Shortlist/verdicts) and day-status.json.
   - Skim the latest synthesis/S-001-claims.md + S-002-constraints.md only enough to know
     whether the prior cycle closed cleanly and what constraints the next cycle inherits.
   - Do NOT read raw brainstorm/B-*.md or research/R-*.md unless deciding which ADVANCE
     idea to pursue between cycles.

2. DECIDE SCOPE FOR ONE CYCLE
   - Package one cycle's worth of work: problem statement + inherited constraints + stop
     condition + cycle type (scout | deep), sized for ~350k tokens of agent context (scout)
     or ~727k tokens spread across 2 spawns (deep).
   - Write the scope into $RUN_ROOT/cycle-scope.md (goal, problem, inherited constraints,
     stop conditions, cycle type, hard budget).

3. SPAWN SEPARATE AGENT (not a subagent of the launcher)
   - Default harness: terminal `grok` headless (or project-equivalent CLI).
   - Example (adapt flags to the local harness):

     grok -p "$(cat <<'EOF'
     You are the brainstorm CYCLE-SCOPE ORCHESTRATOR for Exigo.
     Read and obey agents/brainstorm/LOOP.md entirely.
     RUN_ROOT=agents/brainstorm/runs/YYYY-MM-DD-CNNN
     CYCLE_ID=cycle-NNN
     PROBLEM_STATEMENT={…}
     INHERITED_CONSTRAINTS={from archive/constraints.jsonl, decay_score >= 0.3,
                            plus [soft]-tagged constraints from prior cycle's S-002-constraints.md}
     CYCLE_TYPE=scout   # or "deep" — scout is default; deep requires explicit launcher opt-in
     STOP_CONDITION={goal-anchored | novelty-decay-3-consecutive | max-cycles-N | max-tokens-M}
     HARD_BUDGET_TOKENS=380000    # enforced kill-switch; target spend 350k

     NO HUMAN IN THE LOOP. Do not pause for "should I continue?".
     Continue, ship the synthesis, or leave Stopped at + day-status.json if truly blocked
     (permissions, missing secrets, tool failure after >=3 retries, budget exhausted mid-phase).

     Use in-process subagents for waves α (N=10), β (M=5), γ (γ=2) as LOOP.md allows.
     After Wave β: run citation verification (mandatory, §6.3).
     After Wave γ: update archive/novelty.jsonl + archive/constraints.jsonl +
                   archive/cycles.json + archive/citations.jsonl (end-of-cycle only).
     Write progress to RECORD.md and $RUN_ROOT/day-status.json after every material step.

     If you stop before the cycle is closed, leave Stopped at + next action in RECORD.md
     so a cold launcher can re-wake you with the residual scope.
     EOF
     )" --cwd <repo> --output-format json --yolo

   - Background it so the launcher can poll artifacts only.
   - Keep the worker as a **peer process**, not a `spawn_subagent` of the launcher.

4. SUPERVISE WITHOUT STEALING CONTEXT
   - Poll process alive? + day-status.json + RECORD.md "Stopped at" — not the worker's
     full session JSONL.
   - If the worker exits or stalls before the cycle is closed, it is the **launcher's
     responsibility** to wake it again with the residual scope (same RUN_ROOT, residual
     phase from day-status.json `phase` field).
   - Repeat spawn/wake until the cycle closes or the user cancels the loop.

5. BETWEEN CYCLES (active-curator role — HITL lives here, not inside a cycle)
   - Read synthesis/S-001-claims.md + S-002-constraints.md + research/R-*.md dossiers for
     ADVANCE-verdicted ideas.
   - Decide which ADVANCE ideas to pursue (the loop's verdict is a *recommendation*, not
     a decision). The launcher may pursue an idea (out-of-scope for this loop — typically
     via cd-review or a code change), defer it, or drop it.
   - Then either trigger the next cycle (new RUN_ROOT, new cycle-scope.md, re-spawn) or
     close the loop (write cycles.json.session_stop_reason).
```

### 0.5.3 Cycle-scope agent rules

- **No human in the loop.** Do not pause for "should I continue?" — continue, ship the synthesis, or leave a precise `Stopped at` + `day-status.json` if truly blocked (permissions, missing secrets, tool failure after ≥3 retries, budget exhausted mid-phase per the 380k kill-switch).
- **Orchestrate at this level:** dispatch Wave α/β/γ via in-process subagents (or sequential work if the harness forbids children); consolidate; judge; verify citations; update archives; write RECORD + day-status.
- **Scope size:** one spawn = one cycle (α→β→γ). Default scout cycle = 350k tokens. Deep cycle = ~727k tokens spread across 2 spawns via mid-cycle checkpointing (§8.2). Do not under-scope into tiny one-idea cycles unless residual is tiny.
- **Artifacts are truth:** always keep `RECORD.md` + `day-status.json` current so a cold launcher can re-wake you correctly.
- **The agent's job to converge properly:** do not abandon a cycle half-judged. If the kill-switch fires mid-β, the orchestrator writes `Stopped at` for each un-verdicted idea and exits cleanly. Do not ask the human to "review the shortlist later."
- **Never fabricate tool results.** A subagent that returns a dossier citing URLs that were never fetched is treated as garbage output (§6.4); the dossier is discarded and a replacement subagent is dispatched.

### 0.5.4 Progress file (launcher-readable)

`$RUN_ROOT/day-status.json`:

```json
{
  "state": "running|brainstorming|researching|synthesizing|blocked|complete",
  "cycle_id": "cycle-007",
  "cycle_type": "scout|deep",
  "phase": "alpha|alpha_consolidating|beta|beta_consolidating|citation_verify|gamma|archive_update|done",
  "last_checkpoint": "B-007 written by Dreamer/s2",
  "shortlist_size": null,
  "verdicts_pending": 0,
  "next_cycle_constraints_extracted": false,
  "tokens_used": 0,
  "tokens_budget": 380000,
  "tokens_target": 350000,
  "alladvance_redispatch_fired": false,
  "blocked_reason": null,
  "updated_at": "ISO-8601"
}
```

State semantics:

| state | meaning | next valid transitions |
|---|---|---|
| `running` | orchestrator spawned, scaffolding | → `brainstorming` |
| `brainstorming` | Wave α in progress | → `researching` (α consolidated, shortlist written) |
| `researching` | Wave β in progress | → `synthesizing` (β consolidated + citation-verify done) |
| `synthesizing` | Wave γ + archive update in progress | → `complete` |
| `blocked` | orchestrator stopped early (budget / tool failure / permissions) | → `running` (launcher re-wake with residual) |
| `complete` | cycle closed cleanly; synthesis docs + archives written | → terminal (launcher starts next cycle or closes loop) |

---

## 1. Starting a new cycle

When the user says **start**, **new cycle**, **new run**, or **continue on a new date**:

### 1.1 Resolve or create the cycle directory

```bash
DATE=$(date +%Y-%m-%d)        # or use the date the user gives
# Cycle counter: read agents/brainstorm/archive/cycles.json, increment the highest cycle NNN.
NEXT_CYCLE=$(($(jq '.cycles | map(.cycle_num // 0) | max' agents/brainstorm/archive/cycles.json) + 1))
CYCLE_ID="cycle-$(printf '%03d' "$NEXT_CYCLE")"
RUN_ROOT="agents/brainstorm/runs/${DATE}-${CYCLE_ID}"
mkdir -p "$RUN_ROOT/brainstorm" "$RUN_ROOT/research" "$RUN_ROOT/synthesis" \
         "$RUN_ROOT/citations" "$RUN_ROOT/checkpoints"
```

### 1.2 Scaffold `RECORD.md`

Create `$RUN_ROOT/RECORD.md` from the template in §8 (status: `in_progress`, empty waves).

### 1.3 Scaffold `cycle-scope.md`

Launcher writes `$RUN_ROOT/cycle-scope.md` containing: goal, problem statement, inherited constraints (from `archive/constraints.jsonl` filtered to `decay_score ≥ 0.3` plus `[soft]`-tagged from prior `S-002-constraints.md`), stop conditions, cycle type (scout | deep), hard budget.

### 1.4 Scaffold `persona-seed-matrix.md`

Orchestrator writes the persona × seed matrix for this cycle to `$RUN_ROOT/persona-seed-matrix.md` BEFORE Wave α dispatches. Each of the 10 subagents gets a disjoint (persona, seed) tuple (see §5.1). This is checkpoint material for mid-wave resume.

### 1.5 Do **not** delete prior cycle folders

Prior `runs/YYYY-MM-DD-CNNN/` folders are history. Only create new ones. Optionally note "continues from cycle-NNN" in the new RECORD.

### 1.6 Set active run path

All agent briefs must use:

```text
RUN_ROOT=agents/brainstorm/runs/YYYY-MM-DD-CNNN
```

Never write cycle artifacts under `archive/` mid-cycle, at repo root, or under `loops/`.

---

## 2. North-star and non-goals

### North-star (ordered)

| # | Criterion |
|---|-----------|
| 1 | **Novelty** — the loop produces ideas the team has not already considered |
| 2 | **Verifiability** — every advanced idea has external grounding (citations, PoC, derivation), not pure LLM reasoning |
| 3 | **Diversity** — shortlist reflects distinct approaches, not mode collapse |
| 4 | **Honesty** — `REFUTE` and `INCONCLUSIVE` are first-class verdicts; sycophantic rubber-stamping is the worst failure mode |
| 5 | **Cumulative progress** — the cross-cycle archives (novelty, constraints) grow; each cycle inherits the prior's lessons |

### Non-goals

- **Implementation.** The loop produces verified ideas + constraints, not code. "Pursue this idea" is a launcher-side decision, typically handed off to `agents/cd-review/` or a human developer.
- **Multi-agent debate.** Per the literature (Smit ICML 2024; "How Sycophancy Shapes Multi-Agent Debate" Sep 2025; "Cost of Consensus" ACM 2026), debate topologies degrade performance via premature consensus. Adversarial pressure is provided structurally via the Skeptic persona, the all-advance DA re-dispatch (§6.3), and the mandated falsification step inside each research subagent (§6.1) — not via inter-agent debate.
- **Re-litigation.** Wave β does not re-open the brainstorm phase (it only verdicts shortlisted ideas). Wave γ does not re-open research verdicts. The all-advance DA re-dispatch is the only exception, and it is capped at one per cycle.
- **Nested reasoning agents.** Wave α/β/γ subagents are leaf workers. They may invoke `tool_calls` (web_search, repo read, code PoC runner) but never spawn a nested LLM-reasoning subagent.
- **A second model.** Single-model shop (Exigo is grok-only). Anti-sycophancy is structural (different persona + different rubric + different temperature for the Judge vs workers), not model-based.
- **Infinite loops.** The outer loop has three layered stop conditions (§8.5). Infinite-loop failure is impossible by construction (verified against arXiv:2607.01641 IAL-Scan finding of 68 infinite-loop failures across 47 of 6,549 LLM agent repos).

---

## 3. Architecture (strict wave separation)

**Brainstorm subagents do not verify. Research subagents do not brainstorm. Synthesis subagents do not verify or brainstorm.** The orchestrator (cycle-scope agent) is the only layer that judges, consolidates, and writes synthesis docs.

```text
┌─────────────────────────────────────────────────────────────────┐
│  L-1  LAUNCHER (user-triggered session)                         │
│  latest run · cycle scope · spawn/wake CLI cycle agent          │
│  thin polls only (RECORD + day-status) — not worker transcript  │
│  between cycles: read synthesis docs, decide which ideas        │
│  to pursue                                                       │
└────────────────────────────┬────────────────────────────────────┘
                             │ grok CLI / harness (separate process)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  L0  CYCLE-SCOPE ORCHESTRATOR (no human in the loop)            │
│  create/select RUN_ROOT · read inherited constraints + novelty  │
│  archive · dispatch waves · judge · verify citations ·          │
│  update archives · write RECORD + day-status                    │
└────────────────────────────┬────────────────────────────────────┘
                             │ subagents (in-process, context-isolated)
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
   WAVE α — BRAINSTORM   WAVE β — RESEARCH   WAVE γ — SYNTHESIS
   (N=10 parallel)        (M=5 parallel)      (γ=2 sequential)
   5 personas × 2 seeds   one idea per worker γ-1 claims extractor
   divergent ideation     Toulmin dossier      γ-2 constraint writer
   write brainstorm/*     write research/*     write synthesis/*
   NO children            external tools only  NO children
   NO cross-talk          NO children          reads γ-1's output
   NO critique            mandated falsifier   writes next-cycle
                                              constraints
```

| Wave | Agent role | Reads | Writes | Spawns children? |
|------|------------|-------|--------|------------------|
| **α** | Brainstorm (divergent) | problem brief, inherited constraints, novelty archive hashes | `$RUN_ROOT/brainstorm/B-{NNN}-{persona}-{seed}.md` | **No** |
| **β** | Research / Verify (convergent) | one shortlisted idea, novelty archive entry | `$RUN_ROOT/research/R-{NNN}-{idea_id}.md` (+ optionally `R-006-{idea_id}.md` for DA re-dispatch) | **No** (research tools OK) |
| **γ** | Synthesis (reduce) | all dossiers + `_summary.md` + prior constraints | `$RUN_ROOT/synthesis/S-001-claims.md` + `S-002-constraints.md` | **No** |

**L0 (cycle-scope)** is the only layer that decides sequencing, judges, verifies citations, and updates the cross-cycle archives. **L-1 (launcher)** only scopes work, keeps the cycle agent alive, and curates results between cycles.

---

## 4. Problem-brief format

Unlike cd-review (which slices the codebase), the brainstorming loop has no fixed slice map. Each cycle starts with a **problem brief** written by the launcher into `$RUN_ROOT/cycle-scope.md`.

A good problem brief has:

- **One-sentence problem statement** (what is being brainstormed?)
- **Context** (3-5 sentences: why now, what's known, what's been tried)
- **Constraints inherited from prior cycles** (tagged list, see §7.5)
- **Stop condition** (when does the loop close? See §8.5)
- **Out of scope** (what NOT to brainstorm — e.g., "do not propose ideas that require a second LLM provider")
- **Success shape** (what does a good output look like? e.g., "3 ideas worth implementing with verified external grounding")

The orchestrator copies the problem brief verbatim into every Wave α subagent's prompt. Wave β subagents receive the shortlisted idea's full text (from the idea-doc) plus the problem brief for context.

---

## 5. Wave α — Brainstorm (findings only, no critique)

### 5.1 Persona × seed matrix (structural diversity pressure)

Every Wave α subagent is dispatched with a **disjoint (persona, seed) tuple**. No two subagents share persona+seed. The 5 personas (verified set, see `_meta-session/phase-2-brainstorm/3-B-brainstorm-wave-protocol.md`):

| # | Persona | Technique | Disagreement mandate | Must NOT do |
|---|---------|-----------|----------------------|-------------|
| 1 | **Dreamer** | Disney Dreamer + de Bono PO + Oblique Strategies | "Generate ideas without feasibility filtering. Wild ideas welcome. Do not self-censor." | Critique, feasibility-check, research, cite sources |
| 2 | **Skeptic** | Devil's Advocate + Six Hats Black + Pre-mortem | "Find the riskiest assumption in each idea. If you can't find one, the idea is too vague — discard it." | Generate purely positive ideas, rubber-stamp |
| 3 | **Engineer** | Disney Realist + SCAMPER + Attribute listing | "Adapt existing exigo patterns. Cite the file you'd modify." | Wild ideas with no implementation hook |
| 4 | **Outsider** | Six Hats (White+Green) + Random Entry + Constraint bombing | "Approach from a domain unrelated to exigo (e.g., biology, urban planning). Spell out the analogy." | Default to software-engineering framings |
| 5 | **Cross-Domain Synthesizer** | TRIZ + ordinary-domain analogy | "Combine two ideas from different domains into one. The combination is the deliverable, not the two ideas separately." | List ideas without synthesizing |

Per Deng, Brucks & Toubia 2026 (verified by `_meta-session/phase-1-research/2-A-claim-verification.md`), **ordinary** personas outperform celebrity personas. Use role labels, not "you are Linus Torvalds".

**Seed strategy:** Each persona runs twice per cycle, with two different seeds:
- **Seed s1** = the original problem statement, lightly reframed ("How might we…?")
- **Seed s2** = rotated across a 5-cycle schedule:
  - Cycle 1 mod 5: oblique-strategy injection (random creative prompt from Brian Eno's deck)
  - Cycle 2 mod 5: opposite-goal reframe ("how might we make this worse?" → invert)
  - Cycle 3 mod 5: analogy-from-distant-domain ("how does a forest ecosystem solve this?")
  - Cycle 4 mod 5: constraint removal ("if compute were free, what would change?")
  - Cycle 5 mod 5: time-shift ("how would this be solved in 2030? in 1995?")

If s2 output collapses onto s1 mode (cosine similarity > 0.85), the orchestrator flags the persona as `collapsed` in `$RUN_ROOT/persona-seed-matrix.md` for future prompt-tuning.

### 5.2 Subagent brief (template)

```text
You are a WAVE α BRAINSTORM subagent for the exigo brainstorming loop.
RUN_ROOT={RUN_ROOT}
CYCLE_ID={CYCLE_ID}
SUBAGENT_ID={SUBAGENT_ID}            # e.g. B-007
PERSONA={PERSONA}                    # dreamer | skeptic | engineer | outsider | synthesizer
SEED={SEED}                          # s1 | s2

PROBLEM_BRIEF:
{PROBLEM_BRIEF}                      # full text from cycle-scope.md

INHERITED_CONSTRAINTS (constraints from prior cycles; respect them; you may mutate
                       ideas that respect them, but do not violate them):
{PRIOR_CONSTRAINTS}                  # filtered to decay_score >= 0.3,
                                     # plus [soft]-tagged from prior S-002-constraints.md

SEED REFRAME (only for s2):
{SEED_REFRAME_TEXT}                  # the oblique-strategy / opposite-goal / analogy / etc.

NOVELTY ARCHIVE HASHES (skip any idea whose warrant matches one of these;
                        mutated variants are welcome — mark `parent_idea`):
{NOVELTY_ARCHIVE_HASHES}             # sha256 of warrant field, last 200 entries

YOUR PERSONA MANDATE:
{PERSONA_MANDATE}                    # the row from §5.1's table

TASK
Generate 3-7 ideas that match your persona's mandate and respect the inherited
constraints. Quantity over quality at this stage — but every idea must have a
specific warrant (a one-sentence reason this idea is plausible).

OUTPUT — write your idea-doc to EXACTLY this path and no other:
{RUN_ROOT}/brainstorm/B-{NNN}-{PERSONA}-{SEED}.md

OUTPUT FORMAT (markdown, ≤ 600 words total):
# B-{NNN} — {PERSONA} / {SEED}

## Subagent meta
- cycle_id: {CYCLE_ID}
- subagent_id: B-{NNN}
- persona: {PERSONA}
- seed: {SEED}
- started_at: ISO-8601
- completed_at: ISO-8601

## Problem echoed
(one sentence)

## Inherited constraints echoed
(bulleted list)

## Ideas

### I-{CYCLE_NUM}-{NNN}: {idea title}
- Description: (one paragraph, ≤ 100 words)
- Why it's novel: (one sentence — what about this is not in the novelty archive)
- Riskiest assumption: (one sentence — the assumption that, if false, kills the idea)
- Warrant: (one sentence — the reason this idea is plausible)
- Parent idea (if mutated): I-{prior_cycle}-{NNN} | (none if original)

(repeat for 3-7 ideas)

## Self-report
- Ideas generated: N
- Ideas skipped as duplicate of novelty archive: M
- Mutations of prior-cycle ideas: K
- Constraint violations caught and corrected: L

RULES
- Do NOT critique, verify, or research any idea (that is Wave β's job).
- Do NOT spawn children.
- Do NOT read other subagents' outputs (anchoring prevention).
- Do NOT write to any path other than the one specified above.
- Do NOT edit the novelty archive or any other cycle artifact.
- Hard kill-switch: stop generating if you exceed 4,000 output tokens.
```

### 5.3 Output file format

See §5.2's OUTPUT FORMAT block. Each idea has a unique `I-{CYCLE_NUM}-{NNN}` id (cycle number is the zero-padded cycle index, e.g. `I-007-003` is idea 3 of cycle 7).

### 5.4 Orchestrator consolidation (the Judge role, non-parallel)

After all 10 Wave α subagents complete, the orchestrator:

1. **Schema-validate** each `B-*.md` — required fields present (meta, problem echoed, ≥3 ideas each with all required subfields, self-report). Reject incomplete idea-docs.
2. **Extract all ideas** into a flat list with their `idea_id`, `persona`, `seed`, `description`, `warrant`, `riskiest_assumption`, `parent_idea`.
3. **Cluster** ideas by semantic similarity. Use embedding cosine similarity with threshold ≥ 0.85; merge clusters into a single representative idea (keep the one with the most specific warrant).
4. **Dedup against `archive/novelty.jsonl`** — for each idea, compute its warrant hash and embedding; if it matches an existing archive entry with status `advance` or `refute`, mark as `deferred` (prior cycle already saw it). If it matches `inconclusive`, the new idea is eligible (the prior cycle didn't reject it). If it matches `deferred`, the new idea is eligible (prior cycle didn't shortlist it, but a mutation might be worth shortlisting).
5. **Shortlist K=5** ideas by scoring on 4 axes (0-1 each):
   - **Novelty** (1 − max cosine similarity to novelty archive)
   - **Diversity** (1 − max cosine similarity to other shortlist candidates)
   - **Specificity** (does the warrant cite a concrete mechanism, file, or calculation?)
   - **Actionability** (can a Wave β research subagent actually verify this in 30k tokens?)
   Score = 0.4·novelty + 0.3·diversity + 0.2·specificity + 0.1·actionability. Pick top 5.
6. **Write** the shortlist to `$RUN_ROOT/persona-seed-matrix.md` (updated with shortlist verdicts) and to `$RUN_ROOT/RECORD.md` (Shortlist/verdicts table).
7. **Mode-collapse detector:** if the shortlist has > 50% semantic overlap (cosine ≥ 0.70 vs shortlist centroid) with the prior cycle's shortlist, force a refresh cycle next time (rotate in a specialist persona — Security Auditor / ML Researcher / Product Manager / Domain Historian — in place of Cross-Domain Synthesizer). 3 consecutive mode-collapse flags → outer loop terminates (§8.5 F.2).

The orchestrator must NOT inject its own ideas — only cluster and select. Anti-anchoring is structural.

### 5.5 Failure modes (handlers)

| Failure | Handler |
|---------|---------|
| Subagent returns garbage / missing fields | Schema-validation rejects; subagent blacklisted for cycle; orchestrator logs in RECORD.md; if > 2 subagents reject, cycle aborts with `state=blocked, blocked_reason="alpha_quality_failure"` |
| Subagent anchors on parent brief | Seed-2 reframe rotation (§5.1) |
| All 10 subagents produce the same idea | Mode-collapse detector triggers refresh cycle next time |
| Subagent refuses to brainstorm (safety refusal) | Orchestrator logs refusal; falls back to Engineer persona with a tighter scope; if 3+ refusals, cycle aborts with `blocked_reason="alpha_persona_refusals"` |
| Subagent runs over budget | Hard kill-switch on token count (4k output tokens); partial output preserved if valid schema |
| Idea-doc duplicates prior-cycle idea | Dedup-against-archive marks `deferred`; not in shortlist; logged in RECORD.md |

### 5.6 What this wave does NOT do

- Brainstorm subagents do NOT research, verify, or critique ideas.
- Brainstorm subagents do NOT spawn children.
- Brainstorm subagents do NOT edit any file outside `{RUN_ROOT}/brainstorm/B-{NNN}-*.md`.
- Brainstorm subagents do NOT read other subagents' outputs (anchoring prevention).
- The orchestrator (consolidation step) is NOT itself a brainstorm subagent — it only clusters and selects.

---

## 6. Wave β — Research / Verify (Toulmin dossier + 3-state verdict)

Wave β is the convergence half. After Wave α's shortlist is written, the orchestrator dispatches **M=5 parallel research subagents**, one per shortlisted idea. Each subagent produces a Toulmin-shaped dossier with a 3-state verdict: `ADVANCE` / `REFUTE` / `INCONCLUSIVE`.

### 6.1 Research subagent brief (template)

```text
You are a WAVE β RESEARCH / VERIFY subagent for the exigo brainstorming loop.
RUN_ROOT={RUN_ROOT}
CYCLE_ID={CYCLE_ID}
SUBAGENT_ID={SUBAGENT_ID}            # e.g. R-003
IDEA_ID={IDEA_ID}                    # the shortlisted idea's id, e.g. I-007-003

IDEA_TITLE: {IDEA_TITLE}
IDEA_DESCRIPTION: {IDEA_DESCRIPTION}
IDEA_RISKIEST_ASSUMPTION: {IDEA_RISKIEST_ASSUMPTION}
IDEA_WARRANT: {IDEA_WARRANT}

NOVELTY ARCHIVE ENTRY (this idea's record from archive/novelty.jsonl — includes
                       prior-cycle verdicts if any):
{NOVELTY_ARCHIVE_ENTRY}

YOUR ROLE: You are NOT a brainstormer; you are NOT a sycophant. You are a
ReAct+CoVe research subagent whose job is to VERIFY idea {IDEA_ID} against
external grounding. Your output is a Toulmin dossier + a 3-state verdict.

TASK — execute the following 7 steps IN ORDER:

1. STEELMAN (mandatory, before any critique). Write the strongest possible
   version of the idea — the version a smart supporter would defend. 1 paragraph.

2. TOULMIN DECOMPOSE. Break the steelman into:
   - Claim (one sentence — what the idea asserts)
   - Grounds (the evidence that would support the claim)
   - Warrant (why the grounds support the claim)
   - Backing (deeper theoretical / empirical foundation)
   - Qualifier (under what conditions the claim holds)
   - Rebuttal (conditions under which the claim fails)

3. FALSIFICATION PLAN. Following Popper: identify the strongest possible
   falsifier. "If X is true, this idea is wrong." Write the falsifier as a
   testable prediction.

4. EXTERNAL GROUNDING (use tools). Use web_search, repo read (grep the exigo
   codebase), or code PoC execution to gather evidence. Every claim in your
   grounds MUST cite a URL (live-fetched) or a file:line in the exigo repo.
   Pure-LLM reasoning is insufficient.

5. POSITION-SWAP. Write two readings of the evidence:
   (a) The supporter's reading — "this evidence confirms the idea because…"
   (b) The detractor's reading — "this evidence refutes the idea because…"
   Then reconcile: which reading is better supported by the evidence actually
   fetched (not by the LLM's prior)?

6. VERDICT. Pick exactly one:
   - ADVANCE — the idea is verified enough to pursue; constraints for the next
     cycle should build on it
   - REFUTE — the falsifier was demonstrated, or the warrant is unsupported
     by external grounding; constraints for the next cycle should avoid the
     failed assumption
   - INCONCLUSIVE — evidence is mixed or unavailable; constraints for the
     next cycle should re-attempt with a specific falsifier or tool

   Confidence: 0.0-1.0 (calibrated; if you are not sure, default to
   INCONCLUSIVE not ADVANCE — REFUTE costs nothing if wrong, ADVANCE costs
   a lot if wrong).

7. CONSTRAINT FOR NEXT CYCLE. Write one imperative sentence that the next
   cycle's brainstorm subagents should respect / avoid / test, based on your
   verdict.

OUTPUT — write your dossier to EXACTLY this path and no other:
{RUN_ROOT}/research/R-{NNN}-{IDEA_ID}.md

OUTPUT FORMAT (markdown, ≤ 800 words total):
# R-{NNN} — {IDEA_ID}

## Subagent meta
- cycle_id, subagent_id, idea_id, started_at, completed_at

## Idea echoed
(title, description, riskiest assumption, warrant)

## Steelman (1 paragraph)

## Toulmin decomposition
- Claim:
- Grounds: (with citations — each citation is a URL or file:line)
- Warrant:
- Backing:
- Qualifier:
- Rebuttal:

## Falsification attempt
- Falsifier proposed:
- Falsifier tested via: (tool used, query, result)
- Outcome: (confirmed falsifier / refuted falsifier / could not test)

## Position-swap reconciliation
- Supporter reading: (1 paragraph)
- Detractor reading: (1 paragraph)
- Reconciliation: (1 paragraph — which won and why)

## Verdict
- Verdict: ADVANCE | REFUTE | INCONCLUSIVE
- Confidence: 0.0-1.0
- Justification: (2-3 sentences)

## Constraint for next cycle
- Constraint text: (one imperative sentence)
- Constraint type: MUST_RESPECT | MUST_AVOID | MUST_TEST
- Source idea: {IDEA_ID}

## Citations
- [1] URL: … | live_status: 200|404|timeout | snippet: … | supports_claim: yes|no
- [2] file:line: … | snippet: …

RULES
- Do NOT brainstorm new ideas.
- Do NOT spawn children.
- Do NOT read other subagents' dossiers.
- Do NOT write to any path other than the one specified above.
- Do NOT use LLM-only reasoning for grounds — every claim needs a URL or file:line.
- Do NOT cite a URL you did not actually fetch (this is a firing offense — §6.4).
- Hard kill-switch: stop if you exceed 8,000 output tokens.
- Tool-failure retry: up to 3 retries with exponential backoff (5s / 30s / 120s).
  After 3 failures, mark dossier INCONCLUSIVE with reason="tool_failure_no_external_grounding".
```

### 6.2 Dossier output format

See §6.1's OUTPUT FORMAT block. The dossier's `Verdict` field is one of `ADVANCE` / `REFUTE` / `INCONCLUSIVE` (uppercase, 3-state). This vocabulary is canonical across the loop.

### 6.3 Orchestrator consolidation (the Judge role, non-parallel)

After all 5 Wave β subagents complete, the orchestrator:

1. **Schema-validate** each `R-*.md` — required fields present, every citation has a URL or file:line, every URL has a live_status.
2. **Run citation verification pipeline** (see §6.4 — mandatory, gap G4 fix).
3. **Tally verdicts** into `$RUN_ROOT/research/_summary.md`:
   - `advance_count`, `refute_count`, `inconclusive_count`
   - Per-idea: idea_id, verdict, confidence (post-citation-cap), constraint_text, constraint_type
   - Aggregate: shortlist convergence rate, average confidence
4. **All-advance circuit-breaker** (1-E's "all-advance is suspicious" rule, capped per gap G12):
   - If `advance_count / shortlist_size > 0.7` (i.e., 4 of 5 advanced) AND all advance confidences > 0.7: fire ONE DA re-dispatch on the lowest-confidence ADVANCE idea.
   - The DA re-dispatch is a fresh Wave β subagent with the same idea, a tightened disagreement mandate ("Your job is to find the falsifier the original subagent missed"), output path `$RUN_ROOT/research/R-006-{IDEA_ID}.md`.
   - If the DA overturns: idea demoted to INCONCLUSIVE, `_summary.md` updated, original dossier kept for audit.
   - If the DA upholds: idea stays ADVANCE, dossier flagged `re-dispatched_and_upheld`, confidence reduced by 0.1 (audit trail).
   - Capped at ONE re-dispatch per cycle. Not one per advanced idea.
5. **Update** `$RUN_ROOT/RECORD.md` (Shortlist/verdicts table) and `day-status.json` (`verdicts_pending=0`, `phase=beta_consolidating` → `citation_verify`).

### 6.4 Citation verification pipeline (gap G4 fix — anti-hallucinated-citation)

This step runs **after** all 5 Wave β subagents complete and **BEFORE** Wave γ dispatches. The order is: β → citation-verify → γ (canonical; do not invert).

For every URL in every dossier's `grounds` and `citations` fields:

1. **Check cache** — read `archive/citations.jsonl` (cross-cycle cache, 7-day TTL). If URL hash matches a fresh entry, reuse the verdict.
2. **Live-fetch** — HTTP HEAD request, 10s timeout. Non-200 / timeout → mark UNVERIFIED. If the dossier's verdict is ADVANCE, cap its confidence to 0.5.
3. **For 200 responses** — fetch body text (first 5,000 chars), embed it, compute cosine similarity against the claim being cited. If cosine < 0.6, mark URL as `content_mismatch` (the cited source doesn't actually support the claim).
4. **URL-text mismatch detection** — if the citation's stated author/title differs from the fetched page's `<title>` and `<meta name="author">`, mark as `mismatch`.
5. **Write per-cycle results** to `$RUN_ROOT/citations/verified.jsonl` (URL matched claim) and `refuted.jsonl` (mismatch / 404 / timeout). These are merged into `archive/citations.jsonl` at end-of-cycle archive-update (NOT mid-cycle).
6. **Subagent blacklist** — if 2+ citations from the same Wave β subagent in one cycle are flagged `content_mismatch` or `mismatch`, the subagent is blacklisted for the cycle and the dossier is marked INCONCLUSIVE with `reason="hallucinated_citations"`.

Citation verify budget: ~15k tokens (URL re-fetches + embedding comparison + LLM-based mismatch detection).

### 6.5 What this wave does NOT do

- Research subagents do NOT brainstorm new ideas.
- Research subagents do NOT spawn children.
- Research subagents do NOT edit any file outside `{RUN_ROOT}/research/R-{NNN}-*.md`.
- Research subagents do NOT read other subagents' dossiers (anchoring prevention).
- Research subagents do NOT use LLM-only reasoning for grounds — every claim needs external grounding.
- The orchestrator (consolidation step) is NOT itself a research subagent — it only validates, verifies citations, and tallies.

---

## 7. Wave γ — Synthesis (claims extraction + constraint writing)

Wave γ is small on purpose — synthesis is inherently a sequential reduce, not a parallel fan-out. **γ=2 subagents run sequentially** (γ-2 reads γ-1's output).

### 7.1 γ-1 brief (claims extractor)

```text
You are γ-1, the CLAIMS EXTRACTOR subagent for the exigo brainstorming loop.
RUN_ROOT={RUN_ROOT}
CYCLE_ID={CYCLE_ID}

INPUTS — read EXACTLY these 6 files (do not glob, do not read R-006 even if it exists):
- {RUN_ROOT}/research/R-001-I-001.md
- {RUN_ROOT}/research/R-002-I-002.md
- {RUN_ROOT}/research/R-003-I-003.md
- {RUN_ROOT}/research/R-004-I-004.md
- {RUN_ROOT}/research/R-005-I-005.md
- {RUN_ROOT}/research/_summary.md

TASK
Extract every claim (verified, refuted, inconclusive) from the 5 dossiers and group
them by theme. The output is the cycle's claims ledger — what the loop learned this
cycle, organized so a human or a future cycle can scan it quickly.

OUTPUT — write to EXACTLY this path:
{RUN_ROOT}/synthesis/S-001-claims.md

OUTPUT FORMAT (markdown, ≤ 700 words):
# S-001 — Cycle {CYCLE_ID} Claims Ledger

## Verified claims (from ADVANCE dossiers, post-citation-verify)
### Theme A: {theme name}
- Claim: …  Source: I-{NNN}, R-{NNN}  Confidence: 0.XX
- Claim: …  Source: I-{NNN}, R-{NNN}  Confidence: 0.XX

## Refuted claims (from REFUTE dossiers)
### Theme B: {theme name}
- Refuted claim: …  Source: I-{NNN}, R-{NNN}  Falsifier: …

## Inconclusive claims (from INCONCLUSIVE dossiers)
### Theme C: {theme name}
- Inconclusive claim: …  Source: I-{NNN}, R-{NNN}  Missing evidence: …

## Cross-cutting observations
- (patterns that span multiple ideas; e.g., "3 of 5 ideas depended on assumption X,
  which R-002 refuted — X is a load-bearing assumption for this problem space")

RULES
- Do NOT verify claims yourself (already done in Wave β + citation verify).
- Do NOT generate new ideas (that is Wave α's job next cycle).
- Do NOT spawn children.
- Do NOT read R-006 (DA re-dispatch) directly — its effect is already in _summary.md.
- Hard kill-switch: stop if you exceed 3,000 output tokens.
```

### 7.2 γ-2 brief (constraint writer)

```text
You are γ-2, the CONSTRAINT WRITER subagent for the exigo brainstorming loop.
RUN_ROOT={RUN_ROOT}
CYCLE_ID={CYCLE_ID}

INPUTS — read EXACTLY these files:
- {RUN_ROOT}/synthesis/S-001-claims.md   (γ-1's output — your primary input)
- {RUN_ROOT}/research/_summary.md         (per-idea verdicts + constraints)
- archive/constraints.jsonl               (filtered to decay_score >= 0.1 — all
                                           non-archived constraints; you'll write
                                           back to this file via the orchestrator)

TASK — Delphi + Stepladder translation: convert the cycle's verdicts into
imperative constraints for the next cycle's brainstorm.

For each verdict:
- ADVANCE  → MUST_RESPECT constraint ("Build on idea X's approach for…")
- REFUTE   → MUST_AVOID constraint ("Do not depend on assumption Y, which R-NNN falsified by…")
- INCONCLUSIVE → MUST_TEST constraint ("Re-attempt idea Z with falsifier W or tool T")

Also: update decay scores for prior constraints. A constraint that was applied
this cycle (an idea was rejected for violating it) keeps decay_score = 1.0.
A constraint that was NOT applied decays by 0.15. At decay_score < 0.3, mark
[soft]. At decay_score < 0.1, mark [archived].

OUTPUT — write to EXACTLY this path:
{RUN_ROOT}/synthesis/S-002-constraints.md

OUTPUT FORMAT (markdown, ≤ 600 words):
# S-002 — Cycle {CYCLE_ID} Constraints for Next Cycle

## New constraints (created this cycle)
### C-{CYCLE_NUM}-001: {constraint text}
- Type: MUST_RESPECT | MUST_AVOID | MUST_TEST
- Source idea: I-{NNN}
- Source verdict: ADVANCE | REFUTE | INCONCLUSIVE
- Rationale: (1-2 sentences linking to dossier evidence)

(repeat for each new constraint)

## Constraints passed to next cycle's Wave α
(Only constraints with decay_score >= 0.3, plus [soft]-tagged constraints
 marked below. Archived constraints are NOT passed.)

| Constraint ID | Text (1 sentence) | Type | Decay score | Tag |
|---|---|---|---|---|
| C-{NNN}-NNN | … | MUST_AVOID | 1.00 | — |
| C-{NNN}-NNN | … | MUST_TEST | 0.45 | [soft] |

## Constraints decayed this cycle
- C-{NNN}-NNN: 1.00 → 0.85 (not applied)
- C-{NNN}-NNN: 0.40 → 0.25 → [soft]

## Constraints archived this cycle
- C-{NNN}-NNN: 0.15 → 0.05 → [archived]

RULES
- Do NOT verify (already done).
- Do NOT brainstorm (that is next cycle's Wave α job).
- Do NOT spawn children.
- Hard kill-switch: stop if you exceed 3,000 output tokens.
```

### 7.3 Orchestrator end-of-cycle archive update

After γ-2 writes `S-002-constraints.md`, the orchestrator performs the **end-of-cycle archive update** (the ONLY step that writes to `archive/`):

1. **`archive/novelty.jsonl`** — append one line per idea produced this cycle (all 10 from Wave α, not just the shortlist). Each line:
   ```json
   {"idea_id":"I-007-003","cycle_id":"cycle-007","persona":"dreamer","seed":"s2","idea_text":"…","warrant":"…","warrant_hash":"sha256:…","embedding":[0.0123,…],"verdict":"ADVANCE","confidence":0.78,"status":"advance","deferred":false,"updated_at":"…"}
   ```
   `status` ∈ `{advance, refute, inconclusive, deferred}` (lowercase, 4-state). `deferred` is for non-shortlisted ideas (preserved for future mutation). Verdict comes from the dossier for shortlisted ideas; `null` for non-shortlisted.

2. **`archive/constraints.jsonl`** — append new constraints from `S-002-constraints.md`; update decay_score for existing constraints per γ-2's output.

3. **`archive/cycles.json`** — append a new entry to `cycles[]`:
   ```json
   {"id":"cycle-007","cycle_num":7,"started_at":"…","ended_at":"…","run_root":"runs/2026-07-25-C007","cycle_type":"scout","idea_count":10,"shortlist_count":5,"advance_count":2,"refute_count":2,"inconclusive_count":1,"tokens_used":348211,"status":"complete","stop_reason":"goal-anchored-met"}
   ```

4. **`archive/citations.jsonl`** — merge per-cycle `citations/verified.jsonl` + `refuted.jsonl` into the cross-cycle cache (with 7-day TTL on entries).

5. **Update** `$RUN_ROOT/RECORD.md` (Done, Stopped at, Residual) and `$RUN_ROOT/day-status.json` (`state=complete` or `state=blocked`).

### 7.4 Constraint format (the bridge to the next cycle)

Constraints are the load-bearing feedback mechanism. Each constraint has:
- **Constraint ID:** `C-{CYCLE_NUM}-{NNN}` (e.g., `C-007-003`)
- **Type:** `MUST_RESPECT` | `MUST_AVOID` | `MUST_TEST`
- **Source:** idea_id(s) that produced it
- **Text:** one-sentence imperative
- **Rationale:** 1-2 sentences linking to dossier evidence
- **Decay score:** 1.0 → 0.0; < 0.3 = `[soft]`; < 0.1 = `[archived]`
- **Tags:** thematic (e.g., `assumption-A`, `kill-derived`)

Example:
```
C-007-003 | MUST_AVOID | Source: I-007-014 | Text: "Do not propose ideas that depend
on Convex cron intervals below 1 minute." | Rationale: R-007-014 showed Convex Hobby
tier enforces >=1m cron; 3 cycle-007 ideas depending on 30s polling were all REFUTED.
| Decay: 1.00 | Tags: [convex, cron, hobby-tier]
```

### 7.5 What this wave does NOT do

- Synthesis subagents do NOT verify (already done in Wave β).
- Synthesis subagents do NOT brainstorm new ideas (that is Wave α's job next cycle).
- Synthesis subagents do NOT spawn children.
- γ-2 reads γ-1's output but does NOT re-open γ-1's claims (no re-litigation).
- The orchestrator (archive update) does NOT modify the cycle's `brainstorm/`, `research/`, or `synthesis/` artifacts — only appends to `archive/`.

---

## 8. Record track (`RECORD.md`)

Every cycle **must** maintain `$RUN_ROOT/RECORD.md`. The orchestrator updates it at:

- Cycle start
- End of each wave
- After each checkpoint-worthy transition (§8.2)
- After the all-advance DA re-dispatch
- After citation verify
- After archive updates
- Cycle pause / stop

### 8.1 Template

```markdown
# brainstorm RECORD — YYYY-MM-DD-CNNN

## Status
| Field | Value |
|-------|--------|
| **State** | in_progress | paused | complete | blocked |
| **Cycle ID** | cycle-NNN |
| **Cycle type** | scout | deep |
| **Last updated** | ISO timestamp |
| **Continues from** | (prior cycle-id or none) |
| **RUN_ROOT** | agents/brainstorm/runs/YYYY-MM-DD-CNNN |
| **Tokens used / target / kill-switch** | N / 350000 / 380000 |

## Goal this cycle
- Problem statement: …
- Inherited constraints: (count + tag list, e.g., "3 active, 1 soft, 0 archived")
- Stop condition (user-supplied at session start): …
- Cycle type rationale: (scout: default; deep: triggered by prior cycle's ≥2 advance ≥0.7)

## Waves
| Wave | Status | Notes |
|------|--------|-------|
| α Brainstorm | pending|done | N=10 subagents, 10 idea-docs, shortlist of 5 |
| β Research | pending|done | M=5 dossiers, X advance, Y refute, Z inconclusive |
| Citation verify | pending|done | X verified, Y refuted, Z subagents flagged |
| γ Synthesis | pending|done | S-001-claims.md, S-002-constraints.md |
| All-advance DA re-dispatch | not-fired|fired-once | (if fired: which idea, why) |
| Archive update | pending|done | novelty + constraints + cycles + citations |

## Shortlist / verdicts
| Idea-id | Persona | Seed | Verdict | Confidence (post-cap) | Next-cycle constraint |
|---------|---------|------|---------|------------------------|-----------------------|
| I-007-001 | Dreamer | s1 | ADVANCE | 0.78 | — |
| I-007-002 | Skeptic | s1 | REFUTE | — | "Avoid assumption A" → C-007-001 |
| I-007-003 | Engineer | s1 | ADVANCE | 0.71 | — |
| I-007-004 | Outsider | s2 | INCONCLUSIVE | — | "Re-attempt with falsifier B" → C-007-002 |
| I-007-005 | Synthesizer | s1 | ADVANCE | 0.69 | — |

## Done (chronological)
- 14:01 spawned cycle-scope orchestrator; cycle-scope.md written
- 14:08 Wave α dispatched (10 subagents in parallel)
- 14:14 Wave α completed; shortlist of 5 written to persona-seed-matrix.md
- 14:15 Wave β dispatched (5 subagents in parallel)
- 14:32 Wave β completed; verdicts consolidated
- 14:33 all-advance check: 3/5 advance (>70% threshold) → re-dispatch ONE DA on I-007-005 (lowest confidence)
- 14:41 DA re-dispatch completed; I-007-005 verdict reaffirmed as ADVANCE (0.61)
- 14:42 Citation verify: 22 verified, 3 refuted (all in R-002, I-007-002 dossier already REFUTE)
- 14:44 Wave γ dispatched (γ-1 then γ-2)
- 14:49 Wave γ completed; S-001-claims.md + S-002-constraints.md written
- 14:50 archive/novelty.jsonl + archive/constraints.jsonl + archive/cycles.json + archive/citations.jsonl updated
- 14:51 tokens_used=347,891 (under 350k target, under 380k kill-switch)
- 14:51 state=complete

## In flight
- (nothing — cycle closed cleanly)

## Stopped at
- (if state=complete: "cycle closed cleanly; launcher to read synthesis/S-001-claims.md
   + S-002-constraints.md and decide next cycle")
- (if state=blocked: exact next action, e.g., "Wave β incomplete; R-003 not yet dispatched;
   resume with one research subagent on idea I-007-003, assumption A12, REACT_BUDGET=30k")

## Residual / backlog
- (ideas deferred for a future cycle, e.g., "I-007-004 inconclusive; next cycle should
   re-attempt with falsifier B")

## Novelty archive additions this cycle
- I-007-001..I-007-010 added; 2 marked duplicate of prior-cycle ideas (cosine > 0.85
  with cycle-006 I-006-002 and I-006-007); both demoted out of shortlist

## Persona failure modes observed this cycle
- "Dreamer/s2 collapsed to Engineer-mode after first idea" → tag for persona-prompt refinement
- "Skeptic/s1 was insufficiently adversarial (DA re-dispatch needed)" → tighten disagreement mandate

## Constraint delta
- Constraints added this cycle: 2 (C-007-001 "avoid assumption A", C-007-002 "re-attempt I-007-004 with falsifier B")
- Constraints decayed this cycle: 1 (C-004-007 → [soft], decay_score 0.25)
- Constraints archived this cycle: 0

## How to resume
- If state=complete: launcher reads synthesis/S-001-claims.md + S-002-constraints.md
  between cycles; decides which ADVANCE-verdicted ideas to pursue; triggers next cycle
  OR closes loop per stop conditions (§8.5).
- If state=blocked: launcher re-wakes cycle-scope orchestrator with `RUN_ROOT` unchanged
  + `Stopped at` as the residual scope.
```

### 8.2 Resume protocol

#### 8.2.1 Between-cycle resume

1. Open latest `agents/brainstorm/runs/*/RECORD.md` (or user-specified cycle-id).
2. Read `Stopped at`, `Residual`, and `$RUN_ROOT/day-status.json`.
3. **Launcher:** re-wake a cycle-scope orchestrator with the residual scope (§0.5.2). **Cycle-scope:** continue mid-wave / mid-verdict without waiting for a human.
4. Continue that run **or** create a new cycle folder (`runs/YYYY-MM-DD-C{NNN+1}/`) and link "continues from" cycle-NNN in the new RECORD.
5. Never invent status — update `RECORD.md` (and `day-status.json`) after every material step.

#### 8.2.2 Mid-wave re-entrancy (gap G5 fix)

cb-review's resume contract is between-wave only. The brainstorming loop adds finer-grained mid-wave checkpointing via a phase-state-machine (Wayland Zhang, "Mid-Turn Checkpointing in a Long-Running Agent Loop", April 2026).

**Phase-state-machine:**

| Zhang phase | Brainstorming-loop phase | Checkpoint-worthy transitions out |
|---|---|---|
| `Setup` | orchestrator spawning, scaffolding | → `ExecutingTools` (Wave α dispatch) |
| `ExecutingTools` | Wave α / β / γ subagents running | → next `ExecutingTools` (next subagent) / → `AwaitingLLM` (consolidation) |
| `AwaitingLLM` | orchestrator consolidating (Judge role) | → `ExecutingTools` (next wave) / → `Done` |
| `RetryingLLM` | retrying a failed LLM call | → `AwaitingLLM` / → `Compacting` |
| `Compacting` | context compaction (§8.3) | → `AwaitingLLM` |
| `ForceStop` | kill-switch fired (380k) or user-cancelled | → `Done` (exit cleanly) |
| `Done` | cycle closed | terminal |

**Checkpoint-worthy transitions** (the only ones that write to `$RUN_ROOT/checkpoints/`):

1. `ExecutingTools → next ExecutingTools` (a subagent finished writing its artifact). Checkpoint file: `checkpoints/<wave>-<artifact-id>.json` with `{phase, artifact_path, tokens_used_at_checkpoint, next_subagent_to_dispatch}`.
2. `AwaitingLLM success → ExecutingTools` (consolidation finished). Checkpoint file: `checkpoints/<wave>-consolidation.json` with `{phase, output_artifact_path, tokens_used_at_checkpoint}`.
3. `Compacting → AwaitingLLM` (compaction finished). Checkpoint file: `checkpoints/compaction-<n>.json` with `{phase, summarised_context_path, tokens_used_at_checkpoint, tokens_saved}`.

Intra-LLM-stream checkpoints are NOT checkpoint-worthy — they produce garbage (the LLM is mid-generation).

**Resume from mid-wave crash:**

1. Orchestrator reads `day-status.json` (`state`, `phase`, `last_checkpoint`).
2. Reads the latest checkpoint file referenced by `last_checkpoint`.
3. Scans `$RUN_ROOT/<wave>/` for which artifacts exist on disk.
4. Dispatches ONLY the subagents whose artifacts are missing. No re-execution of completed subagents (Zhang's "tool side effects can't be undone, naive retry double-charges the bill").

Example: Wave α has N=10 subagents. Crash after 7 completed. On resume: scan `brainstorm/B-*.md`, find B-001 through B-007, dispatch B-008, B-009, B-010 only.

Example: Wave β crash mid-R-003. The partial R-003 dossier (if any) is discarded (intra-LLM-stream checkpoints are garbage). R-003 is re-dispatched from scratch with the same brief. R-001, R-002, R-004, R-005 are NOT re-dispatched (artifacts exist on disk).

#### 8.2.3 Tool-failure retry contract

If a subagent's tool call fails (web_search rate-limit, network blip, paywall), the subagent retries up to 3 times with exponential backoff (5s / 30s / 120s). After 3 failures:

- If the failed tool was the **only** source for the dossier's `grounds` field: dossier is marked INCONCLUSIVE, `reason="tool_failure_no_external_grounding"`. Feeds back as a constraint: "Re-attempt idea I-NNN in next cycle with alternative source for claim X".
- If the failed tool was a secondary source: dossier proceeds with remaining grounds, but the missing source is noted in the dossier's `qualifier` field ("confidence reduced; source Y unavailable").

The orchestrator NEVER fabricates a tool result. A subagent that returns a dossier with `grounds` containing a URL that was never actually fetched is treated as garbage output: the dossier is discarded, the subagent is blacklisted for the cycle, and a replacement subagent is dispatched with the same brief but a tightened "cite-as-you-go or do not cite" mandate.

### 8.3 Orchestrator context compaction (gap G6 fix)

Long-running orchestrators accumulate context. At 80% of context-window capacity (Will Larson pattern), the orchestrator triggers compaction:

- **Keep:** (a) current cycle's shortlist + verdicts; (b) prior 3 cycles' synthesis docs (summarised); (c) full novelty archive (compact JSONL, hash-only); (d) full constraint archive (compact JSONL with decay scores).
- **Drop:** (a) raw subagent transcripts; (b) prior-cycle raw artifacts (kept on disk, summarised in context).
- **Virtual file abstraction:** for large tool responses > 10k tokens (citation dumps, full dossier reads), the response is written to a `$RUN_ROOT/_context/{hash}.md` file and only the path + 200-word summary is kept in context.

Compaction is checkpoint-worthy (transition 3 above).

### 8.4 Cost budget per cycle (gap G1 fix — tiered budget + reduced rhythm)

The default cycle is a **scout cycle** at 350k tokens target / 380k kill-switch. A **deep cycle** at ~727k tokens (full protocol per idea) is opt-in, spans 2 spawns via mid-cycle checkpointing.

#### 8.4.1 Per-wave allocation for a scout cycle

| Wave / activity | Tokens | % of target | Per-subagent cost | Subagent count |
|---|---|---|---|---|
| α Brainstorm | 70,000 | 20% | ~5,500 | N=10 (parallel) |
| α consolidation (Judge) | 15,000 | 4% | (orchestrator) | 1 |
| β Research | 150,000 | 43% | ~30,000 | M=5 (parallel) |
| β consolidation (Judge) | 15,000 | 4% | (orchestrator) | 1 |
| Citation verify | 15,000 | 4% | (orchestrator) | 1 |
| γ Synthesis (claims) | 15,000 | 4% | 15,000 | γ-1 |
| γ Synthesis (constraints) | 15,000 | 4% | 15,000 | γ-2 |
| γ consolidation | 10,000 | 3% | (orchestrator) | 1 |
| Archive updates | 10,000 | 3% | (orchestrator) | 1 |
| Reserve: all-advance DA re-dispatch (capped at 1) | 25,000 | 7% | 25,000 | 0 or 1 |
| RECORD + day-status writes | 5,000 | 1% | (orchestrator) | 1 |
| **Subtotal (target)** | **350,000** | **100%** | | |
| Crash margin | 30,000 | 9% | (orchestrator) | — |
| **HARD kill-switch** | **380,000** | | | |

#### 8.4.2 Enforced kill-switch (gap G1 / Waxell enforcement-not-alerts)

- The orchestrator checks `tokens_used` after every subagent completion and every checkpoint-worthy transition.
- If `tokens_used ≥ 350k` AND the cycle is not in `synthesizing` or later: stop cleanly, `state=blocked`, `blocked_reason="budget_target_reached_pre_gamma"`. The launcher re-wakes the next spawn with `cycle_type=deep` if the cycle had shown promise (≥ 2 ideas advanced).
- If `tokens_used ≥ 380k` at any point: hard stop, `state=blocked`, `blocked_reason="budget_hard_kill_switch"`. No further subagent dispatches; current subagent (if any) is allowed to finish writing its artifact, then the orchestrator exits.
- Per Waxell: alerts don't work — enforcement does. The orchestrator does NOT ask the user "should I continue?" under any circumstance.

#### 8.4.3 Deep cycle (opt-in, ~727k over 2 spawns)

Full 1-E protocol per idea (~64k per idea × 5 ideas + full D1/C1/D2/C2/Judge phases). Triggered by launcher opt-in when (a) the problem is genuinely novel/contested AND (b) the prior scout cycle's shortlist contained ≥ 2 ideas marked ADVANCE with confidence ≥ 0.7. Spans two spawns via mid-cycle checkpointing: spawn 1 runs α + β (≈ 450k), exits cleanly with `state=blocked, blocked_reason="deep_cycle_pause_between_alpha_beta"`, `Stopped at = "resume Wave γ with verdicts from R-001..R-005"`. Spawn 2 (re-wake) runs γ + citation verify + archive updates (≈ 277k).

### 8.5 Stop conditions for the outer loop (gap G2 fix)

The cycle has a well-defined completion criterion (shortlist converged, every idea has a verdict, next-cycle constraints extracted). The **outer loop** (sequence of cycles) needs its own stop conditions. Three layers, combined:

#### 8.5.1 Goal-anchored (user-supplied at session start)

The launcher writes the stop condition into `cycle-scope.md` at the start of every session. Examples:

- "Find 3 ideas worth implementing" — loop stops when 3 ideas are marked ADVANCE with confidence ≥ 0.7 AND verified by external PoC.
- "Exhaust the design space for problem X" — loop stops when 3 consecutive cycles produce 0 new ADVANCE ideas (see §8.5.2).
- "Compare approaches A, B, C for problem X" — loop stops when each approach has at least one ADVANCE-verdicted idea with a comparative dossier.

#### 8.5.2 Novelty-decay-anchored (loop self-terminates)

- **Per-cycle novelty delta:** (new ideas in this cycle's shortlist) − (ideas in this cycle's shortlist flagged as duplicates of prior-cycle ideas via the novelty archive). If the delta is 0 for 3 consecutive cycles, the loop terminates: `state=complete`, `cycles.json.session_stop_reason="novelty-decay-3-consecutive"`.
- **Constraint-decay signal:** if `archive/constraints.jsonl` has > 50% of constraints at `decay_score < 0.3` (the idea space is over-narrowed), the loop terminates: `state=complete`, `stop_reason="constraint-exhaustion"`.

#### 8.5.3 Budget-anchored (hard backstop)

- **Max cycles per session:** 10 (default; user can override at session start). After 10 cycles: `stop_reason="max-cycles-reached"`.
- **Max tokens per session:** 4M (sum across all cycles in a session). After 4M tokens: `stop_reason="max-tokens-reached"`.
- **Per-cycle hard kill-switch:** 380k (§8.4.2) — stops a single cycle, not the loop.

#### 8.5.4 User cancels (between cycles only)

The user can cancel the loop between cycles (never inside a cycle — invariant rule §8.6.1). The launcher writes `cycles.json.session_stop_reason="user-cancelled"` and stops triggering new cycles.

#### 8.5.5 Infinite-loop guard (verified against arXiv:2607.01641 IAL-Scan)

The combination of §8.5.1 + §8.5.2 + §8.5.3 makes infinite loops impossible. If all three fail to fire (a bug in the orchestrator's stop-condition check), the user-cancel backstop (§8.5.4) applies. The arXiv:2607.01641 IAL-Scan finding (68 confirmed infinite-loop failures across 47 of 6,549 LLM agent repos) makes this multi-layer termination non-optional.

### 8.6 The 8 invariant rules of autonomy (load-bearing)

These are the load-bearing rules. Remove any one and the loop stops being autonomous.

1. **No human in the loop inside the cycle-scope agent.** Continue, ship, or leave `Stopped at` + `day-status.json` if truly blocked. The agent's job to converge properly — do not abandon a cycle half-judged.
2. **Launcher and cycle-scope agent are separate processes; launcher never ingests the worker's transcript.** Launcher polls `day-status.json` + `RECORD.md` only. Between cycles, launcher reads `synthesis/S-001-claims.md` + `S-002-constraints.md` + ADVANCE dossiers — never raw idea-docs, never checkpoints.
3. **`day-status.json` + `RECORD.md` "Stopped at" + `checkpoints/<latest>.json` is the ONLY resume contract.** Without these artifacts a cold launcher cannot re-wake the worker. Never invent status — update after every material step.
4. **Strict one-directional wave separation + disjoint ownership.** α does not verify; β does not brainstorm; γ does not verify or brainstorm; the all-advance DA re-dispatch is the only exception and is capped at one per cycle. Ownership unit = idea-ids + persona×seed pairs.
5. **The agent's job to wait properly / converge properly.** The internal Judge verdict loop is mandatory. "All-advance is suspicious" — fire the capped DA re-dispatch. Do not abandon a cycle half-judged.
6. **Scope-sized spawns with contiguous ownership.** One spawn = one cycle (α→β→γ). Default = 350k; deep = ~727k over 2 spawns. The unit of contiguous ownership is one cycle's shortlist + verdicts + constraints, not tiny one-idea chores.
7. **Single source of truth.** `LOOP.md` is canonical; `runs/YYYY-MM-DD-CNNN/` folders are immutable history; `archive/` is the only cross-cycle memory; nothing canonical at repo root or under `loops/`.
8. **Structural diversity pressure.** Every Wave α subagent has a disjoint (persona, seed) tuple. No two subagents share persona+seed. This is the only place the brainstorming loop is strictly more constrained than cd-review (which gets diversity for free from slice partitioning). Required because LLM independent samples collapse in diversity at scale (Deng, Brucks & Toubia 2026).

---

## 9. Skills registry (synthesis wave)

| Class | Prefer |
|-------|--------|
| Brainstorm facilitation | de Bono Six Hats / lateral thinking; Disney Dreamer-Realist-Critic; SCAMPER; TRIZ |
| Divergence / anti-mode-collapse | Oblique Strategies; Random Entry; persona×seed matrix (this loop) |
| Convergence / critique | Toulmin argumentation; pre-mortem (Klein); NGT-style silent consolidation |
| Verification / research | ReAct; Chain-of-Verification (CoVe); CiteTracer-style content verification |
| Anti-sycophancy | Steelman-then-falsify; position-swap; "all-advance is suspicious" re-dispatch |
| Exigo conventions | See `AGENTS.md` (in repo root) — Convex primary DB, Clerk auth, single AI shop |

Local skill paths when present: `~/.agents/skills/brainstorming`, `coding-guidelines`, `frontend-patterns`. The brainstorming loop does NOT depend on these being present; the LOOP.md briefs are self-contained.

---

## 10. Orchestrator checklist

### 10.0 Launcher checklist (L-1, user-triggered)

```text
[ ] User triggered loop in this session
[ ] Latest (or specified) RUN_ROOT selected; RECORD.md read
[ ] Remaining work researched; cycle scope sized ~350k tokens (scout) or ~727k (deep)
[ ] cycle-scope.md written (problem, inherited constraints, stop conditions, cycle type)
[ ] Separate cycle-scope agent spawned via grok CLI / harness (not subagent)
[ ] day-status.json / RECORD polled only (no full worker transcript)
[ ] If worker stops early: wake with further instructions until cycle closed
[ ] Cycle complete: read synthesis/S-001-claims.md + S-002-constraints.md
[ ] Between cycles: decide which ADVANCE ideas to pursue; trigger next cycle OR close loop
```

### 10.1 Cycle-scope checklist (L0)

```text
[ ] Create or select RUN_ROOT (agents/brainstorm/runs/YYYY-MM-DD-CNNN)
[ ] RECORD.md scaffolded / updated; day-status.json current
[ ] cycle-scope.md read; inherited constraints filtered (decay_score >= 0.3 + [soft] tagged)
[ ] persona-seed-matrix.md written BEFORE Wave α dispatch
[ ] Wave α: dispatch 10 brainstorm subagents (5 personas × 2 seeds, parallel, no children)
[ ] Collect brainstorm/B-*.md; schema-validate; reject incomplete
[ ] Cluster + dedup vs archive/novelty.jsonl; shortlist K=5
[ ] Mode-collapse detector: compute shortlist centroid vs prior cycle; flag if > 50% overlap
[ ] Wave β: dispatch 5 research subagents (one per shortlisted idea, parallel, no children)
[ ] Collect research/R-*.md; schema-validate
[ ] Citation verify pipeline (mandatory): URL re-fetch + content match + URL-text mismatch
[ ] Tally verdicts; write research/_summary.md
[ ] All-advance circuit-breaker: if advance_count/5 > 0.7, fire ONE DA re-dispatch on lowest-confidence ADVANCE
[ ] Wave γ: dispatch γ-1 (claims extractor), wait, dispatch γ-2 (constraint writer)
[ ] Collect synthesis/S-001-claims.md + S-002-constraints.md
[ ] End-of-cycle archive update: novelty.jsonl + constraints.jsonl + cycles.json + citations.jsonl
[ ] RECORD.md: done / residual / stopped at; day-status complete or blocked
[ ] Check stop conditions (§8.5): if met, state=complete; else state=complete (cycle closed; launcher decides next cycle)
```

### 10.2 Ship protocol (between cycles)

The brainstorming loop's "ship" target is the synthesis docs + ADVANCE-verdicted dossiers. There is no PR to open (unlike cd-review's develop→main + CodeRabbit iteration). Between cycles:

```text
1. READ SYNTHESIS
   - Read synthesis/S-001-claims.md (verified / refuted / inconclusive claims by theme)
   - Read synthesis/S-002-constraints.md (next-cycle constraints)
   - Skim research/R-*.md for ADVANCE-verdicted ideas (full dossiers)

2. DECIDE PURSUIT
   - For each ADVANCE idea: decide pursue (hand off to cd-review or developer),
     defer (record in cycles.json residual), or drop (log reason in launcher notes).
   - The loop's verdict is a *recommendation*, not a decision.

3. CHECK STOP CONDITIONS (§8.5)
   - Goal-anchored met? → close loop
   - Novelty-decay 3 consecutive? → close loop
   - Max cycles / max tokens? → close loop
   - User cancel? → close loop
   - Otherwise: trigger next cycle (new RUN_ROOT, new cycle-scope.md, re-spawn)

4. NEXT CYCLE OR CLOSE
   - If next cycle: increment cycle counter, write new cycle-scope.md with
     updated inherited constraints from S-002-constraints.md, spawn fresh orchestrator.
   - If close: write cycles.json.session_stop_reason, append to launcher notes.
```

---

## 11. Conventions (enforce)

| Area | Rule |
|------|------|
| Verdict vocabulary | 3-state UPPERCASE: `ADVANCE` / `REFUTE` / `INCONCLUSIVE` (canonical everywhere). `archive/novelty.jsonl` `status` field is lowercase 4-state: `advance` / `refute` / `inconclusive` / `deferred` (deferred = non-shortlisted idea preserved for future mutation). |
| Constraint types | 3-state UPPERCASE: `MUST_RESPECT` / `MUST_AVOID` / `MUST_TEST`. Maps 1:1 to verdicts: ADVANCE→MUST_RESPECT, REFUTE→MUST_AVOID, INCONCLUSIVE→MUST_TEST. |
| Synthesis file paths | `synthesis/S-001-claims.md` (γ-1 output) and `synthesis/S-002-constraints.md` (γ-2 output). Suffixes are mandatory — the launcher depends on them. |
| Citation verification | Runs AFTER Wave β subagents complete and BEFORE Wave γ dispatches. Order: α → α-consolidation → β → β-consolidation → citation-verify → γ → archive-update. Do not invert. |
| Archive writes | `archive/` is updated ONLY at end-of-cycle archive-update step (orchestrator). Mid-cycle reads from `archive/` are allowed (novelty dedup, constraint retrieval, citation cache lookup); mid-cycle writes are forbidden. Per-cycle `citations/verified.jsonl` + `refuted.jsonl` accumulate during the cycle and are merged into `archive/citations.jsonl` at end-of-cycle. |
| Idea IDs | `I-{CYCLE_NUM}-{NNN}` (e.g., `I-007-003` = idea 3 of cycle 7). Globally unique across cycles. |
| Constraint IDs | `C-{CYCLE_NUM}-{NNN}` (e.g., `C-007-003`). Globally unique. |
| Subagent IDs | `B-{NNN}-{persona}-{seed}` for Wave α; `R-{NNN}-{idea_id}` for Wave β; `R-006-{idea_id}` reserved for DA re-dispatch. |
| Token budget | Scout cycle: 350k target / 380k kill-switch. Deep cycle: ~727k over 2 spawns. Per-wave allocation in §8.4.1. |
| Wave parallelism | Wave α: N=10 (5 personas × 2 seeds). Wave β: M=5 (= shortlist cap). Wave γ: γ=2 SEQUENTIAL (γ-2 reads γ-1 output). Subagents never spawn children. |
| Single model | Exigo is grok-only. Anti-sycophancy is structural (different persona, rubric, temperature: 0.3 for Judge, 0.7 for workers). No second model. |
| Diversity pressure | Every Wave α subagent has disjoint (persona, seed) tuple. Required — without this, LLM independent samples collapse in diversity (Deng, Brucks & Toubia 2026). |
| History | `runs/YYYY-MM-DD-CNNN/` folders are immutable. `archive/` is the only cross-cycle memory. Nothing canonical at repo root or under `loops/`. |

---

## 12. History

| Date | Note |
|------|------|
| 2026-07-25 | Initial loop created under `agents/brainstorm/`. Designed via a meta-brainstorming session (Phase 1 brainstorm → Phase 1 research → Phase 2 brainstorm → Phase 2 research) with 10 parallel subagents across the 4 phases. Design artifacts preserved under `agents/brainstorm/_meta-session/`. Modeled on `agents/cd-review/LOOP.md` (cb-review) — same two-layer launcher + cycle-scope harness, same wave separation discipline, same RECORD + day-status resume contract. Adapted for divergent (idea-generation) rather than critical (code-review) work: 3 waves (α brainstorm / β research / γ synthesis) replace 3 waves (audit / brainstorm / fix); persona×seed matrix replaces slice map; cross-cycle novelty + constraint archives replace per-cycle fixes. |

For the design rationale (Phase 1 brainstorm findings, Phase 1 research verification, Phase 2 brainstorm architecture, Phase 2 research stress-test), see:

`agents/brainstorm/_meta-session/`
