import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  spaces: defineTable({
    name: v.string(),
    userId: v.string(),
  }).index("by_user", ["userId"]),
  knowledgePieces: defineTable({
    spaceId: v.id("spaces"),
    title: v.optional(v.string()),
    content: v.string(),
    source: v.optional(v.string()), // Might be file name or url
  }).index("by_space", ["spaceId"]),
  knowledgeNodes: defineTable({
    spaceId: v.id("spaces"),
    knowledgePieceId: v.id("knowledgePieces"),
    type: v.union(
      v.literal("struggle"),
      v.literal("improvement"),
      v.literal("feels_hard"),
    ),
    content: v.string(),
    resolutionScore: v.number(), // 0 to 100
    isActive: v.boolean(),
  })
    .index("by_space", ["spaceId"])
    .index("by_piece", ["knowledgePieceId"])
    .index("by_piece_active", ["knowledgePieceId", "isActive"]),
  tests: defineTable({
    spaceId: v.id("spaces"),
    topicTitle: v.optional(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("generating"),
      v.literal("active"),
      v.literal("completed"),
    ),
    config: v.object({
      type: v.string(),
      questionCount: v.optional(v.number()),
    }),
    knowledgePieceId: v.optional(v.id("knowledgePieces")),
    userId: v.optional(v.string()),
  })
    .index("by_space", ["spaceId"])
    .index("by_piece", ["knowledgePieceId"]),
  questions: defineTable({
    testId: v.id("tests"),
    type: v.union(v.literal("select"), v.literal("write")),
    question: v.string(),
    options: v.optional(v.array(v.string())), // For select type
    answer: v.optional(v.string()), // Perfect/Correct answer
    userAnswer: v.optional(v.string()), // User's answer
    isCorrect: v.optional(v.boolean()),
    aiFeedback: v.optional(v.string()),
    knowledgeNodeId: v.optional(v.id("knowledgeNodes")),
  }).index("by_test", ["testId"]),
  testMessages: defineTable({
    testId: v.id("tests"),
    questionId: v.id("questions"),
    role: v.union(v.literal("user"), v.literal("ai")),
    content: v.string(),
  }).index("by_question", ["questionId"]),
  deepDives: defineTable({
    userId: v.string(),
    spaceId: v.id("spaces"),
    questionId: v.id("questions"),
  }).index("by_user", ["userId"]),
  subscriptions: defineTable({
    userId: v.string(),
    accessLevel: v.number(),
    clerkPlanId: v.optional(v.string()),
    clerkPlanSlug: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("canceled"),
      v.literal("past_due"),
      v.literal("expired"),
    ),
    periodEnd: v.optional(v.number()),
    canceledAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),
  testsUsage: defineTable({
    userId: v.string(),
    month: v.string(),
    count: v.number(),
  }).index("by_user_month", ["userId", "month"]),
});
