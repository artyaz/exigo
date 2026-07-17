"use client";
/* arena — the region/block semantic primitive ("models, not pixels").
   The author declares bounded regions (a pmr buffer, a heap, a pool, a
   cache line) and a flat list of blocks `{ id, region, size }`; THIS file
   owns every coordinate: it packs blocks proportionally to size, draws each
   region's used/capacity gauge, and — when allocations escape a full region
   — measures the two region boxes and routes an animated arrow between them.
   Nothing here knows about C++ or bytes; it reasons about regions and sizes,
   so the same primitive renders any "bounded container that overflows." */
import React from "react";
import type { Env } from "../runtime/expr";
import { run } from "../runtime/expr";
import type { ArenaOverflow, ArenaRegion, ToneToken, Value } from "../runtime/types";
import { toneRgb } from "./visual";

/** Unique SVG marker ids per Arena instance (mirrors Graph MARK_SEQ / Plot GRAD_SEQ). */
let ARENA_MARK_SEQ = 0;

interface Block {
  id: string;
  region: string;
  size: number;
  label?: string;
  tone?: ToneToken;
}

function asBlocks(v: Value | undefined): Block[] {
  if (!Array.isArray(v)) return [];
  const out: Block[] = [];
  for (const it of v) {
    if (!it || typeof it !== "object" || Array.isArray(it)) continue;
    const o = it as Record<string, Value>;
    const id = o.id != null ? String(o.id as string | number) : "";
    const region = o.region != null ? String(o.region as string | number) : "";
    if (!region) continue;
    const size = typeof o.size === "number" && o.size > 0 ? o.size : 1;
    out.push({
      id,
      region,
      size,
      label: o.label != null ? String(o.label as string | number) : undefined,
      tone: typeof o.tone === "string" ? (o.tone as ToneToken) : undefined,
    });
  }
  return out;
}

/** True when every block is the same size — then proportional widths carry no
    information and would only truncate text labels (the classifier case), so we
    render content-sized chips. Varying sizes keep the honest proportional pack. */
export function uniformSizes(sizes: number[]): boolean {
  return sizes.length > 0 && new Set(sizes).size === 1;
}

export function Arena({
  layer,
  env,
}: {
  layer: { label?: string; regions: ArenaRegion[]; blocks: string; overflow?: ArenaOverflow };
  env: Env;
}): React.JSX.Element {
  const blocks = asBlocks((() => {
    try {
      return run(layer.blocks, env);
    } catch {
      return [];
    }
  })());
  const uniform = uniformSizes(blocks.map((b) => b.size));
  const markId = React.useMemo(() => `exg-arena-head-${++ARENA_MARK_SEQ}`, []);

  const bodyRef = React.useRef<HTMLDivElement>(null);
  const regionEls = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const setRegionEl = (id: string) => (el: HTMLDivElement | null): void => {
    if (el) regionEls.current.set(id, el);
    else regionEls.current.delete(id);
  };
  const [arrow, setArrow] = React.useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  // The largest bounded capacity sets a shared unit→percent scale so a 64-unit
  // block looks the same wherever it lands (honest cross-region comparison).
  const refCap =
    layer.regions.reduce((m, r) => (r.capacity && r.capacity > m ? r.capacity : m), 0) || 1;

  const byRegion = new Map<string, Block[]>();
  for (const r of layer.regions) byRegion.set(r.id, []);
  for (const b of blocks) {
    if (!byRegion.has(b.region)) byRegion.set(b.region, []);
    byRegion.get(b.region)!.push(b);
  }

  const overflowActive =
    layer.overflow != null && (byRegion.get(layer.overflow.to)?.length ?? 0) > 0;

  // Measure the two region boxes and route the escape arrow between them.
  // Re-measures track the *regions themselves* (their height changes as
  // blocks pack in), and a rAF pass catches layout settling after the
  // block pop-in — a stale measure would pin the arrow at header height.
  const blockKey = blocks.map((b) => `${b.id}:${b.region}`).join("|");
  React.useLayoutEffect(() => {
    if (!layer.overflow || !overflowActive) {
      setArrow(null);
      return;
    }
    const measure = (): void => {
      const host = bodyRef.current;
      const from = regionEls.current.get(layer.overflow!.from);
      const to = regionEls.current.get(layer.overflow!.to);
      if (!host || !from || !to) return;
      const h = host.getBoundingClientRect();
      const a = from.getBoundingClientRect();
      const b = to.getBoundingClientRect();
      const sameRow = Math.abs(a.top - b.top) < a.height * 0.6;
      if (sameRow) {
        const leftToRight = a.left <= b.left;
        setArrow({
          x1: (leftToRight ? a.right : a.left) - h.left,
          y1: a.top + a.height / 2 - h.top,
          x2: (leftToRight ? b.left : b.right) - h.left,
          y2: b.top + b.height / 2 - h.top,
        });
      } else {
        const topToBottom = a.top <= b.top;
        setArrow({
          x1: a.left + a.width / 2 - h.left,
          y1: (topToBottom ? a.bottom : a.top) - h.top,
          x2: b.left + b.width / 2 - h.left,
          y2: (topToBottom ? b.top : b.bottom) - h.top,
        });
      }
    };
    measure();
    const raf = requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    if (bodyRef.current) ro.observe(bodyRef.current);
    const from = regionEls.current.get(layer.overflow.from);
    const to = regionEls.current.get(layer.overflow.to);
    if (from) ro.observe(from);
    if (to) ro.observe(to);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [layer.overflow, overflowActive, blockKey]);

  return (
    <div className="exg-arena">
      {layer.label ? <div className="exg-arena__lab">{layer.label}</div> : null}
      <div className="exg-arena__body" ref={bodyRef}>
        {layer.regions.map((r) => {
          const list = byRegion.get(r.id) ?? [];
          const used = list.reduce((s, b) => s + b.size, 0);
          const bounded = typeof r.capacity === "number" && r.capacity > 0;
          const cap = bounded ? r.capacity! : Math.max(used, refCap);
          const over = bounded && used > r.capacity!;
          const fillPct = Math.max(0, Math.min(100, (used / cap) * 100));
          const accent = toneRgb(r.tone ?? "muted");
          return (
            <div
              key={r.id}
              ref={setRegionEl(r.id)}
              className={`exg-arena__region${bounded ? "" : " exg-arena__region--open"}${over ? " exg-arena__region--over" : ""}`}
              style={{ ["--reg-rgb" as string]: accent }}
            >
              <div className="exg-arena__head">
                <span className="exg-arena__name">{r.label ?? r.id}</span>
                <span className="exg-arena__meta">
                  {used}
                  {bounded ? ` / ${r.capacity}` : ""}
                  {r.unit ? ` ${r.unit}` : ""}
                </span>
              </div>
              {bounded ? (
                <div className="exg-arena__gauge">
                  <div className="exg-arena__gaugefill" style={{ width: `${fillPct}%` }} />
                </div>
              ) : null}
              <div className="exg-arena__slots">
                {list.length === 0 ? <span className="exg-arena__empty">free</span> : null}
                {list.map((b, i) => {
                  const w = Math.max(7, Math.min(100, (b.size / cap) * 100));
                  // Blocks that escaped into the overflow target read as the
                  // violation they are — rose by default, no words needed.
                  const escaped = r.id === layer.overflow?.to;
                  return (
                    <div
                      key={b.id || i}
                      className={`exg-arena__block${uniform ? " exg-arena__block--chip" : ""}`}
                      style={{ ...(uniform ? null : { width: `${w}%` }), ["--blk-rgb" as string]: b.tone ? toneRgb(b.tone, i) : escaped ? toneRgb("no") : toneRgb(undefined, i), animationDelay: `${i * 45}ms` }}
                      title={`${b.label ?? b.id} · ${b.size}${r.unit ? " " + r.unit : ""}`}
                    >
                      {/* chips always show their full label (wrapping); proportional
                          blocks stay silent when too narrow — tooltip carries detail */}
                      {uniform || w >= 14 ? <span className="exg-arena__blk-lab">{b.label ?? b.id}</span> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {arrow
          ? (() => {
              // A gentle arc (not a straight jab), its name written just
              // beneath the crest — body height, clear of region headers.
              const horiz = Math.abs(arrow.x2 - arrow.x1) >= Math.abs(arrow.y2 - arrow.y1);
              const qx = horiz ? (arrow.x1 + arrow.x2) / 2 : (arrow.x1 + arrow.x2) / 2 + 16;
              const qy = horiz ? (arrow.y1 + arrow.y2) / 2 - 16 : (arrow.y1 + arrow.y2) / 2;
              const lx = 0.25 * arrow.x1 + 0.5 * qx + 0.25 * arrow.x2;
              const ly = 0.25 * arrow.y1 + 0.5 * qy + 0.25 * arrow.y2;
              return (
                <svg className="exg-arena__arrows" aria-hidden="true">
                  <defs>
                    <marker id={markId} markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto">
                      <path d="M0,0 L7,3 L0,6 Z" fill={`rgb(${toneRgb("no")})`} />
                    </marker>
                  </defs>
                  <path
                    className="exg-arena__spill"
                    d={`M ${arrow.x1} ${arrow.y1} Q ${qx} ${qy} ${arrow.x2} ${arrow.y2}`}
                    markerEnd={`url(#${markId})`}
                  />
                  {layer.overflow?.label ? (
                    <text className="exg-arena__spill-lab" x={lx} y={ly + 14} textAnchor="middle">
                      {layer.overflow.label}
                    </text>
                  ) : null}
                </svg>
              );
            })()
          : null}
      </div>
    </div>
  );
}
