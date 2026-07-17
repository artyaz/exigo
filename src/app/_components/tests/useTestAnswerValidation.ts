"use client";

import { useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useState, useEffect, useRef, useCallback } from "react";

export type TestQuestion = {
    _id: Id<"questions">;
    userAnswer?: string;
    isCorrect?: boolean;
};

type TestForValidation = {
    knowledgePieceId?: Id<"knowledgePieces">;
    config: { type: string };
} | null | undefined;

export type ToastPayload = { message: string; type: "success" | "error" };

/**
 * Owns local answer draft state, evaluation flags, and the validate SSE/fetch
 * pipeline including auto-advance and end-of-test improvement trigger.
 */
export function useTestAnswerValidation(opts: {
    questions: TestQuestion[] | undefined;
    test: TestForValidation;
    testId: Id<"tests">;
    currentIndex: number;
    setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
    targetQuestionCount: number;
    onToast: (toast: ToastPayload) => void;
}): {
    answers: Record<string, string>;
    isEvaluating: Record<string, boolean>;
    handleAnswer: (questionId: string, answer: string) => Promise<void>;
} {
    const {
        questions,
        test,
        testId,
        currentIndex,
        setCurrentIndex,
        targetQuestionCount,
        onToast,
    } = opts;

    const [answers, setAnswers] = useState<Record<string, string>>({});
    const localCorrectnessRef = useRef<Record<string, boolean>>({});
    const [isEvaluating, setIsEvaluating] = useState<Record<string, boolean>>({});
    const generateImprovements = useAction(api.knowledgeNodesActions.generateImprovements);

    // Hydrate drafts from server + advance to first unanswered on load
    useEffect(() => {
        if (questions) {
            const existing: Record<string, string> = {};
            questions.forEach((q) => {
                if (q.userAnswer) existing[q._id] = q.userAnswer;
            });
            setAnswers((prev) => ({ ...existing, ...prev }));

            const firstUnanswered = questions.findIndex(
                (q) => !q.userAnswer && !answers[q._id]
            );
            if (
                firstUnanswered !== -1 &&
                currentIndex === 0 &&
                questions[0] &&
                !answers[questions[0]._id]
            ) {
                setCurrentIndex(firstUnanswered);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [questions, targetQuestionCount]);

    // Mirror server isCorrect into local ref for score calc before query refreshes
    useEffect(() => {
        if (!questions) return;
        const prev = localCorrectnessRef.current;
        let next: Record<string, boolean> | null = null;
        for (const q of questions) {
            if (q.isCorrect !== undefined && prev[q._id] !== q.isCorrect) {
                next ??= { ...prev };
                next[q._id] = q.isCorrect;
            }
        }
        if (next) localCorrectnessRef.current = next;
    }, [questions]);

    const handleAnswer = useCallback(
        async (questionId: string, answer: string) => {
            if (!answer.trim()) return;
            setAnswers((prev) => ({ ...prev, [questionId]: answer }));
            setIsEvaluating((prev) => ({ ...prev, [questionId]: true }));

            const knowledgePieceId = test?.knowledgePieceId;
            let isCorrect = false;
            let requestFailed = false;
            try {
                const res = await fetch("/api/tests/validate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        questionId,
                        answer,
                        testType: test?.config.type,
                        knowledgePieceId,
                    }),
                });
                if (!res.ok) {
                    requestFailed = true;
                    const errBody = (await res.json().catch(() => ({}))) as {
                        error?: string;
                    };
                    throw new Error(errBody.error ?? `Validation failed (${res.status})`);
                }
                const data = (await res.json()) as { isCorrect?: boolean };
                isCorrect = !!data.isCorrect;
                localCorrectnessRef.current = {
                    ...localCorrectnessRef.current,
                    [questionId]: isCorrect,
                };
            } catch (e) {
                requestFailed = true;
                console.error("Answer validation failed", e);
                onToast({
                    message: e instanceof Error ? e.message : "Failed to validate answer",
                    type: "error",
                });
                setAnswers((prev) => {
                    const next = { ...prev };
                    delete next[questionId];
                    return next;
                });
            } finally {
                setIsEvaluating((prev) => ({ ...prev, [questionId]: false }));
            }

            if (requestFailed) return;

            const mergedCorrectness: Record<string, boolean> = {
                ...localCorrectnessRef.current,
                [questionId]: isCorrect,
            };

            const scheduledIndex = currentIndex;
            setTimeout(() => {
                if (
                    questions &&
                    scheduledIndex === currentIndex &&
                    scheduledIndex < questions.length - 1
                ) {
                    setCurrentIndex((prev) => prev + 1);
                } else if (
                    questions &&
                    scheduledIndex === questions.length - 1 &&
                    scheduledIndex === targetQuestionCount - 1
                ) {
                    const correctCount = questions.reduce((count, q) => {
                        const resolvedCorrectness = mergedCorrectness[q._id];
                        const isQuestionCorrect = resolvedCorrectness ?? q.isCorrect;
                        return count + (isQuestionCorrect === true ? 1 : 0);
                    }, 0);

                    const score = correctCount / targetQuestionCount;
                    if (score >= 0.8 && knowledgePieceId) {
                        void generateImprovements({
                            knowledgePieceId,
                            testId,
                        }).catch((err: unknown) =>
                            console.error("Failed to generate improvements", err)
                        );
                    }
                }
            }, 600);
        },
        [
            test,
            testId,
            currentIndex,
            setCurrentIndex,
            questions,
            targetQuestionCount,
            onToast,
            generateImprovements,
        ]
    );

    return { answers, isEvaluating, handleAnswer };
}
