import { describe, it, expect } from "vitest";
import { decodeFrameMessage, isTrustedFrameMessage } from "./SandboxedFrame";

describe("decodeFrameMessage", () => {
  it("ignores non-exigo payloads", () => {
    expect(decodeFrameMessage(null)).toBeNull();
    expect(decodeFrameMessage({ type: "complete" })).toBeNull();
  });

  it("decodes progress / complete / error / height", () => {
    expect(decodeFrameMessage({ __exigo: true, type: "progress", data: { value: 0.4 } })).toEqual({
      type: "progress",
      value: 0.4,
    });
    expect(decodeFrameMessage({ __exigo: true, type: "complete", data: { correct: true, score: 1 } })).toEqual({
      type: "complete",
      result: { correct: true, score: 1 },
    });
    expect(decodeFrameMessage({ __exigo: true, type: "error", data: { message: "boom" } })).toEqual({
      type: "error",
      message: "boom",
    });
    expect(decodeFrameMessage({ __exigo: true, type: "height", data: { height: 480 } })).toEqual({
      type: "height",
      height: 480,
    });
  });

  it("rejects malformed numeric fields", () => {
    expect(decodeFrameMessage({ __exigo: true, type: "progress", data: { value: "x" } })).toBeNull();
    expect(decodeFrameMessage({ __exigo: true, type: "height", data: {} })).toBeNull();
    expect(decodeFrameMessage({ __exigo: true, type: "error", data: { message: 1 } })).toBeNull();
  });
});

describe("isTrustedFrameMessage", () => {
  const win = {} as Window;

  it("requires __exigo, trusted origin, and matching source", () => {
    const good = {
      data: { __exigo: true, type: "complete", data: {} },
      origin: "null",
      source: win as MessageEventSource,
    };
    expect(isTrustedFrameMessage(good, win, "https://app.example")).toBe(true);

    expect(isTrustedFrameMessage({ ...good, data: { type: "complete" } }, win, "https://app.example")).toBe(false);
    expect(isTrustedFrameMessage({ ...good, origin: "https://evil.example" }, win, "https://app.example")).toBe(
      false,
    );
    expect(isTrustedFrameMessage(good, null, "https://app.example")).toBe(false);
    expect(
      isTrustedFrameMessage({ ...good, source: {} as MessageEventSource }, win, "https://app.example"),
    ).toBe(false);
  });

  it("allows same-origin posts (non-opaque sandbox edge cases)", () => {
    const same = {
      data: { __exigo: true },
      origin: "https://app.example",
      source: win as MessageEventSource,
    };
    expect(isTrustedFrameMessage(same, win, "https://app.example")).toBe(true);
  });
});
