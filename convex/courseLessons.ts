import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { getAuthenticatedUserId, getAuthedContext, requireEducatorAccess } from "./authDecorators";
import {
  getCurrentLessonIndexAfterInsertion,
  planCurrentModuleLessonInsertion,
} from "../shared/currentModuleInsertion";

const LESSON_STATUS = v.union(
  v.literal("pending"),
  v.literal("goals_set"),
  v.literal("teaching"),
  v.literal("completed"),
  v.literal("summarized"),
  v.literal("integrated"),
);

const LESSON_INSERT_PLACEMENT = v.union(
  v.literal("after_current_lesson"),
  v.literal("before_lesson"),
  v.literal("after_lesson"),
  v.literal("end_of_module"),
);

const CHECKPOINT_STATUS = v.union(
  v.literal("pending"),
  v.literal("answered"),
  v.literal("skipped"),
);

const CHECKPOINT_VERIFICATION = v.object({
  is_correct: v.boolean(),
  feedback_block: v.string(),
});

const CHECKPOINT_STATE = v.object({
  sectionIndex: v.number(),
  question: v.string(),
  status: CHECKPOINT_STATUS,
  answer: v.optional(v.string()),
  verification: v.optional(CHECKPOINT_VERIFICATION),
});

type LessonCheckpointState = {
  sectionIndex: number;
  question: string;
  status: "pending" | "answered" | "skipped";
  answer?: string;
  verification?: {
    is_correct: boolean;
    feedback_block: string;
  };
};

function mergeCheckpointStates(
  existingStates: LessonCheckpointState[] | undefined,
  nextState: LessonCheckpointState,
) {
  return [...(existingStates ?? []).filter((state) => state.sectionIndex !== nextState.sectionIndex), nextState]
    .sort((left, right) => left.sectionIndex - right.sectionIndex);
}

export const createInternal = internalMutation({
  args: {
    courseId: v.id("courses"),
    moduleId: v.id("courseModules"),
    lessonIndex: v.number(),
    title: v.string(),
    focusArea: v.string(),
    targetsWeakness: v.boolean(),
    status: LESSON_STATUS,
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("courseLessons", args);
  },
});

export const get = query({
  args: { lessonId: v.id("courseLessons") },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) return null;
    const course = await ctx.db.get(lesson.courseId);
    if (course?.userId !== userId) return null;
    return lesson;
  },
});

export const getForModule = query({
  args: { moduleId: v.id("courseModules") },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const mod = await ctx.db.get(args.moduleId);
    if (!mod) return [];
    const course = await ctx.db.get(mod.courseId);
    if (course?.userId !== userId) return [];

    return await ctx.db
      .query("courseLessons")
      .withIndex("by_module", (q) => q.eq("moduleId", args.moduleId))
      .collect();
  },
});

export const getForCourse = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const course = await ctx.db.get(args.courseId);
    if (course?.userId !== userId) return [];

    return await ctx.db
      .query("courseLessons")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();
  },
});

export const insertIntoCurrentModule = mutation({
  args: {
    courseId: v.id("courses"),
    title: v.string(),
    focusArea: v.string(),
    placement: v.optional(LESSON_INSERT_PLACEMENT),
    referenceLessonTitle: v.optional(v.string()),
    targetsWeakness: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthedContext(ctx);
    requireEducatorAccess(auth);

    const course = await ctx.db.get(args.courseId);
    if (course?.userId !== auth.userId) {
      throw new Error("Unauthorized");
    }

    if (course.phase !== "lesson" && course.phase !== "lesson_summary") {
      throw new Error(
        "A topic can only be inserted while you are actively working through a module.",
      );
    }

    const modules = await ctx.db
      .query("courseModules")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();
    const currentModule = modules.find(
      (module) => module.moduleIndex === course.currentModuleIndex,
    );
    if (!currentModule) {
      throw new Error("Current module not found.");
    }

    const sortedLessons = (
      await ctx.db
        .query("courseLessons")
        .withIndex("by_module", (q) => q.eq("moduleId", currentModule._id))
        .collect()
    ).sort((left, right) => left.lessonIndex - right.lessonIndex);

    const title = args.title.trim();
    if (!title) {
      throw new Error("Topic title is required.");
    }

    const normalizedTitle = title.toLowerCase().replace(/\s+/g, " ").trim();
    const duplicateLesson = sortedLessons.find(
      (lesson) =>
        lesson.title.toLowerCase().replace(/\s+/g, " ").trim() ===
        normalizedTitle,
    );
    if (duplicateLesson) {
      throw new Error(
        `The current module already has a lesson titled "${duplicateLesson.title}".`,
      );
    }

    const focusArea = args.focusArea.trim() || `Learn ${title}`;
    const targetsWeakness = args.targetsWeakness === true;
    const insertionPlan = planCurrentModuleLessonInsertion({
      lessons: sortedLessons.map((lesson) => ({
        lessonIndex: lesson.lessonIndex,
        title: lesson.title,
      })),
      currentLessonIndex: course.currentLessonIndex,
      placement: args.placement,
      referenceLessonTitle: args.referenceLessonTitle,
    });

    const lessonsToShift = sortedLessons
      .filter((lesson) => lesson.lessonIndex >= insertionPlan.insertIndex)
      .sort((left, right) => right.lessonIndex - left.lessonIndex);

    for (const lesson of lessonsToShift) {
      await ctx.db.patch(lesson._id, {
        lessonIndex: lesson.lessonIndex + 1,
      });
    }

    const lessonId = await ctx.db.insert("courseLessons", {
      courseId: args.courseId,
      moduleId: currentModule._id,
      lessonIndex: insertionPlan.insertIndex,
      title,
      focusArea,
      targetsWeakness,
      status: "pending",
    });

    const updatedSubTopics = sortedLessons.map((lesson) => ({
      title: lesson.title,
      focus_area: lesson.focusArea,
      targets_weakness: lesson.targetsWeakness,
    }));
    updatedSubTopics.splice(insertionPlan.insertIndex, 0, {
      title,
      focus_area: focusArea,
      targets_weakness: targetsWeakness,
    });

    await ctx.db.patch(currentModule._id, {
      subTopics: JSON.stringify(updatedSubTopics),
    });

    await ctx.db.patch(args.courseId, {
      currentLessonIndex: getCurrentLessonIndexAfterInsertion(
        course.currentLessonIndex,
        insertionPlan.insertIndex,
      ),
    });

    return {
      lessonId,
      moduleId: currentModule._id,
      moduleTitle: currentModule.moduleTitle,
      insertedLessonIndex: insertionPlan.insertIndex,
      placementSummary: insertionPlan.summary,
    };
  },
});

export const updateStatusInternal = internalMutation({
  args: {
    lessonId: v.id("courseLessons"),
    status: LESSON_STATUS,
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.lessonId, { status: args.status });
  },
});

export const updateMasteryGoalsInternal = internalMutation({
  args: {
    lessonId: v.id("courseLessons"),
    masteryGoals: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.lessonId, {
      masteryGoals: args.masteryGoals,
      status: "goals_set",
    });
  },
});

export const updateVerifierLogsInternal = internalMutation({
  args: {
    lessonId: v.id("courseLessons"),
    verifierLogs: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.lessonId, { verifierLogs: args.verifierLogs });
  },
});

export const saveCheckpointState = mutation({
  args: {
    lessonId: v.id("courseLessons"),
    checkpointState: CHECKPOINT_STATE,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) throw new Error("Lesson not found");

    const course = await ctx.db.get(lesson.courseId);
    if (course?.userId !== userId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.lessonId, {
      checkpointStates: mergeCheckpointStates(lesson.checkpointStates, args.checkpointState),
    });
  },
});

export const saveCheckpointStateInternal = internalMutation({
  args: {
    lessonId: v.id("courseLessons"),
    checkpointState: CHECKPOINT_STATE,
  },
  handler: async (ctx, args) => {
    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) throw new Error("Lesson not found");

    await ctx.db.patch(args.lessonId, {
      checkpointStates: mergeCheckpointStates(lesson.checkpointStates, args.checkpointState),
    });
  },
});

export const updateSummaryInternal = internalMutation({
  args: {
    lessonId: v.id("courseLessons"),
    summaryMarkdown: v.string(),
    status: LESSON_STATUS,
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.lessonId, {
      summaryMarkdown: args.summaryMarkdown,
      status: args.status,
    });
  },
});

export const setKnowledgePieceIdInternal = internalMutation({
  args: {
    lessonId: v.id("courseLessons"),
    knowledgePieceId: v.id("knowledgePieces"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.lessonId, {
      knowledgePieceId: args.knowledgePieceId,
    });
  },
});

export const markCompleted = mutation({
  args: { lessonId: v.id("courseLessons") },
  handler: async (ctx, args) => {
    const auth = await getAuthedContext(ctx);
    requireEducatorAccess(auth);

    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) throw new Error("Lesson not found");

    await ctx.db.patch(args.lessonId, { status: "completed" });
  },
});

export const getInternal = internalQuery({
  args: { lessonId: v.id("courseLessons") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.lessonId);
  },
});

export const addPendingFeelsHard = mutation({
  args: {
    lessonId: v.id("courseLessons"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) throw new Error("Lesson not found");
    const course = await ctx.db.get(lesson.courseId);
    if (course?.userId !== userId) throw new Error("Unauthorized");

    const existing = lesson.pendingFeelsHardNodes ?? [];
    await ctx.db.patch(args.lessonId, {
      pendingFeelsHardNodes: [...existing, args.content],
    });
  },
});

export const clearPendingFeelsHardInternal = internalMutation({
  args: { lessonId: v.id("courseLessons") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.lessonId, { pendingFeelsHardNodes: [] });
  },
});

export const getForModuleInternal = internalQuery({
  args: { moduleId: v.id("courseModules") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("courseLessons")
      .withIndex("by_module", (q) => q.eq("moduleId", args.moduleId))
      .collect();
  },
});
