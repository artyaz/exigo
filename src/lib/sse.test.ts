import { describe, expect, it } from "vitest";
import {
  SSE_HEADERS,
  sseData,
  sseDelta,
  sseDone,
  sseError,
  sseNamedEvent,
} from "./sse";

function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

describe("sse helpers", () => {
  it("encodes majority dialect data frames", () => {
    expect(decode(sseData({ type: "delta", text: "hi" }))).toBe(
      'data: {"type":"delta","text":"hi"}\n\n',
    );
    expect(decode(sseDelta("x"))).toBe(
      'data: {"type":"delta","text":"x"}\n\n',
    );
    expect(decode(sseDone({ testId: "t1" }))).toBe(
      'data: {"type":"done","testId":"t1"}\n\n',
    );
    expect(decode(sseError("Teaching failed"))).toBe(
      'data: {"type":"error","error":"Teaching failed"}\n\n',
    );
  });

  it("encodes residual named-event dialect for tutor", () => {
    expect(decode(sseNamedEvent("tool_call", { name: "search" }))).toBe(
      'event: tool_call\ndata: {"name":"search"}\n\n',
    );
  });

  it("uses unified anti-buffering headers", () => {
    expect(SSE_HEADERS["Content-Type"]).toBe("text/event-stream");
    expect(SSE_HEADERS["Cache-Control"]).toContain("no-transform");
    expect(SSE_HEADERS["X-Accel-Buffering"]).toBe("no");
  });
});
