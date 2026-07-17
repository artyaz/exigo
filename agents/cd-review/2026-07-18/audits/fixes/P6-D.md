# Fix pack P6-D — sync plan perks from SSOT

**Source:** P3-A residual — already-seeded free plan rows may still say “10 AI tests / month”  
**Priority:** P2  
**Status:** done

## What changed

| File | Change |
|------|--------|
| `convex/seedPlans.ts` | `syncPerksFromSsot` internalMutation — patches every plan’s `perks` from `getMarketingPerksForTier(slugToTier(slug))` without deleting rows or touching priceIds |
| `AGENTS.md` | Ops note: prefer `syncPerksFromSsot` over delete+reseed |

## Ops

```text
# Convex dashboard / CLI — internal mutation
seedPlans.syncPerksFromSsot  →  { patched, total }
```

Enforcement was already 3 tests/month; this only repairs marketing copy in DB.

## Residual

- Must be run per deployment (dev + prod) by an operator; not automatic on deploy.
- Does not re-seed missing plan rows (only patches existing).
