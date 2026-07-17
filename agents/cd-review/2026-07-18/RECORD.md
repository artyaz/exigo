# cd-review RECORD — 2026-07-18

## Status

| Field | Value |
|-------|--------|
| **State** | paused (Wave 6 code + verify done; not shipped) |
| **Branch** | `fix/wave6-product` (from layout reorg + main through #73) |
| **Last updated** | 2026-07-18 (Wave 6 residual implemented + verified) |
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
| Wave 6 residual | **code done / ship pending** | P6-A TTL, P6-B sseClient tests, P6-C dual-AI docs, P6-D perk sync; verify 281 tests |

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

### Wave 6 — residual product (same RUN_ROOT)

| Pack | Outcome |
|------|---------|
| P6-A | `generationClaimedAt` + `GENERATION_LOCK_TTL_MS` (15m); stale lock steal on claim; clear on release/phase leave |
| P6-B | `useTestQuestionGeneration` on `iterateParsedSseBlocks` / majority dialect |
| P6-C | AGENTS.md documents dual AI paths (Next `resolveAiProvider` vs Convex direct Gemini) — no runtime merge |
| P6-D | `seedPlans.syncPerksFromSsot` internalMutation for stale free “10” perk copy |
| P6-E | LessonPhase further split **deferred** (still ~566 lines, optional P3) |

**Verify:** `npm run check` green (pre-existing warnings only); `npm run test` **281** passed. See `audits/verify-wave6.md`.

**Ship:** not opened yet — branch `fix/wave6-product`.

### Artifact reorg (this step)

- Created `agents/cd-review/LOOP.md` (protocol).
- Moved all prior `audits/**` and brainstorm packages into `agents/cd-review/2026-07-18/`.
- Documented Wave A/B separation: auditors write audits only; separate brainstorm agents consume audits.

## In flight

- None code. Ship PR(s) for Wave 6 when ready.

## Stopped at

1. **Ship Wave 6** from `fix/wave6-product` (PR to develop/main per policy).
2. **Ops after deploy:** run `seedPlans.syncPerksFromSsot` on Convex deployments with stale free perk text.
3. **Optional residual:** P6-E LessonPhase further JSX split (~566 lines); CodeRabbit keep PRs scoped.

## Residual / backlog (priority)

| Priority | Item | Source | Status |
|----------|------|--------|--------|
| P1 | TTL / reclaim for stuck `generationInProgress` | P5-C | **done** P6-A |
| P2 | Dual AI stack documentation | S8/S9 | **done** P6-C (docs) |
| P2 | Migrate test SSE generation to `sseClient` | P5-D | **done** P6-B |
| P2 | Seed refresh for free perk strings | P3-A / P4-E | **done** P6-D (helper; run ops) |
| P3 | Further LessonPhase JSX split | P5-A | deferred |
| P3 | CodeRabbit 100-file limit → keep product PRs scoped | ops | open |

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
