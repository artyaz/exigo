import { v } from "convex/values";
import {
  query,
  mutation,
  internalQuery,
  internalMutation,
  internalAction,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { getAuthedContext, getAuthenticatedUserId } from "./authDecorators";

// ─── Chat CRUD ───

export const getChatsForCourse = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    return await ctx.db
      .query("courseTutorChats")
      .withIndex("by_user_course", (q) =>
        q.eq("userId", userId).eq("courseId", args.courseId),
      )
      .order("desc")
      .collect();
  },
});

export const createChat = mutation({
  args: {
    courseId: v.id("courses"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthedContext(ctx);
    const course = await ctx.db.get(args.courseId);
    if (!course || course.userId !== auth.userId) {
      throw new Error("Unauthorized");
    }
    return await ctx.db.insert("courseTutorChats", {
      courseId: args.courseId,
      userId: auth.userId,
      title: args.title,
    });
  },
});

export const deleteChat = mutation({
  args: { chatId: v.id("courseTutorChats") },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const chat = await ctx.db.get(args.chatId);
    if (!chat || chat.userId !== userId) throw new Error("Unauthorized");

    // Delete all messages in the chat
    const messages = await ctx.db
      .query("courseTutorMessages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .collect();
    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }
    await ctx.db.delete(args.chatId);
  },
});

// ─── Messages ───

export const getMessages = query({
  args: { chatId: v.id("courseTutorChats") },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const chat = await ctx.db.get(args.chatId);
    if (!chat || chat.userId !== userId) return [];
    return await ctx.db
      .query("courseTutorMessages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .collect();
  },
});

export const sendMessageInternal = internalMutation({
  args: {
    chatId: v.id("courseTutorChats"),
    role: v.union(
      v.literal("user"),
      v.literal("tutor"),
      v.literal("system"),
    ),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("courseTutorMessages", {
      chatId: args.chatId,
      role: args.role,
      content: args.content,
    });
  },
});

export const sendMessage = mutation({
  args: {
    chatId: v.id("courseTutorChats"),
    role: v.union(
      v.literal("user"),
      v.literal("tutor"),
      v.literal("system"),
    ),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const chat = await ctx.db.get(args.chatId);
    if (!chat || chat.userId !== userId) throw new Error("Unauthorized");
    return await ctx.db.insert("courseTutorMessages", {
      chatId: args.chatId,
      role: args.role,
      content: args.content,
    });
  },
});

// ─── Memories ───

export const getMemoriesForSpace = query({
  args: { spaceId: v.id("spaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    return await ctx.db
      .query("spaceTutorMemories")
      .withIndex("by_space_user", (q) =>
        q.eq("spaceId", args.spaceId).eq("userId", userId),
      )
      .order("desc")
      .take(50);
  },
});

export const addMemoryInternal = internalMutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("spaceTutorMemories", args);
  },
});

export const addMemory = mutation({
  args: {
    spaceId: v.id("spaces"),
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
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const space = await ctx.db.get(args.spaceId);
    if (!space || space.userId !== userId) throw new Error("Unauthorized");
    return await ctx.db.insert("spaceTutorMemories", {
      ...args,
      userId,
    });
  },
});

export const searchMemories = internalAction({
  args: {
    spaceId: v.id("spaces"),
    userId: v.string(),
    embedding: v.array(v.float64()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Array<{
    content: string;
    category: string;
    _score: number;
    _id: Id<"spaceTutorMemories">;
  }>> => {
    const results = await ctx.vectorSearch("spaceTutorMemories", "by_embedding", {
      vector: args.embedding,
      limit: args.limit ?? 10,
      filter: (q) => q.eq("spaceId", args.spaceId),
    });

    // Fetch full documents via a helper query
    const memoriesRaw = await ctx.runQuery(
      internal.courseTutor.getMemoriesByIds,
      { ids: results.map((r: { _id: Id<"spaceTutorMemories"> }) => r._id) },
    );
    const memories = memoriesRaw.filter(
      (m): m is NonNullable<typeof m> => m !== null,
    );
    return memories.map((m, i) => ({
      content: m.content,
      category: m.category,
      _id: m._id,
      _score: results[i]?._score ?? 0,
    }));
  },
});

export const getMemoriesByIds = internalQuery({
  args: { ids: v.array(v.id("spaceTutorMemories")) },
  handler: async (ctx, args) => {
    const docs = await Promise.all(args.ids.map((id) => ctx.db.get(id)));
    return docs.filter(Boolean);
  },
});

// ─── Internal helpers for context assembly ───

export const getCourseContextInternal = internalQuery({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    const course = await ctx.db.get(args.courseId);
    if (!course) return null;

    const modules = await ctx.db
      .query("courseModules")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();

    const lessons = await ctx.db
      .query("courseLessons")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();

    return { course, modules, lessons };
  },
});

export const getRecentChatHistory = internalQuery({
  args: {
    chatId: v.id("courseTutorChats"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("courseTutorMessages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .order("desc")
      .take(args.limit ?? 20);
    return messages.reverse();
  },
});
