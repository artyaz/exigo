/* visual — the shared visual language of the semantic primitives.
   Every archetype (arena, plot, graph, …) resolves tones, curves, and tick
   values through this module so the whole system speaks with one voice:
   - few numbers, much shape: sparse guides, direct labels instead of legends
   - one accent per insight: a single palette, rose reserved for violation
   - soft and springy: smooth curves, rounded caps, staggered pop-ins
   A renderer that needs a color or a curve asks here; it never invents one. */
import type { ToneToken } from "../runtime/types";

/** RGB triples (for `rgb(<triple> / alpha)` composition) per tone token. */
export const TONE_RGB: Record<string, string> = {
  amber: "252 211 77",
  azure: "125 211 252",
  violet: "196 181 253",
  emerald: "52 211 153",
  ok: "52 211 153",
  no: "251 113 133",
  muted: "148 163 184",
  ghost: "100 116 139",
};

const CYCLE: readonly string[] = ["azure", "violet", "amber", "emerald"];

/** Resolve a tone to its rgb triple; unspecified tones cycle by index so
    sibling items stay distinguishable without the author picking colors. */
export function toneRgb(tone: ToneToken | undefined, i = 0): string {
  const key = tone ?? CYCLE[i % CYCLE.length]!;
  return TONE_RGB[key] ?? TONE_RGB.azure!;
}

/** Full `rgb(<triple>)` color string for SVG fill/stroke (and CSS that
    cannot use a bare triple + separate alpha var). Built on toneRgb so
    every renderer shares one palette. */
export function toneSolid(tone: ToneToken | undefined, i = 0): string {
  return `rgb(${toneRgb(tone, i)})`;
}

/** Catmull-Rom → cubic bézier path through pixel points: the gentle, natural
    curve every line/area uses. Two points degrade to a straight segment. */
export function smoothPath(pts: ReadonlyArray<readonly [number, number]>): string {
  if (pts.length === 0) return "";
  const first = pts[0]!;
  let d = `M ${first[0].toFixed(2)} ${first[1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d;
}

/** A few pleasant guide values across [min, max] (steps snap to 1/2/5) —
    sparse on purpose: guides should whisper, not grid. */
export function niceTicks(min: number, max: number, n = 3): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [min];
  const raw = (max - min) / n;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step * 1e-6; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

/** Compact number formatting for in-visual labels. */
export function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (Number.isInteger(n)) return String(n);
  const a = Math.abs(n);
  return a >= 100 ? n.toFixed(0) : a >= 10 ? n.toFixed(1) : n.toFixed(2);
}
