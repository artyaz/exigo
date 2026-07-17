import { v } from "convex/values";
import { getAuthenticatedUserId } from "./authDecorators";
import { internalQuery, query } from "./_generated/server";

/**
 * Prompt Utilities for Adaptive Course Generation.
 * Prompts are now stored in the database to allow for easy updating without deploying code.
 */

/** Trusted Convex backends (actions) only — no client JWT. */
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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replace placeholders like {{variable}} with values from the variables object.
 * Uses a single-pass regex with a function replacement so that:
 *   - keys containing regex metacharacters are safe
 *   - replacement values containing `$` are not interpreted as backreferences
 *   - replacements cannot leak across keys (values never get re-matched)
 * User-provided values are sanitized via sanitizePromptVariable.
 */
export function renderPrompt(
  template: string,
  variables: Record<string, string | number | boolean>,
): string {
  const keys = Object.keys(variables);
  if (keys.length === 0) return template;
  const alternation = keys.map(escapeRegex).join("|");
  const regex = new RegExp(`\\{\\{(${alternation})\\}\\}`, "g");
  return template.replace(regex, (_match, key: string) =>
    sanitizePromptVariable(variables[key]!, key),
  );
}

/**
 * Authenticated query for Next.js API routes via user-JWT ConvexHttpClient.
 * Anonymous clients cannot enumerate / exfiltrate system prompts.
 */
export const getPrompt = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    await getAuthenticatedUserId(ctx);

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
