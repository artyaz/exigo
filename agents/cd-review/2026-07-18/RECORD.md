# cd-review RECORD — 2026-07-18

## Status

| Field | Value |
|-------|--------|
| **State** | in_progress (product waves 6–13 **shipped** main+develop; LOOP harness ship in flight) |
| **Branch** | `fix/cd-review-loop-harness` |
| **Last updated** | 2026-07-18 (catch-up: RECORD truth + LOOP §0.5/§10.2 ship) |
| **Continues from** | Same calendar window as product work started 2026-07-17 (UTC/session) |
| **RUN_ROOT** | `agents/cd-review/2026-07-18` |

## Goal this run

Hostile codebase review → brainstorm → fix for Exigo, prioritizing readability, clarity, brevity, consistency, then correctness. Ship via develop/main PR policy + CodeRabbit iteration. Protocol lives in `agents/cd-review/LOOP.md`.

## Waves (product execution)

| Wave | Status | Notes |
|------|--------|-------|
| A Audit | **done** | 11 slices (S1–S11); ~115 findings; artifacts in `audits/slices/` |
| B Brainstorm | **done** | 59 packages in `brainstorms/` |
| C Fix P0–P5 | **shipped** | early waves → main |
| Wave 6 residual | **shipped** | P6-A–D; #81 develop path, #83 main (stack with 7–8) |
| Wave 7 residual | **shipped** | P7-A–D; included in #83 main stack |
| Wave 8 residual | **shipped** | P8-A–B; #81 develop, #83 main (#84 main→develop sync) |
| Wave 9 | **shipped** | P9-A tutor route split; #85 develop, #86 main |
| Wave 10 | **shipped** | P10-A default_user quarantine; #87 develop, #88 main |
| Wave 11 | **shipped** | P11-A resolveAiProvider teach/clarify; P11-B tutor SSE; #89/#90 |
| Wave 12 | **shipped** | P12-A remaining Next AI routes; P12-B vector memory; #91/#92 |
| Wave 13 | **shipped** | throwUnauthorized helpers (F-W7-012); #93 develop, #94 main |
| LOOP harness | **shipping** | L-1 launcher + L0 day-scope CLI + CodeRabbit 5m/10m iteration |

## Done (chronological)

### Branch hygiene (early session)

- Consolidated remote branches to **main** + **develop** only.
- Merged exercise UX / develop divergence via PRs (branch protection required PR path).

### Waves 1–5

See earlier session history: P0–P5 product fixes shipped via #58–#74 (security, SSE, plan SSOT, god-page splits, lesson hooks, gen lock).

### Ops / Vercel

- Root cause of deploy fails: `api/generate/atlas` `maxDuration = 800` (Hobby max 300) → fixed #66/#67.
- Secrets set (not committed): `EXIGO_SERVER_MUTATION_SECRET`, `PADDLE_CONVEX_WEBHOOK_SECRET` on Convex dev+prod, Vercel, local `.env.local`.

### Wave 6 — residual product

| Pack | Outcome |
|------|---------|
| P6-A | `generationClaimedAt` + 15m lock TTL / steal |
| P6-B | `useTestQuestionGeneration` on majority SSE dialect |
| P6-C | AGENTS.md dual AI paths documented |
| P6-D | `seedPlans.syncPerksFromSsot` |
| P6-E | LessonPhase further split **deferred** (optional P3) |

### Wave 7 — residual hostile + fix

| Pack | Outcome |
|------|---------|
| S-W7 audit | 16 findings |
| P7-A–D | sseClient remigrate; dead duals deleted; secret fail-fast; identity-first spaces/tests |

### Wave 8 — readability

| Pack | Outcome |
|------|---------|
| P8-A | `useFeelsHardMenu` + `LessonCompletePanel`; LessonPhase ~483 |
| P8-B | Shared `getEnvGeminiClient` / `getEnvGeminiModel` |

### Artifact reorg

- `agents/cd-review/LOOP.md` + dated `2026-07-18/` run tree.
- Wave A/B separation: auditors write audits only.

### Waves 9–13 (shipped after RECORD went stale)

| Wave | Packs | Main PR |
|------|-------|---------|
| 9 | P9-A tutor tools + context modules (813→~330) | #86 |
| 10 | P10-A `default_user` read quarantine / write strict | #88 |
| 11 | P11-A teach/clarify `resolveAiProvider`; P11-B majority SSE tutor | #90 |
| 12 | P12-A remaining Next routes BYOK path; P12-B vector memory search | #92 |
| 13 | ConvexError `throwUnauthorized` helpers across ownership paths | #94 |

**Catch-up note (2026-07-18 later session):** On resume, open PRs from early “Stopped at” were already merged; `gh` keyring token was stale but git osxkeychain OAuth still works for API. No open product PRs remained. Local unfinished work was **LOOP.md harness protocol** + this RECORD truth-up.

### LOOP harness protocol (this ship)

- §0.5 L-1 launcher (user-triggered) vs L0 day-scope CLI agent (~300k–350k scope, no HITL).
- §10.2 ship: land develop → PR main → sleep 5m → CodeRabbit complete pass → 10m if pending → fix/push iterate; empty CR is suspicious.
- `audits/day-status.json` for thin launcher polls.

## In flight

- Ship `fix/cd-review-loop-harness` → develop + main (LOOP.md + RECORD + day-status).
- Prefer develop←main sync after main merge if develop tip lacks main merge commits (content already aligned through #93).

## Stopped at

1. **Ship** LOOP harness branch through develop + main + CodeRabbit iteration (§10.2).
2. **Ops (if not yet on prod):** `npx convex run --prod seedPlans:syncPerksFromSsot '{}'` after Wave 6+ code is deployed.
3. **Next product residual (Wave 14+ backlog, same RUN_ROOT):** see table below — not blocking this ship.

## Residual / backlog (priority)

| Priority | Item | Source | Status |
|----------|------|--------|--------|
| P1 | TTL generation lock | P5-C | **done** P6-A |
| P1 | Teach/clarify sseClient | F-W7-001 | **done** P7-A |
| P1 | Identity-first spaces/tests | F-W7-003 | **done** P7-D |
| P1 | Product Next → resolveAiProvider | F-W7-002 | **done** P11-A + P12-A (tutor tools still env Gemini) |
| P2 | Dead dual AI delete | F-W7-005/006 | **done** P7-B |
| P2 | Secret fail-fast | F-W7-014/015 | **done** P7-C |
| P2 | Shared env Gemini helpers | F-W7-011 | **done** P8-B |
| P2 | LessonPhase feels-hard + complete | F-W7-009 | **done** P8-A (~483 lines; further split optional) |
| P2 | Tutor god route split | F-W7-007 | **done** P9-A |
| P2 | Tutor SSE dialect unify | F-W7-010 | **done** P11-B |
| P2 | default_user policy | F-W7-004 | **done** P10-A |
| P2 | ConvexError helpers | F-W7-012 | **done** wave 13 |
| P2 | Tutor memory vector search | F-W7-013 | **done** P12-B |
| P2 | Tutor tool-calling / embeddings on AiProvider | P12 residual | **open** (function calling not on AiProvider yet) |
| P3 | courseAi further phase split | F-W7-008 | **open** (`courseAi.ts` still ~937 lines) |
| P3 | LessonPhase section/checkpoint JSX | P8 residual | **open** optional (~483 lines) |
| P3 | CodeRabbit PR scope / path filters | ops | ongoing |

## Valuable notes

### Product assumptions

- **`MAX_MODULES = 5`** in `shared/courseConfig.ts` — interim course terminal rule.
- Free tier **3** tests/month is code truth; marketing must match `LIMITS_BY_TIER`.

### Env / deploy

| Variable | Purpose |
|----------|---------|
| `EXIGO_SERVER_MUTATION_SECRET` | Next + Convex; teacher/tutor AI role writes |
| `PADDLE_CONVEX_WEBHOOK_SECRET` | Next + Convex paddle hop |
| Hobby Vercel | `maxDuration` ≤ 300 |

### Process lessons

- Protected `main`/`develop` → always PR; product-scoped PRs avoid CodeRabbit “too many files”.
- **Launcher vs day-scope:** spawn separate `grok` CLI for large scopes; poll RECORD + day-status only.
- File-based Wave A → Wave B is the supported audit→brainstorm protocol.
- `gh auth` keyring can rot while `git credential-osxkeychain` OAuth still works — use the latter for API if needed.

### Artifact paths (this run)

```text
agents/cd-review/LOOP.md
agents/cd-review/2026-07-18/RECORD.md
agents/cd-review/2026-07-18/audits/day-status.json
agents/cd-review/2026-07-18/audits/slices/…
agents/cd-review/2026-07-18/audits/fixes/P0–P12*.md
agents/cd-review/2026-07-18/brainstorms/…
```

## PRs / commits (index)

| PR | Target | Topic |
|----|--------|--------|
| #58–#74 | develop/main | waves 1–5 + layout + maxDuration |
| #81 / #83 | develop/main | waves 6–8 residual |
| #84 | develop | main→develop sync |
| #85 / #86 | develop/main | wave 9 tutor split |
| #87 / #88 | develop/main | wave 10 default_user |
| #89 / #90 | develop/main | wave 11 AI provider + SSE |
| #91 / #92 | develop/main | wave 12 routes + vector memory |
| #93 / #94 | develop/main | wave 13 throwUnauthorized |
| (this ship) | develop/main | LOOP harness + RECORD catch-up |

## How to resume

```text
1. Read agents/cd-review/LOOP.md (§0.5 launcher / day-scope, §10.2 ship)
2. Read this RECORD.md (Stopped at + Residual)
3. Finish LOOP harness PR CodeRabbit iteration if open
4. Next product: Wave 14 from residual (tutor AiProvider tools, courseAi split, optional LessonPhase)
5. Update RECORD + day-status after every wave/ship
```
