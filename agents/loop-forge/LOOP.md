# Loop-Forge (`loop-forge`)

Continuous **recon → design → verify → author → ship → extract** meta-loop for Exigo.

This is the **authoring** counterpart to `agents/cd-review/` (critical) and
`agents/brainstorm/` (divergent). Where cd-review optimizes an existing codebase
and brainstorm pressure-tests new ideas, **loop-forge authors new loops**. Its
ship target is a new `agents/<name>/LOOP.md` plus its `README.md`, `archive/`,
and `runs/` skeleton — a complete, runnable, autonomous loop that did not exist
before this cycle started.

The loop alternates waves forever (until a stop condition fires):

1. **Ω Recon** (1 orchestrator + 2 adversarial slots, sequential) — probe the
   target domain and discover what autonomy means in-situ. The
   **Autonomy-Realist** slot proposes criteria from domain failure modes; the
   **Autonomy-Adversary** slot hunts for hidden HITL inside each criterion.
   A criterion is admitted only if the Adversary fails. (Idea I-001-S1,
   INCONCLUSIVE pending injected-HITL benchmark — see §5 and C-001-001.)
2. **α Design** (max-N parallel subagents, persona × seed) — generate many
   candidate design decisions for the target loop, structurally diversified.
3. **β Verify** (max-N parallel subagents, Toulmin dossier + 3-state verdict)
   — verify each shortlisted design decision against external grounding.
4. **γ Synthesize** (γ=2 sequential subagents) — extract verified claims,
   write constraints for the next cycle.
5. **δ Author** (single orchestrator) — write the target loop's `LOOP.md`,
   `README.md`, `archive/` skeleton, `runs/` skeleton, `loop-registry.json`
   sidecar. Each section is paired with one constraint it satisfies.
6. **ε Ship-gate** (single orchestrator + 1 spawned target-loop micro-cycle) —
   sealed canary run + reverse-authority micro-cycle + kill-and-resume oracle.
   Archive write is gated on the canary closing cleanly.
7. **Extract** (mid-task, any wave) — any subagent may file a `loop-itch.md`
   to trigger mid-loop sub-loop extraction (see §6).
8. Repeat with the new constraints. The portfolio archive and loop-constraints
   archive are the cross-cycle memory.

This file is the **single source of truth** for the loop. Dated run artifacts
live under:

```text
agents/loop-forge/runs/YYYY-MM-DD-LNNN/
```

(`L` prefix = Loop number, to disambiguate from cycle-scope `C` in brainstorm.)

**Two agent layers** run this protocol (mirrors `agents/cd-review/LOOP.md` §0.5
and `agents/brainstorm/LOOP.md` §0.5):

1. **Launcher session** (user-triggered, thin) — picks the latest run, sizes one
   loop-authoring cycle of work, spawns a separate loop-scope agent via CLI /
   harness, wakes it if it stalls, and between cycles acts as the active
   curator (decides which `ADVANCE` design decisions to pursue).
2. **Loop-scope agent** (autonomous, no human in the loop) — owns one full
   Ω→α→β→γ→δ→ε cycle for one target loop, dispatches waves as in-process
   subagents, judges the shortlist, runs the canary ship-gate, updates the
   cross-loop archives.

---

## 0. Directory layout

```text
agents/loop-forge/
  LOOP.md                              ← this file (always current protocol)
  README.md                            ← short overview + pointer to LOOP.md
  loop-registry.json                   ← sidecar: catalog of all authored loops
  archive/                             ← cross-loop memory (persists across runs)
    novelty.jsonl                      ← loop_md_hash + embedding + 4-state status
    constraints.jsonl                  ← cross-loop invariants with decay scores
    cycles.json                        ← cycle index: id, started_at, ended_at, status
    citations.jsonl                    ← cross-cycle citation cache (7-day TTL)
    README.md                          ← explains each archive file
  runs/
    .gitkeep
    README.md
    YYYY-MM-DD-LNNN/                   ← one loop-authoring run (loop num NNN, zero-padded)
      RECORD.md                        ← narrative + Stopped at + Residual + verdicts
      loop-scope.md                    ← launcher-written brief (target domain, stop cond)
      day-status.json                  ← thin launcher poll file (state, phase, tokens_used)
      loop-spec.md                     ← the target domain's spec (Ω output)
      persona-seed-matrix.md           ← diversification matrix for α
      recon/                           ← Ω wave output (probe responses + admitted criteria)
        probe-responses.jsonl
        autonomy-criteria.md           ← Realist+Adversary output
        itch-log.jsonl                 ← mid-task itch filings (cumulative)
      brainstorm/                      ← α wave idea-docs (design decisions)
        B-001-NNN-<persona>-<seed>.md
      research/                        ← β wave dossiers (3-state verdict)
        R-001-<idea_id>.md
        _summary.md
      synthesis/                       ← γ wave
        S-001-claims.md
        S-002-constraints.md
      authored/                        ← δ wave output (the new loop's files)
        LOOP.md                       ← the new loop's canonical protocol
        README.md
        archive/.gitkeep
        runs/.gitkeep
        loop-registry.json
      canary/                          ← ε wave output (ship-gate evidence)
        canary-log.jsonl              ← sealed-run transcript
        kill-resume-test.md           ← cold-launcher resume proof
        verdict.md                    ← ε verdict (PASS/FAIL)
      extract/                         ← mid-task extraction queue (if any)
        <sub-loop-name>.md
      citations/
        verified.jsonl
        refuted.jsonl
      checkpoints/
        <wave>-<artifact-id>.json
```

**RUN_ROOT discipline:** during a cycle, agents write ONLY to `$RUN_ROOT`. The
cross-loop `archive/` is updated only by the orchestrator's end-of-cycle
archive-update step. Mid-cycle reads from `archive/` are allowed; mid-cycle
writes are forbidden.

---

## 0.5 Harness: launcher vs loop-scope agent

### 0.5.1 Roles

| Layer | How it starts | Job | Context discipline |
|-------|---------------|-----|--------------------|
| **Launcher** | User triggers loop-forge in an interactive session | Pick latest run, size one loop-authoring cycle, spawn a separate loop-scope agent, poll `day-status.json` + `RECORD.md` only, wake the worker if it stalls, **between cycles** read synthesis docs and decide which ADVANCE design decisions to embody in the target LOOP.md | Keep thin: status files + synthesis docs only — never ingest worker's transcript |
| **Loop-scope agent** | Spawned by launcher (CLI / harness, peer process) | Execute this `LOOP.md` end-to-end for one target loop: waves Ω/α/β/γ/δ/ε, mid-task extraction, canary ship-gate, archive updates, write RECORD + day-status | Full working context; **no human in the loop**; honors 380k token hard kill-switch |

### 0.5.2 Launcher protocol (user-triggered)

When the user starts or continues loop-forge:

```text
1. RESOLVE RUN
   - Pick latest agents/loop-forge/runs/YYYY-MM-DD-LNNN/ (or user-specified loop-id).
   - Read RECORD.md (Status, Stopped at, Residual, shortlist + verdicts).
   - Skim synthesis/S-001-claims.md + S-002-constraints.md.

2. DECIDE SCOPE FOR ONE LOOP-AUTHORING CYCLE
   - Package one loop's worth of work: target domain statement + inherited
     constraints (from archive/constraints.jsonl, decay_score ≥ 0.3) + stop
     condition, sized for ~350k tokens (scout) or ~727k (deep).
   - Write the scope into $RUN_ROOT/loop-scope.md.

3. SPAWN SEPARATE LOOP-SCOPE AGENT (peer process, NOT a subagent of launcher)

     <agent-cli> -p "$(cat <<'EOF'
     You are the loop-forge LOOP-SCOPE ORCHESTRATOR for Exigo.
     Read and obey agents/loop-forge/LOOP.md entirely.
     RUN_ROOT=agents/loop-forge/runs/YYYY-MM-DD-LNNN
     LOOP_ID=loop-NNN
     TARGET_DOMAIN={…}
     INHERITED_CONSTRAINTS={from archive/constraints.jsonl, decay_score ≥ 0.3,
                            plus [canonical]-tagged invariants}
     CYCLE_TYPE=scout
     STOP_CONDITION={goal-anchored | novelty-decay-3-consecutive | max-loops-N | max-tokens-M}
     HARD_BUDGET_TOKENS=380000

     NO HUMAN IN THE LOOP. Do not pause for "should I continue?".

     Honor the 5 canonical invariants:
       C-001-can-01: ship a built-in discrimination test bench
       C-001-can-02: mandate typed `ports:` block in every authored LOOP.md
       C-001-can-03: hard header-carried `remaining_extraction_depth` (default 3, tunable)
       C-001-can-04: use cd-review §0.5.4 day-status SHAPE; each forged loop declares own last_step vocab
       C-001-can-05: LINEAGE BLOCK enforces no-self-composition + no-parent-mutation

     Use in-process subagents for waves Ω (2 slots), α (N=10), β (M=5), γ (γ=2).
     δ is the orchestrator's own authoring pass. ε spawns the target loop as a
     leaf worker under reverse-authority.

     After Wave γ: run citation verification (mandatory, §6.4).
     After Wave δ: run ε canary ship-gate (mandatory, §8).
     After Wave ε: update archive/novelty.jsonl + archive/constraints.jsonl +
                   archive/cycles.json + archive/citations.jsonl (end-of-cycle only).
     Write progress to RECORD.md and $RUN_ROOT/day-status.json after every material step.

     If you stop before the cycle is closed, leave Stopped at + next action in RECORD.md
     so a cold launcher can re-wake you with the residual scope.
     EOF
     )" --cwd <repo> --output-format json --yolo

4. SUPERVISE WITHOUT STEALING CONTEXT
   - Poll process alive? + day-status.json + RECORD.md "Stopped at".

5. BETWEEN CYCLES (active-curator role — HITL lives here, not inside a cycle)
   - Read synthesis/S-001-claims.md + S-002-constraints.md + ADVANCE dossiers.
   - Decide which ADVANCE design decisions to embody in the next target loop.
   - Trigger next cycle OR close the loop.
```

### 0.5.3 Loop-scope agent rules

- **No human in the loop.** Continue, ship, or leave `Stopped at` + `day-status.json` if truly blocked (permissions, missing secrets, tool failure ≥3 retries, budget exhausted mid-phase per 380k kill-switch).
- **Orchestrate at this level:** dispatch Wave Ω/α/β/γ via in-process subagents; consolidate; judge; verify citations; author the target LOOP.md (δ); run the canary ship-gate (ε); update archives; write RECORD + day-status.
- **Scope size:** one spawn = one loop-authoring cycle (Ω→α→β→γ→δ→ε). Default scout = 350k tokens. Deep = ~727k over 2 spawns via mid-cycle checkpointing (§10.2). Do not under-scope into tiny one-decision cycles.
- **Artifacts are truth:** always keep `RECORD.md` + `day-status.json` current.
- **Never fabricate tool results.** A subagent citing URLs never fetched is garbage output (§6.4).

### 0.5.4 Progress file (launcher-readable)

`$RUN_ROOT/day-status.json`:

```json
{
  "state": "running|recon|brainstorming|researching|synthesizing|authoring|canary|blocked|complete",
  "loop_id": "loop-007",
  "cycle_type": "scout|deep",
  "phase": "omega|omega_adversary|alpha|alpha_consolidating|beta|beta_consolidating|citation_verify|gamma|authoring|canary|archive_update|done",
  "last_checkpoint": "B-007 written by dreamer/s2",
  "shortlist_size": null,
  "verdicts_pending": 0,
  "extraction_queue_size": 0,
  "next_cycle_constraints_extracted": false,
  "tokens_used": 0,
  "tokens_budget": 380000,
  "tokens_target": 350000,
  "alladvance_redispatch_fired": false,
  "canary_verdict": null,
  "blocked_reason": null,
  "updated_at": "ISO-8601"
}
```

---

## 1. Starting a new loop-authoring cycle

```bash
DATE=$(date +%Y-%m-%d)
NEXT_LOOP=$(($(jq '.loops | map(.loop_num // 0) | max' agents/loop-forge/archive/loop-portfolio.json) + 1))
LOOP_ID="loop-$(printf '%03d' "$NEXT_LOOP")"
RUN_ROOT="agents/loop-forge/runs/${DATE}-L${NEXT_LOOP}"
mkdir -p "$RUN_ROOT"/{recon,brainstorm,research,synthesis,authored,canary,extract,citations,checkpoints} \
         "$RUN_ROOT/authored/archive" "$RUN_ROOT/authored/runs"
```

Scaffold `RECORD.md`, `loop-scope.md`, `persona-seed-matrix.md` per §1.1–§1.4
of brainstorm/LOOP.md (adapted: `loop-scope.md` replaces `cycle-scope.md`;
target-domain statement replaces problem-statement).

---

## 2. North-star and non-goals

### North-star (ordered)

| # | Criterion |
|---|-----------|
| 1 | **Autonomy** — the resulting loop runs end-to-end with no HITL inside the worker |
| 2 | **Universality** — the loop's text is domain-agnostic; domain specifics are discovered at runtime, not hard-coded |
| 3 | **Combinability** — every authored loop declares typed ports and passes the COMPOSE/CONFLICT/ORTHOGONAL verdict against every existing loop |
| 4 | **Extractability** — mid-task extraction is a checkpointed, resumable, depth-bounded primitive (not ad-hoc) |
| 5 | **Honesty** — `REJECT` and `NEEDS-FIELDWORK` are first-class verdicts; sycophantic rubber-stamping is the worst failure mode |

### Non-goals

- **Implementation of the target loop's first run.** That is a future cycle, by the loop itself once authored.
- **A second model.** Single-model shop. Anti-sycophancy is structural (persona + rubric + temperature).
- **Re-litigation.** Wave β does not re-open Wave α; Wave γ does not re-open β; ε does not re-open γ.
- **Infinite loops or infinite extraction.** Three layered stop conditions (§10.5) + extraction depth budget (§6) make infinite loops impossible.
- **Domain-specific hard-coding.** The canonical LOOP.md text contains no GitHub-specific, research-specific, or lesson-writing-specific rules. Domain logic is discovered by Wave Ω and recorded in the target loop's `loop-spec.md` (which is a per-run artifact, not part of loop-forge's canonical text).

---

## 3. Architecture (strict wave separation)

```text
┌─────────────────────────────────────────────────────────────────┐
│  L-1  LAUNCHER (user-triggered session)                         │
│  latest run · loop scope · spawn/wake CLI loop agent            │
│  thin polls only (RECORD + day-status) — not worker transcript  │
│  between cycles: read synthesis docs, decide which ADVANCE      │
│  design decisions to embody in the next target loop             │
└────────────────────────────┬────────────────────────────────────┘
                             │ CLI / harness (separate process)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  L0  LOOP-SCOPE ORCHESTRATOR (no human in the loop)             │
│  create/select RUN_ROOT · read inherited constraints + novelty   │
│  archive · dispatch waves · judge · verify citations ·          │
│  author target LOOP.md · run canary ship-gate ·                │
│  update archives · write RECORD + day-status                   │
└────────────────────────────┬────────────────────────────────────┘
                             │ subagents (in-process, context-isolated)
       ┌─────────────────────┼─────────────────────────┬─────────────────────┐
       ▼                     ▼                           ▼                     ▼
WAVE Ω — RECON         WAVE α — DESIGN           WAVE β — VERIFY         WAVE γ — SYNTHESIS
2 sequential slots      N=10 parallel            M=5 parallel            γ=2 sequential
Realist → Adversary     persona × seed           one idea per worker     γ-1 claims, γ-2 constraints
discover autonomy       divergent design         Toulmin dossier         reads γ-1 output
criteria                write brainstorm/*       write research/*        write synthesis/*
NO children             external tools only       NO children             NO children
```

| Wave | Agent role | Reads | Writes | Spawns children? |
|------|------------|-------|--------|------------------|
| **Ω** | Recon (discover autonomy) | target domain probes, existing loop archives | `$RUN_ROOT/recon/autonomy-criteria.md` | **No** (2 in-process slots) |
| **α** | Design (divergent) | loop-spec.md (Ω output), inherited constraints, novelty archive | `$RUN_ROOT/brainstorm/B-{NNN}-{persona}-{seed}.md` | **No** |
| **β** | Verify (convergent) | one shortlisted design decision, novelty archive | `$RUN_ROOT/research/R-{NNN}-{idea_id}.md` | **No** (research tools OK) |
| **γ** | Synthesis (reduce) | all dossiers + `_summary.md` + prior constraints | `$RUN_ROOT/synthesis/S-001-claims.md` + `S-002-constraints.md` | **No** |
| **δ** | Author (orchestrator solo) | synthesis docs + ADVANCE decisions + constraints | `$RUN_ROOT/authored/LOOP.md` + `README.md` + archive skeleton | orchestrator only |
| **ε** | Ship-gate (orchestrator + 1 spawned target-loop micro-cycle) | authored/LOOP.md | `$RUN_ROOT/canary/verdict.md` | **Yes** — spawns target loop as leaf worker under reverse-authority |

---

## 4. Loop-spec format

Unlike cd-review (which slices the codebase) or brainstorm (which takes a problem brief), loop-forge takes a **target domain statement** as input. The launcher writes the target domain into `$RUN_ROOT/loop-scope.md` BEFORE Wave Ω; Wave Ω expands it into `$RUN_ROOT/loop-spec.md` (the discovered autonomy criteria + the target's typed ports + the target's last_step vocabulary + the target's stop conditions).

A good target domain statement has:

- **One-sentence target domain** (what kind of loop is being authored? e.g., "a loop that monitors GitHub PRs and merges them when CI passes and CodeRabbit approves")
- **Context** (3-5 sentences: why now, what's known about the domain, what existing loops are nearby)
- **Inherited constraints** (from `archive/constraints.jsonl`)
- **Stop condition** (when does this authoring cycle close? See §10.5)
- **Out of scope** (what NOT to author — e.g., "do not propose a loop that requires a second LLM provider")
- **Success shape** (what does a good output look like? e.g., "a complete `agents/<name>/LOOP.md` that passes the ε canary ship-gate and the COMPOSE verdict against cd-review + brainstorm")

The orchestrator copies the target domain statement verbatim into every Wave α subagent's prompt.

---

## 5. Wave Ω — Domain reconnaissance with adversarial autonomy-criteria slots

**Status: INCONCLUSIVE pending injected-HITL benchmark** (per C-001-001). Wave Ω
SHIPS in this protocol, but its first run must include the discrimination test
bench described in C-001-001. If the Adversary slot's recall does not materially
exceed a single-Realist baseline on the planted-HITL benchmark, the Adversary
is presumed theater and replaced with a non-LLM oracle (static analyzer over
LOOP.md flagging verbs-of-deferral: "wait", "pause", "request", "ask", "review",
"approve", "confirm").

### 5.1 Probes

The orchestrator dispatches N cheap probes into the target domain (default N=5):

1. **Read probe**: read the target domain's existing artifacts (if any) — e.g., for GitHub, read `.github/workflows/`; for research, read the prior literature.
2. **No-op action probe**: attempt a no-op action (e.g., `git status` instead of `git push`; `dry-run` flag if available).
3. **Observability probe**: check which signals the target emits (CI status, PR comments, file changes, deployment events).
4. **Side-effect probe**: identify what counts as a reversible vs irreversible side effect (commit, push, merge, deploy).
5. **HITL-trace probe**: scan the target's documented workflow for any verb-of-deferral.

Each probe writes one line to `$RUN_ROOT/recon/probe-responses.jsonl`:

```json
{"probe_id":"P-001","kind":"read","target":".github/workflows/","response_summary":"…","signals_returned":[…],"hitl_verbs_detected":[…],"timestamp":"…"}
```

### 5.2 Realist slot (Autonomy-Realist)

```text
You are the AUTONOMY-REALIST for the loop-forge Wave Ω.
RUN_ROOT={RUN_ROOT}
TARGET_DOMAIN={TARGET_DOMAIN}
PROBE_RESPONSES: {cat $RUN_ROOT/recon/probe-responses.jsonl}

TASK
Propose 5-10 autonomy criteria for the target loop, each derived from a domain
failure mode you can name. For each criterion:
- Failure mode: (one sentence — what goes wrong without this criterion)
- Proposed criterion: (one imperative sentence — what the target loop MUST do / MUST NOT do / MUST TEST)
- Probe evidence: (which probe response grounds this criterion)
- Riskiest assumption: (one sentence — what if this criterion is wrong)

Do NOT propose criteria that depend on a human reviewer, approver, or
intervener. If you cannot ground a criterion in probe evidence, drop it.

OUTPUT — write to EXACTLY this path:
{RUN_ROOT}/recon/autonomy-criteria.md (append your section "## Realist proposals")
```

### 5.3 Adversary slot (Autonomy-Adversary)

```text
You are the AUTONOMY-ADVERSARY for the loop-forge Wave Ω.
RUN_ROOT={RUN_ROOT}
TARGET_DOMAIN={TARGET_DOMAIN}
PROBE_RESPONSES: {same as Realist}
REALIST_PROPOSALS: {cat $RUN_ROOT/recon/autonomy-criteria.md}

TASK
Your single job: find a hidden HITL step inside each Realist criterion. For
each Realist proposal, run this 3-step hunt:
1. STEELMAN: write the strongest case for the criterion being HITL-free.
2. HUNT: identify any verb-of-deferral, any implicit "wait for X", any
   assumption that an external signal will arrive in time, any side-effect
   that requires human reversal.
3. VERDICT: ADMIT (no hidden HITL found after N=3 hunt rounds) or
   QUARANTINE (hidden HITL found; criterion demoted to MUST_TEST with
   quarantine_reason).

You MUST attempt at least N=3 hunt rounds per criterion before ADMIT.
A criterion with no adversarial pressure is presumed theater.

OUTPUT — append to {RUN_ROOT}/recon/autonomy-criteria.md ("## Adversary verdicts")
```

### 5.4 Orchestrator consolidation

After both slots complete, the orchestrator:

1. Reads `autonomy-criteria.md`.
2. ADMITted criteria become `MUST_RESPECT` constraints for the target loop.
3. QUARANTINEd criteria become `MUST_TEST` constraints (with `quarantine_reason`).
4. Writes the final `$RUN_ROOT/loop-spec.md` containing:
   - Target domain statement (from loop-scope.md)
   - Admitted autonomy criteria (from Ω output)
   - Discovered typed ports (input ports the target loop will consume; output ports it will produce)
   - Discovered `last_step` vocabulary (the target loop's state-machine step names — NOT cd-review's §10.7 vocabulary)
   - Stop conditions (target-loop-specific, derived from the autonomy criteria)
5. Updates `RECORD.md` (Wave Ω done) and `day-status.json` (phase=alpha).

### 5.5 What this wave does NOT do

- Wave Ω does NOT brainstorm design decisions (that's α).
- Wave Ω does NOT verify citations (that's β + citation-verify).
- Wave Ω does NOT spawn children beyond its 2 in-process slots.
- Wave Ω does NOT write to any path outside `$RUN_ROOT/recon/`.

---

## 6. Mid-task extraction protocol (canonical invariant C-001-can-03)

The mid-task extraction protocol consists of three structural mechanisms:

### 6.1 Loop-itch detector

Any subagent, at any wave (Ω/α/β/γ), may file a `loop-itch.md` artifact to `$RUN_ROOT/recon/itch-log.jsonl` when it detects the sub-problem it's grinding on exhibits autonomy-envelope properties:

- **Repeating decision points** (the same kind of decision recurs ≥3 times in the sub-problem)
- **Multiple wave-worthy slices** (the sub-problem would benefit from its own α/β/γ waves)
- **Own stop conditions** (the sub-problem has a natural convergence criterion independent of the parent)

Each itch entry:

```json
{"itch_id":"ITCH-001","filed_by":"B-003","filed_at":"…","subproblem_summary":"…","evidence":["repeating decision: …","multiple slices: …","own stop condition: …"],"proposed_loop_name":"loop-compose"}
```

The orchestrator reviews itch-log.jsonl at the end of each wave and promotes top-itched sub-problems to a mid-cycle extraction step.

### 6.2 Extraction-depth budget (canonical invariant — `remaining_extraction_depth`)

Every LOOP.md header carries:

```yaml
---
loop_id: loop-forge
parent_loops: [cd-review, brainstorm]
mutation_operator: compose
remaining_extraction_depth: 3   # default; tunable per C-001-002 test bench
---
```

When the orchestrator dispatches a child loop-scope agent for an extracted sub-loop:

- The child's `remaining_extraction_depth` MUST be `parent_depth - 1`.
- The orchestrator REFUSES to dispatch a child whose depth ≥ parent's depth.
- At `remaining_extraction_depth = 0`, extraction is FORBIDDEN — the agent inlines the sub-protocol into the parent LOOP.md text instead.

This is a hard invariant (canonical C-001-can-03), not advisory. Per C-001-002,
the depth default MUST be validated against the discrimination test bench on
the first self-simulation. If precision < 0.6 OR quality-delta(extracted) −
quality-delta(inlined) < 0 across ≥15/20 cases, depth default is revised.

### 6.3 Checkpointable extraction

When the orchestrator promotes an itch to an extraction, it writes:

```text
$RUN_ROOT/extract/<sub-loop-name>.md
```

containing:

- The partial LOOP.md slice authored so far for the sub-problem
- The trigger (which itch, what evidence)
- The residual scope (what's left for the sub-loop to own)
- The child's `remaining_extraction_depth`

The launcher then spawns a parallel loop-scope agent for the sub-loop (with its
own RUN_ROOT under `agents/loop-forge/runs/<date>-L<NNN>-extracted-<name>/`).
When the child ships, the parent LOOP.md gains a `composes-with: <sub-loop-name>`
reference in its LINEAGE BLOCK.

### 6.4 Mid-task extraction example (this cycle)

During this cycle's Wave β, R-003 verified that the composition primitive
(typed ports + 3-state COMPOSE/CONFLICT/ORTHOGONAL verdict + baseline delta-test)
is a non-trivial operation that takes two existing loops and produces a new one.
This operation is reusable beyond loop-forge — any caller wanting to compose
two loops benefits. Per the user's brief ("If agent needs, it must create an
even new loop mid-task that it thinks gonna reach more quality work, and if
that loop really something we could benefit from in future"), the orchestrator
files an itch and extracts `agents/loop-compose/` as a sibling loop. See
`agents/loop-compose/LOOP.md` (shipped alongside this loop).

---

## 7. Wave α — Design brainstorm (findings only, no critique)

### 7.1 Persona × seed matrix (structural diversity pressure)

Same 5 personas × 2 seeds as brainstorm §5.1 (Dreamer, Skeptic, Engineer,
Outsider, Cross-Domain Synthesizer). Each Wave α subagent generates 3-7
**design decisions** for the target loop's protocol — not topic ideas. A
design decision is a structural choice about the target loop (a wave, an
artifact, an invariant rule, a composition primitive, a mid-task extraction
trigger, a domain reconnaissance step, a decision-making structure, an
autonomy-criteria discovery mechanism).

Per Deng, Brucks & Toubia 2026: ordinary personas > celebrity. Seed s2 rotates
per the same 5-cycle schedule as brainstorm §5.1.

### 7.2 Subagent brief

Identical to brainstorm §5.2 with these substitutions:

- "PROBLEM_BRIEF" → "TARGET_DOMAIN + loop-spec.md (Ω output)"
- "INHERITED_CONSTRAINTS" → from `archive/constraints.jsonl` filtered to
  `decay_score ≥ 0.3` plus `[canonical]`-tagged invariants (which never decay)
- Output path: `$RUN_ROOT/brainstorm/B-{NNN}-{persona}-{seed}.md`
- Each design decision includes a `parent_loop` field (which existing loop
  pattern it adapts — cd-review, brainstorm, or none).

### 7.3 Orchestrator consolidation (Judge role, non-parallel)

Per brainstorm §5.4: schema-validate, extract, cluster, dedup vs
`archive/novelty.jsonl`, shortlist K=5 by scoring on novelty / diversity /
specificity / actionability.

**Additional loop-forge-specific check:** for each shortlisted design decision,
run the **composition-collapse detector** (from B-009 I-004-LFC): compute
cosine similarity of the design decision's warrant against every existing
LOOP.md's `ports:` block. If similarity > 0.85, the design is "too similar
to an existing loop" — flag for the ship-boundary self-review DA (§8.4).

---

## 8. Wave β — Verify (Toulmin dossier + 3-state verdict)

Identical protocol to brainstorm §6 (7-step Toulmin: steelman → decompose →
falsification plan → external grounding → position-swap → verdict → constraint).
The dossier's verdict vocabulary is the canonical 3-state `ADVANCE` / `REFUTE`
/ `INCONCLUSIVE`.

Citation verification (§6.4) runs AFTER Wave β completes and BEFORE Wave γ
dispatches. The all-advance DA re-dispatch (§6.3 step 4) is capped at ONE per
cycle.

### 8.1 Loop-forge-specific extension: ship-boundary self-review DA

In addition to the all-advance DA, loop-forge fires a SECOND DA at the ship
boundary (between δ and ε) when ANY of these predicates trip:

- The authored LOOP.md's `ports:` block cosine-similarity to any existing LOOP.md > 0.85
- All α/β/γ reviewers ADVANCE with zero P0/P1 findings
- The authored LOOP.md's wave-count matches a sibling loop's wave-count exactly

When tripped, ONE adversarial subagent re-audits the authored LOOP.md with
mandate "find the falsifier missed — what makes this loop a clone-with-renamed-
sections of an existing loop, not a genuinely new autonomy envelope?". Hard
cap: 1 ship-boundary DA per cycle. If the DA overturns, the LOOP.md is demoted
to `NEEDS-FIELDWORK` (per the 3-state loop-acceptance verdict in §11).

---

## 9. Wave γ — Synthesis (claims extraction + constraint writing)

Identical to brainstorm §7. γ-1 extracts claims; γ-2 writes constraints. The
constraints are written for the NEXT loop-authoring cycle AND for the target
loop being authored this cycle (δ will embody them in the target LOOP.md).

End-of-cycle archive update (per brainstorm §7.3) writes `archive/novelty.jsonl`,
`archive/constraints.jsonl`, `archive/cycles.json`, `archive/citations.jsonl`.

---

## 10. Wave δ — Author the target loop (orchestrator solo)

After Wave γ completes, the orchestrator authors the target loop's files.
This is NOT a parallel wave — it's a single orchestrator pass.

### 10.1 Authoring rules

1. **Disjoint section ownership.** Each section of the target LOOP.md is
   paired with exactly one constraint from `S-002-constraints.md`. If a
   section has no paired constraint, it is dropped (the target loop must
   not contain constraint-orphan content). This is the synthesis of B-009
   I-001-LFC (Author-Wave with constraint-paired sections).

2. **Typed ports block (canonical C-001-can-02).** The target LOOP.md's
   header MUST include:

   ```yaml
   ---
   loop_id: <name>
   parent_loops: [<list>]
   mutation_operator: <compose | adapt | +wave | reduce | extract>
   remaining_extraction_depth: 3
   ports:
     inputs:
       - {name: problem-port, type: text, required: true}
       - {name: repo-port, type: path, required: true}
     outputs:
       - {name: ideas-port, type: markdown-artifact}
       - {name: loop-md-port, type: file}
   last_step_vocabulary: [setup, alpha_dispatched, beta_done, …]
   ---
   ```

3. **last_step vocabulary (C-001-004a).** The target LOOP.md declares its
   OWN state-machine step names in `last_step_vocabulary`. These are NOT
   cd-review's §10.7 step names (which are GitHub-specific). The ε canary
   oracle runs against THIS declared vocabulary.

4. **LINEAGE BLOCK (canonical C-001-can-05).** Every target LOOP.md ends
   with a `## Lineage` section listing parent loops + mutation operator +
   no-self-composition + no-parent-mutation invariants.

5. **8 invariant rules of autonomy (§12).** The target LOOP.md MUST include
   its own adapted version of the 8 invariants from §12.

6. **Multi-layer stop conditions (§10.5 of this LOOP.md, lifted to the target
   loop).** The target loop's stop conditions are domain-specific (discovered
   by Ω) but must include the three layers: goal-anchored, novelty-decay,
   budget-anchored.

### 10.2 Artifacts produced by δ

```text
$RUN_ROOT/authored/
  LOOP.md                 ← the target loop's canonical protocol
  README.md               ← short overview + pointer to LOOP.md
  archive/.gitkeep
  runs/.gitkeep
  loop-registry.json      ← sidecar (one entry: this target loop)
```

### 10.3 Mid-task extraction during δ

If during authoring the orchestrator identifies a sub-protocol that warrants
its own loop (e.g., "the composition operation deserves its own loop"), it
files an itch (§6.1) and may extract a sibling loop in parallel. The
extracted loop's `LOOP.md` ships alongside the target loop's. The parent
LOOP.md gains a `composes-with: <extracted-loop>` reference in its LINEAGE BLOCK.

---

## 11. Wave ε — Ship-gate (canary run + reverse-authority + day-status oracle)

**Status: ADVANCE (confidence capped 0.50 per §6.4 — 3 non-200 citations in R-004).**
The canary ship-gate is mandatory but its first run MUST honor the two
constraints C-001-004a (declared last_step vocab) and C-001-004b (fixed
trivial-domain corpus for reverse-authority).

### 11.1 Sealed canary run

The orchestrator spawns the target loop (the thing just authored in δ) as a
**leaf worker** under reverse-authority. The target loop is handed a
`loop-spec.md` drawn from a FIXED trivial-domain corpus (C-001-004b):

```text
Fixed trivial-domain corpus:
- "sort a list of numbers"
- "count vowels in a string"
- "dedupe a list"
- "find the max of a list"
- "reverse a string"
```

The orchestrator does NOT tailor the spec to the target loop's known capabilities.
The canary runs sealed:

- No human (cd-review §0.5.3 hard-ban)
- No real git push (stub the git layer)
- No real network (stub external calls)
- Wall-clock budget (default 5 minutes; tunable)
- Hard token budget (default 50k; tunable)

### 11.2 Pass criterion

The canary passes IFF:

1. The target loop terminates with `state=complete` or `state=fatal_blocked` (the two terminal states from cd-review §10.5 — the universal contract, NOT the §10.7 step names).
2. A written artifact exists at `$RUN_ROOT/authored/LOOP.md` (already exists from δ; canary confirms it is still readable post-run).
3. No string matching `waiting for user|pause for review|ask.*approve` appears in the canary log.
4. `day-status.json` was updated before every side-effect (cd-review §8.3 continuity invariant).

### 11.3 Kill-and-resume oracle

Mid-canary, the orchestrator kills the target loop at a random `last_step`
(from the target's declared `last_step_vocabulary` — C-001-004a). The
orchestrator then verifies a cold launcher can resume from `day-status.json`
+ `RECORD.md` "Stopped at" alone. If resume fails, the canary FAILS.

### 11.4 Verdict

```text
$RUN_ROOT/canary/verdict.md:

## ε Ship-gate verdict

- Verdict: PASS | FAIL
- Canary duration: N seconds
- Tokens used: N / 50000
- Killed at: <last_step from target's declared vocabulary>
- Cold-launcher resume: SUCCESS | FAILURE
- Reasoning: (2-3 sentences)

If FAIL: the target LOOP.md is NOT archived. The orchestrator files an itch
for the failure mode (likely: the target loop's protocol has a hidden HITL or
a non-resumable state). Wave δ re-runs with the new constraint from the
ε verdict. Hard cap: 3 ε re-runs before `state=fatal_blocked, blocked_reason="canary_failed_3_times"`.
```

### 11.5 What this wave does NOT do

- Wave ε does NOT author content (that's δ).
- Wave ε does NOT spawn a parallel sub-loop (only the single reverse-authority child for the canary).
- Wave ε does NOT use a spec tailored to the target's capabilities (C-001-004b).

---

## 12. The 8 invariant rules of autonomy (load-bearing)

These are the load-bearing rules. Remove any one and the loop stops being
autonomous.

1. **No human in the loop inside the loop-scope agent.** Continue, ship, or leave `Stopped at` + `day-status.json` if truly blocked.
2. **Launcher and loop-scope agent are separate processes; launcher never ingests the worker's transcript.** Launcher polls `day-status.json` + `RECORD.md` only.
3. **`day-status.json` + `RECORD.md` "Stopped at" + `checkpoints/<latest>.json` is the ONLY resume contract.** Each forged loop declares its OWN `last_step` vocabulary (C-001-004a).
4. **Strict one-directional wave separation + disjoint ownership.** Ω does not design; α does not verify; β does not design; γ does not verify or design; δ does not verify; ε does not design. The all-advance DA (§8) and the ship-boundary self-review DA (§8.1) are the only exceptions, each capped at one per cycle.
5. **The agent's job to converge properly / ship properly.** The internal Judge verdict loop is mandatory. "All-advance is suspicious" — fire the capped DA. Do not abandon a cycle half-judged. The canary ship-gate (§11) is mandatory; do not bypass it.
6. **Scope-sized spawns with contiguous ownership.** One spawn = one loop-authoring cycle (Ω→α→β→γ→δ→ε). Default = 350k; deep = ~727k over 2 spawns.
7. **Single source of truth.** `LOOP.md` is canonical; `runs/YYYY-MM-DD-LNNN/` folders are immutable history; `archive/` is the only cross-loop memory; `loop-registry.json` is the inter-loop catalog.
8. **Structural diversity pressure.** Every Wave α subagent has a disjoint (persona, seed) tuple. Required — without this, LLM independent samples collapse in diversity (Deng, Brucks & Toubia 2026).

### 12.1 Loop-forge-specific invariants (5 canonical, from γ-2)

In addition to the 8 above (inherited from cd-review/brainstorm), loop-forge
enforces 5 canonical invariants (C-001-can-01 through C-001-can-05). See
`archive/constraints.jsonl` for the canonical set. Briefly:

| ID | Invariant |
|----|-----------|
| C-001-can-01 | Ship a built-in discrimination test bench gating primitive promotion |
| C-001-can-02 | Mandate typed `ports:` block in every authored LOOP.md |
| C-001-can-03 | Hard header-carried `remaining_extraction_depth` (default tunable) on every dispatch |
| C-001-can-04 | Use cd-review §0.5.4 day-status SHAPE as universal resume contract; each forged loop declares own last_step vocab |
| C-001-can-05 | LINEAGE BLOCK enforces no-self-composition + no-parent-mutation |

---

## 13. Stop conditions for the outer loop (3 layers, combined)

### 13.1 Goal-anchored (user-supplied at session start)

Written into `loop-scope.md` per cycle. Examples:

- "Author 3 loops worth shipping" — stops when 3 target loops pass the ε canary.
- "Exhaust the design space for problem X" — stops when 3 consecutive cycles produce 0 new ADVANCE design decisions.

### 13.2 Novelty-decay-anchored (loop self-terminates)

- Per-cycle novelty delta: (new design decisions in this cycle's shortlist) − (decisions flagged as duplicates via `archive/novelty.jsonl`). If delta = 0 for 3 consecutive cycles, terminate: `state=complete`, `cycles.json.session_stop_reason="novelty-decay-3-consecutive"`.
- Constraint-decay signal: if `archive/constraints.jsonl` has > 50% of constraints at `decay_score < 0.3` (design space over-narrowed), terminate: `stop_reason="constraint-exhaustion"`.

### 13.3 Budget-anchored (hard backstop)

- Max loops per session: 10 (default). After 10: `stop_reason="max-loops-reached"`.
- Max tokens per session: 4M (sum across all cycles). After 4M: `stop_reason="max-tokens-reached"`.
- Per-cycle hard kill-switch: 380k (§10.4.2 of brainstorm, adapted).
- **Blast-radius kill-switch (canonical, from B-004 I-003-PRK):** per-session
  caps on countable external side-effects: `MAX_OPEN_PRS=10`,
  `MAX_SPAWNED_REPOS=5`, `MAX_FS_MUTATIONS_OUTSIDE_RUNROOT=20`. Hitting any
  forces `state=budget_exhausted` + clean exit.

### 13.4 User cancels (between cycles only)

The user can cancel the loop between cycles. The launcher writes
`cycles.json.session_stop_reason="user-cancelled"` and stops triggering new
cycles.

### 13.5 Infinite-loop guard

The combination of §13.1 + §13.2 + §13.3 + the extraction-depth budget (§6.2)
makes infinite loops impossible. Verified against arXiv:2607.01641 IAL-Scan.

---

## 14. Conventions (enforce)

| Area | Rule |
|------|------|
| Verdict vocabulary | 3-state UPPERCASE: `ADVANCE` / `REFUTE` / `INCONCLUSIVE` (within-cycle, per design decision). Loop-acceptance verdict: `FORGE` / `REJECT` / `NEEDS-FIELDWORK` (between cycles, per authored loop). |
| Constraint types | `MUST_RESPECT` / `MUST_AVOID` / `MUST_TEST`. Maps 1:1 to verdicts. |
| Typed ports | Every LOOP.md header has a `ports:` block. COMPOSE/CONFLICT/ORTHOGONAL verdict is computed from port-matching. |
| Extraction depth | Every LOOP.md header has `remaining_extraction_depth` (default 3, tunable). |
| last_step vocabulary | Every LOOP.md declares its own `last_step_vocabulary`; the canary oracle runs against this, not cd-review §10.7's. |
| Lineage block | Every LOOP.md ends with a `## Lineage` section. Forbids self-composition and parent-mutation. |
| Loop IDs | `loop-NNN` (e.g., `loop-007`). Globally unique across loop-forge runs. |
| Run IDs | `runs/YYYY-MM-DD-LNNN/` (`L` prefix for Loop, to disambiguate from brainstorm's `C` cycle-scope). |
| Idea IDs | `I-{LOOP_NUM}-{NNN}` (e.g., `I-007-003` = idea 3 of loop-forge cycle 7). |
| Constraint IDs | `C-{LOOP_NUM}-{NNN}` for cycle constraints; `C-{LOOP_NUM}-can-NN` for canonical invariants. |
| Token budget | Scout: 350k target / 380k kill-switch. Deep: ~727k over 2 spawns. |
| Wave parallelism | Ω: 2 sequential slots. α: N=10 (5 personas × 2 seeds). β: M=5 (= shortlist cap). γ: γ=2 SEQUENTIAL. δ: orchestrator solo. ε: orchestrator + 1 spawned target. |
| Single model | Exigo is grok-only. Anti-sycophancy is structural (persona + rubric + temperature: 0.3 Judge, 0.7 workers). |
| History | `runs/YYYY-MM-DD-LNNN/` folders are immutable. `archive/` is the only cross-loop memory. |

---

## 15. History

| Date | Note |
|------|------|
| 2026-07-25 | Initial loop authored via the brainstorm workflow (Wave α: 10 parallel subagents, 5 personas × 2 seeds → 47 design ideas; Wave β: 5 parallel research subagents → 4 ADVANCE + 1 INCONCLUSIVE; Wave γ: 2 sequential synthesis subagents → 6 constraints + 5 canonical invariants). Mid-task extraction: `agents/loop-compose/` extracted as sibling loop. Design rationale preserved under `agents/loop-forge/_meta-session/`. Modeled on `agents/cd-review/LOOP.md` + `agents/brainstorm/LOOP.md` — same two-layer harness, same wave separation, same RECORD + day-status resume contract. Adapted for authoring (rather than critical review or divergent idea-generation): 6 waves (Ω recon / α design / β verify / γ synthesize / δ author / ε ship-gate) replace 3 waves; persona×seed matrix scales to design decisions; loop-portfolio + loop-novelty + loop-constraints + forge-status archives replace per-cycle archives; mid-task extraction protocol + composition protocol + canary ship-gate are new primitives unique to loop-forge. |
