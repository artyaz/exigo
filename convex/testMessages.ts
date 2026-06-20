import { v } from "convex/values";
import {
  mutation,
  query,
  internalQuery,
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// The `chat` action lives in testMessagesActions.ts ("use node") because it
// depends on @google/genai + posthog-node Node built-ins.

async function getAuthenticatedUserId(
  ctx: QueryCtx | MutationCtx,
): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) {
    throw new Error("Not authenticated");
  }
  return identity.subject;
}

async function authorizeQuestionAccess(
  ctx: QueryCtx | MutationCtx,
  questionId: Id<"questions">,
  userId: string,
) {
  const question = await ctx.db.get(questionId);
  if (!question) {
    throw new Error("Question not found");
  }

  const test = await ctx.db.get(question.testId);
  if (!test) {
    throw new Error("Test not found");
  }

  const space = await ctx.db.get(test.spaceId);
  if (!space || (space.userId !== userId && space.userId !== "default_user")) {
    throw new Error("Unauthorized access to this question");
  }

  return { question, test };
}

export const getForQuestion = query({
  args: { questionId: v.id("questions"), userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const authenticatedUserId = await getAuthenticatedUserId(ctx);
    await authorizeQuestionAccess(ctx, args.questionId, authenticatedUserId);

    return await ctx.db
      .query("testMessages")
      .withIndex("by_question", (q) => q.eq("questionId", args.questionId))
      .collect();
  },
});

export const send = mutation({
  args: {
    testId: v.id("tests"),
    questionId: v.id("questions"),
    role: v.union(v.literal("user"), v.literal("ai")),
    content: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authenticatedUserId = await getAuthenticatedUserId(ctx);
    const { question } = await authorizeQuestionAccess(
      ctx,
      args.questionId,
      authenticatedUserId,
    );

    if (question.testId !== args.testId) {
      throw new Error("Question does not belong to this test");
    }

    return await ctx.db.insert("testMessages", {
      testId: args.testId,
      questionId: args.questionId,
      role: args.role,
      content: args.content,
    });
  },
});

export const getQuestionDataForChat = internalQuery({
  args: { questionId: v.id("questions"), userId: v.string() },
  handler: async (ctx, args) => {
    const question = await ctx.db.get(args.questionId);
    if (!question) return null;

    const test = await ctx.db.get(question.testId);
    if (!test) return null;

    const space = await ctx.db.get(test.spaceId);
    if (
      !space ||
      (space.userId !== args.userId && space.userId !== "default_user")
    ) {
      return null;
    }

    const pastMessages = await ctx.db
      .query("testMessages")
      .withIndex("by_question", (q) => q.eq("questionId", args.questionId))
      .collect();

    return { question, test, pastMessages };
  },
});

export const saveMessageInternal = internalMutation({
  args: {
    testId: v.id("tests"),
    questionId: v.id("questions"),
    role: v.union(v.literal("user"), v.literal("ai")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("testMessages", {
      testId: args.testId,
      questionId: args.questionId,
      role: args.role,
      content: args.content,
    });
  },
});
