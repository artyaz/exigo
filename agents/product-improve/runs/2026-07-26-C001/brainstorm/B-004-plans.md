# B-004 — Spaces, Plans & Subscriptions (PA4)

## Subagent meta
- cycle_id: cycle-001
- subagent_id: B-004-plans
- area: PA4
- completed_at: 2026-07-26T12:00:00Z

## Files reviewed
- convex/spaces.ts (73 lines)
- convex/plans.ts (41 lines)
- convex/planLimits.ts (75 lines)
- convex/subscriptionService.ts (157 lines)
- convex/subscriptionServiceInternal.ts (23 lines)
- convex/subscriptionsInternal.ts (127 lines)
- convex/seedPlans.ts (117 lines)
- shared/planConfig.ts (120 lines)
- shared/subscriptionStatuses.ts (10 lines)
- convex/spaceAccess.ts (21 lines)
- convex/authDecorators.ts (123 lines, supporting)
- convex/schema.ts:77-120 (subscriptions/plans tables, supporting)

## Ideas

### I-001-022: Eliminate double subscription fetch in getAuthedContext

- **Description**: `getAuthedContext` (authDecorators.ts:36-37) calls `getEffectiveAccessLevel(ctx, userId)` then `getEffectiveLimits(ctx, userId)`. The latter internally calls `getEffectiveAccessLevel` again (subscriptionService.ts:125), causing two full scans of the user's subscriptions per authenticated request. Replace with a single `getEffectiveAccessAndLimits(ctx, userId)` that resolves the subscription once and derives both values. Every mutation/query using `getAuthedContext` (spaces, tests, knowledge pieces, deep dives) benefits.
- **North-star improvement**: Readable — one call communicates intent; correct — removes a TOCTOU window where subscription state could theoretically change between the two reads.
- **Riskiest assumption**: Convex's transactional read semantics already guarantee a consistent snapshot within a single handler, so the double-fetch is wasted work rather than a correctness bug — but the TOCTOU framing may overstate risk.
- **Warrant**: `getAuthedContext` is on the hot path for every gated mutation. Halving DB reads per auth check reduces latency and makes the code self-documenting. The fix is a 10-line refactor in subscriptionService.ts plus a 2-line change in authDecorators.ts.
- **Effort**: S

### I-001-023: Unify ACCESS_LEVELS and ACCESS_LEVEL_MAP into shared/planConfig.ts

- **Description**: `subscriptionService.ts:17-21` defines `ACCESS_LEVELS = { FREE: 0, PRO_SCHOLAR: 1, EDUCATOR: 2 }` while `shared/planConfig.ts:10-14` defines `ACCESS_LEVEL_MAP = { free: 0, pro: 1, educator: 2 }`. These encode identical semantics in two locations with different key styles. Consolidate into a single canonical mapping in `shared/planConfig.ts` (the declared SSOT) and derive both the numeric constants and tier-keyed map from it. Remove the re-export chain in subscriptionService.ts.
- **North-star improvement**: Consistent — one representation of tier↔level mapping eliminates the mental translation between "PRO_SCHOLAR" and "pro" that readers must perform today.
- **Riskiest assumption**: Existing consumers (authDecorators, planLimits, deepDives) import `ACCESS_LEVELS` by name; a rename ripple is mechanical but touches ~8 files.
- **Warrant**: Dual representations are the top source of future drift. If a fourth tier is added, two files must be updated in lockstep. Consolidation enforces the SSOT contract that planConfig.ts already claims in its doc comment (line 17-18).
- **Effort**: S

### I-001-024: Inline subscriptionServiceInternal.ts into subscriptionsInternal.ts

- **Description**: `subscriptionServiceInternal.ts` (23 lines) exposes two thin `internalQuery` wrappers (`getAccessLevel`, `getLimits`) that delegate 1:1 to `subscriptionService.ts` helpers. `subscriptionsInternal.ts` (127 lines) already houses internal mutations for the same domain. Merge the two queries into `subscriptionsInternal.ts` and delete the standalone file. The only caller is `getEffectiveAccessLevelForAction` (subscriptionService.ts:134-141) which references the module by string path — update that reference.
- **North-star improvement**: Clear — one file owns all internal subscription endpoints; short — removes a 23-line file and an import indirection.
- **Riskiest assumption**: The dynamic `import("./_generated/api")` cast in subscriptionService.ts:134 relies on the module path string; renaming requires updating that cast and verifying Convex regenerates the API types.
- **Warrant**: Two files named almost identically (`subscriptionServiceInternal` vs `subscriptionsInternal`) is a recurring confusion vector for contributors. The merge reduces cognitive load without changing any runtime behavior.
- **Effort**: S

### I-001-025: Use spaceAccess.ts helpers in spaces.ts queries

- **Description**: `spaces.ts:43` performs `space.userId !== userId` for the `get` query, bypassing `canReadSpace` from `spaceAccess.ts:13`. This means shared/demo spaces owned by `DEFAULT_SPACE_OWNER` are invisible to `get` despite being readable by design. Similarly, `list` (line 13-16) only returns user-owned spaces, excluding shared spaces. Adopt `canReadSpace` in `get` and add a secondary query or union for `DEFAULT_SPACE_OWNER` spaces in `list` to honor the documented tenancy rule.
- **North-star improvement**: Correct — the code enforces a different policy than the one documented in spaceAccess.ts:6-9; consistent — access decisions live in one module.
- **Riskiest assumption**: Product may intentionally hide shared spaces from `list`/`get` to keep the UI personal-only; changing this could surface unexpected spaces in the frontend.
- **Warrant**: spaceAccess.ts exists specifically to centralize tenancy rules (its doc comment says "keep this exception in one place"). Having spaces.ts ignore it defeats the purpose and creates a latent bug if shared spaces are ever surfaced in UI.
- **Effort**: S

### I-001-026: Extract a reusable assertWithinLimit helper for plan-gated mutations

- **Description**: `spaces.ts:54-64` hand-rolls a limit check: compare count against `serverLimit`, throw a formatted error. Similar patterns exist in tests.ts and knowledgePieces.ts (each with slightly different wording). Extract a shared `assertWithinLimit(ctx, userId, metric, limit, noun)` helper in a new `convex/limitHelpers.ts` (or extend planLimits.ts) that standardizes the count-query + throw pattern, including the `UNLIMITED_LIMIT` short-circuit. All gated mutations call one function.
- **North-star improvement**: Consistent — uniform error messages and enforcement logic; short — removes 8-10 lines of boilerplate per mutation.
- **Riskiest assumption**: Each resource may need a slightly different counting strategy (e.g., tests count per month via `usage` table, spaces count via index query); a generic helper must accept a counter callback or metric name.
- **Warrant**: Three+ copies of the same guard pattern with divergent error strings makes future limit changes error-prone. A single enforcement point also enables observability (log/metric on every limit hit) without N edits.
- **Effort**: M

### I-001-027: Remove legacy schema fields (clerkPlanSlug, periodEnd) from subscriptions table

- **Description**: `schema.ts:95-96` retains `clerkPlanSlug` and `periodEnd` marked as "legacy fields from earlier billing integrations." No runtime code reads them (grep confirms zero references outside schema). They inflate every subscription document, confuse readers of the data model, and contradict the "Convex primary, do not grow Prisma" convention by carrying Clerk-era baggage. Remove them via a schema migration (Convex handles optional field removal gracefully).
- **North-star improvement**: Clear — the schema reflects only what the system actually uses; short — fewer fields to reason about.
- **Riskiest assumption**: An external analytics pipeline or one-off ops script may still read these fields from Convex exports; removal would break such consumers silently.
- **Warrant**: Dead fields are a readability tax on every developer who reads the schema. The comment explicitly labels them as tolerated for "schema-migration compatibility" — once the migration window has passed (Paddle is live), they are pure noise.
- **Effort**: S

### I-001-028: Collapse planLimits.ts re-export layer into subscriptionService.ts

- **Description**: `planLimits.ts` (75 lines) mixes three concerns: (1) re-exporting `DEEP_DIVE_LIMITS_BY_TIER` from shared/planConfig (line 16), (2) a `getSubscriptionInfo` query, and (3) a `getPlan` query that duplicates tier-derivation logic already in `subscriptionService.ts:47-49`. The `ServerPlanLimits` type alias (line 14) adds no value over `PlanLimits`. Move the two queries into `plans.ts` (which already serves plan-related queries) and delete `planLimits.ts`, letting consumers import directly from `shared/planConfig` or `subscriptionService`.
- **North-star improvement**: Clear — each file owns one concern; readable — no re-export indirection to trace; short — removes a 75-line file.
- **Riskiest assumption**: Frontend components may import from `planLimits` by path; renaming requires updating those imports (likely 3-5 files in src/).
- **Warrant**: The module boundary between `planLimits.ts`, `plans.ts`, and `subscriptionService.ts` is not obvious to new contributors. `planLimits.ts` neither defines limits (that's planConfig) nor enforces them (that's authDecorators). Dissolving it sharpens the architecture.
- **Effort**: M

## Patterns observed

1. **SSOT is well-intentioned but leaks via re-exports**: `shared/planConfig.ts` is the declared source of truth, yet `subscriptionService.ts:156` re-exports `PLAN_LIMIT_CODE, UNLIMITED_LIMIT, LIMITS_BY_TIER` and `planLimits.ts:16` re-exports deep-dive constants. Consumers can import the same value from 2-3 paths, obscuring origin.

2. **Naming collision between internal modules**: `subscriptionServiceInternal.ts` vs `subscriptionsInternal.ts` differ by one "s" and serve different roles (read queries vs write mutations). This is a consistent confusion source.

3. **Access-level mapping defined twice**: `ACCESS_LEVELS` (subscriptionService) and `ACCESS_LEVEL_MAP` (planConfig) encode the same ordinal semantics with different key conventions (SCREAMING_CASE vs lowercase).

4. **Inline enforcement without shared helper**: Each gated mutation re-implements the "fetch limit → count resources → throw" pattern, leading to inconsistent error messages and no centralized observability.

5. **spaceAccess.ts is defined but underused**: Only one consumer appears to use `canReadSpace`/`canWriteSpace`; the `spaces.ts` module bypasses it entirely.

6. **Legacy tolerance in schema**: The subscriptions table carries two dead optional fields from a prior billing provider, adding cognitive overhead without runtime value.

## Recommended brainstorm clusters

| Cluster | Ideas | Theme |
|---------|-------|-------|
| C1: SSOT consolidation | I-001-023, I-001-028, I-001-027 | Remove indirection layers so planConfig.ts is the unambiguous origin |
| C2: Subscription module simplification | I-001-024, I-001-022 | Fewer files, fewer DB round-trips for the same concern |
| C3: Enforcement uniformity | I-001-026, I-001-025 | Centralize guard logic and honor documented access rules |
