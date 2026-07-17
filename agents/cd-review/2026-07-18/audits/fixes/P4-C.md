# Fix pack P4-C — Split course learn god page (S7-B001)

**Finding:** S7-B001 — Course learn `page.tsx` multi-phase god page (~2080 lines)  
**Approach:** B — Extract phase components into colocated modules; shared pure helpers under `_components/learn/course/`  
**Status:** done

## Summary

Cut `src/app/spaces/[spaceId]/learn/[courseId]/page.tsx` along the already-named phase boundaries. Pure helpers moved first; each phase is its own file; `page.tsx` is a thin shell (auth, queries, phase switch, CourseTutor). No SSE/action contract or behavior changes.

## Line counts

| File | Lines |
|------|------:|
| **page.tsx before** | **2080** |
| **page.tsx after** | **301** |
| BaselinePhase.tsx | 430 |
| GeneratingPhase.tsx | 35 |
| LessonPhase.tsx | 1139 |
| SummaryPhase.tsx | 86 |
| `_components/learn/course/actionResult.ts` | 14 |
| `_components/learn/course/checkpointSerialize.ts` | 14 |
| `_components/learn/course/focusMode.tsx` | 103 |

Shell reduction: **2080 → 301** (~85% smaller route entry).

## What changed

### Shared helpers (`src/app/_components/learn/course/`)

| Module | Contents |
|--------|----------|
| `actionResult.ts` | `ClientActionResult`, `unwrapActionResult` |
| `checkpointSerialize.ts` | `serializeCheckpointMap`, `serializeVerification` |
| `focusMode.tsx` | `useActiveFocusTargets`, `FocusModeToggle` |

### Colocated phases (`src/app/spaces/[spaceId]/learn/[courseId]/`)

| File | Role |
|------|------|
| `BaselinePhase.tsx` | Baseline card arena + Q&A flow |
| `GeneratingPhase.tsx` | Module generation spinner / advance |
| `LessonPhase.tsx` | Teach stream, checkpoints, clarify, feels-hard (kept as one file) |
| `SummaryPhase.tsx` | Summary markdown + advance |
| `page.tsx` | Auth, Convex queries, tab/phase switch, CourseTutor |

### Shell (`page.tsx`)

Retains only:
- Clerk auth gate + course not-found
- Course/module/lesson/tests/pieces queries
- `?lessonId=` resolution + focus-mode keyboard toggle
- Phase switch: baseline / generating / lesson+summary tabs / completed
- `CourseTutor` mount for lesson/summary/completed

## Explicitly not changed

- No SSE event shapes (`delta` / `done` / `error`)
- No teach/clarify/verify/baseline action contracts
- No checkpoint restore semantics
- No baseline card physics
- No new global store / context / reducer (Approach C deferred)
- LessonPhase not further split (S7-B004 follow-up)

## Residual risks

| Risk | Notes |
|------|--------|
| LessonPhase still ~1.1k lines | Expected; S7-B004 (clarification extract) is the next cut |
| Large pure move blame noise | Cut-paste per file; logic unchanged |
| Import path drift | Verified `tsc --noEmit` clean |

## Verification

- `npx tsc --noEmit` — pass (exit 0)
- Phase exports: `BaselinePhase`, `GeneratingPhase`, `LessonPhase`, `SummaryPhase`
- Shell only exports default `CoursePage`

## Files touched

| File | Change |
|------|--------|
| `src/app/spaces/[spaceId]/learn/[courseId]/page.tsx` | Thin shell |
| `src/app/spaces/[spaceId]/learn/[courseId]/BaselinePhase.tsx` | **new** extract |
| `src/app/spaces/[spaceId]/learn/[courseId]/GeneratingPhase.tsx` | **new** extract |
| `src/app/spaces/[spaceId]/learn/[courseId]/LessonPhase.tsx` | **new** extract |
| `src/app/spaces/[spaceId]/learn/[courseId]/SummaryPhase.tsx` | **new** extract |
| `src/app/_components/learn/course/actionResult.ts` | **new** helper |
| `src/app/_components/learn/course/checkpointSerialize.ts` | **new** helper |
| `src/app/_components/learn/course/focusMode.tsx` | **new** helper |
| `audits/fixes/P4-C.md` | This writeup |

## Follow-ups (optional, out of pack)

1. S7-B004 — extract clarification thread runtime from LessonPhase
2. Optional later: colocate tests tab UI if it grows
