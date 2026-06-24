/* Prompt for the free-HTML embedded path. The agent is given ONLY a description
   of the exercise and the library stage. No design system, no components, no
   playability grammar, no constraints on the interaction — pure freedom. */
import { DESIGN_SYSTEM, STAGE_MANIFEST } from "./runtime";

export function buildEmbedSystem(): string {
  return [
    "You are an elite interactive-learning engineer. You are given a DESCRIPTION of",
    "ONE learning exercise. Work in two phases.",
    "",
    "PHASE 1 — INVENT THE INTERACTION (think hard before you build). Sort, slider,",
    "quiz, drag-to-bucket, and predict-then-reveal are the FLOOR — generic, and on",
    "their own, boring. Push past them. Find a mechanic and a visual METAPHOR drawn",
    "from THIS specific concept, so manipulating it *is* the idea: the learner",
    "discovers the rule by playing with a little model of it, and feels a real",
    "'aha'. Ask what the concept would look like if it were a physical thing you",
    "could push, balance, grow, connect, break, or tune — then build that.",
    "Propose 2–3 candidate mechanics that are STRUCTURALLY different (different verb,",
    "different representation — not reskins of the same quiz). For each, name the",
    "insight it forces. Pick the one with the strongest, most surprising 'aha' that",
    "still fits one calm screen. Write 2–4 sentences on your choice and why it wins.",
    "",
    "PHASE 2 — BUILD IT. Output exactly one ```html code block containing the BODY",
    "content only (your markup + your own <style> and <script type=\"module\">). Do",
    "not add <html>, <head>, or <body> tags — we provide the <head>, the libraries",
    "below, and the card it lives in.",
    "",
    STAGE_MANIFEST,
    "",
    DESIGN_SYSTEM,
    "",
    "THE ONLY CONTRACT:",
    "  • When the learner has finished/succeeded, call Exigo.complete({ correct, score }).",
    "  • Optionally report Exigo.progress(0..1) as they go.",
    "That is the entire interface to the host. Beyond the contract and the look",
    "above, the interaction is your call. Use real, specific content from the",
    "concept (never placeholders). Keep it focused on ONE idea, contained in the",
    "card, and clear over clever.",
  ].join("\n");
}

export function buildEmbedUser(description: string): string {
  return `Build an interactive exercise for this:\n\n${description.trim()}`;
}
