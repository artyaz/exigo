/* Pure geometry for plot end-labels — the names written at the end of each
   line instead of a legend. Extracted from Plot.tsx so the invariant "a fitted
   label never overruns its reserved right gutter (and so never leaves the
   frame)" is unit-testable without React. Plot.tsx owns rendering; this owns
   the math, and both share these constants. */

export const PLOT_VB_W = 360; // plot viewBox width (px)
export const PLOT_CHAR_W = 5.2; // approx px per char at the end-label font size
export const PLOT_LABEL_DX = 7; // x-offset of a label past the plot's right edge

export interface LabelGutter {
  /** right padding reserved for names, in viewBox px */
  padR: number;
  /** max chars that actually fit within that gutter */
  maxChars: number;
}

/** Reserve right margin for the longest name, capped so the plot is never
    starved, then derive how many chars fit in that gutter. */
export function labelGutter(names: string[]): LabelGutter {
  const longest = names.reduce((m, t) => Math.max(m, t.length), 0);
  const padR = names.length ? Math.min(132, Math.max(36, longest * PLOT_CHAR_W + 14)) : 16;
  const maxChars = Math.max(4, Math.floor((padR - 12) / PLOT_CHAR_W));
  return { padR, maxChars };
}

/** Truncate a name with an ellipsis when it exceeds the gutter capacity. */
export function fitLabel(text: string, maxChars: number): string {
  return text.length > maxChars ? text.slice(0, maxChars - 1) + "…" : text;
}

export interface ReadoutPlacement {
  x: number;
  anchor: "start" | "end";
  text: string;
}

/** Place the cursor readout so it stays INSIDE the plot area [x0, x1] and never
    spills into the right-edge label gutter (where series names live) — the
    overlap that garbled "$1000 — high-consideration" over "Soft Sell". It draws
    toward whichever side of the cursor has more room and fits the text to that
    room with an ellipsis. */
export function placeReadout(cursorPx: number, x0: number, x1: number, text: string): ReadoutPlacement {
  const GAP = 10;
  const rightSpace = x1 - (cursorPx + GAP);
  const leftSpace = cursorPx - GAP - x0;
  const goRight = rightSpace >= leftSpace;
  const space = Math.max(0, goRight ? rightSpace : leftSpace);
  const maxChars = Math.max(3, Math.floor(space / PLOT_CHAR_W));
  const fitted = fitLabel(text, maxChars);
  return goRight ? { x: cursorPx + GAP, anchor: "start", text: fitted } : { x: cursorPx - GAP, anchor: "end", text: fitted };
}
