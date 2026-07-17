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
    // `_creationTime` is auto-appended to every index; listing it explicitly
    // is redundant and rejected by Convex, so the index is just ["userId"].
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
    // Legacy fields from earlier billing integrations, tolerated as optional for
    // schema-migration compatibility; current code reads the fields above.
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
    /** OCC lock: only one generateModule may hold this at a time (P5-C). */
    generationInProgress: v.optional(v.boolean()),
    /** Wall-clock ms when generationInProgress was set; used for TTL steal (P6-A). */
    generationClaimedAt: v.optional(v.number()),
    /** Legacy course mode present on some rows (e.g. "self"); optional for schema drift. */
    mode: v.optional(v.string()),
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
    checkpointStates: v.optional(v.array(v.object({
      sectionIndex: v.number(),
      question: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("answered"),
        v.literal("skipped"),
      ),
      answer: v.optional(v.string()),
      verification: v.optional(v.object({
        is_correct: v.boolean(),
        feedback_block: v.string(),
      })),
    }))),
    /**
     * Legacy field present on some rows (schema drift). Not written by current code;
     * optional so deploy/push can validate existing documents.
     */
    exerciseStates: v.optional(v.array(v.object({
      sectionIndex: v.number(),
      status: v.string(),
    }))),
    summaryMarkdown: v.optional(v.string()),
    knowledgePieceId: v.optional(v.id("knowledgePieces")),
    pendingFeelsHardNodes: v.optional(v.array(v.string())),
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

  // ─── AI Tutor ───
  courseTutorChats: defineTable({
    // Legacy course-scoped chats may not have spaceId yet.
    spaceId: v.optional(v.id("spaces")),
    courseId: v.optional(v.id("courses")),
    userId: v.string(),
    title: v.string(),
  })
    .index("by_course", ["courseId"])
    .index("by_user_course", ["userId", "courseId"])
    .index("by_space", ["spaceId"])
    .index("by_user_space", ["userId", "spaceId"]),
  courseTutorMessages: defineTable({
    chatId: v.id("courseTutorChats"),
    role: v.union(
      v.literal("user"),
      v.literal("tutor"),
      v.literal("system"),
    ),
    content: v.string(),
  })
    .index("by_chat", ["chatId"]),
  spaceTutorMemories: defineTable({
    spaceId: v.id("spaces"),
    userId: v.string(),
    content: v.string(),
    category: v.union(
      v.literal("preference"),
      v.literal("struggle"),
      v.literal("insight"),
      v.literal("goal"),
    ),
    sourceType: v.union(
      v.literal("lesson"),
      v.literal("clarification"),
      v.literal("tutor_chat"),
    ),
    sourceCourseId: v.optional(v.id("courses")),
    embedding: v.array(v.float64()),
  })
    .index("by_space_user", ["spaceId", "userId"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 768,
      filterFields: ["spaceId", "userId"],
    }),
  // Per-user AI routing. `provider` selects the default Google key vs. a custom
  // OpenAI-compatible endpoint. The custom key is stored ONLY as opaque AES-GCM
  // ciphertext (keyCipher/keyIv); the symmetric secret never lives in Convex.
  // See src/server/ai/secrets.ts.
  userSettings: defineTable({
    userId: v.string(),
    provider: v.union(v.literal("gemini"), v.literal("openai")),
    model: v.optional(v.string()),
    baseUrl: v.optional(v.string()),
    keyCipher: v.optional(v.string()),
    keyIv: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
  // Reviewer comments left on a generated exercise. Stores the exercise's own
  // HTML (its "code") alongside the note + where it came from, so the playground
  // collection can list and export commented exercises.
  exerciseComments: defineTable({
    userId: v.string(),
    comment: v.string(),
    html: v.string(),
    source: v.string(), // "atlas" | "embed" | "lesson"
    context: v.optional(v.string()), // science/subtopic/lesson title, or the brief
    mechanic: v.optional(v.string()), // the brainstormed mechanic chosen, if any
    createdAt: v.number(),
  }).index("by_user", ["userId"]),
});
