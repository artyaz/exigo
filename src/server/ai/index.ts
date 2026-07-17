import "server-only";
/* The AI middleware. Every model call routes through resolveAiProvider so
   provider choice (default Gemini vs. a user's custom OpenAI-compatible
   endpoint) is decided in one place. */
export type {
  AiProvider,
  AiProviderConfig,
  AiProviderKind,
  AiGenerateRequest,
  AiChunk,
  AiResult,
} from "./types";
export { AiProviderError } from "./types";
export { GeminiProvider } from "./gemini";
export { OpenAiProvider } from "./openai";
export { resolveAiProvider, defaultGeminiProvider } from "./resolve";
export { encryptSecret, decryptSecret, type Encrypted } from "./secrets";
export { getEnvGeminiClient, getEnvGeminiModel } from "./geminiEnv";
