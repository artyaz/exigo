import { describe, expect, it } from "vitest";
import {
  iterateParsedSseBlocks,
  iterateSseBlocks,
  parseJsonData,
  parseSseBlock,
} from "./sseClient";

function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[i]!));
      i += 1;
    },
  });
}

async function collectAsync<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of gen) out.push(item);
  return out;
}

describe("parseSseBlock", () => {
  it("parses majority dialect data-only blocks", () => {
    expect(parseSseBlock('data: {"type":"delta","text":"hi"}')).toEqual({
      data: '{"type":"delta","text":"hi"}',
    });
  });

  it("parses residual tutor named-event blocks", () => {
    expect(
      parseSseBlock('event: tool_call\ndata: {"name":"search","id":"1"}'),
    ).toEqual({
      event: "tool_call",
      data: '{"name":"search","id":"1"}',
    });
  });

  it("takes the last data line when several appear", () => {
    expect(parseSseBlock("data: first\ndata: second")).toEqual({
      data: "second",
    });
  });

  it("strips CR from CRLF lines", () => {
    expect(parseSseBlock("event: delta\r\ndata: {\"text\":\"x\"}\r")).toEqual({
      event: "delta",
      data: '{"text":"x"}',
    });
  });

  it("returns null for empty / comment / data-less blocks", () => {
    expect(parseSseBlock("")).toBeNull();
    expect(parseSseBlock("   ")).toBeNull();
    expect(parseSseBlock(": keep-alive")).toBeNull();
    expect(parseSseBlock("event: only")).toBeNull();
  });

  it("handles data: without space after colon", () => {
    expect(parseSseBlock('data:{"type":"done"}')).toEqual({
      data: '{"type":"done"}',
    });
  });
});

describe("parseJsonData", () => {
  it("parses valid JSON", () => {
    expect(parseJsonData<{ type: string }>('{"type":"delta"}')).toEqual({
      type: "delta",
    });
  });

  it("returns null on malformed JSON", () => {
    expect(parseJsonData("{nope")).toBeNull();
  });
});

describe("iterateSseBlocks", () => {
  it("reassembles blocks split across chunks", async () => {
    const stream = streamFromChunks([
      'data: {"type":"delta","text":"Hel',
      'lo"}\n\nevent: chat_created\ndata: {"chatId":"c1"}\n\n',
      "data: incomplete-no-delimiter",
    ]);

    const blocks = await collectAsync(iterateSseBlocks(stream));
    expect(blocks).toEqual([
      'data: {"type":"delta","text":"Hello"}',
      'event: chat_created\ndata: {"chatId":"c1"}',
    ]);
  });

  it("drops incomplete trailing buffer without final delimiter", async () => {
    const stream = streamFromChunks(['data: {"type":"delta"']);
    expect(await collectAsync(iterateSseBlocks(stream))).toEqual([]);
  });
});

describe("iterateParsedSseBlocks", () => {
  it("yields typed blocks for multi-chunk mixed dialects", async () => {
    const stream = streamFromChunks([
      'data: {"type":"delta","text":"a"}\n\n',
      "event: tool_call\n",
      'data: {"name":"search"}\n\n',
      ": keep-alive\n\n",
      'event: error\ndata: {"error":"boom"}\n\n',
    ]);

    const blocks = await collectAsync(iterateParsedSseBlocks(stream));
    expect(blocks).toEqual([
      { data: '{"type":"delta","text":"a"}' },
      { event: "tool_call", data: '{"name":"search"}' },
      { event: "error", data: '{"error":"boom"}' },
    ]);
  });
});
