"use client";
/* Renders a free-HTML embedded exercise (an agent-authored HTML body) in a
   SANDBOXED iframe. The sandbox is `allow-scripts` only — no same-origin, so
   the authored script runs in an opaque origin and can't reach the host app,
   cookies, storage, or our DOM. The only channel back is postMessage, handled
   by the host bridge injected in runtime.ts. */
import React from "react";
import { buildEmbedDoc, EMBED_WINDOW } from "./runtime";

export interface EmbedResult {
  correct?: boolean;
  score?: number;
  [k: string]: unknown;
}

export function EmbedExercise({
  html,
  onComplete,
  onError,
}: {
  html: string;
  onComplete?: (result: EmbedResult) => void;
  onError?: (message: string) => void;
}): React.JSX.Element {
  const frameRef = React.useRef<HTMLIFrameElement | null>(null);
  const [result, setResult] = React.useState<EmbedResult | null>(null);
  const [progress, setProgress] = React.useState(0);

  const srcDoc = React.useMemo(() => buildEmbedDoc(html), [html]);

  React.useEffect(() => {
    setResult(null);
    setProgress(0);
  }, [srcDoc]);

  React.useEffect(() => {
    function onMessage(e: MessageEvent): void {
      const data = e.data as { __exigo?: boolean; type?: string; data?: Record<string, unknown> } | null;
      if (data?.__exigo !== true) return;
      if (e.source !== frameRef.current?.contentWindow) return; // only our frame
      const d = data.data ?? {};
      switch (data.type) {
        case "progress":
          if (typeof d.value === "number") setProgress(Math.max(0, Math.min(1, d.value)));
          break;
        case "complete": {
          const r = d as EmbedResult;
          setResult(r);
          setProgress(1);
          onComplete?.(r);
          break;
        }
        case "error":
          if (typeof d.message === "string") onError?.(d.message);
          break;
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onComplete, onError]);

  return (
    <div className="exg-embed" style={{ width: EMBED_WINDOW.width, maxWidth: "100%" }}>
      <div className="exg-embed__prox">
        <i style={{ width: `${progress * 100}%` }} />
      </div>
      <iframe
        ref={frameRef}
        className="exg-embed__frame"
        title="exercise"
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        width={EMBED_WINDOW.width}
        height={EMBED_WINDOW.height}
        style={{ width: EMBED_WINDOW.width, height: EMBED_WINDOW.height, maxWidth: "100%" }}
      />
      {result && (
        <div className={`exg-embed__done${result.correct === false ? " exg-embed__done--no" : ""}`}>
          {result.correct === false ? "Not yet" : "Complete"}
          {typeof result.score === "number" ? ` · score ${result.score}` : ""}
        </div>
      )}
    </div>
  );
}
