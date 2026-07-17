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
│  L0  ORCHESTRATOR                                               │
│  create run dir · map slices · dispatch waves · consolidate     │
│  verify · ship · update RECORD.md                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
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

Orchestrator (L0) is the only layer that decides sequencing and consolidates.

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
4. Ship via PR policy for the repo (protected branches → PR to develop/main as needed)  
5. Update `RECORD.md`

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
2. Read **Stopped at** and **Residual**.  
3. Continue that run **or** create a new dated folder (§1) and link “continues from”.  
4. Never invent status — update RECORD after every material step.

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

```text
[ ] Create or select RUN_ROOT (agents/cd-review/YYYY-MM-DD)
[ ] RECORD.md scaffolded / updated
[ ] slices.md written
[ ] Wave A: dispatch all slice auditors (parallel, no children)
[ ] Collect audits/slices/*
[ ] Wave B: dispatch brainstormers on findings (parallel, no children)
[ ] Collect brainstorms/*
[ ] Consolidate master.md + fix packs (disjoint files)
[ ] Wave C: dispatch fixers
[ ] Verify (check + test) → audits/verify.md
[ ] Ship (see §10.1 ship protocol)
[ ] RECORD.md final: done, residual, stopped at
```

### 10.1 Ship protocol (required after each product wave)

When the user says ship / merge / continue waves, the orchestrator follows this **exactly**. Do not skip CodeRabbit wait. Do not invent a new dated run folder unless asked.

```text
1. SEED / OPS (when residual ops exist)
   - Prefer CLI only: `npx convex run` (and `--push` only if the function is missing on that deployment).
   - Avoid MCP `functionSpec` / bulk dumps (slow/hang-prone on this repo).
   - Dev: `npx convex run seedPlans:syncPerksFromSsot '{}'` (push first if needed).
   - Prod: only after the wave’s Convex code is on prod (merge + deploy), then:
     `npx convex run --prod seedPlans:syncPerksFromSsot '{}'`
   - Record ops result in RECORD.md.

2. MERGE INTO DEVELOP
   - Open or reuse PR: product branch → `develop`.
   - Ensure CI green (`check` + tests).
   - Merge into `develop` (squash or merge per repo default).
   - If multiple stacked wave branches exist, merge bottom-up (wave N then N+1) or one cumulative PR.

3. OPEN PR INTO MAIN
   - Open PR: `develop` → `main` (or the cumulative product branch → `main` if that is the active ship path).
   - Body: wave summary + test plan + any ops follow-ups.

4. WAIT FOR CODERABBIT
   - Poll PR reviews/comments until CodeRabbit has posted (or ~10–15 min with no bot if CI still running — recheck).
   - Do not merge main before reviewing bot findings.
   - Tools: GitHub API issue comments + reviews (CLI token ok if `gh` keyring is broken).

5. FIX IF NEEDED
   - Address CodeRabbit (and human) blocking findings surgically.
   - Push fixes to the PR branch; re-run verify.
   - Reply/resolve only when code is fixed or finding is explicitly out of scope with reason in RECORD.

6. MERGE INTO MAIN
   - Merge the main PR when CI green and CodeRabbit residual is empty or accepted.
   - Confirm deploy health if Convex/Vercel auto-deploy.

7. CONTINUE NEXT WAVE
   - Update RECORD.md: ship links, residual, next wave id.
   - Start next wave under the **same** RUN_ROOT unless user asked for a new date.
   - Repeat from Wave A/C residual packs or § residual backlog — then this ship protocol again.
```

**Branch naming:** `fix/waveN-product` (or scoped fix names). Prefer stacking on `develop` after each develop merge.

**PR hygiene:** product-scoped diffs; keep audits out of giant mixed PRs when CodeRabbit file limits apply.

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
| 2026-07-18 | Ship protocol §10.1: seed → merge develop → PR main → wait CodeRabbit → fix → merge main → next wave |

For the first full multi-wave execution and ship history, see:

`agents/cd-review/2026-07-18/RECORD.md`
