"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Id } from "../../../../convex/_generated/dataModel";
import { iterateParsedSseBlocks, parseJsonData } from "~/lib/sseClient";

type TestForGeneration = {
    spaceId: Id<"spaces">;
    knowledgePieceId?: Id<"knowledgePieces">;
    config: { type: string; questionCount?: number };
} | null | undefined;

type MajoritySsePayload = {
    type: string;
    text?: string;
    error?: string;
};

function isRateLimitMessage(msg: string): boolean {
    return (
        msg.includes("429") ||
        msg.includes("quota") ||
        msg.includes("RESOURCE_EXHAUSTED")
    );
}

/**
 * Background SSE loop that fills a test up to targetQuestionCount.
 * Preserves lastGeneratedForCount guard so re-renders don't re-fire generation.
 * Majority dialect via shared `sseClient` (P5-D residual / P6-B).
 */
export function useTestQuestionGeneration(opts: {
    questionsLength: number | undefined;
    test: TestForGeneration;
    testId: Id<"tests">;
    targetQuestionCount: number;
}): {
    isGeneratingNext: boolean;
    genError: string | null;
    retry: () => void;
} {
    const { questionsLength, test, testId, targetQuestionCount } = opts;

    const [isGeneratingNext, setIsGeneratingNext] = useState(false);
    const [genError, setGenError] = useState<string | null>(null);
    const [retryNonce, setRetryNonce] = useState(0);
    const lastGeneratedForCount = useRef(-1);

    const retry = useCallback(() => {
        setGenError(null);
        lastGeneratedForCount.current = -1;
        setRetryNonce((n) => n + 1);
    }, []);

    useEffect(() => {
        if (questionsLength === undefined || !test) return;
        if (questionsLength >= targetQuestionCount) return;
        if (lastGeneratedForCount.current === questionsLength) return;

        lastGeneratedForCount.current = questionsLength;
        setIsGeneratingNext(true);
        setGenError(null);

        const abortController = new AbortController();

        void (async () => {
            try {
                const res = await fetch("/api/tests/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        spaceId: test.spaceId,
                        testType: test.config.type,
                        testId,
                        knowledgePieceId: test.knowledgePieceId,
                    }),
                    signal: abortController.signal,
                });

                if (!res.ok) {
                    const errBody = await res.text().catch(() => "");
                    const msg = errBody.trim() ? errBody : `Server error (${res.status})`;
                    setGenError(
                        isRateLimitMessage(msg)
                            ? "API rate limit reached. Please wait a moment and retry."
                            : msg
                    );
                    lastGeneratedForCount.current = -1;
                    return;
                }

                if (!res.body) throw new Error("No stream body");

                let hadError = false;

                for await (const block of iterateParsedSseBlocks(res.body)) {
                    // Majority dialect is data-only (`type` in JSON); ignore named-event frames if any
                    if (block.event) continue;
                    const payload = parseJsonData<MajoritySsePayload>(block.data);
                    if (payload?.type !== "error") continue;

                    hadError = true;
                    const msg = payload.error ?? "Generation failed";
                    setGenError(
                        isRateLimitMessage(msg)
                            ? "API rate limit reached. Please wait a moment and retry."
                            : msg
                    );
                }
                if (hadError) lastGeneratedForCount.current = -1;
            } catch (e) {
                if ((e as Error).name !== "AbortError") {
                    console.error("Failed to generate question", e);
                    setGenError("Failed to connect. Check your network and retry.");
                    lastGeneratedForCount.current = -1;
                }
            } finally {
                setIsGeneratingNext(false);
            }
        })();

        return () => abortController.abort();
    }, [questionsLength, test, testId, targetQuestionCount, retryNonce]);

    return { isGeneratingNext, genError, retry };
}
