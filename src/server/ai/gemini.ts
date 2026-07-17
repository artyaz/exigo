import "server-only";
import { GoogleGenAI } from "@google/genai";
import type { AiProvider, AiProviderConfig, AiGenerateRequest, AiChunk, AiResult } from "./types";
import { AiProviderError } from "./types";

/** Adapter over @google/genai. Mirrors the call shape the routes already
    used (responseMimeType + responseJsonSchema for JSON mode) so existing
    observability keeps logging the genuine vendor response. */
export class GeminiProvider implements AiProvider {
  private readonly ai: GoogleGenAI;
  constructor(readonly config: AiProviderConfig) {
    this.ai = new GoogleGenAI({ apiKey: config.apiKey });
  }

  private buildConfig(req: AiGenerateRequest): Record<string, unknown> {
    const cfg: Record<string, unknown> = {};
    if (req.system) cfg.systemInstruction = req.system;
    if (req.temperature != null) cfg.temperature = req.temperature;
    if (req.maxOutputTokens != null) cfg.maxOutputTokens = req.maxOutputTokens;
    if (req.jsonSchema) {
      cfg.responseMimeType = "application/json";
      cfg.responseJsonSchema = req.jsonSchema;
    } else if (req.json) {
      cfg.responseMimeType = "application/json";
    }
    return cfg;
  }

  async generate(req: AiGenerateRequest): Promise<AiResult> {
    try {
      const response = await this.ai.models.generateContent({
        model: req.model ?? this.config.model,
        contents: req.prompt,
        config: this.buildConfig(req),
      });
      return { text: response.text ?? "", raw: response };
    } catch (e) {
      throw asProviderError(e);
    }
  }

  async *stream(req: AiGenerateRequest): AsyncIterable<AiChunk> {
    let stream;
    try {
      stream = await this.ai.models.generateContentStream({
        model: req.model ?? this.config.model,
        contents: req.prompt,
        config: this.buildConfig(req),
      });
    } catch (e) {
      throw asProviderError(e);
    }
    for await (const chunk of stream) {
      const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text ?? chunk.text ?? "";
      if (text) yield { text, raw: chunk };
    }
  }
}

function asProviderError(e: unknown): AiProviderError {
  const err = e as { status?: number; message?: string };
  return new AiProviderError(err.message ?? "Gemini request failed", err.status);
}
