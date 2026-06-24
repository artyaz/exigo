import { describe, it, expect } from "vitest";
import { uniformSizes } from "./Arena";

describe("Arena.uniformSizes — chip mode vs proportional packing", () => {
  it("classifier blocks (no/equal size → default 1) render as content-sized chips", () => {
    // The shot-1/shot-4 case: text labels, all size 1 → must NOT truncate.
    expect(uniformSizes([1, 1, 1, 1])).toBe(true);
    expect(uniformSizes([5, 5])).toBe(true);
  });

  it("varying byte sizes keep honest proportional widths (the allocator case)", () => {
    expect(uniformSizes([16, 32, 64])).toBe(false);
    expect(uniformSizes([1, 1, 2])).toBe(false);
  });

  it("empty arena is not chip mode", () => {
    expect(uniformSizes([])).toBe(false);
  });
});
