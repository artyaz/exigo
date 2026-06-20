/* ═══════════════════════════════════════════════════════════════════
   Provider-agnostic AI surface.

   Every model call in the app goes through an AiProvider, so routing —
   the default Google Gemini key vs. a user's custom OpenAI-compatible
   endpoint — is a single decision made in resolve.ts, not scattered
   across routes. Adapters normalise each vendor's response into the same
   { text, raw } shape: `text` is what callers consume, `raw` is the
   untouched vendor object PostHog observability logs verbatim.
   ═══════════════════════════════════════════════════════════════════ */

export type AiProviderKind = "gemini" | "openai";

export interface AiProviderConfig {
  kind: AiProviderKind;
  /** Default model id used when a request doesn't pin one. */
  model: string;
  apiKey: string;
  /** OpenAI-compatible base URL, e.g. "https://api.together.xyz/v1". */
  baseUrl?: string;
  /** Provider label for logs / PostHog (`google` | `openai`). */
  label: string;
}

export interface AiGenerateRequest {
  prompt: string;
  system?: string;
  /** When set, the call is JSON-mode and the schema constrains the output. */
  jsonSchema?: object;
  /** Request JSON output without a strict schema (looser than jsonSchema). */
  json?: boolean;
  /** Override the provider's default model for this call. */
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}

/** One streamed increment: `text` is the delta, `raw` the vendor chunk. */
export interface AiChunk {
  text: string;
  raw: unknown;
}

/** A completed non-streaming response. */
export interface AiResult {
  text: string;
  raw: unknown;
}

export interface AiProvider {
  readonly config: AiProviderConfig;
  generate(req: AiGenerateRequest): Promise<AiResult>;
  stream(req: AiGenerateRequest): AsyncIterable<AiChunk>;
}

export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}
