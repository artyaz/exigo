# Codebase Review Loop (`cb-review` / `cd-review`)

Continuous **hostile audit → brainstorm → fix → pre-PR review → verify →
ship → record** loop for Exigo. Designed to run **autonomously in a sealed
environment with no human access to execution**. The protocol assumes the
agent will be killed, rate-limited, OOM-killed, or context-exhausted at any
point and must be able to resume cleanly from on-disk artifacts alone.

Primary success metric is **not** “more features.” Optimize for a codebase that is:

1. **Easier to read**
2. **Clearer** (intent and boundaries)
3. **Shorter** where possible (delete > abstract)
4. **Consistent** with advanced in-repo conventions
5. **Correct** (bugs/auth/races) when fixing does not worsen 1–4

Bugs that exist *because* of muddled structure rank higher than clever micro-bugs in otherwise clean code.

This file is the **single source of truth** for the loop. Dated run artifacts live under:

```text
agents/cd-review/YYYY-MM-DD/
```

---

## 0.5 Harness: optional CLI layer, mandatory single-agent fallback

The original protocol assumed a two-layer harness: a **launcher** session
(user-triggered) that spawns a **separate day-scope CLI agent** (peer
process). That works when the host environment can background a CLI and
poll it. It does **not** work when:

- the loop is invoked from inside an agent that has its own subagent
  primitive but no way to spawn a peer process (e.g. a managed runtime,
  a serverless function, an agent harness that sandboxes subprocess
  spawns);
- the sealed environment has no TTY, no `setsid`, or no `disown` and the
  CLI hangs on background;
- the only available agent CLI is the one currently running us.

In those cases the loop **must still work** — autonomy is the hard
requirement. So: **the CLI peer layer is OPTIONAL.** The mandatory
baseline is a single agent that owns the whole loop and fans out waves
via its in-process subagent primitive only.

### 0.5.1 Roles

| Layer | How it starts | Job | When to use |
|-------|---------------|-----|-------------|
| **Launcher (L‑1)** | User or scheduler triggers `scripts/cb-review-autonomous.sh` in an interactive or CI shell | Resolve run, detect harness, spawn/wake the day-scope agent, poll status only | **Optional.** Only when the host can spawn a peer CLI process. |
| **Day-scope agent (L0)** | Spawned by launcher OR invoked directly by a scheduler as the only agent | Execute this `LOOP.md` end-to-end: waves, subagents, verify, Wave D, ship, CodeRabbit iteration, record | **Always.** In single-agent mode this is the only layer. |

Subagents of the day-scope agent (Wave A/B/C/D workers) stay as described
in §3 and §7.5 — they do **not** replace the day-scope agent and do **not**
spawn their own children.

### 0.5.2 Mode detection

`scripts/cb-review-autonomous.sh` writes a mode marker to
`$RUN_ROOT/audits/harness-mode.json` before spawning:

```json
{
  "mode": "cli_layer | single_agent",
  "agent_cli": "grok | claude | codex | aider | self",
  "max_runtime_seconds": 43200,
  "max_wakeups": 8,
  "scope_hint": "wave14",
  "detected_at": "ISO-8601"
}
```

The day-scope agent reads this file first and adapts:

- `cli_layer`: behave as the **day-scope agent** from the original §0.5
  (no human, full working context, ship via §10.2). The launcher owns
  re-wake.
- `single_agent`: behave as **both** launcher and day-scope. The agent
  itself decides scope, runs waves, ships, and on context-exhaustion
  leaves a precise `Stopped at` so the next invocation of the same
  script (or scheduler tick) resumes cleanly.

### 0.5.3 No-human rule (hard)

Regardless of mode:

- **Do not pause to ask "should I continue?"** Continue, ship, or set
  `day-status.json` `state=fatal_blocked` with a precise `blocked_reason`
  and exit non-zero.
- **Do not print "waiting for user" and stop.** That is a bug in the
  agent, not a protocol state.
- **Do not require a human to merge a PR.** Either branch protection
  allows the bot token to merge (it does on this repo — see §10.4) or
  the agent ships to `develop` and treats `develop` as the ship surface
  until main-merge is unblocked.
- **Do not require a human to re-trigger CodeRabbit.** The agent uses
  `@coderabbitai review` via the GitHub API directly (see §10.6) if the
  first pass doesn't land.

### 0.5.4 Progress file (mandatory, crash-safe)

`$RUN_ROOT/audits/day-status.json` — launcher-readable AND resume-source:

```json
{
  "state": "running|shipping|waiting_coderabbit|blocked|fatal_blocked|complete|budget_exhausted",
  "scope_id": "day-scope-1",
  "last_step": "machine-readable step (see §10.7 for the step vocabulary)",
  "branch": "fix/waveN-product",
  "prs": { "develop": 123, "main": 124 },
  "coderabbit_round": 1,
  "wave_d_round": 1,
  "blocked_reason": null,
  "resume_hint": "one-line instruction for the next wake",
  "updated_at": "ISO-8601"
}
```

Update this file **before** any expensive or side-effecting step (push,
PR open, merge, sleep) so a crash mid-step is recoverable. The state
machine in §10.7 is the canonical list of `last_step` values.

---

## 1. Starting clean (new day / new run)

When invoked with no `--resume` and no prior `$RUN_ROOT`:

### 1.1 Create today’s directory

```bash
DATE=$(date -u +%Y-%m-%d)
ROOT=agents/cd-review/$DATE
mkdir -p "$ROOT/audits/slices" "$ROOT/audits/fixes" "$ROOT/audits/pre-pr" "$ROOT/brainstorms"
```

### 1.2 Scaffold `RECORD.md` from §8.1

### 1.3 Scaffold `audits/slices.md` from §4

### 1.4 Do **not** delete previous date folders

### 1.5 Set `RUN_ROOT=agents/cd-review/YYYY-MM-DD` in every brief

### 1.6 Initialize `day-status.json`

```json
{
  "state": "running",
  "scope_id": "day-scope-1",
  "last_step": "init",
  "branch": null,
  "prs": { "develop": null, "main": null },
  "coderabbit_round": 0,
  "wave_d_round": 0,
  "blocked_reason": null,
  "resume_hint": "run wave A on all 11 slices",
  "updated_at": "ISO-8601"
}
```

---

## 2. North-star and non-goals

### North-star (ordered)

| # | Criterion |
|---|-----------|
| 1 | Readability |
| 2 | Clarity of intent and module boundaries |
| 3 | Brevity (delete dead code; collapse duplication) |
| 4 | Consistency with AGENTS.md / advanced Exigo patterns |
| 5 | Correctness / security when it does not worsen 1–4 |

### Non-goals

- New product features
- Drive-by refactors outside owned files
- Rewrites for taste without a clear readability win
- Expanding test matrices without a concrete failure mode
- Review agents (Wave A/D) spawning brainstorm (or any) child agents

---

## 3. Architecture (strict wave separation)

```text
┌─────────────────────────────────────────────────────────────────┐
│  L-1  LAUNCHER (optional; cli_layer mode only)                  │
│  scripts/cb-review-autonomous.sh                                │
│  detect harness · spawn/wake peer · poll day-status.json only   │
└────────────────────────────┬────────────────────────────────────┘
                             │ peer CLI process (grok/claude/codex/…)
                             ▼  ── OR (single_agent mode) ──
┌─────────────────────────────────────────────────────────────────┐
│  L0  DAY-SCOPE ORCHESTRATOR (no human in the loop)              │
│  create/select run dir · map slices · dispatch waves · verify   │
│  Wave D pre-PR review · ship develop→main · CodeRabbit iterate  │
│  update RECORD.md + day-status.json after every step            │
└────────────────────────────┬────────────────────────────────────┘
                             │ in-process subagents
          ┌──────────────────┼──────────────────┬─────────────────┐
          ▼                  ▼                  ▼                 ▼
   WAVE A — AUDIT     WAVE B — BRAINSTORM  WAVE C — FIX    WAVE D — PRE-PR REVIEW
   (N agents)         (M agents)           (P agents)      (4 lenses, parallel)
   Hostile findings   Decision packages    Surgical edits  CodeRabbit-quality
   Write slices/*     Write brainstorms/*  Write fixes/*   Write pre-pr/*
   NO children        NO children          NO children     NO children
```

| Wave | Agent role | Reads | Writes | Spawns children? |
|------|------------|-------|--------|------------------|
| **A** | Hostile slice auditor | Code in slice + AGENTS.md | `$RUN_ROOT/audits/slices/S*.md` | **No** |
| **B** | Brainstorm / design options | Slice findings + code locations | `$RUN_ROOT/brainstorms/{ID}.md` | **No** |
| **C** | Surgical fixer | Master packs + brainstorm packages | Product code + `$RUN_ROOT/audits/fixes/P*.md` | **No** |
| **D** | Pre-PR reviewer (4 lenses) | Staged diff + AGENTS.md + .coderabbit.yaml | `$RUN_ROOT/audits/pre-pr/{PACK}-lens{N}.md` | **No** |

**L0** is the only layer that decides sequencing, consolidates, ships, and
re-dispatches waves. **L‑1** (when present) only scopes work and keeps the
day agent alive until that scope closes.

---

## 4. Default Exigo slice map

| ID | Focus | Paths (adjust per run) |
|----|-------|------------------------|
| S1 | Convex auth, plans, subscriptions, schema | `convex/schema.ts`, `auth*`, `plan*`, `subscription*`, `http`, `crons` |
| S2 | Courses / learn backend | `convex/course*` |
| S3 | Knowledge, tests, spaces domain | `convex/knowledge*`, `tests*`, `questions*`, `spaces*`, `userSettings*` |
| S4 | Exercises runtime / markup / harness | `src/app/_components/exercises/{runtime,markup,harness}` |
| S5 | Exercises display / shell / open / embed | `display`, `shell`, `open`, `embed`, `comments` |
| S6 | Exercises generate / atlas / lesson | `generate`, `atlas`, `lesson` |
| S7 | Learn UI + spaces pages | `_components/learn`, `spaces/**` |
| S8 | API routes | `src/app/api/**` |
| S9 | Server AI, payments, actions | `src/server/**`, `src/app/actions/**` |
| S10 | Shared, lib, middleware, app shell | `shared/**`, `src/lib/**`, `middleware`, layout/styles |
| S11 | Playground, settings, tests UI, misc pages | `playground`, `settings`, `tests`, pricing/checkout |

Scale: one agent per slice minimum; split slices with many large files.

---

## 5. Wave A — Hostile audit (findings only)

### 5.1 Disposition

- **Assume the codebase is troubled.** Empty praise is failure.
- Be **picky and strict**: muddy boundaries, dead scaffolding, dual systems, liar comments, auth holes, god files, copy-paste, inconsistent error shapes.
- **Write findings into audits.** Do **not** spawn brainstorm agents. Do **not** propose multi-page redesigns as code.
- Minimal “what a fix might look like” one-liners are OK inside findings for later brainstormers.

### 5.2 Reviewer brief (template)

```text
You are a WAVE A hostile auditor for Exigo cd-review.
RUN_ROOT={RUN_ROOT}
SLICE={SLICE_ID}
PATHS={PATHS}

ASSUME the code is troubled: real flaws exist (auth holes, duplication, dead code,
inconsistent patterns, god files). Your job is to catch them, not to soothe.

NORTH STAR: readable → clear → short → consistent → correct.

RULES
- Read AGENTS.md and every file in PATHS you can cover deeply.
- Do NOT edit product code.
- Do NOT spawn subagents.
- Write ONLY to {RUN_ROOT}/audits/slices/{SLICE_ID}.md

ADVERSARIAL TRICKS (use all)
- Pre-mortem: “next hire is confused — why?”
- Rubber-duck every public export in one sentence
- Diff-against-ideal: 80-line function vs 10-line version
- Sibling consistency (open neighbor files)
- Delete-test for dead/ceremonial blocks
- Boundary test: UI+API+prompt+schema mixed?
- Auth/plan limits wrong until proven gated

OUTPUT format in audits/slices/{SLICE_ID}.md
## Slice {SLICE_ID}
## Files reviewed
## Findings
### F-{SLICE_ID}-{nnn}: title
- Severity: P0|P1|P2|P3
- Category: readability|clarity|brevity|consistency|bug|security|perf
- Location: path:lines
- Evidence:
- Why it hurts north star:
- Sketch (1–3 bullets, not a design doc):
- Effort: S|M|L
## Patterns
## Recommended brainstorm clusters (group related findings)
## Explicit non-issues

QUOTA: max(5, ceil(files/3)) findings OR defended clean bill with checklist evidence.
Return to orchestrator: severity counts + top 3 + list of finding IDs.
```

### 5.3 Severity

| Sev | Meaning |
|-----|---------|
| P0 | Security, data loss, auth bypass, likely prod crash |
| P1 | Clear bug or severe clarity/consistency debt on hot path |
| P2 | Meaningful clarity/brevity win |
| P3 | Polish |

---

## 6. Wave B — Brainstorm (from audit files)

### 6.1 Dispatch

After Wave A completes (or after enough slices land):

1. Orchestrator clusters findings into brainstorm tickets (or one agent per slice’s “recommended clusters”).
2. Spawn brainstorm agents **in parallel**, each owning a set of finding IDs.
3. Each agent **reads** the slice audit + code locations; **writes** `$RUN_ROOT/brainstorms/{BRAIN_ID}.md`.
4. Brainstorm agents **do not** edit product code and **do not** spawn nested brainstorm agents.

### 6.2 Brainstorm brief (template)

```text
You are a WAVE B brainstorm agent for Exigo cd-review.
RUN_ROOT={RUN_ROOT}
BRAIN_ID={BRAIN_ID}
FINDINGS: {list of F-… from audits/slices}

TASK
Read the finding writeups and the cited code. Propose 2–3 approaches to make the
code easier to read, clearer, shorter, and more consistent. Prefer delete/simplify.

RULES
- Do NOT edit product code.
- Do NOT spawn subagents.
- Optional: web_search / open docs for SOTA only if non-trivial or security/AI.
- Load local skills when useful (brainstorming, coding-guidelines / Karpathy).
- Write {RUN_ROOT}/brainstorms/{BRAIN_ID}.md as a Decision Package.

Decision Package must include:
- Recommendation (name + why)
- Approaches table (pros/cons/north-star score/effort)
- Minimal implementation sketch (files + steps)
- What NOT to do
- Residual risks
- Skills / research notes
```

### 6.3 Decision Package shape

```markdown
# Decision Package — {BRAIN_ID}

## Recommendation
- Approach name:
- Rationale:
- Why not alternatives:

## Approaches considered
| ID | Name | Pros | Cons | North-star | Effort |

## Minimal implementation sketch
- Files:
- Steps:
- What NOT to do:

## Residual risks
## Skills / research
```

---

## 7. Wave C — Fix (execute packages)

### 7.1 Consolidate (orchestrator)

Write `$RUN_ROOT/audits/master.md`:

- Severity totals
- Top fixes (clarity-first)
- Brainstorm index (BRAIN_ID → finding → recommendation)
- **Fix packs** with **disjoint file ownership**
- Out of scope / deferred

### 7.2 Fixer brief (template)

```text
You are a WAVE C fixer for Exigo cd-review.
RUN_ROOT={RUN_ROOT}
PACK={PACK_ID}
OWNED FILES: {list only}
FINDINGS + BRAINSTORM: execute recommended approaches from brainstorms/*.md

NORTH STAR: readable, clear, shorter, consistent. Surgical. No features.
If a brainstorm package exists for a finding, EXECUTE it — do not re-litigate design.
Write {RUN_ROOT}/audits/fixes/{PACK_ID}.md
```

### 7.3 Verify (orchestrator, pre-Wave-D)

1. `npm run check` (lint + `tsc --noEmit`)
2. `npm run test`
3. If either fails → return to Wave C with the error log; do NOT proceed to Wave D.
4. On green, write `$RUN_ROOT/audits/verify-{PACK_ID}.md` with the command outputs and proceed to §7.5.

### 7.5 Wave D — Pre-PR subagent review (NEW, mandatory before ship)

**Why:** CodeRabbit reviews land *after* the PR is open. A 5-minute
internal review by 4 parallel subagents — each looking through a different
lens — catches the bulk of P0/P1 issues before the PR exists, which means
fewer force-pushes, fewer `@coderabbitai review` re-triggers, and a
higher-signal main-PR diff for CodeRabbit.

Wave D is **not** a replacement for CodeRabbit. It is a cheap parallel
pre-filter that reduces the number of CodeRabbit iterations needed.

#### 7.5.1 Lenses

| Lens | Focus |
|------|-------|
| **L1** | Correctness & security (auth, secrets, races, input validation, error leakage, plan-limit bypasses) |
| **L2** | Readability, clarity, brevity (naming, dead code, god functions, liar comments) |
| **L3** | Consistency with AGENTS.md + .coderabbit.yaml (dual AI paths, SSE dialect, prompt registry, shared/-for-cross-runtime, plan SSOT) |
| **L4** | Tests & edge cases (coverage, boundary conditions, regression risk, snapshot drift) |
| L5 (optional) | UI / a11y — only when the pack touches `_components/**` or `app/**/page.tsx` |

Full lens catalog and reviewer brief template: `agents/cd-review/REVIEW-LENS.md`.

#### 7.5.2 Dispatch

For each pack, fan out 4 (or 5) subagents **in parallel**. Each gets only
its lens brief + the staged diff (`git diff develop...HEAD -- {owned}`)
+ `AGENTS.md` + `.coderabbit.yaml` + the Wave C fix report. They do not
see each other.

#### 7.5.3 Consolidation & acceptance gate

Orchestrator reads all `lens{N}.md` files, deduplicates by
`path:lineRange` + root cause (max severity wins), writes a single
`$RUN_ROOT/audits/pre-pr/{PACK_ID}.md` with a verdict:

| Verdict | Condition | Action |
|---------|-----------|--------|
| `send_back_to_wave_C` | any P0 or P1 remains | Wave C fixes only the flagged findings; Wave D re-runs on the touched-again files only (see REVIEW-LENS.md §6) |
| `fix_and_proceed` | P2 remaining, cheap to fix | orchestrator fixes inline, re-runs Wave D on the touched files |
| `accept_and_ship` | only P3 nits or zero findings | proceed to §10.2 ship |

**Hard cap: 3 Wave D rounds per pack.** If round 3 still has P0/P1:
- Set `day-status.json` `state=fatal_blocked`, `blocked_reason=wave_d_round_3_p1`.
- Leave the pack on its branch (NOT merged to `develop`).
- Write `Stopped at` in `RECORD.md` with the offending finding IDs.
- Exit non-zero per §10.5.

A human (or the next launcher run with a relaxed gate) decides whether to
relax the gate, change the design, or accept the risk.

#### 7.5.4 What Wave D is NOT

- Not a replacement for CodeRabbit (CodeRabbit still runs on the PR).
- Not a brainstorm (does not re-open design — that's a P2 "consider next wave" finding, not a send-back).
- Not a verify step (`npm run check` + `npm run test` already passed in §7.3).
- Not allowed to spawn children.

---

## 8. Record track (`RECORD.md`)

Every run **must** maintain `$RUN_ROOT/RECORD.md`. Orchestrator updates it at:

- Run start
- End of each wave
- After each ship step
- Run pause / stop / fatal block

### 8.1 Template

```markdown
# cd-review RECORD — YYYY-MM-DD

## Status
- State: in_progress | paused | complete | fatal_blocked | budget_exhausted
- Mode: cli_layer | single_agent
- Branch: …
- Last updated: ISO timestamp
- Continues from: (prior date or none)

## Goal this run
…

## Waves
| Wave | Status | Notes |
|------|--------|-------|
| A Audit | pending/done | N slices, N findings |
| B Brainstorm | pending/done | N packages |
| C Fix | pending/done | packs … |
| D Pre-PR review | pending/done | rounds per pack … |
| Verify | pending/done | tests … |
| Ship | pending/done | PR links |

## Done (chronological)
- …

## In flight
- …

## Stopped at
- Exact next action if resuming: …

## Residual / backlog
- …

## Valuable notes
- Env secrets, deploy gotchas, product assumptions (e.g. MAX_MODULES=5)
- CI quirks (Hobby maxDuration, CodeRabbit file limits)
- …

## PRs / commits
- …
```

### 8.2 Resume protocol

1. Open latest `agents/cd-review/*/RECORD.md` (or user-specified date).
2. Read **Stopped at**, **Residual**, and `$RUN_ROOT/audits/day-status.json`.
3. **Launcher (cli_layer):** re-wake a day-scope agent with the residual scope. **Single-agent:** continue mid-wave / mid-ship without waiting for a human.
4. Continue that run **or** create a new dated folder (§1) and link “continues from”.
5. Never invent status — update RECORD (and day-status) after every material step.

### 8.3 Continuity invariants (hard)

These invariants are what make the loop survive crashes, OOMs, context
exhaustion, and rate-limit storms without losing work or re-running
shipped waves:

1. **`day-status.json` is written before side effects.** Before any
   `git push`, `gh pr create`, `gh pr merge`, `@coderabbitai review`
   comment, or `npx convex run`, update `last_step` + `state` first. If
   the process dies during the side effect, the next wake sees the
   in-flight step and re-runs it idempotently.
2. **Side effects are idempotent.** `git push --force-with-lease` is safe
   to retry. `gh pr create` for an existing branch is a no-op (check
   first via `gh pr list --head`). `gh pr merge --squash` on an
   already-merged PR returns a benign error. `@coderabbitai review` is
   safe to re-post. `npx convex run` mutations that are writes are
   idempotent by design (see `seedPlans.syncPerksFromSsot`).
3. **Shipped waves are never re-run.** Each pack's `audits/fixes/P*.md`
   has a `Status: done` line. On resume, the orchestrator scans `master.md`
   + `fixes/*.md` and skips any pack with `Status: done`. Wave A/B
   outputs are similarly skipped if the slice file or brainstorm file
   already exists with content.
4. **PR numbers are persisted.** `day-status.json` `prs` field holds
   `{develop, main}` PR numbers. On resume, the orchestrator re-opens
   those PRs by number rather than creating new ones.
5. **RECORD.md is append-only within a run.** Never rewrite history
   sections; only update `Status`, `Waves`, `In flight`, `Stopped at`.

---

## 9. Skills registry (brainstorm wave)

| Class | Prefer |
|-------|--------|
| Clarity / simplicity | Karpathy / coding-guidelines |
| Security / auth | authz every path; Exigo `getAuthedContext` |
| AI / SSE | single event dialect; prompt registry; opaque errors |
| Architecture | isolation, `shared/` for dual runtime |
| React UI | extract hooks/components along existing boundaries |

Local skill paths when present: `~/.agents/skills/brainstorming`, `coding-guidelines`, `frontend-patterns`.

---

## 10. Orchestrator checklist & ship protocol

### 10.0 Launcher checklist (L‑1, cli_layer mode only)

```text
[ ] cb-review-autonomous.sh invoked (or scheduler tick equivalent)
[ ] Harness mode detected and written to harness-mode.json
[ ] Day-scope agent spawned as a peer process (or single-agent handoff done)
[ ] day-status.json / RECORD polled only (no full worker transcript)
[ ] If worker stops early and state != terminal: wake with resume brief
[ ] If state == fatal_blocked: surface to scheduler; do NOT auto-retry
[ ] If state == complete: exit 0
```

### 10.1 Day-scope checklist (L0, both modes)

```text
[ ] Read LOOP.md §0.5 (mode) + §10.7 (state machine) + §10.5 (exit conditions)
[ ] Read harness-mode.json → set MODE
[ ] Create or select RUN_ROOT (agents/cd-review/YYYY-MM-DD)
[ ] RECORD.md scaffolded / updated; day-status.json current
[ ] slices.md written (if new run)
[ ] Wave A: dispatch all slice auditors (parallel, no children)
[ ] Collect audits/slices/*
[ ] Wave B: dispatch brainstormers on findings (parallel, no children)
[ ] Collect brainstorms/*
[ ] Consolidate master.md + fix packs (disjoint files)
[ ] Wave C: dispatch fixers
[ ] Verify (§7.3) → audits/verify-{PACK}.md
[ ] Wave D: dispatch 4-lens reviewers per pack (§7.5) → audits/pre-pr/{PACK}.md
[ ] Acceptance gate (§7.5.3) — send back, fix-and-proceed, or accept-and-ship
[ ] Ship (§10.2) — land develop → Wave D → PR main → CodeRabbit iterate → merge
[ ] RECORD.md: done / residual / stopped at; day-status complete or blocked
```

### 10.2 Ship protocol (per pack, after Wave D acceptance)

Runs **autonomously** inside the day-scope agent. Do **not** skip
CodeRabbit waits. Do **not** invent a new dated run folder unless the
launcher scoped a new day.

```text
1. SEED / OPS (when residual ops exist)
   - Prefer CLI only: `npx convex run` (and `--push` only if the function
     is missing on that deployment).
   - Avoid MCP `functionSpec` / bulk dumps (slow/hang-prone on this repo).
   - Dev:  `npx convex run seedPlans:syncPerksFromSsot '{}'` (push first
           if needed).
   - Prod: only after the wave’s Convex code is on prod (merge + deploy):
           `npx convex run --prod seedPlans:syncPerksFromSsot '{}'`.
   - Record ops result in RECORD.md.
   - Update day-status.last_step = "ops_done" BEFORE running the command.

2. LAND ON DEVELOP
   - Push the product branch (force-with-lease if rebasing).
   - Open or reuse PR: product branch → develop.
     (Check `gh pr list --head fix/waveN-product --base develop` first;
     create only if none exists.)
   - Ensure CI green (`check` + tests) before merge when protection
     requires it. If CI fails, fix on the branch and re-push — do NOT
     ask a human.
   - Merge into develop (squash or merge per repo default).
   - Update day-status: state=shipping, last_step="develop_merged",
     prs.develop=<number>.

3. OPEN PR INTO MAIN
   - Open or update PR: develop → main (or the cumulative product branch
     → main if that is the active ship path for this wave).
   - Body: wave summary + test plan + any ops follow-ups.
   - Update day-status: last_step="main_pr_open", prs.main=<number>.

4. CODERABBIT WAIT + ITERATION (mandatory loop, see §10.6 for primitives)
   Exigo config: auto-review runs on the default branch (main) only.
   Develop-base PRs often get “Review skipped” — still use develop for
   CI/landing, but treat develop→main as the real CodeRabbit surface.

   4a. After opening/updating the main PR: sleep ~5 minutes, then fetch
       all PR reviews, review comments, and issue comments (GitHub API
       or `gh`). Update day-status.last_step="cr_poll_1".

   4b. Detect “review still pending”:
       - CodeRabbit “review pending” / “in progress” / queued messages
       - only placeholder or “Review skipped” with no real findings yet
         when a full review is expected
       - CI still running and bot has not finished
       If pending: sleep ~10 minutes, recheck. Update
       day-status.last_step="cr_poll_N" (N increments). Repeat until it
       is clear that CodeRabbit has finished this pass (or a documented
       rate-limit path below).

   4c. Rate limits / flaky bot / API errors (resilience policy):
       - If CodeRabbit (or GitHub) returns 403/429 with a
         `X-RateLimit-Reset` header: sleep until reset + 60s, then retry.
         Record the reset time in RECORD.md.
       - If GitHub returns 5xx: exponential backoff 30s → 60s → 120s →
         300s, max 3 retries; then surface as blocked (NOT fatal) and
         retry the whole poll loop from 4a after 15 minutes.
       - If CodeRabbit has not produced any review after 30 minutes AND
         there is no skip message: post `@coderabbitai review` as a PR
         comment via the GitHub API (see §10.6). Sleep 5m, re-poll.
       - If after 3 `@coderabbitai review` re-triggers (90 min total)
         there is still no review: treat as `state=blocked`,
         `blocked_reason=coderabbit_silent`, persist `prs.main`,
         write `Stopped at`, exit. The next launcher run resumes from
         here and tries once more before escalating to fatal_blocked.
       - Network/API failures: backoff and retry; record attempts in
         RECORD.md.
       - It is the agent’s job to wait properly — do not abandon the PR
         half-reviewed and do not ask a human to “check later” unless
         truly blocked on secrets/access (which is fatal_blocked, not
         blocked).

   4d. Confirm the review is real before deciding “nothing to fix”:
       - CodeRabbit usually does not leave a full PR empty. Expect at
         least a few minor findings on non-trivial product diffs.
       - If you find no issue-related CodeRabbit comments (inline or
         review body), assume something is wrong first:
         - wrong PR number / wrong base branch
         - looking only at issue comments and missing review threads
         - review not finished yet (go back to 4b)
         - bot skipped (file limits, path filters) — check for skip
           messages and fix scope
       - Only after a completed review pass with evidence (review
         submitted state, summary comment, and/or threaded findings) may
         you conclude residual is empty or accept remaining nits with
         reasons in RECORD.

   4e. Fix → push → wait again:
       - Iterate CodeRabbit findings surgically.
       - Push fixes to the branch that feeds the main PR (typically
         develop and/or the product branch, keeping develop→main current).
       - Re-run verify (§7.3) on the touched files. If verify fails, fix
         and re-push; do NOT ask a human.
       - Re-run Wave D (§7.5) on the touched files only — this is a
         cheap re-check that the CodeRabbit fix didn't introduce a new
         P0/P1.
       - Update the PR; sleep ~5 minutes again; re-enter from 4a until
         the completed review residual is empty or explicitly accepted
         in RECORD.
       - Reply/resolve threads only when code is fixed or out-of-scope
         with reason.
       - Update day-status.coderabbit_round on each iteration.

   4f. Hard cap: 5 CodeRabbit rounds per PR. If round 5 still has
       actionable findings:
       - Set state=blocked, blocked_reason=coderabbit_round_5.
       - Persist PRs.main, write Stopped at with the residual finding IDs.
       - Exit. The next launcher run tries once more; if it also blocks,
         escalate to fatal_blocked.

5. MERGE INTO MAIN
   - Merge the main PR when CI is green and CodeRabbit residual is empty
     or accepted.
   - The agent’s GitHub token has merge permission on this repo
     (see §10.4); do NOT wait for a human to merge.
   - Confirm deploy health if Convex/Vercel auto-deploy (best-effort:
     check Vercel deployment status via the GitHub deployment API; do
     NOT block on Vercel — a deploy delay is not a code review issue).
   - Update day-status: state=running (continue to next pack) or
     complete (if last pack), last_step="main_merged".

6. CONTINUE NEXT PART OF SCOPE
   - Update RECORD.md: ship links, residual, next wave/pack id;
     day-status.json.
   - Stay under the same RUN_ROOT for the day scope.
   - Continue remaining packs / waves without human approval, then ship
     again via this section.
   - If day scope is closed: set day-status state=complete and stop
     cleanly (§10.5).
   - If you must stop early: set blocked/stopped_at precisely so the
     launcher (or next single-agent wake) can resume.
```

**Branch naming:** `fix/waveN-product` (or scoped fix names). Prefer landing on `develop` after each wave part, then PR to `main`.

**PR hygiene:** product-scoped diffs; keep audits out of giant mixed PRs when CodeRabbit file limits apply.

### 10.3 CodeRabbit interaction primitives (NEW)

Use `gh` CLI directly (no MCP). All commands are idempotent:

```bash
# Fetch all reviews + review comments + issue comments on the main PR
gh pr view $PR_MAIN --json reviews,comments,reviewDecision,state,statusCheckRollup

# Fetch inline review threads
gh api repos/artyaz/exigo/pulls/$PR_MAIN/comments
gh api repos/artyaz/exigo/pulls/$PR_MAIN/reviews

# Re-trigger CodeRabbit if silent for 30+ min
gh pr comment $PR_MAIN --body "@coderabbitai review"

# Resolve a thread after fixing
gh api -X POST repos/artyaz/exigo/pulls/$PR_MAIN/comments/$COMMENT_ID/replies \
  --field body="Fixed in <sha>. Resolving."

# Merge the PR (squash) once CI green + CR residual empty
gh pr merge $PR_MAIN --squash --delete-branch
```

If `gh` is unavailable, fall back to `curl` with `GITHUB_TOKEN`:

```bash
curl -sS -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/artyaz/exigo/pulls/$PR_MAIN/reviews
```

The agent MUST handle GitHub rate limits (403/429 with
`X-RateLimit-Reset`) by sleeping until reset + 60s, not by exiting.

### 10.4 Auth & merge permission (NEW, explicit)

The loop runs with a GitHub PAT (`github_pat_…`) that has `repo` +
`workflow` scope on `artyaz/exigo`. This token:

- can push to `develop` and product branches (NOT directly to `main` —
  branch protection requires PR),
- can open PRs into `develop` and `main`,
- can merge PRs (branch protection allows the token's user to merge
  once CI is green — `gh pr merge --squash` works),
- can post comments (`@coderabbitai review`),
- can resolve review threads,
- can delete product branches after merge (`--delete-branch`).

If the token's permissions are revoked or scoped down, the agent
detects this on the first `gh` call (403 with `insufficient_permission`
or 401) and sets `state=fatal_blocked`, `blocked_reason=github_token_scope`.
This is fatal because no amount of retrying fixes a permission issue;
the scheduler / human must rotate the token.

### 10.5 Exit conditions (hard, autonomous)

The day-scope agent exits in exactly one of these states. The launcher
or scheduler reads `day-status.json.state` and decides whether to
re-wake.

| state | meaning | launcher action |
|-------|---------|-----------------|
| `complete` | all packs in scope shipped + merged to main | exit 0; optionally start next scope |
| `budget_exhausted` | wall-clock or wakeup budget hit mid-scope | re-wake once with resume brief; if it exhausts again, escalate to scheduler |
| `blocked` | transient issue (rate limit, CI flake, CodeRabbit silent, 5xx) that should resolve with time | re-wake after a cooldown (default 15 min) up to `max_wakeups` |
| `fatal_blocked` | permanent issue (token scope, missing secret, Wave D round 3 P1, design deadlock) that no retry will fix | do NOT auto-retry; surface to scheduler for human triage |

**Forbidden exits:**

- Exiting with `state=running` and no `last_step` update → protocol
  violation. The next wake treats this as a crash and resumes from the
  last persisted `last_step`.
- Exiting with `state=shipping` or `state=waiting_coderabbit` for more
  than 90 minutes without a `last_step` change → treated as `blocked`
  by the launcher (stall detection).

### 10.6 Rate-limit & flake resilience policy (summary)

The loop assumes the outside world is flaky. Every external call has a
resilience policy:

| Failure | Policy |
|---------|--------|
| GitHub 403/429 (rate limit) | sleep until `X-RateLimit-Reset` + 60s; retry. Record in RECORD. |
| GitHub 5xx | exponential backoff 30s→60s→120s→300s, max 3; then `blocked` + 15m cooldown. |
| `gh` CLI 401/403 (token scope) | `fatal_blocked`, `blocked_reason=github_token_scope`. No retry. |
| CodeRabbit silent >30m | `@coderabbitai review` comment; sleep 5m; re-poll. |
| CodeRabbit silent after 3 re-triggers (90m) | `blocked`, `blocked_reason=coderabbit_silent`; exit for re-wake. |
| CodeRabbit round 5 residual | `blocked`, `blocked_reason=coderabbit_round_5`; exit for re-wake. |
| Wave D round 3 P0/P1 | `fatal_blocked`, `blocked_reason=wave_d_round_3_p1`. |
| `npm run check` fail | return to Wave C with error log; do NOT ship. |
| `npm run test` fail | return to Wave C with error log; do NOT ship. |
| `npx convex run` fail | if `--push` first helped, retry; else `blocked`, `blocked_reason=convex_run_failed`. |
| `git push` rejected (non-fast-forward) | `git fetch` + `git rebase origin/develop`; retry. If conflict: `blocked`, `blocked_reason=merge_conflict`. |
| Subagent spawn fail | retry once; then treat that wave as `blocked` and skip to next independent pack; record in RECORD. |
| Agent process crash (cli_layer) | launcher re-wakes with resume brief; `max_wakeups` cap. |
| Agent context exhaustion (single_agent) | leave `last_step` + `resume_hint`; next scheduler tick resumes. |

### 10.7 Ship state machine (canonical `last_step` values)

These are the only valid `last_step` strings. The orchestrator writes one
before each side effect so a crash is recoverable:

```text
init
wave_a_dispatched
wave_a_collected
wave_b_dispatched
wave_b_collected
master_consolidated
wave_c_dispatched:{PACK_ID}
wave_c_collected:{PACK_ID}
verify_done:{PACK_ID}
wave_d_dispatched:{PACK_ID}:round_{N}
wave_d_collected:{PACK_ID}:round_{N}
wave_d_verdict:{PACK_ID}:{send_back|fix_and_proceed|accept_and_ship}
ops_done
develop_pushed
develop_pr_open:{PR_NUMBER}
develop_ci_green:{PR_NUMBER}
develop_merged:{PR_NUMBER}
main_pr_open:{PR_NUMBER}
cr_poll_{N}:{PR_NUMBER}
cr_comment_posted:{PR_NUMBER}
cr_round_{N}_fix_pushed:{PR_NUMBER}
main_ci_green:{PR_NUMBER}
main_merged:{PR_NUMBER}
next_pack
scope_complete
```

Resume logic: the orchestrator reads `last_step`, finds it in the list
above, and resumes from the **next** step. Side effects are idempotent
(§8.3) so re-running a step is safe.

---

## 11. Exigo conventions (enforce)

| Area | Rule |
|------|------|
| DB | Convex primary; do not grow Prisma |
| Auth Convex | `getAuthedContext` / plan gates |
| Auth API | Clerk → authed Convex client |
| AI | Prompts from Convex registry; SSE consistency; PostHog AI events |
| Shared | Cross-runtime pure code in `shared/` |
| Quality | delete > move > rewrite; surgical diffs |

---

## 12. History

| Date | Note |
|------|------|
| 2026-07-17 | Original loop under `loops/cb-review.md` + root `audits/` |
| 2026-07-18 | Relocated to `agents/cd-review/`; Wave A/B separation (no nested brainstorm spawn); dated run folders + RECORD |
| 2026-07-18 | Ship protocol: seed → merge develop → PR main → wait CodeRabbit → fix → merge main → next wave |
| 2026-07-18 | L‑1 launcher + L0 day-scope CLI agent (§0.5); ~300k–350k scope; no HITL; ship §10.2 CodeRabbit 5m/10m iteration |
| 2026-07-24 | **Autonomy hardening pass.** CLI peer layer made OPTIONAL with single-agent fallback (§0.5.2). Wave D pre-PR subagent review added (§7.5, REVIEW-LENS.md). Crash-safe `day-status.json` + canonical `last_step` state machine (§10.7). Rate-limit & flake resilience policy explicit (§10.6). Exit conditions formalized (§10.5). `scripts/cb-review-autonomous.sh` headless entry point with harness detection + resume. Continuity invariants (§8.3). Wave D round cap 3, CodeRabbit round cap 5. |

For the first full multi-wave execution and ship history, see:

`agents/cd-review/2026-07-18/RECORD.md`
