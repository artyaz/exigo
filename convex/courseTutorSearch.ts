import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { getAuthedContextForAction } from "./authDecorators";
import { canReadSpace } from "./spaceAccess";

type MemoryHit = {
  content: string;
  category: string;
  _score: number;
  _id: Id<"spaceTutorMemories">;
};

/**
 * Authenticated memory search for Next tutor routes (F-W7-013 / P12-C).
 * Uses Convex vector index instead of O(n) cosine in the request path.
 */
export const searchMemoriesForSpace = action({
  args: {
    spaceId: v.id("spaces"),
    embedding: v.array(v.float64()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<MemoryHit[]> => {
    const auth = await getAuthedContextForAction(ctx);
    const space = await ctx.runQuery(internal.courses.getSpaceInternal, {
      spaceId: args.spaceId,
    });
    if (!space || !canReadSpace(space, auth.userId)) {
      throw new Error("Unauthorized");
    }
    return await ctx.runAction(internal.courseTutor.searchMemories, {
      spaceId: args.spaceId,
      userId: auth.userId,
      embedding: args.embedding,
      limit: args.limit ?? 5,
    });
  },
});
