import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
    args: {
        testId: v.id("tests"),
        userId: v.string(),
        type: v.string(), // "select" | "write"
        question: v.string(),
        options: v.optional(v.array(v.string())),
        answer: v.optional(v.string()),
        knowledgeNodeId: v.optional(v.id("knowledgeNodes")),
    },
    handler: async (ctx, args) => {
        const test = await ctx.db.get(args.testId);
        if (!test) throw new Error("Test not found");

        const space = await ctx.db.get(test.spaceId);
        if (!space || (space.userId !== args.userId && space.userId !== "default_user")) {
            throw new Error("Unauthorized access to this test");
        }

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
        userId: v.string(),
        isCorrect: v.boolean(),
        aiFeedback: v.string(),
        userAnswer: v.string(),
    },
    handler: async (ctx, args) => {
        const question = await ctx.db.get(args.questionId);
        if (!question) throw new Error("Question not found");

        const test = await ctx.db.get(question.testId);
        if (!test) throw new Error("Test not found");

        const space = await ctx.db.get(test.spaceId);
        if (!space || (space.userId !== args.userId && space.userId !== "default_user")) {
            throw new Error("Unauthorized access to this question");
        }

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

export const getIncorrectForTopic = query({
    args: { spaceId: v.id("spaces"), topicTitle: v.string() },
    handler: async (ctx, args) => {
        const tests = await ctx.db
            .query("tests")
            .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
            .filter((q) => q.eq(q.field("topicTitle"), args.topicTitle))
            .collect();

        const allQuestions = await Promise.all(
            tests.map((test) =>
                ctx.db.query("questions")
                    .withIndex("by_test", (q) => q.eq("testId", test._id))
                    .collect()
            )
        );

        const incorrect = allQuestions.flat().filter(q => q.isCorrect === false);
        incorrect.sort((a, b) => b._creationTime - a._creationTime);
        return incorrect.slice(0, 10);
    },
});
