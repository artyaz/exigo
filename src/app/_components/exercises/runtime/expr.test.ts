import { describe, it, expect } from "vitest";
import { run, parse, compile, ExprError } from "./expr";

describe("expression DSL", () => {
  it("evaluates arithmetic with precedence", () => {
    expect(run("1 + 2 * 3", {})).toBe(7);
    expect(run("(1 + 2) * 3", {})).toBe(9);
  });

  it("uses strict equality", () => {
    expect(run("1 == 1", {})).toBe(true);
    expect(run('"1" == 1', {})).toBe(false);
    expect(run("1 != 2", {})).toBe(true);
  });

  it("concatenates when either operand is a string", () => {
    expect(run('"x" + 1', {})).toBe("x1");
    expect(run('1 + "x"', {})).toBe("1x");
  });

  it("short-circuits && and ||", () => {
    // RHS would throw (division by zero) if evaluated
    expect(run("false && (1 / 0)", {})).toBe(false);
    expect(run("true || (1 / 0)", {})).toBe(true);
  });

  it("treats if() as a lazy special form", () => {
    expect(run("if(true, 1, 1 / 0)", {})).toBe(1);
    expect(run("if(false, 1 / 0, 2)", {})).toBe(2);
  });

  it("reads members and indexes from the env", () => {
    expect(run("o.x", { o: { x: 5 } })).toBe(5);
    expect(run("a[1]", { a: [10, 20] })).toBe(20);
  });

  it("throws on division and modulo by zero", () => {
    expect(() => run("1 / 0", {})).toThrow(ExprError);
    expect(() => run("mod(1, 0)", {})).toThrow(ExprError);
  });

  it("rejects lambdas at parse time", () => {
    expect(() => parse("x => x + 1")).toThrow(ExprError);
    expect(() => run("(a) => a", {})).toThrow(/Lambda/);
  });

  it("reports referenced idents and called helpers via compile", () => {
    const c = compile("min(n + remaining, 9)");
    expect(c.refs.has("n")).toBe(true);
    expect(c.refs.has("remaining")).toBe(true);
    expect(c.calls.has("min")).toBe(true);
  });
});
