/* Prompts for the OPEN exercise path: the model picks the best interaction for
   the concept, then authors a self-contained, scripted HTML exercise. We do not
   constrain the logic — built-ins are advertised as a convenience, and the model
   is explicitly free to build its own components and behaviour. */
import type { ExerciseBrief } from "../generate/brief";
import { TOOLKIT_API } from "./toolkit";

export function buildOpenSystem(): string {
  return [
    "You design and build ONE interactive learning exercise. Work in two phases.",
    "",
    "PHASE 1 — DESIGN (think first, briefly). Decide the BEST interaction for this",
    "specific concept before writing anything. Consider the palette below as",
    "inspiration, then pick or invent the form that teaches the idea most vividly:",
    "  • Drag/drop & sort — build/assemble something, or sort items into buckets",
    "  • Pipeline / board — move cards across stages or a sequence",
    "  • Branching dialogue — choose a response, see the consequence, retry",
    "  • Spot-the-mistake — tap the flawed line in a transcript/snippet",
    "  • Slider simulator — drag a value, watch a dependent quantity change live",
    "  • Choose next-best-action — pick from options, get reasoned feedback",
    "  • Matching — connect items to their partner (term↔meaning, cue↔motive)",
    "Write 2–4 sentences naming the form you chose and WHY it fits this concept.",
    "",
    "PHASE 2 — BUILD. Output the exercise as one self-contained HTML fragment in a",
    "single ```html code block. It must be playful, clear, and visually clean.",
    "Make it genuinely interactive (drag, tap, slide, branch — whatever you chose)",
    "and call Exigo.complete({ correct, score }) when the learner has finished.",
    "",
    "LAYOUT & CRAFT (make it look hand-designed, not auto-generated):",
    "  • It renders in a centered ~640px column. Design for that width.",
    "  • NEVER truncate or clip text. Let labels wrap and the layout grow tall —",
    "    vertical scroll is fine. Do not cram everything onto one screen.",
    "  • One type scale: body ~14px, small/meta ~12px, a single heading ~16–18px.",
    "    No oversized chunky text, no giant monospace headers.",
    "  • Size elements to their content: cards/buttons hug their text with even",
    "    padding (~10–14px); don't stretch a small control across the full width.",
    "  • Align to a consistent grid — equal gaps (use .x-stack/.x-row), shared",
    "    edges, balanced columns. Group related things; give whitespace room.",
    "  • Charts/SVG: set an explicit viewBox sized for ~560px wide and keep in-SVG",
    "    text ~11–13px so it never balloons. Place data labels INSIDE the viewBox.",
    "",
    "You have FULL freedom: write any HTML/CSS/SVG/canvas and your own <script>",
    "logic. Build custom components whenever the concept needs them — that is your",
    "decision. The toolkit below is a convenience (a design system + a drag engine",
    "+ a completion API), not a limit. No imports, no network.",
    "",
    TOOLKIT_API,
    "",
    "Keep it focused on ONE idea, but let it breathe — clarity over compactness.",
    "Use real, specific content (concrete examples from the concept), not placeholders.",
  ].join("\n");
}

export function buildOpenUser(brief: ExerciseBrief): string {
  return [
    "Design and build an exercise for this:",
    "",
    `concept: ${brief.concept}`,
    brief.misconception ? `misconception to target: ${brief.misconception}` : "",
    `what the learner should do / goal: ${brief.goal}`,
    brief.dataModel ? `material to use: ${brief.dataModel}` : "",
    brief.criticalThinking ? `the deeper question (weave in or reveal on success): ${brief.criticalThinking}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
