import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthedContext } from "./authDecorators";
import { UNLIMITED_LIMIT } from "../shared/planConfig";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject;
    if (!userId) return [];

    return await ctx.db
      .query("spaces")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const countForUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject;
    if (!userId) return 0;

    const spaces = await ctx.db
      .query("spaces")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return spaces.length;
  },
});

export const get = query({
  args: { spaceId: v.id("spaces") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject;
    if (!userId) return null;

    const space = await ctx.db.get(args.spaceId);
    if (!space || space.userId !== userId) return null;
    return space;
  },
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const auth = await getAuthedContext(ctx);
    const serverLimit = auth.limits.maxSpaces;

    if (serverLimit !== UNLIMITED_LIMIT) {
      const spaces = await ctx.db
        .query("spaces")
        .withIndex("by_user", (q) => q.eq("userId", auth.userId))
        .take(serverLimit);

      if (spaces.length >= serverLimit) {
        throw new Error(
          `Limit reached: You can only have ${serverLimit} spaces on your current plan.`,
        );
      }
    }

    return await ctx.db.insert("spaces", {
      name: args.name,
      userId: auth.userId,
    });
  },
});
