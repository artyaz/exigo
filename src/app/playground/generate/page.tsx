"use client";
/* /playground/generate — the generation harness. Two modes, both driving the
   SAME production modules as a real lesson flow, with extra instrumentation:

   1. Brief → exercise: construction in isolation. Write a brief, watch the
      constructor emit markup, parse, validate, and repair. Shows every attempt.
   2. Topic → lesson → exercises: the full pipeline. A smart model drafts a
      lesson with inline briefs; the constructor realises each one.

   The only difference from production is that the trigger is a form and the
   internals (raw markup, validator errors, repair turns) are surfaced. */
import React from "react";
import { ReactiveExercise, type ReactiveSpec } from "../../_components/exercises";
import { OpenExercise } from "../../_components/exercises/open";
import { EmbedExercise } from "../../_components/exercises/embed";
import { Commentable } from "../../_components/exercises/comments/Commentable";

interface OpenResult {
  provider?: string;
  model?: string;
  plan?: string;
  html?: string;
  raw?: string;
  error?: string;
}

interface EmbedResult {
  provider?: string;
  model?: string;
  plan?: string;
  html?: string;
  raw?: string;
  error?: string;
}

// Structural mirrors of the API JSON (kept local so this client page never
// imports the server-only generation modules).
interface Attempt {
  markup: string;
  errors: { line: number; message: string }[];
  ok: boolean;
}
interface ConstructionResult {
  ok: boolean;
  spec?: ReactiveSpec;
  markup: string;
  attempts: Attempt[];
  provider?: string;
  model?: string;
  error?: string;
}
interface LessonStepResult {
  role: string;
  brief: { concept: string; criticalThinking: string };
  result: ConstructionResult;
}
interface LessonResult {
  provider?: string;
  model?: string;
  draft?: { title: string; summary?: string };
  steps?: LessonStepResult[];
  error?: string;
  raw?: string;
}

const CSS = `
.gn{ min-height:100vh; background:var(--neutral-950); color:var(--white-80); font-family:var(--font-sans); }
.gn__head{ display:flex; align-items:baseline; gap:14px; padding:24px 28px 14px; border-bottom:1px solid var(--border-faint); }
.gn__title{ font-size:18px; font-weight:600; color:#fff; letter-spacing:var(--tracking-snug); }
.gn__sub{ font-family:var(--font-mono); font-size:11px; letter-spacing:.16em; text-transform:uppercase; color:var(--white-30); }
.gn__tabs{ display:flex; gap:7px; margin-left:auto; }
.gn__tab{ font-family:var(--font-mono); font-size:11px; letter-spacing:.08em; padding:5px 13px; border-radius:99px; background:var(--white-03); border:1px solid var(--border); color:var(--white-60); cursor:pointer; }
.gn__tab--on{ background:rgb(52 211 153 / .12); border-color:rgb(52 211 153 / .4); color:var(--emerald-400); }
.gn__grid{ display:grid; grid-template-columns:minmax(0,420px) minmax(0,1fr); min-height:calc(100vh - 64px); }
@media (max-width:900px){ .gn__grid{ grid-template-columns:1fr; } }
.gn__pane{ padding:18px 22px; display:flex; flex-direction:column; gap:12px; min-width:0; }
.gn__pane--edit{ border-right:1px solid var(--border-faint); }
.gn__group{ display:flex; flex-direction:column; gap:6px; }
.gn__label{ font-family:var(--font-mono); font-size:10.5px; letter-spacing:.1em; text-transform:uppercase; color:var(--white-40); }
.gn__input,.gn__area,.gn__select{ font-family:var(--font-mono); font-size:12.5px; color:var(--white-85); background:var(--surface-sunken); border:1px solid var(--border); border-radius:var(--radius-lg); padding:9px 12px; outline:none; width:100%; }
.gn__area{ resize:vertical; min-height:54px; line-height:1.5; }
.gn__input:focus,.gn__area:focus,.gn__select:focus{ border-color:rgb(52 211 153 / .4); box-shadow:0 0 0 2px rgb(52 211 153 / .15); }
.gn__btn{ align-self:flex-start; font-family:var(--font-mono); font-size:12px; letter-spacing:.08em; padding:9px 18px; border-radius:99px; background:rgb(52 211 153 / .14); border:1px solid rgb(52 211 153 / .4); color:var(--emerald-400); cursor:pointer; }
.gn__btn:hover{ background:rgb(52 211 153 / .22); }
.gn__btn:disabled{ opacity:.5; cursor:default; }
.gn__meta{ display:flex; gap:10px; flex-wrap:wrap; font-family:var(--font-mono); font-size:11px; color:var(--white-40); }
.gn__pill{ padding:3px 9px; border-radius:99px; background:var(--white-05); border:1px solid var(--border); }
.gn__pill--ok{ color:var(--emerald-400); border-color:rgb(52 211 153 / .4); }
.gn__pill--no{ color:var(--rose-400); border-color:rgb(251 113 133 / .4); }
.gn__attempt{ border:1px solid var(--border); border-radius:var(--radius-lg); padding:10px 12px; display:flex; flex-direction:column; gap:6px; }
.gn__err{ display:flex; gap:8px; font-size:12px; }
.gn__err-l{ flex:none; font-family:var(--font-mono); font-size:10.5px; color:var(--rose-400); }
.gn__err-m{ color:var(--white-75); line-height:1.45; }
.gn__code{ font-family:var(--font-mono); font-size:11px; line-height:1.5; color:var(--white-55); background:var(--surface-sunken); border:1px solid var(--border); border-radius:var(--radius-lg); padding:10px 12px; white-space:pre-wrap; overflow:auto; max-height:240px; }
.gn__card{ border:1px solid var(--border-faint); border-radius:var(--radius-xl); padding:14px; display:flex; flex-direction:column; gap:10px; margin-bottom:16px; }
.gn__role{ font-family:var(--font-mono); font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--azure-400); }
.gn__concept{ font-size:13.5px; color:#fff; }
.gn__hint{ font-size:12px; color:var(--white-40); line-height:1.55; }
details summary{ cursor:pointer; font-family:var(--font-mono); font-size:11px; color:var(--white-50); }
.gn__plan{ font-size:13px; line-height:1.6; color:var(--white-75); background:var(--white-03); border:1px solid var(--border-faint); border-radius:var(--radius-lg); padding:11px 13px; }
.gn__plan b{ color:var(--azure-400); font-weight:600; }
.exg-open{ display:flex; flex-direction:column; gap:8px; }
.exg-open__prox{ height:3px; border-radius:99px; background:var(--white-08); overflow:hidden; }
.exg-open__prox i{ display:block; height:100%; background:var(--emerald-400); transition:width .35s var(--ease-spring); }
.exg-open__frame{ width:100%; border:1px solid var(--border-faint); border-radius:var(--radius-xl); background:var(--surface-sunken); }
.exg-open__done{ font-family:var(--font-mono); font-size:11.5px; letter-spacing:.06em; color:var(--emerald-400); }
.exg-open__done--no{ color:var(--rose-400); }
.exg-embed{ display:flex; flex-direction:column; gap:8px; }
.exg-embed__prox{ height:3px; border-radius:99px; background:var(--white-08); overflow:hidden; }
.exg-embed__prox i{ display:block; height:100%; background:var(--emerald-400); transition:width .35s var(--ease-spring); }
.exg-embed__frame{ display:block; border:1px solid var(--border); border-radius:var(--radius-2xl); background:#000; box-shadow:var(--shadow-card); overflow:hidden; }
.exg-embed__done{ font-family:var(--font-mono); font-size:11.5px; letter-spacing:.06em; color:var(--emerald-400); }
.exg-embed__done--no{ color:var(--rose-400); }
`;

const SAMPLE_BRIEF = {
  concept: "A monotonic buffer allocator bumps a pointer and never frees",
  misconception: "Reallocating to grow a vector is cheap and reclaims the old block",
  archetype: "arena",
  dataModel: "blocks list (id, size, region), bufUsed counter, heapCount counter; a 128B buffer that overflows to the heap",
  codeIntent: "Learner edits JS that calls reserve(name, bytes); each reserve emits alloc(id, size, region) — hold all 128B with no heap spill",
  goal: "no allocation escapes to the heap and the buffer holds at least 128B",
  criticalThinking: "When is 'waste memory, never free' the right trade — and when would it bite you?",
};

function StatusPills({ r }: { r: ConstructionResult }): React.JSX.Element {
  const attempts = r.attempts ?? [];
  return (
    <div className="gn__meta">
      {r.provider && <span className="gn__pill">{r.provider}</span>}
      {r.model && <span className="gn__pill">{r.model}</span>}
      <span className={`gn__pill gn__pill--${r.ok ? "ok" : "no"}`}>{r.ok ? "valid" : "failed"}</span>
      <span className="gn__pill">
        {attempts.length} attempt{attempts.length === 1 ? "" : "s"}
      </span>
    </div>
  );
}

function AttemptTrace({ attempts }: { attempts: Attempt[] }): React.JSX.Element {
  return (
    <>
      {attempts.map((a, i) => (
        <div className="gn__attempt" key={i}>
          <div className="gn__meta">
            <span className={`gn__pill gn__pill--${a.ok ? "ok" : "no"}`}>
              attempt {i + 1} · {a.ok ? "clean" : `${a.errors.length} error${a.errors.length === 1 ? "" : "s"}`}
            </span>
          </div>
          {a.errors.map((e, j) => (
            <div className="gn__err" key={j}>
              <span className="gn__err-l">{e.line ? `L${e.line}` : "•"}</span>
              <span className="gn__err-m">{e.message}</span>
            </div>
          ))}
          {!a.ok && (
            <details>
              <summary>markup</summary>
              <pre className="gn__code">{a.markup}</pre>
            </details>
          )}
        </div>
      ))}
    </>
  );
}

function ConstructionView({ r }: { r: ConstructionResult }): React.JSX.Element {
  const attempts = r.attempts ?? [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <StatusPills r={r} />
      {r.error && <div className="gn__err-m" style={{ color: "var(--rose-400)" }}>{r.error}</div>}
      {r.spec && <ReactiveExercise key={r.markup} spec={r.spec} />}
      <AttemptTrace attempts={attempts} />
      {r.spec && (
        <details>
          <summary>final markup</summary>
          <pre className="gn__code">{r.markup}</pre>
        </details>
      )}
    </div>
  );
}

function OpenView({ r }: { r: OpenResult }): React.JSX.Element {
  if (r.error) {
    return (
      <div>
        <div className="gn__err-m" style={{ color: "var(--rose-400)" }}>{r.error}</div>
        {r.raw && (
          <details>
            <summary>raw model output</summary>
            <pre className="gn__code">{r.raw}</pre>
          </details>
        )}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="gn__meta">
        {r.provider && <span className="gn__pill">{r.provider}</span>}
        {r.model && <span className="gn__pill">{r.model}</span>}
        <span className="gn__pill gn__pill--ok">scripted</span>
      </div>
      {r.plan && <div className="gn__plan">{r.plan}</div>}
      {r.html ? <OpenExercise html={r.html} /> : <div className="gn__hint">No HTML was produced.</div>}
      {r.html && (
        <details>
          <summary>authored html</summary>
          <pre className="gn__code">{r.html}</pre>
        </details>
      )}
    </div>
  );
}

function EmbedView({ r, desc }: { r: EmbedResult; desc: string }): React.JSX.Element {
  if (r.error) {
    return (
      <div>
        <div className="gn__err-m" style={{ color: "var(--rose-400)" }}>{r.error}</div>
        {r.raw && (
          <details>
            <summary>raw model output</summary>
            <pre className="gn__code">{r.raw}</pre>
          </details>
        )}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="gn__meta">
        {r.provider && <span className="gn__pill">{r.provider}</span>}
        {r.model && <span className="gn__pill">{r.model}</span>}
        <span className="gn__pill gn__pill--ok">free html</span>
      </div>
      {r.plan && <div className="gn__plan">{r.plan}</div>}
      {r.html ? (
        <Commentable html={r.html} source="embed" context={desc}>
          <EmbedExercise html={r.html} />
        </Commentable>
      ) : (
        <div className="gn__hint">No HTML was produced.</div>
      )}
      {r.html && (
        <details>
          <summary>authored html</summary>
          <pre className="gn__code">{r.html}</pre>
        </details>
      )}
    </div>
  );
}

export default function GeneratePlayground(): React.JSX.Element {
  const [mode, setMode] = React.useState<"embed" | "brief" | "open" | "lesson">("embed");
  const [brief, setBrief] = React.useState({ ...SAMPLE_BRIEF });
  const [topic, setTopic] = React.useState("How a monotonic buffer allocator trades memory for speed");
  const [description, setDescription] = React.useState(
    "Teach the difference between a hard sell and a soft sell. The learner reads short buyer scenarios and chooses an approach; show, with springy feedback, how the right choice depends on the buyer's readiness — not the seller's preference.",
  );
  const [busy, setBusy] = React.useState(false);
  const [exResult, setExResult] = React.useState<ConstructionResult | null>(null);
  const [lessonResult, setLessonResult] = React.useState<LessonResult | null>(null);
  const [openResult, setOpenResult] = React.useState<OpenResult | null>(null);
  const [embedResult, setEmbedResult] = React.useState<EmbedResult | null>(null);

  React.useEffect(() => {
    const el = document.createElement("style");
    el.id = "exg-gn-styles";
    el.textContent = CSS;
    if (!document.getElementById("exg-gn-styles")) document.head.appendChild(el);
    return () => document.getElementById("exg-gn-styles")?.remove();
  }, []);

  const set = (k: keyof typeof brief) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setBrief((b) => ({ ...b, [k]: e.target.value }));

  const runBrief = async (): Promise<void> => {
    setBusy(true);
    setExResult(null);
    try {
      const res = await fetch("/api/generate/exercise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief }),
      });
      const data = (await res.json()) as Partial<ConstructionResult>;
      // Error responses ({ error }) carry no attempts/ok — normalise so the
      // view always has a well-formed result to render.
      setExResult({ ok: false, markup: "", attempts: [], ...data });
    } catch (e) {
      setExResult({ ok: false, markup: "", attempts: [], error: e instanceof Error ? e.message : "request failed" });
    } finally {
      setBusy(false);
    }
  };

  const runOpen = async (): Promise<void> => {
    setBusy(true);
    setOpenResult(null);
    try {
      const res = await fetch("/api/generate/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief }),
      });
      setOpenResult((await res.json()) as OpenResult);
    } catch (e) {
      setOpenResult({ error: e instanceof Error ? e.message : "request failed" });
    } finally {
      setBusy(false);
    }
  };

  const runEmbed = async (): Promise<void> => {
    setBusy(true);
    setEmbedResult(null);
    try {
      const res = await fetch("/api/generate/embed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      setEmbedResult((await res.json()) as EmbedResult);
    } catch (e) {
      setEmbedResult({ error: e instanceof Error ? e.message : "request failed" });
    } finally {
      setBusy(false);
    }
  };

  const runLesson = async (): Promise<void> => {
    setBusy(true);
    setLessonResult(null);
    try {
      const res = await fetch("/api/generate/lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      setLessonResult((await res.json()) as LessonResult);
    } catch (e) {
      setLessonResult({ error: e instanceof Error ? e.message : "request failed" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gn">
      <div className="gn__head">
        <span className="gn__title">Generate</span>
        <span className="gn__sub">exercise constructor</span>
        <div className="gn__tabs">
          <button type="button" className={`gn__tab${mode === "embed" ? " gn__tab--on" : ""}`} onClick={() => setMode("embed")}>
            describe → exercise
          </button>
          <button type="button" className={`gn__tab${mode === "open" ? " gn__tab--on" : ""}`} onClick={() => setMode("open")}>
            design → exercise
          </button>
          <button type="button" className={`gn__tab${mode === "brief" ? " gn__tab--on" : ""}`} onClick={() => setMode("brief")}>
            brief → markup
          </button>
          <button type="button" className={`gn__tab${mode === "lesson" ? " gn__tab--on" : ""}`} onClick={() => setMode("lesson")}>
            topic → lesson
          </button>
          <a className="gn__tab" href="/playground/atlas" style={{ textDecoration: "none" }}>
            atlas ↗
          </a>
          <a className="gn__tab" href="/playground/collection" style={{ textDecoration: "none" }}>
            collection ↗
          </a>
        </div>
      </div>

      <div className="gn__grid">
        <div className="gn__pane gn__pane--edit">
          {mode === "embed" ? (
            <>
              <Field label="exercise description">
                <textarea
                  className="gn__area"
                  style={{ minHeight: 160 }}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
              <button className="gn__btn" type="button" onClick={runEmbed} disabled={busy}>
                {busy ? "Building…" : "Describe & build"}
              </button>
              <span className="gn__hint">
                A separate agent gets only this description + a library stage (Motion, GSAP, confetti,
                Tailwind) and writes a self-contained HTML exercise. No components, no constraints.
              </span>
            </>
          ) : mode === "lesson" ? (
            <>
              <Field label="topic"><textarea className="gn__area" value={topic} onChange={(e) => setTopic(e.target.value)} /></Field>
              <button className="gn__btn" type="button" onClick={runLesson} disabled={busy}>
                {busy ? "Drafting…" : "Draft & build"}
              </button>
              <span className="gn__hint">
                A smart model drafts a lesson with one inline brief per step; the constructor builds each step.
              </span>
            </>
          ) : (
            <>
              <Field label="concept"><input className="gn__input" value={brief.concept} onChange={set("concept")} /></Field>
              <Field label="misconception"><input className="gn__input" value={brief.misconception} onChange={set("misconception")} /></Field>
              {mode === "brief" && (
                <Field label="archetype">
                  <select className="gn__select" value={brief.archetype} onChange={set("archetype")}>
                    <option value="auto">auto</option>
                    <option value="arena">arena</option>
                    <option value="plot">plot</option>
                    <option value="graph">graph</option>
                  </select>
                </Field>
              )}
              <Field label="data model"><textarea className="gn__area" value={brief.dataModel} onChange={set("dataModel")} /></Field>
              {mode === "brief" && (
                <Field label="code intent"><textarea className="gn__area" value={brief.codeIntent} onChange={set("codeIntent")} /></Field>
              )}
              <Field label="goal"><textarea className="gn__area" value={brief.goal} onChange={set("goal")} /></Field>
              <Field label="critical thinking"><textarea className="gn__area" value={brief.criticalThinking} onChange={set("criticalThinking")} /></Field>
              <button className="gn__btn" type="button" onClick={mode === "open" ? runOpen : runBrief} disabled={busy}>
                {busy ? (mode === "open" ? "Designing…" : "Constructing…") : mode === "open" ? "Design & build" : "Construct"}
              </button>
              <span className="gn__hint">
                {mode === "open"
                  ? "The model picks the best interaction for the concept, then authors a self-contained, scripted exercise — no code field, full freedom."
                  : "The constructor emits markup, which is parsed + validated; on failure the exact errors feed a repair turn."}
              </span>
            </>
          )}
        </div>

        <div className="gn__pane">
          {mode === "embed" ? (
            embedResult ? (
              <EmbedView r={embedResult} desc={description} />
            ) : (
              <div className="gn__hint">Describe an exercise and press Describe &amp; build — the agent writes the whole thing in HTML.</div>
            )
          ) : mode === "open" ? (
            openResult ? (
              <OpenView r={openResult} />
            ) : (
              <div className="gn__hint">Fill the brief and press Design &amp; build — the model chooses the interaction.</div>
            )
          ) : mode === "brief" ? (
            exResult ? (
              <ConstructionView r={exResult} />
            ) : (
              <div className="gn__hint">Fill the brief and press Construct.</div>
            )
          ) : lessonResult ? (
            lessonResult.error ? (
              <div>
                <div className="gn__err-m" style={{ color: "var(--rose-400)" }}>{lessonResult.error}</div>
                {lessonResult.raw && (
                  <details>
                    <summary>raw model output</summary>
                    <pre className="gn__code">{lessonResult.raw}</pre>
                  </details>
                )}
              </div>
            ) : (
              <div>
                <div className="gn__meta" style={{ marginBottom: 12 }}>
                  {lessonResult.provider && <span className="gn__pill">{lessonResult.provider}</span>}
                  {lessonResult.model && <span className="gn__pill">{lessonResult.model}</span>}
                </div>
                {lessonResult.draft && <div className="gn__title" style={{ marginBottom: 12 }}>{lessonResult.draft.title}</div>}
                {lessonResult.steps?.map((s, i) => (
                  <div className="gn__card" key={i}>
                    <span className="gn__role">{s.role}</span>
                    <span className="gn__concept">{s.brief.concept}</span>
                    <ConstructionView r={s.result} />
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="gn__hint">Enter a topic and press Draft &amp; build.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="gn__group">
      <span className="gn__label">{label}</span>
      {children}
    </div>
  );
}
