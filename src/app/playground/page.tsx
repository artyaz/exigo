"use client";
/* /playground — a live reactive-spec editor. Author a spec as JSON on the
   left; it is parsed, run through `validateSpec` (§11 errors), and, when
   clean, mounted as a real <ReactiveExercise> on the right. Mirrors the
   design system's playground.html: dark, mono chrome, accent ink. */
import React from "react";
import { ReactiveExercise, validateSpec, type ReactiveSpec, type ValidationResult } from "../_components/exercises";
import { PRESETS } from "./presets";

const CSS = `
.pg{ min-height:100vh; background:var(--neutral-950); color:var(--white-80); font-family:var(--font-sans); }
.pg__head{ display:flex; align-items:baseline; gap:14px; padding:24px 28px 14px; border-bottom:1px solid var(--border-faint); }
.pg__title{ font-size:18px; font-weight:600; color:#fff; letter-spacing:var(--tracking-snug); }
.pg__sub{ font-family:var(--font-mono); font-size:11px; letter-spacing:.16em; text-transform:uppercase; color:var(--white-30); }
.pg__grid{ display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:0; min-height:calc(100vh - 64px); }
@media (max-width:900px){ .pg__grid{ grid-template-columns:1fr; } }
.pg__pane{ padding:18px 22px; display:flex; flex-direction:column; gap:12px; min-width:0; }
.pg__pane--edit{ border-right:1px solid var(--border-faint); }
.pg__chips{ display:flex; flex-wrap:wrap; gap:7px; }
.pg__chip{ font-family:var(--font-mono); font-size:11px; letter-spacing:.08em; padding:5px 11px; border-radius:99px; background:var(--white-03); border:1px solid var(--border); color:var(--white-60); cursor:pointer; transition:all 200ms var(--ease-spring); }
.pg__chip:hover{ background:var(--white-08); color:#fff; }
.pg__chip--on{ background:rgb(52 211 153 / .12); border-color:rgb(52 211 153 / .4); color:var(--emerald-400); }
.pg__editor{ flex:1; min-height:320px; width:100%; resize:vertical; font-family:var(--font-mono); font-size:12.5px; line-height:1.65; tab-size:2; color:var(--white-85); background:var(--surface-sunken); border:1px solid var(--border); border-radius:var(--radius-xl); padding:14px 16px; outline:none; white-space:pre; overflow:auto; }
.pg__editor:focus{ border-color:rgb(52 211 153 / .4); box-shadow:0 0 0 2px rgb(52 211 153 / .15); }
.pg__status{ display:flex; align-items:center; gap:8px; font-family:var(--font-mono); font-size:11px; letter-spacing:.1em; text-transform:uppercase; }
.pg__dot{ width:7px; height:7px; border-radius:50%; }
.pg__dot--ok{ background:var(--emerald-400); box-shadow:0 0 10px rgb(52 211 153 / .6); }
.pg__dot--no{ background:var(--rose-400); box-shadow:0 0 10px rgb(251 113 133 / .6); }
.pg__errs{ display:flex; flex-direction:column; gap:6px; }
.pg__err{ display:flex; gap:9px; padding:9px 12px; border-radius:var(--radius-lg); background:rgb(251 113 133 / .07); border:1px solid rgb(251 113 133 / .3); }
.pg__err-path{ flex:none; font-family:var(--font-mono); font-size:11px; color:var(--rose-400); }
.pg__err-msg{ font-size:12.5px; line-height:1.5; color:var(--white-80); }
.pg__warn{ display:flex; gap:9px; padding:9px 12px; border-radius:var(--radius-lg); background:rgb(251 191 36 / .07); border:1px solid rgb(251 191 36 / .26); font-size:12px; color:var(--amber-400); line-height:1.5; }
.pg__hint{ font-size:12px; color:var(--white-40); line-height:1.5; }
`;

interface ParseState {
  spec: ReactiveSpec | null;
  jsonError: string | null;
  validation: ValidationResult | null;
}

function analyze(text: string): ParseState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { spec: null, jsonError: e instanceof Error ? e.message : String(e), validation: null };
  }
  const validation = validateSpec(parsed);
  return { spec: validation.ok ? (parsed as ReactiveSpec) : null, jsonError: null, validation };
}

export default function PlaygroundPage(): React.JSX.Element {
  const [activeId, setActiveId] = React.useState(PRESETS[0]!.id);
  const [text, setText] = React.useState(() => JSON.stringify(PRESETS[0]!.spec, null, 2));

  React.useEffect(() => {
    const el = document.createElement("style");
    el.id = "exg-pg-styles";
    el.textContent = CSS;
    if (!document.getElementById("exg-pg-styles")) document.head.appendChild(el);
    return () => {
      document.getElementById("exg-pg-styles")?.remove();
    };
  }, []);

  const loadPreset = (id: string): void => {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setActiveId(id);
    setText(JSON.stringify(p.spec, null, 2));
  };

  const analysis = React.useMemo(() => analyze(text), [text]);
  const { spec, jsonError, validation } = analysis;

  return (
    <div className="pg">
      <div className="pg__head">
        <span className="pg__title">Exigo Playground</span>
        <span className="pg__sub">Reactive VM · live spec editor</span>
      </div>
      <div className="pg__grid">
        <div className="pg__pane pg__pane--edit">
          <div className="pg__chips">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`pg__chip${p.id === activeId ? " pg__chip--on" : ""}`}
                onClick={() => loadPreset(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <textarea
            className="pg__editor"
            spellCheck={false}
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="spec editor"
          />
          {jsonError ? (
            <>
              <div className="pg__status">
                <span className="pg__dot pg__dot--no" />
                invalid json
              </div>
              <div className="pg__err">
                <span className="pg__err-path">JSON</span>
                <span className="pg__err-msg">{jsonError}</span>
              </div>
            </>
          ) : validation && !validation.ok ? (
            <>
              <div className="pg__status">
                <span className="pg__dot pg__dot--no" />
                {validation.errors.length} error{validation.errors.length === 1 ? "" : "s"}
              </div>
              <div className="pg__errs">
                {validation.errors.map((er, i) => (
                  <div className="pg__err" key={i}>
                    <span className="pg__err-path">{er.path}</span>
                    <span className="pg__err-msg">{er.message}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="pg__status">
              <span className="pg__dot pg__dot--ok" />
              valid spec
            </div>
          )}
          {validation?.warnings.map((w, i) => (
            <div className="pg__warn" key={i}>
              {w}
            </div>
          ))}
        </div>

        <div className="pg__pane">
          {spec ? (
            <ReactiveExercise key={text} spec={spec} />
          ) : (
            <div className="pg__hint">Fix the spec on the left to mount a live preview here.</div>
          )}
        </div>
      </div>
    </div>
  );
}
