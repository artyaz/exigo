import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthedContext } from "./authDecorators";
import { UNLIMITED_LIMIT } from "../shared/planConfig";

export const create = mutation({
  args: {
    spaceId: v.id("spaces"),
    questionId: v.id("questions"),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthedContext(ctx);
    const userId = auth.userId;
    const maxDives = auth.limits.deepDiveLimit;

    if (maxDives === 0) {
      throw new Error(
        "You don't have access to Deep Dive notes on your current plan. Please upgrade to continue.",
      );
    }

    const space = await ctx.db.get(args.spaceId);
    if (
      !space ||
      (space.userId !== userId && space.userId !== "default_user")
    ) {
      throw new Error("Unauthorized access to this space");
    }

    const question = await ctx.db.get(args.questionId);
    if (!question) {
      throw new Error("Question not found");
    }

    const test = await ctx.db.get(question.testId);
    if (!test) {
      throw new Error("Test not found for this question");
    }

    if (test.spaceId !== args.spaceId) {
      throw new Error("Question does not belong to this space");
    }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const dives = await ctx.db
      .query("deepDives")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.gte(q.field("_creationTime"), startOfMonth.getTime()))
      .collect();

    if (maxDives !== UNLIMITED_LIMIT && dives.length >= maxDives) {
      throw new Error(
        `Limit reached: You can only generate ${maxDives} Deep Dive notes per month on your current plan.`,
      );
    }

    return await ctx.db.insert("deepDives", {
      userId: userId,
      spaceId: args.spaceId,
      questionId: args.questionId,
    });
  },
});

export const countForUserThisMonth = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const dives = await ctx.db
      .query("deepDives")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.gte(q.field("_creationTime"), startOfMonth.getTime()))
      .collect();

    return dives.length;
  },
});
