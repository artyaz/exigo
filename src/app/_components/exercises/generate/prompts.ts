/* Prompt assembly for the two generation pipelines. Pure string builders —
   they take the authoring guide text as input rather than reading the file,
   so they stay testable and isomorphic. The constructor emits MARKUP (the
   weak-model-friendly surface), which is then parsed + validated + repaired. */
import type { ExerciseBrief } from "./brief";
import { MANIFEST, TONES } from "../markup/manifest";
import { HELPER_NAMES } from "../runtime/helpers";
import type { MarkupError } from "../markup/parse";
import { MARKUP_EXEMPLAR, NOCODE_EXEMPLAR } from "./exemplar";

/* A STRUCTURE-aware listing of the closed grammar, generated from MANIFEST so
   it can't drift from the parser. It deliberately shows *where things go* —
   which tags nest, which hold text, which take attributes — because the flat
   attribute lists weaker models were given led them to cram everything into
   attributes and to flatten nesting (e.g. <ok> as a sibling of <goal>). */
export function describeVocabulary(): string {
  const lines = Object.entries(MANIFEST).map(([tag, spec]) => {
    const attrs = spec.attrs.map((a) => (a.required ? `${a.name}*` : a.name));
    const attrPart = attrs.length ? ` [${attrs.join(", ")}]` : "";
    const flagPart = (spec.flags ?? []).map((f) => ` +${f}`).join("");
    const textPart = spec.text === "prose" ? " ·markdown-text" : spec.text === "code" ? " ·raw-code" : "";
    const childPart = spec.children?.length ? `  › ${spec.children.join(", ")}` : "";
    return `<${tag}>${attrPart}${flagPart}${textPart}${childPart}  — ${spec.describe}`;
  });
  return [
    "The closed tag grammar — use ONLY these tags. Legend: name* = required",
    "attribute · +flag = bare boolean flag (write `seq`, not seq=\"true\") ·",
    "·markdown-text = the tag's body is plain markdown text · ·raw-code = body is",
    "literal code · › = the ONLY tags allowed directly inside.",
    "",
    ...lines,
    "",
    `Tones: ${TONES.join(", ")} ("no" = violations only).`,
    `Expression helpers: ${[...HELPER_NAMES].sort().join(", ")}.`,
    "In expressions write `and`/`or` (never `&&`/`||`) and build records with record(...), never { }.",
  ].join("\n");
}

export function buildConstructorSystem(): string {
  return [
    "You construct ONE Exigo exercise and emit it as MARKUP. The pedagogical",
    "intent is already decided and handed to you as a brief — realise it",
    "faithfully; do not redesign it.",
    "",
    "OUTPUT: only the markup, from `<exercise` to `</exercise>`. No prose, no code",
    "fences, no commentary.",
    "",
    "MOST EXERCISES HAVE NO CODE. The default exercise is interactive WITHOUT any",
    "programming: the learner acts through <controls> (tap a button, drag a",
    "slider), an <on> reaction folds that event into the model, the stage shows",
    "the result, and <goal> scores it. Sales, biology, history, language, law —",
    "none of these involve code. Include a <code> block ONLY when the concept is",
    "literally about writing or running code (an allocator, recursion, a sort).",
    "If the brief has no codeIntent, your exercise has NO <code>.",
    "",
    "This markup is its OWN language — it is NOT HTML and it is NOT JSON:",
    "- NOT HTML. No <div>, <span>, <p>, <strong>, <b>, <em>, <code>. Prose tags",
    "  (<prompt>, <think>, <ok>, <no>) hold plain markdown — **bold**, `code`.",
    "- NOT JSON. The only JSON allowed is the <state> body. Everywhere else, model",
    "  data with tags: a reaction is <on> with <set> children, never a `do=` attr.",
    "",
    "Expression slots (to=…, when=…, value=…, bind=…, proximity=…, button payload)",
    "are a TINY CLOSED DSL — NOT JavaScript. The code inside <locked>/<edit> IS",
    "JavaScript; expressions are not. In an expression you may use ONLY the listed",
    "helpers, state keys, and event.field:",
    "- No arrow functions/lambdas, no map/filter/forEach. To turn a list into",
    "  stage blocks, FOLD it: push records in an <on> reaction (see the example) —",
    "  never map() inside bind=.",
    "- Index with at(list, i), never list[i]. Choose with if(cond, a, b), never",
    "  cond ? a : b. Build records with record(\"k\", v, …), never { }.",
    "- You cannot call functions you defined in <locked> code from an expression —",
    "  code and expressions are separate worlds.",
    "- Empty string is \"\" (e.g. to='\"\"'), not an empty attribute (to=\"\").",
    "- Put nested data (arrays of objects) in the <state> JSON body, not an attribute.",
    "",
    "The <player> (only with code/observations) replays the observation stream:",
    "source is the state key holding it — declare <state obs=\"[]\"/>, set",
    "<set key=\"obs\" to=\"event.observations\"/> in the run reaction; source is never",
    "an event name. Omit <player> entirely for no-code exercises.",
    "",
    "Construct by ADAPTING the matching worked example below. Keep its exact shapes",
    "(state declared once and every referenced key present; <on><set/></on> with",
    "`seq` a bare flag; <ok>/<no> INSIDE <goal>; a <region>'s label is its inner",
    "text). Always include <think> with the brief's question, and exactly one stage",
    "(arena | plot | graph). You never write a coordinate.",
    "",
    describeVocabulary(),
    "",
    "=== DEFAULT WORKED EXAMPLE (no code — adapt this for almost everything) ===",
    NOCODE_EXEMPLAR,
    "",
    "=== CODE EXAMPLE (use ONLY when the concept is literally programming) ===",
    MARKUP_EXEMPLAR,
  ].join("\n");
}

export function buildConstructorUser(brief: ExerciseBrief): string {
  return [
    "Construct the exercise for this brief:",
    "",
    `concept: ${brief.concept}`,
    brief.misconception ? `misconception to target: ${brief.misconception}` : "",
    `archetype: ${brief.archetype}${brief.archetype === "auto" ? " (you choose the best fit)" : ""}`,
    `data model: ${brief.dataModel}`,
    brief.codeIntent ? `code the learner works with: ${brief.codeIntent}` : "",
    `goal (solved when): ${brief.goal}`,
    `criticalThinking (copy verbatim): ${brief.criticalThinking}`,
    brief.accent ? `accent: ${brief.accent}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Repair turn: the previous attempt + the exact validator/parser errors. The
    errors name the field, the rule, and the fix — feed them straight back. */
export function buildRepairUser(
  brief: ExerciseBrief,
  previousMarkup: string,
  errors: MarkupError[],
): string {
  const list = errors.map((e) => `- line ${e.line}: ${e.message}`).join("\n");
  return [
    "Your previous markup did not validate. Fix exactly these problems and",
    "return the COMPLETE corrected markup (no prose, no fences):",
    "",
    list,
    "",
    "Previous markup:",
    previousMarkup,
    "",
    `Reminder — concept: ${brief.concept}; goal: ${brief.goal}.`,
  ].join("\n");
}

/* ── Full pipeline: the smart model drafts a lesson with inline briefs ── */

export function buildLessonSystem(): string {
  return [
    "You are an expert curriculum designer. Draft a short lesson as a sequence",
    "of steps. For EACH step, write an exercise *brief* — the intent, not the",
    "full exercise. A separate constructor turns each brief into a visual.",
    "",
    "Return ONE raw JSON object and NOTHING else — no markdown code fences, no",
    "```json, no commentary before or after. Shape:",
    "{",
    '  "title": string,',
    '  "summary": string (optional),',
    '  "steps": [ { "role": string, "brief": { …fields below… } } ]',
    "}",
    "Roles, in arc order: prime, predict, reveal, name, apply, stretch, reflect.",
    "Use 3–5 steps. Prefer one running example across steps so it feels integrated.",
    "",
    "Each brief has EXACTLY these fields (use these names verbatim):",
    '- "concept": string — the idea this step teaches',
    '- "misconception": string — the wrong belief to target',
    '- "archetype": one of "arena" | "plot" | "graph" | "auto" (NOT "stageArchetype")',
    '- "dataModel": string — the state model the stage shows',
    '- "goal": string — what "solved" means; describe how the learner ACTS',
    "  (tap/sort/choose/drag) — not by writing code, unless the topic IS code",
    '- "criticalThinking": string — one question that transfers the idea',
    '- "codeIntent": string, OPTIONAL and RARE — include ONLY when the concept is',
    "  literally about reading/writing/running code. Omit it for everything else.",
    "",
    "Exercises are interactive WITHOUT code by default — the learner taps/sorts/",
    "drags/chooses and the result animates. Do not invent code for non-programming",
    "topics; a sales lesson has no code.",
    "",
    "Pick the archetype from the shape of the model:",
    "- arena: things sorted into buckets/containers (classify, capacity, overflow)",
    "- plot: an x→y relationship (growth, comparison to a target)",
    "- graph: things pointing at / containing each other (hierarchy, links, order)",
    "",
    "Context on what a constructed exercise can express:",
    describeVocabulary(),
  ].join("\n");
}

export function buildLessonUser(topic: string): string {
  return `Draft a lesson that teaches: ${topic}`;
}
