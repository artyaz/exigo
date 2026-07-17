# Fix pack P4-E — Doc/code consistency residual from P3-A

**Findings residual:** P3-A residual #2 (AGENTS Strategy-pattern blurb); P3-A residual #1 (stale free “10 AI tests” DB perks — documented, not migrated)  
**Brain / prior:** P3-A collapsed Strategy classes → `LIMITS_BY_TIER`; free marketing 10→3; left AGENTS + already-seeded DBs  
**Status:** done

## Summary

Aligned repo agent docs with post–P3-A / post–P0-E reality: plan limits are a shared SSOT table + thin access-level lookup, not Strategy classes; usage is calendar-month domain counts, not a rolling-window `usageService`. Documented ops paths for environments that still store pre-P3-A free perk copy (“10 AI tests / month”) without forcing a data migration.

## What changed

### `AGENTS.md` — Subscription & Plan Limits

| Before (wrong / stale) | After (matches code) |
|------------------------|----------------------|
| Strategy pattern (`FreeLimitStrategy`, …) in `subscriptionService` | Thin `getLimitsForAccessLevel` → `getLimitsForTier` / `LIMITS_BY_TIER` |
| Implied planConfig alone, no SSOT callout | Explicit SSOT: `LIMITS_BY_TIER` + `getMarketingPerksForTier` for seed/pricing |
| Calendar-month counts only (partially ok) | Same, plus note that rolling-window `usageService` was removed |
| — | Note on `seedPlans` no-overwrite + stale free “10” perk rows |

### `convex/seedPlans.ts` — comments only

- File/seed JSDoc: perks SSOT, seed is non-idempotent overwrite-wise (throws if rows exist).
- Explicit residual: pre-P3-A free rows may still say “10 AI tests / month”; enforcement is already 3.
- Ops: delete+reseed+`setPriceId`, or manual `perks` patch from `getMarketingPerksForTier("free")`.
- Optional future internal mutation (patch all plan perks from SSOT without delete) noted but **not** implemented.

## Explicitly not changed

- No DB migration / Convex data rewrite
- No new mutation or `scripts/` tool
- Runtime limits (`LIMITS_BY_TIER`, `tests.ts` / `deepDives.ts` metering)
- Pricing page / `shared/planConfig.ts` (already fixed in P3-A)
- `usage` table schema legacy rows (P0-E residual; out of scope)

## Residual risks

| Risk | Notes |
|------|--------|
| Stale free perk text in already-seeded deployments | Docs only; free pricing fallback in UI already uses `getMarketingPerksForTier` when DB free row is skipped — paid cards still read DB `perks` |
| Ops forgets `setPriceId` after full reseed | Called out in seed comment |
| Future product free=10 | Change only `LIMITS_BY_TIER.free.maxTestsPerMonth`; marketing + seed follow |

## Verification

- `rg` AGENTS for `Strategy` / `FreeLimitStrategy` / `usageService` rolling → gone from plan-limits section
- `seedPlans.ts` documents stale “10 AI tests” + ops paths
- No code path changes → no new unit tests required

## Files touched

| File | Change |
|------|--------|
| `AGENTS.md` | Correct plan-limits architecture blurb |
| `convex/seedPlans.ts` | Comment block on seed + stale free perks |
| `audits/fixes/P4-E.md` | This writeup |

## Follow-ups (optional, out of pack)

1. Ship `seedPlans.refreshMarketingPerks` internal mutation if ops needs one-shot patch without deleting plans.
2. Drop legacy `usage` table after confirming no readers (P0-E residual).
