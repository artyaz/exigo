import { PostHog } from "posthog-node";

export type AiMessage = {
  role: "user" | "system" | "assistant";
  content: string;
};

type CaptureAiGenerationParams = {
  distinctId: string;
  traceId: string;
  provider: string;
  model: string;
  input: AiMessage[];
  response: unknown;
  latencySeconds: number;
  outputChoices?: AiMessage[];
  inputTokens?: number;
  outputTokens?: number;
  stream?: boolean;
  timeToFirstTokenSeconds?: number;
  httpStatus?: number;
};

let posthogClient: PostHog | null = null;

function getPosthogClient(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!key || !host) {
    return null;
  }
  posthogClient ??= new PostHog(key, {
    host,
    flushAt: 1,
    flushInterval: 0,
  });
  return posthogClient;
}

function extractOutputChoices(response: unknown): AiMessage[] {
  if (!response || typeof response !== "object") {
    return [];
  }

  const withCandidates = response as {
    candidates?: Array<{
      content?: {
        role?: string;
        parts?: Array<{ text?: string }>;
      };
    }>;
    text?: string;
  };

  if (Array.isArray(withCandidates.candidates) && withCandidates.candidates.length) {
    const choices = withCandidates.candidates
      .map((candidate) => {
        const role =
          candidate.content?.role === "system" ||
          candidate.content?.role === "user" ||
          candidate.content?.role === "assistant"
            ? candidate.content.role
            : "assistant";
        const content = (candidate.content?.parts ?? [])
          .map((part) => part.text ?? "")
          .join("")
          .trim();
        return content ? { role, content } : null;
      })
      .filter((choice): choice is AiMessage => choice !== null);

    if (choices.length > 0) {
      return choices;
    }
  }

  if (typeof withCandidates.text === "string" && withCandidates.text.trim()) {
    return [{ role: "assistant", content: withCandidates.text.trim() }];
  }

  return [];
}

function extractTokenAndStatusMetadata(response: unknown): {
  inputTokens: number;
  outputTokens: number;
  httpStatus?: number;
} {
  if (!response || typeof response !== "object") {
    return { inputTokens: 0, outputTokens: 0 };
  }

  const withMetadata = response as {
    usageMetadata?: {
      promptTokenCount?: number;
      responseTokenCount?: number;
      candidatesTokenCount?: number;
    };
    sdkHttpResponse?: {
      status?: number;
    };
  };

  const inputTokens = withMetadata.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens =
    withMetadata.usageMetadata?.responseTokenCount ??
    withMetadata.usageMetadata?.candidatesTokenCount ??
    0;
  const httpStatus = withMetadata.sdkHttpResponse?.status;

  return { inputTokens, outputTokens, httpStatus };
}

export function createAiTraceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `trace-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function captureAiGenerationEvent(params: CaptureAiGenerationParams): void {
  const posthog = getPosthogClient();
  if (!posthog || !params.distinctId) {
    return;
  }

  const metadata = extractTokenAndStatusMetadata(params.response);
  const outputChoices = params.outputChoices ?? extractOutputChoices(params.response);

  const properties: Record<string, unknown> = {
    $ai_trace_id: params.traceId,
    $ai_provider: params.provider,
    $ai_model: params.model,
    $ai_input: params.input,
    $ai_input_tokens: params.inputTokens ?? metadata.inputTokens,
    $ai_output_choices: outputChoices,
    $ai_output_tokens: params.outputTokens ?? metadata.outputTokens,
    $ai_latency: params.latencySeconds,
  };

  if (params.stream) {
    properties.$ai_stream = true;
  }
  if (typeof params.timeToFirstTokenSeconds === "number") {
    properties.$ai_time_to_first_token = params.timeToFirstTokenSeconds;
  }
  const httpStatus = params.httpStatus ?? metadata.httpStatus;
  if (typeof httpStatus === "number") {
    properties.$ai_http_status = httpStatus;
  }

  posthog.capture({
    distinctId: params.distinctId,
    event: "$ai_generation",
    properties,
  });
}
