import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
    args: {
        testId: v.id("tests"),
        type: v.string(), // "select" | "write"
        question: v.string(),
        options: v.optional(v.array(v.string())),
        answer: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("questions", {
            testId: args.testId,
            type: args.type as "select" | "write",
            question: args.question,
            options: args.options,
            answer: args.answer,
        });
    },
});

export const getForTest = query({
    args: { testId: v.id("tests") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("questions")
            .withIndex("by_test", (q) => q.eq("testId", args.testId))
            .collect();
    },
});

export const get = query({
    args: { questionId: v.id("questions") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.questionId);
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
        // Get all tests for this space
        const tests = await ctx.db
            .query("tests")
            .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
            .collect();
        // Get all questions for those tests
        const allQuestions = await Promise.all(
            tests.map((test) =>
                ctx.db.query("questions")
                    .withIndex("by_test", (q) => q.eq("testId", test._id))
                    .collect()
            )
        );
        return allQuestions.flat();
    },
});
