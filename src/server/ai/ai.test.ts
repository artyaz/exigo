import { describe, it, expect, beforeAll } from "vitest";
import { parseSseStream } from "./openai";
import { encryptSecret, decryptSecret } from "./secrets";

/** Build a ReadableStream from raw SSE text, the way fetch would deliver it. */
function sseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(enc.encode(chunks[i++]));
      else controller.close();
    },
  });
}

async function collect(it: AsyncIterable<{ text: string }>): Promise<string> {
  let out = "";
  for await (const c of it) out += c.text;
  return out;
}

describe("OpenAI-compatible SSE parsing", () => {
  it("assembles deltas in order and stops at [DONE]", async () => {
    const stream = sseStream([
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
      "data: [DONE]\n\n",
    ]);
    expect(await collect(parseSseStream(stream))).toBe("Hello");
  });

  it("survives a JSON object split across read boundaries", async () => {
    const stream = sseStream(['data: {"choices":[{"delta":{"con', 'tent":"AB"}}]}\n\n', "data: [DONE]\n\n"]);
    expect(await collect(parseSseStream(stream))).toBe("AB");
  });

  it("ignores keep-alive comments and empty deltas", async () => {
    const stream = sseStream([
      ": keep-alive\n\n",
      'data: {"choices":[{"delta":{}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"x"}}]}\n\n',
    ]);
    expect(await collect(parseSseStream(stream))).toBe("x");
  });
});

describe("custom-key encryption", () => {
  beforeAll(() => {
    process.env.AI_SETTINGS_SECRET = "test-secret-value-for-aes-gcm-at-least-32-bytes-long";
  });

  it("round-trips a secret", () => {
    const enc = encryptSecret("sk-proj-abc123");
    expect(enc.cipher).not.toContain("sk-proj");
    expect(decryptSecret(enc)).toBe("sk-proj-abc123");
  });

  it("uses a fresh IV each time (no deterministic ciphertext)", () => {
    const a = encryptSecret("same");
    const b = encryptSecret("same");
    expect(a.cipher).not.toBe(b.cipher);
  });

  it("rejects tampered ciphertext (authenticated encryption)", () => {
    const enc = encryptSecret("secret");
    const tampered = { ...enc, cipher: Buffer.from("0".repeat(40)).toString("base64") };
    expect(() => decryptSecret(tampered)).toThrow();
  });
});
