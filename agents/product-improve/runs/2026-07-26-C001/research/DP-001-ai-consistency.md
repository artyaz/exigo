# Decision Package — DP-001

**TRIGGER:** AI integration patterns have drifted: Convex actions repeat a 10-line call sequence 9 times (~180 LOC boilerplate), two Convex actions embed raw inline prompts bypassing the prompt registry, and the tutor route (Next path) bypasses `resolveAiProvider` — breaking BYOK for the highest-traffic AI surface.

**NORTH_STAR_HURT:** consistent (three divergent AI-call styles within the same codebase), shorter (180 lines of copy-paste boilerplate; 230-line god-function), clear (new contributors cannot tell which pattern is canonical; AGENTS.md says "prefer resolveAiProvider" but tutor ignores it).

**LOCATION:**
- `convex/courseAi.ts` — 8 exported actions, 9 AI call sites, all copy-paste
- `convex/testMessagesActions.ts` — inline prompt + direct `GoogleGenAI`
- `convex/knowledgeNodesActions.ts:43-49` — inline prompt + direct `GoogleGenAI`
- `src/app/api/learn/tutor/route.ts:84,133` — `getEnvGeminiClient()` / `getEnvGeminiModel()`
- `src/server/ai/geminiEnv.ts` — 19-line transitional shim, sole consumer = tutor

**SYMPTOM:** The codebase has an intentional two-path AI architecture (Next routes → `resolveAiProvider`; Convex actions → direct `@google/genai`). Both paths share a convention: prompts live in the Convex `prompts` table, fetched via `getPrompt`/`renderPrompt`. In practice, path 2 (Convex) honours the prompt registry in 7/9 call sites but hardcodes prompts in 2; and repeats an identical 10-line getAiClient→model→getPrompt→renderPrompt→generateContent→capture→parse sequence 9 times. Path 1 (Next) is consistent across all routes except tutor, which bypasses `resolveAiProvider` because the `AiProvider` interface lacks tool-calling support — leaving BYOK silently broken for tutor users.

**EVIDENCE:**

| Finding | Verified location | Detail |
|---------|------------------|--------|
| I-001-001 | `courseAi.ts:109-132, 168-197, 233-277, 295-325, 427-479, 551-581, 620-655, 779-810, 887-900` | 9 occurrences of: `getAiClient()` → `getModel()`/`getModelPro()` → `ctx.runQuery(getPromptInternal)` → `renderPrompt()` → `ai.models.generateContent()` → `captureAiGenerationEvent()` → `safeParseJson()`. Each block is 19-22 lines. Total ≈ 180 LOC of structural boilerplate. |
| I-001-002 | `courseAi.ts:92-157` vs `160-204` | `normalizeTopic` and `normalizeTopicOnly` share identical AI sequence (same prompt `course_architect`, same model, same parse shape). Differ only in: space-ownership check + `createInternal` mutation (14 lines). |
| I-001-006 | `courseAi.ts:709-937` | `summarizeLesson` is 229 lines performing 5 jobs: (1) data assembly, (2) AI summary, (3) post-processing, (4) knowledge-piece integration, (5) second AI call for knowledge nodes. Natural seam at line 829: `// ─── Exigo Integration ───`. |
| I-001-010 | `testMessagesActions.ts:28-47` | `buildTutorPrompt()` hardcodes a 19-line system prompt inline. Every other AI surface (8 in courseAi, tutor route, teach, clarify) fetches from the `prompts` table. |
| I-001-011 | `testMessagesActions.ts:85-87` | `new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY })` — direct instantiation. Acceptable for Convex path, but combined with inline prompt means this action follows neither convention fully. |
| I-001-015 | `knowledgeNodesActions.ts:43-49` | 7-line raw prompt string embedded in code. 9/10 other AI calls use the registry. Also direct `new GoogleGenAI` (line 58-60) — acceptable for Convex, but prompt should be in registry. |
| I-001-029 | `tutor/route.ts:84,133` | `getEnvGeminiClient()` + `getEnvGeminiModel()` — bypasses `resolveAiProvider`. All other Next routes (teach:151, clarify:130, validate:152, generate:311, feels-hard:146, knowledge/title:17) use `resolveAiProvider(convex)`. BYOK users silently get wrong provider on tutor. |
| I-001-035 | `src/server/ai/geminiEnv.ts:1-19` | 19-line shim. Doc comment (line 6-8): "Prefer resolveAiProvider when BYOK/settings apply; use these only for the default-env path until F-W7-002 lands fully." Sole consumer: tutor route (3 import references). |

**QUESTION:** How do we unify AI integration patterns — eliminating boilerplate and prompt-registry drift in Convex actions, and restoring `resolveAiProvider` on the tutor route — without collapsing the intentional two-path architecture?

---

## Recommendation

- **Approach name:** A — Convex `callModel` helper + prompt-registry migration + tutor `resolveAiProvider` adoption
- **One-paragraph rationale:** The two-path architecture is correct and should remain. The problem is *internal drift within each path*, not the existence of two paths. On the Convex side, a single `callModel<T>(ctx, { promptName, variables, model?, userId })` helper collapses the 9 repeated sequences into one-liners, enforces prompt-registry usage by construction, and preserves direct `@google/genai` (as AGENTS.md mandates). On the Next side, extending `AiGenerateRequest` with optional `tools`/`toolConfig` lets the tutor route consume `resolveAiProvider` — restoring BYOK — after which `geminiEnv.ts` has zero consumers and is deleted. The two inline prompts (testMessages, knowledgeNodes) migrate to the `prompts` table via seed entries. Net effect: ~180 LOC deleted, 2 inline prompts eliminated, BYOK fixed, zero architectural change.
- **Why not alternatives:** B (unify onto `resolveAiProvider` everywhere) violates the Convex/Next runtime boundary — Convex cannot import `src/server`. C (prompt-registry-only fix) leaves 180 lines of boilerplate and the tutor BYOK gap untouched.

### Approaches considered

| ID | Name | Pros | Cons | North-star score | Effort |
|----|------|------|------|------------------|--------|
| A | **Convex `callModel` helper + registry migration + tutor BYOK fix** | Eliminates ~180 LOC boilerplate; enforces registry by construction; fixes BYOK; deletes geminiEnv.ts; respects two-path architecture; each step independently shippable | Requires seeding 2 new prompts; AiProvider interface extension for tools (small) | 0.94 | M (~200 LOC new helper + interface extension; net −150 LOC) |
| B | **Full unification onto `resolveAiProvider`** | Single AI stack; one mental model | Convex cannot import `src/server` (runtime boundary); would require re-architecting Convex actions to call Next endpoints; destroys the intentional separation AGENTS.md documents | 0.30 | XL |
| C | **Prompt-registry-only migration** (move 2 inline prompts to DB, no boilerplate reduction) | Smallest diff; no interface changes | Leaves 180 LOC copy-paste; tutor BYOK still broken; geminiEnv.ts still alive; doesn't address the primary consistency complaint | 0.52 | S |

### Minimal implementation sketch

- Files:

| File | Change |
|------|--------|
| `convex/aiCallHelper.ts` (NEW, ~60 LOC) | `callModel<T>(ctx, opts: { promptName, variables, model?, userId, parse? })` — fetches prompt via `getPromptInternal`, renders, calls `generateContent`, captures PostHog event, returns parsed JSON or raw text. Also exports `callModelRaw` for non-JSON responses. |
| `convex/courseAi.ts` | Replace 9 inline AI sequences with `callModel`/`callModelRaw` calls. Split `summarizeLesson` at the `// ─── Exigo Integration ───` seam into a private `integrateLessonSummary` helper (same file, not a new action). Merge `normalizeTopicOnly` logic into `normalizeTopic` via an optional `skipCourseCreation` flag (or keep both as thin wrappers over a shared `runCourseArchitect` private function). |
| `convex/testMessagesActions.ts` | Replace `buildTutorPrompt()` inline string with `callModelRaw(ctx, { promptName: "test_tutor_chat", ... })`. Seed new prompt. |
| `convex/knowledgeNodesActions.ts` | Replace inline prompt (lines 43-49) with `callModelRaw(ctx, { promptName: "knowledge_improvement", ... })`. Seed new prompt. |
| `convex/seedPrompts.ts` | Add seed entries: `test_tutor_chat`, `knowledge_improvement`. |
| `src/server/ai/types.ts` | Add optional `tools?: unknown[]` and `toolConfig?: unknown` to `AiGenerateRequest`. |
| `src/server/ai/gemini.ts` | Pass `tools`/`toolConfig` through to `generateContent` config when present. |
| `src/app/api/learn/tutor/route.ts` | Replace `getEnvGeminiClient()`/`getEnvGeminiModel()` with `resolveAiProvider(convex)`. Use `provider.generate()` for the initial tool-calling request and `provider.stream()` for follow-up. Embedding call remains direct `@google/genai` (AiProvider doesn't do embeddings — acceptable, single call site). |
| `src/server/ai/geminiEnv.ts` | DELETE (zero consumers after tutor migration). |
| `src/server/ai/index.ts` | Remove `getEnvGeminiClient`/`getEnvGeminiModel` re-export. |

- Steps:
  1. Create `convex/aiCallHelper.ts` with `callModel<T>` and `callModelRaw`. Unit-test with mocked ctx.
  2. Refactor `courseAi.ts`: replace 9 AI sequences with helper calls. Verify `npm run check` + existing tests pass.
  3. Split `summarizeLesson` at the Exigo Integration seam (extract private function, same file).
  4. Seed `test_tutor_chat` and `knowledge_improvement` prompts; migrate `testMessagesActions.ts` and `knowledgeNodesActions.ts` to use `callModelRaw` + registry.
  5. Extend `AiGenerateRequest` with `tools`/`toolConfig`; update `GeminiProvider.generate()` to forward them.
  6. Migrate tutor route to `resolveAiProvider`; delete `geminiEnv.ts`; remove re-export from `index.ts`.
  7. Run `npm run check` + `npm run test` + manual tutor smoke test (tool-calling flow).

- What NOT to do:
  - Do NOT make Convex actions import from `src/server/` — the runtime boundary is real and intentional.
  - Do NOT change the SSE dialect or PostHog event shape — only the call-site plumbing.
  - Do NOT add BYOK to Convex actions — they are backend-only, server-key path (AGENTS.md line 46).
  - Do NOT extract `summarizeLesson`'s integration half into a separate Convex action — it's only called from one place; a private function is sufficient.
  - Do NOT attempt to route tutor embeddings through `AiProvider` — embeddings are a different capability; one direct call is acceptable.
  - Do NOT rename or restructure the `prompts` table schema.

### Skills applied

- **Convention enforcement:** AGENTS.md lines 41-55 define the two-path architecture and shared conventions; this package enforces them rather than inventing a third style.
- **DRY / single-source-of-truth:** One `callModel` helper replaces 9 copy-paste sequences; one prompt registry replaces 2 inline strings.
- **Delete > simplify > rewrite:** `geminiEnv.ts` deleted; `normalizeTopicOnly` collapsed; inline prompts eliminated.
- **YAGNI:** `tools`/`toolConfig` on `AiGenerateRequest` is the minimal interface extension — no generic "function-calling abstraction" layer.

### Research notes

- The `callModel` pattern already exists implicitly: every action in `courseAi.ts` follows the same 7-step sequence. The helper merely extracts what's proven.
- `renderPrompt` (coursePrompts.ts:65-76) already sanitizes user input with `<user_input>` delimiters and truncation — the helper inherits this protection.
- `resolveAiProvider` (resolve.ts:42-74) gracefully falls back to `defaultGeminiProvider()` on any settings error — tutor migration is low-risk.
- The tutor's embedding call (`generateEmbedding` in tutorTools.ts) uses the raw `GoogleGenAI` client for `embedContent`. This is a single call site with no BYOK equivalent in `AiProvider`; leave it as a documented exception (pass the resolved Gemini client for embeddings only when provider is Gemini).
- `testMessagesActions.ts` uses model `"gemini-2.0-flash"` (line 90) while the rest of the codebase defaults to `"gemini-3-flash-preview"` — the helper normalizes this to `getModel()` (env-driven).
- `knowledgeNodesActions.ts` also uses `"gemini-2.0-flash"` (line 61) — same normalization applies.

### Residual risks

| Risk | Mitigation |
|------|-----------|
| Tutor tool-calling via `AiProvider.generate()` may not surface `functionCalls` in `AiResult.raw` cleanly | `AiResult.raw` already carries the untouched vendor object; tutor extracts `functionCalls` from `.raw`. Verify in step 6 smoke test. |
| Seeding new prompts requires a deploy + seed run before the code ships | Seed prompts in the same PR; `seedPrompts.ts` is idempotent. Feature-flag the new code paths behind prompt existence (fallback to inline if prompt missing during rollout). |
| `callModel` helper adds one layer of indirection to Convex actions | Offset by eliminating 180 LOC; stack traces still show the action handler as caller. |
| Embedding call in tutor still uses direct `@google/genai` | Acceptable: single call site, no BYOK equivalent, documented as exception in AGENTS.md. |
| Model normalization (`gemini-2.0-flash` → env default) may change output quality for testMessages/knowledgeNodes | Both are short-form generation (chat reply, 25-word improvement); flash-preview is strictly newer. Low risk; monitor PostHog latency/quality. |

### Suggested finding severity / title

| Finding | Severity | Title |
|---------|----------|-------|
| I-001-001 | **Medium** | courseAi.ts: 9× copy-paste AI-call boilerplate (~180 LOC) |
| I-001-002 | **Low** | normalizeTopic / normalizeTopicOnly near-duplicate (95% shared) |
| I-001-006 | **Low** | summarizeLesson 230-line god-function with natural seam |
| I-001-010 | **Medium** | testMessagesActions.ts hardcodes tutor prompt; bypasses registry |
| I-001-011 | **Low** | testMessagesActions.ts direct GoogleGenAI (acceptable for Convex, but non-idiomatic) |
| I-001-015 | **Medium** | knowledgeNodesActions.ts embeds raw prompt; 9/10 calls use registry |
| I-001-029 | **High** | Tutor route bypasses resolveAiProvider — BYOK silently broken |
| I-001-035 | **Low** | geminiEnv.ts transitional shim with one consumer; delete after tutor fix |
