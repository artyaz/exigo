/**
 * Client-side SSE block framing for AI stream consumers.
 *
 * Product servers emit majority dialect (see `src/lib/sse.ts`):
 *   data: {"type":"delta"|"done"|"error"|…}\n\n
 * Named `event:` lines may still appear from residual/legacy streams; callers
 * can ignore them when using type-in-JSON payloads.
 *
 * This module only splits buffers and extracts `event` / `data` fields.
 */

export type SseBlock = {
  /** Named event from an `event:` line when present (tutor dialect). */
  event?: string;
  /** Raw payload from the last `data:` line in the block. */
  data: string;
};

/**
 * Parse one complete SSE event block (text between `\n\n` delimiters).
 * Returns null for empty / comment-only / data-less blocks.
 */
export function parseSseBlock(block: string): SseBlock | null {
  if (!block.trim()) return null;

  let event: string | undefined;
  let data: string | undefined;

  for (const rawLine of block.split("\n")) {
    // Strip optional CR from `\r\n` framing
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    if (line.startsWith("event:")) {
      event = line.slice(6).replace(/^\s*/, "");
    } else if (line.startsWith("data:")) {
      // SSE allows optional space after the colon; take the rest as-is after one space
      data = line.startsWith("data: ") ? line.slice(6) : line.slice(5);
    }
    // ignore comments (`:`) and unknown fields
  }

  if (data === undefined) return null;
  return event !== undefined && event !== ""
    ? { event, data }
    : { data };
}

/** JSON-parse a data payload; null on failure (malformed chunks). */
export function parseJsonData<T = unknown>(data: string): T | null {
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

/**
 * Yield complete raw SSE blocks from a binary fetch body stream.
 * Incomplete trailing buffer is dropped (matches prior client loops).
 */
export async function* iterateSseBlocks(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<string, void, undefined> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        if (part.trim()) yield part;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** Yield parsed blocks; skips empty / data-less frames. */
export async function* iterateParsedSseBlocks(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<SseBlock, void, undefined> {
  for await (const block of iterateSseBlocks(stream)) {
    const parsed = parseSseBlock(block);
    if (parsed) yield parsed;
  }
}
