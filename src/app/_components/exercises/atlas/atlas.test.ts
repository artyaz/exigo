import { describe, it, expect } from "vitest";
import { createLimiter, withRetry } from "./concurrency";
import {
  extractJson,
  parseBrainstorm,
  parseLesson,
  parseSciences,
  parseSubtopics,
  pickMechanic,
} from "./prompts";

describe("createLimiter", () => {
  it("never runs more than `max` tasks at once", async () => {
    const limit = createLimiter(2);
    let active = 0;
    let peak = 0;
    const task = (): Promise<void> => {
      active++;
      peak = Math.max(peak, active);
      return new Promise((r) => setTimeout(() => ((active--), r()), 8));
    };
    await Promise.all(Array.from({ length: 7 }, () => limit(task)));
    expect(peak).toBe(2);
  });
});

describe("withRetry", () => {
  it("retries until success", async () => {
    let n = 0;
    const out = await withRetry(() => (++n < 3 ? Promise.reject(new Error("x")) : Promise.resolve("ok")), 5, "t");
    expect(out).toBe("ok");
    expect(n).toBe(3);
  });
  it("throws a labelled error after exhausting tries", async () => {
    await expect(withRetry(() => Promise.reject(new Error("boom")), 2, "stage")).rejects.toThrow(/stage failed.*boom/);
  });
});

describe("extractJson — tolerates fences and surrounding prose", () => {
  it("strips a ```json fence", () => {
    expect(extractJson('```json\n["a","b"]\n```')).toEqual(["a", "b"]);
  });
  it("finds the JSON inside loose prose", () => {
    expect(extractJson('Sure! Here: {"x":1} — enjoy')).toEqual({ x: 1 });
  });
});

describe("stage parsers", () => {
  it("parseSciences accepts strings or {name}", () => {
    const out = parseSciences('["Physics", {"name":"Computer Science"}]');
    expect(out.map((s) => s.name)).toEqual(["Physics", "Computer Science"]);
    expect(out[0]!.id).toMatch(/^sci-/);
  });
  it("parseSubtopics tags the scienceId", () => {
    const out = parseSubtopics('[{"title":"Quark gluon plasma viscosity","blurb":"near-perfect fluid"}]', "sci-1");
    expect(out[0]).toMatchObject({ scienceId: "sci-1", title: "Quark gluon plasma viscosity" });
  });
  it("parseLesson extracts title, content, and exercise briefs", () => {
    const l = parseLesson('{"title":"T","content":"p1\\n\\np2","exercises":["teach A","teach B"]}');
    expect(l.title).toBe("T");
    expect(l.exercises).toEqual(["teach A", "teach B"]);
  });
  it("parseBrainstorm yields the option strings", () => {
    expect(parseBrainstorm('["m1","m2","m3"]')).toEqual(["m1", "m2", "m3"]);
  });
});

describe("pickMechanic", () => {
  it("selects by the injected RNG", () => {
    expect(pickMechanic(["a", "b", "c"], () => 0.5)).toBe("b");
  });
  it("is safe on an empty list", () => {
    expect(pickMechanic([])).toBe("");
  });
});
