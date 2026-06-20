/* compileDisplay — lower the structured authoring surface (stage/readouts/
   criticalThinking/code/controls/player) into the display[] the renderer
   consumes, in one canonical order. The VM never sees the difference; the
   structure exists so the validator can hard-gate "one rich visual, little
   text" at the field level instead of pattern-matching a free-form array. */
import type { DisplayLayer, ReactiveSpec } from "./types";

export function compileDisplay(spec: ReactiveSpec): DisplayLayer[] {
  // Legacy/internal form: a hand-written display[] passes straight through.
  if (spec.stage == null) return spec.display ?? [];

  const out: DisplayLayer[] = [];
  if (spec.code) out.push(spec.code);
  out.push(spec.stage);
  for (const r of spec.readouts ?? []) out.push(r);
  if (spec.controls) out.push(spec.controls);
  if (spec.player) out.push(spec.player);
  if (spec.criticalThinking) {
    // Revealed on solve: reward, not homework — it never crowds the stage.
    out.push({ type: "richText", value: `**Think further:** ${spec.criticalThinking}`, showWhen: "eval.ok" });
  }
  return out;
}
