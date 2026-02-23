import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

async function authorizeQuestionAccess(
    ctx: QueryCtx | MutationCtx,
    questionId: Id<"questions">,
    userId: string
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
    args: { questionId: v.id("questions"), userId: v.string() },
    handler: async (ctx, args) => {
        await authorizeQuestionAccess(ctx, args.questionId, args.userId);

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
        userId: v.string(),
    },
    handler: async (ctx, args) => {
        const { question } = await authorizeQuestionAccess(ctx, args.questionId, args.userId);

        if (question.testId !== args.testId) {
            throw new Error("Question does not belong to this test");
        }

        return await ctx.db.insert("testMessages", {
            testId: args.testId,
            questionId: args.questionId,
            role: args.role as "user" | "ai",
            content: args.content,
        });
    },
});
