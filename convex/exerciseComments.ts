import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthedContext } from "./authDecorators";

/* Reviewer comments on generated exercises. The authenticated user is derived
   server-side from the Convex auth context — never trusted from the client. */

export const add = mutation({
  args: {
    comment: v.string(),
    html: v.string(),
    source: v.string(),
    context: v.optional(v.string()),
    mechanic: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await getAuthedContext(ctx);
    return await ctx.db.insert("exerciseComments", { ...args, userId, createdAt: Date.now() });
  },
});

export const listForUser = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await getAuthedContext(ctx);
    return await ctx.db
      .query("exerciseComments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const remove = mutation({
  args: { id: v.id("exerciseComments") },
  handler: async (ctx, { id }) => {
    const { userId } = await getAuthedContext(ctx);
    const row = await ctx.db.get(id);
    if (row?.userId === userId) await ctx.db.delete(id);
  },
});
