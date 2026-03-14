import { v } from "convex/values";
import { query, internalMutation, internalQuery } from "./_generated/server";
import { getAuthenticatedUserId } from "./authDecorators";

export const createInternal = internalMutation({
  args: {
    courseId: v.id("courses"),
    moduleIndex: v.number(),
    moduleTitle: v.string(),
    adaptationRationale: v.string(),
    subTopics: v.string(),
  },
  handler: async (ctx, args) => {
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
