import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

type AuthResult = { userId: string | null };
const authMock = vi.fn<() => Promise<AuthResult>>();
vi.mock("@clerk/nextjs/server", () => ({
    auth: () => authMock(),
}));

const generateContentMock = vi.fn();
vi.mock("@google/genai", () => {
    class GoogleGenAI {
        public models = { generateContent: generateContentMock };
        constructor(_config: unknown) {
            void _config;
        }
    }
    return { GoogleGenAI };
});

vi.mock("../../../../lib/otlpLogger", () => ({
    createRequestId: () => "req_test",
    getErrorAttributes: () => ({}),
    logError: vi.fn(),
    logInfo: vi.fn(),
    logWarn: vi.fn(),
}));

vi.mock("../../../../../shared/posthogAiObservability", () => ({
    captureAiGenerationEvent: vi.fn(),
    createAiTraceId: () => "trace_test",
}));

function makeRequest(body: unknown, opts?: { malformed?: boolean }) {
    const init = opts?.malformed
        ? { method: "POST", body: "{not-json" }
        : { method: "POST", body: JSON.stringify(body) };
    return new Request("http://localhost/api/knowledge/title", init) as unknown as NextRequest;
}

async function loadRoute() {
    vi.resetModules();
    return await import("./route");
}

describe("POST /api/knowledge/title", () => {
    const originalApiKey = process.env.GOOGLE_GEMINI_API_KEY;

    beforeEach(() => {
        authMock.mockReset();
        generateContentMock.mockReset();
    });

    afterEach(() => {
        if (originalApiKey === undefined) {
            delete process.env.GOOGLE_GEMINI_API_KEY;
        } else {
            process.env.GOOGLE_GEMINI_API_KEY = originalApiKey;
        }
    });

    it("returns 401 when the caller is unauthenticated", async () => {
        authMock.mockResolvedValue({ userId: null });
        const { POST } = await loadRoute();

        const res = await POST(makeRequest({ content: "hello" }));

        expect(res.status).toBe(401);
        expect(await res.json()).toEqual({ error: "Unauthorized" });
    });

    it("returns 400 for malformed JSON", async () => {
        authMock.mockResolvedValue({ userId: "user_1" });
        const { POST } = await loadRoute();

        const res = await POST(makeRequest(null, { malformed: true }));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "Malformed JSON" });
    });

    it("returns 400 when the JSON body is the literal null", async () => {
        authMock.mockResolvedValue({ userId: "user_1" });
        const { POST } = await loadRoute();

        const res = await POST(makeRequest(null));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "Malformed JSON" });
    });

    it("returns 400 when content is missing or blank", async () => {
        authMock.mockResolvedValue({ userId: "user_1" });
        const { POST } = await loadRoute();

        const res = await POST(makeRequest({ content: "   " }));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "Missing content" });
    });

    it("returns a fallback title when the Gemini key is not configured", async () => {
        delete process.env.GOOGLE_GEMINI_API_KEY;
        authMock.mockResolvedValue({ userId: "user_1" });
        const { POST } = await loadRoute();

        const res = await POST(
            makeRequest({ content: "Mitochondria are the powerhouse of the cell" })
        );

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ title: "Mitochondria are the powerhouse of" });
        expect(generateContentMock).not.toHaveBeenCalled();
    });

    it("returns the AI-generated title on the happy path", async () => {
        process.env.GOOGLE_GEMINI_API_KEY = "test-key";
        authMock.mockResolvedValue({ userId: "user_1" });
        generateContentMock.mockResolvedValue({ text: "Cellular Energy Basics" });
        const { POST } = await loadRoute();

        const res = await POST(
            makeRequest({ content: "Mitochondria produce ATP via oxidative phosphorylation." })
        );

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ title: "Cellular Energy Basics" });
        expect(generateContentMock).toHaveBeenCalledTimes(1);
    });

    it("falls through to the next model when the first one throws", async () => {
        process.env.GOOGLE_GEMINI_API_KEY = "test-key";
        authMock.mockResolvedValue({ userId: "user_1" });
        generateContentMock
            .mockRejectedValueOnce(new Error("model overloaded"))
            .mockResolvedValueOnce({ text: "Cellular Energy" });
        const { POST } = await loadRoute();

        const res = await POST(makeRequest({ content: "Mitochondria produce ATP." }));

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ title: "Cellular Energy" });
        expect(generateContentMock).toHaveBeenCalledTimes(2);
    });
});
