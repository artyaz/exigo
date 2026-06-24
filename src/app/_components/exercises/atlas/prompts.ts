/* All Atlas stage prompts and their parsers. Parsers are pure (no server deps)
   so they're unit-tested — the model→system seam is where things break, so each
   stage strips fences and tolerates loose JSON. */
import { DESIGN_SYSTEM, STAGE_MANIFEST } from "../embed/runtime";
import type { ExerciseSpec, Science, Subtopic } from "./types";

let SEQ = 0;
const uid = (prefix: string): string => `${prefix}-${(SEQ++).toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** Pull the first JSON value out of a model reply (fenced or not). */
export function extractJson<T>(raw: string): T {
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(raw);
  let s = (fence ? fence[1]! : raw).trim();
  const open = s.search(/[[{]/);
  if (open > 0) s = s.slice(open);
  const close = Math.max(s.lastIndexOf("]"), s.lastIndexOf("}"));
  if (close >= 0) s = s.slice(0, close + 1);
  return JSON.parse(s) as T;
}

const asName = (v: unknown): string =>
  typeof v === "string" ? v : v && typeof v === "object" && "name" in v ? String((v as { name: unknown }).name) : "";

/* ── Stage 1: sciences ──────────────────────────────────────────── */
export function sciencesSystem(): string {
  return "You are a curriculum designer. Output ONLY JSON, no prose.";
}
export function sciencesUser(n: number): string {
  return `Return a JSON array of exactly ${n} distinct scientific fields to learn — broad disciplines, well varied across natural, formal, life, and social sciences, and INCLUDE at least one computing field (e.g. computer science). Format: ["Field name", ...]. Only the JSON array.`;
}
export function parseSciences(raw: string): Science[] {
  const arr = extractJson<unknown[]>(raw);
  return arr
    .map(asName)
    .filter(Boolean)
    .map((name) => ({ id: uid("sci"), name }));
}

/* ── Stage 2: subtopics (very specific) ─────────────────────────── */
export function subtopicsSystem(): string {
  return "You are a curriculum designer who delights in precise, non-obvious niches. Output ONLY JSON.";
}
export function subtopicsUser(science: string, n: number): string {
  return `For the field "${science}", return a JSON array of exactly ${n} VERY specific, narrow, surprising subtopics — not broad chapters but precise, almost oddly-specific niches a curious expert would smile at. Each: {"title": "...", "blurb": "one-line hook"}. Only the JSON array.`;
}
export function parseSubtopics(raw: string, scienceId: string): Subtopic[] {
  const arr = extractJson<{ title?: string; blurb?: string }[]>(raw);
  return arr
    .filter((s) => s && typeof s.title === "string")
    .map((s) => ({ id: uid("sub"), scienceId, title: s.title!, blurb: typeof s.blurb === "string" ? s.blurb : undefined }));
}

/* ── Stage 3: lesson (content + exercise briefs) ────────────────── */
export function lessonSystem(): string {
  return "You write tight, vivid micro-lessons and the briefs for their interactive exercises. Output ONLY JSON.";
}
export function lessonUser(science: string, subtopic: string, min: number, max: number): string {
  return [
    `Write a focused micro-lesson on "${subtopic}" (within ${science}).`,
    `Return JSON: {"title": string, "content": string (markdown, 2–4 short punchy paragraphs that build intuition), "exercises": string[]}.`,
    `"exercises" holds ${min}–${max} briefs — each a concrete description of what ONE inline interactive exercise should make the learner DO and grasp (the misconception it targets, the "aha"). Order them to slot between the lesson's ideas.`,
    "Only the JSON object.",
  ].join(" ");
}
export interface LessonDraft {
  title: string;
  content: string;
  exercises: string[];
}
export function parseLesson(raw: string): LessonDraft {
  const o = extractJson<Partial<LessonDraft>>(raw);
  return {
    title: typeof o.title === "string" ? o.title : "Lesson",
    content: typeof o.content === "string" ? o.content : "",
    exercises: Array.isArray(o.exercises) ? o.exercises.filter((e): e is string => typeof e === "string") : [],
  };
}
export function toSpecs(subtopicId: string, descriptions: string[]): ExerciseSpec[] {
  return descriptions.map((description) => ({ id: uid("ex"), subtopicId, description }));
}

/* ── Stage 4a: brainstorm 5 mechanics ───────────────────────────── */
export function brainstormSystem(): string {
  return "You invent fresh, surprising interaction mechanics for learning. Output ONLY a JSON array of strings.";
}
export function brainstormUser(description: string, n: number): string {
  return [
    `Exercise brief: ${description}`,
    `Propose exactly ${n} STRUCTURALLY different interactive mechanics for it — different verb, different visual metaphor, not reskins of a quiz. Sort/slider/multiple-choice are the floor; push past them to a little playable model of the idea.`,
    `Return a JSON array of ${n} strings; each names the mechanic and the "aha" it forces, in 1–2 sentences. Only the JSON array.`,
  ].join(" ");
}
export function parseBrainstorm(raw: string): string[] {
  const arr = extractJson<unknown[]>(raw);
  return arr.map((v) => (typeof v === "string" ? v : asName(v))).filter(Boolean);
}
/** Pick one mechanic at random (the deliberate variety lever). */
export function pickMechanic(options: string[], rand: () => number = Math.random): string {
  if (options.length === 0) return "";
  return options[Math.floor(rand() * options.length)]!;
}

/* ── Stage 4b: build the chosen exercise (reuses the embed stage) ── */
export function buildSystem(): string {
  return [
    "You are an elite interactive-learning engineer. Build EXACTLY the interaction concept you are given as a single self-contained HTML exercise.",
    "Output exactly one ```html code block: the BODY content only (markup + your own <style> and <script type=\"module\">). No <html>/<head>/<body>.",
    "",
    STAGE_MANIFEST,
    "",
    DESIGN_SYSTEM,
    "",
    "Contract: call Exigo.complete({ correct, score }) when solved; optionally Exigo.progress(0..1). Use real, specific content. Fit the fixed window; never grow it.",
  ].join("\n");
}
export function buildUser(description: string, mechanic: string): string {
  return `Concept to build (chosen): ${mechanic}\n\nIt must teach: ${description}`;
}
