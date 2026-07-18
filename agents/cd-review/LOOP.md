# Codebase Review Loop (`cd-review`)

Continuous **hostile audit → brainstorm → fix → verify → record** loop for Exigo.

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

**Two agent layers** run this protocol (details §0.5):

1. **Launcher session** (user-triggered, thin) — inspects the latest dated run, decides remaining work, spawns a **separate** day-scope agent via CLI / harness, wakes it if it stalls.
2. **Day-scope agent** (autonomous, no human in the loop) — owns a large scoped chunk of the day, runs waves, spawns **subagents**, ships via develop → main + CodeRabbit iteration.

---

## 0. Directory layout

```text
agents/cd-review/
  LOOP.md                          ← this file (always current protocol)
  YYYY-MM-DD/                      ← one run directory per calendar day (or explicit user start)
    RECORD.md                      ← what ran, what shipped, where stopped, next actions
    audits/
      slices.md                    ← slice map for this run
      slices/S1.md …               ← Wave A hostile findings (reviewers only)
      master.md                    ← consolidated audit + fix packs (orchestrator)
      fixes/P*.md                  ← Wave C fix reports
      verify.md                    ← check/test results
    brainstorms/
      S1-B001.md …                 ← Wave B decision packages (brainstorm agents only)
```

**Do not nest brainstorms under `audits/`.** Audits = findings. Brainstorms = how to fix.

---

## 0.5 Harness: launcher vs day-scope agent

### 0.5.1 Roles

| Layer | How it starts | Job | Context discipline |
|-------|---------------|-----|--------------------|
| **Launcher** | User triggers the loop in an interactive agent session | Find latest run, research remaining work, spawn a **separate** Grok process, re-wake it until day scope is closed | Keep thin: status files + short summaries only — **do not** ingest the worker’s full transcript |
| **Day-scope agent** | Spawned by launcher (CLI / harness) | Execute this `LOOP.md` end-to-end for a large scoped chunk: waves, subagents, verify, ship, CodeRabbit iteration | Full working context; **no human in the loop** |

Subagents of the day-scope agent (Wave A/B/C workers) stay as described in §3 — they do **not** replace the day-scope agent.

### 0.5.2 Launcher protocol (user-triggered)

When the user starts or continues the loop in the launcher session:

```text
1. RESOLVE RUN
   - Prefer user-specified date; else pick the latest agents/cd-review/YYYY-MM-DD/.
   - Read RECORD.md (Status, Stopped at, Residual, In flight, PRs).
   - Skim audits/ + brainstorms/ only enough to know what is unfinished
     (pending packs, open findings, open PRs). Do not re-read entire day history.

2. DECIDE SCOPE FOR ONE DAY-AGENT
   - Package a chunk of remaining work sized for roughly **300k–350k** tokens of
     agent context for the worker (large: multi-pack / multi-slice progress is OK).
   - Prefer contiguous ownership (same wave, disjoint file packs, or residual ship).
   - Write the scope into the spawn prompt and optionally
     $RUN_ROOT/audits/day-scope-{N}.md (goal, pack IDs, branch, PR links, stop conditions).

3. SPAWN SEPARATE AGENT (not a subagent of the launcher)
   - Default harness: terminal `grok` headless (or project-equivalent CLI).
   - Example (adapt flags to the local harness):

     grok -p "$(cat <<'EOF'
     You are the cd-review DAY-SCOPE agent for Exigo.
     Read and obey agents/cd-review/LOOP.md entirely.
     RUN_ROOT=agents/cd-review/YYYY-MM-DD
     SCOPE: … (pack IDs / residual / ship state)
     NO HUMAN IN THE LOOP. Do not wait for user confirmation.
     Use subagents for Wave A/B/C as LOOP.md allows.
     When a wave/part is done, follow §10.2 ship + CodeRabbit iteration.
     Write progress to RECORD.md and $RUN_ROOT/audits/day-status.json
     {state, scope_id, last_step, prs, blocked_reason?}.
     If you stop before scope is closed, leave Stopped at + next action in RECORD.
     EOF
     )" --cwd <repo> --output-format json --yolo

   - Prefer backgrounding the process so the launcher can poll artifacts only.
   - If the harness provides worktrees / session IDs, use them; still keep the worker
     as a **peer process**, not spawn_subagent of the launcher.

4. SUPERVISE WITHOUT STEALING CONTEXT
   - Poll process alive? + day-status.json / RECORD.md “Stopped at” — not the worker’s
     full session JSONL.
   - If the worker exits or stalls **before the day scope is closed**, it is the
     **launcher’s responsibility** to wake it again with further instructions
     (resume same RUN_ROOT + residual scope; use grok -c / -r session id when useful,
     or a new process with an explicit resume brief).
   - Repeat spawn/wake until scope is complete or the user cancels the loop.
   - On scope complete: update launcher notes; optionally open next scope or stop.
```

### 0.5.3 Day-scope agent rules

- **No human in the loop.** Do not pause for “should I continue?” — continue, ship, or leave a precise `Stopped at` + `day-status.json` if truly blocked (permissions, missing secrets, merge conflict needing human).
- **Orchestrate at this level:** dispatch Wave A/B/C via subagents (or sequential work if harness forbids children); consolidate; verify; ship (§10.2).
- **Scope size:** one spawn should attempt a large, coherent chunk (~300k–350k context budget). Do not under-scope into tiny one-file chores unless residual is tiny.
- **Artifacts are truth:** always keep `RECORD.md` current so a cold launcher can re-wake you correctly.
- **Nested CLI agents:** optional. Prefer in-process subagents for waves; use another `grok` CLI only if the harness benefits (isolation). Never require the human to re-enter.

### 0.5.4 Progress file (recommended)

`$RUN_ROOT/audits/day-status.json` (launcher-readable):

```json
{
  "state": "running|shipping|waiting_coderabbit|blocked|complete",
  "scope_id": "day-scope-1",
  "last_step": "short machine-readable step",
  "branch": "fix/waveN-product",
  "prs": { "develop": null, "main": 123 },
  "blocked_reason": null,
  "updated_at": "ISO-8601"
}
```

---

## 1. Starting clean (new day / new run)

When the user says **start**, **new run**, **clean start**, or **continue on a new date**:

### 1.1 Create today’s directory

```bash
DATE=$(date +%Y-%m-%d)   # or use the date the user gives
ROOT=agents/cd-review/$DATE
mkdir -p "$ROOT/audits/slices" "$ROOT/audits/fixes" "$ROOT/brainstorms"
```

### 1.2 Scaffold `RECORD.md`

Create `$ROOT/RECORD.md` from the template in §8 (status: `in_progress`, empty waves).

### 1.3 Scaffold `audits/slices.md`

Partition the repo into slices (default Exigo map in §4). Write paths + ownership into `$ROOT/audits/slices.md`.

### 1.4 Do **not** delete previous date folders

Prior days are history. Only create a new dated folder. Optionally note “continues from 2026-07-18” in the new RECORD.

### 1.5 Set active run path

All agent briefs must use:

```text
RUN_ROOT=agents/cd-review/YYYY-MM-DD
```

Never write review artifacts under `audits/` at repo root or `loops/`.

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
- Review agents spawning brainstorm (or any) child agents

---

## 3. Architecture (strict wave separation)

**Reviewers do not spawn brainstormers.** Brainstormers do not edit product code. Fixers do not re-open design when a brainstorm package already chose an approach.

```text
┌─────────────────────────────────────────────────────────────────┐
│  L-1  LAUNCHER (user-triggered session)                         │
│  latest date folder · remaining work · spawn/wake CLI day agent │
│  thin polls only (RECORD + day-status) — not worker transcript  │
└────────────────────────────┬────────────────────────────────────┘
                             │ grok CLI / harness (separate process)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  L0  DAY-SCOPE ORCHESTRATOR (no human in the loop)              │
│  create/select run dir · map slices · dispatch waves · verify   │
│  ship develop→main · CodeRabbit iterate · update RECORD.md      │
└────────────────────────────┬────────────────────────────────────┘
                             │ subagents (in-process)
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
   WAVE A — AUDIT      WAVE B — BRAINSTORM   WAVE C — FIX
   (N agents)          (M agents)            (P agents)
   Strict, picky,      Read audits only      Execute packs
   assume troubled     Write brainstorms     Write fixes/*
   Write audits/*      NO product edits      Owned files only
   NO children         Optional web research
```

| Wave | Agent role | Reads | Writes | Spawns children? |
|------|------------|-------|--------|------------------|
| **A** | Hostile slice auditor | Code in slice + AGENTS.md | `$RUN_ROOT/audits/slices/S*.md` | **No** |
| **B** | Brainstorm / design options | Slice findings + code locations | `$RUN_ROOT/brainstorms/{ID}.md` | **No** (research tools OK) |
| **C** | Surgical fixer | Master packs + brainstorm packages | Product code + `$RUN_ROOT/audits/fixes/P*.md` | **No** (unless orchestrator re-dispatches) |

**L0 (day-scope)** is the only layer that decides sequencing, consolidates, ships, and re-dispatches waves. **L-1 (launcher)** only scopes work and keeps the day agent alive until that scope closes.

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

### 7.3 Verify (orchestrator)

1. `npm run check` and/or `npx tsc --noEmit` + lint on touched paths  
2. `npm run test`  
3. Write `$RUN_ROOT/audits/verify.md`  
4. Ship via §10.2 (develop → main + CodeRabbit iteration)  
5. Update `RECORD.md` and `day-status.json`

---

## 8. Record track (`RECORD.md`)

Every run **must** maintain `$RUN_ROOT/RECORD.md`. Orchestrator updates it at:

- Run start  
- End of each wave  
- After each ship  
- Run pause / stop  

### 8.1 Template

```markdown
# cd-review RECORD — YYYY-MM-DD

## Status
- State: in_progress | paused | complete
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
2. Read **Stopped at**, **Residual**, and `$RUN_ROOT/audits/day-status.json` if present.  
3. **Launcher:** re-wake a day-scope agent with the residual scope (§0.5). **Day-scope:** continue mid-wave / mid-ship without waiting for a human.  
4. Continue that run **or** create a new dated folder (§1) and link “continues from”.  
5. Never invent status — update RECORD (and day-status) after every material step.

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

## 10. Orchestrator checklist

### 10.0 Launcher checklist (L-1, user-triggered)

```text
[ ] User triggered loop in this session
[ ] Latest (or specified) RUN_ROOT selected; RECORD.md read
[ ] Remaining work researched; day scope sized ~300k–350k context
[ ] Separate day-scope agent spawned via grok CLI / harness (not subagent)
[ ] day-status.json / RECORD polled only (no full worker transcript)
[ ] If worker stops early: wake with further instructions until scope closed
[ ] Scope complete or user cancelled
```

### 10.1 Day-scope checklist (L0)

```text
[ ] Create or select RUN_ROOT (agents/cd-review/YYYY-MM-DD)
[ ] RECORD.md scaffolded / updated; day-status.json current
[ ] slices.md written (if new run)
[ ] Wave A: dispatch all slice auditors (parallel, no children)
[ ] Collect audits/slices/*
[ ] Wave B: dispatch brainstormers on findings (parallel, no children)
[ ] Collect brainstorms/*
[ ] Consolidate master.md + fix packs (disjoint files)
[ ] Wave C: dispatch fixers
[ ] Verify (check + test) → audits/verify.md
[ ] Ship (see §10.2 ship + CodeRabbit iteration)
[ ] RECORD.md: done / residual / stopped at; day-status complete or blocked
```

### 10.2 Ship protocol (required after each product wave / scope part)

Runs **autonomously** inside the day-scope agent after a wave or scoped part of product work is done. Do **not** skip CodeRabbit waits. Do **not** invent a new dated run folder unless the launcher scoped a new day.

```text
1. SEED / OPS (when residual ops exist)
   - Prefer CLI only: `npx convex run` (and `--push` only if the function is missing on that deployment).
   - Avoid MCP `functionSpec` / bulk dumps (slow/hang-prone on this repo).
   - Dev: `npx convex run seedPlans:syncPerksFromSsot '{}'` (push first if needed).
   - Prod: only after the wave’s Convex code is on prod (merge + deploy), then:
     `npx convex run --prod seedPlans:syncPerksFromSsot '{}'`
   - Record ops result in RECORD.md.

2. LAND ON DEVELOP
   - Push the product branch; open or reuse PR: product branch → `develop` (development branch).
   - Ensure CI green (`check` + tests) before merge when protection requires it.
   - Merge into `develop` (squash or merge per repo default).
   - If multiple stacked wave branches exist, merge bottom-up (wave N then N+1) or one cumulative PR.
   - Prefer: changes live on `develop` before the main PR is treated as the ship vehicle.

3. OPEN PR INTO MAIN
   - Open or update PR: `develop` → `main` (or the cumulative product branch → `main`
     if that is the active ship path for this wave).
   - Body: wave summary + test plan + any ops follow-ups.
   - Update day-status.json: state=shipping, prs.main=<number>.

4. CODERABBIT WAIT + ITERATION (mandatory loop)
   **Exigo config:** auto-review runs on the **default branch (`main`) only**.
   Develop-base PRs often get “Review skipped” — still use develop for CI/landing,
   but treat **develop→main** (or the main-targeted PR) as the real CodeRabbit surface.

   4a. After opening/updating the main PR: **sleep ~5 minutes**, then fetch **all**
       PR reviews, review comments, and issue comments (GitHub API or `gh`).

   4b. Detect “review still pending”:
       - CodeRabbit “review pending” / “in progress” / queued messages
       - only placeholder or “Review skipped” with no real findings yet when a full
         review is expected
       - CI still running and bot has not finished
       If pending: **sleep ~10 minutes**, recheck. Repeat until it is clear that
       CodeRabbit has **finished** this pass (or a documented rate-limit path below).

   4c. Rate limits / flaky bot / API errors:
       - If CodeRabbit (or GitHub) rate-limits: wait the stated or a generous window
         (often 10–30+ minutes), then re-request review (`@coderabbitai review`) if needed.
       - Network/API failures: backoff and retry; record attempts in RECORD.md.
       - It is the **agent’s** job to wait properly — do not abandon the PR half-reviewed
         and do not ask a human to “check later” unless truly blocked on secrets/access.

   4d. Confirm the review is real before deciding “nothing to fix”:
       - CodeRabbit **usually does not leave a full PR empty**. Expect at least a few
         minor findings on non-trivial product diffs.
       - If you find **no** issue-related CodeRabbit comments (inline or review body),
         assume something is wrong first:
         - wrong PR number / wrong base branch
         - looking only at issue comments and missing review threads
         - review not finished yet (go back to 4b)
         - bot skipped (file limits, path filters) — check for skip messages and fix scope
       - Only after a **completed** review pass with evidence (review submitted state,
         summary comment, and/or threaded findings) may you conclude residual is empty
         or accept remaining nits with reasons in RECORD.

   4e. Fix → push → wait again:
       - Iterate CodeRabbit (and human) findings surgically.
       - Push fixes to the branch that feeds the main PR (typically `develop` and/or
         the product branch, keeping develop→main current).
       - Re-run verify as needed.
       - Update the PR; **sleep ~5 minutes** again; re-enter from 4a until the completed
         review residual is empty or explicitly accepted in RECORD.
       - Reply/resolve threads only when code is fixed or out-of-scope with reason.

5. MERGE INTO MAIN
   - Merge the main PR when CI is green and CodeRabbit residual is empty or accepted.
   - Confirm deploy health if Convex/Vercel auto-deploy.

6. CONTINUE NEXT PART OF SCOPE
   - Update RECORD.md: ship links, residual, next wave/pack id; day-status.json.
   - Stay under the **same** RUN_ROOT for the day scope.
   - Continue remaining packs / waves without human approval, then ship again via this section.
   - If day scope is closed: set day-status state=complete and stop cleanly.
   - If you must stop early: set blocked/stopped_at precisely so the **launcher** can wake you.
```

**Branch naming:** `fix/waveN-product` (or scoped fix names). Prefer landing on `develop` after each wave part, then PR to `main`.

**PR hygiene:** product-scoped diffs; keep audits out of giant mixed PRs when CodeRabbit file limits apply.

**Tools:** GitHub API issue comments + pull reviews + review comments (CLI token ok if `gh` keyring is broken). Prefer short status polls and documented sleeps; avoid MCP `functionSpec` bulk dumps.

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
| 2026-07-18 | L-1 launcher + L0 day-scope CLI agent (§0.5); ~300k–350k scope; no HITL; ship §10.2 CodeRabbit 5m/10m iteration |

For the first full multi-wave execution and ship history, see:

`agents/cd-review/2026-07-18/RECORD.md`
