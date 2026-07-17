"use client";
/* Renders a free-HTML embedded exercise (an agent-authored HTML body) in a
   SANDBOXED iframe. The sandbox is `allow-scripts` only — no same-origin, so
   the authored script runs in an opaque origin and can't reach the host app,
   cookies, storage, or our DOM. The only channel back is postMessage, handled
   by the host bridge injected in runtime.ts. */
import React from "react";
import { SandboxedFrame, type FrameResult } from "../shell/SandboxedFrame";
import { buildEmbedDoc, EMBED_WINDOW } from "./runtime";

/** Completion payload from the embed sandbox. */
export type EmbedResult = FrameResult;

export function EmbedExercise({
  html,
  onComplete,
  onError,
}: {
  html: string;
  onComplete?: (result: EmbedResult) => void;
  onError?: (message: string) => void;
}): React.JSX.Element {
  const srcDoc = React.useMemo(() => buildEmbedDoc(html), [html]);
  return (
    <SandboxedFrame
      srcDoc={srcDoc}
      variant="embed"
      sizing={{ mode: "fixed", width: EMBED_WINDOW.width, height: EMBED_WINDOW.height }}
      onComplete={onComplete}
      onError={onError}
    />
  );
}
