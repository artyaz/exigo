import "server-only";
import type { AiProvider } from "../../../../server/ai";
import { buildLessonSystem, buildLessonUser } from "./prompts";
import { lessonDraftSchema, type LessonDraft, type ExerciseBrief } from "./brief";
import { constructExercise, type ConstructionResult } from "./constructor";

/* Full pipeline: a smart model drafts a lesson with one inline brief per step,
   then the constructor realises each brief. Intent (taste) is separated from
   construction (mechanics) — exactly as a real lesson-generation flow would. */

export interface LessonDraftResult {
  draft?: LessonDraft;
  raw: string;
  error?: string;
}

/** Pull a JSON object out of a model reply. Endpoints routinely ignore
    json-mode and wrap the object in ```json fences or surrounding prose — so we
    never trust the reply to be clean JSON, exactly as the markup path never
    trusts the reply to be bare markup. */
export function extractJson(raw: string): string {
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(raw);
  const body = fence ? fence[1]! : raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) return body.slice(start, end + 1);
  return body.trim();
}

/** Reconcile the natural field-name variants a smart model reaches for with the
    brief schema (e.g. `stageArchetype` → `archetype`) before validation. */
export function normalizeDraftJson(json: unknown): unknown {
  if (!json || typeof json !== "object") return json;
  const steps = (json as { steps?: unknown }).steps;
  if (!Array.isArray(steps)) return json;
  for (const step of steps) {
    const brief = (step as { brief?: Record<string, unknown> } | null)?.brief;
    if (brief && typeof brief === "object" && brief.stageArchetype != null && brief.archetype == null) {
      brief.archetype = brief.stageArchetype;
      delete brief.stageArchetype;
    }
  }
  return json;
}

export async function draftLesson(provider: AiProvider, topic: string): Promise<LessonDraftResult> {
  const system = buildLessonSystem();
  const result = await provider.generate({ system, prompt: buildLessonUser(topic), json: true, temperature: 0.6 });
  try {
    const json = normalizeDraftJson(JSON.parse(extractJson(result.text)) as unknown);
    const parsed = lessonDraftSchema.safeParse(json);
    if (!parsed.success) return { raw: result.text, error: parsed.error.message };
    return { draft: parsed.data, raw: result.text };
  } catch (e) {
    return { raw: result.text, error: e instanceof Error ? e.message : "Could not parse lesson JSON" };
  }
}

export interface ConstructedStep {
  role: string;
  brief: ExerciseBrief;
  result: ConstructionResult;
}

/** Construct every step's exercise. Sequential so per-step repair loops don't
    stampede a custom endpoint's rate limit. */
export async function constructLessonExercises(provider: AiProvider, draft: LessonDraft): Promise<ConstructedStep[]> {
  const out: ConstructedStep[] = [];
  for (const step of draft.steps) {
    const result = await constructExercise(provider, step.brief);
    out.push({ role: step.role, brief: step.brief, result });
  }
  return out;
}
