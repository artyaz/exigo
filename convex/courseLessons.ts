import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { getAuthenticatedUserId, getAuthedContext, requireEducatorAccess } from "./authDecorators";

const LESSON_STATUS = v.union(
  v.literal("pending"),
  v.literal("goals_set"),
  v.literal("teaching"),
  v.literal("completed"),
  v.literal("summarized"),
  v.literal("integrated"),
);

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
    if (!course || course.userId !== userId) return null;
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
    if (!course || course.userId !== userId) return [];

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
    if (!course || course.userId !== userId) return [];

    return await ctx.db
      .query("courseLessons")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();
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
    if (!course || course.userId !== userId) throw new Error("Unauthorized");

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
