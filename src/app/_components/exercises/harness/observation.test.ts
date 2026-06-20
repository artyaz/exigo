import { describe, it, expect } from "vitest";
import { runObservationsSync, JS_OBSERVATION_SCHEMA } from "./jsObservationCore";
import { run } from "../runtime/expr";
import type { Value } from "../runtime/types";

const RECURSION = `
function fact(n) {
  enter("fact", n);
  if (n <= 1) { const b = 1; exit("fact", b); return b; }
  const r = n * fact(n - 1);
  exit("fact", r);
  return r;
}
fact(5);
`;

describe("js observation core (v4 emit probes)", () => {
  it("emits a typed enter/exit stream with depth and args from real execution", () => {
    const res = runObservationsSync(RECURSION);
    expect(res.ok).toBe(true);
    expect(res.error).toBeNull();
    const kinds = res.observations.map((o) => o.kind);
    expect(kinds).toEqual([
      "enter", "enter", "enter", "enter", "enter",
      "exit", "exit", "exit", "exit", "exit",
    ]);
    // enter args carry the real call argument; depth nests 1..5
    expect(res.observations[0]).toMatchObject({ kind: "enter", name: "fact", args: [5], depth: 1 });
    expect(res.observations[4]).toMatchObject({ kind: "enter", args: [1], depth: 5 });
    // the outermost frame returns 120; base case returns 1
    expect(res.observations[5]).toMatchObject({ kind: "exit", value: 1, depth: 5 });
    expect(res.observations[9]).toMatchObject({ kind: "exit", value: 120, depth: 1 });
    // monotonic sequence tag
    expect(res.observations.map((o) => o.t)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("captures console output and reports thrown errors without crashing", () => {
    const res = runObservationsSync('console.log("hi"); throw new Error("boom");');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/boom/);
    expect(res.log).toContain("hi");
  });

  it("shadows dangerous globals and aborts runaway observation floods", () => {
    expect(runObservationsSync("mark(typeof window);").observations[0]).toMatchObject({ label: "undefined" });
    const flood = runObservationsSync("while (true) { mark('x'); }");
    expect(flood.ok).toBe(false);
    expect(flood.error).toMatch(/observations/);
  });

  it("alloc/write/ref/emit produce schema-shaped records", () => {
    const res = runObservationsSync(
      'alloc("a", 16, "buf"); write("a", 7); alloc("b", 8, "heap"); ref("a", "b"); emit("mark", { label: "done", value: 1 });',
    );
    expect(res.observations).toEqual([
      { kind: "alloc", id: "a", size: 16, region: "buf", label: "a", t: 0 },
      { kind: "write", id: "a", value: 7, t: 1 },
      { kind: "alloc", id: "b", size: 8, region: "heap", label: "b", t: 2 },
      { kind: "ref", from: "a", to: "b", t: 3 },
      { kind: "mark", label: "done", value: 1, t: 4 },
    ]);
  });

  it("every schema field name appears on at least one emitted observation", () => {
    const res = runObservationsSync(
      'enter("f", 1); exit("f", 2); alloc("c", 4, "buf"); write("c", 3); ref("c", "c"); mark("m", 4);',
    );
    for (const [kind, schema] of Object.entries(JS_OBSERVATION_SCHEMA)) {
      const sample = res.observations.find((o) => o.kind === kind);
      expect(sample, `observation kind "${kind}" emitted`).toBeDefined();
      for (const field of Object.keys(schema.fields)) {
        expect(sample, `${kind}.${field}`).toHaveProperty(field);
      }
    }
  });
});

describe("obs DSL helpers", () => {
  const obs = runObservationsSync(RECURSION).observations as unknown as Value;
  const env = { obs };

  it("obsCount tallies a kind", () => {
    expect(run('obsCount(obs, "enter")', env)).toBe(5);
    expect(run('obsCount(obs, "exit")', env)).toBe(5);
    expect(run('obsCount(obs, "alloc")', env)).toBe(0);
  });

  it("obsContains matches a field value strictly", () => {
    expect(run('obsContains(obs, "exit", "value", 120)', env)).toBe(true);
    expect(run('obsContains(obs, "exit", "value", 119)', env)).toBe(false);
    expect(run('obsContains(obs, "enter", "depth", 5)', env)).toBe(true);
  });

  it("obsSeq detects a contiguous kind run (the recursion turnaround)", () => {
    expect(run('obsSeq(obs, ["enter", "enter", "enter", "enter", "enter", "exit"])', env)).toBe(true);
    expect(run('obsSeq(obs, ["exit", "enter"])', env)).toBe(false);
    expect(run('obsSeq(obs, [])', env)).toBe(true);
  });

  it("removeLast pops the last element (stack pop)", () => {
    expect(run("removeLast([1, 2, 3])", {})).toEqual([1, 2]);
    expect(run("removeLast([])", {})).toEqual([]);
  });
});
