"use client";
/* graph — the node/link semantic primitive ("models, not pixels"). The
   author declares nodes `[{id, label?, tone?}]` and edges `[{from, to,
   kind?}]` plus a layout word (tree | layered | stack | row | ring); THIS
   file owns every coordinate: it ranks nodes (longest path from the roots),
   spreads each rank, sizes pills to their labels, and routes smooth curves
   between them. A call tree, a linked list, a pointer diagram, a food web —
   same primitive, zero coordinates in the spec.

   Visual voice (visual.ts): soft pills, gentle béziers, staggered pop-ins,
   one accent per insight — never a boxes-and-arrows flowchart grid. */
import React from "react";
import type { Env } from "../runtime/expr";
import { run } from "../runtime/expr";
import type { GraphLayout, ToneToken, Value } from "../runtime/types";
import { toneRgb } from "./visual";

const VB_W = 360;
const ROW_H = 46;
const PAD = 18;
let MARK_SEQ = 0;

interface GNode {
  id: string;
  label: string;
  tone?: ToneToken;
}
interface GEdge {
  from: string;
  to: string;
  label?: string;
  tone?: ToneToken;
  kind?: "pointer" | "link";
}

function asNodes(v: Value | undefined): GNode[] {
  if (!Array.isArray(v)) return [];
  const out: GNode[] = [];
  for (const it of v) {
    if (!it || typeof it !== "object" || Array.isArray(it)) continue;
    const o = it as Record<string, Value>;
    if (o.id == null) continue;
    out.push({
      id: String(o.id as string | number),
      label: o.label != null ? String(o.label as string | number) : String(o.id as string | number),
      tone: typeof o.tone === "string" ? (o.tone as ToneToken) : undefined,
    });
  }
  return out;
}

function asEdges(v: Value | undefined): GEdge[] {
  if (!Array.isArray(v)) return [];
  const out: GEdge[] = [];
  for (const it of v) {
    if (!it || typeof it !== "object" || Array.isArray(it)) continue;
    const o = it as Record<string, Value>;
    if (o.from == null || o.to == null) continue;
    out.push({
      from: String(o.from as string | number),
      to: String(o.to as string | number),
      label: o.label != null ? String(o.label as string | number) : undefined,
      tone: typeof o.tone === "string" ? (o.tone as ToneToken) : undefined,
      kind: o.kind === "link" ? "link" : "pointer",
    });
  }
  return out;
}

/** Longest-path rank from the roots; bounded passes survive stray cycles. */
function rankNodes(nodes: GNode[], edges: GEdge[]): Map<string, number> {
  const rank = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  let pass = 0;
  while (pass < nodes.length) {
    pass++;
    let changed = false;
    for (const e of edges) {
      const rf = rank.get(e.from);
      const rt = rank.get(e.to);
      if (rf == null || rt == null) continue;
      if (rt < rf + 1 && rf + 1 < nodes.length) {
        rank.set(e.to, rf + 1);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return rank;
}

interface Placed extends GNode {
  x: number;
  y: number;
  w: number;
  h: number;
}

const GAP = 16; // min horizontal gap between pills in a row

function nodeSize(n: GNode): { w: number; h: number } {
  return { w: Math.max(36, Math.min(130, n.label.length * 6.4 + 18)), h: 24 };
}

/** Pack a horizontal row of nodes left→right by their real widths (never by an
    even fraction of a fixed viewBox — that overlapped wide pills). Returns the
    placed nodes anchored from x=PAD and the total width the row consumes. */
function packRow(list: GNode[], y: number): { row: Placed[]; width: number } {
  let x = PAD;
  const row = list.map((n) => {
    const s = nodeSize(n);
    const cx = x + s.w / 2;
    x += s.w + GAP;
    return { ...n, ...s, x: cx, y };
  });
  const width = (list.length ? x - GAP : 0) + PAD; // drop trailing gap, add right pad
  return { row, width };
}

/** Center each packed row inside a shared canvas wide enough for the widest row
    (at least VB_W), so nothing ever overlaps and the figure stays balanced. */
function centerRows(rows: Placed[][], widths: number[]): { placed: Placed[]; width: number } {
  const width = Math.max(VB_W, ...widths);
  const placed: Placed[] = [];
  rows.forEach((row, i) => {
    const dx = (width - widths[i]!) / 2;
    for (const p of row) placed.push({ ...p, x: p.x + dx });
  });
  return { placed, width };
}

export function place(nodes: GNode[], edges: GEdge[], layout: GraphLayout): { placed: Placed[]; height: number; width: number } {
  const size = nodeSize;

  if (layout === "ring") {
    const cxr = VB_W / 2;
    const r = Math.max(52, nodes.length * 13);
    const cyr = r + PAD + 14;
    const placed = nodes.map((n, i) => {
      const a = (i / Math.max(1, nodes.length)) * Math.PI * 2 - Math.PI / 2;
      return { ...n, ...size(n), x: cxr + Math.cos(a) * r, y: cyr + Math.sin(a) * r };
    });
    return { placed, height: cyr + r + PAD + 14, width: VB_W };
  }

  if (layout === "row") {
    const { row, width } = packRow(nodes, PAD + 16);
    const c = centerRows([row], [width]);
    return { placed: c.placed, height: PAD * 2 + 32, width: c.width };
  }

  if (layout === "stack") {
    // A stack grows upward: first node at the bottom, newest on top.
    const height = PAD * 2 + nodes.length * (24 + 8);
    const placed = nodes.map((n, i) => ({
      ...n,
      ...size(n),
      x: VB_W / 2,
      y: height - PAD - 12 - i * (24 + 8),
    }));
    return { placed, height: Math.max(height, 60), width: VB_W };
  }

  // tree / layered: ranks become rows, each packed by width then centered.
  const rank = rankNodes(nodes, edges);
  const rows = new Map<number, GNode[]>();
  let maxRank = 0;
  for (const n of nodes) {
    const r = rank.get(n.id) ?? 0;
    maxRank = Math.max(maxRank, r);
    if (!rows.has(r)) rows.set(r, []);
    rows.get(r)!.push(n);
  }
  const packedRows: Placed[][] = [];
  const widths: number[] = [];
  for (let r = 0; r <= maxRank; r++) {
    const { row, width } = packRow(rows.get(r) ?? [], PAD + 14 + r * ROW_H);
    packedRows.push(row);
    widths.push(width);
  }
  const c = centerRows(packedRows, widths);
  return { placed: c.placed, height: PAD * 2 + 24 + maxRank * ROW_H, width: c.width };
}

/** A gentle S-curve between two pill edges (vertical flow biased). */
function edgePath(a: Placed, b: Placed): string {
  const vertical = Math.abs(b.y - a.y) >= Math.abs(b.x - a.x);
  if (vertical) {
    const y1 = a.y + (b.y > a.y ? a.h / 2 : -a.h / 2);
    const y2 = b.y + (b.y > a.y ? -b.h / 2 : b.h / 2);
    const bend = (y2 - y1) / 2;
    return `M ${a.x} ${y1} C ${a.x} ${y1 + bend}, ${b.x} ${y2 - bend}, ${b.x} ${y2}`;
  }
  const x1 = a.x + (b.x > a.x ? a.w / 2 : -a.w / 2);
  const x2 = b.x + (b.x > a.x ? -b.w / 2 : b.w / 2);
  const bend = (x2 - x1) / 2;
  return `M ${x1} ${a.y} C ${x1 + bend} ${a.y}, ${x2 - bend} ${b.y}, ${x2} ${b.y}`;
}

export function Graph({
  layer,
  env,
}: {
  layer: { label?: string; nodes: string; edges?: string; layout?: GraphLayout; directed?: boolean };
  env: Env;
}): React.JSX.Element {
  const uid = React.useMemo(() => `exg-gm-${++MARK_SEQ}`, []);
  const nodes = asNodes(
    (() => {
      try {
        return run(layer.nodes, env);
      } catch {
        return [];
      }
    })(),
  );
  const edges = layer.edges
    ? asEdges(
        (() => {
          try {
            return run(layer.edges, env);
          } catch {
            return [];
          }
        })(),
      )
    : [];

  const { placed, height, width } = place(nodes, edges, layer.layout ?? "tree");
  const byId = new Map(placed.map((p) => [p.id, p]));
  const directed = layer.directed ?? true;

  return (
    <div className="exg-graph">
      {layer.label ? <div className="exg-graph__lab">{layer.label}</div> : null}
      {placed.length === 0 ? (
        <div className="exg-graph__empty">empty</div>
      ) : (
        <svg className="exg-graph__svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img">
          <defs>
            <marker id={uid} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L6.5,3 L0,6 Z" fill={`rgb(${toneRgb("muted")} / .8)`} />
            </marker>
          </defs>
          {edges.map((e, i) => {
            const a = byId.get(e.from);
            const b = byId.get(e.to);
            if (!a || !b) return null;
            const color = e.tone ? toneRgb(e.tone) : toneRgb("muted");
            const arrow = directed && e.kind !== "link";
            return (
              <g key={`e${i}`} className="exg-graph__edge">
                <path d={edgePath(a, b)} style={{ stroke: `rgb(${color} / .55)` }} markerEnd={arrow ? `url(#${uid})` : undefined} />
                {e.label ? (
                  <text className="exg-graph__elab" x={(a.x + b.x) / 2 + 6} y={(a.y + b.y) / 2 + 3}>
                    {e.label}
                  </text>
                ) : null}
              </g>
            );
          })}
          {placed.map((n, i) => {
            const color = toneRgb(n.tone, i);
            return (
              <g key={n.id} className="exg-graph__node" style={{ animationDelay: `${i * 50}ms` }}>
                <rect
                  x={n.x - n.w / 2}
                  y={n.y - n.h / 2}
                  width={n.w}
                  height={n.h}
                  rx={n.h / 2}
                  style={{ fill: `rgb(${color} / .14)`, stroke: `rgb(${color} / .55)` }}
                />
                <text className="exg-graph__nlab" x={n.x} y={n.y + 3.5} textAnchor="middle" style={{ fill: `rgb(${color})` }}>
                  {n.label}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
