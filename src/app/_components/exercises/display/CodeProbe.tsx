"use client";
/* codeProbe — the first-class code IDE primitive (§2.3).
   Locked regions render calm/muted + syntax-highlighted and are not
   editable; holes are high-contrast, keyboard-reachable, and offer symbol
   autocomplete fed by the harness. Edit affordance is validated against
   harness kind (§2.2) before we get here. Running assembles the source,
   calls the harness, and dispatches the result: for an observation harness
   that means the async, sandboxed observation stream (the v4 pipeline);
   for a legacy harness, the synchronous { ok, log, trace, out }. */
import React from "react";
import type { CodeRegion, DisplayLayer, RuntimeEvent, Value } from "../runtime/types";
import { getHarness } from "../harness/registry";
import { isObservationHarness, type RunResult, type SymbolDoc } from "../harness/types";
import { Ico } from "../shell/runtimeUi";
import { Highlight } from "./highlight";
import { CodeEditor } from "./CodeEditor";

type CodeProbeLayer = Extract<DisplayLayer, { type: "codeProbe" }>;

function initialValues(source: CodeRegion[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of source) {
    if (r.kind === "editableText") out[r.id] = r.initial;
    else if (r.kind === "blankHole") out[r.id] = "";
    else if (r.kind === "choiceHole") out[r.id] = r.choices[0]?.id ?? "";
  }
  return out;
}

function regionText(r: CodeRegion, values: Record<string, string>): string {
  switch (r.kind) {
    case "locked":
      return r.text;
    case "editableText":
      return values[r.id] ?? r.initial;
    case "blankHole":
      return values[r.id] ?? "";
    case "choiceHole": {
      const chosen = values[r.id];
      return r.choices.find((c) => c.id === chosen)?.text ?? "";
    }
  }
}

/** The trailing identifier the autocomplete completes. */
function trailingWord(s: string): string {
  return /[A-Za-z_$][\w$]*$/.exec(s)?.[0] ?? "";
}

export function CodeProbe({
  layer,
  dispatch,
}: {
  layer: CodeProbeLayer;
  dispatch?: (e: RuntimeEvent) => void;
}): React.JSX.Element {
  const [values, setValues] = React.useState<Record<string, string>>(() => initialValues(layer.source));
  const [result, setResult] = React.useState<RunResult | null>(null);
  const [running, setRunning] = React.useState(false);
  // autocomplete: which hole is open + the highlighted candidate index
  const [acOpen, setAcOpen] = React.useState<string | null>(null);
  const [acIndex, setAcIndex] = React.useState(0);

  const harness = getHarness(layer.harness.id);
  const editable = layer.editMode !== "locked";
  const symbols: SymbolDoc[] = isObservationHarness(harness) ? harness.symbols : [];
  const isFreeText = layer.editMode === "singleRegionFreeText" || layer.editMode === "multiRegionFreeText";

  const set = (id: string, v: string): void => setValues((prev) => ({ ...prev, [id]: v }));

  const candidates = (id: string): SymbolDoc[] => {
    const w = trailingWord(values[id] ?? "").toLowerCase();
    if (!w) return [];
    return symbols.filter((s) => s.name.toLowerCase().startsWith(w) && s.name.toLowerCase() !== w).slice(0, 6);
  };

  const accept = (id: string, sym: SymbolDoc): void => {
    const cur = values[id] ?? "";
    const w = trailingWord(cur);
    set(id, cur.slice(0, cur.length - w.length) + (sym.insert ?? sym.name));
    setAcOpen(null);
  };

  const run = async (): Promise<void> => {
    if (!harness || running) return;
    const source = layer.source.map((r) => regionText(r, values)).join("");
    setRunning(true);
    try {
      if (isObservationHarness(harness)) {
        const res = await harness.runObservations(source);
        setResult({
          ok: res.ok,
          error: res.error,
          log: res.log,
          trace: res.observations.map((o) => {
            const { kind, t, ...rest } = o;
            void t;
            const body = Object.entries(rest)
              .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
              .join("  ");
            return { label: String(kind), text: body };
          }),
          out: {},
        });
        if (layer.event && dispatch) {
          dispatch({
            type: layer.event,
            payload: {
              ok: res.ok,
              error: res.error,
              log: res.log as Value[],
              observations: res.observations as unknown as Value,
            },
            timestamp: Date.now(),
          });
        }
      } else {
        const res = harness.run(source);
        setResult(res);
        if (layer.event && dispatch) {
          dispatch({
            type: layer.event,
            payload: {
              ok: res.ok,
              error: res.error,
              log: res.log as Value[],
              trace: res.trace as unknown as Value,
              out: (res.out ?? {}) as Record<string, Value>,
            },
            timestamp: Date.now(),
          });
        }
      }
    } finally {
      setRunning(false);
    }
  };

  const renderHoleInput = (
    r: Extract<CodeRegion, { kind: "blankHole" | "editableText" }>,
  ): React.ReactNode => {
    const placeholder = r.kind === "blankHole" ? r.placeholder : undefined;
    const list = acOpen === r.id ? candidates(r.id) : [];
    return (
      <span key={r.id} className="exg-cp__hole">
        <input
          className="exg-cp__seg-text"
          value={values[r.id]}
          placeholder={placeholder}
          disabled={!editable}
          maxLength={r.maxChars}
          size={Math.max(6, (values[r.id] ?? "").length || (placeholder?.length ?? 6))}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => {
            set(r.id, e.target.value);
            setAcOpen(r.id);
            setAcIndex(0);
          }}
          onFocus={() => setAcOpen(r.id)}
          onBlur={() => window.setTimeout(() => setAcOpen((cur) => (cur === r.id ? null : cur)), 120)}
          onKeyDown={(e) => {
            const cs = candidates(r.id);
            if (cs.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setAcIndex((i) => (i + 1) % cs.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setAcIndex((i) => (i - 1 + cs.length) % cs.length);
            } else if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              accept(r.id, cs[acIndex % cs.length]!);
            } else if (e.key === "Escape") {
              setAcOpen(null);
            }
          }}
          aria-label="edit code"
        />
        {list.length > 0 ? (
          <span className="exg-cp__ac" role="listbox">
            {list.map((s, i) => (
              <span
                key={s.name}
                className={`exg-cp__ac-item${i === acIndex % list.length ? " exg-cp__ac-item--on" : ""}`}
                role="option"
                aria-selected={i === acIndex % list.length}
                onMouseDown={(e) => {
                  e.preventDefault();
                  accept(r.id, s);
                }}
              >
                <span className="exg-cp__ac-name">{s.signature ?? s.name}</span>
                {s.doc ? <span className="exg-cp__ac-doc">{s.doc}</span> : null}
              </span>
            ))}
          </span>
        ) : null}
      </span>
    );
  };

  const renderRegion = (r: CodeRegion): React.ReactNode => {
    if (r.kind === "locked") {
      return (
        <span key={r.id} className="exg-cp__locked">
          <Highlight code={r.text} />
        </span>
      );
    }
    if (r.kind === "choiceHole") {
      return (
        <select
          key={r.id}
          className="exg-cp__seg-choice"
          value={values[r.id]}
          disabled={!editable}
          onChange={(e) => set(r.id, e.target.value)}
          aria-label="choose code"
        >
          {r.choices.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label ?? c.text}
            </option>
          ))}
        </select>
      );
    }
    return renderHoleInput(r);
  };

  const renderFreeRegion = (r: CodeRegion): React.ReactNode => {
    if (r.kind === "locked") {
      return (
        <pre key={r.id} className="exg-cp__locked-block">
          <Highlight code={r.text} />
        </pre>
      );
    }
    if (r.kind === "editableText") {
      return (
        <CodeEditor
          key={r.id}
          value={values[r.id] ?? r.initial}
          onChange={(v) => set(r.id, v)}
          language={layer.language}
          symbols={symbols}
          disabled={!editable}
          minRows={8}
        />
      );
    }
    return <div key={r.id}>{renderRegion(r)}</div>;
  };

  return (
    <div className="exg-cp">
      <div className="exg-cp__editor">
        <div className="exg-cp__top">
          <span>source</span>
          <span className="exg-cp__lang">{layer.language}</span>
        </div>
        {isFreeText ? (
          <div className="exg-cp__regions">{layer.source.map(renderFreeRegion)}</div>
        ) : (
          <pre className="exg-cp__code">{layer.source.map(renderRegion)}</pre>
        )}
      </div>

      <div className="exg-controls">
        <button className="exg-ctl-btn" type="button" onClick={() => void run()} disabled={!harness || running}>
          <span style={{ display: "inline-flex", width: 13, height: 13, verticalAlign: "-2px", marginRight: 6 }}>{Ico.play}</span>
          {running ? "Running…" : layer.runMode === "predictThenRun" ? "Reveal" : "Run"}
        </button>
        {!harness ? <span className="exg-cp__log">harness “{layer.harness.id}” not found</span> : null}
      </div>

      {result ? (
        <div className="exg-cp__trace">
          {result.trace.map((row, i) => (
            <div className="exg-cp__row" key={i} style={{ animationDelay: `${i * 40}ms` }}>
              {row.label ? <div className="exg-cp__lab">{row.label}</div> : null}
              <div className={`exg-cp__card${row.out ? " exg-cp__card--out" : ""}${result.error && i === result.trace.length - 1 ? " exg-cp__card--err" : ""}`}>
                <div className="exg-cp__ctext">{row.text}</div>
                {row.note ? <div className="exg-cp__note">{row.note}</div> : null}
              </div>
            </div>
          ))}
          {result.error ? (
            <div className="exg-cp__log" style={{ color: "var(--rose-400)" }}>
              {result.error}
            </div>
          ) : null}
          {result.log.length > 0 ? <div className="exg-cp__log">{result.log.join("\n")}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
