import "server-only";
import type { AiProvider, AiProviderConfig, AiGenerateRequest, AiChunk, AiResult } from "./types";
import { AiProviderError } from "./types";

/* Adapter for any OpenAI-compatible /chat/completions endpoint (OpenAI,
   Together, Groq, OpenRouter, a local llama.cpp server, …). We deliberately
   target the broadest-compatible surface: JSON mode uses `json_object` with
   the schema injected into the system prompt, rather than the newer
   `json_schema` strict mode that many compatible servers don't implement. */

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function buildMessages(req: AiGenerateRequest): ChatMessage[] {
  const messages: ChatMessage[] = [];
  let system = req.system ?? "";
  if (req.jsonSchema) {
    // json_object mode needs the word "json" present and the shape spelled out.
    system +=
      `\n\nRespond with a single JSON object that conforms to this JSON Schema:\n` +
      `${JSON.stringify(req.jsonSchema)}\nOutput only the JSON object, no prose.`;
  } else if (req.json) {
    // json_object mode requires the literal word "json" somewhere in the input.
    system += `\n\nRespond with a single JSON object. Output only JSON, no prose.`;
  }
  if (system.trim()) messages.push({ role: "system", content: system.trim() });
  messages.push({ role: "user", content: req.prompt });
  return messages;
}

function buildBody(req: AiGenerateRequest, config: AiProviderConfig, stream: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: req.model ?? config.model,
    messages: buildMessages(req),
    stream,
  };
  if (req.temperature != null) body.temperature = req.temperature;
  if (req.maxOutputTokens != null) body.max_tokens = req.maxOutputTokens;
  if (req.jsonSchema || req.json) body.response_format = { type: "json_object" };
  return body;
}

export class OpenAiProvider implements AiProvider {
  constructor(readonly config: AiProviderConfig) {}

  private endpoint(): string {
    const base = (this.config.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");
    return `${base}/chat/completions`;
  }

  private headers(): HeadersInit {
    return { "Content-Type": "application/json", Authorization: `Bearer ${this.config.apiKey}` };
  }

  async generate(req: AiGenerateRequest): Promise<AiResult> {
    const res = await fetch(this.endpoint(), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(buildBody(req, this.config, false)),
      signal: req.signal,
    });
    if (!res.ok) throw new AiProviderError(await safeError(res), res.status);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return { text: json.choices?.[0]?.message?.content ?? "", raw: json };
  }

  async *stream(req: AiGenerateRequest): AsyncIterable<AiChunk> {
    const res = await fetch(this.endpoint(), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(buildBody(req, this.config, true)),
      signal: req.signal,
    });
    if (!res.ok) throw new AiProviderError(await safeError(res), res.status);
    if (!res.body) throw new AiProviderError("OpenAI-compatible stream had no body");
    yield* parseSseStream(res.body);
  }
}

/** Parse an OpenAI SSE stream into normalised text deltas. */
export async function* parseSseStream(body: ReadableStream<Uint8Array>): AsyncIterable<AiChunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return;
        try {
          const json = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] };
          const text = json.choices?.[0]?.delta?.content ?? "";
          if (text) yield { text, raw: json };
        } catch {
          // Partial JSON across chunk boundaries — ignore; the next read completes it.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function safeError(res: Response): Promise<string> {
  try {
    const t = await res.text();
    return `OpenAI-compatible request failed (${res.status}): ${t.slice(0, 300)}`;
  } catch {
    return `OpenAI-compatible request failed (${res.status})`;
  }
}
