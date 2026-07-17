import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { getMarketingPerksForTier } from "../shared/planConfig";

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
