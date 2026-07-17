/**
 * Shared SSE framing for AI stream routes.
 *
 * ## Majority dialect (teach / clarify / tests/generate)
 * Single `data:` line with type-in-JSON payload:
 *   data: {"type":"delta"|"done"|"error", ...}\n\n
 * Matches AGENTS.md (`delta` / `done` / `error`).
 *
 * ## Residual dialect (learn/tutor only)
 * Named SSE events for tool_call / tool_result / chat_created:
 *   event: <name>\ndata: <json>\n\n
 * Kept until CourseTutor client migrates (S7 ownership). Use `sseNamedEvent`.
 * Do not force tutor onto type-in-payload without co-changing the client.
 */

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

const textEncoder = new TextEncoder();

/** Majority dialect: `data: ${JSON.stringify(payload)}\n\n` */
export function sseData(payload: unknown): Uint8Array {
  return textEncoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

/** Residual tutor dialect: named SSE event + data line */
export function sseNamedEvent(event: string, data: unknown): Uint8Array {
  return textEncoder.encode(
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
  );
}

export function sseDelta(text: string): Uint8Array {
  return sseData({ type: "delta", text });
}

export function sseDone(fields: Record<string, unknown> = {}): Uint8Array {
  return sseData({ type: "done", ...fields });
}

/** Opaque stream error — never pass err.message to clients */
export function sseError(error: string): Uint8Array {
  return sseData({ type: "error", error });
}

export function sseResponse(stream: ReadableStream): Response {
  return new Response(stream, { headers: { ...SSE_HEADERS } });
}

/** Enqueue opaque error event and close; swallow if controller already closed */
export function enqueueSseError(
  controller: ReadableStreamDefaultController,
  publicMessage: string,
): void {
  try {
    controller.enqueue(sseError(publicMessage));
    controller.close();
  } catch {
    // Controller may already be closed
  }
}
