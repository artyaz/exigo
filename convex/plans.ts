import { query } from "./_generated/server";
import { getEffectiveAccessLevel, isProOrHigher } from "./subscriptionService";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("plans").collect();
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
