import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/* Per-user AI provider settings. The Next.js server (which has the Clerk
   identity) passes `userId`, matching the convention used across the other
   Convex functions in this app. The custom API key is only ever handled as
   opaque ciphertext here — encryption/decryption happens in the Next.js
   server (src/server/ai/secrets.ts), so a Convex data leak exposes no key. */

const PROVIDER = v.union(v.literal("gemini"), v.literal("openai"));

/** Client-safe view: never returns the key, only whether one is set. */
export const getMine = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const row = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!row) return null;
    return {
      provider: row.provider,
      model: row.model ?? null,
      baseUrl: row.baseUrl ?? null,
      hasCustomKey: Boolean(row.keyCipher && row.keyIv),
      updatedAt: row.updatedAt,
    };
  },
});

/** Server-side view used by the AI router: returns the opaque cipher so the
    Next.js server can decrypt it. The cipher is useless without the server
    secret, so this is safe to expose to an authenticated caller. */
export const getCipher = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const row = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!row) return null;
    return {
      provider: row.provider,
      model: row.model ?? null,
      baseUrl: row.baseUrl ?? null,
      keyCipher: row.keyCipher ?? null,
      keyIv: row.keyIv ?? null,
    };
  },
});

/** Upsert settings. The key arrives already encrypted from the Next.js
    server. `clearKey` removes a stored key (e.g. switching back to Gemini). */
export const save = mutation({
  args: {
    userId: v.string(),
    provider: PROVIDER,
    model: v.optional(v.string()),
    baseUrl: v.optional(v.string()),
    keyCipher: v.optional(v.string()),
    keyIv: v.optional(v.string()),
    clearKey: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    const patch: {
      provider: "gemini" | "openai";
      model?: string;
      baseUrl?: string;
      keyCipher?: string;
      keyIv?: string;
      updatedAt: number;
    } = {
      provider: args.provider,
      model: args.model,
      baseUrl: args.baseUrl,
      updatedAt: Date.now(),
    };
    if (args.clearKey) {
      patch.keyCipher = undefined;
      patch.keyIv = undefined;
    } else if (args.keyCipher && args.keyIv) {
      patch.keyCipher = args.keyCipher;
      patch.keyIv = args.keyIv;
    } else if (existing) {
      // No new key supplied — keep whatever was there.
      patch.keyCipher = existing.keyCipher;
      patch.keyIv = existing.keyIv;
    }

    if (existing) {
      await ctx.db.replace(existing._id, { userId: args.userId, ...patch });
      return existing._id;
    }
    return await ctx.db.insert("userSettings", { userId: args.userId, ...patch });
  },
});
