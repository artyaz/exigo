import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { getAuthenticatedUserId } from "./authDecorators";

export const send = mutation({
  args: {
    courseId: v.id("courses"),
    lessonId: v.id("courseLessons"),
    role: v.union(v.literal("teacher"), v.literal("user"), v.literal("system")),
    content: v.string(),
    messageType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const course = await ctx.db.get(args.courseId);
    if (!course || course.userId !== userId) {
      throw new Error("Unauthorized");
    }

    return await ctx.db.insert("courseLessonMessages", {
      courseId: args.courseId,
      lessonId: args.lessonId,
      role: args.role,
      content: args.content,
      messageType: args.messageType,
    });
  },
});

export const getForLesson = query({
  args: { lessonId: v.id("courseLessons") },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) return [];
    const course = await ctx.db.get(lesson.courseId);
    if (!course || course.userId !== userId) return [];

    return await ctx.db
      .query("courseLessonMessages")
      .withIndex("by_lesson", (q) => q.eq("lessonId", args.lessonId))
      .collect();
  },
});

export const sendInternal = internalMutation({
  args: {
    courseId: v.id("courses"),
    lessonId: v.id("courseLessons"),
    role: v.union(v.literal("teacher"), v.literal("user"), v.literal("system")),
    content: v.string(),
    messageType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("courseLessonMessages", {
      courseId: args.courseId,
      lessonId: args.lessonId,
      role: args.role,
      content: args.content,
      messageType: args.messageType,
    });
  },
});

export const getForLessonInternal = internalQuery({
  args: { lessonId: v.id("courseLessons") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("courseLessonMessages")
      .withIndex("by_lesson", (q) => q.eq("lessonId", args.lessonId))
      .collect();
  },
});
