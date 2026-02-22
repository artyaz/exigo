import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    spaces: defineTable({
        name: v.string(),
        userId: v.string(),
    }),
    knowledgePieces: defineTable({
        spaceId: v.id("spaces"),
        title: v.optional(v.string()),
        content: v.string(),
        source: v.optional(v.string()), // Might be file name or url
    }).index("by_space", ["spaceId"]),
    tests: defineTable({
        spaceId: v.id("spaces"),
        status: v.union(
            v.literal("draft"),
            v.literal("generating"),
            v.literal("active"),
            v.literal("completed")
        ),
        config: v.object({
            type: v.string(), // "select" or "write"
            questionCount: v.optional(v.number()),
        }),
    }).index("by_space", ["spaceId"]),
    questions: defineTable({
        testId: v.id("tests"),
        type: v.union(v.literal("select"), v.literal("write")),
        question: v.string(),
        options: v.optional(v.array(v.string())), // For select type
        answer: v.optional(v.string()), // Perfect/Correct answer
        userAnswer: v.optional(v.string()), // User's answer
        isCorrect: v.optional(v.boolean()),
        aiFeedback: v.optional(v.string()),
    }).index("by_test", ["testId"]),
    testMessages: defineTable({
        testId: v.id("tests"),
        questionId: v.id("questions"),
        role: v.union(v.literal("user"), v.literal("ai")),
        content: v.string(),
    }).index("by_question", ["questionId"]),
});
