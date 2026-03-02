import { v } from "convex/values";
import { query } from "./_generated/server";
import { getEffectiveAccessLevel, isProOrHigher } from "./subscriptionService";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("plans").collect();
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("plans")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

export const getByPriceId = query({
  args: { priceId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("plans")
      .withIndex("by_price_id", (q) => q.eq("priceId", args.priceId))
      .first();
  },
});

export const myAccessLevel = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { accessLevel: 0, isPro: false };
    const accessLevel = await getEffectiveAccessLevel(ctx, identity.subject);
    return { accessLevel, isPro: isProOrHigher(accessLevel) };
  },
});
