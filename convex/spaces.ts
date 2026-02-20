import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
    args: {},
    handler: async (ctx) => {
        // In a real app we would filter by userId, but for now we list all
        return await ctx.db.query("spaces").collect();
    },
});

export const get = query({
    args: { spaceId: v.id("spaces") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.spaceId);
    },
});

export const create = mutation({
    args: { name: v.string() },
    handler: async (ctx, args) => {
        // Hardcoded userId for simplicity if no auth is configured yet.
        return await ctx.db.insert("spaces", { name: args.name, userId: "default_user" });
    },
});
