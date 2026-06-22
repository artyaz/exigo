import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/* Reviewer comments on generated exercises. The Next.js client (which holds the
   Clerk identity) passes `userId`, matching the convention used across this
   app's Convex functions. */

export const add = mutation({
  args: {
    userId: v.string(),
    comment: v.string(),
    html: v.string(),
    source: v.string(),
    context: v.optional(v.string()),
    mechanic: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("exerciseComments", { ...args, createdAt: Date.now() });
  },
});

export const listForUser = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("exerciseComments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const remove = mutation({
  args: { userId: v.string(), id: v.id("exerciseComments") },
  handler: async (ctx, { userId, id }) => {
    const row = await ctx.db.get(id);
    if (row?.userId === userId) await ctx.db.delete(id);
  },
});
