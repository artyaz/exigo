# Product Area Matrix — cycle-001

Dispatched Wave α subagents (parallel, one per product area):

| # | Area ID | Focus | Paths | Subagent ID |
|---|---------|-------|-------|-------------|
| 1 | PA1 | Course system (adaptive learning backend) | `convex/course*.ts` | B-001-course |
| 2 | PA2 | Tests & assessment generation | `convex/tests.ts`, `questions.ts`, `src/app/api/tests/` | B-002-tests |
| 3 | PA3 | Knowledge graph & deep dives | `convex/knowledge*.ts`, `deepDives.ts` | B-003-knowledge |
| 4 | PA4 | Spaces, plans & subscriptions | `convex/spaces.ts`, `plans.ts`, `planLimits.ts`, `subscription*.ts`, `shared/planConfig.ts` | B-004-plans |
| 5 | PA5 | AI integration layer (API routes + server AI) | `src/app/api/`, `src/server/ai/` | B-005-ai |
| 6 | PA6 | Auth & access control | `convex/auth*.ts`, `src/middleware.ts`, `src/lib/apiAuth.ts`, `convex/spaceAccess.ts` | B-006-auth |
| 7 | PA7 | Shared code & lib utilities | `shared/`, `src/lib/` | B-007-shared |
| 8 | PA8 | Frontend app shell & UI pages | `src/app/` (pages, layouts, components) | B-008-frontend |

## North-star criteria (ordered)

1. Readability
2. Clarity of intent and module boundaries
3. Brevity (delete > abstract)
4. Consistency with AGENTS.md / Exigo conventions
5. Correctness / security

## Exigo conventions to enforce (cd-review LOOP.md §11)

| Area | Rule |
|------|------|
| DB | Convex primary; do not grow Prisma |
| Auth Convex | `getAuthedContext` / plan gates |
| Auth API | Clerk → authed Convex client |
| AI | Prompts from Convex registry; SSE consistency; PostHog AI events |
| Shared | Cross-runtime pure code in `shared/` |
| Quality | delete > move > rewrite; surgical diffs |
