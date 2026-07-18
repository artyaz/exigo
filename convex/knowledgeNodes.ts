import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { canReadSpace } from "./spaceAccess";
import {getAuthedContext,
  requireEducatorAccess,
  getAuthenticatedUserId, throwUnauthorized } from "./authDecorators";
import { RESOLUTION_THRESHOLD } from "../shared/planConfig";

export const create = mutation({
  args: {
    spaceId: v.id("spaces"),
    knowledgePieceId: v.id("knowledgePieces"),
    type: v.union(
      v.literal("struggle"),
      v.literal("improvement"),
      v.literal("feels_hard"),
    ),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthedContext(ctx);
    requireEducatorAccess(auth);

    const space = await ctx.db.get(args.spaceId);
    if (
      !space ||
      (!canReadSpace(space, auth.userId))
    ) {
      throwUnauthorized("Unauthorized access to this space");
    }

    const knowledgePiece = await ctx.db.get(args.knowledgePieceId);
    if (!knowledgePiece) {
      throw new Error("Knowledge piece not found");
    }
    if (knowledgePiece.spaceId !== args.spaceId) {
      throw new Error("Knowledge piece does not belong to this space");
    }

    return await ctx.db.insert("knowledgeNodes", {
      spaceId: args.spaceId,
      knowledgePieceId: args.knowledgePieceId,
      type: args.type,
      content: args.content,
      resolutionScore: 0,
      isActive: true,
    });
  },
});

export const resolve = mutation({
  args: {
    id: v.id("knowledgeNodes"),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthedContext(ctx);
    requireEducatorAccess(auth);

    const node = await ctx.db.get(args.id);
    if (!node) {
      throw new Error("Knowledge node not found");
    }

    const space = await ctx.db.get(node.spaceId);
    if (
      !space ||
      (!canReadSpace(space, auth.userId))
    ) {
      throw new Error("Unauthorized access to this knowledge node");
    }

    if (!node.isActive) {
      return;
    }

    const newScore = Math.min(100, node.resolutionScore + 30);
    const isActive = newScore < RESOLUTION_THRESHOLD;

    await ctx.db.patch(args.id, {
      resolutionScore: newScore,
      isActive,
    });

    return { newScore, isActive };
  },
});

export const getActiveForPiece = query({
  args: {
    knowledgePieceId: v.id("knowledgePieces"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);

    const piece = await ctx.db.get(args.knowledgePieceId);
    if (!piece) {
      return [];
    }

    const space = await ctx.db.get(piece.spaceId);
    if (
      !space ||
      (!canReadSpace(space, userId))
    ) {
      throw new Error("Unauthorized access to this knowledge piece");
    }

    return await ctx.db
      .query("knowledgeNodes")
      .withIndex("by_piece_active", (q) =>
        q.eq("knowledgePieceId", args.knowledgePieceId).eq("isActive", true),
      )
      .collect();
  },
});

export const createInternal = internalMutation({
  args: {
    spaceId: v.id("spaces"),
    knowledgePieceId: v.id("knowledgePieces"),
    type: v.union(
      v.literal("struggle"),
      v.literal("improvement"),
      v.literal("feels_hard"),
    ),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const knowledgePiece = await ctx.db.get(args.knowledgePieceId);
    if (!knowledgePiece) {
      throw new Error("Knowledge piece not found");
    }
    if (knowledgePiece.spaceId !== args.spaceId) {
      throw new Error("Knowledge piece does not belong to this space");
    }

    return await ctx.db.insert("knowledgeNodes", {
      spaceId: args.spaceId,
      knowledgePieceId: args.knowledgePieceId,
      type: args.type,
      content: args.content,
      resolutionScore: 0,
      isActive: true,
    });
  },
});

export const getActiveForSpace = query({
  args: { spaceId: v.id("spaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const space = await ctx.db.get(args.spaceId);
    if (
      !space ||
      (!canReadSpace(space, userId))
    ) {
      return [];
    }
    return await ctx.db
      .query("knowledgeNodes")
      .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

export const getActiveNodesForSpaceInternal = internalQuery({
  args: {
    spaceId: v.id("spaces"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("knowledgeNodes")
      .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

export const getPieceDataInternal = internalQuery({
  args: {
    knowledgePieceId: v.id("knowledgePieces"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const piece = await ctx.db.get(args.knowledgePieceId);
    if (!piece) return null;
    const space = await ctx.db.get(piece.spaceId);
    if (
      !space ||
      (!canReadSpace(space, args.userId))
    ) {
      return null;
    }
    return piece;
  },
});
