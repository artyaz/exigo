import { describe, it, expect } from "vitest";
import { withRetry } from "./retry";
import type { AiProvider, AiProviderConfig, AiGenerateRequest, AiResult, AiChunk } from "./types";
import { AiProviderError } from "./types";

function mockConfig(): AiProviderConfig {
  return { kind: "gemini", model: "test-model", apiKey: "key", label: "google" };
}

function mockProvider(
  generateImpl: (req: AiGenerateRequest) => Promise<AiResult>,
  streamImpl?: (req: AiGenerateRequest) => AsyncIterable<AiChunk>,
): AiProvider {
  return {
    config: mockConfig(),
    generate: generateImpl,
    stream: streamImpl ?? (async function* () {}),
  };
}

describe("withRetry", () => {
  it("returns result on first success without retry", async () => {
    const provider = mockProvider(async () => ({ text: "ok", raw: {} }));
    const wrapped = withRetry(provider, { baseMs: 10 });
    const result = await wrapped.generate({ prompt: "hi" });
    expect(result.text).toBe("ok");
  });

  it("retries on 429 and succeeds on later attempt", async () => {
    let calls = 0;
    const provider = mockProvider(async () => {
      calls++;
      if (calls < 3) throw new AiProviderError("rate limited", 429);
      return { text: "recovered", raw: {} };
    });

    const retries: number[] = [];
    const wrapped = withRetry(provider, {
      baseMs: 10,
      capMs: 50,
      onRetry: (info) => retries.push(info.attempt),
    });

    const result = await wrapped.generate({ prompt: "hi" });
    expect(result.text).toBe("recovered");
    expect(calls).toBe(3);
    expect(retries).toEqual([1, 2]);
  });

  it("throws after exhausting maxAttempts", async () => {
    const provider = mockProvider(async () => {
      throw new AiProviderError("rate limited", 429);
    });

    const wrapped = withRetry(provider, { maxAttempts: 3, baseMs: 10, capMs: 20 });
    await expect(wrapped.generate({ prompt: "hi" })).rejects.toThrow("rate limited");
  });

  it("does not retry non-429 errors", async () => {
    let calls = 0;
    const provider = mockProvider(async () => {
      calls++;
      throw new AiProviderError("server error", 500);
    });

    const wrapped = withRetry(provider, { baseMs: 10 });
    await expect(wrapped.generate({ prompt: "hi" })).rejects.toThrow("server error");
    expect(calls).toBe(1);
  });

  it("retries stream on 429 and yields from successful attempt", async () => {
    let calls = 0;
    const provider = mockProvider(
      async () => ({ text: "", raw: {} }),
      async function* () {
        calls++;
        if (calls < 2) throw new AiProviderError("rate limited", 429);
        yield { text: "chunk1", raw: {} };
        yield { text: "chunk2", raw: {} };
      },
    );

    const wrapped = withRetry(provider, { baseMs: 10, capMs: 20 });
    const chunks: string[] = [];
    for await (const chunk of wrapped.stream({ prompt: "hi" })) {
      chunks.push(chunk.text);
    }
    expect(chunks).toEqual(["chunk1", "chunk2"]);
    expect(calls).toBe(2);
  });

  it("preserves provider config", () => {
    const provider = mockProvider(async () => ({ text: "", raw: {} }));
    const wrapped = withRetry(provider);
    expect(wrapped.config).toEqual(provider.config);
  });
});
