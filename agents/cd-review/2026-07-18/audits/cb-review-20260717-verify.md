# Verify — cb-review 2026-07-17 (iteration 1, after P0 wave 1)

## Commands

| Command | Result |
|---------|--------|
| `npx tsc --noEmit` | **pass** (after removing stale `.next/types` refs to deleted WIP routes) |
| `npm run test` | **pass** — 29 files, **302** tests |
| `npm run check` (lint+tsc) | Lint: warnings only (pre-existing unused vars on spaces page, etc.). Initial tsc failed on stale `.next/types` for missing `knowledge-map` / `lesson-exercise` — not introduced by P0 packs. |

## P0 packs verified present

| Pack | Status | Artifact |
|------|--------|----------|
| P0-A userSettings auth | done | `audits/fixes/P0-A.md` |
| P0-B questions auth | done | `audits/fixes/P0-B.md` |
| P0-C message roles | done | `audits/fixes/P0-C.md` |
| P0-D course ownership | done | `audits/fixes/P0-D.md` |
| P0-E dead usage API | done | `audits/fixes/P0-E.md` |

## Residual / next

- Wave 2 P1 packs in master audit (SSE helpers, plan SSOT, Open/Embed, liar tests, middleware, sessionStorage).
- Large clarity refactors (god pages S7/S11) deferred.
- Deploy Convex schema/functions before Next so empty-arg validators ship together.
- Lint cleanup on `spaces/[spaceId]/page.tsx` dead imports (S7 finding, not blocking).

## Decision (Phase F)

- **No open P0 from wave 1** (addressed).
- Iteration 1 can stop here or continue wave 2.
