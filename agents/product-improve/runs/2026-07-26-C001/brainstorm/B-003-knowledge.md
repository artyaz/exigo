# B-003 — Knowledge Graph & Deep Dives (PA3)

## Subagent meta
- cycle_id: cycle-001
- subagent_id: B-003-knowledge
- area: PA3
- completed_at: 2026-07-26T12:00:00Z

## Files reviewed
| File | Lines | Role |
|------|-------|------|
| `convex/knowledgeNodes.ts` | 204 | CRUD mutations/queries for knowledge nodes |
| `convex/knowledgeNodesActions.ts` | 108 | Node-runtime AI action (generateImprovements) |
| `convex/knowledgePieces.ts` | 180 | CRUD for knowledge pieces (source material) |
| `convex/deepDives.ts` | 95 | Deep dive creation + monthly count |
| `src/app/api/knowledge/title/route.ts` | 174 | Next.js API route for AI title generation |
| `src/app/knowledge-nodes/page.tsx` | 173 | Marketing/explainer page for Knowledge Nodes |
| `shared/planConfig.ts` | 120 | Plan limits single source of truth |
| `convex/schema.ts` (lines 14–76) | — | Table definitions & indexes |

## Ideas

### I-001-015: Move inline prompt in knowledgeNodesActions.ts to Convex prompt registry

- **Description:** `knowledgeNodesActions.ts:43-49` embeds a raw prompt string directly in code, while every other AI call in the codebase (`courseAi.ts` has 9 calls) uses `internal.coursePrompts.getPromptInternal` to fetch prompts from the Convex `prompts` table. This makes the improvement-generation prompt impossible to iterate on without a deploy, and breaks the established convention. Migrating it to a registry entry (e.g. `"knowledge_improvement_generator"`) with a `{{content}}` variable aligns with the pattern in `src/app/api/knowledge/title/route.ts:83-91` which already fetches `"knowledge_title_generator"` from the registry.
- **North-star improvement:** Consistency — one canonical prompt-fetch pattern across all AI surfaces eliminates a class of "where is this prompt?" confusion.
- **Riskiest assumption:** The prompt is stable enough that registry overhead (one extra internal query) is acceptable in an action that already makes a network call to Gemini.
- **Warrant:** 9/10 AI call-sites already use the registry; this is the sole outlier in Convex actions, and the title route proves the pattern works for knowledge-domain prompts.
- **Effort:** S

### I-001-016: deepDives.countForUserThisMonth is dead code — remove or wire to UI

- **Description:** `deepDives.ts:75-94` exports `countForUserThisMonth` but grep shows zero consumer references in `src/`. The analogous `tests.countForUserThisMonth` is actively used in `src/app/api/tests/generate/route.ts:300`. Either the deep-dive counter was intended for a usage meter that was never built, or it is vestigial. Per Exigo conventions (delete > move > rewrite), unused exports should be removed to reduce surface area, or a small UI indicator ("X/50 deep dives used this month") should be added to the test flow.
- **North-star improvement:** Readable — removing dead code reduces the API surface a developer must mentally map when navigating the knowledge domain.
- **Riskiest assumption:** No future feature branch currently depends on this query (verifiable via git log / open PRs).
- **Warrant:** The function has no callers after 6+ months; the equivalent tests counter is wired, suggesting this was simply never completed.
- **Effort:** S

### I-001-017: Inconsistent auth patterns between knowledgePieces.ts and knowledgeNodes.ts

- **Description:** `knowledgePieces.ts:10-12` (`getForSpace`) uses raw `ctx.auth.getUserIdentity()` and returns `[]` on missing identity, while `knowledgeNodes.ts:99` (`getActiveForPiece`) uses the shared `getAuthenticatedUserId` helper and throws on unauthorized space access. Similarly, `knowledgePieces.add` (line 40) checks `space?.userId !== auth.userId` (owner-only), while `knowledgeNodes.create` (line 33) uses `canReadSpace` (member-or-owner). These divergent patterns make it unclear whether knowledge pieces are owner-only or space-member-accessible, creating a subtle authorization inconsistency.
- **North-star improvement:** Consistent — unifying on `getAuthedContext` + `canReadSpace` (or explicit owner-check helper) removes ambiguity about access semantics.
- **Riskiest assumption:** Space members (non-owners) should indeed be able to read knowledge pieces; if owner-only is intentional, the fix is to add a shared `requireOwner` helper instead.
- **Warrant:** Three different auth idioms in two sibling files increases the chance a future contributor picks the wrong pattern and introduces an access bug.
- **Effort:** M

### I-001-018: knowledgeNodes.create and createInternal duplicate validation logic

- **Description:** `knowledgeNodes.ts:15-55` (public `create`) and `knowledgeNodes.ts:123-152` (`createInternal`) share identical knowledge-piece existence and space-membership validation (lines 38-44 vs 135-141) plus the same insert payload. The only difference is the auth gate. Extracting a private `validateAndInsertNode(ctx, args)` helper eliminates the duplication and ensures future field additions (e.g. a `createdAt` or `source`) are applied in one place.
- **North-star improvement:** Short — deduplication reduces the file by ~15 lines and removes a maintenance trap.
- **Riskiest assumption:** Convex's bundler correctly tree-shakes or inlines a shared helper used by both a public mutation and an internal mutation in the same module.
- **Warrant:** The two handlers are textually identical except for the auth preamble; this is a textbook extract-method refactor with zero behavioral change.
- **Effort:** S

### I-001-019: Deep dive creation lacks idempotency — duplicate dives possible on retry

- **Description:** `deepDives.ts:67-71` inserts a new `deepDives` row unconditionally after limit checks. If the client retries (network timeout, React strict-mode double-invoke), the same `questionId` can produce multiple rows, each counting against the monthly limit. Adding a uniqueness check (`by_user` index already exists; query for existing `questionId` match before insert) or a schema-level unique index on `[userId, questionId]` would make the mutation idempotent.
- **North-star improvement:** Correct — prevents phantom limit consumption and duplicate UI entries on transient failures.
- **Riskiest assumption:** A user legitimately never needs two deep-dive notes for the same question (likely true given the 1:1 question→dive UX).
- **Warrant:** The `feels-hard` route (`src/app/api/tests/feels-hard/route.ts:202`) calls this mutation from a client action that can re-execute; no dedup guard exists.
- **Effort:** S

### I-001-020: Knowledge title route bypasses Convex plan gates

- **Description:** `src/app/api/knowledge/title/route.ts` authenticates via Clerk (`auth()`) but never checks the user's plan tier or space ownership before consuming an AI generation. Any authenticated user—even on a free plan with `maxKnowledgePiecesPerSpace: 20` already exhausted—can call this endpoint unlimited times, incurring Gemini cost without plan enforcement. Other AI routes (e.g. test generation) call `getAuthedContext` and check limits server-side.
- **North-star improvement:** Correct — closes a cost-leak vector and aligns with the "plan gates everywhere" convention.
- **Riskiest assumption:** Title generation is cheap enough that abuse is unlikely; however, uncapped AI calls violate the product's stated limit model.
- **Warrant:** The route already creates an authed Convex client (line 77), so adding a `plans.myAccessLevel` or space-ownership check is a 3-line addition.
- **Effort:** S

### I-001-021: knowledge-nodes marketing page is static — no live data or CTA to actual nodes

- **Description:** `src/app/knowledge-nodes/page.tsx` is a purely static explainer (no `useQuery` for actual nodes, no link to a space's active nodes). It queries `plans.myAccessLevel` only to show an upgrade CTA. For Pro users, the page ends abruptly with no next action. Adding a "View your active nodes" link (or embedding a live count via `api.knowledgeNodes.getActiveForSpace`) would complete the user journey and make the page serve returning users, not just prospects.
- **North-star improvement:** Clear — gives authenticated Pro users a visible next step instead of a dead-end marketing page.
- **Riskiest assumption:** Pro users actually land on this page expecting to see their data (vs. only arriving via marketing links pre-signup).
- **Warrant:** The page already imports `useQuery` and `api` but only uses them for the access check; wiring one more query is trivial and the page's own copy promises "real-time" updates.
- **Effort:** M

## Patterns observed

1. **Prompt registry adoption is high but incomplete.** 9 AI calls in `courseAi.ts` + the title route use the Convex `prompts` table; only `knowledgeNodesActions.ts` inlines its prompt.
2. **Auth idiom drift.** Three patterns coexist: raw `ctx.auth.getUserIdentity()`, `getAuthenticatedUserId()`, and `getAuthedContext()` + `requireEducatorAccess()`. Newer files trend toward `getAuthedContext`, but older knowledge files haven't been migrated.
3. **Internal/public mutation pairs.** Both `knowledgeNodes` and `knowledgePieces` expose `*Internal` variants that skip auth for action-to-mutation calls. The validation logic is copy-pasted rather than shared.
4. **Plan enforcement is thorough for writes but absent on the title API route.** All Convex mutations check limits; the Next.js route handler is the gap.
5. **No idempotency guards on insert mutations.** `deepDives.create`, `knowledgeNodes.create`, and `knowledgePieces.add` all insert unconditionally after limit checks.

## Recommended brainstorm clusters

| Cluster | Ideas | Theme |
|---------|-------|-------|
| **Prompt consistency** | I-001-015 | Align all AI prompts to registry |
| **Dead code hygiene** | I-001-016 | Remove or wire unused exports |
| **Auth unification** | I-001-017, I-001-020 | Single auth pattern + close plan-gate gap |
| **DRY internal mutations** | I-001-018 | Extract shared validation helpers |
| **Idempotency & correctness** | I-001-019 | Guard against duplicate inserts |
| **UX completeness** | I-001-021 | Turn marketing page into functional hub |
