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

type PosthogCaptureParams = {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
};

type PosthogClient = {
  capture: (params: PosthogCaptureParams) => void;
};

let posthogClient: PosthogClient | null = null;

export function getPosthogClient(): PosthogClient | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!key || !host) {
    return null;
  }
  posthogClient ??= {
    capture: ({ distinctId, event, properties }) => {
      const normalizedHost = host.replace(/\/+$/, "");
      const url = `${normalizedHost}/capture/`;
      void fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: key,
          event,
          distinct_id: distinctId,
          properties: {
            token: key,
            ...(properties ?? {}),
          },
        }),
      }).catch(() => undefined);
    },
  };
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

const MAX_AI_TEXT_LENGTH = 500;

function truncateForAnalytics(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (text.length <= MAX_AI_TEXT_LENGTH) return text;
  return text.slice(0, MAX_AI_TEXT_LENGTH) + "…";
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
    $ai_input: truncateForAnalytics(params.input),
    $ai_input_tokens: params.inputTokens ?? metadata.inputTokens,
    $ai_output_choices: truncateForAnalytics(outputChoices),
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
