import "server-only";
import type { AiProvider } from "../../../../server/ai";
import type { ExerciseBrief } from "../generate/brief";
import { buildOpenSystem, buildOpenUser } from "./prompts";

/* The open path: the model designs (picks the interaction) and authors a
   scripted HTML exercise. We deliberately do NOT validate or gate it here —
   per the current direction, the model has full freedom and playability is not
   enforced. We only separate the design rationale from the HTML to render. */

export interface OpenExerciseResult {
  /** The model's phase-1 design rationale (which interaction it chose, why). */
  plan: string;
  /** The authored self-contained HTML fragment to render in the sandbox. */
  html: string;
  /** The raw model output, for debugging. */
  raw: string;
}

/** Pull the ```html block out; everything before it is the design rationale. */
export function extractOpenHtml(raw: string): { plan: string; html: string } {
  const fence = /```(?:html)?\s*([\s\S]*?)```/.exec(raw);
  if (fence) {
    const html = fence[1]!.trim();
    const plan = raw.slice(0, fence.index).trim();
    return { plan, html };
  }
  // No fence — assume the whole thing is HTML if it looks like markup.
  const start = raw.indexOf("<");
  if (start !== -1) return { plan: raw.slice(0, start).trim(), html: raw.slice(start).trim() };
  return { plan: raw.trim(), html: "" };
}

export async function authorOpenExercise(provider: AiProvider, brief: ExerciseBrief): Promise<OpenExerciseResult> {
  const result = await provider.generate({
    system: buildOpenSystem(),
    prompt: buildOpenUser(brief),
    temperature: 0.7,
  });
  const { plan, html } = extractOpenHtml(result.text);
  return { plan, html, raw: result.text };
}
