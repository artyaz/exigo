# Fix Pack P0-D — course ownership on AI entrypoints

**Date:** 2026-07-17  
**Findings:** F-S2-002, F-S2-003 (+ related F-S2-004 / S2-B001 ownership)  
**Brain:** [`audits/brainstorm/S2-B001.md`](../brainstorm/S2-B001.md)

## Problem

1. **F-S2-002:** `courseAi.normalizeTopic` accepted any `spaceId` and called `createInternal` without verifying space ownership → educator could plant courses into another user’s space.
2. **F-S2-003:** `generateBaselineQuestion` / `evaluateBaselineAnswer` required educator plan but never loaded the course or checked `course.userId` → any educator could burn Gemini quota against arbitrary `courseId`s; `courseTopic` was fully client-supplied.
3. **Related (S2-B001 / F-S2-004):** Public `courses.updatePhase` allowed owners to set any phase (state-machine bypass). Grep showed **zero** product callers.

## Approach (minimal)

Shared ownership helper + gate public writes (brain Approach A, subset for this pack):

| Change | File |
|--------|------|
| Fail-fast space ownership before AI + hard gate in `createInternal` | `convex/courseAi.ts`, `convex/courses.ts` |
| `requireOwnedCourseForAction` for baseline actions | `convex/courseAuth.ts` (new), `convex/courseAi.ts` |
| Prefer server `course.refinedTitle` as baseline topic | `convex/courseAi.ts` |
| Delete public `updatePhase`; keep `updatePhaseInternal` | `convex/courses.ts` |
| `getSpaceInternal` for action-side space load | `convex/courses.ts` |

Did **not** rewrite the whole course system, tutor, lessons, or educator gates on every write (remaining S2-B001 items stay for later packs).

## Code changes

### `convex/courseAuth.ts` (added)

```ts
export async function requireOwnedCourseForAction(
  ctx: ActionCtx,
  courseId: Id<"courses">,
  userId: string,
): Promise<Doc<"courses">>
```

Loads via `internal.courses.getInternal`; throws `"Course not found"` if missing or not owned (same message style as `generateModule`).

### `convex/courseAi.ts`

- **`normalizeTopic`:** after `requireEducatorAccess`, loads space via `internal.courses.getSpaceInternal` and requires `space.userId === auth.userId` **before** Gemini (avoids burning quota on foreign spaceId).
- **`generateBaselineQuestion`:** `requireOwnedCourseForAction`; prompt uses `course.refinedTitle || args.courseTopic`.
- **`evaluateBaselineAnswer`:** `requireOwnedCourseForAction` before Gemini.

### `convex/courses.ts`

- **`createInternal`:** verifies space exists and `space.userId === args.userId` before insert (defense in depth for all callers).
- **`getSpaceInternal`:** internal query for space docs (action-safe; no public `userId` arg).
- **Public `updatePhase` removed**; `updatePhaseInternal` retained for orchestrator / backend.

## Auth pattern matched

Same as `courses.create` / `createCourseFromNormalized`:

- `getAuthedContext` / `getAuthedContextForAction` + `requireEducatorAccess`
- Resource ownership: `space.userId === auth.userId` / `course.userId === auth.userId`

## Verification

- `npx tsc --noEmit -p convex/tsconfig.json` — pass
- Repo grep: no product callers of `api.courses.updatePhase` / `updatePhase(` outside definition (deleted)
- Call path for create still: `startCourseAction` → `normalizeTopic` → `createInternal` (space check now on both sides)

## Residual / out of scope for P0-D

- Educator gate on `updateBaseline`, tutor chat create/send, checkpoint/feels-hard (S2-B001 steps not in this pack)
- Client can still pass untrusted question/answer text into evaluate baseline (prompt injection — S2-B006)
- Subscription lapse: owner who drops from EDUCATOR still owns courses (product rule TBD)
- Other `courseAi` actions already had course ownership; not refactored onto `requireOwnedCourseForAction` yet (optional cleanup)

## Status

**DONE** — F-S2-002, F-S2-003 fixed; dead public `updatePhase` removed.
