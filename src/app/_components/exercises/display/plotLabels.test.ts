import { describe, it, expect } from "vitest";
import {
  fitLabel,
  labelGutter,
  placeReadout,
  PLOT_CHAR_W,
  PLOT_LABEL_DX,
  PLOT_VB_W,
  type ReadoutPlacement,
} from "./plotLabels";

describe("labelGutter", () => {
  it("reserves a tiny gutter when there are no names", () => {
    expect(labelGutter([]).padR).toBe(16);
  });

  it("keeps a short name whole (gutter wide enough)", () => {
    const { maxChars } = labelGutter(["Soft Sell"]);
    expect(fitLabel("Soft Sell", maxChars)).toBe("Soft Sell");
  });

  it("caps the gutter so a long name is truncated, not allowed to clip", () => {
    const { padR, maxChars } = labelGutter(["Ideal adaptive curve over time"]);
    expect(padR).toBeLessThanOrEqual(132); // plot is never starved
    const fitted = fitLabel("Ideal adaptive curve over time", maxChars);
    expect(fitted.endsWith("…")).toBe(true);
    expect(fitted.length).toBeLessThanOrEqual(maxChars);
  });
});

describe("invariant: a fitted end-label never leaves the plot frame", () => {
  // x of a label = (right plot edge) + offset; its rendered width must keep the
  // right end inside the viewBox. This is the exact failure from the screenshots
  // ("Ideal adaptive curv…" spilling off the right edge).
  const endX = (name: string): number => {
    const { padR, maxChars } = labelGutter([name]);
    const startX = PLOT_VB_W - padR + PLOT_LABEL_DX;
    return startX + fitLabel(name, maxChars).length * PLOT_CHAR_W;
  };

  it("holds for names from 1 to 40 chars", () => {
    for (let n = 1; n <= 40; n++) {
      const name = "x".repeat(n);
      expect(endX(name)).toBeLessThanOrEqual(PLOT_VB_W);
    }
  });

  it("holds when several names share one plot (gutter sized to the longest)", () => {
    const names = ["Hard Sell", "Soft Sell", "Your crossover readiness curve"];
    const { padR, maxChars } = labelGutter(names);
    for (const name of names) {
      const startX = PLOT_VB_W - padR + PLOT_LABEL_DX;
      expect(startX + fitLabel(name, maxChars).length * PLOT_CHAR_W).toBeLessThanOrEqual(PLOT_VB_W);
    }
  });
});

describe("placeReadout — cursor readout never spills into the label gutter", () => {
  const x0 = 34;
  const x1 = 228; // plot area right edge; series names live to the right of this
  // [left, right] extent of the rendered readout text.
  const extent = (p: ReadoutPlacement): [number, number] =>
    p.anchor === "start"
      ? [p.x, p.x + p.text.length * PLOT_CHAR_W]
      : [p.x - p.text.length * PLOT_CHAR_W, p.x];

  it("stays within the plot area for a long readout, cursor mid-plot (the shot-2 bug)", () => {
    const p = placeReadout(120, x0, x1, "$1000 — high-consideration 85");
    const [lo, hi] = extent(p);
    expect(lo).toBeGreaterThanOrEqual(x0 - 0.01);
    expect(hi).toBeLessThanOrEqual(x1 + 0.01); // never reaches the gutter where "Soft Sell" sits
  });

  it("draws toward whichever side has more room", () => {
    expect(placeReadout(x0 + 5, x0, x1, "long readout text here").anchor).toBe("start");
    expect(placeReadout(x1 - 5, x0, x1, "long readout text here").anchor).toBe("end");
  });

  it("fits an over-long readout with an ellipsis", () => {
    const p = placeReadout((x0 + x1) / 2, x0, x1, "x".repeat(80));
    expect(p.text.endsWith("…")).toBe(true);
    const [lo, hi] = extent(p);
    expect(lo).toBeGreaterThanOrEqual(x0 - 0.01);
    expect(hi).toBeLessThanOrEqual(x1 + 0.01);
  });
});
