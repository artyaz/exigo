# Slice S-W7 residual

**Wave:** 7 residual hostile pass  
**Date:** 2026-07-18  
**Scope:** Post–Wave 0–6 debt only (auth, plan SSOT, SSE client, generation TTL, perk sync, god-file splits already shipped — do not rehash as new work unless **regressed**).  
**North star:** readable → clear → short → consistent → correct  

## Files reviewed

| Area | Paths |
|------|--------|
| Prior notes | `RECORD.md`, `audits/verify-wave6.md`, `audits/fixes/P5-A.md`, `P5-D.md`, `P6-A..D.md` |
| Convex | `authDecorators.ts`, `spaces.ts`, `tests.ts`, `knowledgePieces.ts`, `knowledgeNodes.ts`, `knowledgeNodesActions.ts`, `deepDives.ts`, `questions.ts`, `courseAi.ts`, `courseOrchestrator.ts`, `courseLessonMessages.ts`, `courseTutor.ts`, `coursePrompts.ts`, `courseLessons.ts`, `testMessages.ts`, `testMessagesActions.ts`, `debugPlan.ts`, `planLimits.ts` |
| API / server | `src/lib/apiAuth.ts`, `sseClient.ts`, `sse.ts`, `src/server/ai/resolve.ts`, `src/app/api/learn/{teach,clarify,tutor}/route.ts`, `src/app/api/tests/{generate,validate,chat,feels-hard}/route.ts`, `src/app/api/knowledge/title/route.ts`, `src/app/api/generate/**` |
| Learn UI | `LessonPhase.tsx`, `useLessonTeachStream.ts`, `useLessonClarifications.ts`, `useLessonCheckpoints.ts`, `CourseTutor.tsx`, `src/app/actions/learn.ts` |
| Other UI | `tests/[testId]/page.tsx` (~499), `spaces/[spaceId]/page.tsx` (~214 post P5-B), course `page.tsx` (~302) |

## Findings

### F-W7-001: Teach/clarify hooks regressed off shared `sseClient`
- Severity: **P1**
- Category: consistency
- Location: `src/app/_components/learn/useLessonTeachStream.ts:68–125`, `src/app/_components/learn/useLessonClarifications.ts:295–350`
- Evidence: P5-D migrated LessonPhase teach + clarify onto `iterateParsedSseBlocks`. P5-A extracted hooks and reintroduced private `getReader` / `buffer.split("\n\n")` / `line.startsWith("data: ")` loops. CourseTutor and `useTestQuestionGeneration` still use `sseClient`; learn hooks do not. `rg` still finds the private loops under `src/app/_components/learn`.
- Why it hurts north star: **consistent / correct** — Wave 5 claimed one client framer; half the learn stream path silently forked again. Future SSE framing fixes will miss teach/clarify.
- Sketch:
  - Port both hooks to `iterateParsedSseBlocks` + `parseJsonData` (same majority dialect adapters as P5-D / P6-B).
  - Drop local buffer loops; keep checkpoint/clarify setState adapters.
- Effort: **S**

### F-W7-002: Product Next AI routes ignore `resolveAiProvider` / BYOK
- Severity: **P1**
- Category: consistency | bug
- Location: `src/app/api/learn/teach/route.ts:42–50,151`, `clarify/route.ts:25–33`, `tutor/route.ts:21–29`, `tests/generate/route.ts:313`, `tests/validate/route.ts:156`, `tests/feels-hard/route.ts:147`, `knowledge/title/route.ts:19–27` vs `src/app/api/generate/*/route.ts` + `src/server/ai/resolve.ts`
- Evidence: Playground/generate routes call `resolveAiProvider(convex)` (honors user OpenAI-compatible settings). Core product streams (teach, clarify, tutor, test generate/validate/feels-hard, knowledge title) construct raw `GoogleGenAI` with `GOOGLE_GEMINI_API_KEY` only. AGENTS.md documents dual *runtimes* (Next vs Convex) but product Next paths were supposed to prefer `src/server/ai`.
- Why it hurts north star: **consistent / correct** — settings UI implies BYOK; main learning and testing paths never use it. Two AI entry styles *inside* Next.
- Sketch:
  - Migrate learn + tests API routes onto `resolveAiProvider` (or a thin stream adapter over `AiProvider`).
  - Keep Convex actions on direct Gemini (documented); do not invent a third stack.
- Effort: **L** (tutor tools/embeddings make full migration large; teach/clarify/generate first is **M**)

### F-W7-003: Client-supplied `userId` still required on spaces/tests APIs
- Severity: **P1**
- Category: consistency | security
- Location: `convex/spaces.ts:6–81` (`list`, `countForUser`, `get`, `create`); `convex/tests.ts:100–106,151–156,194–200,249–254,311`
- Evidence: P0-A made `userSettings` identity-first (no client `userId`). Spaces and tests still take `userId: v.string()` and re-check `identity.subject === args.userId`. Call sites (e.g. space page `api.spaces.get` with `{ spaceId, userId }`) thread Clerk client id into every query.
- Why it hurts north star: **consistent / clear** — mixed auth models; every new function must remember the compare dance; easy to reintroduce trust bugs.
- Sketch:
  - Drop `userId` args; use `getAuthenticatedUserId` / `getAuthedContext` only.
  - Update React query call sites to pass ownership keys only.
- Effort: **M**

### F-W7-004: `default_user` ownership bypass still scattered
- Severity: **P2**
- Category: security | consistency
- Location: `convex/knowledgePieces.ts:14–17`, `knowledgeNodes.ts:46,86,122,264,300`, `tests.ts:48–61` (`getOwnedSpaceIds`), `deepDives.ts:28–31`, `questions.ts:23`, `testMessages.ts:50,111`
- Evidence: Multiple ownership gates allow `space.userId === "default_user"` (reads and some writes). Test monthly counting unions default_user spaces into the user’s quota set. CodeRabbit/P0 notes closed a default_user *write hole* on other surfaces; the exception remains a first-class ownership peer.
- Why it hurts north star: **correct / consistent** — shared/demo spaces blur tenancy; quota and node mutations may cross intended isolation.
- Sketch:
  - Decide: delete default_user path or confine to a single helper with documented product purpose.
  - Never count default_user spaces toward personal monthly limits unless intentional.
- Effort: **M**

### F-W7-005: Dead dual teach/clarify path (Convex action + server action vs live SSE)
- Severity: **P2**
- Category: brevity | clarity
- Location: `convex/courseAi.ts:595–` (`teachLesson`), `847–` (`clarifyConcept`); `src/app/actions/learn.ts:169–189,255–275`; live clients: `useLessonTeachStream.ts:55`, `useLessonClarifications.ts:277`
- Evidence: UI streams via `/api/learn/teach` and `/api/learn/clarify`. `teachLessonAction` / `clarifyConceptAction` only call Convex actions and have **no other importers**. Full non-streaming AI implementations remain public Convex actions.
- Why it hurts north star: **short / clear** — two teach implementations to keep in sync; reviewers cannot tell which is authoritative.
- Sketch:
  - Delete unused server actions + Convex `teachLesson`/`clarifyConcept` if verify confirms no callers, **or** mark internal-only if retained for scripts.
  - Document SSE routes as sole teach/clarify entry.
- Effort: **S**

### F-W7-006: Shadow AI actions left after `*Actions` node splits
- Severity: **P2**
- Category: brevity | clarity
- Location: `convex/testMessages.ts:158–` (`chat`) vs `testMessagesActions.ts:49` (used by `api/tests/chat`); `convex/knowledgeNodes.ts:167–` (`generateImprovements`) vs `knowledgeNodesActions.ts:22` (used by `useTestAnswerValidation`)
- Evidence: Live code calls `api.testMessagesActions.chat` and `api.knowledgeNodesActions.generateImprovements`. Sibling exports in non-`"use node"` modules still import `@google/genai` and duplicate logic — dead public surfaces and bundling noise.
- Why it hurts north star: **short / clear** — dual exports with identical names invite wrong `api.*` wiring.
- Sketch:
  - Remove dead `chat` / `generateImprovements` from non-node modules; keep queries/mutations + internals only.
  - Grep-guard that only `*Actions` hosts Node AI.
- Effort: **S**

### F-W7-007: `learn/tutor/route.ts` still a god file (~811 lines)
- Severity: **P2**
- Category: readability
- Location: `src/app/api/learn/tutor/route.ts` (tools, `assembleContext`, stream loop, memory extract)
- Evidence: Single route owns function declarations, embedding search, prompt render, tool execution, SSE named-event stream, and best-effort memory writeback. S8 residual; not addressed by Waves 4–6 (those split UI pages).
- Why it hurts north star: **readable / short** — hardest AI surface to change safely; any tool change risks stream/auth regressions.
- Sketch:
  - Extract `tutorTools.ts`, `assembleTutorContext.ts`, `tutorMemory.ts`; leave `POST` as orchestration + stream.
- Effort: **M**

### F-W7-008: `courseAi.ts` remains multi-phase AI god file (~1179 lines)
- Severity: **P2**
- Category: readability
- Location: `convex/courseAi.ts` (normalize, baseline, generateModule, mastery, teach, verify, clarify, summarize)
- Evidence: One file holds every educator AI action including dead teach/clarify (F-W7-005). Orchestrator only needs module/mastery paths for advance; rest is mixed in.
- Why it hurts north star: **readable** — after page splits, the backend AI blob is now the largest remaining product surface.
- Sketch:
  - Split by phase: `courseAiBaseline.ts`, `courseAiModule.ts`, `courseAiLesson.ts` (verify/summarize), drop dead teach/clarify with F-W7-005.
- Effort: **L**

### F-W7-009: LessonPhase still ~566 lines; feels-hard + complete chrome unextracted
- Severity: **P2**
- Category: readability | brevity
- Location: `src/app/spaces/.../LessonPhase.tsx` (566 lines; RECORD P6-E deferred)
- Evidence: Hooks absorbed teach/checkpoint/clarify, but phase still owns feels-hard context menu, summarize/advance, progress chrome, selection bubble JSX, checkpoint form UI, practice gate, dual complete CTAs. Still over the 400-line residual bar.
- Why it hurts north star: **readable / short** — composition file still hard to scan; deferred only, not fixed.
- Sketch:
  - Extract `useFeelsHardMenu` + presentational `LessonCompletePanel` / `LessonCheckpointForm`.
  - Target phase file &lt;350 lines of wiring only.
- Effort: **M**

### F-W7-010: Tutor named-event SSE dialect still dual-stack with majority dialect
- Severity: **P2**
- Category: consistency
- Location: `src/app/api/learn/tutor/route.ts` (`sseNamedEvent`); `src/lib/sse.ts` / `sseClient.ts` headers; `CourseTutor.tsx:138–140`
- Evidence: Documented residual after P5-D/P6-B: majority streams use `data: {"type":...}`; tutor uses `event: delta|tool_call|...`. Client adapters must branch forever until server unifies.
- Why it hurts north star: **consistent** — every new stream invents “which dialect?” again.
- Sketch:
  - Migrate tutor server to majority type-in-JSON (`type: "delta"|"tool_call"|"done"|...`) and simplify CourseTutor adapter.
- Effort: **M**

### F-W7-011: Triplicated `getAiClient` / `getModel` on learn API routes
- Severity: **P2**
- Category: consistency | brevity
- Location: `teach/route.ts:42–50`, `clarify/route.ts:25–33`, `tutor/route.ts:21–29` (same pattern in `courseAi.ts:25–37`)
- Evidence: Identical env-key helpers copy-pasted; 429 retry only on `tests/generate` `fetchGeminiStream` (S8 residual). Product routes flake unevenly under quota.
- Why it hurts north star: **short / consistent / correct** — AGENTS.md still implies shared rate-limit retries on the Next path.
- Sketch:
  - Shared `src/server/ai/geminiClient.ts` (or use provider layer from F-W7-002) with 429 backoff from generate.
- Effort: **S**

### F-W7-012: Auth failures mix `ConvexError` and bare `Error("Unauthorized")`
- Severity: **P2**
- Category: consistency
- Location: `convex/authDecorators.ts:28–32` (`ConvexError` + code) vs ~20+ handlers e.g. `courses.ts:28,87`, `courseLessons.ts:135`, `courseTutor.ts:108–210`, `spaces.ts:60`
- Evidence: Decorators throw structured `{ code: "UNAUTHORIZED" }`; most ownership checks throw plain `Error`. Clients and API routes cannot branch on codes uniformly; PLAN_LIMIT path is structured, auth often is not.
- Why it hurts north star: **consistent / clear** — error handling remains folklore.
- Sketch:
  - Small `throwUnauthorized()` / `assertOwned(space, userId)` helpers returning `ConvexError`.
  - Migrate hot mutations first (courses, lessons, tutor).
- Effort: **M**

### F-W7-013: Tutor memory retrieval does full-table cosine in the request path
- Severity: **P2**
- Category: perf
- Location: `src/app/api/learn/tutor/route.ts:386–405`
- Evidence: `getMemoriesForSpace` loads up to 50 memories; route embeds the user message then scores every embedding in JS (dot product + magnitudes) per chat turn. Works at small N; linear cost grows with memory volume and always blocks the stream start.
- Why it hurts north star: **correct / readable** (latency) — hot path does O(n) vector math inline in an 800-line route.
- Sketch:
  - Move search into Convex action with vector index (or cap + approximate); stream first token before memory extract if possible.
- Effort: **M**

### F-W7-014: `EXIGO_SERVER_MUTATION_SECRET` coerced to `""` at call sites
- Severity: **P2**
- Category: clarity | bug
- Location: `teach/route.ts:228`, `clarify/route.ts:166`, `tutor/route.ts:701,725`
- Evidence: Routes pass `process.env.EXIGO_SERVER_MUTATION_SECRET ?? ""`. Convex `assertServerMutationSecret` rejects missing/mismatch, so misconfigured deploys fail only when saving the AI turn mid-stream (after tokens already streamed), not at request start.
- Why it hurts north star: **clear / correct** — ops failures look like random “stream died after generation.”
- Sketch:
  - Fail fast in API routes if secret unset (500/503 before AI call).
  - Optionally share one `requireServerMutationSecret()` helper with tutor/lesson writers.
- Effort: **S**

### F-W7-015: `assertServerMutationSecret` duplicated in two Convex modules
- Severity: **P3**
- Category: consistency
- Location: `convex/courseLessonMessages.ts:10–18`, `convex/courseTutor.ts:13` (same function)
- Evidence: Identical secret check copy-pasted; risk of divergent error codes if one is tightened later.
- Why it hurts north star: **short / consistent**
- Sketch: Extract `convex/serverMutationSecret.ts` and import from both.
- Effort: **S**

### F-W7-016: Noisy `console.log` on knowledge piece limit path
- Severity: **P3**
- Category: brevity
- Location: `convex/knowledgePieces.ts:51–53` (and bulk path ~122)
- Evidence: Every successful limit check logs tier/current/projected to Convex logs. Not structured otlp; noisy in prod.
- Why it hurts north star: **short** — debug leftovers on hot mutation path.
- Sketch: Remove or gate behind debug flag; use structured log only on reject.
- Effort: **S**

## Patterns

1. **Wave 5 extract regressions** — hook splits can reintroduce private SSE loops (F-W7-001); verify shared libs after mechanical moves.
2. **Identity-first auth is incomplete** — userSettings done; spaces/tests still client-`userId` (F-W7-003); `default_user` still special (F-W7-004).
3. **Dual systems after “fix” docs** — Next product AI still bypasses `resolveAiProvider` (F-W7-002); tutor SSE dialect remains residual (F-W7-010); dead Convex teach vs live SSE (F-W7-005); shadow `*Actions` twins (F-W7-006).
4. **Backend god files outlived UI god files** — tutor route + `courseAi.ts` are now the large centers of gravity (F-W7-007/008).
5. **Secret/auth ergonomics** — empty-string secret, mixed Error shapes, duplicated assert (F-W7-012/014/015).

## Recommended brainstorm clusters

| Cluster | Findings | Suggested pack theme |
|---------|----------|----------------------|
| **B-W7-SSE** | F-W7-001, F-W7-010 | Re-migrate teach/clarify to sseClient; optional tutor dialect unify |
| **B-W7-AI-ENTRY** | F-W7-002, F-W7-011, F-W7-014 | Product Next routes → resolveAiProvider / shared Gemini + secret fail-fast |
| **B-W7-AUTH-TENANCY** | F-W7-003, F-W7-004, F-W7-012 | Identity-first spaces/tests; retire or quarantine default_user; ConvexError helpers |
| **B-W7-DEAD-DUAL** | F-W7-005, F-W7-006, F-W7-015, F-W7-016 | Delete shadow actions + unused teach/clarify; shared secret helper; log cleanup |
| **B-W7-GOD-SPLIT** | F-W7-007, F-W7-008, F-W7-009, F-W7-013 | Tutor route modules; courseAi phase split; LessonPhase presentation extract; memory search |

## Explicit non-issues

- **P0–P5 packs as already shipped** — auth decorators pattern, plan SSOT (`shared/planConfig`), `requireAuthedApi` on learn/tests, generation claim + TTL (P6-A), perk `syncPerksFromSsot` (P6-D ops still needed but not new code debt).
- **P6-B** — `useTestQuestionGeneration` correctly on `sseClient` (not a regression).
- **P6-C** — Dual *Convex vs Next* AI runtimes intentionally documented; residual is *within-Next* product vs playground (F-W7-002), not re-arguing Convex import boundary.
- **Prisma/tRPC Post scaffolding** — still legacy; out of residual priority vs learn/test path.
- **LessonPhase hook architecture** — concern hooks themselves are sound; issue is remaining JSX size + SSE regression, not undoing P5-A.
- **CodeRabbit 100-file PR limit** — process residual only; no code finding.
- **Hobby `maxDuration`** — atlas capped at 300; fixed.
