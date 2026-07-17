# cd-review RECORD — 2026-07-18

## Status

| Field | Value |
|-------|--------|
| **State** | paused (structure reorg done; product waves 0–5 already shipped earlier in session) |
| **Branch** | `develop` / `main` (both received waves through #73/#74) |
| **Last updated** | 2026-07-18 (artifact relocation + loop polish) |
| **Continues from** | Same calendar window as product work started 2026-07-17 (UTC/session) |
| **RUN_ROOT** | `agents/cd-review/2026-07-18` |

## Goal this run

Hostile codebase review → brainstorm → fix for Exigo, prioritizing readability, clarity, brevity, consistency, then correctness. Ship via develop/main PR policy. Later: reorganize all loop artifacts under `agents/cd-review/` with dated runs and strict Wave A/B separation.

## Waves (product execution — completed before reorg)

| Wave | Status | Notes |
|------|--------|-------|
| A Audit | **done** | 11 slices (S1–S11); ~115 findings; artifacts now in `audits/slices/` |
| B Brainstorm | **done** | 59 packages; originally nested under audits/brainstorm — now `brainstorms/` |
| C Fix | **done** | P0 (5 packs), P1 (5), P3 (6), P4 (5), P5 (5) |
| Verify | **done** per ship | tests 270–281; CI build green after lint fixes |
| Ship | **done** | See PR list below |
| Artifact reorg | **done** | Moved into this RUN_ROOT; LOOP.md polished |

## Done (chronological)

### Branch hygiene (early session)

- Consolidated remote branches to **main** + **develop** only.
- Merged exercise UX / develop divergence via PRs (branch protection required PR path).

### Wave 1 — P0 security / dead surface

| Pack | Outcome |
|------|---------|
| P0-A | `userSettings` identity-first auth (no client `userId`) |
| P0-B | `questions` identity + space ownership; soft-fail reads |
| P0-C | Public message send forces `role: user`; teacher/tutor writers |
| P0-D | Course/space ownership on normalize + baseline; dead `updatePhase` removed |
| P0-E | Deleted ungated `usageService` + dead cron/helpers |

**CodeRabbit (#61):** default_user write hole closed; `getAuthedContext`; AI writers require `EXIGO_SERVER_MUTATION_SECRET`.

**Shipped:** #58 develop, #61 main (product-scoped after #59 file-limit skip).

### Wave 2 — P1 clarity

| Pack | Outcome |
|------|---------|
| P1-B | `src/lib/sse.ts` + `apiAuth.ts`; learn/tests routes |
| P1-C | Shared `SandboxedFrame` for open/embed + host CSS |
| P1-D | Killed liar/shadow Convex tests |
| P1-E | Middleware: settings, knowledge-nodes, checkout, playground |
| P1-F | Tests use `test.knowledgePieceId` (no dead sessionStorage) |

**Shipped:** #63 develop, #64 main.

### Wave 3

| Pack | Outcome |
|------|---------|
| P3-A | Plan limits SSOT in `shared/planConfig`; free marketing 10→3 |
| P3-B | Tone palette via `visual.toneRgb`; unique Arena marker ids |
| P3-C | Single Next PostHog client (`posthog-server`) |
| P3-D | Typed `/tests` + `TestStackCard` |
| P3-E | Auth on public `getPrompt` |
| P3-F | validate/tutor on `requireAuthedApi` |

**Shipped:** #68 develop, #69 main.

### Wave 4

| Pack | Outcome |
|------|---------|
| P4-A | Paddle webhook: `PADDLE_CONVEX_WEBHOOK_SECRET`, accessLevel from planSlug, userId mismatch 409 |
| P4-B | `MAX_MODULES=5` → phase `completed`; generateModule guards |
| P4-C | Learn page **2080 → 301** lines |
| P4-D | Test detail **985 → 499** lines |
| P4-E | AGENTS.md SSOT docs + seed stale-perk notes |

**Shipped:** #70 develop, #71 main.

### Ops / Vercel

- Root cause of deploy fails: `api/generate/atlas` `maxDuration = 800` (Hobby max 300) → fixed #66/#67.
- Secrets set (not committed): `EXIGO_SERVER_MUTATION_SECRET`, `PADDLE_CONVEX_WEBHOOK_SECRET` on Convex dev+prod, Vercel prod/preview/dev, local `.env.local`.
- Production reached READY after maxDuration fix.

### Wave 5

| Pack | Outcome |
|------|---------|
| P5-A | LessonPhase **1139 → 565** (teach/checkpoint/clarify hooks) |
| P5-B | Space page **635 → 214**; KnowledgeTab + Esc modal; dead test-gen deleted |
| P5-C | Atomic `generationInProgress` claim (double-advance race) |
| P5-D | Client `sseClient` for CourseTutor/teach/clarify |
| P5-E | LessonMarkdown heading factory |

**CI:** first #73 lint fail (empty methods, redundant union, unnecessary assert) → fixed #74 + push; **#73 merged**.

**Shipped:** #72/#74 develop, #73 main.

### Artifact reorg (this step)

- Created `agents/cd-review/LOOP.md` (protocol).
- Moved all prior `audits/**` and brainstorm packages into `agents/cd-review/2026-07-18/`.
- Documented Wave A/B separation: auditors write audits only; separate brainstorm agents consume audits.

## In flight

- None product. Artifact layout is the current deliverable.

## Stopped at

1. **Product residual backlog** (not started as Wave 6):
   - Generation lock has no TTL if process dies mid-generate
   - Dual AI stack consolidation (direct Gemini routes vs `resolveAiProvider`)
   - `useTestQuestionGeneration` not yet on `sseClient`
   - Free-plan perk **DB** rows may still say “10 AI tests” until reseed/patch (enforcement already 3)
   - `LessonPhase` still ~565 lines (further optional split)
2. **Process residual:**
   - Historical brainstorm packages were produced *inline* by L1 agents (runtime lacked nested spawn). Going forward, **Wave A must not brainstorm**; Wave B is separate.
   - Root `loops/cb-review.md` should be removed or turned into a stub pointing here (do on commit).
3. **Next clean start:** if user asks for a new day run, create `agents/cd-review/$(date +%Y-%m-%d)/` per LOOP.md §1; set Continues from: `2026-07-18`.

## Residual / backlog (priority)

| Priority | Item | Source |
|----------|------|--------|
| P1 | TTL / reclaim for stuck `generationInProgress` | P5-C residual |
| P2 | Dual AI stack documentation or thin shared boundary | S8/S9 |
| P2 | Migrate test SSE generation to `sseClient` | P5-D residual |
| P2 | Optional seed refresh for free perk strings | P3-A / P4-E |
| P3 | Further LessonPhase JSX split | P5-A residual |
| P3 | CodeRabbit 100-file limit → keep product PRs scoped | ops note |

## Valuable notes

### Product assumptions

- **`MAX_MODULES = 5`** in `shared/courseConfig.ts` — interim course terminal rule.
- Free tier **3** tests/month is code truth; marketing must match `LIMITS_BY_TIER`.

### Env / deploy

| Variable | Purpose |
|----------|---------|
| `EXIGO_SERVER_MUTATION_SECRET` | Next + Convex; teacher/tutor AI role writes |
| `PADDLE_CONVEX_WEBHOOK_SECRET` | Next + Convex paddle hop (falls back to deploy key with warn) |
| Hobby Vercel | `maxDuration` ≤ 300 (atlas was 800) |

### Process lessons

- Protected `main`/`develop` → always PR; product-scoped PRs avoid CodeRabbit “too many files” when audits are huge.
- Nested subagent spawn was unreliable; **file-based Wave A → Wave B** is the supported protocol.
- Prefer disjoint fix packs by file ownership for parallel Wave C.

### Artifact paths (this run)

```text
agents/cd-review/LOOP.md
agents/cd-review/2026-07-18/RECORD.md          ← you are here
agents/cd-review/2026-07-18/audits/
  slices.md, slices/S1–S11.md, fixes/P0–P5*.md
  cb-review-20260717.md, cb-review-20260717-verify.md
agents/cd-review/2026-07-18/brainstorms/S*-B*.md
```

## PRs / commits (index)

| PR | Target | Topic |
|----|--------|--------|
| #58 | develop | P0 product |
| #59 | main | closed (too many files) |
| #60 | develop | CodeRabbit path filters |
| #61 | main | P0 + CR fixes |
| #62 | develop | CR follow-up |
| #63–64 | develop/main | wave 2 |
| #66–67 | main/develop | atlas maxDuration |
| #68–69 | develop/main | wave 3 |
| #70–71 | develop/main | wave 4 |
| #72–74 | develop/main | wave 5 + lint |

## How to resume product work

```text
1. Read agents/cd-review/LOOP.md
2. Read this RECORD.md (Stopped at + Residual)
3. Either continue fixes from Residual as Wave 6 under THIS date folder
   OR create agents/cd-review/YYYY-MM-DD/ for a clean audit pass using Wave A→B→C
4. Update RECORD after every wave/ship
```
