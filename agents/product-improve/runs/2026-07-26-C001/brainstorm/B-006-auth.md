# B-006 — Auth & Access Control (PA6)

## Subagent meta
- cycle_id: cycle-001
- subagent_id: B-006-auth
- area: PA6
- completed_at: 2026-07-26T12:00:00Z

## Files reviewed
| File | Lines | Role |
|------|-------|------|
| `convex/auth.ts` | 14 | Legacy user-ID extraction (dead code) |
| `convex/authDecorators.ts` | 123 | Canonical auth gate + plan gates |
| `convex/auth.config.ts` | 15 | Clerk JWT issuer config |
| `convex/spaceAccess.ts` | 21 | Space read/write tenancy helpers |
| `convex/serverMutationSecret.ts` | 16 | Convex-side secret assertion |
| `src/middleware.ts` | 27 | Clerk route protection |
| `src/lib/apiAuth.ts` | 94 | Next API auth gate + Convex client factory |
| `src/lib/convexClientAuth.ts` | 173 | Authed ConvexHttpClient with proxy logging |
| `src/lib/clerk-shared.ts` | 30 | Clerk UI theming constants |
| `src/lib/serverMutationSecret.ts` | 15 | Next-side secret presence check |

## Ideas

### I-001-036: Delete dead `convex/auth.ts` module

- **Description**: `convex/auth.ts` exports `getAuthenticatedUserId` and `getAuthenticatedUserIdForAction`, but zero files import from `"./auth"`. All consumers import the identically-named `getAuthenticatedUserId` from `./authDecorators` (line 96–107), which adds a proper throw-on-unauthorized guarantee. The `ForAction` variant is also unused — `getAuthedContextForAction` in authDecorators covers actions. This file is pure dead weight that confuses newcomers about which auth entry point is canonical.
- **North-star improvement**: Readable — removes a misleading duplicate so the single auth path is obvious.
- **Riskiest assumption**: No dynamic import or code-generation step references `convex/auth.ts` at build time.
- **Warrant**: Grep confirms zero imports of `"./auth"` across the entire convex/ directory; the file's functions are strict subsets of authDecorators equivalents.
- **Effort**: S

### I-001-037: Remove unused `withAuth` / `withAuthAction` wrappers

- **Description**: `authDecorators.ts:60–74` defines `withAuth` and `withAuthAction` higher-order wrappers, but no Convex function in the codebase calls them. Every handler instead calls `getAuthedContext(ctx)` or `getAuthenticatedUserId(ctx)` directly. These wrappers add surface area and imply a callback style that the codebase never adopted. Deleting them shrinks the decorator module to the patterns actually in use.
- **North-star improvement**: Short — removes 15 lines of unused abstraction, keeping the module lean.
- **Riskiest assumption**: No planned feature branch or external template relies on these wrappers.
- **Warrant**: Grep for `withAuth(` and `withAuthAction(` returns zero call sites across all convex modules.
- **Effort**: S

### I-001-038: Standardize `spaces.ts` queries to use `getAuthedContext`

- **Description**: `convex/spaces.ts` queries (`list`, `countForUser`, `get`) manually call `ctx.auth.getUserIdentity()` and silently return empty/null on missing auth (lines 9–11, 23–25, 38–40). Every other module uses `getAuthedContext` or `getAuthenticatedUserId` which throw `UNAUTHORIZED`. This inconsistency means unauthenticated callers get silent empty results from spaces but hard errors elsewhere — confusing client error handling and masking token-expiry bugs.
- **North-star improvement**: Consistent — one auth behavior (throw on unauthenticated) across all Convex functions.
- **Riskiest assumption**: No client intentionally relies on the soft-fail (return `[]`) behavior for anonymous/pre-auth prefetch.
- **Warrant**: The middleware already protects `/spaces(.*)` routes, so authenticated context is guaranteed at the page level; the soft-fail is a redundant legacy path.
- **Effort**: S

### I-001-039: Consolidate server-mutation-secret naming and docs

- **Description**: The secret gate spans two files with different semantics: `convex/serverMutationSecret.ts` asserts a passed secret matches env; `src/lib/serverMutationSecret.ts` reads env and throws if absent. Both are correct but the identical filename across directories obscures their complementary roles. A one-line cross-reference comment in each file (e.g., "Counterpart: src/lib/serverMutationSecret.ts") and a shared naming convention (`assert` vs `require` prefix is good, but the file names don't hint at directionality) would make the two-hop flow discoverable without grep.
- **North-star improvement**: Clear — a reader finds the full secret flow in two hops instead of searching by content.
- **Riskiest assumption**: Developers actually read cross-reference comments rather than relying solely on IDE navigation.
- **Warrant**: The cd-review audit (F-W7-015) already flagged this duplication; the fix consolidated logic but not discoverability.
- **Effort**: S

### I-001-040: Remove unused `requireProAccess` or wire it to Pro-gated features

- **Description**: `authDecorators.ts:88` exports `requireProAccess`, but no Convex function calls it — all plan-gated features use `requireEducatorAccess`. Either Pro gating is not yet shipped (dead code) or Pro features exist but lack enforcement. If the former, delete to reduce surface; if the latter, audit which features should gate at PRO_SCHOLAR level (e.g., deep dives, AI generation quotas) and wire the check.
- **North-star improvement**: Correct — ensures declared access tiers are actually enforced or removes misleading capability.
- **Riskiest assumption**: Product intentionally gates only at Educator tier and Pro tier has no exclusive features yet.
- **Warrant**: Grep shows `requireProAccess(` has exactly one hit: its own definition. Meanwhile `requireEducatorAccess` has 20+ call sites.
- **Effort**: S

### I-001-041: Add route-level auth comment or lint rule for API routes

- **Description**: API routes use two distinct auth styles: (a) `requireAuthedApi` from `apiAuth.ts` (e.g., tests/chat, tests/generate), and (b) inline `auth()` + manual 401 (e.g., generate/embed:11–12, generate/open:12–13). Both are valid, but there's no convention signal telling a new route author which to pick. A brief comment in `apiAuth.ts` ("Use requireAuthedApi for routes that need a Convex client; inline auth() for public/webhook routes") or an ESLint rule flagging `auth()` calls outside webhook handlers would enforce consistency.
- **North-star improvement**: Clear — removes ambiguity about the canonical API auth pattern for new routes.
- **Riskiest assumption**: The team prefers a lint rule over documentation for enforcing this pattern.
- **Warrant**: 18 API routes exist; 3 use inline auth where `requireAuthedApi` would be a drop-in replacement (generate/embed, generate/open, generate/exercise).
- **Effort**: M

### I-001-042: Document middleware coverage gap for `/api` routes

- **Description**: `src/middleware.ts:5` comments that API routes "do not call protect()" and rely on handler-level `auth()`. This is intentional but fragile: if a new API route forgets the handler-level check, it's publicly accessible since middleware won't catch it. Adding a short table in the middleware comment listing which route prefixes are intentionally public (webhooks/paddle, plans/prices, trpc health) vs. must-auth would make the coverage auditable at a glance.
- **North-star improvement**: Clear — makes the security boundary explicit rather than relying on each handler author remembering.
- **Riskiest assumption**: The list of intentionally-public routes stays small enough to maintain in a comment.
- **Warrant**: Currently only `webhooks/paddle` and `plans/prices` are truly public; the rest should auth. A comment makes this contract visible.
- **Effort**: S

## Patterns observed

1. **Single canonical gate**: `getAuthedContext` / `getAuthedContextForAction` in `authDecorators.ts` is the de-facto standard. All modules except `spaces.ts` queries use it.
2. **Two-hop server secret**: Next.js `requireServerMutationSecret()` → passes secret as arg → Convex `assertServerMutationSecret()`. Clean separation of concerns across runtime boundaries.
3. **Space tenancy via helpers**: `canReadSpace` / `canWriteSpace` in `spaceAccess.ts` used consistently across 6 modules (24 call sites). The `DEFAULT_SPACE_OWNER` sentinel is well-documented.
4. **Proxy-based observability**: `convexClientAuth.ts` wraps the Convex client in a Proxy for structured logging + PostHog exception capture — no auth logic leaks into callers.
5. **No keyless/dev-mode remnants**: Zero hits for keyless, devMode, or dev_mode patterns. Clean.
6. **Dead code cluster**: `convex/auth.ts` (entire file), `withAuth`/`withAuthAction` wrappers, and `requireProAccess` are all unused — likely artifacts of an earlier design iteration.

## Recommended brainstorm clusters

| Cluster | Ideas | Theme |
|---------|-------|-------|
| **Dead-code purge** | I-001-036, I-001-037, I-001-040 | Remove unused auth surface to sharpen discoverability |
| **Consistency enforcement** | I-001-038, I-001-041 | Unify auth behavior across Convex queries and API routes |
| **Security documentation** | I-001-039, I-001-042 | Make the auth boundary and secret flow self-documenting |
