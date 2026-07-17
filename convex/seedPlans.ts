import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { getMarketingPerksForTier } from "../shared/planConfig";

/**
 * Seed the plans catalog. Perks come from `getMarketingPerksForTier` → `LIMITS_BY_TIER` (SSOT).
 *
 * Idempotency: throws if any `plans` rows exist — does not update or re-seed in place.
 *
 * ## Stale free “10 AI tests / month” rows (pre-P3-A)
 * Environments seeded before marketing was aligned still store free perk text advertising
 * 10 tests while runtime enforcement has always used `LIMITS_BY_TIER.free.maxTestsPerMonth`
 * (3). This seed cannot fix those rows (it refuses when plans exist).
 *
 * Ops options (no automatic migration):
 * 1. Delete all `plans` rows, run `seedPlans.seed`, then re-apply `setPriceId` for paid slugs.
 * 2. Manually patch the free plan’s `perks` to match `getMarketingPerksForTier("free")`
 *    (includes “3 AI tests / month”, not 10). Paid rows are usually fine if seeded from SSOT.
 * Optional future helper: an internal mutation that patches every plan’s `perks` from
 * `getMarketingPerksForTier(slugToTier(slug))` without deleting rows — not shipped here.
 */
export const seed = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("plans").collect();
    if (existing.length > 0) {
      throw new Error("Plans already seeded. Delete existing plans first.");
    }

    const plans = [
      {
        name: "Free",
        slug: "free",
        accessLevel: 0,
        perks: getMarketingPerksForTier("free"),
        basePrice: 0,
      },
      {
        name: "Pro Scholar",
        slug: "pro-monthly",
        priceId: "",
        accessLevel: 1,
        perks: getMarketingPerksForTier("pro"),
        basePrice: 900,
      },
      {
        name: "Pro Scholar",
        slug: "pro-annual",
        priceId: "",
        accessLevel: 1,
        perks: getMarketingPerksForTier("pro"),
        basePrice: 7500,
      },
      {
        name: "Educator",
        slug: "educator-monthly",
        priceId: "",
        accessLevel: 2,
        perks: getMarketingPerksForTier("educator"),
        basePrice: 1900,
      },
      {
        name: "Educator",
        slug: "educator-annual",
        priceId: "",
        accessLevel: 2,
        perks: getMarketingPerksForTier("educator"),
        basePrice: 19200,
      },
    ];

    for (const plan of plans) {
      await ctx.db.insert("plans", plan);
    }

    return { seeded: plans.length };
  },
});

/** Update the priceId for a plan by slug. Run per-environment after seeding. */
export const setPriceId = internalMutation({
  args: { slug: v.string(), priceId: v.string() },
  handler: async (ctx, args) => {
    const trimmed = args.priceId.trim();
    if (trimmed.length === 0) {
      throw new Error(`Invalid priceId for slug "${args.slug}": must be a non-empty string`);
    }
    const plan = await ctx.db
      .query("plans")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (!plan) throw new Error(`Plan not found: ${args.slug}`);
    await ctx.db.patch(plan._id, { priceId: trimmed });
    return { updated: args.slug };
  },
});
