"use server";

import { auth } from "@clerk/nextjs/server";
import { makeFunctionReference } from "convex/server";
import { createAuthedConvexClient } from "../../lib/convexClientAuth";
import { encryptSecret } from "../../server/ai/secrets";

/* Server actions for per-user AI provider settings. The custom API key is
   encrypted here (Node crypto) and only the opaque ciphertext is sent to
   Convex — the symmetric secret never leaves the Next.js server. We address
   the Convex functions by string so this compiles independently of the
   currently-stale `convex codegen` (see note in resolve.ts).
   Clerk auth() gates the action and supplies the JWT; Convex re-derives
   identity from that token (userId is not passed as an arg). */

interface MineView {
  provider: "gemini" | "openai";
  model: string | null;
  baseUrl: string | null;
  hasCustomKey: boolean;
  updatedAt: number;
}

const getMineRef = makeFunctionReference<"query", Record<string, never>, MineView | null>("userSettings:getMine");

const saveRef = makeFunctionReference<
  "mutation",
  {
    provider: "gemini" | "openai";
    model?: string;
    baseUrl?: string;
    keyCipher?: string;
    keyIv?: string;
    clearKey?: boolean;
  },
  string
>("userSettings:save");

export type AiSettingsView = MineView | null;

export async function getAiSettings(): Promise<AiSettingsView> {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const convex = await createAuthedConvexClient(getToken, "actions.aiSettings.getAiSettings");
  return await convex.query(getMineRef, {});
}

export interface SaveAiSettingsInput {
  provider: "gemini" | "openai";
  model?: string;
  baseUrl?: string;
  /** Plaintext key — encrypted server-side before it touches Convex. */
  apiKey?: string;
  /** Remove the stored key (e.g. switching back to the default provider). */
  clearKey?: boolean;
}

export async function saveAiSettings(input: SaveAiSettingsInput): Promise<{ ok: true }> {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const convex = await createAuthedConvexClient(getToken, "actions.aiSettings.saveAiSettings");

  let keyCipher: string | undefined;
  let keyIv: string | undefined;
  const trimmedKey = input.apiKey?.trim();
  if (trimmedKey) {
    const enc = encryptSecret(trimmedKey);
    keyCipher = enc.cipher;
    keyIv = enc.iv;
  }

  await convex.mutation(saveRef, {
    provider: input.provider,
    model: clean(input.model),
    baseUrl: clean(input.baseUrl),
    keyCipher,
    keyIv,
    clearKey: input.clearKey,
  });
  return { ok: true };
}

/** Trim, and treat an empty string as "not provided" (undefined). */
function clean(s?: string): string | undefined {
  const t = s?.trim();
  if (!t) return undefined;
  return t;
}
