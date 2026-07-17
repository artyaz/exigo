# Fix pack P5-A — LessonPhase concern hooks (S7-B004)

**Findings:** S7-B004 (P1 — `LessonPhase` mixes teach SSE, checkpoints, and clarification runtime)  
**Brain:** Approach B — extract hooks by concern; leave JSX composition in the phase  
**Status:** done

## Summary

Split the ~1139-line `LessonPhase` teach/checkpoint/clarify state machines into three hooks under `src/app/_components/learn/`. The phase component now owns layout, “feels hard” context menu, summarize/advance, and wires the hooks. No API or SSE body contract changes.

## Line counts

| File | Lines |
|------|------:|
| **Before** `LessonPhase.tsx` | **1139** |
| **After** `LessonPhase.tsx` | **565** |
| `useLessonTeachStream.ts` (new) | 151 |
| `useLessonCheckpoints.ts` (new) | 307 |
| `useLessonClarifications.ts` (new) | 436 |

`LessonPhase` roughly halved; concern logic lives next to other Learn UI (`SelectionBubble`, `ClarificationThread`).

## What moved

### `useLessonTeachStream.ts`
- `fullText` / `isTeaching`
- `/api/learn/teach` fetch + SSE parse (`delta` / `done` / `error`)
- Start-once ref + auto-start effect (empty snapshot only)
- Checkpoint side-effects via `checkpointBridgeRef` (reset / first-section reveal / apply done) so hook declaration order stays acyclic

### `useLessonCheckpoints.ts`
- `revealedCount`, answered map, current input, verification, `userInput`, `isLessonComplete`
- DB restore effect (`waitingForLocalAdvance` preserved)
- `advanceToNextCheckpoint`, `handleSubmitInput` (`verifyInputAction`), `handleSkip` (`saveCheckpointState`)
- `resetForTeach` / `revealFirstSection` / `applyTeachDone` for the teach bridge

### `useLessonClarifications.ts`
- Selection bubble state + keydown handler (incl. in-thread reply via `replyThreadId`)
- Threads `Map`, clarify SSE (`/api/learn/clarify`), reply + expand toggle
- Restore threads from `lessonMessages` (same merge rules for in-flight streams)

## Cleanup (this pack)

| Removed | Why |
|---------|-----|
| `isClarifySubmitting = false` | Always false; dead loading flag |
| `pendingInThreadReply` ref + process effect | Never written; keydown already uses `replyThreadId` |
| Comment “Threads for this section are rendered via portal — see below” | Liar — threads render via `blockAppendages` |

## Explicitly not changed

- Teach / clarify request bodies and SSE event shapes
- Checkpoint persistence shape / `restoreLessonRuntimeState` pure logic
- Feels-hard menu (stays in phase)
- Shared client SSE helper (S7-B002 / separate pack)

## Residual risks

| Risk | Notes |
|------|--------|
| Teach auto-start vs restore race | Effect deps + start-once ref + `waitingForLocalAdvance` copied as-is |
| Bridge ref assignment each render | Populated after both hooks; teach only runs post-commit / on user path |
| Clarification Map updates during stream | Same setState pattern as before |

## Verification

```bash
npx tsc --noEmit
# exit 0
```

## Files touched

| File | Change |
|------|--------|
| `src/app/spaces/[spaceId]/learn/[courseId]/LessonPhase.tsx` | Composition only |
| `src/app/_components/learn/useLessonTeachStream.ts` | New |
| `src/app/_components/learn/useLessonCheckpoints.ts` | New |
| `src/app/_components/learn/useLessonClarifications.ts` | New |
| `audits/fixes/P5-A.md` | This writeup |
