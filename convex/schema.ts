import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  prompts: defineTable({
    name: v.string(), // e.g. "course_architect"
    content: v.string(), // The prompt text with {{variables}}
    description: v.string(), // Technical details of usage
  }).index("by_name", ["name"]),
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
    planSlug: v.optional(v.string()),
    paddleSubscriptionId: v.optional(v.string()),
    paddleCustomerId: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("canceled"),
      v.literal("past_due"),
      v.literal("expired"),
      v.literal("paused"),
    ),
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    canceledAt: v.optional(v.number()),
    // Legacy Clerk-era fields kept temporarily for schema migration compatibility.
    clerkPlanSlug: v.optional(v.string()),
    periodEnd: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_paddle_sub", ["paddleSubscriptionId"]),
  plans: defineTable({
    name: v.string(),
    slug: v.string(),
    priceId: v.optional(v.string()),
    accessLevel: v.number(),
    perks: v.array(v.object({
      text: v.string(),
      link: v.optional(v.string()),
    })),
    basePrice: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_price_id", ["priceId"]),
  usage: defineTable({
    userId: v.string(),
    metric: v.string(),
    count: v.number(),
    periodStart: v.number(),
    periodEnd: v.number(),
  }).index("by_user_metric", ["userId", "metric"]),
  courses: defineTable({
    spaceId: v.id("spaces"),
    userId: v.string(),
    rawTopic: v.string(),
    refinedTitle: v.string(),
    courseDescription: v.string(),
    phase: v.union(
      v.literal("baseline"),
      v.literal("module_generation"),
      v.literal("lesson"),
      v.literal("lesson_summary"),
      v.literal("module_complete"),
      v.literal("completed"),
    ),
    currentModuleIndex: v.number(),
    currentLessonIndex: v.number(),
    baselineResults: v.optional(v.string()),
  })
    .index("by_space", ["spaceId"])
    .index("by_user", ["userId"]),
  courseModules: defineTable({
    courseId: v.id("courses"),
    moduleIndex: v.number(),
    moduleTitle: v.string(),
    adaptationRationale: v.string(),
    subTopics: v.string(),
  })
    .index("by_course", ["courseId"]),
  courseLessons: defineTable({
    courseId: v.id("courses"),
    moduleId: v.id("courseModules"),
    lessonIndex: v.number(),
    title: v.string(),
    focusArea: v.string(),
    targetsWeakness: v.boolean(),
    masteryGoals: v.optional(v.string()),
    verifierLogs: v.optional(v.string()),
    summaryMarkdown: v.optional(v.string()),
    knowledgePieceId: v.optional(v.id("knowledgePieces")),
    status: v.union(
      v.literal("pending"),
      v.literal("goals_set"),
      v.literal("teaching"),
      v.literal("completed"),
      v.literal("summarized"),
      v.literal("integrated"),
    ),
  })
    .index("by_module", ["moduleId"])
    .index("by_course", ["courseId"]),
  courseLessonMessages: defineTable({
    courseId: v.id("courses"),
    lessonId: v.id("courseLessons"),
    role: v.union(
      v.literal("teacher"),
      v.literal("user"),
      v.literal("system"),
    ),
    content: v.string(),
    messageType: v.optional(v.string()),
    clarificationQuote: v.optional(v.string()),
    threadId: v.optional(v.string()),
    clarificationBlockIndex: v.optional(v.number()),
    clarificationSectionIndex: v.optional(v.number()),
  })
    .index("by_lesson", ["lessonId"]),
});
