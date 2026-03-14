import { v } from "convex/values";
import { internalQuery, query } from "./_generated/server";

/**
 * Prompt Utilities for Adaptive Course Generation.
 * Prompts are now stored in the database to allow for easy updating without deploying code.
 */

export const getPromptInternal = internalQuery({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const prompt = await ctx.db
      .query("prompts")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    if (!prompt) {
      throw new Error(`Prompt missing from database: ${args.name}`);
    }

    return prompt;
  },
});

/**
 * Replace placeholders like {{variable}} with values from the variables object.
 */
export function renderPrompt(
  template: string,
  variables: Record<string, string | number | boolean>,
): string {
  let rendered = template;
  for (const [key, value] of Object.entries(variables)) {
    // Replace all occurrences of {{key}} with the value stringified
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    rendered = rendered.replace(regex, String(value));
  }
  return rendered;
}

/**
 * Public query for fetching prompts from Next.js API routes via ConvexHttpClient.
 */
export const getPrompt = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const prompt = await ctx.db
      .query("prompts")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    if (!prompt) {
      throw new Error(`Prompt missing from database: ${args.name}`);
    }

    return prompt;
  },
});
