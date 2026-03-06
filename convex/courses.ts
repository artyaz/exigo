import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { getAuthedContext, getAuthenticatedUserId, requireEducatorAccess } from "./authDecorators";

const COURSE_PHASE = v.union(
  v.literal("baseline"),
  v.literal("module_generation"),
  v.literal("lesson"),
  v.literal("lesson_summary"),
  v.literal("module_complete"),
  v.literal("completed"),
);

export const create = mutation({
  args: {
    spaceId: v.id("spaces"),
    rawTopic: v.string(),
    refinedTitle: v.string(),
    courseDescription: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthedContext(ctx);
    requireEducatorAccess(auth);

    const space = await ctx.db.get(args.spaceId);
    if (!space || space.userId !== auth.userId) {
      throw new Error("Unauthorized access to this space");
    }

    return await ctx.db.insert("courses", {
      spaceId: args.spaceId,
      userId: auth.userId,
      rawTopic: args.rawTopic,
      refinedTitle: args.refinedTitle,
      courseDescription: args.courseDescription,
      phase: "baseline",
      currentModuleIndex: 0,
      currentLessonIndex: 0,
    });
  },
});

export const get = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const course = await ctx.db.get(args.courseId);
    if (!course || course.userId !== userId) return null;
    return course;
  },
});

export const getForSpace = query({
  args: { spaceId: v.id("spaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const space = await ctx.db.get(args.spaceId);
    if (!space || space.userId !== userId) return [];

    return await ctx.db
      .query("courses")
      .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
      .collect();
  },
});

export const updatePhase = mutation({
  args: {
    courseId: v.id("courses"),
    phase: COURSE_PHASE,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const course = await ctx.db.get(args.courseId);
    if (!course || course.userId !== userId) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(args.courseId, { phase: args.phase });
  },
});

export const updatePhaseInternal = internalMutation({
  args: {
    courseId: v.id("courses"),
    phase: COURSE_PHASE,
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.courseId, { phase: args.phase });
  },
});

export const updateBaseline = mutation({
  args: {
    courseId: v.id("courses"),
    baselineResults: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const course = await ctx.db.get(args.courseId);
    if (!course || course.userId !== userId) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(args.courseId, { baselineResults: args.baselineResults });
  },
});

export const updateProgress = internalMutation({
  args: {
    courseId: v.id("courses"),
    currentModuleIndex: v.optional(v.number()),
    currentLessonIndex: v.optional(v.number()),
    phase: v.optional(COURSE_PHASE),
  },
  handler: async (ctx, args) => {
    const { courseId, ...updates } = args;
    const patch: Record<string, unknown> = {};
    if (updates.currentModuleIndex !== undefined) patch.currentModuleIndex = updates.currentModuleIndex;
    if (updates.currentLessonIndex !== undefined) patch.currentLessonIndex = updates.currentLessonIndex;
    if (updates.phase !== undefined) patch.phase = updates.phase;
    await ctx.db.patch(courseId, patch);
  },
});

export const createInternal = internalMutation({
  args: {
    spaceId: v.id("spaces"),
    userId: v.string(),
    rawTopic: v.string(),
    refinedTitle: v.string(),
    courseDescription: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("courses", {
      spaceId: args.spaceId,
      userId: args.userId,
      rawTopic: args.rawTopic,
      refinedTitle: args.refinedTitle,
      courseDescription: args.courseDescription,
      phase: "baseline" as const,
      currentModuleIndex: 0,
      currentLessonIndex: 0,
    });
  },
});

export const getInternal = internalQuery({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.courseId);
  },
});
