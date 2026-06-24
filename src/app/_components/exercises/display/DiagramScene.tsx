"use client";
/* diagramScene — safe, tokenized vector shapes. No raw colors, shaders,
   fonts, or drawing callbacks: every shape is a closed token whose
   numeric props are DSL expressions over state/bindings. */
import React from "react";
import type { Env } from "../runtime/expr";
import { run } from "../runtime/expr";
import type { ShapeSpec, ToneToken, TokenizedSceneSpec } from "../runtime/types";

const TONE: Record<string, string> = {
  amber: "#fde047",
  azure: "#bfdbfe",
  violet: "#f9a8d4",
  emerald: "#34d399",
  muted: "rgba(255,255,255,0.45)",
  ghost: "rgba(255,255,255,0.18)",
  ok: "#34d399",
  no: "#fb7185",
};
function toneColor(t?: ToneToken): string {
  return (t && TONE[t]) ?? "rgba(255,255,255,0.7)";
}

export function DiagramScene({ scene, env }: { scene: TokenizedSceneSpec; env: Env }): React.JSX.Element {
  const W = scene.width ?? 100;
  const H = scene.height ?? 100;
  const sys = scene.coordinateSystem ?? "unit";

  // map a logical (x,y) to viewBox space (0..W, 0..H, y-down)
  const mapX = (x: number): number => (sys === "unit" ? x * W : sys === "cartesian" ? W / 2 + x : x);
  const mapY = (y: number): number => (sys === "unit" ? y * H : sys === "cartesian" ? H / 2 - y : y);
  const mapLen = (l: number): number => (sys === "unit" ? l * Math.min(W, H) : l);

  const n = (e: string): number => {
    try {
      const v = run(e, env);
      return typeof v === "number" ? v : 0;
    } catch {
      return 0;
    }
  };

  const renderShape = (s: ShapeSpec, i: number): React.ReactNode => {
    const stroke = toneColor(s.tone);
    switch (s.type) {
      case "circle":
        return <circle key={i} cx={mapX(n(s.cx))} cy={mapY(n(s.cy))} r={mapLen(n(s.r))} fill={stroke} fillOpacity={0.85} />;
      case "rect":
        return (
          <rect
            key={i}
            x={mapX(n(s.x))}
            y={mapY(n(s.y))}
            width={mapLen(n(s.w))}
            height={mapLen(n(s.h))}
            rx={1.5}
            fill={stroke}
            fillOpacity={0.85}
          />
        );
      case "line":
        return <line key={i} x1={mapX(n(s.x1))} y1={mapY(n(s.y1))} x2={mapX(n(s.x2))} y2={mapY(n(s.y2))} stroke={stroke} strokeWidth={1.5} />;
      case "arrow": {
        const x1 = mapX(n(s.from.x));
        const y1 = mapY(n(s.from.y));
        const x2 = mapX(n(s.to.x));
        const y2 = mapY(n(s.to.y));
        const id = `arr-${i}`;
        return (
          <g key={i}>
            <defs>
              <marker id={id} markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill={stroke} />
              </marker>
            </defs>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={1.5} markerEnd={`url(#${id})`} />
          </g>
        );
      }
      case "label":
        return (
          <text key={i} x={mapX(n(s.at.x))} y={mapY(n(s.at.y))} fill={stroke} fontSize={4} fontFamily="var(--font-mono)" textAnchor="middle">
            {s.text}
          </text>
        );
      case "path": {
        let pts: ReturnType<typeof run> | undefined;
        try {
          pts = run(s.points, env);
        } catch {
          return null;
        }
        if (!Array.isArray(pts)) return null;
        const d = pts
          .map((p, idx) => {
            if (!Array.isArray(p) || typeof p[0] !== "number" || typeof p[1] !== "number") return "";
            return `${idx === 0 ? "M" : "L"}${mapX(p[0])},${mapY(p[1])}`;
          })
          .join(" ");
        return <path key={i} d={d} fill="none" stroke={stroke} strokeWidth={1.5} strokeDasharray={s.style === "dashed" ? "3 2" : undefined} />;
      }
      default:
        return null;
    }
  };

  return (
    <svg className="exg-scene" viewBox={`0 0 ${W} ${H}`} style={{ aspectRatio: `${W} / ${H}`, maxHeight: 320 }} role="img">
      {scene.shapes.map((shape, i) => renderShape(shape, i))}
    </svg>
  );
}
