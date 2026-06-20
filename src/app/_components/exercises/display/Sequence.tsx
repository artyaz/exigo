"use client";
/* sequence — a structural, data-driven viz primitive (v4). It projects an
   ordered list of items as labelled chips: a call stack, a queue, an array,
   a path. The author hands it `[{ id, label, tone }, …]` (or bare strings);
   it never sees domain types and never computes coordinates. An optional
   `cursor` index highlights the active item. This is the first of the
   structural primitives the observation pipeline folds into. */
import React from "react";
import type { Env } from "../runtime/expr";
import { run } from "../runtime/expr";
import type { ToneToken, Value } from "../runtime/types";

const TONE: Record<string, string> = {
  amber: "254 240 138",
  azure: "191 219 254",
  violet: "249 168 212",
  emerald: "52 211 153",
  ok: "52 211 153",
  no: "251 113 133",
  muted: "255 255 255",
  ghost: "255 255 255",
};

function itemRecord(it: Value): Record<string, Value> | null {
  return it && typeof it === "object" && !Array.isArray(it) ? (it as Record<string, Value>) : null;
}
function itemLabel(it: Value): string {
  const o = itemRecord(it);
  if (o) return String(o.label ?? o.id ?? "");
  return it == null ? "" : String(it);
}
function itemTone(it: Value): ToneToken | undefined {
  const o = itemRecord(it);
  return o && typeof o.tone === "string" ? (o.tone as ToneToken) : undefined;
}

export function Sequence({
  items,
  cursor,
  label,
  orientation = "row",
  env,
}: {
  items: string;
  cursor?: string;
  label?: string;
  orientation?: "row" | "stack";
  env: Env;
}): React.JSX.Element {
  const list = ((): Value[] => {
    try {
      const v = run(items, env);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  })();
  const cur = ((): number | null => {
    if (cursor == null) return null;
    try {
      const v = run(cursor, env);
      return typeof v === "number" ? v : null;
    } catch {
      return null;
    }
  })();

  return (
    <div className={`exg-seq exg-seq--${orientation}`}>
      {label ? <span className="exg-seq__lab">{label}</span> : null}
      <div className="exg-seq__track">
        {list.length === 0 ? <span className="exg-seq__empty">∅</span> : null}
        {list.map((it, i) => {
          const tone = itemTone(it);
          const rgb = (tone && TONE[tone]) ?? "255 255 255";
          const isCur = cur === i;
          return (
            <div
              key={i}
              className={`exg-seq__chip${isCur ? " exg-seq__chip--cur" : ""}`}
              style={{ ["--seq-rgb" as string]: rgb, animationDelay: `${i * 40}ms` }}
            >
              <span className="exg-seq__idx">{i}</span>
              <span className="exg-seq__txt">{itemLabel(it)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
