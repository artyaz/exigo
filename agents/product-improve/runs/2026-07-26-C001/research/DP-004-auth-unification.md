# Decision Package — DP-004

**TRIGGER:** Wave α findings I-001-038, I-001-009, I-001-017, I-001-025, I-001-020, I-001-041, I-001-042 — seven independent observations converging on a single structural debt: authentication and authorization patterns are inconsistent across Convex queries and Next.js API routes.

**NORTH_STAR_HURT:** Inconsistent auth creates (1) a security gap where demo/shared spaces are invisible in some modules but visible in others, confusing users and breaking the "shared learning" value proposition; (2) an unbounded AI-generation vector (no plan gate on `/api/knowledge/title`); (3) a convention vacuum so every new route/query re-rolls auth, increasing the probability of a publicly-accessible endpoint.

**LOCATION:** `convex/spaces.ts`, `convex/tests.ts`, `convex/questions.ts`, `convex/knowledgePieces.ts`, `convex/knowledgeNodes.ts`, `convex/spaceAccess.ts`, `convex/authDecorators.ts`, `src/app/api/knowledge/title/route.ts`, `src/lib/apiAuth.ts`, `src/middleware.ts`

**SYMPTOM:** Three distinct auth idioms coexist in sibling Convex files (raw getIdentity + soft-fail, getAuthenticatedUserId + throw, getAuthedContext + plan gate). API routes split between `requireAuthedApi` and inline `auth()` + manual 401. Middleware does not protect `/api/*`, relying entirely on handler discipline.

**EVIDENCE:**

| ID | File:Lines | Observation |
|----|-----------|-------------|
| I-001-038 | `spaces.ts:9-11, 23-25, 38-40` | Queries use raw `ctx.auth.getUserIdentity()` → return `[]`/`0`/`null` on missing identity. The `create` mutation (line 51) correctly uses `getAuthedContext`. |
| I-001-009 | `tests.ts:213-219, 267-278` | Queries do raw `space.userId !== userId` ownership check. `questions.ts:70,90,127,153` uses `canReadSpace(space, userId)` which includes the `default_user` demo exception. Demo spaces invisible for tests, visible for questions. |
| I-001-017 | `knowledgePieces.ts:10-12` vs `knowledgeNodes.ts:99` | Sibling files: one uses raw getIdentity + returns `[]`; the other uses `getAuthenticatedUserId` + throws. |
| I-001-025 | `spaces.ts:43` | `space.userId !== userId` bypasses `canReadSpace`. Shared/demo spaces (owner `default_user`) are unreadable via `spaces.get` despite `spaceAccess.ts` granting read by design. |
| I-001-020 | `src/app/api/knowledge/title/route.ts:52-55` | Clerk auth only; no plan-tier check. Any authenticated user can invoke unlimited AI title generations. |
| I-001-041 | `src/app/api/**` | 7 routes use `requireAuthedApi`; 9+ routes use inline `await auth()` + manual 401. No lint rule or convention doc signals which to choose. |
| I-001-042 | `src/middleware.ts:6-13` | `isProtectedRoute` covers `/spaces`, `/tests`, `/settings`, etc. but NOT `/api`. Comment (line 5) explicitly defers to handler-level auth. A forgotten `auth()` call = public endpoint. |

**QUESTION:** Should we unify all Convex query auth to `getAuthenticatedUserId` + `canReadSpace` (throw on failure), add a plan gate to AI API routes, and establish a single API auth convention enforced by middleware — or is the current soft-fail pattern load-bearing?

---

## Recommendation

**Unify on the strict-throw pattern with a thin "skip-aware" query wrapper, add plan gates to AI routes, and extend middleware to cover `/api/*`.**

### Approaches considered

| ID | Name | Pros | Cons | North-star score | Effort |
|----|------|------|------|-----------------|--------|
| A | **Strict-throw + canReadSpace everywhere** — replace all raw getIdentity soft-fails with `getAuthenticatedUserId` (throws UNAUTHORIZED) and route tenancy through `canReadSpace`/`canWriteSpace`. Add `requireMinAccessLevel` to AI routes. Extend middleware matcher to protect `/api/*`. | Single idiom; demo spaces work everywhere; no silent data leaks; new-route safety net via middleware. | Requires verifying no client relies on soft-fail (verified: clients use `"skip"` guard). Slight latency add from plan lookup on read queries if using full `getAuthedContext`. | 9/10 | M (2–3 days) |
| B | **Soft-fail preservation + lint rule** — keep returning `[]`/`null` for unauthenticated queries but add ESLint rule forbidding raw `getIdentity()` and require `canReadSpace` in ownership checks. | Zero runtime behavior change; lower risk. | Doesn't fix the security gap (middleware still open); doesn't add plan gates; lint-only enforcement is weak for a growing team. | 5/10 | S (0.5 day) |
| C | **Middleware-first + gradual migration** — protect `/api/*` in middleware immediately; migrate Convex queries file-by-file over multiple PRs. | Immediate security win; spreads effort. | Prolonged inconsistency window; easy to stall migration; two patterns coexist longer. | 7/10 | L (1–2 weeks) |

**Selected: Approach A** (with the middleware change from C pulled forward as step 1).

### Minimal implementation sketch

**Files:**
- `convex/spaces.ts` — queries
- `convex/tests.ts` — queries `getForSpace`, `get`
- `convex/knowledgePieces.ts` — query `getForSpace`
- `convex/questions.ts` — queries (already mostly correct; align identity call)
- `src/app/api/knowledge/title/route.ts` — add plan gate
- `src/middleware.ts` — extend `isProtectedRoute` to include `/api/(.*)`
- `convex/authDecorators.ts` — (optional) add lightweight `getAuthedUserIdForQuery` that throws but skips plan lookup for read-only queries

**Steps:**

1. **Middleware safety net (5 min).** Add `'/api/(.*)'` to `isProtectedRoute` in `src/middleware.ts`. This ensures any new API route is Clerk-protected by default even if the handler forgets `auth()`. Existing routes already call `auth()` so behavior is unchanged (double-check is a no-op).

2. **Convex query auth unification (core).** In `spaces.ts`, `tests.ts`, `knowledgePieces.ts`:
   - Replace `const identity = await ctx.auth.getUserIdentity(); const userId = identity?.subject; if (!userId) return [];` with `const userId = await getAuthenticatedUserId(ctx);`
   - Replace `space.userId !== userId` ownership checks with `!canReadSpace(space, userId)` (reads) or `!canWriteSpace(space, userId)` (writes).
   - On unauthorized space access in queries, return `[]`/`null` (not throw) to preserve graceful UX for edge cases like deleted spaces — but the *identity* check throws.

3. **Plan gate on AI routes.** In `src/app/api/knowledge/title/route.ts` (and audit `src/app/api/generate/*`):
   - After Clerk auth, call the authed Convex client to check plan tier (e.g., query a lightweight `plans.getAccessLevel` or reuse `getEffectiveAccessLevel`).
   - Return 403 with plan-upgrade message if below required tier.

4. **API convention codification.** Add a one-liner to `AGENTS.md` or inline comment in `apiAuth.ts`:
   > All `/api/*` routes MUST use `requireAuthedApi` (or `requireApiSession` + `requireAuthedConvex` for non-Convex routes). Inline `auth()` is deprecated.

5. **Migrate inline-auth routes.** Convert the 9 routes using `await auth()` to use `requireAuthedApi` / `requireApiSession` for consistency. Mechanical refactor; no behavior change.

**What NOT to do:**
- Do NOT switch read queries to full `getAuthedContext` (which fetches plan + limits) — this adds a DB round-trip per query for data that read-only queries don't need. Use `getAuthenticatedUserId` (identity-only, throws) for reads.
- Do NOT throw on space-authorization failures in *queries* — return empty/null to avoid crashing the UI if a space is deleted mid-session. Reserve throws for mutations.
- Do NOT remove the `"skip"` guard pattern on the client (`userId ? {} : "skip"`). It prevents the query from firing pre-auth and is the correct complement to server-side throws.
- Do NOT add `/api` to middleware `isProtectedRoute` without verifying that webhook endpoints (e.g., Paddle/Stripe callbacks) are excluded — they use HMAC verification, not Clerk sessions.

### Skills applied

- **Convention extraction:** Identified the intended canonical pattern from `authDecorators.ts` exports and `questions.ts` (the most consistent consumer).
- **Blast-radius analysis:** Grepped all client usages of `spaces.list`, `spaces.get`, `spaces.countForUser` to confirm no code relies on the soft-fail `[]`/`null` return for unauthenticated users. Both `src/app/spaces/page.tsx:19` and `src/app/spaces/[spaceId]/page.tsx:26` use `userId ? {} : "skip"`, meaning the query never fires without auth.
- **Security layering:** Verified middleware matcher includes `/(api|trpc)(.*)` in the *matcher* (so Clerk runs) but does NOT call `protect()` for API routes — confirming the gap.

### Research notes

- `spaceAccess.ts` was introduced specifically to centralize the demo-space exception (comment references F-W7-004 / P10-A). Its existence proves the team *intended* a single tenancy gate but adoption is incomplete.
- `questions.ts` is the gold-standard sibling: it imports both `canReadSpace` and `canWriteSpace`, uses soft-fail for reads (returns `[]`/`null` on unauthorized space), and hard-fail for writes (`throwUnauthorized`). This is the pattern to replicate.
- The `tests.ts` file already imports `getAuthenticatedUserId` and uses it in `listAll` (line 232), proving the migration path is trivial for that file.
- API route split: routes under `/api/tests/*` and `/api/learn/*` consistently use `requireAuthedApi`; routes under `/api/generate/*` and `/api/knowledge/*` use inline `auth()`. The split correlates with authorship vintage, not technical requirement.

### Residual risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Webhook routes (`/api/checkout`, Paddle callbacks) broken by middleware `protect()` | Medium | Exclude via negative lookahead in `isProtectedRoute` or keep them outside the matcher. Verify HMAC-authed routes before deploying. |
| Convex `"skip"` guard removed by future dev, causing UNAUTHORIZED errors on pre-auth render | Low | Add a comment in `spaces/page.tsx` explaining why `"skip"` is required; optionally add a unit test. |
| Plan-gate on `/api/knowledge/title` blocks free-tier users who currently expect title generation | Medium | Product decision: either gate behind Pro or add a generous rate-limit for free tier. Ship behind a feature flag. |
| Performance: `getAuthenticatedUserId` throws `ConvexError` which triggers client error boundary instead of graceful empty state | Low | Clients already guard with `"skip"`; the throw only fires if a token expires mid-session, which should surface as a re-auth prompt anyway. |

### Suggested finding severity

| Finding | Severity | Rationale |
|---------|----------|-----------|
| I-001-038 | Medium | Silent empty returns mask auth failures; no security hole (clients skip), but hinders debugging and consistency. |
| I-001-009 | **High** | Demo spaces invisible in tests but visible in questions — user-facing inconsistency that breaks the shared-learning feature. |
| I-001-017 | Medium | Three idioms in sibling files increases cognitive load and onboarding friction. |
| I-001-025 | **High** | `spaces.get` bypasses `canReadSpace` — demo/shared spaces return `null`, breaking any UI that fetches a shared space by ID. |
| I-001-020 | **High** | Unbounded AI generation for any authed user = direct cost exposure and plan-tier bypass. |
| I-001-041 | Medium | Convention drift; increases probability of future auth-less routes. |
| I-001-042 | **High** | Middleware gap means a single forgotten `auth()` call creates a publicly-accessible endpoint. Defense-in-depth failure. |
