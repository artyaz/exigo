import "server-only";
import { GoogleGenAI } from "@google/genai";

/**
 * Shared env Gemini helpers for product Next routes that still construct
 * GoogleGenAI directly (F-W7-011). Prefer resolveAiProvider when BYOK/settings
 * apply; use these only for the default-env path until F-W7-002 lands fully.
 */
export function getEnvGeminiClient(): GoogleGenAI {
  if (!process.env.GOOGLE_GEMINI_API_KEY) {
    throw new Error("GOOGLE_GEMINI_API_KEY not set");
  }
  return new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });
}

export function getEnvGeminiModel(): string {
  return process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";
}
