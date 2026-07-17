"use client";
/* Shared host for open/embed sandboxed iframes: postMessage bridge (progress /
   complete / error / optional height), chrome (prox bar + done chip), and
   inject-once host CSS so lesson/collection/atlas consumers are styled without
   the playground generate page. Open vs embed stay thin wrappers that only
   differ in srcDoc builder + sizing policy. */
import React from "react";

export interface FrameResult {
  correct?: boolean;
  score?: number;
  [k: string]: unknown;
}

export type FrameSizing =
  | { mode: "autoHeight"; initial?: number; min?: number; max?: number }
  | { mode: "fixed"; width: number; height: number };

export type FrameVariant = "open" | "embed";

/** True when the message is from our sandboxed frame (opaque origin or same origin + matching source). */
export function isTrustedFrameMessage(
  e: Pick<MessageEvent, "origin" | "source" | "data">,
  contentWindow: Window | null | undefined,
  hostOrigin: string = typeof window !== "undefined" ? window.location.origin : "",
): boolean {
  const data = e.data as { __exigo?: boolean } | null;
  if (data?.__exigo !== true) return false;
  // sandboxed (opaque-origin) frame posts origin "null"
  if (e.origin !== "null" && e.origin !== hostOrigin) return false;
  if (!contentWindow || e.source !== contentWindow) return false;
  return true;
}

type DecodedFrameMessage =
  | { type: "height"; height: number }
  | { type: "progress"; value: number }
  | { type: "complete"; result: FrameResult }
  | { type: "error"; message: string }
  | null;

/** Pure decode of an already-trusted __exigo postMessage payload. */
export function decodeFrameMessage(data: unknown): DecodedFrameMessage {
  if (!data || typeof data !== "object") return null;
  const msg = data as { __exigo?: boolean; type?: string; data?: Record<string, unknown> };
  if (msg.__exigo !== true || typeof msg.type !== "string") return null;
  const d = msg.data ?? {};
  switch (msg.type) {
    case "height": {
      const h = d.height;
      return typeof h === "number" && Number.isFinite(h) ? { type: "height", height: h } : null;
    }
    case "progress": {
      const v = d.value;
      return typeof v === "number" && Number.isFinite(v) ? { type: "progress", value: v } : null;
    }
    case "complete":
      return { type: "complete", result: d as FrameResult };
    case "error":
      return typeof d.message === "string" ? { type: "error", message: d.message } : null;
    default:
      return null;
  }
}

function useSandboxedFrameStyles(): void {
  React.useEffect(() => {
    if (typeof document === "undefined" || document.getElementById("exg-frame-styles")) return;
    const el = document.createElement("style");
    el.id = "exg-frame-styles";
    el.textContent = FRAME_CSS;
    document.head.appendChild(el);
  }, []);
}

export function SandboxedFrame({
  srcDoc,
  variant,
  sizing,
  onComplete,
  onError,
}: {
  srcDoc: string;
  variant: FrameVariant;
  sizing: FrameSizing;
  onComplete?: (result: FrameResult) => void;
  onError?: (message: string) => void;
}): React.JSX.Element {
  useSandboxedFrameStyles();

  const frameRef = React.useRef<HTMLIFrameElement | null>(null);
  const prefix = variant === "open" ? "exg-open" : "exg-embed";
  const auto = sizing.mode === "autoHeight";
  const minH = auto ? (sizing.min ?? 120) : 0;
  const maxH = auto ? (sizing.max ?? 2000) : 0;
  const [height, setHeight] = React.useState(auto ? (sizing.initial ?? 240) : 0);
  const [result, setResult] = React.useState<FrameResult | null>(null);
  const [progress, setProgress] = React.useState(0);

  const initialHeight = auto ? (sizing.initial ?? 240) : 0;
  React.useEffect(() => {
    setResult(null);
    setProgress(0);
    if (auto) setHeight(initialHeight);
  }, [srcDoc, auto, initialHeight]);

  React.useEffect(() => {
    function onMessage(e: MessageEvent): void {
      if (!isTrustedFrameMessage(e, frameRef.current?.contentWindow)) return;
      const decoded = decodeFrameMessage(e.data);
      if (!decoded) return;
      switch (decoded.type) {
        case "height":
          if (auto) setHeight(Math.max(minH, Math.min(maxH, decoded.height)));
          break;
        case "progress":
          setProgress(Math.max(0, Math.min(1, decoded.value)));
          break;
        case "complete":
          setResult(decoded.result);
          setProgress(1);
          onComplete?.(decoded.result);
          break;
        case "error":
          onError?.(decoded.message);
          break;
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [auto, minH, maxH, onComplete, onError]);

  const rootStyle: React.CSSProperties | undefined =
    sizing.mode === "fixed" ? { width: sizing.width, maxWidth: "100%" } : undefined;

  const frameStyle: React.CSSProperties =
    sizing.mode === "fixed"
      ? { width: sizing.width, height: sizing.height, maxWidth: "100%" }
      : { height };

  return (
    <div className={prefix} style={rootStyle}>
      <div className={`${prefix}__prox`}>
        <i style={{ width: `${progress * 100}%` }} />
      </div>
      <iframe
        ref={frameRef}
        className={`${prefix}__frame`}
        title="exercise"
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        width={sizing.mode === "fixed" ? sizing.width : undefined}
        height={sizing.mode === "fixed" ? sizing.height : undefined}
        style={frameStyle}
      />
      {result && (
        <div className={`${prefix}__done${result.correct === false ? ` ${prefix}__done--no` : ""}`}>
          {result.correct === false ? "Not yet" : "Complete"}
          {typeof result.score === "number" ? ` · score ${result.score}` : ""}
        </div>
      )}
    </div>
  );
}

/* Host chrome for open + embed — co-located so any mount site gets styles. */
const FRAME_CSS = `
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
