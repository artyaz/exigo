# Fix pack P3-A — Plan limits SSOT

**Findings:** S1-B003 (P1 — plan limits SSOT broken: strategy hardcode vs seed/pricing vs AGENTS)  
**Brain:** Approach A — single `LIMITS_BY_TIER` table in `shared/planConfig.ts`; strategies become thin lookups; free marketing aligned to code truth (3 tests/month)

## What changed

### SSOT table (`shared/planConfig.ts`)

| Export | Role |
|--------|------|
| `PlanLimits` | Shared shape: spaces / tests / knowledge pieces / deep dives |
| `LIMITS_BY_TIER` | Numeric entitlements for `free` / `pro` / `educator` |
| `getLimitsForTier` | Lookup helper |
| `DEEP_DIVE_LIMITS_BY_TIER` | Derived from `LIMITS_BY_TIER` (no second source) |
| `getDeepDiveLimitForTier` | Reads deep-dive field from `LIMITS_BY_TIER` |
| `getMarketingPerksForTier` | Seed + pricing perk strings derived from the same numbers |

Free tier kept at **3 tests / month** (code truth). Educator tests set to **300** directly (dropped useless `Math.min(300, MAX_TESTS_SENTINEL)`).

### Thin service (`convex/subscriptionService.ts`)

- Deleted `LimitStrategy` + `FreeLimitStrategy` / `ProScholarLimitStrategy` / `EducatorLimitStrategy` + `getStrategy`.
- `getLimitsForAccessLevel` maps access level → tier → `getLimitsForTier` (shared table).
- Kept `ACCESS_LEVELS`, subscription resolution, action helpers, `PlanLimits` re-export.

### Marketing / seed (free “10” → “3”)

| File | Change |
|------|--------|
| `convex/seedPlans.ts` | All plan `perks` from `getMarketingPerksForTier` |
| `src/app/pricing/page.tsx` | Free card fallback perks from same helper (was hardcoded `"10 AI tests / month"`) |

### Tests

| File | Change |
|------|--------|
| `convex/planLimits.test.ts` | Assert access-level limits equal `LIMITS_BY_TIER`; marketing drift suite (free ≠ 10; each tier’s perk strings include SSOT numbers) |
| `convex/limitEnforcement.test.ts` | Assert equality to `LIMITS_BY_TIER`; educator expects 300 |

## Product decision

- **Keep free maxTestsPerMonth = 3** in code.
- Fix seed + pricing copy that advertised **10**.

## Residual

1. **Already-seeded DBs** — `seedPlans.seed` refuses re-seed if `plans` rows exist. Environments that were seeded with free “10 AI tests / month” still have stale perk text in Convex until plans are deleted/reseeded or patched. Runtime enforcement was already 3 and is unchanged in magnitude.
2. **AGENTS.md** still describes the old Strategy classes — docs drift; not in pack ownership.
3. **`MAX_TESTS_SENTINEL` (1000)** remains as a hard-cap constant; no tier currently uses it as its monthly test limit (educator is 300).
4. Deep-dive **behavior** unchanged — only the deep-dive numbers now live inside the unified table.

## Risks

| Risk | Notes |
|------|--------|
| Copy drop free 10→3 | Intentional product alignment; users who believed marketing may see a lower advertised free quota |
| Stale DB perks | Pricing free card uses shared helper when DB free row is skipped; paid cards still read DB `perks` — reseed/patch paid rows if ever wrong |
| `getAccessLevelName` return type | Now `PlanTier` (was plain string); call sites only display/serialize it |

## Tests run

```bash
npm run test -- convex/planLimits.test.ts convex/limitEnforcement.test.ts
# 22 passed

npm run test -- shared/ convex/planLimits.test.ts convex/limitEnforcement.test.ts
# 40 passed

npx tsc --noEmit
# clean
```

## Follow-ups

1. Ops: reseed or patch existing `plans` free row perk text in non-dev environments if still showing 10.
2. Optionally update AGENTS.md Strategy-pattern blurb to “thin lookup into `LIMITS_BY_TIER`”.
3. If product later wants free=10, change **only** `LIMITS_BY_TIER.free.maxTestsPerMonth` — marketing + enforcement follow automatically.
