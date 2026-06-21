"use client";
/* The Atlas explorer: kicks off the streaming pyramid and renders it as Apple-
   Finder miller columns (science → subtopic → lesson), each prior level kept on
   the left. The lesson column shows the prose with its inline exercises slotted
   between paragraphs, each rendered live in the embed sandbox as it arrives. */
import React from "react";
import { EmbedExercise } from "../embed";
import { renderInline } from "../shell/runtimeUi";
import { ATLAS_DEFAULT, ATLAS_QUICK, type AtlasConfig, type AtlasEvent, type BuiltExercise, type Lesson, type Science, type Subtopic } from "./types";

interface State {
  sciences: Science[];
  subs: Record<string, Subtopic[]>; // by scienceId
  lessons: Record<string, Lesson>; // by subtopicId
  built: Record<string, BuiltExercise>; // by exerciseId
  errors: string[];
}
const EMPTY: State = { sciences: [], subs: {}, lessons: {}, built: {}, errors: [] };

function reduce(s: State, e: AtlasEvent): State {
  switch (e.type) {
    case "sciences":
      return { ...s, sciences: e.sciences };
    case "subtopics":
      return { ...s, subs: { ...s.subs, [e.scienceId]: e.subtopics } };
    case "lesson":
      return { ...s, lessons: { ...s.lessons, [e.lesson.subtopicId]: e.lesson } };
    case "exercise":
      return { ...s, built: { ...s.built, [e.built.id]: e.built } };
    case "error":
      return { ...s, errors: [...s.errors, `${e.stage}: ${e.message}`] };
    default:
      return s;
  }
}

async function streamAtlas(config: AtlasConfig, onEvent: (e: AtlasEvent) => void, signal: AbortSignal): Promise<void> {
  const res = await fetch("/api/generate/atlas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config }),
    signal,
  });
  if (!res.body) throw new Error("no stream");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) {
        try {
          onEvent(JSON.parse(line) as AtlasEvent);
        } catch {
          /* partial/garbled line — skip */
        }
      }
    }
  }
}

export function AtlasExplorer(): React.JSX.Element {
  const [state, setState] = React.useState<State>(EMPTY);
  const [status, setStatus] = React.useState<"idle" | "running" | "done" | "error">("idle");
  const [config, setConfig] = React.useState<AtlasConfig>(ATLAS_QUICK);
  const [cfgOpen, setCfgOpen] = React.useState(false);
  const [sci, setSci] = React.useState<string | null>(null);
  const [sub, setSub] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    const el = document.createElement("style");
    el.textContent = ATLAS_CSS;
    el.id = "exg-atlas-styles";
    if (!document.getElementById("exg-atlas-styles")) document.head.appendChild(el);
    return () => document.getElementById("exg-atlas-styles")?.remove();
  }, []);

  const run = async (): Promise<void> => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState(EMPTY);
    setSci(null);
    setSub(null);
    setStatus("running");
    try {
      await streamAtlas(config, (e) => setState((s) => reduce(s, e)), ctrl.signal);
      setStatus("done");
    } catch (e) {
      if (!ctrl.signal.aborted) setStatus("error");
      void e;
    }
  };

  React.useEffect(() => () => abortRef.current?.abort(), []);

  const builtCount = Object.values(state.built).filter((b) => b.html || b.error).length;
  const lesson = sub ? state.lessons[sub] : undefined;

  return (
    <div className="atl">
      <div className="atl__head">
        <span className="atl__title">Atlas</span>
        <span className="atl__sub">parallel knowledge pyramid</span>
        <button className="atl__btn atl__btn--ghost" type="button" onClick={() => setCfgOpen(true)} disabled={status === "running"} style={{ marginLeft: "auto" }}>
          {config.sciences}×{config.subtopicsPerScience}×{config.exercisesPerLesson.max} · configure
        </button>
        <button className="atl__btn" type="button" onClick={run} disabled={status === "running"}>
          {status === "running" ? "Generating…" : "Generate atlas"}
        </button>
        <span className="atl__stat">
          {state.sciences.length} sci · {Object.keys(state.lessons).length} lessons · {builtCount} exercises
          {status === "error" ? " · stream error" : ""}
        </span>
      </div>

      <div className="atl__cols">
        <Column title="Science">
          {state.sciences.length === 0 ? <Empty status={status} /> : null}
          {state.sciences.map((s) => (
            <Row key={s.id} active={sci === s.id} onClick={() => (setSci(s.id), setSub(null))} label={s.name} meta={`${state.subs[s.id]?.length ?? 0}`} loading={!state.subs[s.id]} />
          ))}
        </Column>

        <Column title="Subtopic">
          {sci ? (
            (state.subs[sci] ?? []).map((t) => {
              const l = state.lessons[t.id];
              return <Row key={t.id} active={sub === t.id} onClick={() => setSub(t.id)} label={t.title} sublabel={t.blurb} meta={l ? `${l.exercises.length}` : ""} loading={!l} />;
            })
          ) : (
            <Hint>Pick a science.</Hint>
          )}
        </Column>

        <Column title="Lesson" wide>
          {!sub ? (
            <Hint>Pick a subtopic.</Hint>
          ) : !lesson ? (
            <Hint>Writing lesson…</Hint>
          ) : (
            <LessonView lesson={lesson} built={state.built} />
          )}
        </Column>
      </div>

      {cfgOpen && (
        <ConfigModal
          config={config}
          onClose={() => setCfgOpen(false)}
          onApply={(c) => {
            setConfig(c);
            setCfgOpen(false);
          }}
        />
      )}
    </div>
  );
}

/* ── Config modal: linked sliders + odometer-rolling derived totals ─── */
interface Draft {
  sciences: number;
  subtopics: number;
  exercises: number;
  brainstorm: number;
  concurrency: number;
  retries: number;
}
const toDraft = (c: AtlasConfig): Draft => ({
  sciences: c.sciences,
  subtopics: c.subtopicsPerScience,
  exercises: c.exercisesPerLesson.max,
  brainstorm: c.brainstorm,
  concurrency: c.concurrency,
  retries: c.retries,
});
const toConfig = (d: Draft): AtlasConfig => ({
  sciences: d.sciences,
  subtopicsPerScience: d.subtopics,
  exercisesPerLesson: { min: d.exercises, max: d.exercises },
  brainstorm: d.brainstorm,
  concurrency: d.concurrency,
  retries: d.retries,
});

function ConfigModal({ config, onApply, onClose }: { config: AtlasConfig; onApply: (c: AtlasConfig) => void; onClose: () => void }): React.JSX.Element {
  const [d, setD] = React.useState<Draft>(() => toDraft(config));
  const set = (k: keyof Draft) => (v: number) => setD((prev) => ({ ...prev, [k]: v }));

  const totalSub = d.sciences * d.subtopics;
  const totalLessons = totalSub;
  const totalEx = totalLessons * d.exercises;
  const estCalls = 1 + d.sciences + totalSub + totalEx * 2;

  return (
    <div className="atl__scrim" onClick={onClose}>
      <div className="atl__modal" onClick={(e) => e.stopPropagation()}>
        <div className="atl__modal-h">
          <span className="atl__modal-title">Pyramid size</span>
          <button type="button" className="atl__x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="atl__derived">
          <Metric label="subtopics" value={totalSub} />
          <span className="atl__darrow">→</span>
          <Metric label="lessons" value={totalLessons} />
          <span className="atl__darrow">→</span>
          <Metric label="exercises" value={totalEx} accent />
          <span className="atl__darrow">≈</span>
          <Metric label="LLM calls" value={estCalls} />
        </div>

        <div className="atl__sliders">
          <Slider label="Sciences" value={d.sciences} min={1} max={20} onChange={set("sciences")} />
          <Slider label="Subtopics / science" value={d.subtopics} min={1} max={6} onChange={set("subtopics")} />
          <Slider label="Exercises / lesson" value={d.exercises} min={1} max={5} onChange={set("exercises")} />
          <Slider label="Brainstorm ideas" value={d.brainstorm} min={3} max={8} onChange={set("brainstorm")} />
          <Slider label="Concurrency" value={d.concurrency} min={1} max={12} onChange={set("concurrency")} />
          <Slider label="Retries / call" value={d.retries} min={1} max={5} onChange={set("retries")} />
        </div>

        <div className="atl__modal-f">
          <button type="button" className="atl__btn atl__btn--ghost" onClick={() => setD(toDraft(ATLAS_QUICK))}>quick</button>
          <button type="button" className="atl__btn atl__btn--ghost" onClick={() => setD(toDraft(ATLAS_DEFAULT))}>full</button>
          <span style={{ flex: 1 }} />
          <button type="button" className="atl__btn" onClick={() => onApply(toConfig(d))}>Apply</button>
        </div>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }): React.JSX.Element {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="atl__sld">
      <div className="atl__sld-top">
        <span className="atl__sld-label">{label}</span>
        <Roll value={value} className="atl__sld-val" />
      </div>
      <input
        type="range"
        className="atl__range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ["--pct" as string]: `${pct}%` }}
      />
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: number; accent?: boolean }): React.JSX.Element {
  return (
    <div className={`atl__metric${accent ? " atl__metric--on" : ""}`}>
      <Roll value={value} className="atl__metric-val" />
      <span className="atl__metric-lab">{label}</span>
    </div>
  );
}

/** Odometer: each digit is a 9→0 strip translated so the live digit shows; on
    change it rolls (new digit drops in from the top). */
function Roll({ value, className }: { value: number; className?: string }): React.JSX.Element {
  const digits = String(Math.max(0, Math.round(value))).split("");
  return (
    <span className={`atl__odo${className ? " " + className : ""}`} aria-label={String(value)}>
      {digits.map((dch, i) => (
        <span className="atl__odo-col" key={`${digits.length}-${i}`}>
          <span className="atl__odo-strip" style={{ transform: `translateY(-${9 - Number(dch)}em)` }}>
            {Array.from({ length: 10 }, (_, n) => (
              <span className="atl__odo-d" key={n}>
                {9 - n}
              </span>
            ))}
          </span>
        </span>
      ))}
    </span>
  );
}

function LessonView({ lesson, built }: { lesson: Lesson; built: Record<string, BuiltExercise> }): React.JSX.Element {
  const paras = lesson.content.split(/\n\s*\n/).filter((p) => p.trim());
  return (
    <div className="atl__lesson">
      <h2 className="atl__lh">{lesson.title}</h2>
      {/* interleave: paragraph, then the exercise that slots after it */}
      {Math.max(paras.length, lesson.exercises.length) > 0 &&
        Array.from({ length: Math.max(paras.length, lesson.exercises.length) }).map((_, i) => (
          <React.Fragment key={i}>
            {paras[i] ? <p className="atl__p">{renderInline(paras[i])}</p> : null}
            {lesson.exercises[i] ? <ExerciseSlot built={built[lesson.exercises[i].id]} /> : null}
          </React.Fragment>
        ))}
    </div>
  );
}

function ExerciseSlot({ built }: { built?: BuiltExercise }): React.JSX.Element {
  if (!built) return <div className="atl__exwait">building exercise…</div>;
  if (built.error || !built.html) return <div className="atl__exerr">exercise failed: {built.error ?? "no html"}</div>;
  return (
    <div className="atl__ex">
      <EmbedExercise html={built.html} />
    </div>
  );
}

function Column({ title, wide, children }: { title: string; wide?: boolean; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className={`atl__col${wide ? " atl__col--wide" : ""}`}>
      <div className="atl__coltitle">{title}</div>
      <div className="atl__collist">{children}</div>
    </div>
  );
}
function Row({ label, sublabel, meta, active, loading, onClick }: { label: string; sublabel?: string; meta?: string; active?: boolean; loading?: boolean; onClick: () => void }): React.JSX.Element {
  return (
    <button type="button" className={`atl__row${active ? " atl__row--on" : ""}`} onClick={onClick}>
      <span className="atl__rowmain">
        <span className="atl__rowlabel">{label}</span>
        {sublabel ? <span className="atl__rowsub">{sublabel}</span> : null}
      </span>
      {loading ? <span className="atl__spin" /> : meta ? <span className="atl__meta">{meta}</span> : null}
      <span className="atl__chev">›</span>
    </button>
  );
}
function Hint({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="atl__hint">{children}</div>;
}
function Empty({ status }: { status: string }): React.JSX.Element {
  return <div className="atl__hint">{status === "running" ? "Choosing sciences…" : "Press Generate atlas."}</div>;
}

const ATLAS_CSS = `
.atl{ min-height:100vh; background:#000; color:var(--white-80); font-family:var(--font-sans); display:flex; flex-direction:column; }
.atl__head{ display:flex; align-items:center; gap:14px; padding:18px 22px; border-bottom:1px solid var(--border-faint); flex:none; }
.atl__title{ font-size:18px; font-weight:600; color:#fff; }
.atl__sub{ font-family:var(--font-mono); font-size:11px; letter-spacing:.16em; text-transform:uppercase; color:var(--white-30); }
.atl__toggle{ margin-left:auto; display:flex; align-items:center; gap:6px; font-family:var(--font-mono); font-size:11px; color:var(--white-50); }
.atl__btn{ font-family:var(--font-mono); font-size:12px; letter-spacing:.06em; padding:8px 16px; border-radius:99px; background:rgb(52 211 153 / .14); border:1px solid rgb(52 211 153 / .4); color:var(--emerald-400); cursor:pointer; }
.atl__btn:disabled{ opacity:.5; cursor:default; }
.atl__stat{ font-family:var(--font-mono); font-size:11px; color:var(--white-40); }
.atl__cols{ display:flex; flex:1; min-height:0; }
.atl__col{ width:240px; flex:none; border-right:1px solid var(--border-faint); display:flex; flex-direction:column; min-height:0; }
.atl__col--wide{ flex:1; width:auto; }
.atl__coltitle{ font-family:var(--font-mono); font-size:9.5px; letter-spacing:.18em; text-transform:uppercase; color:var(--white-30); padding:10px 14px; border-bottom:1px solid var(--border-faint); flex:none; }
.atl__collist{ overflow:auto; padding:6px; display:flex; flex-direction:column; gap:2px; }
.atl__row{ display:flex; align-items:center; gap:8px; text-align:left; padding:8px 10px; border-radius:8px; background:transparent; border:0; color:var(--white-75); cursor:pointer; }
.atl__row:hover{ background:var(--white-04, rgba(255,255,255,.04)); }
.atl__row--on{ background:rgb(52 211 153 / .12); color:#fff; }
.atl__rowmain{ display:flex; flex-direction:column; gap:1px; min-width:0; flex:1; }
.atl__rowlabel{ font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.atl__rowsub{ font-size:11px; color:var(--white-40); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.atl__meta{ font-family:var(--font-mono); font-size:10px; color:var(--white-40); }
.atl__chev{ color:var(--white-25); font-size:15px; flex:none; }
.atl__row--on .atl__chev{ color:var(--emerald-400); }
.atl__spin{ width:11px; height:11px; border-radius:50%; border:1.5px solid var(--white-15); border-top-color:var(--emerald-400); animation:atl-spin .7s linear infinite; flex:none; }
@keyframes atl-spin{ to{ transform:rotate(360deg); } }
.atl__hint{ padding:16px; font-size:12.5px; color:var(--white-40); }
.atl__lesson{ overflow:auto; padding:22px 26px; max-width:820px; }
.atl__lh{ font-size:22px; font-weight:600; color:#fff; letter-spacing:-.01em; margin:0 0 14px; }
.atl__p{ font-size:15px; line-height:1.7; color:var(--white-80); margin:0 0 14px; }
.atl__p b{ color:#fff; } .atl__p code{ font-family:var(--font-mono); font-size:.86em; background:var(--white-08); padding:.05em .35em; border-radius:4px; }
.atl__ex{ margin:18px 0; }
.atl__exwait{ margin:18px 0; padding:18px; border:1px dashed var(--border); border-radius:14px; font-family:var(--font-mono); font-size:11.5px; color:var(--white-40); display:flex; align-items:center; gap:10px; }
.atl__exwait::before{ content:""; width:12px; height:12px; border-radius:50%; border:1.5px solid var(--white-15); border-top-color:var(--emerald-400); animation:atl-spin .7s linear infinite; }
.atl__exerr{ margin:18px 0; padding:14px; border:1px solid rgb(251 113 133 / .4); border-radius:14px; font-size:12px; color:var(--rose-400); }
.atl__btn--ghost{ background:var(--white-03); border-color:var(--border); color:var(--white-60); }
.atl__btn--ghost:hover:not(:disabled){ background:var(--white-08); color:#fff; }
/* config modal */
.atl__scrim{ position:fixed; inset:0; background:rgba(0,0,0,.6); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; z-index:50; animation:atl-fade .2s ease; }
@keyframes atl-fade{ from{ opacity:0 } }
.atl__modal{ width:540px; max-width:92vw; background:var(--neutral-950); border:1px solid var(--border); border-radius:18px; box-shadow:0 24px 60px -16px rgba(0,0,0,.85); padding:20px 22px; animation:atl-pop .28s cubic-bezier(.175,.885,.32,1.275); }
@keyframes atl-pop{ from{ transform:scale(.96); opacity:0 } }
.atl__modal-h{ display:flex; align-items:center; margin-bottom:16px; }
.atl__modal-title{ font-size:15px; font-weight:600; color:#fff; letter-spacing:-.01em; }
.atl__x{ margin-left:auto; background:transparent; border:0; color:var(--white-40); cursor:pointer; font-size:13px; }
.atl__x:hover{ color:#fff; }
.atl__modal-f{ display:flex; align-items:center; gap:8px; margin-top:20px; }
.atl__derived{ display:flex; align-items:center; justify-content:center; gap:12px; padding:16px; margin-bottom:6px; background:var(--white-03); border:1px solid var(--border-faint); border-radius:14px; }
.atl__metric{ display:flex; flex-direction:column; align-items:center; gap:4px; min-width:52px; }
.atl__metric-val{ font-family:var(--font-mono); font-size:25px; color:#fff; font-weight:500; }
.atl__metric--on .atl__metric-val{ color:var(--emerald-400); }
.atl__metric-lab{ font-family:var(--font-mono); font-size:9px; letter-spacing:.12em; text-transform:uppercase; color:var(--white-40); }
.atl__darrow{ color:var(--white-25); font-size:13px; }
.atl__sliders{ display:flex; flex-direction:column; gap:15px; padding-top:8px; }
.atl__sld-top{ display:flex; align-items:baseline; justify-content:space-between; margin-bottom:8px; }
.atl__sld-label{ font-size:12.5px; color:var(--white-70); }
.atl__sld-val{ font-family:var(--font-mono); font-size:16px; color:#fff; }
.atl__range{ -webkit-appearance:none; appearance:none; width:100%; height:6px; border-radius:99px; outline:none; cursor:pointer;
  background:linear-gradient(90deg, var(--emerald-400) var(--pct,50%), var(--white-10) var(--pct,50%)); }
.atl__range::-webkit-slider-thumb{ -webkit-appearance:none; appearance:none; width:18px; height:18px; border-radius:50%; background:#fff; border:0; box-shadow:0 2px 8px rgba(0,0,0,.5); transition:transform .15s var(--ease-spring); }
.atl__range::-webkit-slider-thumb:active{ transform:scale(1.2); }
.atl__range::-moz-range-thumb{ width:18px; height:18px; border-radius:50%; background:#fff; border:0; }
.atl__odo{ display:inline-flex; font-variant-numeric:tabular-nums; line-height:1; }
.atl__odo-col{ display:inline-block; height:1em; overflow:hidden; }
.atl__odo-strip{ display:flex; flex-direction:column; transition:transform .55s cubic-bezier(.16,1,.3,1); }
.atl__odo-d{ height:1em; display:flex; align-items:center; justify-content:center; }
`;
