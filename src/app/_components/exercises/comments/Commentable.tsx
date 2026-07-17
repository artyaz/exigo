"use client";
/* Wrap any generated exercise to make it commentable: right-click the frame (or
   click the hover "comment" chip — the sandboxed iframe swallows right-clicks on
   its own body) → a popover → saved to Convex with the exercise's HTML so the
   playground collection can list and export it. */
import React from "react";
import { useMutation } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../../../../convex/_generated/api";

export function Commentable({
  html,
  source,
  context,
  mechanic,
  children,
}: {
  html: string;
  source: string;
  context?: string;
  mechanic?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const { isSignedIn } = useAuth();
  const add = useMutation(api.exerciseComments.add);
  const [at, setAt] = React.useState<{ x: number; y: number } | null>(null);
  const [text, setText] = React.useState("");
  const [saved, setSaved] = React.useState(false);
  const taRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (!at) return;
    taRef.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setAt(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [at]);

  React.useEffect(() => {
    el.injectOnce();
  }, []);

  const open = (x: number, y: number): void => {
    setText("");
    setSaved(false);
    setAt({ x: Math.min(x, window.innerWidth - 320), y: Math.min(y, window.innerHeight - 200) });
  };

  const save = async (): Promise<void> => {
    if (!isSignedIn || !text.trim()) return;
    await add({ comment: text.trim(), html, source, context, mechanic });
    setSaved(true);
    setTimeout(() => setAt(null), 850);
  };

  return (
    <div
      className="exg-cmt"
      onContextMenu={(e) => {
        e.preventDefault();
        open(e.clientX, e.clientY);
      }}
    >
      <button
        type="button"
        className="exg-cmt__chip"
        title="Comment on this exercise (or right-click)"
        onClick={(e) => open(e.clientX, e.clientY)}
      >
        💬 comment
      </button>
      {children}
      {at ? (
        <>
          <div
            className="exg-cmt__scrim"
            role="button"
            tabIndex={-1}
            aria-label="Dismiss"
            onClick={() => setAt(null)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " " || e.key === "Escape") setAt(null);
            }}
          />
          <div className="exg-cmt__pop" style={{ left: at.x, top: at.y }} onClick={(e) => e.stopPropagation()}>
            {saved ? (
              <div className="exg-cmt__ok">Saved ✓</div>
            ) : (
              <>
                <div className="exg-cmt__lab">Comment on this exercise</div>
                <textarea
                  ref={taRef}
                  className="exg-cmt__ta"
                  value={text}
                  placeholder="What works, what to fix…"
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void save();
                  }}
                />
                <div className="exg-cmt__row">
                  <span className="exg-cmt__hint">⌘↵ to save{!isSignedIn ? " · sign in first" : ""}</span>
                  <button type="button" className="exg-cmt__save" disabled={!isSignedIn || !text.trim()} onClick={() => void save()}>
                    Save
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

/* One-time stylesheet injection (kept beside the component so any host gets it). */
const el = {
  injectOnce(): void {
    if (typeof document === "undefined" || document.getElementById("exg-cmt-styles")) return;
    const s = document.createElement("style");
    s.id = "exg-cmt-styles";
    s.textContent = CSS;
    document.head.appendChild(s);
  },
};
const CSS = `
.exg-cmt{ position:relative; }
.exg-cmt__chip{ position:absolute; top:6px; right:6px; z-index:4; opacity:0; transition:opacity .15s; font-family:var(--font-mono,monospace); font-size:10.5px; letter-spacing:.04em; padding:4px 9px; border-radius:99px; background:rgba(0,0,0,.55); border:1px solid var(--border,rgba(255,255,255,.1)); color:var(--white-70,rgba(255,255,255,.7)); cursor:pointer; backdrop-filter:blur(6px); }
.exg-cmt:hover .exg-cmt__chip{ opacity:1; }
.exg-cmt__chip:hover{ color:#fff; border-color:var(--emerald-400,#34d399); }
.exg-cmt__scrim{ position:fixed; inset:0; z-index:60; }
.exg-cmt__pop{ position:fixed; z-index:61; width:300px; background:var(--neutral-950,#0a0a0a); border:1px solid var(--border,rgba(255,255,255,.12)); border-radius:14px; box-shadow:0 18px 48px -12px rgba(0,0,0,.8); padding:12px; animation:exg-cmt-pop .18s cubic-bezier(.175,.885,.32,1.275); }
@keyframes exg-cmt-pop{ from{ transform:scale(.96); opacity:0 } }
.exg-cmt__lab{ font-family:var(--font-mono,monospace); font-size:9.5px; letter-spacing:.16em; text-transform:uppercase; color:var(--white-40,rgba(255,255,255,.4)); margin-bottom:8px; }
.exg-cmt__ta{ width:100%; min-height:74px; resize:vertical; background:var(--surface-sunken,#0a0a0a); border:1px solid var(--border,rgba(255,255,255,.12)); border-radius:9px; color:var(--white-85,rgba(255,255,255,.85)); font-family:var(--font-sans,sans-serif); font-size:13px; line-height:1.5; padding:8px 10px; outline:none; }
.exg-cmt__ta:focus{ border-color:rgba(52,211,153,.5); }
.exg-cmt__row{ display:flex; align-items:center; justify-content:space-between; margin-top:9px; }
.exg-cmt__hint{ font-family:var(--font-mono,monospace); font-size:10px; color:var(--white-30,rgba(255,255,255,.3)); }
.exg-cmt__save{ font-family:var(--font-mono,monospace); font-size:11.5px; padding:6px 14px; border-radius:99px; background:rgba(52,211,153,.16); border:1px solid rgba(52,211,153,.45); color:#34d399; cursor:pointer; }
.exg-cmt__save:disabled{ opacity:.4; cursor:default; }
.exg-cmt__ok{ font-family:var(--font-mono,monospace); font-size:13px; color:#34d399; padding:10px 6px; text-align:center; }
`;
