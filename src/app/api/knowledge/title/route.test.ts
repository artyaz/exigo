import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

type AuthResult = { userId: string | null; getToken?: () => Promise<string | null> };
const authMock = vi.fn<() => Promise<AuthResult>>();
vi.mock("@clerk/nextjs/server", () => ({
    auth: () => authMock(),
}));

const generateMock = vi.fn();
const resolveAiProviderMock = vi.fn();
vi.mock("../../../../server/ai", () => ({
    resolveAiProvider: (...args: unknown[]) =>
        resolveAiProviderMock(...args) as unknown,
}));

const createAuthedConvexClientMock = vi.fn();
vi.mock("../../../../lib/convexClientAuth", () => ({
    createAuthedConvexClient: (...args: unknown[]) =>
        createAuthedConvexClientMock(...args) as unknown,
}));

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
    beforeEach(() => {
        authMock.mockReset();
        generateMock.mockReset();
        resolveAiProviderMock.mockReset();
        createAuthedConvexClientMock.mockReset();

        createAuthedConvexClientMock.mockResolvedValue({
            query: vi.fn().mockRejectedValue(new Error("no prompt")),
        });
        resolveAiProviderMock.mockResolvedValue({
            config: { label: "google", model: "gemini-test" },
            generate: generateMock,
        });
    });

    it("returns 401 when the caller is unauthenticated", async () => {
        authMock.mockResolvedValue({ userId: null });
        const { POST } = await loadRoute();

        const res = await POST(makeRequest({ content: "hello" }));

        expect(res.status).toBe(401);
        expect(await res.json()).toEqual({ error: "Unauthorized" });
    });

    it("returns 400 for malformed JSON", async () => {
        authMock.mockResolvedValue({ userId: "user_1", getToken: async () => "t" });
        const { POST } = await loadRoute();

        const res = await POST(makeRequest(null, { malformed: true }));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "Malformed JSON" });
    });

    it("returns 400 when the JSON body is the literal null", async () => {
        authMock.mockResolvedValue({ userId: "user_1", getToken: async () => "t" });
        const { POST } = await loadRoute();

        const res = await POST(makeRequest(null));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "Malformed JSON" });
    });

    it("returns 400 when content is missing or blank", async () => {
        authMock.mockResolvedValue({ userId: "user_1", getToken: async () => "t" });
        const { POST } = await loadRoute();

        const res = await POST(makeRequest({ content: "   " }));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "Missing content" });
    });

    it("returns a fallback title when the provider cannot produce a title", async () => {
        authMock.mockResolvedValue({ userId: "user_1", getToken: async () => "t" });
        generateMock.mockRejectedValue(new Error("no model"));
        const { POST } = await loadRoute();

        const res = await POST(
            makeRequest({ content: "Mitochondria are the powerhouse of the cell" })
        );

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ title: "Mitochondria are the powerhouse of" });
    });

    it("returns the AI-generated title on the happy path", async () => {
        authMock.mockResolvedValue({ userId: "user_1", getToken: async () => "t" });
        generateMock.mockResolvedValue({ text: "Cellular Energy Basics", raw: {} });
        const { POST } = await loadRoute();

        const res = await POST(
            makeRequest({ content: "Mitochondria produce ATP via oxidative phosphorylation." })
        );

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ title: "Cellular Energy Basics" });
        expect(generateMock).toHaveBeenCalled();
    });

    it("falls through to the next model when the first one throws", async () => {
        authMock.mockResolvedValue({ userId: "user_1", getToken: async () => "t" });
        generateMock
            .mockRejectedValueOnce(new Error("model overloaded"))
            .mockResolvedValueOnce({ text: "Cellular Energy", raw: {} });
        const { POST } = await loadRoute();

        const res = await POST(makeRequest({ content: "Mitochondria produce ATP." }));

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ title: "Cellular Energy" });
        expect(generateMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
});
