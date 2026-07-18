import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import {getAuthedContext, throwUnauthorized } from "./authDecorators";
import { assertServerMutationSecret } from "./serverMutationSecret";

type LessonMessageRole = "teacher" | "user" | "system";

async function assertLessonOwner(
  ctx: MutationCtx,
  lessonId: Id<"courseLessons">,
) {
  const { userId } = await getAuthedContext(ctx);
  const lesson = await ctx.db.get(lessonId);
  if (!lesson) {
    throw new Error("Lesson not found");
  }
  const course = await ctx.db.get(lesson.courseId);
  if (!course || course.userId !== userId) {
    throwUnauthorized();
  }
  return lesson;
}

async function insertLessonMessage(
  ctx: MutationCtx,
  args: {
    courseId: Id<"courses">;
    lessonId: Id<"courseLessons">;
    role: LessonMessageRole;
    content: string;
    messageType?: string;
    clarificationQuote?: string;
    threadId?: string;
    clarificationBlockIndex?: number;
    clarificationSectionIndex?: number;
  },
) {
  return await ctx.db.insert("courseLessonMessages", {
    courseId: args.courseId,
    lessonId: args.lessonId,
    role: args.role,
    content: args.content,
    messageType: args.messageType,
    clarificationQuote: args.clarificationQuote,
    threadId: args.threadId,
    clarificationBlockIndex: args.clarificationBlockIndex,
    clarificationSectionIndex: args.clarificationSectionIndex,
  });
}

/** Public: always inserts role "user". Clients cannot choose role. */
export const send = mutation({
  args: {
    lessonId: v.id("courseLessons"),
    content: v.string(),
    messageType: v.optional(v.string()),
    clarificationQuote: v.optional(v.string()),
    threadId: v.optional(v.string()),
    clarificationBlockIndex: v.optional(v.number()),
    clarificationSectionIndex: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const lesson = await assertLessonOwner(ctx, args.lessonId);
    return await insertLessonMessage(ctx, {
      courseId: lesson.courseId,
      lessonId: args.lessonId,
      role: "user",
      content: args.content,
      messageType: args.messageType,
      clarificationQuote: args.clarificationQuote,
      threadId: args.threadId,
      clarificationBlockIndex: args.clarificationBlockIndex,
      clarificationSectionIndex: args.clarificationSectionIndex,
    });
  },
});

/**
 * Teacher-role write for Next.js AI routes only.
 * Requires EXIGO_SERVER_MUTATION_SECRET so browser clients cannot forge teacher turns.
 */
export const sendTeacher = mutation({
  args: {
    lessonId: v.id("courseLessons"),
    content: v.string(),
    serverSecret: v.string(),
    messageType: v.optional(v.string()),
    clarificationQuote: v.optional(v.string()),
    threadId: v.optional(v.string()),
    clarificationBlockIndex: v.optional(v.number()),
    clarificationSectionIndex: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertServerMutationSecret(args.serverSecret);
    const lesson = await assertLessonOwner(ctx, args.lessonId);
    return await insertLessonMessage(ctx, {
      courseId: lesson.courseId,
      lessonId: args.lessonId,
      role: "teacher",
      content: args.content,
      messageType: args.messageType,
      clarificationQuote: args.clarificationQuote,
      threadId: args.threadId,
      clarificationBlockIndex: args.clarificationBlockIndex,
      clarificationSectionIndex: args.clarificationSectionIndex,
    });
  },
});

export const getForLesson = query({
  args: { lessonId: v.id("courseLessons") },
  handler: async (ctx, args) => {
    const { userId } = await getAuthedContext(ctx);
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
    clarificationQuote: v.optional(v.string()),
    threadId: v.optional(v.string()),
    clarificationBlockIndex: v.optional(v.number()),
    clarificationSectionIndex: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await insertLessonMessage(ctx, args);
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
