import { v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthedContext, getAuthenticatedUserId } from "./authDecorators";
import { UNLIMITED_LIMIT } from "../shared/planConfig";

const QUESTION_TYPE = v.union(v.literal("select"), v.literal("write"));

function getStartOfMonthMs() {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0);
}

async function getOwnedSpaceIds(
  ctx: QueryCtx | MutationCtx,
  userId: string,
): Promise<Id<"spaces">[]> {
  const [userSpaces, defaultSpaces] = await Promise.all([
    ctx.db
      .query("spaces")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect(),
    ctx.db
      .query("spaces")
      .withIndex("by_user", (q) => q.eq("userId", "default_user"))
      .collect(),
  ]);

  return [
    ...new Set([...userSpaces, ...defaultSpaces].map((space) => space._id)),
  ];
}

async function countTestsForSpacesSince(
  ctx: QueryCtx | MutationCtx,
  spaceIds: Id<"spaces">[],
  createdAfterMs: number,
) {
  if (spaceIds.length === 0) {
    return 0;
  }

  const testsBySpace = await Promise.all(
    spaceIds.map((spaceId) =>
      ctx.db
        .query("tests")
        .withIndex("by_space", (q) => q.eq("spaceId", spaceId))
        .filter((q) => q.gte(q.field("_creationTime"), createdAfterMs))
        .collect(),
    ),
  );

  return testsBySpace.reduce((sum, tests) => sum + tests.length, 0);
}

async function countForUserThisMonthInternal(
  ctx: QueryCtx | MutationCtx,
  userId: string,
) {
  const spaceIds = await getOwnedSpaceIds(ctx, userId);
  return await countTestsForSpacesSince(ctx, spaceIds, getStartOfMonthMs());
}

export const createEmptyTest = mutation({
  args: {
    spaceId: v.id("spaces"),
    type: v.string(),
    questionCount: v.number(),
    topicTitle: v.optional(v.string()),
    userId: v.string(),
    knowledgePieceId: v.optional(v.id("knowledgePieces")),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthedContext(ctx);
    if (args.userId !== auth.userId) {
      throw new Error("Unauthorized");
    }

    const maxAllowed = auth.limits.maxTestsPerMonth;
    if (maxAllowed === 0) {
      throw new Error(
        "You don't have access to test generation on your current plan. Please upgrade to continue.",
      );
    }

    const space = await ctx.db.get(args.spaceId);
    if (!space) {
      throw new Error("Space not found");
    }

    if (space.userId !== auth.userId) {
      throw new Error("Unauthorized access to this space");
    }

    const count = await countForUserThisMonthInternal(ctx, auth.userId);

    if (maxAllowed !== UNLIMITED_LIMIT && count >= maxAllowed) {
      throw new Error(
        `Limit reached: You have created ${count} tests this month. Your current plan limit is ${maxAllowed}. Please upgrade for more!`,
      );
    }

    return await ctx.db.insert("tests", {
      spaceId: args.spaceId,
      topicTitle: args.topicTitle,
      status: "active",
      config: {
        type: args.type,
        questionCount: args.questionCount,
      },
      knowledgePieceId: args.knowledgePieceId,
    });
  },
});

export const create = mutation({
  args: {
    spaceId: v.id("spaces"),
    type: v.string(),
    questionCount: v.optional(v.number()),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthedContext(ctx);
    if (args.userId !== auth.userId) {
      throw new Error("Unauthorized");
    }

    const maxAllowed = auth.limits.maxTestsPerMonth;
    if (maxAllowed === 0) {
      throw new Error(
        "You don't have access to test generation on your current plan. Please upgrade to continue.",
      );
    }

    const space = await ctx.db.get(args.spaceId);
    if (!space) {
      throw new Error("Space not found");
    }

    if (space.userId !== auth.userId) {
      throw new Error("Unauthorized access to this space");
    }

    const count = await countForUserThisMonthInternal(ctx, auth.userId);
    if (maxAllowed !== UNLIMITED_LIMIT && count >= maxAllowed) {
      throw new Error(
        `Limit reached: You can only create ${maxAllowed} tests per month on your current plan.`,
      );
    }

    return await ctx.db.insert("tests", {
      spaceId: args.spaceId,
      status: "generating",
      config: {
        type: args.type,
        questionCount: args.questionCount ?? 5,
      },
    });
  },
});

export const countForUserThisMonth = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }
    return await countForUserThisMonthInternal(ctx, args.userId);
  },
});

export const updateStatus = mutation({
  args: {
    testId: v.id("tests"),
    status: v.union(
      v.literal("draft"),
      v.literal("generating"),
      v.literal("active"),
      v.literal("completed"),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);

    const test = await ctx.db.get(args.testId);
    if (!test) throw new Error("Test not found");

    const space = await ctx.db.get(test.spaceId);
    if (!space || space.userId !== userId) {
      throw new Error("Unauthorized access to this test");
    }

    await ctx.db.patch(args.testId, { status: args.status });
  },
});

export const getForSpace = query({
  args: { spaceId: v.id("spaces") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject;
    if (!userId) return [];

    const space = await ctx.db.get(args.spaceId);
    if (!space || space.userId !== userId) {
      throw new Error("Unauthorized access to this space");
    }

    return await ctx.db
      .query("tests")
      .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
      .collect();
  },
});

export const listAll = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    const spaces = await ctx.db
      .query("spaces")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    if (spaces.length === 0) return [];

    const spaceById = new Map(spaces.map((space) => [space._id, space]));

    const testsBySpace = await Promise.all(
      spaces.map((space) =>
        ctx.db
          .query("tests")
          .withIndex("by_space", (q) => q.eq("spaceId", space._id))
          .collect(),
      ),
    );
    const tests = testsBySpace
      .flat()
      .sort((a, b) => b._creationTime - a._creationTime);

    return await Promise.all(
      tests.map(async (test) => {
        const questions = await ctx.db
          .query("questions")
          .withIndex("by_test", (q) => q.eq("testId", test._id))
          .collect();
        const answeredCount = questions.filter((q) => q.userAnswer).length;
        return {
          ...test,
          spaceName: spaceById.get(test.spaceId)?.name ?? "Unknown",
          questionCount: questions.length,
          answeredCount,
        };
      }),
    );
  },
});

export const get = query({
  args: { testId: v.id("tests") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject;
    if (!userId) return null;

    const test = await ctx.db.get(args.testId);
    if (!test) {
      return null;
    }

    const space = await ctx.db.get(test.spaceId);
    if (!space || space.userId !== userId) {
      throw new Error("Unauthorized access to this test");
    }

    return test;
  },
});

export const createWithQuestions = mutation({
  args: {
    spaceId: v.id("spaces"),
    type: v.string(),
    userId: v.string(),
    questions: v.array(
      v.object({
        type: QUESTION_TYPE,
        question: v.string(),
        options: v.optional(v.array(v.string())),
        answer: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthedContext(ctx);
    if (args.userId !== auth.userId) {
      throw new Error("Unauthorized");
    }

    const maxAllowed = auth.limits.maxTestsPerMonth;
    if (maxAllowed === 0) {
      throw new Error(
        "You don't have access to test generation on your current plan. Please upgrade to continue.",
      );
    }

    const space = await ctx.db.get(args.spaceId);
    if (!space) {
      throw new Error("Space not found");
    }

    if (space.userId !== auth.userId) {
      throw new Error("Unauthorized access to this space");
    }

    const count = await countForUserThisMonthInternal(ctx, auth.userId);
    if (maxAllowed !== UNLIMITED_LIMIT && count >= maxAllowed) {
      throw new Error(
        `Limit reached: You can only create ${maxAllowed} tests per month on your current plan.`,
      );
    }

    const testId = await ctx.db.insert("tests", {
      spaceId: args.spaceId,
      status: "active",
      config: {
        type: args.type,
        questionCount: args.questions.length,
      },
    });

    for (const q of args.questions) {
      await ctx.db.insert("questions", {
        testId: testId,
        type: q.type,
        question: q.question,
        options: q.options,
        answer: q.answer,
      });
    }

    return testId;
  },
});
