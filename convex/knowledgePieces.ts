import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { canReadSpace } from "./spaceAccess";
import {getAuthedContext, getAuthenticatedUserId, throwUnauthorized } from "./authDecorators";
import { UNLIMITED_LIMIT } from "../shared/planConfig";

export const getForSpace = query({
  args: { spaceId: v.id("spaces") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject;
    if (!userId) return [];

    const space = await ctx.db.get(args.spaceId);
    if (
      !space ||
      (!canReadSpace(space, userId))
    ) {
      return [];
    }

    return await ctx.db
      .query("knowledgePieces")
      .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
      .collect();
  },
});

export const add = mutation({
  args: {
    spaceId: v.id("spaces"),
    title: v.optional(v.string()),
    content: v.string(),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthedContext(ctx);

    const space = await ctx.db.get(args.spaceId);
    if (space?.userId !== auth.userId) {
      throwUnauthorized("Unauthorized access to this space");
    }

    const existingPieces = await ctx.db
      .query("knowledgePieces")
      .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
      .collect();

    const serverLimit = auth.limits.maxKnowledgePiecesPerSpace;
    const projectedTotal = existingPieces.length + 1;

    if (serverLimit !== UNLIMITED_LIMIT && projectedTotal > serverLimit) {
      throw new Error(
        `Limit reached: You can only have ${serverLimit} knowledge pieces per space on your current plan.`,
      );
    }

    return await ctx.db.insert("knowledgePieces", {
      spaceId: args.spaceId,
      title: args.title,
      content: args.content,
      source: args.source,
    });
  },
});

export const updateTitle = mutation({
  args: {
    id: v.id("knowledgePieces"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);

    const piece = await ctx.db.get(args.id);
    if (!piece) {
      throw new Error(`Knowledge piece not found`);
    }

    const space = await ctx.db.get(piece.spaceId);
    if (space?.userId !== userId) {
      throw new Error("Unauthorized access to this knowledge piece");
    }

    await ctx.db.patch(args.id, { title: args.title });
  },
});

export const bulkImport = mutation({
  args: {
    spaceId: v.id("spaces"),
    pieces: v.array(
      v.object({
        title: v.optional(v.string()),
        content: v.string(),
        source: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthedContext(ctx);

    const space = await ctx.db.get(args.spaceId);
    if (space?.userId !== auth.userId) {
      throwUnauthorized("Unauthorized access to this space");
    }

    const existingPieces = await ctx.db
      .query("knowledgePieces")
      .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
      .collect();

    const serverLimit = auth.limits.maxKnowledgePiecesPerSpace;
    const nonEmptyIncomingCount = args.pieces.filter(
      (piece) => piece.content.trim() !== "",
    ).length;
    const projectedTotal = existingPieces.length + nonEmptyIncomingCount;

    if (serverLimit !== UNLIMITED_LIMIT && projectedTotal > serverLimit) {
      throw new Error(
        `Limit reached: Bulk import would exceed the limit of ${serverLimit} knowledge pieces per space.`,
      );
    }

    const ids = [];
    for (const piece of args.pieces) {
      if (piece.content.trim() === "") continue;
      const id = await ctx.db.insert("knowledgePieces", {
        spaceId: args.spaceId,
        title: piece.title,
        content: piece.content,
        source: piece.source,
      });
      ids.push(id);
    }
    return ids;
  },
});

export const appendContent = mutation({
  args: {
    id: v.id("knowledgePieces"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);

    const piece = await ctx.db.get(args.id);
    if (!piece) {
      throw new Error(`Knowledge piece not found`);
    }

    const space = await ctx.db.get(piece.spaceId);
    if (space?.userId !== userId) {
      throw new Error("Unauthorized access to this knowledge piece");
    }

    await ctx.db.patch(args.id, {
      content: piece.content + "\n\n" + args.content,
    });
  },
});

export const addInternal = internalMutation({
  args: {
    spaceId: v.id("spaces"),
    title: v.optional(v.string()),
    content: v.string(),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("knowledgePieces", {
      spaceId: args.spaceId,
      title: args.title,
      content: args.content,
      source: args.source,
    });
  },
});
