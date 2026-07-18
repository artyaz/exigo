import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { canReadSpace } from "./spaceAccess";
import { getAuthedContext } from "./authDecorators";
import { UNLIMITED_LIMIT } from "../shared/planConfig";

function getStartOfMonthUTC(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0);
}

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
      (!canReadSpace(space, userId))
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

    if (maxDives !== UNLIMITED_LIMIT) {
      const startOfMonth = getStartOfMonthUTC();

      const dives = await ctx.db
        .query("deepDives")
        .withIndex("by_user", (q) =>
          q.eq("userId", userId).gte("_creationTime", startOfMonth),
        )
        .take(maxDives);

      if (dives.length >= maxDives) {
        throw new Error(
          `Limit reached: You can only generate ${maxDives} Deep Dive notes per month on your current plan.`,
        );
      }
    }

    return await ctx.db.insert("deepDives", {
      userId: userId,
      spaceId: args.spaceId,
      questionId: args.questionId,
    });
  },
});

export const countForUserThisMonth = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) {
      return 0;
    }

    const startOfMonth = getStartOfMonthUTC();

    const dives = await ctx.db
      .query("deepDives")
      .withIndex("by_user", (q) =>
        q.eq("userId", identity.subject).gte("_creationTime", startOfMonth),
      )
      .collect();

    return dives.length;
  },
});
