import "server-only";
import type { AiProvider } from "../../../../server/ai";
import type { ReactiveSpec } from "../runtime/types";
import { parseMarkup, type MarkupError } from "../markup/parse";
import { validateSpec } from "../runtime/validate";
import { checkPlayable } from "../runtime/simulate";
import { buildConstructorSystem, buildConstructorUser, buildRepairUser } from "./prompts";
import type { ExerciseBrief } from "./brief";

/* The constructor: brief → validated ReactiveSpec, via the markup frontend +
   validator + a generate→validate→repair loop. This is the whole weak-AI
   thesis wired end to end — the model writes markup, the parser/validator
   reject with repair-oriented errors, and those errors feed the next turn. */

export interface ConstructionAttempt {
  markup: string;
  errors: MarkupError[];
  ok: boolean;
}

export interface ConstructionResult {
  ok: boolean;
  spec?: ReactiveSpec;
  markup: string;
  attempts: ConstructionAttempt[];
}

/** Strip code fences / stray prose the model may wrap around the markup. */
export function extractMarkup(raw: string): string {
  const fence = /```(?:xml|html|markup)?\s*([\s\S]*?)```/.exec(raw);
  const body = fence ? fence[1]! : raw;
  const start = body.indexOf("<exercise");
  const end = body.lastIndexOf("</exercise>");
  if (start !== -1 && end !== -1) return body.slice(start, end + "</exercise>".length);
  return body.trim();
}

/** Rewrite a validateSpec path (spec-JSON vocabulary) into markup vocabulary.
    The model writes tags, not spec fields — feeding it `spec.criticalThinking`
    is unactionable. This keeps the repair channel in the same language as the
    output, exactly as the generation channel already is. */
function asMarkupError(path: string, message: string): string {
  const p = path.toLowerCase();
  let where = path;
  if (p.includes("criticalthinking")) where = "<think> (add `<think>…the question…</think>`)";
  else if (p.includes("stage")) where = "the stage tag (<arena> / <plot> / <graph>)";
  else if (p.startsWith("reactions") || p.includes(".do")) where = "an <on> reaction / its <set>";
  else if (p.startsWith("evaluator")) where = "<goal> (when=…, with <ok>/<no> inside)";
  else if (p.includes("code")) where = "<code> / its <locked>/<edit>";
  else if (p.includes("player")) where = "<player>";
  else if (p.includes("readout")) where = "<readout>";
  else if (p.includes("prompt")) where = "<prompt>";
  else if (p.includes("state")) where = "<state>";
  return `In ${where} — ${message}`;
}

/** Parse + validate one markup attempt into a spec or a list of errors. The
    optional `brief` lets us back-fill criticalThinking: the constructor's job
    is to carry it verbatim and it already holds the value, so a dropped
    <think> is filled rather than bounced through a repair turn. */
export function evaluateMarkup(
  markup: string,
  brief?: { criticalThinking?: string },
): { spec?: ReactiveSpec; errors: MarkupError[] } {
  const parsed = parseMarkup(markup);
  if (!parsed.spec) return { errors: parsed.errors };
  const spec = parsed.spec;
  if (!spec.criticalThinking && brief?.criticalThinking) spec.criticalThinking = brief.criticalThinking;
  const result = validateSpec(spec);
  if (result.errors.length) {
    return {
      errors: result.errors.map((e) => ({ line: 0, message: asMarkupError(e.path, e.message) })),
    };
  }
  // Static validity isn't enough — simulate the exercise to prove it's actually
  // playable (the goal is reachable through the controls). An unwinnable or
  // inert exercise is sent back to repair, not accepted.
  const play = checkPlayable(spec);
  if (play.errors.length) {
    return { errors: play.errors.map((message) => ({ line: 0, message })) };
  }
  return { spec, errors: [] };
}

export async function constructExercise(
  provider: AiProvider,
  brief: ExerciseBrief,
  opts: { maxRepairs?: number } = {},
): Promise<ConstructionResult> {
  const maxRepairs = opts.maxRepairs ?? 2;
  const system = buildConstructorSystem();
  const attempts: ConstructionAttempt[] = [];

  let userPrompt = buildConstructorUser(brief);
  let lastMarkup = "";

  for (let turn = 0; turn <= maxRepairs; turn++) {
    const result = await provider.generate({ system, prompt: userPrompt, temperature: 0.4 });
    const markup = extractMarkup(result.text);
    lastMarkup = markup;
    const { spec, errors } = evaluateMarkup(markup, brief);
    attempts.push({ markup, errors, ok: errors.length === 0 });
    if (spec) return { ok: true, spec, markup, attempts };
    // Feed the exact errors back for the next turn.
    userPrompt = buildRepairUser(brief, markup, errors);
  }

  return { ok: false, markup: lastMarkup, attempts };
}
