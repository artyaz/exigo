# B-002 — Tests & Assessment (PA2)

## Subagent meta
- cycle_id: cycle-001
- subagent_id: B-002-tests
- area: PA2
- completed_at: 2026-07-26T12:00:00.000Z

## Files reviewed
- convex/tests.ts (346 lines)
- convex/questions.ts (177 lines)
- convex/testMessages.ts (126 lines)
- convex/testMessagesActions.ts (121 lines)
- convex/testUtils.ts (102 lines)
- src/app/api/tests/chat/route.ts (103 lines)
- src/app/api/tests/feels-hard/route.ts (219 lines)
- src/app/api/tests/generate/route.ts (532 lines)
- src/app/api/tests/validate/route.ts (362 lines)
- convex/spaceAccess.ts (21 lines) — supporting context
- convex/planLimits.ts (75 lines) — supporting context
- src/lib/sse.ts (63 lines) — supporting context

## Ideas

### I-001-008: Extract triplicated plan-limit + ownership guard in tests.ts into a single helper
- Description: The three mutations `createEmptyTest` (tests.ts:94-131), `create` (tests.ts:140-175), and `createWithQuestions` (tests.ts:298-345) each repeat ~25 identical lines: call `getAuthedContext`, check `maxAllowed === 0`, fetch space, verify ownership, count monthly tests, compare to limit. Extract a single `requireTestCreationQuota(ctx, spaceId)` helper that returns `{ auth, space }` or throws, reducing the three mutations to their unique insert logic only.
- North-star improvement: Makes the creation flow readable and consistent — one canonical guard, one set of error messages.
- Riskiest assumption: That all three mutations will always share the same preconditions and no future mutation will need a divergent check.
- Warrant: Three copies of the same guard already drift (error messages differ at tests.ts:117 vs :162 vs :319); consolidation prevents further divergence and cuts ~50 lines.
- Effort: S

### I-001-009: Unify space-access checks in tests.ts queries to use canReadSpace
- Description: `questions.ts` queries consistently use `canReadSpace`/`canWriteSpace` from spaceAccess.ts, but `tests.ts` queries (`getForSpace` :218, `get` :277, `listAll` :232) do raw `space.userId !== userId` comparisons. This means shared/demo spaces (owned by `default_user`) are readable for questions but invisible for tests — an inconsistency users would notice. Replace raw checks with `canReadSpace` to honour the single-tenancy rule defined in spaceAccess.ts.
- North-star improvement: Consistency — one access-control vocabulary across the test domain.
- Riskiest assumption: That exposing demo-space tests to all users is desired product behaviour, not a security gap.
- Warrant: spaceAccess.ts was explicitly introduced to centralise this rule (comment at line 8-10); tests.ts simply predates the refactor.
- Effort: S

### I-001-010: Move testMessagesActions.ts tutor prompt into the Convex prompt registry
- Description: `testMessagesActions.ts:28-47` hardcodes the tutor system prompt inline, while `generate/route.ts:407` and `validate/route.ts:153` both fetch prompts from the Convex registry via `api.coursePrompts.getPrompt`. Migrating the tutor prompt to the registry (e.g. name `"test_tutor_chat"`) gives product teams runtime-editable copy without a deploy, and aligns with the "Prompts from Convex registry" convention.
- North-star improvement: Consistency with the AI prompt convention; clearer separation of prompt content from orchestration code.
- Riskiest assumption: That the extra Convex query latency (~10-30 ms) is acceptable in a chat round-trip that already takes 1-3 s for LLM inference.
- Warrant: Every other AI surface in the codebase already uses the registry; the tutor is the sole outlier, making prompt A/B testing and tone adjustments require code deploys.
- Effort: S

### I-001-011: Replace hardcoded GoogleGenAI in testMessagesActions.ts with resolveAiProvider
- Description: `testMessagesActions.ts:83-108` directly instantiates `GoogleGenAI` and reads `GOOGLE_GEMINI_API_KEY`, while all API routes (`generate`, `validate`, `feels-hard`) use the provider-agnostic `resolveAiProvider(convex)` abstraction. This couples the tutor chat to a single vendor and skips the provider config stored in Convex. Refactoring to use `resolveAiProvider` (or an action-compatible equivalent) restores vendor flexibility and consistent model selection.
- North-star improvement: Consistency — one AI-provider path, one model-config source.
- Riskiest assumption: That `resolveAiProvider` (designed for Next.js server runtime with ConvexHttpClient) can be adapted to a Convex action context without significant rework.
- Warrant: If the product switches or adds models (e.g. GPT-4o fallback), the tutor chat would silently keep using Gemini unless manually patched — a maintenance trap.
- Effort: M

### I-001-012: Deduplicate resolveTargetPiece and hasErrorCode helpers across API routes
- Description: `feels-hard/route.ts:35-46` (`resolveTargetPiece`) and `validate/route.ts:43-54` (`resolveTargetPieceId`) are identical logic under different names. Similarly, `chat/route.ts:39-43` (`hasErrorCode`) and `validate/route.ts:56-62` (`hasPlanLimitCode`) overlap heavily. Extract both into a shared module (e.g. `src/app/api/tests/_shared.ts` or `src/lib/`) to eliminate copy-paste drift.
- North-star improvement: Short and consistent — one definition, one name, zero divergence.
- Riskiest assumption: That a shared location won't create an unwanted coupling magnet that accumulates unrelated helpers over time.
- Warrant: Two copies is the exact threshold where drift begins; the naming inconsistency (`resolveTargetPiece` vs `resolveTargetPieceId`) already signals confusion.
- Effort: S

### I-001-013: Remove double plan-limit enforcement between generate/route.ts and tests.createEmptyTest
- Description: `generate/route.ts:287-309` checks plan limits via `api.planLimits.getPlan` + `api.tests.countForUserThisMonth`, then calls `api.tests.createEmptyTest` which internally re-runs the same limit check (tests.ts:97-119). This double enforcement wastes two Convex queries and can produce confusing UX if the two checks disagree (e.g. race between count reads). Either trust the Convex mutation as the single enforcement point (delete the API-layer check) or make the mutation trust the caller (add an internal variant without the guard).
- North-star improvement: Clear — one authoritative enforcement point eliminates ambiguity about where limits live.
- Riskiest assumption: That removing the API-layer check won't allow a race condition where concurrent requests slip past the mutation-level guard.
- Warrant: The mutation already throws a descriptive error; the API layer could simply map that error to a 403 response, halving the query cost and removing the divergence risk.
- Effort: S

### I-001-014: Evaluate whether testUtils.ts should be deleted or moved to a test-only convex directory
- Description: `testUtils.ts` exposes `internalMutation`/`internalQuery` functions (`createSpaceWithMockIdentity`, `setSubscriptionForTest`, `getSubscriptionForTest`) that exist solely for integration tests. They are bundled into production Convex deployments despite never being called by product code. If Convex supports a test-only include path, move them there; otherwise, consider deleting them and inlining the setup in `convex/tests.test.ts` / `convex/limitEnforcement.test.ts` via `testUtils` from the Convex test framework.
- North-star improvement: Short — removes dead production code and reduces the deployed function surface.
- Riskiest assumption: That existing integration tests can replicate the setup without these shared internal functions, or that Convex codegen supports exclusion.
- Warrant: Every unused exported function increases cold-start bundle size and attack surface (internal mutations are callable by any action); deletion is the cheapest win.
- Effort: S

## Patterns observed
1. **Limit enforcement drift**: Three creation mutations share logic but emit different user-facing error strings; the API layer adds a fourth variant. No single "limit error contract" exists.
2. **Auth helper inconsistency**: Mutations use `getAuthedContext`; queries mix `getAuthenticatedUserId`, raw `ctx.auth.getUserIdentity()`, and `canReadSpace`. The questions module is more consistent than the tests module.
3. **AI-provider bifurcation**: API routes use `resolveAiProvider` + prompt registry; the Convex action (`testMessagesActions.ts`) hardcodes Google + inline prompt. Two AI integration styles coexist.
4. **Ownership-check duplication in API routes**: `feels-hard` and `validate` both manually fetch test → space → verify, re-implementing what `requireTestWriteAccess` already does in Convex. The API layer doesn't trust Convex auth and re-checks.
5. **SSE usage is generate-only**: Only `generate/route.ts` streams; `chat`, `validate`, and `feels-hard` return plain JSON. The chat endpoint could benefit from streaming for perceived latency, but currently doesn't use the SSE lib at all.

## Recommended brainstorm clusters
1. **Limit enforcement consolidation** (I-001-008, I-001-013): Unify quota checks into one Convex-side helper and let API routes map thrown errors to HTTP codes.
2. **Access-control alignment** (I-001-009): Bring tests.ts in line with the spaceAccess.ts contract; audit all raw `userId !==` comparisons.
3. **AI convention enforcement** (I-001-010, I-001-011): Migrate the tutor action to prompt registry + provider abstraction, completing the "one AI path" convention.
4. **API route deduplication** (I-001-012): Extract shared helpers to eliminate copy-paste between feels-hard, validate, and chat routes.
5. **Dead-code hygiene** (I-001-014): Remove or relocate test-only internal functions from the production bundle.
