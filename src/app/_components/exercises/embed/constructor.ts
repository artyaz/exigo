import "server-only";
import type { AiProvider } from "../../../../server/ai";
import { buildEmbedSystem, buildEmbedUser } from "./prompts";

/* The free-HTML path: a description goes in, a self-contained HTML body comes
   out. We deliberately do NOT validate, gate, or constrain it — the agent has
   full freedom. We only pull the authored HTML out of the reply. */

export interface EmbedExerciseResult {
  /** The model's PHASE-1 brainstorm: which interaction it chose, and why. */
  plan: string;
  /** The authored self-contained HTML body to render in the sandbox. */
  html: string;
  /** The raw model output, for debugging. */
  raw: string;
}

/** Split the reply into the PHASE-1 plan (prose before the fence) and the
    authored HTML body; tolerate a missing fence. */
export function extractEmbedHtml(raw: string): { plan: string; html: string } {
  const fence = /```(?:html)?\s*([\s\S]*?)```/.exec(raw);
  if (fence) return { plan: raw.slice(0, fence.index).trim(), html: fence[1]!.trim() };
  const start = raw.indexOf("<");
  if (start !== -1) return { plan: raw.slice(0, start).trim(), html: raw.slice(start).trim() };
  return { plan: raw.trim(), html: "" };
}

export async function authorEmbedExercise(provider: AiProvider, description: string): Promise<EmbedExerciseResult> {
  const result = await provider.generate({
    system: buildEmbedSystem(),
    prompt: buildEmbedUser(description),
    temperature: 0.8,
  });
  const { plan, html } = extractEmbedHtml(result.text);
  return { plan, html, raw: result.text };
}
