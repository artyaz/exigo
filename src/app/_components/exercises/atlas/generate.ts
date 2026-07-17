import "server-only";
import type { AiProvider } from "../../../../server/ai";
import { extractEmbedHtml } from "../embed/constructor";
import { createLimiter, withRetry } from "./concurrency";
import {
  brainstormSystem,
  brainstormUser,
  buildSystem,
  buildUser,
  lessonSystem,
  lessonUser,
  parseBrainstorm,
  parseLesson,
  parseSciences,
  parseSubtopics,
  pickMechanic,
  sciencesSystem,
  sciencesUser,
  subtopicsSystem,
  subtopicsUser,
  toSpecs,
} from "./prompts";
import type { AtlasConfig, AtlasEvent, ExerciseSpec, Lesson, Science, Subtopic } from "./types";

/** Run the whole pyramid, fanning out at each level under one shared concurrency
    budget, emitting NDJSON events as nodes land. Resolves when everything (or
    every retry) is done. Errors at a node are emitted, not thrown — one bad
    branch never sinks the tree. */
export async function runAtlas(provider: AiProvider, cfg: AtlasConfig, emit: (e: AtlasEvent) => void): Promise<void> {
  const limit = createLimiter(cfg.concurrency);
  const gen = (system: string, prompt: string, temperature: number, label: string): Promise<string> =>
    withRetry(() => limit(() => provider.generate({ system, prompt, temperature }).then((r) => r.text)), cfg.retries, label);

  // Stage 1 — sciences (not caught: if this fails the run has nothing to show).
  const sciences = parseSciences(await gen(sciencesSystem(), sciencesUser(cfg.sciences), 0.9, "sciences")).slice(0, cfg.sciences);
  emit({ type: "sciences", sciences });

  await Promise.all(sciences.map((science) => runScience(provider, gen, cfg, science, emit)));
  emit({ type: "done" });
}

async function runScience(
  _provider: AiProvider,
  gen: (s: string, p: string, t: number, l: string) => Promise<string>,
  cfg: AtlasConfig,
  science: Science,
  emit: (e: AtlasEvent) => void,
): Promise<void> {
  let subtopics: Subtopic[];
  try {
    subtopics = parseSubtopics(
      await gen(subtopicsSystem(), subtopicsUser(science.name, cfg.subtopicsPerScience), 1.0, `subtopics(${science.name})`),
      science.id,
    ).slice(0, cfg.subtopicsPerScience);
  } catch (e) {
    emit({ type: "error", stage: "subtopics", id: science.id, message: msg(e) });
    return;
  }
  emit({ type: "subtopics", scienceId: science.id, subtopics });
  await Promise.all(subtopics.map((sub) => runSubtopic(gen, cfg, science, sub, emit)));
}

async function runSubtopic(
  gen: (s: string, p: string, t: number, l: string) => Promise<string>,
  cfg: AtlasConfig,
  science: Science,
  sub: Subtopic,
  emit: (e: AtlasEvent) => void,
): Promise<void> {
  let lesson: Lesson;
  try {
    const draft = parseLesson(
      await gen(
        lessonSystem(),
        lessonUser(science.name, sub.title, cfg.exercisesPerLesson.min, cfg.exercisesPerLesson.max),
        0.7,
        `lesson(${sub.title})`,
      ),
    );
    const exercises = toSpecs(sub.id, draft.exercises.slice(0, cfg.exercisesPerLesson.max));
    lesson = { subtopicId: sub.id, title: draft.title, content: draft.content, exercises };
  } catch (e) {
    emit({ type: "error", stage: "lesson", id: sub.id, message: msg(e) });
    return;
  }
  emit({ type: "lesson", lesson });
  await Promise.all(lesson.exercises.map((spec) => runExercise(gen, cfg, spec, emit)));
}

async function runExercise(
  gen: (s: string, p: string, t: number, l: string) => Promise<string>,
  cfg: AtlasConfig,
  spec: ExerciseSpec,
  emit: (e: AtlasEvent) => void,
): Promise<void> {
  try {
    const five = parseBrainstorm(await gen(brainstormSystem(), brainstormUser(spec.description, cfg.brainstorm), 1.0, `brainstorm(${spec.id})`));
    const chosen = pickMechanic(five);
    const { html } = extractEmbedHtml(await gen(buildSystem(), buildUser(spec.description, chosen), 0.8, `build(${spec.id})`));
    emit({ type: "exercise", spec, built: { id: spec.id, chosen, html } });
  } catch (e) {
    emit({ type: "exercise", spec, built: { id: spec.id, html: "", error: msg(e) } });
  }
}

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
