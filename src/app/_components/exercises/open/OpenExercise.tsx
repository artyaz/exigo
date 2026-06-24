"use client";
/* Renders an AI-authored open exercise (an HTML fragment + its own script) in
   a SANDBOXED iframe. The sandbox has `allow-scripts` but NOT
   `allow-same-origin`, so the authored script runs in an opaque origin: it
   can't reach the host app, cookies, storage, or the network. The only channel
   back is postMessage — we listen for completion, progress, and height. */
import React from "react";
import { buildOpenDoc } from "./toolkit";

export interface OpenExerciseResult {
  correct?: boolean;
  score?: number;
  [k: string]: unknown;
}

export function OpenExercise({
  html,
  onComplete,
}: {
  html: string;
  onComplete?: (result: OpenExerciseResult) => void;
}): React.JSX.Element {
  const frameRef = React.useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = React.useState(240);
  const [result, setResult] = React.useState<OpenExerciseResult | null>(null);
  const [progress, setProgress] = React.useState(0);

  const srcDoc = React.useMemo(() => buildOpenDoc(html), [html]);

  React.useEffect(() => {
    setResult(null);
    setProgress(0);
  }, [srcDoc]);

  React.useEffect(() => {
    function onMessage(e: MessageEvent): void {
      const data = e.data as { __exigo?: boolean; type?: string; data?: Record<string, unknown> } | null;
      if (data?.__exigo !== true) return;
      // Only trust messages from our own frame's content window.
      if (e.source !== frameRef.current?.contentWindow) return;
      const h = data.data?.height;
      const v = data.data?.value;
      if (data.type === "height" && typeof h === "number") {
        setHeight(Math.max(120, Math.min(2000, h)));
      } else if (data.type === "progress" && typeof v === "number") {
        setProgress(Math.max(0, Math.min(1, v)));
      } else if (data.type === "complete") {
        const r = (data.data ?? {}) as OpenExerciseResult;
        setResult(r);
        setProgress(1);
        onComplete?.(r);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onComplete]);

  return (
    <div className="exg-open">
      <div className="exg-open__prox">
        <i style={{ width: `${progress * 100}%` }} />
      </div>
      <iframe
        ref={frameRef}
        className="exg-open__frame"
        title="exercise"
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        style={{ height }}
      />
      {result && (
        <div className={`exg-open__done${result.correct === false ? " exg-open__done--no" : ""}`}>
          {result.correct === false ? "Not yet" : "Complete"}
          {typeof result.score === "number" ? ` · score ${result.score}` : ""}
        </div>
      )}
    </div>
  );
}
