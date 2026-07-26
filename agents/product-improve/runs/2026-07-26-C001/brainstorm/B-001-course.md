# B-001 — Course System (PA1)

## Subagent meta
- cycle_id: cycle-001
- subagent_id: B-001-course
- area: PA1
- completed_at: 2026-07-26T00:00:00Z

## Files reviewed
- convex/courseOrchestrator.ts (223 lines)
- convex/courseAi.ts (938 lines)
- convex/courseLessons.ts (406 lines)
- convex/courseModules.ts (90 lines)
- convex/courseLessonMessages.ts (154 lines)
- convex/courseTutor.ts (364 lines)
- convex/courseTutorSearch.ts (41 lines)
- convex/courseAuth.ts (23 lines)
- convex/coursePrompts.ts (99 lines)
- shared/courseConfig.ts (27 lines)
- shared/currentModuleInsertion.ts (130 lines)

## Ideas

### I-001-001: Extract a shared AI-call helper to kill 8× boilerplate in courseAi.ts
- Description: Every action in courseAi.ts repeats the same 10-line sequence: `getAiClient()` → pick model → `getPromptInternal` → `renderPrompt` → `Date.now()` → `generateContent` → `captureAiGenerationEvent` → `response.text?.trim()` → `safeParseJson`. This block appears verbatim in normalizeTopic (119-138), normalizeTopicOnly (178-197), generateBaselineQuestion (254-277), evaluateBaselineAnswer (309-325), generateModule (455-479), setMasteryGoals (565-581), verifyInput (635-655), and twice in summarizeLesson (796-811, 887-916). A single `runAiJson<T>(ctx, auth, { promptName, model, variables })` helper returning parsed JSON would delete ~180 lines and make each action read as intent, not plumbing.
- North-star improvement: Directly serves readable + short by replacing eight copies of identical plumbing with one named abstraction.
- Riskiest assumption: That all eight call sites are uniform enough (single prompt, single JSON response) that one helper signature fits without special-casing.
- Warrant: The repetition is mechanical and already proven identical; the only variance is model choice and prompt variables, both trivially parameterizable. This is the highest-leverage deletion in the area.
- Effort: M

### I-001-002: Merge normalizeTopic and normalizeTopicOnly into one action
- Description: `normalizeTopic` (courseAi.ts:92-157) and `normalizeTopicOnly` (courseAi.ts:160-204) are 95% identical — same prompt, same model, same parse. They differ only in that normalizeTopic also creates a course record and requires a spaceId. normalizeTopicOnly exists solely to preview a refined title without persisting. Folding the shared AI core into one private function (or making course creation conditional on an optional spaceId) removes ~50 duplicated lines and one whole exported action.
- North-star improvement: Serves short + clear by eliminating a near-verbatim duplicate action.
- Riskiest assumption: That no caller depends on normalizeTopicOnly having a distinct Convex endpoint identity (e.g. separate rate limiting or codegen reference).
- Warrant: The two handlers share lines 168-197 ≈ 109-138 exactly; the delta is 6 lines of course creation. This is textbook delete-over-add.
- Effort: S

### I-001-003: Extract a lesson→course ownership guard into courseAuth.ts
- Description: Six call sites repeat the same 8-line pattern — fetch lesson, fetch course by lesson.courseId, compare course.userId to auth.userId, throw if mismatch: setMasteryGoals (courseAi.ts:536-549), verifyInput (605-618), summarizeLesson (717-730), markCompleted (courseLessons.ts:344-348), saveCheckpointState (283-289), addPendingFeelsHard (367-371). courseAuth.ts already has `requireOwnedCourseForAction` for actions; adding a `requireOwnedLesson(ctx, lessonId, userId)` (and a mutation-context variant) would collapse all six copies into one-liners and centralize the "Lesson not found" / unauthorized wording.
- North-star improvement: Serves short + consistent by replacing six divergent hand-rolled checks with one canonical guard.
- Riskiest assumption: That the action vs mutation context split (ActionCtx runQuery vs MutationCtx db.get) can be bridged by two thin variants without over-abstracting.
- Warrant: courseAuth.ts is the established home for exactly this concern and is currently under-used; the duplication already causes inconsistent error messages ("Lesson not found" vs silent throwUnauthorized).
- Effort: S

### I-001-004: Introduce a CoursePhase union + phase constants in shared/courseConfig.ts
- Description: Phase literals ("baseline", "module_generation", "lesson", "lesson_summary", "module_complete", "completed") are scattered as raw strings across courseOrchestrator.ts (switch + updateProgress calls), courseAi.ts:510, courseLessons.ts:138, and courseModules.ts:21. `AdvanceResult.nextPhase` is typed `string` (courseOrchestrator.ts:16), so the compiler cannot catch a typo'd phase. Defining `COURSE_PHASES` as a const array + `CoursePhase` union in shared/courseConfig.ts, and typing nextPhase/switch against it, makes the state machine explicit and compile-checked. The inline `lessonDoneStatuses` array (courseOrchestrator.ts:154) is a similar candidate for a named constant.
- North-star improvement: Serves clear + consistent + correct by turning an implicit stringly-typed state machine into an explicit, compiler-verified one.
- Riskiest assumption: That the Convex schema's phase field and all updateProgress callers can adopt the shared union without a schema migration.
- Warrant: The orchestrator's own doc comment (courseOrchestrator.ts:21-35) already documents the machine in prose; promoting it to types is low-risk and prevents the "unknown phase" runtime throw (line 219) from ever being a typo bug.
- Effort: S

### I-001-005: Delete the legacy chat-migration shim in courseTutor.getChatsForSpace
- Description: `getChatsForSpace` (courseTutor.ts:30-77) runs an N+1 query: it fetches every course in the space, then for each course re-queries chats by (userId, courseId), keeping only those with `chat.spaceId === undefined` (lines 52-71). This is a backward-compat shim for chats created before spaceId existed. It adds latency and complexity to every space-chat list load. If backfill is complete, this is dead code; if not, it belongs in a one-time migration script, not the hot read path. Removing it (or gating behind a feature flag) cuts ~25 lines and an N+1.
- North-star improvement: Serves readable + short by removing a per-request migration join that obscures the simple "chats for space" intent.
- Riskiest assumption: That all production courseTutorChats now have spaceId populated, so no legacy chats would disappear from the UI.
- Warrant: The code self-labels as "legacyChatGroups" and filters on an undefined-field heuristic — a classic temporary shim. Even if some rows remain, the correct fix is a data backfill, not a permanent query-time join.
- Effort: S

### I-001-006: Decompose the 230-line summarizeLesson action into focused steps
- Description: `summarizeLesson` (courseAi.ts:709-937) does five distinct jobs in one handler: (1) generate the summary AI call, (2) regex-strip disallowed sections, (3) create a KnowledgePiece + link it, (4) flush pendingFeelsHardNodes, (5) run a second AI call (lesson_knowledge_nodes) and persist those nodes, then update status. The second AI call and the Exigo-integration writes (lines 829-933) are conceptually a separate "integrate lesson into space" concern. Extracting an `integrateLessonIntoSpace` internal action would halve the function, make the summarizer independently testable, and isolate the knowledge-node AI failure surface.
- North-star improvement: Serves readable + clear by giving each responsibility a name and shrinking the longest function in the area to ~60 lines.
- Riskiest assumption: That the two AI calls and integration writes don't rely on shared in-handler transactionality or ordering that would break across an action boundary.
- Warrant: The function already has a natural seam marked by the `// ─── Exigo Integration ───` comment (line 829); the code is literally pre-sectioned for extraction. Convex actions compose cleanly via runAction.
- Effort: M

### I-001-007: Unify server-secret write naming and role vocabulary (teacher vs tutor)
- Description: courseLessonMessages.ts exposes `sendTeacher` with role `"teacher"` (lines 84-110), while courseTutor.ts exposes `sendTutorMessage` with role `"tutor"` (lines 191-208). Both are server-secret-gated writes for Next.js AI routes, serving the identical purpose of "backend posts an AI turn." The divergent names (sendTeacher vs sendTutorMessage) and role strings ("teacher" vs "tutor") force readers to learn two vocabularies for one concept and make grep/audit harder. Picking one term and aligning the mutation names + role literals improves cross-file consistency.
- North-star improvement: Serves consistent by collapsing two names for the same server-write concept into one vocabulary.
- Riskiest assumption: That stored role values ("teacher"/"tutor") in existing documents won't break UI filters if renamed, requiring a data-aware rename rather than a pure code change.
- Warrant: Both files already share the exact same `assertServerMutationSecret` + ownership pattern; only the label differs, so this is a naming-consistency cleanup, not a behavior change.
- Effort: S

## Patterns observed
- **AI-call boilerplate is the dominant duplication**: courseAi.ts is 938 lines largely because the same 10-line generate→capture→parse sequence is copy-pasted 8 times. This is the single biggest readability tax in the area.
- **Ownership checks are hand-rolled per site**: lesson→course→userId and course→userId guards recur ~10 times across courseAi.ts, courseLessons.ts, courseLessonMessages.ts, and courseTutor.ts with slightly different error wording, despite courseAuth.ts existing to centralize them.
- **Stringly-typed state machine**: course phases and lesson statuses are raw string literals spread across 5 files; only courseLessons.ts defines a `LESSON_STATUS` validator, and no file defines a phase union. The orchestrator documents the machine in a comment but not in types.
- **Two auth entry styles coexist**: actions use `getAuthedContextForAction` + `requireEducatorAccess`, mutations mix `getAuthedContext` + `requireEducatorAccess` with bare `getAuthenticatedUserId` + manual compare. Educator-access enforcement is inconsistent (courseTutor mutations skip requireEducatorAccess entirely).
- **JSON-in-string fields**: masteryGoals, verifierLogs, subTopics, and checkpointStates are all JSON-stringified into Convex string fields and re-parsed with try/catch at each read site, repeating the same corrupted-data fallback (courseAi.ts:664-668, 732-748).
- ** getModelPro vs getModel is a no-op distinction**: both default to "gemini-3-flash-preview" (courseAi.ts:31,35), so the "Pro" tier currently changes nothing unless env overrides it — a latent confusion for readers.

## Recommended brainstorm clusters
- **Cluster A — AI-call consolidation** (I-001-001, I-001-002, I-001-006): Tackle together because extracting the shared `runAiJson` helper is a prerequisite that makes merging normalizeTopic and decomposing summarizeLesson trivial, mechanical follow-ups. Highest combined line-deletion.
- **Cluster B — Ownership & auth centralization** (I-001-003, I-001-007): Group because both move repeated guard/role logic into canonical homes (courseAuth.ts + a unified role vocabulary) and together standardize the auth story across course files.
- **Cluster C — State-machine typing** (I-001-004): Standalone, low-risk, high-clarity; can land independently and immediately benefits the orchestrator and all phase-writing callers.
- **Cluster D — Dead-code pruning** (I-001-005): Standalone quick win; verify legacy-chat backfill status then delete the shim.
