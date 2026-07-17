"use client";
/* Renders an AI-authored open exercise (an HTML fragment + its own script) in
   a SANDBOXED iframe. The sandbox has `allow-scripts` but NOT
   `allow-same-origin`, so the authored script runs in an opaque origin: it
   can't reach the host app, cookies, storage, or the network. The only channel
   back is postMessage — we listen for completion, progress, and height. */
import React from "react";
import { SandboxedFrame, type FrameResult } from "../shell/SandboxedFrame";
import { buildOpenDoc } from "./toolkit";

/** Completion payload from the open sandbox (mirrors embed's `EmbedResult`). */
export type OpenResult = FrameResult;

export function OpenExercise({
  html,
  onComplete,
}: {
  html: string;
  onComplete?: (result: OpenResult) => void;
}): React.JSX.Element {
  const srcDoc = React.useMemo(() => buildOpenDoc(html), [html]);
  return (
    <SandboxedFrame
      srcDoc={srcDoc}
      variant="open"
      sizing={{ mode: "autoHeight", initial: 240, min: 120, max: 2000 }}
      onComplete={onComplete}
    />
  );
}
