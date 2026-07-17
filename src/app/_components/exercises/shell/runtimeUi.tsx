"use client";
/* ═══════════════════════════════════════════════════════════════════
   EXIGO AAP — Shared shell UI primitives (the design philosophy layer).
   Ported from the design system's exerciseRuntime: accent inks, inline
   safe renderer, the celebratory particle burst, the cross-exercise
   streak signal, and the injected stylesheet. Exigo owns the shell,
   motion, accessibility, and feedback — specs never touch CSS.
   ═══════════════════════════════════════════════════════════════════ */
import React from "react";
import type { Accent } from "../runtime/types";

/** Shell chrome accents (rails, chips, celebration ink) — intentionally a
    softer pastel vocabulary than series/semantic tones in `display/visual.ts`
    (`TONE_RGB` / `toneRgb`). Same token *names* (amber/azure/…); different
    channels by design. Do not import ACCENTS into display renderers. */
export const ACCENTS: Record<Accent, { rgb: string; solid: string }> = {
  amber: { rgb: "254 240 138", solid: "#fde047" },
  azure: { rgb: "191 219 254", solid: "#bfdbfe" },
  violet: { rgb: "249 168 212", solid: "#f9a8d4" },
  emerald: { rgb: "52 211 153", solid: "#34d399" },
};
export function accentOf(name?: string): { rgb: string; solid: string } {
  return ACCENTS[(name as Accent) ?? "amber"] ?? ACCENTS.amber;
}

export const Ico = {
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
  bulb: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z" />
    </svg>
  ),
  play: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 3 14 9-14 9V3Z" />
    </svg>
  ),
  reset: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  ),
  spark: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
    </svg>
  ),
  flame: (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 2c1 3-1.5 4.5-1.5 7A2.5 2.5 0 0 0 13 11c.5-1 .3-2 .3-2 1.7 1.2 2.7 3 2.7 5a6 6 0 1 1-12 0c0-2.6 1.6-4.7 3.2-6.2C8.8 6 11 5 12 2Z" />
    </svg>
  ),
};

/* ── Safe inline renderer — whitelist <b>/<strong>/<i>/<em>/<code> ── */
const INLINE_TAG = /<(\/?)(b|strong|i|em|code)\s*>/gi;
export function renderInline(input?: string | null): React.ReactNode {
  if (input == null) return null;
  type Frame = { tag: string | null; children: React.ReactNode[] };
  const stack: Frame[] = [{ tag: null, children: [] }];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  const top = (): Frame => stack[stack.length - 1]!;
  const pushText = (txt: string): void => {
    if (txt) top().children.push(txt);
  };
  INLINE_TAG.lastIndex = 0;
  while ((m = INLINE_TAG.exec(input))) {
    pushText(input.slice(last, m.index));
    last = INLINE_TAG.lastIndex;
    const closing = m[1] === "/";
    const tag = m[2]!.toLowerCase();
    if (!closing) stack.push({ tag, children: [] });
    else if (stack.length > 1 && top().tag === tag) {
      const node = stack.pop()!;
      const El = node.tag === "code" ? "code" : node.tag === "i" || node.tag === "em" ? "em" : "strong";
      top().children.push(<El key={key++}>{node.children}</El>);
    }
  }
  pushText(input.slice(last));
  while (stack.length > 1) {
    const node = stack.pop()!;
    top().children.push(...node.children);
  }
  return stack[0]!.children;
}

/* ── Streak store ── */
const _streak = { count: 0, last: 0, subs: new Set<(n: number) => void>() };
export function bumpStreak(): number {
  const now = Date.now();
  _streak.count = now - _streak.last < 5 * 60 * 1000 ? _streak.count + 1 : 1;
  _streak.last = now;
  _streak.subs.forEach((fn) => fn(_streak.count));
  return _streak.count;
}
export function useStreak(): number {
  const [n, setN] = React.useState(_streak.count);
  React.useEffect(() => {
    _streak.subs.add(setN);
    return () => {
      _streak.subs.delete(setN);
    };
  }, []);
  return n;
}

/* ── Celebration particle burst ── */
export function useCelebrate(): {
  burstRef: React.RefObject<HTMLCanvasElement | null>;
  fire: (accent?: string) => void;
} {
  const burstRef = React.useRef<HTMLCanvasElement | null>(null);
  const fire = React.useCallback((accent = "emerald") => {
    const cv = burstRef.current;
    if (!cv) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const rect = cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = rect.width * dpr;
    cv.height = rect.height * dpr;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    const cx = rect.width / 2;
    const cy = rect.height * 0.42;
    const cols = [accentOf(accent).solid, "#ffffff", accentOf("emerald").solid];
    const N = 46;
    const parts = Array.from({ length: N }, (_, i) => {
      const a = (Math.PI * 2 * i) / N + Math.random() * 0.5;
      const sp = 3.2 + Math.random() * 5.4;
      return {
        x: cx,
        y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 2.4,
        r: 1.6 + Math.random() * 3.2,
        c: cols[(Math.random() * cols.length) | 0]!,
        life: 1,
        rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 0.4,
      };
    });
    let t0 = performance.now();
    const tick = (t: number): void => {
      const dt = Math.min(2, (t - t0) / 16.67);
      t0 = t;
      ctx.clearRect(0, 0, rect.width, rect.height);
      let alive = false;
      for (const p of parts) {
        p.vy += 0.16 * dt;
        p.vx *= 0.985;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= 0.018 * dt;
        p.rot += p.vr * dt;
        if (p.life > 0) {
          alive = true;
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.c;
          ctx.fillRect(-p.r, -p.r * 0.6, p.r * 2, p.r * 1.2);
          ctx.restore();
        }
      }
      if (alive) requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, rect.width, rect.height);
    };
    requestAnimationFrame(tick);
  }, []);
  return { burstRef, fire };
}
