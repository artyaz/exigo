"use client";
/* Full free-text code editor — the IDE's primary editing surface (§2.3).
   A transparent <textarea> owns the caret, selection, IME and scrolling; a
   <pre> painted underneath shows live syntax highlight (tokenizeCode). Because
   the editor is monospace, the symbol-autocomplete popup is anchored at the
   caret with plain row*lineHeight / col*charWidth arithmetic — no mirror-div.
   Candidates come from the harness symbol table, so the same editor serves any
   language the harness declares. */
import React from "react";
import { Highlight } from "./highlight";
import type { SymbolDoc } from "../harness/types";

const INDENT = "  "; // soft tab

/** The trailing identifier under the caret that autocomplete completes. */
function trailingWord(s: string): string {
  return /[A-Za-z_$][\w$]*$/.exec(s)?.[0] ?? "";
}

export function CodeEditor({
  value,
  onChange,
  language,
  symbols,
  disabled,
  placeholder,
  minRows = 6,
  ariaLabel = "code editor",
}: {
  value: string;
  onChange: (v: string) => void;
  language?: string;
  symbols?: SymbolDoc[];
  disabled?: boolean;
  placeholder?: string;
  minRows?: number;
  ariaLabel?: string;
}): React.JSX.Element {
  const taRef = React.useRef<HTMLTextAreaElement>(null);
  const preRef = React.useRef<HTMLPreElement>(null);
  const rulerRef = React.useRef<HTMLSpanElement>(null);
  const [acOpen, setAcOpen] = React.useState(false);
  const [acIndex, setAcIndex] = React.useState(0);
  const [caret, setCaret] = React.useState(0);
  const [m, setM] = React.useState({ chW: 7.8, lineH: 20.8, padL: 14, padT: 12 });
  const [, force] = React.useReducer((x: number) => x + 1, 0);

  // Measure monospace metrics once mounted (ruler holds 10 'M's).
  React.useLayoutEffect(() => {
    const ta = taRef.current;
    const ruler = rulerRef.current;
    if (!ta || !ruler) return;
    const cs = window.getComputedStyle(ta);
    const lh = parseFloat(cs.lineHeight);
    setM({
      chW: ruler.getBoundingClientRect().width / 10,
      lineH: Number.isFinite(lh) ? lh : 20.8,
      padL: parseFloat(cs.paddingLeft) || 14,
      padT: parseFloat(cs.paddingTop) || 12,
    });
  }, []);

  const syms = symbols ?? [];
  const candidates = React.useMemo<SymbolDoc[]>(() => {
    if (!acOpen || disabled || syms.length === 0) return [];
    const w = trailingWord(value.slice(0, caret)).toLowerCase();
    if (w.length < 1) return [];
    return syms.filter((s) => s.name.toLowerCase().startsWith(w) && s.name.toLowerCase() !== w).slice(0, 7);
  }, [acOpen, disabled, syms, value, caret]);

  // Caret pixel position (monospace) → popup anchor, corrected for scroll.
  const before = value.slice(0, caret);
  const nl = before.lastIndexOf("\n");
  const row = before.length === 0 ? 0 : before.split("\n").length - 1;
  const col = before.length - (nl + 1);
  const ta = taRef.current;
  const popLeft = m.padL + col * m.chW - (ta?.scrollLeft ?? 0);
  const popTop = m.padT + (row + 1) * m.lineH - (ta?.scrollTop ?? 0) + 4;

  const syncScroll = (): void => {
    const t = taRef.current;
    const p = preRef.current;
    if (t && p) {
      p.scrollTop = t.scrollTop;
      p.scrollLeft = t.scrollLeft;
    }
    if (acOpen) force();
  };

  /** Splice `text` in at the caret, optionally eating `back` chars before it. */
  const splice = (text: string, back = 0): void => {
    const t = taRef.current;
    if (!t) return;
    const start = t.selectionStart - back;
    const end = t.selectionEnd;
    const next = value.slice(0, start) + text + value.slice(end);
    const pos = start + text.length;
    onChange(next);
    requestAnimationFrame(() => {
      const tt = taRef.current;
      if (tt) {
        tt.selectionStart = tt.selectionEnd = pos;
        setCaret(pos);
      }
    });
  };

  const acceptSym = (sym: SymbolDoc): void => {
    const w = trailingWord(value.slice(0, taRef.current?.selectionStart ?? caret));
    splice(sym.insert ?? sym.name, w.length);
    setAcOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    const cs = candidates;
    if (acOpen && cs.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setAcIndex((i) => (i + 1) % cs.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setAcIndex((i) => (i - 1 + cs.length) % cs.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        acceptSym(cs[acIndex % cs.length]!);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setAcOpen(false);
        return;
      }
    }
    if (e.key === "Tab") {
      e.preventDefault();
      splice(INDENT);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === " " || e.code === "Space")) {
      e.preventDefault();
      setAcOpen(true);
      setAcIndex(0);
    }
  };

  const onInput = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const v = e.target.value;
    const pos = e.target.selectionStart;
    onChange(v);
    setCaret(pos);
    setAcOpen(trailingWord(v.slice(0, pos)).length >= 1);
    setAcIndex(0);
  };

  const trackCaret = (): void => {
    const t = taRef.current;
    if (t) setCaret(t.selectionStart);
  };

  const rows = Math.max(minRows, value.split("\n").length);

  return (
    <div className={`exg-ed${disabled ? " exg-ed--ro" : ""}`}>
      <span ref={rulerRef} className="exg-ed__ruler" aria-hidden="true">
        MMMMMMMMMM
      </span>
      <div className="exg-ed__scroll">
        <pre ref={preRef} className="exg-ed__hl" aria-hidden="true">
          <Highlight code={value + "\n"} />
        </pre>
        <textarea
          ref={taRef}
          className="exg-ed__ta"
          value={value}
          rows={rows}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          disabled={disabled}
          placeholder={placeholder}
          aria-label={ariaLabel}
          onChange={onInput}
          onScroll={syncScroll}
          onKeyDown={onKeyDown}
          onClick={trackCaret}
          onKeyUp={trackCaret}
          onSelect={trackCaret}
          onBlur={() => window.setTimeout(() => setAcOpen(false), 120)}
        />
        {candidates.length > 0 ? (
          <div className="exg-ed__ac" role="listbox" style={{ left: popLeft, top: popTop }}>
            {candidates.map((s, i) => (
              <div
                key={s.name}
                role="option"
                aria-selected={i === acIndex % candidates.length}
                className={`exg-cp__ac-item${i === acIndex % candidates.length ? " exg-cp__ac-item--on" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  acceptSym(s);
                }}
              >
                <span className="exg-cp__ac-name">{s.signature ?? s.name}</span>
                {s.doc ? <span className="exg-cp__ac-doc">{s.doc}</span> : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {language ? <div className="exg-ed__lang">{language}</div> : null}
    </div>
  );
}
