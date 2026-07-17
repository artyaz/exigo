import { v } from "convex/values";
import { query, internalMutation, internalQuery } from "./_generated/server";
import { getAuthenticatedUserId } from "./authDecorators";

/**
 * Single insert path for course modules. Guards (P5-C):
 * - course must be in module_generation with generationInProgress claimed
 * - moduleIndex must equal current module count (no double-insert / skip)
 */
export const createInternal = internalMutation({
  args: {
    courseId: v.id("courses"),
    moduleIndex: v.number(),
    moduleTitle: v.string(),
    adaptationRationale: v.string(),
    subTopics: v.string(),
  },
  handler: async (ctx, args) => {
    const course = await ctx.db.get(args.courseId);
    if (!course) throw new Error("Course not found");
    if (course.phase !== "module_generation") {
      throw new Error(
        `Cannot create module while course phase is "${course.phase}" (expected "module_generation")`,
      );
    }
    if (course.generationInProgress !== true) {
      throw new Error("Cannot create module without an active generation claim");
    }

    const existing = await ctx.db
      .query("courseModules")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();

    if (existing.length !== args.moduleIndex) {
      throw new Error(
        `Module index conflict: expected next index ${existing.length}, got ${args.moduleIndex}`,
      );
    }
    if (existing.some((m) => m.moduleIndex === args.moduleIndex)) {
      throw new Error(`Module already exists at index ${args.moduleIndex}`);
    }

    return await ctx.db.insert("courseModules", args);
  },
});

export const getForCourse = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const course = await ctx.db.get(args.courseId);
    if (!course || course.userId !== userId) return [];

    return await ctx.db
      .query("courseModules")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();
  },
});

export const get = query({
  args: { moduleId: v.id("courseModules") },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const mod = await ctx.db.get(args.moduleId);
    if (!mod) return null;
    const course = await ctx.db.get(mod.courseId);
    if (!course || course.userId !== userId) return null;
    return mod;
  },
});

export const getInternal = internalQuery({
  args: { moduleId: v.id("courseModules") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.moduleId);
  },
});

export const getForCourseInternal = internalQuery({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("courseModules")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();
  },
});
