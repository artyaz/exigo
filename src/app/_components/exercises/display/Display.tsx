"use client";
/* Display = pure projection of (state, bindings, eval). It never mutates
   state; interaction happens only by dispatching events. Each layer's
   expression fields are evaluated against the VM's display env. */
import React from "react";
import type { DisplayLayer, RuntimeEvent, Value } from "../runtime/types";
import type { Env } from "../runtime/expr";
import { run, toDisplay } from "../runtime/expr";
import { renderInline } from "../shell/runtimeUi";
import { DiagramScene } from "./DiagramScene";
import { CodeProbe } from "./CodeProbe";
import { Sequence } from "./Sequence";
import { ObservationPlayer } from "./ObservationPlayer";
import { Arena } from "./Arena";
import { Plot } from "./Plot";
import { Graph } from "./Graph";

function valNum(e: string, env: Env, fallback = 0): number {
  try {
    const v = run(e, env);
    return typeof v === "number" ? v : fallback;
  } catch {
    return fallback;
  }
}
/** Evaluate an expression, swallowing DSL errors (returns `undefined`). The
    validator rejects bad display exprs up front; this is paint-time defense. */
function safeRun(e: string, env: Env): Value | undefined {
  try {
    return run(e, env);
  } catch {
    return undefined;
  }
}
function valStr(literalOrExpr: string, env: Env): string {
  // a layer value is either an expression or a plain string. We try to
  // evaluate; if it throws (plain prose), we fall back to the literal.
  try {
    const v = run(literalOrExpr, env);
    return v == null ? "" : toDisplay(v);
  } catch {
    return literalOrExpr;
  }
}

function Layer({ layer, env, dispatch }: { layer: DisplayLayer; env: Env; dispatch: (e: RuntimeEvent) => void }): React.JSX.Element | null {
  // `showWhen` gates any layer on the display env (e.g. reveal on `eval.ok`).
  if (layer.showWhen != null && !safeRun(layer.showWhen, env)) return null;
  switch (layer.type) {
    case "text":
      return <div className={`exg-d-text${layer.tone === "muted" ? " exg-d-text--muted" : ""}`}>{valStr(layer.value, env)}</div>;
    case "richText":
      return <div className="exg-d-text">{renderInline(valStr(layer.value, env))}</div>;
    case "stateBadge":
      return (
        <div className="exg-badge">
          {layer.label ? <span className="exg-badge__lab">{layer.label}</span> : null}
          <span className="exg-badge__val">{valStr(layer.value, env)}</span>
        </div>
      );
    case "numberLine": {
      const min = layer.min ?? 0;
      const max = layer.max ?? 100;
      const span = max - min || 1;
      const pct = (v: number): number => Math.max(0, Math.min(100, ((v - min) / span) * 100));
      const cur = valNum(layer.value, env, min);
      const tgt = layer.target != null ? valNum(layer.target, env, min) : null;
      return (
        <div className="exg-nl">
          <div className="exg-nl__track" />
          {tgt != null ? <div className="exg-nl__ghost" style={{ left: `${pct(tgt)}%` }} /> : null}
          <div className="exg-nl__dot" style={{ left: `${pct(cur)}%` }} />
        </div>
      );
    }
    case "cards": {
      const items = safeRun(layer.items, env);
      const list = Array.isArray(items) ? items : [];
      return (
        <div className="exg-cards">
          {list.map((it: Value, i: number) => (
            <div className="exg-card" key={i}>
              {toDisplay(it)}
            </div>
          ))}
        </div>
      );
    }
    case "tape": {
      const cells = safeRun(layer.cells, env);
      const head = valNum(layer.head, env, 0);
      const list = Array.isArray(cells) ? cells : [];
      return (
        <div className="exg-tape">
          {list.map((c: Value, i: number) => (
            <div className={`exg-tape__cell${i === head ? " exg-tape__cell--head" : ""}`} key={i}>
              {c == null || c === "" ? "·" : toDisplay(c)}
            </div>
          ))}
        </div>
      );
    }
    case "sequence":
      return <Sequence items={layer.items} cursor={layer.cursor} label={layer.label} orientation={layer.orientation} env={env} />;
    case "observationPlayer":
      return (
        <ObservationPlayer
          source={layer.source}
          version={layer.version}
          playback={layer.playback}
          label={layer.label}
          env={env}
          dispatch={dispatch}
        />
      );
    case "diagramScene":
      return <DiagramScene scene={layer.scene} env={env} />;
    case "arena":
      return <Arena layer={layer} env={env} />;
    case "plot":
      return <Plot layer={layer} env={env} />;
    case "graph":
      return <Graph layer={layer} env={env} />;
    case "codeProbe":
      return <CodeProbe layer={layer} dispatch={dispatch} />;
    case "controls":
      return (
        <div className="exg-controls">
          {layer.controls.map((c, i) => {
            const disabled = c.disabledWhen ? Boolean(safeRun(c.disabledWhen, env)) : false;
            const fire = (extra?: Record<string, Value>): void => {
              const payload: Record<string, Value> = { ...extra };
              if (c.payload) for (const [k, e] of Object.entries(c.payload)) payload[k] = safeRun(e, env) ?? null;
              dispatch({ type: c.event, payload, timestamp: Date.now() });
            };
            if (c.type === "slider") {
              // Bounds may be expressions so the track always matches the
              // data it scrubs (no dead tail past the real maximum).
              const bound = (v: number | string | undefined, fallback: number): number =>
                typeof v === "string" ? valNum(v, env, fallback) : v ?? fallback;
              const lo = bound(c.min, 0);
              const hi = Math.max(lo, bound(c.max, 100));
              const cur = c.value ? valNum(c.value, env, lo) : lo;
              return (
                <label className="exg-ctl-slider" key={i}>
                  {c.label}
                  <input
                    type="range"
                    min={lo}
                    max={hi}
                    step={c.step ?? 1}
                    value={cur}
                    disabled={disabled}
                    onChange={(e) => fire({ value: Number(e.target.value) })}
                  />
                  <span>
                    {cur}
                    {c.unit ?? ""}
                  </span>
                </label>
              );
            }
            return (
              <button className="exg-ctl-btn" type="button" key={i} disabled={disabled} onClick={() => fire()}>
                {c.label ?? c.event}
              </button>
            );
          })}
        </div>
      );
    default:
      return null;
  }
}

export function Display({ display, env, dispatch }: { display: DisplayLayer[]; env: Env; dispatch: (e: RuntimeEvent) => void }): React.JSX.Element {
  return (
    <>
      {display.map((layer, i) => (
        <Layer key={i} layer={layer} env={env} dispatch={dispatch} />
      ))}
    </>
  );
}
