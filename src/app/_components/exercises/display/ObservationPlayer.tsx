"use client";
/* observationPlayer — the prebuilt observation player rail (v4).
   It owns no domain logic: it reads the observation stream from state
   (`source`, default "obs") and a run version (`version`, default "runId"),
   then replays the stream into the VM as `obs:<kind>` events so the spec's
   reactions can FOLD each observation into visual state. Playback modes:
     instant — apply the whole stream at once
     auto    — advance one observation per frame at `fps`
     step    — advance only on user transport input (◀ ▶) / scrub
   Scrubbing backward dispatches a `play:reset` event (the spec clears its
   visual keys) and re-folds from the start. All timing lives here; the VM
   stays a pure deterministic fold. */
import React from "react";
import type { Env } from "../runtime/expr";
import { run } from "../runtime/expr";
import type { PlaybackSpec, RuntimeEvent, Value } from "../runtime/types";

function readList(expr: string | undefined, env: Env): Value[] {
  if (!expr) return [];
  try {
    const v = run(expr, env);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function readNum(expr: string | undefined, env: Env, fallback = 0): number {
  if (!expr) return fallback;
  try {
    const v = run(expr, env);
    return typeof v === "number" ? v : fallback;
  } catch {
    return fallback;
  }
}
const asRecord = (v: Value): Record<string, Value> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, Value>) : null;

export function ObservationPlayer({
  source = "obs",
  version = "runId",
  playback = { mode: "step" },
  label,
  env,
  dispatch,
}: {
  source?: string;
  version?: string;
  playback?: PlaybackSpec;
  label?: string;
  env: Env;
  dispatch: (e: RuntimeEvent) => void;
}): React.JSX.Element {
  const obs = readList(source, env);
  const ver = readNum(version, env, 0);
  const len = obs.length;
  const mode = playback.mode ?? "step";
  const fps = playback.fps ?? 2;

  const [cursor, setCursor] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  // { version: the run we've folded against, applied: how many obs are folded }
  const foldRef = React.useRef<{ version: number; applied: number }>({ version: -1, applied: 0 });

  const fold = React.useCallback(
    (target: number) => {
      let applied = foldRef.current.applied;
      const clamped = Math.max(0, Math.min(target, obs.length));
      if (clamped < applied) {
        dispatch({ type: "play:reset", payload: {}, timestamp: Date.now() });
        applied = 0;
      }
      for (let i = applied; i < clamped; i++) {
        const o = asRecord(obs[i]!);
        if (o && typeof o.kind === "string") {
          dispatch({ type: `obs:${o.kind}`, payload: o, timestamp: Date.now() });
        }
      }
      foldRef.current.applied = clamped;
    },
    [obs, dispatch],
  );

  // Single source of truth: detect a new run, choose its initial cursor, then
  // fold up to the cursor. Folding dispatches don't change `ver`/`cursor`, so
  // this effect never re-triggers itself.
  React.useEffect(() => {
    if (ver !== foldRef.current.version) {
      foldRef.current = { version: ver, applied: 0 }; // run reaction cleared visual state
      const desired = mode === "instant" ? len : 0;
      if (cursor !== desired) {
        setCursor(desired);
        setPlaying(mode === "auto");
        return; // re-runs with the corrected cursor
      }
      setPlaying(mode === "auto");
    }
    fold(cursor);
  }, [ver, cursor, len, mode, fold]);

  // auto-advance
  React.useEffect(() => {
    if (!playing) return;
    if (cursor >= len) {
      setPlaying(false);
      return;
    }
    const id = window.setTimeout(() => setCursor((c) => Math.min(c + 1, len)), 1000 / fps);
    return () => window.clearTimeout(id);
  }, [playing, cursor, len, fps]);

  const atEnd = cursor >= len;
  const atStart = cursor <= 0;
  const disabled = len === 0;

  return (
    <div className="exg-play">
      {label ? <span className="exg-play__lab">{label}</span> : null}
      <div className="exg-play__bar">
        <button
          className="exg-play__btn"
          type="button"
          disabled={disabled || atStart}
          onClick={() => {
            setPlaying(false);
            setCursor(0);
          }}
          aria-label="to start"
        >
          ⏮
        </button>
        <button
          className="exg-play__btn"
          type="button"
          disabled={disabled || atStart}
          onClick={() => {
            setPlaying(false);
            setCursor((c) => Math.max(0, c - 1));
          }}
          aria-label="step back"
        >
          ◀
        </button>
        <button
          className="exg-play__btn exg-play__btn--play"
          type="button"
          disabled={disabled}
          onClick={() => {
            if (atEnd) setCursor(0);
            setPlaying((p) => !p);
          }}
          aria-label={playing ? "pause" : "play"}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <button
          className="exg-play__btn"
          type="button"
          disabled={disabled || atEnd}
          onClick={() => {
            setPlaying(false);
            setCursor((c) => Math.min(len, c + 1));
          }}
          aria-label="step forward"
        >
          ▶
        </button>
        <button
          className="exg-play__btn"
          type="button"
          disabled={disabled || atEnd}
          onClick={() => {
            setPlaying(false);
            setCursor(len);
          }}
          aria-label="to end"
        >
          ⏭
        </button>
        <input
          className="exg-play__scrub"
          type="range"
          min={0}
          max={Math.max(0, len)}
          step={1}
          value={Math.min(cursor, len)}
          disabled={disabled}
          onChange={(e) => {
            setPlaying(false);
            setCursor(Number(e.target.value));
          }}
          aria-label="scrub observations"
        />
        <span className="exg-play__count">
          {Math.min(cursor, len)} / {len}
        </span>
      </div>
    </div>
  );
}
