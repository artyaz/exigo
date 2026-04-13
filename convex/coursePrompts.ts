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

/** Maximum length for user-provided prompt variables to prevent abuse. */
const MAX_VARIABLE_LENGTH = 10_000;

/**
 * Sanitize a user-provided value before inserting into a prompt template.
 * Wraps the value in delimiters to reduce prompt injection risk and truncates
 * excessively long inputs.
 */
function sanitizePromptVariable(value: string | number | boolean, key: string): string {
  const str = String(value);
  if (typeof value === "number" || typeof value === "boolean") {
    return str;
  }
  // Truncate excessively long inputs
  const truncated = str.length > MAX_VARIABLE_LENGTH
    ? str.slice(0, MAX_VARIABLE_LENGTH) + "\n[...truncated]"
    : str;
  // Wrap user-provided text in delimiters to make injection boundaries clear
  // Skip wrapping for keys that are system-generated context (not raw user input)
  const systemKeys = new Set(["history", "context", "chatHistory", "existingMemories", "masteryArray", "lessonContext", "courseContext", "knowledgeNodes", "relevantMemories", "currentLessonContext", "currentModuleContext"]);
  if (systemKeys.has(key)) {
    return truncated;
  }
  return `<user_input>\n${truncated}\n</user_input>`;
}

/**
 * Replace placeholders like {{variable}} with values from the variables object.
 * User-provided values are sanitized to reduce prompt injection risk.
 */
export function renderPrompt(
  template: string,
  variables: Record<string, string | number | boolean>,
): string {
  let rendered = template;
  for (const [key, value] of Object.entries(variables)) {
    const sanitized = sanitizePromptVariable(value, key);
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    rendered = rendered.replace(regex, sanitized);
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
