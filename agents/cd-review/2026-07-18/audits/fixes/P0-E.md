# Fix Pack P0-E — delete dead ungated usage public API

**Findings:** F-S1-001, F-S1-002  
**Brain:** S1-B001 approach A  
**Status:** done

## Summary

Removed the unused dual-metering path: public `usageService` Convex API (ungated `userId` — attack surface), dead `subscriptionService` test-usage helpers, and the daily `resetExpiredUsage` cron. Production meters remain calendar-month entity counts in `tests.ts` / `deepDives.ts` (untouched).

## Per-finding

| ID | Sev | Status | What changed |
|----|-----|--------|--------------|
| F-S1-001 | P0 | **done** | Deleted `convex/usageService.ts` entirely — public `getUsage` / `incrementUsage` / `checkUsageLimit` no longer exist on the deployment surface |
| F-S1-002 | P1 | **done** | Removed dead helpers + cron; `usage` table kept in schema as legacy |

## Grep before delete

| Symbol | App / product call sites |
|--------|--------------------------|
| `api.usageService` / `getUsage` / `incrementUsage` / `checkUsageLimit` | **none** (only self + generated `api.d.ts`) |
| `resetExpiredUsage` | **only** `convex/crons.ts` |
| `getTestsUsedThisMonth` / `incrementTestsUsage` / `checkTestsLimit` | **none** outside `subscriptionService.ts` |

## Files touched

| File | Change |
|------|--------|
| `convex/usageService.ts` | **deleted** |
| `convex/subscriptionService.ts` | Removed `getTestsUsedThisMonth`, `incrementTestsUsage`, `checkTestsLimit` |
| `convex/crons.ts` | Removed daily reset job; left empty `cronJobs()` export + comment |
| `convex/limitEnforcement.test.ts` | **unchanged** — does not import usage handlers (local mock handlers only) |

## Explicitly not changed

- `convex/tests.ts` / `convex/deepDives.ts` metering (out of pack; SSOT stays calendar-month counts)
- `convex/schema.ts` `usage` table — kept for now (legacy rows ok; drop/migrate later after data check)
- AGENTS.md liar docs — consolidate phase

## Residual risks

- Stale `usage` table rows remain until a later migration; nothing reads them.
- AGENTS.md still documents rolling 30-day `usageService` until docs pass.
- Empty `crons.ts` is fine; add real jobs here when needed.

## Verification

- `rg` product `.ts` for deleted symbols → empty after delete (generated `_generated/api*` updates on next `convex dev` / deploy)
- No test file imported deleted symbols; suite should remain green without `limitEnforcement` edits
