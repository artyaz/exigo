# Fix pack P6-A — Generation lock TTL / reclaim

**Source:** P5-C residual #1 — process kill mid-generate leaves `generationInProgress` stuck  
**Priority:** P1  
**Status:** done

## Problem

`claimModuleGeneration` set a boolean lock with no timestamp. If the action process died after claim and before `releaseModuleGeneration` / successful `updateProgress`, the course could stay in `module_generation` with lock=true forever (no automatic reclaim).

## What changed

| File | Change |
|------|--------|
| `shared/courseConfig.ts` | `GENERATION_LOCK_TTL_MS = 15 * 60 * 1000` |
| `convex/schema.ts` | optional `generationClaimedAt: number` (wall-clock ms) |
| `convex/courses.ts` | claim sets claimedAt; stale lock (`age >= TTL` or missing claimedAt while locked) is stolen; release/updateProgress clear both fields |

### Claim rules (unchanged + TTL)

1. phase must be `module_generation`
2. if lock held and **not** stale → `{ claimed: false, reason: "in_progress" }`
3. if lock held and **stale** → steal (patch lock + new claimedAt)
4. module count under `MAX_MODULES`
5. else set `generationInProgress: true`, `generationClaimedAt: Date.now()`

Missing `generationClaimedAt` on an old locked row is treated as stale (safe reclaim for pre-P6-A courses).

## Residual

- True concurrent double-AI only if two claims both see stale at the same instant (OCC serializes patches; loser still gets in_progress).
- TTL does not cancel an in-flight Gemini call that is still running past 15m — only allows a *new* claim after expiry.
- Partial module insert residual from P5-C unchanged.

## Verify

- `npm run check` / `npm run test` (orchestrator)
