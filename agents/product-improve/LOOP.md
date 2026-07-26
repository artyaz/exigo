# Product Improvement Loop (`product-improve`)

Continuous **map → analyze → propose → verify** loop for Exigo product improvements.

This loop is the **product-aware** counterpart to `agents/cd-review/` (which is code-quality-focused) and `agents/brainstorm/` (which is idea-generation-focused). The product-improve loop maps product areas across the codebase, generates improvement suggestions aligned with Exigo's mission, and produces verified decision packages ready for implementation handoff.

The loop follows the same architectural principles as cd-review:
- Parallel subagents for area mapping (Wave α)
- Decision packages with recommendations, approach tables, and implementation sketches (Wave β)
- Synthesis with claims extraction and constraint writing (Wave γ)
- Strict wave separation; subagents never spawn children
- RECORD.md + day-status.json resume contract

Primary success metric: improvements that make the codebase **easier to read, clearer, shorter, and more consistent** while maintaining correctness and respecting Exigo conventions.

This file is the **single source of truth** for the loop. Dated run artifacts live under:

```text
agents/product-improve/runs/YYYY-MM-DD-CNNN/
```

---

## 0. Directory layout

```text
agents/product-improve/
  LOOP.md                              ← this file (always current protocol)
  archive/                             ← cross-cycle memory
    cycles.json                        ← cycle index
  runs/
    YYYY-MM-DD-CNNN/                   ← one cycle run
      RECORD.md                        ← cycle narrative + verdicts
      cycle-scope.md                   ← goal, problem, stop conditions
      day-status.json                  ← progress tracking
      product-area-matrix.md           ← area map for this cycle
      brainstorm/
        B-001-{area}.md                ← per-subagent area analysis
        _consolidation.md              ← orchestrator's cluster + shortlist
      research/
        DP-001-{theme}.md              ← decision packages (Wave B format)
      synthesis/
        S-001-claims.md                ← verified claims by theme
        S-002-constraints.md           ← next-cycle constraints
```

---

## 1. North-star and conventions

### North-star (ordered, same as cd-review)

| # | Criterion |
|---|-----------|
| 1 | Readability |
| 2 | Clarity of intent and module boundaries |
| 3 | Brevity (delete > abstract) |
| 4 | Consistency with AGENTS.md / Exigo conventions |
| 5 | Correctness / security |

### Exigo conventions (enforce, from cd-review LOOP.md §11)

| Area | Rule |
|------|------|
| DB | Convex primary; do not grow Prisma |
| Auth Convex | `getAuthedContext` / plan gates |
| Auth API | Clerk → authed Convex client |
| AI | Prompts from Convex registry; SSE consistency; PostHog AI events |
| Shared | Cross-runtime pure code in `shared/` |
| Quality | delete > move > rewrite; surgical diffs |

---

## 2. Architecture (strict wave separation)

```text
┌─────────────────────────────────────────────────────────────────┐
│  ORCHESTRATOR (single agent, no human in the loop)              │
│  create/select RUN_ROOT · dispatch waves · consolidate ·        │
│  judge · write synthesis · update RECORD + day-status           │
└────────────────────────────┬────────────────────────────────────┘
                             │ in-process subagents
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
   WAVE α — MAP         WAVE β — DECIDE     WAVE γ — SYNTHESIZE
   (N=8 parallel)       (M=5 parallel)      (γ=2 sequential)
   one per product area  one per cluster     claims + constraints
   write brainstorm/*   write research/*    write synthesis/*
   NO children          NO children         NO children
```

| Wave | Agent role | Reads | Writes | Spawns children? |
|------|------------|-------|--------|------------------|
| **α** | Product area mapper | Code in area + AGENTS.md | `brainstorm/B-{NNN}-{area}.md` | **No** |
| **β** | Decision package author | Cluster findings + code | `research/DP-{NNN}-{theme}.md` | **No** |
| **γ** | Synthesizer | All packages + claims | `synthesis/S-001-claims.md` + `S-002-constraints.md` | **No** |

---

## 3. Default product area map

| ID | Focus | Paths |
|----|-------|-------|
| PA1 | Course system (adaptive learning) | `convex/course*.ts`, `shared/courseConfig.ts` |
| PA2 | Tests & assessment generation | `convex/tests.ts`, `questions.ts`, `src/app/api/tests/` |
| PA3 | Knowledge graph & deep dives | `convex/knowledge*.ts`, `deepDives.ts` |
| PA4 | Spaces, plans & subscriptions | `convex/spaces.ts`, `plans.ts`, `planLimits.ts`, `subscription*.ts`, `shared/planConfig.ts` |
| PA5 | AI integration layer | `src/server/ai/`, `src/app/api/learn/`, `src/app/api/generate/`, `src/lib/sse.ts` |
| PA6 | Auth & access control | `convex/auth*.ts`, `src/middleware.ts`, `src/lib/apiAuth.ts` |
| PA7 | Shared code & lib utilities | `shared/`, `src/lib/` |
| PA8 | Frontend app shell & UI | `src/app/` (pages, layouts, components) |

Scale: one agent per area; split areas with many large files.

---

## 4. Wave α — Product area mapping

### 4.1 Subagent brief (template)

```text
You are a WAVE α PRODUCT MAPPING subagent for the Exigo product-improve loop.
RUN_ROOT={RUN_ROOT}
SUBAGENT_ID={SUBAGENT_ID}
AREA={AREA_ID} — {AREA_FOCUS}
PATHS={PATHS}

NORTH STAR: readable → clear → short → consistent → correct.
EXIGO CONVENTIONS: (paste §1 table)

TASK:
1. Read ALL files in PATHS.
2. Analyze for improvement opportunities.
3. Generate 3-7 concrete ideas. Each must have:
   - Title, Description (≤100 words), North-star improvement, Riskiest assumption, Warrant, Effort (S|M|L)

Focus: duplication, dead code, inconsistent patterns, missing conventions,
overly complex functions, unclear boundaries.

OUTPUT: {RUN_ROOT}/brainstorm/{SUBAGENT_ID}.md
RULES: Do NOT edit code. Do NOT spawn children. Cite file:line.
```

### 4.2 Orchestrator consolidation

After all Wave α subagents complete:
1. Read all `brainstorm/B-*.md` files.
2. Cluster ideas by semantic theme.
3. Score clusters by north-star impact (0-1).
4. Shortlist top 5 clusters.
5. Write `brainstorm/_consolidation.md`.

---

## 5. Wave β — Decision packages

### 5.1 Dispatch

One subagent per shortlisted cluster. Each verifies findings against code, then writes a decision package.

### 5.2 Decision Package format (matches cd-review Wave B)

```markdown
# Decision Package — {DP_ID}

**TRIGGER:** (what's wrong)
**NORTH_STAR_HURT:** (which axes)
**LOCATION:** (files)
**SYMPTOM:** (paragraph)
**EVIDENCE:** (file:line bullets)
**QUESTION:** (design question)

---

## Recommendation
- **Approach name:**
- **One-paragraph rationale:**
- **Why not alternatives:**

### Approaches considered
| ID | Name | Pros | Cons | North-star score | Effort |

### Minimal implementation sketch
- Files: / Steps: / What NOT to do:

### Skills applied / Research notes / Residual risks
### Suggested finding severity / title
```

---

## 6. Wave γ — Synthesis

Sequential (γ-2 reads γ-1 output):
- **γ-1 (claims):** Extract verified/refuted/inconclusive claims by theme → `S-001-claims.md`
- **γ-2 (constraints):** Convert verdicts to next-cycle constraints → `S-002-constraints.md`

Constraint types: `MUST_RESPECT` | `MUST_AVOID` | `MUST_TEST`

---

## 7. Record & resume

Same contract as cd-review and brainstorm loops:
- `RECORD.md` updated after every material step
- `day-status.json` tracks state/phase
- On resume: read `Stopped at`, scan existing artifacts, dispatch only missing subagents

---

## 8. Handoff to implementation

The loop produces decision packages, not code. Implementation is handed off to:
- `agents/cd-review/` for code-quality fixes (Wave C fixers execute packages)
- Human developers for product decisions requiring input

Recommended priority: dead code → convention enforcement → resilience → auth/limits.

---

## 9. History

| Date | Note |
|------|------|
| 2026-07-26 | Initial loop created. First cycle (cycle-001) completed: 8 areas mapped, 56 ideas, 5 decision packages (all ADVANCE), 5 constraints extracted. Modeled on `agents/brainstorm/LOOP.md` wave protocol + `agents/cd-review/LOOP.md` decision package format. |
