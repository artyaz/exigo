# Fix pack P4-B — Course phase machine terminal + generateModule guards

**Findings:** S2-B003 (P1 — phase machine never reaches `completed`; public `generateModule` bypasses orchestrator phase contract; concurrent advance can double-insert modules)  
**Brain:** Approach A subset — fixed `MAX_MODULES` terminal rule; orchestrator sets `completed`; `generateModule` entry guards; collapse duplicate generation arms

## What changed

### SSOT constant (`shared/courseConfig.ts`)

| Export | Role |
|--------|------|
| `MAX_MODULES` | **5** — fixed course length until product chooses user-end / AI-end |

Assumption documented in-file: UI already has “Course Completed!” for `phase === "completed"`, but backend never set that phase; a fixed budget is the minimal honest exit.

### Orchestrator (`convex/courseOrchestrator.ts`)

- **Phase diagram** comment at top: `baseline → module_generation → lesson ⇄ lesson_summary → module_complete → (completed \| next module_generation)`.
- **`loadCurrentModuleLessons`** helper — shared by `lesson` / `lesson_summary` arms.
- **`generateModuleAndStartLessons`** — collapsed shared path for first + subsequent modules (was duplicated in `module_generation` and `module_complete`).
- **`module_complete` terminal rule:** if `modules.length >= MAX_MODULES` → `updateProgress({ phase: "completed" })`; else claim `module_generation` then generate next.
- Orchestrator remains the structural phase writer (`completed`, `module_generation`, `lesson_summary`, etc.). `generateModule` still writes `phase: "lesson"` on successful content creation so GeneratingPhase UI exits.

### generateModule guards (`convex/courseAi.ts`)

| Guard | Behavior |
|-------|----------|
| Owner | `requireOwnedCourseForAction` (was inline null check) |
| Phase | Must be `"module_generation"` — rejects other phases |
| Cap | `existingModules.length >= MAX_MODULES` → throw |

Public action kept (orchestrator still calls `api.courseAi.generateModule`); not converted to `internalAction` in this subset.

## Phase flow after fix

```
baseline
  → module_generation  (orchestrator)
  → generateModule     (phase guard; creates module N; phase → lesson)
  → lesson ⇄ lesson_summary
  → module_complete
       if modules.length >= 5 → completed (terminal, UI "Course Completed!")
       else → module_generation → generateModule → …
```

## Product decision

- **MAX_MODULES = 5** without product sign-off; documented as interim. Change only `shared/courseConfig.ts` to retune.

## Residual

1. **Actions non-transactional** — two concurrent `advanceCourse` in `module_generation` can still both pass the phase check before either patches to `lesson`. No generation lock / conditional claim mutation yet.
2. **Partial failure mid-generate** — half-written modules (module row + partial lessons) still possible if AI/mutation fails mid-loop.
3. **No user “finish early”** — courses always run to 5 modules; Approach B not implemented.
4. **`generateModule` still public** — guarded, but clients could still call it when phase is `module_generation` (same as orchestrator path). Full internalization is a follow-up.

## Risks

| Risk | Notes |
|------|--------|
| Cap too low/high for product | 5 is an assumption; easy single-constant change |
| Courses already past 5 modules | Existing long courses: next `module_complete` advance sets `completed` without generating more |
| UI auto-advance on `module_complete` | `GeneratingPhase` still calls `advanceCourse`; now may land on `completed` instead of always generating |

## Tests run

```bash
npx tsc --noEmit
# clean
```

No dedicated unit tests for the orchestrator switch (actions hard to unit-test without Convex harness). Manual path: finish 5th module → advance → `phase === "completed"`.

## Follow-ups

1. Optional: claim mutation (`phase: module_generation` → `generating` with OCC) to close double-advance race.
2. Optional: convert `generateModule` to `internalAction` so only orchestrator can invoke.
3. Product: confirm 5 vs user-triggered complete vs AI syllabus flag.
