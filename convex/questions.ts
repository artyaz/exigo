import { v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthedContext } from "./authDecorators";
import { canReadSpace, canWriteSpace } from "./spaceAccess";

type DbCtx = QueryCtx | MutationCtx;

async function loadTestSpace(ctx: DbCtx, testId: Id<"tests">) {
  const test = await ctx.db.get(testId);
  if (!test) return null;
  const space = await ctx.db.get(test.spaceId);
  if (!space) return null;
  return { test, space };
}

async function requireTestWriteAccess(
  ctx: DbCtx,
  testId: Id<"tests">,
  userId: string,
) {
  const test = await ctx.db.get(testId);
  if (!test) throw new Error("Test not found");

  const space = await ctx.db.get(test.spaceId);
  if (!space || !canWriteSpace(space, userId)) {
    throw new Error("Unauthorized access to this test");
  }

  return { test, space };
}

export const create = mutation({
  args: {
    testId: v.id("tests"),
    type: v.string(), // "select" | "write"
    question: v.string(),
    options: v.optional(v.array(v.string())),
    answer: v.optional(v.string()),
    knowledgeNodeId: v.optional(v.id("knowledgeNodes")),
  },
  handler: async (ctx, args) => {
    const { userId } = await getAuthedContext(ctx);
    await requireTestWriteAccess(ctx, args.testId, userId);

    return await ctx.db.insert("questions", {
      testId: args.testId,
      type: args.type as "select" | "write",
      question: args.question,
      options: args.options,
      answer: args.answer,
      knowledgeNodeId: args.knowledgeNodeId,
    });
  },
});

export const getForTest = query({
  args: { testId: v.id("tests") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject;
    if (!userId) return [];

    const loaded = await loadTestSpace(ctx, args.testId);
    if (!loaded || !canReadSpace(loaded.space, userId)) return [];

    return await ctx.db
      .query("questions")
      .withIndex("by_test", (q) => q.eq("testId", args.testId))
      .collect();
  },
});

export const get = query({
  args: { questionId: v.id("questions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject;
    if (!userId) return null;

    const question = await ctx.db.get(args.questionId);
    if (!question) return null;

    const loaded = await loadTestSpace(ctx, question.testId);
    if (!loaded || !canReadSpace(loaded.space, userId)) return null;

    return question;
  },
});

export const updateFeedback = mutation({
  args: {
    questionId: v.id("questions"),
    isCorrect: v.boolean(),
    aiFeedback: v.string(),
    userAnswer: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await getAuthedContext(ctx);

    const question = await ctx.db.get(args.questionId);
    if (!question) throw new Error("Question not found");

    await requireTestWriteAccess(ctx, question.testId, userId);

    await ctx.db.patch(args.questionId, {
      isCorrect: args.isCorrect,
      aiFeedback: args.aiFeedback,
      userAnswer: args.userAnswer,
    });
  },
});

export const getForSpace = query({
  args: { spaceId: v.id("spaces") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject;
    if (!userId) return [];

    const space = await ctx.db.get(args.spaceId);
    if (!space || !canReadSpace(space, userId)) return [];
    const tests = await ctx.db
      .query("tests")
      .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
      .collect();

    const allQuestions = await Promise.all(
      tests.map((test) =>
        ctx.db
          .query("questions")
          .withIndex("by_test", (q) => q.eq("testId", test._id))
          .collect(),
      ),
    );
    return allQuestions.flat();
  },
});

export const getIncorrectForTopic = query({
  args: { spaceId: v.id("spaces"), topicTitle: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject;
    if (!userId) return [];

    const space = await ctx.db.get(args.spaceId);
    if (!space || !canReadSpace(space, userId)) return [];

    const tests = await ctx.db
      .query("tests")
      .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
      .filter((q) => q.eq(q.field("topicTitle"), args.topicTitle))
      .collect();

    const perTest = await Promise.all(
      tests.map((test) =>
        ctx.db
          .query("questions")
          .withIndex("by_test", (q) => q.eq("testId", test._id))
          .filter((q) => q.eq(q.field("isCorrect"), false))
          .collect(),
      ),
    );

    return perTest
      .flat()
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, 10);
  },
});
