import { describe, it, expect } from "vitest";
import { place } from "./Graph";

const N = (id: string, label: string) => ({ id, label });

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** True iff no two pills sharing a row overlap horizontally (the shot-3 bug:
    wide pills packed into a fixed viewBox stepped on each other + their labels). */
function noRowOverlap(placed: Box[]): boolean {
  const rows = new Map<number, Box[]>();
  for (const p of placed) {
    if (!rows.has(p.y)) rows.set(p.y, []);
    rows.get(p.y)!.push(p);
  }
  for (const row of rows.values()) {
    const sorted = [...row].sort((a, b) => a.x - b.x);
    for (let i = 1; i < sorted.length; i++) {
      const prevRight = sorted[i - 1]!.x + sorted[i - 1]!.w / 2;
      const curLeft = sorted[i]!.x - sorted[i]!.w / 2;
      if (curLeft < prevRight - 0.01) return false;
    }
  }
  return true;
}

describe("Graph.place — pills never overlap within a row", () => {
  const journey = ["Awareness", "Interest", "Consideration", "Decision", "Retention"].map((s) => N(s, s));

  it("row layout: five wide pills are spaced, viewBox widens to fit", () => {
    const { placed, width } = place(journey, [], "row");
    expect(noRowOverlap(placed)).toBe(true);
    expect(width).toBeGreaterThan(360); // grew past the default to fit the row
  });

  it("layered layout: a wide rank does not collide", () => {
    const nodes = [N("root", "Root"), ...journey.map((n) => N("c-" + n.id, n.label))];
    const edges = journey.map((n) => ({ from: "root", to: "c-" + n.id }));
    const { placed } = place(nodes, edges, "layered");
    expect(noRowOverlap(placed)).toBe(true);
  });
});
