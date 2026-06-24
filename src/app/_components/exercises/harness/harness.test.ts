import { describe, it, expect } from "vitest";
import { runJs } from "./jsHarness";
import { rustOwnershipMove } from "./rustOwnership";
import type { RunResult } from "./types";

describe("js real-execution harness", () => {
  it("captures trace/result rows and logs from running code", () => {
    const res = runJs('const x = 3;\ntrace("x", x);\nresult("2x", x * 2);\nconsole.log("hi");');
    expect(res.ok).toBe(true);
    expect(res.error).toBeNull();
    expect(res.trace).toEqual([
      { label: "x", text: "3" },
      { label: "2x", text: "6", out: true },
    ]);
    expect(res.log).toContain("hi");
  });

  it("reports thrown errors without crashing", () => {
    const res = runJs('throw new Error("boom");');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/boom/);
  });

  it("shadows dangerous globals", () => {
    const res = runJs("result('w', typeof window);");
    expect(res.ok).toBe(true);
    expect(res.trace[0]?.text).toBe("undefined");
  });

  it("collects raw result() values into out, keyed by label", () => {
    const res = runJs('result("n", 3);\nresult("xs", [[0, 1], [1, 4]]);\nresult("pt", { x: 1, y: 2 });');
    expect(res.out).toEqual({ n: 3, xs: [[0, 1], [1, 4]], pt: { x: 1, y: 2 } });
  });

  it("returns collected out even when the run throws", () => {
    const res = runJs('result("n", 7);\nthrow new Error("boom");');
    expect(res.ok).toBe(false);
    expect(res.out).toEqual({ n: 7 });
  });

  it("omits labelless result() rows from out", () => {
    const res = runJs('result("done");');
    expect(res.out).toEqual({});
  });
});

describe("curated-trace harness ground-truth oracle (§2.1)", () => {
  const flatten = (r: RunResult): string =>
    [...r.trace.map((t) => `${t.text} ${t.note ?? ""}`), ...r.log, r.error ?? ""].join(" \n ");

  it("every ground-truth test passes against its own model", () => {
    for (const t of rustOwnershipMove.groundTruthTests) {
      const res = rustOwnershipMove.trace(t.slots);
      expect(res.ok, t.name).toBe(t.expected.ok);
      const text = flatten(res);
      for (const needle of t.expected.contains ?? []) {
        expect(text, `${t.name}: contains "${needle}"`).toContain(needle);
      }
      for (const needle of t.expected.notContains ?? []) {
        expect(text, `${t.name}: notContains "${needle}"`).not.toContain(needle);
      }
    }
  });

  it("classifies move vs clone vs borrow from the assembled source", () => {
    expect(rustOwnershipMove.run('let a = String::from("hi");\nlet b = a;').ok).toBe(false);
    expect(rustOwnershipMove.run('let a = String::from("hi");\nlet b = a.clone();').ok).toBe(true);
    expect(rustOwnershipMove.run('let a = String::from("hi");\nlet b = &a;').ok).toBe(true);
  });
});
