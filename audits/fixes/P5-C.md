# Fix pack P5-C — Concurrent generateModule / double-advance race

**Findings residual:** S2-B003 / P4-B residual #1 — actions are non-transactional; two concurrent `advanceCourse` in `module_generation` could both pass the phase check and insert two modules  
**Brain:** Approach A follow-up — atomic generation claim (OCC) + single guarded insert path

## Problem

`generateModule` is an **action** (not transactional). After P4-B, it checked `phase === "module_generation"` via a query, then later inserted a module. Two concurrent advances (double-click, React Strict Mode double-effect, overlapping `module_complete` → generate) could:

1. Both read `phase === "module_generation"`
2. Both call Gemini
3. Both `courseModules.createInternal` → **duplicate modules** / index chaos

## What changed

### Tiny schema field (`convex/schema.ts`)

| Field | Role |
|-------|------|
| `courses.generationInProgress?: boolean` | OCC lock held for the duration of one `generateModule` |

No new phase literal — UI still treats `module_generation` as GeneratingPhase.

### Claim / release (`convex/courses.ts`)

| Mutation | Behavior |
|----------|----------|
| `claimModuleGeneration` | Requires `phase === "module_generation"`, `generationInProgress !== true`, `modules.length < MAX_MODULES`. Sets lock; returns `{ claimed, moduleIndex }`. Loser of OCC sees lock already set. |
| `releaseModuleGeneration` | Clears lock only if still `module_generation` + in progress (failure path). |
| `updateProgress` | Leaving `module_generation` (e.g. → `lesson`) always sets `generationInProgress: false`. |

### generateModule (`convex/courseAi.ts`)

1. Auth + owner
2. **`claimModuleGeneration`** (replaces bare phase check)
3. AI + `createInternal` + lessons + `updateProgress({ phase: "lesson" })` inside try
4. On any failure after claim → **`releaseModuleGeneration`** then rethrow

Stable error: `MODULE_GENERATION_IN_PROGRESS_MSG` from `shared/courseConfig.ts`.

### Single insert path (`convex/courseModules.ts`)

`createInternal` now refuses insert unless:

- `phase === "module_generation"`
- `generationInProgress === true`
- `existing.length === moduleIndex` (no skip / double-insert)

### Orchestrator soft-return (`convex/courseOrchestrator.ts`)

`generateModuleAndStartLessons` catches the in-progress error and returns `{ nextPhase: "module_generation" }` so a second concurrent advance does not surface an error while the winner finishes; reactive UI exits GeneratingPhase when phase becomes `lesson`.

## Race after fix

```
advance A: claim → lock=true → AI → insert module N → phase=lesson, lock=false
advance B: claim → lock already true → throw in-progress → soft-return module_generation
```

Convex OCC ensures only one mutation commits the lock patch when both read `lock=false`.

## Files touched

| File | Change |
|------|--------|
| `convex/schema.ts` | optional `generationInProgress` |
| `convex/courses.ts` | claim / release; updateProgress clears lock |
| `convex/courseAi.ts` | claim-first generateModule + release on failure |
| `convex/courseModules.ts` | createInternal claim + index guards |
| `convex/courseOrchestrator.ts` | soft-return on in-progress |
| `shared/courseConfig.ts` | `MODULE_GENERATION_IN_PROGRESS_MSG` |
| `audits/fixes/P5-C.md` | this note |

## Residual

1. **Process kill mid-generate** after claim, before release/success — lock can stick until a later structural `updateProgress` leaves `module_generation` (or manual patch). No TTL steal.
2. **Partial failure after insert** (lessons loop) — still possible; release unlocks so a retry may create the *next* index while a half-written module remains (pre-existing P4-B residual).
3. **`generateModule` still public** — claim protects double-insert; full `internalAction` still a follow-up.
4. **Double AI cost avoided only when claim is first** — loser never reaches Gemini.

## Tests run

```bash
npx tsc --noEmit
# only pre-existing unrelated error in useLessonCheckpoints.ts import path
```

No harness for concurrent action races; correctness is structural (OCC claim + insert guards).

## Follow-ups

1. Optional: convert `generateModule` to `internalAction` (orchestrator-only).
2. Optional: claim steal / timeout if process death leaves sticky lock in production.
3. Optional: transactional “create module + all lessons + phase” batch to shrink partial-write window.
