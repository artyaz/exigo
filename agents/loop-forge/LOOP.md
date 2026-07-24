# Loop Forge (`loop-forge`)

Continuous **discover → brainstorm → draft → pre-merge review → ship →
record → optional self-extend** loop whose product is **other loops**.
Designed to run **autonomously in a sealed environment with no human
access to execution**, exactly like `cb-review`. The protocol assumes
the agent will be killed, rate-limited, OOM-killed, or context-exhausted
at any point and must be able to resume cleanly from on-disk artifacts
alone.

This loop is **universal**: it does not assume GitHub, code, research,
lessons, or any specific problem domain. Each run discovers its own
domain by interrogating the trigger brief and the environment it lands
in. The agent decides what autonomy surface the new loop needs, what
external systems it must speak to, what side effects it owns, and what
its waves are.

This file is the **single source of truth** for the loop. Dated run
artifacts live under:

```text
agents/loop-forge/YYYY-MM-DD/
```

---

## 0. Why this loop exists

A **skill** is a capability the agent invokes once to do a unit of work
and then returns. A **loop** is a long-running, self-driving process
whose whole point is to keep going — across crashes, rate limits,
context exhaustion, and side-effect retries — **without a human
re-triggering it**. The difference is not "bigger skill"; it is a
different operating contract:

| | Skill | Loop |
|---|---|---|
| Trigger | Agent decides to call it | Scheduler / launcher / self-handoff |
| Lifetime | One shot | Until a terminal state (`complete` / `fatal_blocked`) |
| Side effects | Bounded, inside the call | Open-ended; idempotent retries required |
| Human | Allowed (the agent is in the loop) | **Forbidden** by contract |
| Resume | Caller retries the skill | The loop resumes itself from `day-status.json` |
| Composition | Called by an agent | **Combineable** with other loops via declared inputs/outputs |

`loop-forge` exists because writing a loop by hand is error-prone: the
hard parts are not the wave content, they are the **autonomy invariants**
(no-human rule, crash-safe resume, idempotent side effects, declared
inputs/outputs) and the **combineability contract** (so a future loop
can chain to this one). This loop forces every one of those concerns to
be decided explicitly, reviewed by subagents through autonomy /
combineability / universality lenses, and then shipped as a working
loop.

This loop is also **recursive**: it can spawn a smaller `loop-forge`
run **mid-task** if the agent realises the loop it is drafting would
benefit from a sibling loop (see §7.6, Wave E). The new loop ships
first, then the in-progress loop imports it.

---

## 0.5 Harness: optional CLI layer, mandatory single-agent fallback

The original `cb-review` harness assumed a two-layer model: a launcher
session that spawns a separate day-scope CLI agent as a peer process.
That works when the host can background a CLI and poll it. It does not
work when:

- the loop is invoked from inside an agent that has its own subagent
  primitive but no way to spawn a peer process;
- the sealed environment has no TTY, no `setsid`, or no `disown`;
- the only available agent CLI is the one currently running us.

In those cases the loop **must still work** — autonomy is the hard
requirement. So: **the CLI peer layer is OPTIONAL.** The mandatory
baseline is a single agent that owns the whole loop and fans out waves
via its in-process subagent primitive only.

### 0.5.1 Roles

| Layer | How it starts | Job | When to use |
|-------|---------------|-----|-------------|
| **Launcher (L‑1)** | User or scheduler triggers `scripts/loop-forge-autonomous.sh` | Resolve run, detect harness, spawn/wake the day-scope agent, poll status only | **Optional.** Only when the host can spawn a peer CLI process. |
| **Day-scope agent (L0)** | Spawned by launcher OR invoked directly by a scheduler as the only agent | Execute this `LOOP.md` end-to-end: waves, subagents, verify, Wave D, ship, optional Wave E, record | **Always.** In single-agent mode this is the only layer. |

Subagents of the day-scope agent (Wave A/B/C/D/E workers) stay as
described in §3 — they do **not** replace the day-scope agent and do
**not** spawn their own children. **The only exception is Wave E
self-extension**, which is allowed to spawn one nested `loop-forge`
run as a sibling (see §7.6.2 for the strict handoff contract).

### 0.5.2 Mode detection

`scripts/loop-forge-autonomous.sh` writes a mode marker to
`$RUN_ROOT/audits/harness-mode.json` before spawning:

```json
{
  "mode": "cli_layer | single_agent",
  "agent_cli": "grok | claude | codex | aider | self",
  "max_runtime_seconds": 43200,
  "max_wakeups": 8,
  "scope_hint": "loop-forge:research-survey",
  "detected_at": "ISO-8601"
}
```

The day-scope agent reads this file first and adapts:

- `cli_layer`: behave as the **day-scope agent** — full working context,
  ship via §10.2. The launcher owns re-wake.
- `single_agent`: behave as **both** launcher and day-scope. The agent
  itself decides scope, runs waves, ships, and on context-exhaustion
  leaves a precise `Stopped at` so the next invocation resumes cleanly.

### 0.5.3 No-human rule (hard)

Regardless of mode:

- **Do not pause to ask "should I continue?"** Continue, ship, or set
  `day-status.json` `state=fatal_blocked` with a precise `blocked_reason`
  and exit non-zero.
- **Do not print "waiting for user" and stop.** That is a bug in the
  agent, not a protocol state.
- **Do not require a human to merge a PR.** If branch protection allows
  the bot token to merge, the agent merges. If not, the agent ships to
  a working branch and treats that branch as the ship surface until the
  protected branch is unblocked — and records the unblock as an
  outstanding side effect that the next run picks up.
- **Do not require a human to retrigger any external reviewer or CI.**
  The agent re-polls, re-posts `@reviewer handle`, or works around the
  silence per the resilience policy in §10.6.

### 0.5.4 Progress file (mandatory, crash-safe)

`$RUN_ROOT/audits/day-status.json` — launcher-readable AND resume-source:

```json
{
  "state": "running|shipping|waiting_external|blocked|fatal_blocked|complete|budget_exhausted|self_extending",
  "scope_id": "forge-1",
  "last_step": "machine-readable step (see §10.7 for the step vocabulary)",
  "branch": "loop/new-loop-name",
  "prs": { "develop": 123, "main": 124 },
  "wave_d_round": 1,
  "wave_e_active": false,
  "wave_e_run_root": null,
  "new_loops_spawned": [],
  "blocked_reason": null,
  "resume_hint": "one-line instruction for the next wake",
  "updated_at": "ISO-8601"
}
```

Update this file **before** any expensive or side-effecting step (push,
PR open, merge, sleep, Wave E spawn) so a crash mid-step is recoverable.
The state machine in §10.7 is the canonical list of `last_step` values.

---

## 1. Starting clean (new day / new run)

When invoked with no `--resume` and no prior `$RUN_ROOT`:

### 1.1 Create today's directory

```bash
DATE=$(date -u +%Y-%m-%d)
ROOT=agents/loop-forge/$DATE
mkdir -p "$ROOT/audits/discover" "$ROOT/audits/designs" \
         "$ROOT/audits/drafts" "$ROOT/audits/pre-pr" \
         "$ROOT/audits/self-extend"
```

### 1.2 Scaffold `RECORD.md` from §8.1

### 1.3 Scaffold `audits/discover/brief.md` from the trigger brief

The trigger brief is whatever the launcher handed the agent — a single
sentence ("build a loop that surveys research papers on X weekly"), a
file path, a URL, or a continuation hint from a prior run. Persist it
verbatim in `audits/discover/brief.md` before doing anything else so a
crash does not lose the original ask.

### 1.4 Do **not** delete previous date folders

### 1.5 Set `RUN_ROOT=agents/loop-forge/YYYY-MM-DD` in every brief

### 1.6 Initialize `day-status.json`

```json
{
  "state": "running",
  "scope_id": "forge-1",
  "last_step": "init",
  "branch": null,
  "prs": { "develop": null, "main": null },
  "wave_d_round": 0,
  "wave_e_active": false,
  "wave_e_run_root": null,
  "new_loops_spawned": [],
  "blocked_reason": null,
  "resume_hint": "run wave A: discover loop requirements from brief",
  "updated_at": "ISO-8601"
}
```

---

## 2. North-star and non-goals

### North-star (ordered)

| # | Criterion |
|---|-----------|
| 1 | **Autonomy** — the produced loop must run end-to-end with no human in the loop, under the same crash / rate-limit / context-exhaustion assumptions as `cb-review`. |
| 2 | **Combineability** — the produced loop declares its inputs, outputs, and side-effect surface so another loop (including this one) can chain to it without re-reading its source. |
| 3 | **Universality** — the produced loop is not artificially scoped to one tool, one platform, or one domain unless the trigger brief explicitly demands it. Domain specifics live in the loop's own §11, not in the wave logic. |
| 4 | **Resilience** — the produced loop is crash-safe: `day-status.json` is the source of truth, side effects are idempotent, shipped work is never re-run. |
| 5 | **Readability** — the produced `LOOP.md` is shorter and clearer than the alternative of doing the task by hand every time. If it isn't, the loop should not exist. |

When the criteria conflict, **autonomy wins**. A loop that needs a
human to merge a PR is not a loop; it is a skill with extra ceremony.

### Non-goals

- A loop for every recurring task. Some tasks are better as skills. The
  Wave A discover step must explicitly justify "why a loop, not a
  skill?" — if the justification is weak, the run aborts with
  `state=complete, reason=not_a_loop`.
- Loops that re-implement existing loops. Wave B must check
  `loops/*.md` and `agents/*/LOOP.md` for an existing loop that already
  covers the ask. If found, the run aborts with
  `state=complete, reason=existing_loop:<name>`.
- Loops whose only purpose is to invoke another loop. Use the
  combineability contract (§11) to chain instead.
- General-purpose "agent glue" — the loop must have a concrete,
  nameable purpose that fits in one sentence. Wave A enforces this.

---

## 3. Architecture (strict wave separation)

```text
┌─────────────────────────────────────────────────────────────────┐
│  L-1  LAUNCHER (optional; cli_layer mode only)                  │
│  scripts/loop-forge-autonomous.sh                               │
│  detect harness · spawn/wake peer · poll day-status.json only   │
└────────────────────────────┬────────────────────────────────────┘
                             │ peer CLI process (grok/claude/codex/…)
                             ▼  ── OR (single_agent mode) ──
┌─────────────────────────────────────────────────────────────────┐
│  L0  DAY-SCOPE ORCHESTRATOR (no human in the loop)              │
│  create/select run dir · dispatch waves · consolidate · verify  │
│  Wave D pre-PR review · ship · Wave E self-extend (optional)    │
│  update RECORD.md + day-status.json after every step            │
└────────────────────────────┬────────────────────────────────────┘
                             │ in-process subagents
          ┌──────────────────┼──────────────────┬─────────────────┐
          ▼                  ▼                  ▼                 ▼
   WAVE A — DISCOVER   WAVE B — DESIGN    WAVE C — DRAFT   WAVE D — PRE-PR REVIEW
   (N agents)          (M agents)         (1 agent)        (4 lenses, parallel)
   Requirements        Decision packages  LOOP.md +        Autonomy / combine /
   + autonomy audit    + combineability   REVIEW-LENS +    universality / resilience
   + existing-loop     contract sketch    pointer +        review of the draft
   check               + wave sketch      entry script
   Write discover/*    Write designs/*    Write drafts/*   Write pre-pr/*
   NO children         NO children        NO children      NO children
                                                                   │
                                                                   ▼
                              WAVE E — SELF-EXTEND (optional, mid-C or post-D)
                              spawns ONE nested loop-forge run as a sibling
                              if the in-progress draft would benefit from a
                              sibling loop. Strict handoff contract in §7.6.2.
                              Writes self-extend/*.md.
                              Allowed exactly one child (the nested forge run).
```

| Wave | Agent role | Reads | Writes | Spawns children? |
|------|------------|-------|--------|------------------|
| **A** | Discover requirements + audit autonomy surface | Trigger brief + environment + existing loops | `$RUN_ROOT/audits/discover/{ID}.md` | **No** |
| **B** | Brainstorm loop designs | Discover findings + a sibling `cb-review`-style brainstorm pattern | `$RUN_ROOT/audits/designs/{ID}.md` | **No** |
| **C** | Drafter (single agent) | Master consolidation + chosen design package | Product files: `loops/<name>.md`, `agents/<name>/LOOP.md`, `agents/<name>/REVIEW-LENS.md` (if needed), `scripts/<name>-autonomous.sh` + `$RUN_ROOT/audits/drafts/draft.md` | **No** |
| **D** | Pre-PR reviewer (4 lenses) | Staged diff of all new product files + this LOOP.md as a reference | `$RUN_ROOT/audits/pre-pr/{LENS-N}.md` | **No** |
| **E** | Self-extend (optional) | Mid-C or post-D realisation that a sibling loop would help | `$RUN_ROOT/audits/self-extend/{ID}.md` + a new `loop-forge` run | **Yes — exactly one nested `loop-forge` run** (see §7.6.2) |

**L0** is the only layer that decides sequencing, consolidates, ships,
and re-dispatches waves. **L‑1** (when present) only scopes work and
keeps the day agent alive until that scope closes.

---

## 4. Default discover map

`loop-forge` does not have a fixed slice map (it has no codebase to
slice). Instead, Wave A fans out across the following **discover
dimensions** — one subagent per dimension, parallel, no children:

| ID | Dimension | Questions to answer |
|----|-----------|---------------------|
| **D1** | Trigger & cadence | One-shot? Scheduled? Event-driven? What event? What is the realistic run frequency? |
| **D2** | Domain & inputs | What does the loop read? Code? APIs? Files? Messages? Sensors? What format? What volume? |
| **D3** | Outputs & side effects | What does the loop produce? Where does it write? Are writes idempotent? What is the rollback story? |
| **D4** | External systems | Git host? Issue tracker? CI? LLM provider? Vector store? What auth? What rate limits? What failure modes? |
| **D5** | Autonomy surface | What decisions must the agent make per run? What decisions could be deferred to a human? (Wave A argues for autonomy; the human path is recorded as `non_goal` if rejected.) |
| **D6** | Existing loops | Scan `loops/*.md` + `agents/*/LOOP.md`. Does any existing loop cover this? Should this extend, fork, or compose with one? |
| **D7** | Combineability surface | What inputs should this loop accept from a caller? What outputs should it expose to a caller? What side effects are visible to other loops? |
| **D8** | Termination & success | When is the loop `complete`? When is it `fatal_blocked`? What is the minimum viable wave set? |

Scale: one agent per dimension. If the trigger brief is very small
(e.g. "make a loop that does X"), D1–D4 may collapse into one agent.
If the trigger brief names a complex domain (e.g. "make a loop that
manages a Kubernetes cluster"), D4 may split per external system.

---

## 5. Wave A — Discover (requirements + autonomy audit)

### 5.1 Disposition

- **Assume the trigger brief is underspecified.** Empty acceptance of
  the brief is failure. The agent's job is to interrogate it.
- **Be picky and strict**: missing cadence, vague inputs, undefined
  success criteria, hidden human dependencies, undeclared side effects,
  combineability hazards.
- **Write findings into `discover/`.** Do **not** spawn design agents.
  Do **not** propose loop architectures — that is Wave B.
- Minimal "what a fix might look like" one-liners are OK inside findings
  for later designers.

### 5.2 Reviewer brief (template)

```text
You are a WAVE A discover agent for loop-forge.
RUN_ROOT={RUN_ROOT}
DIMENSION={DIMENSION_ID}
TRIGGER_BRIEF (verbatim from $RUN_ROOT/audits/discover/brief.md):
{BRIEF}

ASSUME the brief is underspecified. Real gaps exist (vague cadence,
undeclared inputs, hidden human dependencies, combineability hazards).
Your job is to catch them, not to soothe.

NORTH STAR: autonomy → combineability → universality → resilience → readability.

RULES
- Read the brief and every file in $RUN_ROOT/audits/discover/ that
  already exists. Read existing loops: loops/*.md and agents/*/LOOP.md.
- Do NOT propose a loop design — that is Wave B.
- Do NOT edit product code or existing loops.
- Do NOT spawn subagents.
- Write ONLY to {RUN_ROOT}/audits/discover/{DIMENSION_ID}.md

ADVERSARIAL TRICKS (use all)
- Pre-mortem: "the loop runs once, then a human has to intervene — why?"
- Rubber-duck the trigger brief in one sentence. If you cannot, the
  brief is ambiguous.
- Boundary test: what happens if the input is empty? Infinite? Hostile?
- Auth test: every external system call — who pays for it, who
  authorises it, what happens when the token expires mid-run?
- Resume test: the loop is killed at the worst possible moment. What
  state is recoverable from disk alone?
- Combineability test: another loop wants to call this one. What does
  it need to know that is not in the trigger brief?
- Hidden-human test: list every step that "obviously" needs a human.
  Argue for each one why the loop can do it autonomously, OR record it
  as a non-goal with a precise reason.

OUTPUT format in discover/{DIMENSION_ID}.md
## Dimension {DIMENSION_ID} — {name}
## Brief interpreted
## Findings
### F-{DIMENSION_ID}-{nnn}: title
- Severity: P0|P1|P2|P3
- Category: autonomy|combineability|universality|resilience|readability
- Question raised:
- Evidence (from brief or environment):
- Why it hurts the north star:
- Sketch (1–3 bullets, not a design):
- Effort to resolve in Wave B: S|M|L
## Patterns
## Recommended design constraints (group related findings for Wave B)
## Explicit non-issues

QUOTA: max(5, ceil(brief_lines/3)) findings OR defended clean bill with
checklist evidence.
Return to orchestrator: severity counts + top 3 + list of finding IDs.
```

### 5.3 Severity

| Sev | Meaning |
|-----|---------|
| P0 | The brief is impossible to make autonomous as written (e.g. requires a human to merge a PR and branch protection will not let the bot merge). |
| P1 | The brief is autonomous in principle but missing a critical dimension (cadence, success criterion, or external system) that Wave B must pin down. |
| P2 | The brief is workable but a meaningful combineability / universality concern is unaddressed. |
| P3 | Polish on naming, scoping, or docs. |

### 5.4 Existing-loop check (mandatory)

Before Wave B dispatches, the orchestrator reads `D6` findings. If D6
declares `existing_loop:<name>` with severity P0 (the existing loop
already covers the ask), the orchestrator:

1. Writes `$RUN_ROOT/RECORD.md` "Done" with the duplicate finding ID.
2. Sets `day-status.json` `state=complete`, `reason=existing_loop:<name>`.
3. Exits 0.

A duplicate loop is a worse outcome than no loop — it doubles the
maintenance surface and confuses future Wave D reviewers.

---

## 6. Wave B — Design (decision packages)

### 6.1 Dispatch

After Wave A completes (or after enough dimensions land):

1. Orchestrator clusters findings into design tickets. Each ticket owns
   a set of finding IDs that span multiple dimensions (the typical
   cluster is "D2 inputs + D3 outputs + D5 autonomy surface for one
   sub-problem of the loop").
2. Spawn design agents **in parallel**, each owning a cluster of
   finding IDs.
3. Each agent **reads** the discover findings + cited code/environment
   + existing loops; **writes** `$RUN_ROOT/audits/designs/{DESIGN_ID}.md`.
4. Design agents **do not** edit product code and **do not** spawn
   nested design agents.
5. **Combineability with the brainstorm wave pattern of `cb-review`**:
   a design agent MAY import `agents/cd-review/LOOP.md` §6 as a
   template for "this is what a brainstorm wave inside the new loop
   should look like". The agent does not copy it verbatim; it adapts
   the structure (Decision Package shape, parallel subagent dispatch,
   no-children rule) to the new loop's domain.

### 6.2 Design brief (template)

```text
You are a WAVE B design agent for loop-forge.
RUN_ROOT={RUN_ROOT}
DESIGN_ID={DESIGN_ID}
FINDINGS: {list of F-… from audits/discover}

TASK
Read the discover findings and the cited environment. Propose 2–3 loop
architectures that satisfy the north star (autonomy → combineability →
universality → resilience → readability). Prefer fewer waves over
more; prefer delete over abstract.

RULES
- Do NOT edit product code or existing loops.
- Do NOT spawn subagents.
- Optional: web_search / open docs for SOTA only if the new loop
  touches a domain whose best practice is non-obvious (e.g. streaming
  consensus, distributed locks, LLM eval harnesses).
- Load local skills when useful (brainstorming, coding-guidelines,
  loop-design if present).
- Write {RUN_ROOT}/audits/designs/{DESIGN_ID}.md as a Loop Decision
  Package using the shape in §6.3.

LOOP DECISION PACKAGE must include:
- Recommendation (loop name + 1-sentence purpose + why a loop not a skill)
- Approaches table (pros/cons/north-star score/effort per approach)
- Wave sketch (which waves, what each wave reads/writes, no-children rule)
- Combineability contract (inputs the loop accepts, outputs it exposes,
  side effects visible to other loops — see §11 for the schema)
- Autonomy checklist (every decision point in the loop, with an
  autonomous resolution path — see §12)
- Resilience sketch (idempotent side effects, crash-safe resume,
  exit conditions, terminal-state definitions)
- Universality notes (what is domain-specific and lives in §11 of the
  produced LOOP.md vs. what is universal and lives in the wave logic)
- What NOT to do (anti-patterns for this loop)
- Residual risks
- Skills / research notes
```

### 6.3 Loop Decision Package shape

```markdown
# Loop Decision Package — {DESIGN_ID}

## Recommendation
- Loop name: <name>
- One-sentence purpose:
- Why a loop, not a skill:
- Why not the alternatives:

## Approaches considered
| ID | Name | Pros | Cons | North-star | Effort |

## Wave sketch
| Wave | Reads | Writes | Children? |

## Combineability contract (draft — final form in §11 of the produced LOOP.md)
- Inputs:
- Outputs:
- Visible side effects:

## Autonomy checklist (draft — final form in §12 of the produced LOOP.md)
- Decision: <name> — autonomous resolution: <how>

## Resilience sketch
- Idempotent side effects:
- Crash-safe resume:
- Exit conditions:
- Terminal states:

## Universality notes
- Domain-specific (goes to §11 of produced LOOP.md):
- Universal (stays in wave logic):

## What NOT to do

## Residual risks

## Skills / research
```

---

## 7. Wave C — Draft (execute the chosen design)

### 7.1 Consolidate (orchestrator)

Write `$RUN_ROOT/audits/master.md`:

- Severity totals from Wave A
- Top design packages (autonomy-first)
- Design index (DESIGN_ID → finding → recommendation)
- Chosen design (with rationale; if multiple designs are needed, the
  orchestrator picks one as primary and queues the rest as `deferred`)
- Out of scope / deferred

### 7.2 Drafter brief (template)

Wave C is **single-agent** (no parallelism) because the produced files
must be internally consistent — a `LOOP.md` whose `REVIEW-LENS.md`
disagrees with its wave table is a Wave D P1.

```text
You are the WAVE C drafter for loop-forge.
RUN_ROOT={RUN_ROOT}
TARGET_LOOP_NAME={name}
OWNED FILES:
- loops/{name}.md                  (pointer, like loops/cb-review.md)
- agents/{name}/LOOP.md            (source of truth)
- agents/{name}/REVIEW-LENS.md     (only if Wave D of the new loop will
                                    use lenses — see §7.5.1 of this loop)
- scripts/{name}-autonomous.sh     (headless entry point, modelled on
                                    scripts/cb-review-autonomous.sh)

NORTH STAR: autonomy, combineability, universality, resilience, readability.
Surgical. No features the design package did not call for. No "while we
are here" edits to existing loops.

If a design package exists for the new loop, EXECUTE it — do not
re-litigate design.

Write {RUN_ROOT}/audits/drafts/draft.md with:
- A list of every file written and its line count
- The combineability contract (verbatim from the new LOOP.md §11)
- The autonomy checklist (verbatim from the new LOOP.md §12)
- Any deviations from the design package, with reasons

PRODUCED LOOP MUST CONTAIN (Wave D enforces)
- §0.5 harness with single-agent fallback
- §0.5.3 no-human rule (hard)
- §0.5.4 day-status.json schema
- §1 starting-clean protocol
- §2 north-star (autonomy-first ordering)
- §3 wave architecture (no children except declared exceptions)
- §8 RECORD.md template
- §8.3 continuity invariants (status-before-side-effect, idempotent
  side effects, shipped-work-never-rerun, PR-numbers-persisted,
  RECORD-append-only)
- §10.5 exit conditions (complete | fatal_blocked | budget_exhausted |
  blocked)
- §10.6 rate-limit / flake resilience policy
- §10.7 canonical last_step state machine
- §11 combineability contract (declared inputs/outputs/side effects)
- §12 autonomy checklist (every decision point has an autonomous path)
```

### 7.3 Verify (orchestrator, pre-Wave-D)

1. **Lint the produced LOOP.md** — minimum required sections present
   (§0.5, §0.5.3, §0.5.4, §1, §2, §3, §8, §8.3, §10.5, §10.6, §10.7,
   §11, §12). Missing section = return to Wave C with the gap.
2. **Sanity-check the entry script** — `bash -n scripts/{name}-autonomous.sh`.
3. **Confirm no existing loop is clobbered** — `git status` should show
   only new files, no modifications to `loops/*.md` or `agents/*/LOOP.md`
   outside the new loop's directory. A modification to an existing loop
   is a P1; return to Wave C.
4. **Confirm the pointer resolves** — `loops/{name}.md` must link to
   `agents/{name}/LOOP.md` and the target must exist.
5. On green, write `$RUN_ROOT/audits/verify-draft.md` and proceed to §7.5.

### 7.5 Wave D — Pre-PR subagent review (mandatory before ship)

**Why:** Just like `cb-review`'s Wave D, a 5-minute internal review by
N parallel subagents — each looking through a different lens — catches
the bulk of P0/P1 issues before the PR exists. The lenses here are
**loop-quality lenses**, not code-quality lenses.

Wave D is **not** a replacement for any external reviewer that may run
on the PR. It is a cheap parallel pre-filter.

#### 7.5.1 Lenses

| Lens | Focus |
|------|-------|
| **L1** | **Autonomy completeness** — every decision point in the produced loop has an autonomous resolution path; no "ask a human" stubs; no hidden HITL dependencies (e.g. a merge step that assumes branch protection will let the bot merge without checking). |
| **L2** | **Combineability** — the produced loop's §11 contract is precise enough that another loop can call it without re-reading its source; inputs/outputs/side effects are explicit; chaining hazards are called out. |
| **L3** | **Universality** — the produced loop is not artificially scoped to one tool or platform; domain specifics live in §11, not in the wave logic; the loop's name and one-sentence purpose are tool-agnostic. |
| **L4** | **Resilience** — `day-status.json` schema is crash-safe; side effects are idempotent; shipped-work-never-rerun invariant holds; exit conditions and terminal states are well-defined; rate-limit / flake policy covers every external call. |
| L5 (optional) | **Concision** — only dispatched when the produced `LOOP.md` is over 800 lines. Checks for over-specification, redundant sections, and "ceremony" that should be a skill instead. |

Full lens catalog and reviewer brief template:
`agents/loop-forge/REVIEW-LENS.md`.

#### 7.5.2 Dispatch

For the new loop, fan out 4 (or 5) subagents **in parallel**. Each gets
only its lens brief + the staged diff of all new product files + this
`LOOP.md` as a reference for what a working loop looks like. They do
not see each other.

#### 7.5.3 Consolidation & acceptance gate

Orchestrator reads all `lens{N}.md` files, deduplicates by
`path:lineRange` + root cause (max severity wins), writes a single
`$RUN_ROOT/audits/pre-pr/{LOOP_NAME}.md` with a verdict:

| Verdict | Condition | Action |
|---------|-----------|--------|
| `send_back_to_wave_C` | any P0 or P1 remains | Wave C fixes only the flagged findings; Wave D re-runs on the touched-again files only |
| `fix_and_proceed` | P2 remaining, cheap to fix | orchestrator fixes inline, re-runs Wave D on the touched files |
| `accept_and_ship` | only P3 nits or zero findings | proceed to §10.2 ship |

**Hard cap: 3 Wave D rounds per draft.** If round 3 still has P0/P1:

- Set `day-status.json` `state=fatal_blocked`,
  `blocked_reason=wave_d_round_3_p1`.
- Leave the draft on its branch (NOT merged).
- Write `Stopped at` in `RECORD.md` with the offending finding IDs.
- Exit non-zero per §10.5.

A human (or the next launcher run with a relaxed gate) decides whether
to relax the gate, change the design, or accept the risk.

#### 7.5.4 What Wave D is NOT

- Not a replacement for any external reviewer that may run on the PR.
- Not a design re-open (Wave B already chose the approach; a reviewer
  who thinks the design is wrong raises a P2 "consider revisiting in
  next forge run" finding, not a send-back).
- Not a verify step (§7.3 already passed).
- Not allowed to spawn children.

---

## 7.6 Wave E — Self-extend (optional, mid-C or post-D)

### 7.6.1 When to fire

Wave E fires when the drafter (mid-C) or a Wave D reviewer (post-D)
realises: **"this loop keeps doing X as a sub-step, and X is itself
loop-shaped — X should be its own loop, then this loop chains to it
via the combineability contract."**

Concrete examples:

- Drafting a "research-survey" loop and realising the
  "fetch-and-summarise-one-paper" sub-step is itself loop-shaped (rate
  limits, retries, crash-safe resume across N papers).
- Drafting a "lesson-writing" loop and realising the
  "fact-check-one-claim" sub-step is loop-shaped.
- Drafting a "deploy-and-watch" loop and realising the
  "watch-CI-and-retry" sub-step is loop-shaped.

### 7.6.2 Strict handoff contract

Wave E is the **only** wave allowed to spawn a child. The contract is:

1. The orchestrator sets `day-status.json`:
   - `state=self_extending`
   - `wave_e_active=true`
   - `wave_e_run_root=agents/loop-forge/{NEW_DATE}/` (a new dated run
     for the sibling loop — never reuse the current run)
   - `resume_hint="Wave E in progress: forging sibling loop {name}; resume by reading wave_e_run_root/day-status.json"`
2. The orchestrator spawns **one** nested `loop-forge` run as a
   subagent. The nested run gets a trigger brief of the form:
   ```text
   Sibling-loop request from parent forge run {PARENT_RUN_ROOT}.
   Parent loop: {parent_loop_name}.
   Sub-step that should be its own loop: {description}.
   Why a loop not a skill: {reasoning from Wave E trigger}.
   Combineability contract the parent loop will expect:
   - Inputs: {what the parent will pass in}
   - Outputs: {what the parent will read back}
   - Side effects visible to parent: {list}
   Ship the sibling loop on its own branch + PR. Do NOT modify the
   parent loop's files; the parent will import the sibling via its
   combineability contract in a follow-up wave.
   ```
3. The nested run executes this LOOP.md end-to-end. Its
   `day-status.json` is the source of truth for its own progress.
4. The parent run **does not poll the nested run in tight loop** — it
   sets its own state to `self_extending`, persists
   `wave_e_run_root`, and exits. The next launcher wake reads
   `wave_e_run_root/day-status.json`; if the nested run is terminal
   (`complete` or `fatal_blocked`), the parent resumes; if not, the
   parent goes back to sleep.
5. When the nested run is `complete`, the parent run:
   - Reads the sibling loop's §11 contract from the nested
     `RUN_ROOT/audits/drafts/draft.md`.
   - Updates its own draft (`agents/{parent_loop_name}/LOOP.md` §11)
     to declare the chaining.
   - Re-runs Wave D **only on the touched §11 section** of the parent
     loop (cheap re-review).
   - Records the sibling loop in `day-status.json.new_loops_spawned[]`.
6. **Hard cap: 1 Wave E per parent run.** A run that would need more
   than one sibling loop is too ambitious for one forge run; split it
   into multiple runs and let them chain via the combineability
   contract.

### 7.6.3 Failure modes

| Failure | Policy |
|---------|--------|
| Nested run exits `fatal_blocked` | Parent run records the failure, marks the chaining as `deferred`, continues without the sibling loop. The parent loop's §11 contract notes the sibling as a future extension. |
| Nested run exceeds its own wall-clock budget | Same as `fatal_blocked` from the parent's perspective. The parent does NOT inherit the budget exhaustion. |
| Nested run modifies the parent's files | Protocol violation. Parent run aborts with `state=fatal_blocked`, `blocked_reason=wave_e_boundary_violation`. |
| Parent run context-exhausts while waiting | Next wake reads `wave_e_run_root/day-status.json` and resumes the wait. |

---

## 8. Record track (`RECORD.md`)

Every run **must** maintain `$RUN_ROOT/RECORD.md`. Orchestrator updates it at:

- Run start
- End of each wave
- After each ship step
- Wave E spawn / completion / failure
- Run pause / stop / fatal block

### 8.1 Template

```markdown
# loop-forge RECORD — YYYY-MM-DD

## Status
- State: in_progress | paused | complete | fatal_blocked | budget_exhausted | self_extending
- Mode: cli_layer | single_agent
- Branch: …
- Last updated: ISO timestamp
- Continues from: (prior date or none)
- Wave E active: false | true (sibling: {name}, run: {path})

## Goal this run
…

## Trigger brief (verbatim)
…

## Waves
| Wave | Status | Notes |
|------|--------|-------|
| A Discover | pending/done | N dimensions, N findings |
| B Design | pending/done | N packages, chosen: {name} |
| C Draft | pending/done | files written: … |
| D Pre-PR review | pending/done | rounds: … |
| E Self-extend | not_fired/fired/done | sibling: {name} |
| Verify | pending/done | … |
| Ship | pending/done | PR links |

## Done (chronological)
- …

## In flight
- …

## Stopped at
- Exact next action if resuming: …

## Residual / backlog
- Sibling loops deferred from Wave E
- Combineability gaps noticed during Wave D

## Valuable notes
- Domain-specific gotchas discovered during Wave A
- Existing loops that almost overlapped (record for future D6 agents)
- External systems the new loop speaks to and their quirks
- …

## New loops spawned (Wave E)
- {name}: {run_root}, state: {state}, PR: {link}

## PRs / commits
- …
```

### 8.2 Resume protocol

1. Open latest `agents/loop-forge/*/RECORD.md` (or user-specified date).
2. Read **Stopped at**, **Residual**, and `$RUN_ROOT/audits/day-status.json`.
3. **Launcher (cli_layer):** re-wake a day-scope agent with the residual
   scope. **Single-agent:** continue mid-wave / mid-ship / mid-Wave-E
   without waiting for a human.
4. If `wave_e_active=true`: read `wave_e_run_root/day-status.json`; if
   the nested run is terminal, resume the parent's post-E flow;
   otherwise go back to sleep (the launcher will re-wake later).
5. Continue that run **or** create a new dated folder (§1) and link
   "continues from".
6. Never invent status — update RECORD (and day-status) after every
   material step.

### 8.3 Continuity invariants (hard)

These are the same invariants as `cb-review`, restated for `loop-forge`:

1. **`day-status.json` is written before side effects.** Before any
   `git push`, `gh pr create`, `gh pr merge`, reviewer re-trigger
   comment, or Wave E spawn, update `last_step` + `state` first. If
   the process dies during the side effect, the next wake sees the
   in-flight step and re-runs it idempotently.
2. **Side effects are idempotent.** `git push --force-with-lease` is
   safe to retry. `gh pr create` for an existing branch is a no-op
   (check first via `gh pr list --head`). `gh pr merge --squash` on an
   already-merged PR returns a benign error. Reviewer re-trigger
   comments are safe to re-post. Wave E spawn is idempotent because
   `wave_e_run_root` is fixed at spawn time; re-spawning writes to
   the same path.
3. **Shipped waves are never re-run.** Each wave's output directory is
   checked on resume: if `audits/discover/*` has content, Wave A is
   skipped; if `audits/designs/*` has content and a master.md exists,
   Wave B is skipped; if `audits/drafts/draft.md` exists with the
   produced files in `git status`, Wave C is skipped; if
   `audits/pre-pr/{LOOP_NAME}.md` exists with `accept_and_ship`,
   Wave D is skipped.
4. **PR numbers are persisted.** `day-status.json` `prs` field holds
   `{develop, main}` PR numbers. On resume, the orchestrator re-opens
   those PRs by number rather than creating new ones.
5. **RECORD.md is append-only within a run.** Never rewrite history
   sections; only update `Status`, `Waves`, `In flight`, `Stopped at`,
   `New loops spawned`.
6. **Wave E run roots are immutable.** Once `wave_e_run_root` is set,
   it does not change for the lifetime of the parent run. The nested
   run's `day-status.json` is the only source of truth for the nested
   run's progress; the parent never writes to it.

---

## 9. Skills registry (design wave)

| Class | Prefer |
|-------|--------|
| Loop structure | This `LOOP.md` + `agents/cd-review/LOOP.md` as reference |
| Brainstorm pattern | `agents/cd-review/LOOP.md` §6 (Wave B template) |
| Clarity / simplicity | Karpathy / coding-guidelines |
| Domain-specific | Whatever the discover wave surfaces — the design agent loads local skills for the new loop's domain |
| Combineability | This `LOOP.md` §11 + §12 as the schema |

Local skill paths when present: `~/.agents/skills/brainstorming`,
`coding-guidelines`, `loop-design` (if it exists; this loop may
eventually bootstrap it via Wave E).

---

## 10. Orchestrator checklist & ship protocol

### 10.0 Launcher checklist (L‑1, cli_layer mode only)

```text
[ ] loop-forge-autonomous.sh invoked (or scheduler tick equivalent)
[ ] Harness mode detected and written to harness-mode.json
[ ] Day-scope agent spawned as a peer process (or single-agent handoff done)
[ ] day-status.json / RECORD polled only (no full worker transcript)
[ ] If worker stops early and state != terminal: wake with resume brief
[ ] If state == fatal_blocked: surface to scheduler; do NOT auto-retry
[ ] If state == self_extending: read wave_e_run_root/day-status.json
    and re-wake only when the nested run is terminal
[ ] If state == complete: exit 0
```

### 10.1 Day-scope checklist (L0, both modes)

```text
[ ] Read LOOP.md §0.5 (mode) + §10.7 (state machine) + §10.5 (exit conditions)
[ ] Read harness-mode.json → set MODE
[ ] Create or select RUN_ROOT (agents/loop-forge/YYYY-MM-DD)
[ ] RECORD.md scaffolded / updated; day-status.json current
[ ] audits/discover/brief.md written (verbatim trigger brief)
[ ] Wave A: dispatch all dimension discoverers (parallel, no children)
[ ] Existing-loop check (§5.4) — abort if duplicate
[ ] Collect audits/discover/*
[ ] Wave B: dispatch designers on findings (parallel, no children)
[ ] Collect audits/designs/*
[ ] Consolidate master.md + chosen design
[ ] Wave C: drafter writes the new loop's files
[ ] Verify (§7.3) → audits/verify-draft.md
[ ] Wave D: dispatch 4-lens reviewers (§7.5) → audits/pre-pr/{LOOP_NAME}.md
[ ] Acceptance gate (§7.5.3) — send back, fix-and-proceed, or accept-and-ship
[ ] Wave E (optional, §7.6) — fire if criteria met; one nested forge run only
[ ] Ship (§10.2) — land develop → Wave D → PR main → external-reviewer
    iterate → merge main
[ ] RECORD.md: done / residual / stopped at / new loops spawned;
    day-status complete or blocked
```

### 10.2 Ship protocol (per new loop, after Wave D acceptance)

Runs **autonomously** inside the day-scope agent. Do **not** skip
external-reviewer waits. Do **not** invent a new dated run folder
unless the launcher scoped a new day.

```text
1. LAND ON DEVELOP
   - Push the product branch (force-with-lease if rebasing).
   - Open or reuse PR: product branch → develop.
     (Check `gh pr list --head loop/{name} --base develop` first;
     create only if none exists.)
   - Ensure CI green before merge when protection requires it. If CI
     fails, fix on the branch and re-push — do NOT ask a human.
   - Merge into develop (squash or merge per repo default).
   - Update day-status: state=shipping, last_step="develop_merged",
     prs.develop=<number>.

2. OPEN PR INTO MAIN
   - Open or update PR: develop → main (or the cumulative product branch
     → main if that is the active ship path for this forge run).
   - Body: trigger brief + design package summary + Wave D verdict +
     combineability contract (verbatim from the new LOOP.md §11) +
     autonomy checklist summary (from §12) + Wave E notes (if any).
   - Update day-status: last_step="main_pr_open", prs.main=<number>.

3. EXTERNAL REVIEWER WAIT + ITERATION (mandatory loop, see §10.6)
   The repo may have CodeRabbit, another bot reviewer, or no automated
   reviewer. Detect by reading .coderabbit.yaml / .github/workflows/.
   - If an automated reviewer exists: behave exactly like cb-review
     §10.2 step 4 — poll, re-trigger via `@reviewer handle` after 30m
     of silence, fix findings, push, re-poll, ≤5 rounds.
   - If no automated reviewer exists: wait for CI to go green, then
     proceed to step 5. Do NOT invent a human reviewer — there is none
     by the autonomy contract.

4. (skipped — folded into step 3 above)

5. MERGE INTO MAIN
   - Merge the main PR when CI is green and reviewer residual is empty
     (or accepted with reason in RECORD).
   - The agent's GitHub token has merge permission on this repo (same
     as cb-review §10.4); do NOT wait for a human to merge.
   - Update day-status: state=running (continue to next loop in scope)
     or complete (if last loop), last_step="main_merged".

6. CONTINUE NEXT PART OF SCOPE
   - Update RECORD.md: ship links, residual, next loop id;
     day-status.json.
   - Stay under the same RUN_ROOT for the day scope.
   - Continue remaining loops without human approval, then ship again
     via this section.
   - If day scope is closed: set day-status state=complete and stop
     cleanly (§10.5).
   - If you must stop early: set blocked/stopped_at precisely so the
     launcher (or next single-agent wake) can resume.
```

**Branch naming:** `loop/{new-loop-name}`.

**PR hygiene:** one PR per new loop. Do not bundle multiple new loops
into one PR — it breaks the Wave D re-review scope and confuses
external reviewers.

### 10.3 External reviewer interaction primitives

Same as `cb-review` §10.3 — use `gh` CLI directly (no MCP). All
commands are idempotent. If `gh` is unavailable, fall back to `curl`
with `GITHUB_TOKEN`. The agent MUST handle GitHub rate limits
(403/429 with `X-RateLimit-Reset`) by sleeping until reset + 60s, not
by exiting.

### 10.4 Auth & merge permission

The loop runs with a GitHub PAT (`github_pat_…`) that has `repo` +
`workflow` scope on the target repo. This token can push to working
branches, open PRs into `develop` and `main`, merge PRs, post comments,
resolve review threads, and delete product branches after merge.

If the token's permissions are revoked or scoped down, the agent
detects this on the first `gh` call (403 with `insufficient_permission`
or 401) and sets `state=fatal_blocked`,
`blocked_reason=github_token_scope`. This is fatal because no amount
of retrying fixes a permission issue.

### 10.5 Exit conditions (hard, autonomous)

The day-scope agent exits in exactly one of these states. The launcher
or scheduler reads `day-status.json.state` and decides whether to
re-wake.

| state | meaning | launcher action |
|-------|---------|-----------------|
| `complete` | all loops in scope shipped + merged to main | exit 0; optionally start next scope |
| `budget_exhausted` | wall-clock or wakeup budget hit mid-scope | re-wake once with resume brief; if it exhausts again, escalate to scheduler |
| `blocked` | transient issue (rate limit, CI flake, reviewer silent, 5xx) that should resolve with time | re-wake after a cooldown (default 15 min) up to `max_wakeups` |
| `fatal_blocked` | permanent issue (token scope, missing secret, Wave D round 3 P1, design deadlock, Wave E boundary violation) that no retry will fix | do NOT auto-retry; surface to scheduler for human triage |
| `self_extending` | Wave E in progress; parent is waiting on a nested forge run | re-wake only when `wave_e_run_root/day-status.json.state` is terminal (`complete` or `fatal_blocked`) |

**Forbidden exits:**

- Exiting with `state=running` and no `last_step` update → protocol
  violation. The next wake treats this as a crash and resumes from the
  last persisted `last_step`.
- Exiting with `state=shipping` or `state=waiting_external` for more
  than 90 minutes without a `last_step` change → treated as `blocked`
  by the launcher (stall detection).
- Exiting with `state=self_extending` and no `wave_e_run_root` set →
  protocol violation; treat as `fatal_blocked`.

### 10.6 Rate-limit & flake resilience policy (summary)

Same shape as `cb-review` §10.6, with one addition for Wave E:

| Failure | Policy |
|---------|--------|
| GitHub 403/429 (rate limit) | sleep until `X-RateLimit-Reset` + 60s; retry. Record in RECORD. |
| GitHub 5xx | exponential backoff 30s→60s→120s→300s, max 3; then `blocked` + 15m cooldown. |
| `gh` CLI 401/403 (token scope) | `fatal_blocked`, `blocked_reason=github_token_scope`. No retry. |
| External reviewer silent >30m | `@reviewer handle` comment; sleep 5m; re-poll. |
| External reviewer silent after 3 re-triggers (90m) | `blocked`, `blocked_reason=reviewer_silent`; exit for re-wake. |
| External reviewer round 5 residual | `blocked`, `blocked_reason=reviewer_round_5`; exit for re-wake. |
| Wave D round 3 P0/P1 | `fatal_blocked`, `blocked_reason=wave_d_round_3_p1`. |
| Wave E nested run `fatal_blocked` | Parent: mark chaining as `deferred`, continue without sibling. Record in RECORD. |
| Wave E nested run modifies parent files | Parent: `fatal_blocked`, `blocked_reason=wave_e_boundary_violation`. |
| Wave E nested run exceeds budget | Parent: treat as `fatal_blocked` from nested; mark `deferred`. |
| `git push` rejected (non-fast-forward) | `git fetch` + `git rebase origin/develop`; retry. If conflict: `blocked`, `blocked_reason=merge_conflict`. |
| Subagent spawn fail | retry once; then treat that wave as `blocked` and skip to next independent design; record in RECORD. |
| Agent process crash (cli_layer) | launcher re-wakes with resume brief; `max_wakeups` cap. |
| Agent context exhaustion (single_agent) | leave `last_step` + `resume_hint`; next scheduler tick resumes. |

### 10.7 Ship state machine (canonical `last_step` values)

These are the only valid `last_step` strings. The orchestrator writes
one before each side effect so a crash is recoverable:

```text
init
wave_a_dispatched
wave_a_collected
existing_loop_check_passed
wave_b_dispatched
wave_b_collected
master_consolidated
wave_c_dispatched
wave_c_collected
verify_draft_done
wave_d_dispatched:round_{N}
wave_d_collected:round_{N}
wave_d_verdict:{send_back|fix_and_proceed|accept_and_ship}
wave_e_triggered:{sibling_loop_name}
wave_e_poll:{sibling_loop_name}
wave_e_done:{sibling_loop_name}
wave_e_deferred:{sibling_loop_name}
develop_pushed
develop_pr_open:{PR_NUMBER}
develop_ci_green:{PR_NUMBER}
develop_merged:{PR_NUMBER}
main_pr_open:{PR_NUMBER}
ext_poll_{N}:{PR_NUMBER}
ext_comment_posted:{PR_NUMBER}
ext_round_{N}_fix_pushed:{PR_NUMBER}
main_ci_green:{PR_NUMBER}
main_merged:{PR_NUMBER}
next_loop
scope_complete
```

Resume logic: the orchestrator reads `last_step`, finds it in the list
above, and resumes from the **next** step. Side effects are idempotent
(§8.3) so re-running a step is safe.

---

## 11. Combineability contract (mandatory section of every produced loop)

Every loop produced by `loop-forge` MUST declare a combineability
contract in its own `LOOP.md` §11, using the schema below. This is
what makes loops combineable — a future loop (or a future Wave E
sibling) can read §11 and decide whether to chain without re-reading
the rest of the loop.

### 11.1 Schema

```markdown
## 11. Combineability contract

### Inputs (what a caller may pass in)
| Input | Type | Required | Source | Notes |
|-------|------|----------|--------|-------|
| {name} | {type} | yes/no | env var / file / arg / upstream-loop-output | … |

### Outputs (what a caller may read back)
| Output | Type | Location | Lifecycle | Notes |
|--------|------|----------|-----------|-------|
| {name} | {type} | $RUN_ROOT/... | persisted / ephemeral | … |

### Visible side effects (what a caller must tolerate)
| Effect | Trigger | Idempotent? | Rollback |
|--------|---------|-------------|----------|
| {e.g. opens a PR} | every run | yes (check gh pr list first) | close the PR |
| {e.g. writes to a vector store} | every wave C | yes (upsert by id) | delete by id |

### Chaining patterns
- **Sequential**: caller runs this loop to `complete`, then reads
  outputs, then runs the next loop.
- **Pipelined**: caller runs this loop with `--resume` semantics; the
  next loop polls this loop's `day-status.json` and starts when state
  is `complete`.
- **Sibling (Wave E)**: another `loop-forge` run spawned this loop as
  a sibling. Parent imports via this contract; do not modify parent's
  files.

### Anti-patterns (do NOT chain this way)
- {e.g. do not call this loop from inside a Wave A subagent — Wave A
  subagents cannot spawn children}
- {e.g. do not assume this loop's outputs are stable across runs —
  re-read §11 each time}
```

### 11.2 Why this section is mandatory

Without §11, a loop is a closed system. With §11, a loop is a node in
a graph. The whole point of `loop-forge` is to grow that graph — every
produced loop must be a node, not a leaf.

Wave D L2 (combineability lens) enforces that §11 is present, precise,
and matches the loop's actual behaviour.

---

## 12. Autonomy checklist (mandatory section of every produced loop)

Every loop produced by `loop-forge` MUST declare an autonomy checklist
in its own `LOOP.md` §12. This is the section that makes the
no-human rule (§0.5.3) auditable rather than aspirational.

### 12.1 Schema

```markdown
## 12. Autonomy checklist

Every decision point in this loop has an autonomous resolution path.
If a path is missing, the loop is `fatal_blocked` (not "ask a human").

| Decision | Autonomous resolution | Fallback if resolution fails |
|----------|----------------------|------------------------------|
| {e.g. should I continue after Wave A?} | yes, always — Wave B always runs | n/a |
| {e.g. should I merge the PR?} | yes if CI green + reviewer residual empty | blocked, not fatal — re-poll |
| {e.g. is the design right?} | Wave B chose; Wave D reviews; do not re-open | if Wave D round 3 P1 → fatal_blocked |
| {e.g. what if the token expires?} | detect 401 → fatal_blocked, blocked_reason=token_scope | n/a |

### Hidden HITL hazards (audited by Wave D L1)
- {hazard}: {how this loop avoids it}
- {hazard}: {how this loop avoids it}

### Forbidden "ask a human" stubs
- "Pause and ask the user if …" — forbidden. Use `state=blocked` with
  a `blocked_reason` and let the launcher decide.
- "Wait for a human to merge …" — forbidden. Merge if branch
  protection allows; otherwise ship to a working branch and treat it
  as the ship surface.
- "Email the team if …" — forbidden. Record in `RECORD.md` residual
  and continue.
```

### 12.2 Why this section is mandatory

A loop without §12 is a skill with extra ceremony. The checklist forces
the loop author to enumerate every decision point and prove it has an
autonomous path. Wave D L1 (autonomy lens) enforces §12 is present and
every decision point is covered.

---

## 13. Universality notes

`loop-forge` is intentionally universal. The discover wave (§5) is the
only place where domain knowledge enters the loop; everything else
(§6–§10) is domain-agnostic. Specifically:

- **No assumption of GitHub.** The ship protocol (§10.2) uses `gh` and
  GitHub PRs because that is what this repo uses, but a produced loop
  may target any VCS, any issue tracker, any CI. The produced loop's
  §10 declares its own external systems.
- **No assumption of code.** A produced loop may manage research
  papers, lesson plans, infrastructure, mailing lists, or anything
  else. The wave logic (§3) is generic.
- **No assumption of LLMs.** A produced loop may not invoke any model
  at all (e.g. an infrastructure-watch loop that only reads metrics).
- **No assumption of a specific runtime.** `bash` is used for the
  entry script because it is the lowest common denominator; a
  produced loop may use any entry script language.

The only thing `loop-forge` does assume is the **operating contract**
of a loop (§0): long-running, self-driving, no human, crash-safe
resume, combineable. That contract is the whole point.

---

## 14. History

| Date | Note |
|------|------|
| 2026-07-25 | Initial draft of `loop-forge`. Modeled on `agents/cd-review/LOOP.md` with waves adapted from code-review (A=audit) to loop-discovery (A=discover), and an added Wave E self-extension. Combineability contract (§11) and autonomy checklist (§12) made mandatory sections of every produced loop. |

For the first full multi-wave execution and ship history, see the
dated run folders under `agents/loop-forge/YYYY-MM-DD/`.
