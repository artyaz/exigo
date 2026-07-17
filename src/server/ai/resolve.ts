import "server-only";
import { makeFunctionReference } from "convex/server";
import type { ConvexHttpClient } from "convex/browser";
import type { AiProvider, AiProviderConfig } from "./types";
import { GeminiProvider } from "./gemini";
import { OpenAiProvider } from "./openai";
import { decryptSecret } from "./secrets";

/* The single routing decision: given an authed Convex client, return the
   AiProvider to use. Default is the app's Google Gemini key; a user who
   configured a custom OpenAI-compatible endpoint gets that instead.
   Identity comes from the client's JWT — userId is not passed as an arg.
   Settings live in Convex; we reference the function by string
   (makeFunctionReference) so this compiles independently of `convex codegen`. */

interface CipherSettings {
  provider: "gemini" | "openai";
  model: string | null;
  baseUrl: string | null;
  keyCipher: string | null;
  keyIv: string | null;
}

const getCipherRef = makeFunctionReference<"query", Record<string, never>, CipherSettings | null>(
  "userSettings:getCipher",
);

const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";

/** The app default: Google Gemini with the server key. */
export function defaultGeminiProvider(model?: string): AiProvider {
  return new GeminiProvider({
    kind: "gemini",
    model: model ?? DEFAULT_GEMINI_MODEL,
    apiKey: process.env.GOOGLE_GEMINI_API_KEY ?? "",
    label: "google",
  });
}

/** Resolve the provider for the authenticated user, honouring their saved
    preference and falling back to the default Gemini provider on any gap. */
export async function resolveAiProvider(convex: ConvexHttpClient): Promise<AiProvider> {
  let settings: CipherSettings | null = null;
  try {
    settings = await convex.query(getCipherRef, {});
  } catch {
    // Settings table/function not deployed yet, or transient — use the default.
    return defaultGeminiProvider();
  }

  if (!settings || settings.provider === "gemini") {
    return defaultGeminiProvider(settings?.model ?? undefined);
  }

  // Custom OpenAI-compatible endpoint.
  if (settings.keyCipher && settings.keyIv) {
    try {
      const apiKey = decryptSecret({ cipher: settings.keyCipher, iv: settings.keyIv });
      const config: AiProviderConfig = {
        kind: "openai",
        model: settings.model ?? "gpt-4o-mini",
        apiKey,
        baseUrl: settings.baseUrl ?? undefined,
        label: "openai",
      };
      return new OpenAiProvider(config);
    } catch {
      // Decryption failed (rotated/missing secret) — don't silently send to
      // a misconfigured endpoint; fall back to the safe default.
      return defaultGeminiProvider();
    }
  }
  return defaultGeminiProvider();
}
