import { describe, it, expect } from "vitest";
import { run, ExprError, toDisplay } from "./expr";
import { CAPS } from "./helpers";

describe("toDisplay — no '[object Object]' ever leaks to a readout", () => {
  const node = { id: "n1", label: "Awareness" };
  const edge = { from: { id: "a", label: "Awareness" }, to: { id: "b", label: "Interest" } };

  it("resolves a record to its label/name/id, not [object Object]", () => {
    expect(toDisplay(node)).toBe("Awareness");
    expect(toDisplay({ id: "x" })).toBe("x");
    expect(toDisplay({ foo: 1, bar: "z" })).not.toContain("[object Object]");
  });

  it("handles scalars, arrays, and nested records", () => {
    expect(toDisplay("hi")).toBe("hi");
    expect(toDisplay(3)).toBe("3");
    expect(toDisplay(null)).toBe("");
    expect(toDisplay([node, { label: "Interest" }])).toBe("Awareness, Interest");
  });

  it("concat / string-plus over records produce readable text (the shot-3 bug)", () => {
    // concat(edge.from, " → ", edge.to) used to render "[object Object] → [object Object]".
    expect(run('concat(e.from, " -> ", e.to)', { e: edge })).toBe("Awareness -> Interest");
    expect(run('"go: " + n', { n: node })).toBe("go: Awareness");
  });
});

describe("closed helpers", () => {
  it("scalar math: clamp / mod / min / max", () => {
    expect(run("clamp(12, 0, 9)", {})).toBe(9);
    expect(run("mod(-1, 3)", {})).toBe(2);
    expect(run("min(3, 1, 2)", {})).toBe(1);
    expect(run("max(3, 1, 2)", {})).toBe(3);
  });

  it("arrays: range / at / setAt / count / sum", () => {
    expect(run("range(3)", {})).toEqual([0, 1, 2]);
    expect(run("at(a, 1)", { a: [10, 20, 30] })).toBe(20);
    expect(run("at(a, 9)", { a: [10] })).toBe(null);
    expect(run("setAt(a, 0, 7)", { a: [1, 2] })).toEqual([7, 2]);
    expect(run('count(a, "1")', { a: ["1", "0", "1"] })).toBe(2);
    expect(run("sum(a)", { a: [1, 2, 3] })).toBe(6);
  });

  it("does not mutate the input array", () => {
    const a = [1, 2, 3];
    run("setAt(a, 0, 99)", { a });
    expect(a).toEqual([1, 2, 3]);
  });

  it("enforces the array cap", () => {
    expect(() => run(`range(${CAPS.MAX_ARRAY + 1})`, {})).toThrow(ExprError);
  });

  it("record: builds a typed row from alternating key/value pairs", () => {
    expect(run('record("id", "a", "size", 16)', {})).toEqual({ id: "a", size: 16 });
    // folds straight from event fields — the obs→model path the primitives consume
    expect(run('record("id", event.id, "region", "buf")', { event: { id: "x42" } })).toEqual({
      id: "x42",
      region: "buf",
    });
    // composable with push to grow a model array in a reaction
    expect(run('push(blocks, record("id", "b", "size", 8))', { blocks: [{ id: "a", size: 16 }] })).toEqual([
      { id: "a", size: 16 },
      { id: "b", size: 8 },
    ]);
    expect(() => run('record("id")', {})).toThrow(ExprError);
    expect(() => run("record(1, 2)", {})).toThrow(ExprError);
  });

  it("setField: revises one field of one row, immutably", () => {
    const env = { nodes: [{ id: "f1", tone: "muted" }, { id: "f2", tone: "muted" }] };
    expect(run('setField(nodes, 1, "tone", "ok")', env)).toEqual([
      { id: "f1", tone: "muted" },
      { id: "f2", tone: "ok" },
    ]);
    // source array untouched (fold semantics, not mutation)
    expect(env.nodes[1]!.tone).toBe("muted");
    // folds from event fields, e.g. re-toning the frame that just returned
    expect(run('setField(nodes, event.depth - 1, "tone", "ok")', { ...env, event: { depth: 1 } })).toEqual([
      { id: "f1", tone: "ok" },
      { id: "f2", tone: "muted" },
    ]);
    expect(() => run('setField(nodes, 5, "tone", "ok")', env)).toThrow(ExprError);
    expect(() => run('setField(nodes, 0, 7, "ok")', env)).toThrow(ExprError);
    expect(() => run('setField([1], 0, "tone", "ok")', { nodes: [1] })).toThrow(ExprError);
  });

  it("steps Conway life on a grid", () => {
    // a blinker (vertical) becomes horizontal after one step
    const g = [
      [0, 1, 0],
      [0, 1, 0],
      [0, 1, 0],
    ];
    expect(run("stepLife(g, [3], [2, 3])", { g })).toEqual([
      [0, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ]);
  });
});
