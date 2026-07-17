import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { getAuthedContext, getAuthenticatedUserId, requireEducatorAccess } from "./authDecorators";
import { MAX_MODULES } from "../shared/courseConfig";

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
    generationInProgress: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { courseId, ...updates } = args;
    const patch: Record<string, unknown> = {};
    if (updates.currentModuleIndex !== undefined) patch.currentModuleIndex = updates.currentModuleIndex;
    if (updates.currentLessonIndex !== undefined) patch.currentLessonIndex = updates.currentLessonIndex;
    if (updates.phase !== undefined) {
      patch.phase = updates.phase;
      // Leaving generation always drops the lock so a failed/partial run cannot stick forever
      // when a later successful structural hop writes phase.
      if (updates.phase !== "module_generation") {
        patch.generationInProgress = false;
      }
    }
    if (updates.generationInProgress !== undefined) {
      patch.generationInProgress = updates.generationInProgress;
    }
    await ctx.db.patch(courseId, patch);
  },
});

/**
 * Atomic claim for module generation (P5-C).
 * Only one concurrent generateModule / advance can hold the lock.
 * Convex OCC retries the loser so it observes generationInProgress === true.
 */
export const claimModuleGeneration = internalMutation({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    const course = await ctx.db.get(args.courseId);
    if (!course) throw new Error("Course not found");

    if (course.phase !== "module_generation") {
      return {
        claimed: false as const,
        reason: "wrong_phase" as const,
        phase: course.phase,
      };
    }
    if (course.generationInProgress === true) {
      return { claimed: false as const, reason: "in_progress" as const };
    }

    const modules = await ctx.db
      .query("courseModules")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();

    if (modules.length >= MAX_MODULES) {
      return { claimed: false as const, reason: "at_cap" as const };
    }

    await ctx.db.patch(args.courseId, { generationInProgress: true });
    return {
      claimed: true as const,
      moduleIndex: modules.length,
    };
  },
});

/** Release generation lock after a failed generateModule (success clears via updateProgress). */
export const releaseModuleGeneration = internalMutation({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    const course = await ctx.db.get(args.courseId);
    if (!course) return;
    if (course.phase === "module_generation" && course.generationInProgress === true) {
      await ctx.db.patch(args.courseId, { generationInProgress: false });
    }
  },
});

export const createCourseFromNormalized = mutation({
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

export const createInternal = internalMutation({
  args: {
    spaceId: v.id("spaces"),
    userId: v.string(),
    rawTopic: v.string(),
    refinedTitle: v.string(),
    courseDescription: v.string(),
  },
  handler: async (ctx, args) => {
    const space = await ctx.db.get(args.spaceId);
    if (!space || space.userId !== args.userId) {
      throw new Error("Unauthorized access to this space");
    }

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

export const getSpaceInternal = internalQuery({
  args: { spaceId: v.id("spaces") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.spaceId);
  },
});
