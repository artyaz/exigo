import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getForQuestion = query({
    args: { questionId: v.id("questions") },
    handler: async (ctx, args) => {
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
        const test = await ctx.db.get(args.testId);
        if (!test) throw new Error("Test not found");

        const space = await ctx.db.get(test.spaceId);
        if (!space || (space.userId !== args.userId && space.userId !== "default_user")) {
            throw new Error("Unauthorized access to this test");
        }

        return await ctx.db.insert("testMessages", {
            testId: args.testId,
            questionId: args.questionId,
            role: args.role as "user" | "ai",
            content: args.content,
        });
    },
});

