
"use client";

import { useQuery, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useState, use, useEffect, useRef, useCallback, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Loader2,
    ArrowLeft,
    CheckCircle2,
    XCircle,
    ChevronLeft,
    ChevronRight,
    BrainCircuit,
    MessageSquare,
    Sparkles,
    CornerDownLeft,
    AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";

/* ─── spring presets ─── */
const SPRING_SNAPPY = { type: "spring" as const, stiffness: 500, damping: 30 };
const SPRING_GENTLE = { type: "spring" as const, stiffness: 300, damping: 28 };

/* ─── card stack config ─── */
const STACK_VISIBLE = 3;

/** Deterministic hash for pseudo-random card offsets */
function cardHash(id: string, seed: number) {
    let h = seed;
    for (let i = 0; i < id.length; i++) h = Math.trunc(((h << 5) - h + (id.codePointAt(i) ?? 0)));
    return h;
}

/* ─── Basic markdown renderer for chat messages ─── */
/**
 * Parses inline markdown tokens: **bold**, *italic*, `code`.
 * Uses lookbehind / lookahead so a single * doesn't collide with **.
 */
function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
    const result: ReactNode[] = [];
    // Order matters: match bold (**text**) or code (`text`) before italic (*text*).
    // This avoids lookbehind/lookahead which breaks on older Safari.
    const tokenRegex = /(\*\*(.+?)\*\*|`(.+?)`|\*([^*]+?)\*)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let partIdx = 0;

    while ((match = tokenRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            result.push(text.slice(lastIndex, match.index));
        }

        const key = `${keyPrefix}-${partIdx++}`;
        if (match[2] !== undefined) {
            // **bold**
            result.push(
                <strong key={key} className="font-semibold text-white">
                    {match[2]}
                </strong>
            );
        } else if (match[3] !== undefined) {
            // `code`
            result.push(
                <code
                    key={key}
                    className="px-1.5 py-0.5 rounded bg-white/[0.08] text-[11px] font-mono text-white/90 border border-white/[0.06]"
                >
                    {match[3]}
                </code>
            );
        } else if (match[4] !== undefined) {
            // *italic* (captured without lookbehind)
            result.push(
                <em key={key} className="italic text-white/80">
                    {match[4]}
                </em>
            );
        }

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        result.push(text.slice(lastIndex));
    }

    return result;
}

/**
 * Renders basic markdown: bullet lists (* / -), **bold**, *italic*, `code`,
 * and newlines.
 */
function renderMarkdown(text: string): ReactNode[] {
    const lines = text.split("\n");
    const result: ReactNode[] = [];

    lines.forEach((line, lineIdx) => {
        if (lineIdx > 0) result.push(<br key={`br-${lineIdx}`} />);

        // Detect bullet-list lines: "* text", "*   text", "- text"
        const bulletMatch = /^(\s*)[*-]\s+(.*)/.exec(line);
        if (bulletMatch) {
            const indent = bulletMatch[1] ?? "";
            const content = bulletMatch[2] ?? "";
            result.push(
                <span key={`li-${lineIdx}`} style={{ paddingLeft: indent.length * 8 }} className="inline-flex gap-1.5">
                    <span className="text-white/40 select-none shrink-0">•</span>
                    <span>{renderInlineMarkdown(content, `${lineIdx}`)}</span>
                </span>
            );
            return;
        }

        // Regular line — just inline formatting
        result.push(...renderInlineMarkdown(line, `${lineIdx}`));
    });

    return result;
}

export default function TestPage({ params }: { params: Promise<{ testId: string }> }) {
    const { testId } = use(params);
    const tId = testId as Id<"tests">;
    const { userId } = useAuth();

    const test = useQuery(api.tests.get, userId ? { testId: tId } : "skip");
    const questions = useQuery(api.questions.getForTest, userId ? { testId: tId } : "skip");

    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [, setLocalCorrectness] = useState<Record<string, boolean>>({});
    const localCorrectnessRef = useRef<Record<string, boolean>>({});
    const [isEvaluating, setIsEvaluating] = useState<Record<string, boolean>>({});
    const [isGeneratingNext, setIsGeneratingNext] = useState(false);
    const [, setStreamingText] = useState(""); // value unused; only setter needed
    const [genError, setGenError] = useState<string | null>(null);
    const [retryNonce, setRetryNonce] = useState(0);
    const [, setDirection] = useState(1); // value unused; only setter needed
    const [prevQuestionsLength, setPrevQuestionsLength] = useState(0);

    // Chat State
    const [chatInput, setChatInput] = useState("");
    const [isSendingChat, setIsSendingChat] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const chatInputRef = useRef<HTMLInputElement>(null);

    // Context menu ("Feels hard") state
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        messageId: string;
        messageContent: string;
    } | null>(null);
    const [feelsHardLoading, setFeelsHardLoading] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    // Arena dimensions for card positioning
    const arenaRef = useRef<HTMLDivElement>(null);
    const [arenaW, setArenaW] = useState(800);
    const [arenaH, setArenaH] = useState(600);

    const targetQuestionCount = test?.config?.questionCount ?? 5;
    const currentQuestion = questions?.[currentIndex];

    // Chat for current question
    const currentQuestionId = currentQuestion?._id;
    const testMessages = useQuery(
        api.testMessages.getForQuestion,
        currentQuestionId && userId ? { questionId: currentQuestionId, userId } : "skip"
    );

    // Detect new question appearing (for animation)
    useEffect(() => {
        if (questions && questions.length > prevQuestionsLength) {
            setPrevQuestionsLength(questions.length);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [questions?.length, prevQuestionsLength]);

    // Track arena size
    useEffect(() => {
        if (!arenaRef.current) return;
        const ro = new ResizeObserver(entries => {
            if (!entries?.[0]) return;
            const { width, height } = entries[0].contentRect;
            setArenaW(width);
            setArenaH(height);
        });
        ro.observe(arenaRef.current);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        if (questions) {
            const existing: Record<string, string> = {};
            questions.forEach(q => {
                if (q.userAnswer) existing[q._id] = q.userAnswer;
            });
            setAnswers(prev => ({ ...existing, ...prev }));

            // Advance to first unanswered
            const firstUnanswered = questions.findIndex(q => !q.userAnswer && !answers[q._id]);
            if (firstUnanswered !== -1 && currentIndex === 0 && questions[0] && !answers[questions[0]._id]) {
                setCurrentIndex(firstUnanswered);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [questions, targetQuestionCount]);

    useEffect(() => {
        if (!questions) return;
        setLocalCorrectness((prev) => {
            let changed = false;
            let next: Record<string, boolean> | null = null;
            for (const q of questions) {
                if (q.isCorrect !== undefined && prev[q._id] !== q.isCorrect) {
                    next ??= { ...prev };
                    next[q._id] = q.isCorrect;
                    changed = true;
                }
            }

            if (!changed || !next) {
                return prev;
            }

            localCorrectnessRef.current = next;
            return next;
        });
    }, [questions]);

    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [testMessages]);

    // Background question generation
    const lastGeneratedForCount = useRef(-1);
    useEffect(() => {
        if (!questions || !test) return;
        if (questions.length >= targetQuestionCount) return;
        if (lastGeneratedForCount.current === questions.length) return;

        lastGeneratedForCount.current = questions.length;
        setIsGeneratingNext(true);
        setStreamingText("");
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
                        testId: tId,
                        knowledgePieceId: sessionStorage.getItem(`exigo_test_topic_${tId}`) ?? undefined,
                    }),
                    signal: abortController.signal,
                });

                if (!res.ok) {
                    const errBody = await res.text().catch(() => "");
                    let parsedError: {
                        error?: string;
                        message?: string;
                        code?: string;
                        details?: { testsThisMonth?: number; maxTestsPerMonth?: number };
                    } | null = null;
                    if (errBody.trim().startsWith("{")) {
                        try {
                            parsedError = JSON.parse(errBody) as {
                                error?: string;
                                message?: string;
                                code?: string;
                                details?: { testsThisMonth?: number; maxTestsPerMonth?: number };
                            };
                        } catch {
                            parsedError = null;
                        }
                    }

                    const msg = parsedError?.message ?? parsedError?.error ?? (errBody.trim() ? errBody : `Server error (${res.status})`);
                    if (
                        parsedError?.code === "TEST_MONTHLY_LIMIT_REACHED" &&
                        typeof parsedError.details?.testsThisMonth === "number" &&
                        typeof parsedError.details?.maxTestsPerMonth === "number"
                    ) {
                        setGenError(
                            `Monthly test limit reached (${parsedError.details.testsThisMonth}/${parsedError.details.maxTestsPerMonth}). Upgrade your plan to continue.`
                        );
                    } else if (parsedError?.code === "TEST_SUBSCRIPTION_REQUIRED") {
                        setGenError("Test generation requires an active subscription.");
                    } else if (parsedError?.code === "TEST_PLAN_ACCESS_DENIED") {
                        setGenError("Your current plan does not include test generation. Upgrade to continue.");
                    } else {
                        setGenError(msg.includes("429") || msg.includes("quota")
                            ? "API rate limit reached. Please wait a moment and retry."
                            : msg);
                    }
                    lastGeneratedForCount.current = -1;
                    return;
                }

                if (!res.body) throw new Error("No stream body");

                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let buffer = "";
                let hadError = false;

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split("\n\n");
                    buffer = lines.pop() ?? "";

                    for (const line of lines) {
                        if (!line.startsWith("data: ")) continue;
                        try {
                            const payload = JSON.parse(line.slice(6)) as {
                                type: string;
                                text?: string;
                                error?: string;
                                message?: string;
                                code?: string;
                                details?: { testsThisMonth?: number; maxTestsPerMonth?: number };
                            };
                            if (payload.type === "delta") {
                                setStreamingText(prev => prev + (payload.text ?? ""));
                            } else if (payload.type === "error") {
                                hadError = true;
                                const msg = payload.message ?? payload.error ?? "Generation failed";
                                if (
                                    payload.code === "TEST_MONTHLY_LIMIT_REACHED" &&
                                    typeof payload.details?.testsThisMonth === "number" &&
                                    typeof payload.details?.maxTestsPerMonth === "number"
                                ) {
                                    setGenError(
                                        `Monthly test limit reached (${payload.details.testsThisMonth}/${payload.details.maxTestsPerMonth}). Upgrade your plan to continue.`
                                    );
                                } else if (payload.code === "TEST_SUBSCRIPTION_REQUIRED") {
                                    setGenError("Test generation requires an active subscription.");
                                } else if (payload.code === "TEST_PLAN_ACCESS_DENIED") {
                                    setGenError("Your current plan does not include test generation. Upgrade to continue.");
                                } else if (msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED")) {
                                    setGenError("API rate limit reached. Please wait a moment and retry.");
                                } else {
                                    setGenError(msg);
                                }
                            }
                        } catch { /* skip */ }
                    }
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
                setStreamingText("");
            }
        })();

        return () => abortController.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [questions?.length, test, tId, targetQuestionCount, retryNonce]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const tag = document.activeElement?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA") return;

            if (!questions || !currentQuestion) return;

            // Arrow keys for navigation in review
            if (e.key === "ArrowLeft" && currentIndex > 0) {
                e.preventDefault();
                setDirection(-1);
                setCurrentIndex(currentIndex - 1);
            } else if (e.key === "ArrowRight" && currentIndex < questions.length - 1) {
                e.preventDefault();
                setDirection(1);
                setCurrentIndex(currentIndex + 1);
            }

            // Number keys for select questions
            if (test?.config.type === "select" && currentQuestion.options && !answers[currentQuestion._id] && !currentQuestion.userAnswer) {
                const num = Number.parseInt(e.key);
                const opt = currentQuestion.options[num - 1];
                if (num >= 1 && num <= 4 && opt) {
                    e.preventDefault();
                    void handleAnswer(currentQuestion._id, opt);
                }
            }

            // Escape to go back
            if (e.key === "Escape") {
                globalThis.history.back();
            }
        };
        globalThis.addEventListener("keydown", handleKeyDown);
        return () => globalThis.removeEventListener("keydown", handleKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [questions, currentIndex, currentQuestion, answers, test]);

    const generateImprovements = useAction(api.knowledgeNodes.generateImprovements);

    const handleAnswer = async (questionId: string, answer: string) => {
        if (!answer.trim()) return;
        setAnswers(prev => ({ ...prev, [questionId]: answer }));
        setIsEvaluating(prev => ({ ...prev, [questionId]: true }));

        const knowledgePieceId = sessionStorage.getItem(`exigo_test_topic_${tId}`) ?? undefined;
        let isCorrect = false;
        let requestFailed = false;
        try {
            const res = await fetch("/api/tests/validate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ questionId, answer, testType: test?.config.type, knowledgePieceId }),
            });
            if (!res.ok) {
                requestFailed = true;
                const errBody = await res.json().catch(() => ({})) as { error?: string };
                throw new Error(errBody.error ?? `Validation failed (${res.status})`);
            }
            const data = await res.json() as { isCorrect?: boolean };
            isCorrect = !!data.isCorrect;
            setLocalCorrectness((prev) => {
                const next = { ...prev, [questionId]: isCorrect };
                localCorrectnessRef.current = next;
                return next;
            });
        } catch (e) {
            requestFailed = true;
            console.error("Answer validation failed", e);
            setToast({ message: e instanceof Error ? e.message : "Failed to validate answer", type: "error" });
            setAnswers((prev) => {
                const next = { ...prev };
                delete next[questionId];
                return next;
            });
        } finally {
            setIsEvaluating(prev => ({ ...prev, [questionId]: false }));
        }

        if (requestFailed) {
            return;
        }

        const mergedCorrectness: Record<string, boolean> = { ...localCorrectnessRef.current, [questionId]: isCorrect };

        // Auto-advance after brief delay — capture index to prevent stale closure
        const scheduledIndex = currentIndex;
        setTimeout(() => {
            if (questions && scheduledIndex === currentIndex && scheduledIndex < questions.length - 1) {
                setDirection(1);
                setCurrentIndex(prev => prev + 1);
            } else if (questions && scheduledIndex === questions.length - 1 && scheduledIndex === targetQuestionCount - 1) {
                // Last question answered! Let's compute score.
                const correctCount = questions.reduce((count, q) => {
                    const resolvedCorrectness = mergedCorrectness[q._id];
                    const isQuestionCorrect = resolvedCorrectness ?? q.isCorrect;
                    return count + (isQuestionCorrect === true ? 1 : 0);
                }, 0);

                const score = correctCount / targetQuestionCount;
                if (score >= 0.8 && knowledgePieceId) {
                    // Trigger improvements generation softly in background
                    void generateImprovements({
                        knowledgePieceId: knowledgePieceId as Id<"knowledgePieces">,
                        testId: tId
                    }).catch((err: unknown) => console.error("Failed to generate improvements", err));
                }
            }
        }, 600);
    };

    const handleSendChat = async () => {
        if (!chatInput.trim() || !currentQuestionId) return;
        setIsSendingChat(true);
        const msg = chatInput;
        setChatInput("");

        try {
            const response = await fetch("/api/tests/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    testId: tId,
                    questionId: currentQuestionId,
                    message: msg,
                }),
            });
            if (!response.ok) {
                let serverMessage = "Chat failed";
                try {
                    const errorPayload = await response.json() as { error?: string };
                    if (typeof errorPayload.error === "string" && errorPayload.error) {
                        serverMessage = errorPayload.error;
                    }
                } catch {
                    // ignore malformed error payload
                }
                throw new Error(serverMessage);
            }
        } catch (e) {
            console.error("Chat failed", e);
            setChatInput(msg);
            setToast({ message: e instanceof Error ? e.message : "Chat failed", type: "error" });
        } finally {
            setIsSendingChat(false);
        }
    };

    // Context menu handler for right-clicking AI messages
    const handleMessageContextMenu = useCallback((e: React.MouseEvent, messageId: string, messageContent: string) => {
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            messageId,
            messageContent,
        });
    }, []);

    // Close context menu on any click or scroll
    useEffect(() => {
        if (!contextMenu) return;
        const close = () => setContextMenu(null);
        globalThis.addEventListener("click", close);
        globalThis.addEventListener("scroll", close, true);
        return () => {
            globalThis.removeEventListener("click", close);
            globalThis.removeEventListener("scroll", close, true);
        };
    }, [contextMenu]);

    // Auto-dismiss toast
    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 3500);
        return () => clearTimeout(timer);
    }, [toast]);

    const handleFeelsHard = async (messageId: string, messageContent: string) => {
        setContextMenu(null);
        if (!currentQuestionId) return;

        setFeelsHardLoading(messageId);

        try {
            const knowledgePieceId = sessionStorage.getItem(`exigo_test_topic_${tId}`) ?? undefined;

            const res = await fetch("/api/tests/feels-hard", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    testId: tId,
                    questionId: currentQuestionId,
                    messageContent,
                    knowledgePieceId,
                }),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({})) as { error?: string };
                throw new Error(errData.error ?? "Failed to save");
            }

            setToast({ message: "Struggle note added to knowledge base", type: "success" });
        } catch (e) {
            console.error("Feels hard failed", e);
            setToast({ message: e instanceof Error ? e.message : "Failed to save", type: "error" });
        } finally {
            setFeelsHardLoading(null);
        }
    };

    /* ─── Loading ─── */
    if (test === undefined || questions === undefined) {
        return (
            <div className="h-screen bg-black flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 text-white/30 animate-spin" />
                <p className="text-white/40 text-xs font-medium tracking-widest uppercase">Loading test</p>
            </div>
        );
    }

    if (test === null) {
        return (
            <div className="h-screen bg-black text-white flex items-center justify-center flex-col gap-4">
                <h1 className="text-xl font-semibold">Test not found</h1>
                <Link href="/spaces" className="text-white/60 hover:text-white text-sm spring-interact">
                    Return to Spaces
                </Link>
            </div>
        );
    }



    // Build left stack (answered/past) and right stack (upcoming)
    const rightCards = questions.filter((_, i) => i > currentIndex);

    return (
        <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
            {/* ─── Header ─── */}
            <header className="shrink-0 px-6 py-4 flex items-center justify-between border-b border-white/[0.06]">
                <div className="flex items-center gap-4">
                    <Link
                        href={`/spaces/${test.spaceId}`}
                        aria-label="Back to space"
                        className="p-2 rounded-lg glass-card hover:bg-white/5 spring-interact text-white/50 hover:text-white"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </Link>
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-white/90">
                            Question {currentIndex + 1}
                        </span>
                        <span className="text-white/20">/</span>
                        <span className="text-sm text-white/40">
                            {targetQuestionCount}
                        </span>
                        {isGeneratingNext && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex items-center gap-1.5 ml-2"
                            >
                                <Loader2 className="w-3 h-3 animate-spin text-white/30" />
                                <span className="text-[10px] text-white/30 uppercase tracking-widest">Generating</span>
                            </motion.div>
                        )}
                    </div>
                </div>

                {/* Progress bar */}
                <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-1">
                        {Array.from({ length: targetQuestionCount }).map((_, i) => {
                            const isCurrentlyGenerating = isGeneratingNext && i === questions.length;

                            if (isCurrentlyGenerating) {
                                return (
                                    <motion.div
                                        key={`${i}-gen`}
                                        initial={{ opacity: 0, scale: 0 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="w-3 h-3 flex items-center justify-center"
                                    >
                                        <motion.div
                                            className="w-2 h-2 rounded-full border border-white/30 border-t-white/70"
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
                                        />
                                    </motion.div>
                                );
                            }

                            return (
                                <motion.div
                                    key={`${i}-dot`}
                                    className="h-1 rounded-full"
                                    animate={{
                                        width: i === currentIndex ? 20 : 8,
                                        backgroundColor:
                                            i < questions.length && questions[i] && (questions[i].userAnswer || answers[questions[i]._id])
                                                ? questions[i].isCorrect === true
                                                    ? "rgba(74, 222, 128, 0.7)"
                                                    : questions[i].isCorrect === false
                                                        ? "rgba(248, 113, 113, 0.7)"
                                                        : "rgba(255, 255, 255, 0.4)"
                                                : i === currentIndex
                                                    ? "rgba(255, 255, 255, 0.6)"
                                                    : i < questions.length
                                                        ? "rgba(255, 255, 255, 0.15)"
                                                        : "rgba(255, 255, 255, 0.06)",
                                    }}
                                    transition={SPRING_SNAPPY}
                                />
                            );
                        })}
                    </div>
                    <div className="flex items-center gap-2 text-white/30">
                        <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono">Esc</kbd>
                        <span className="text-[10px]">Back</span>
                    </div>
                </div>
            </header>

            {/* ─── Main content ─── */}
            <div className="flex-1 flex min-h-0">
                {/* ─── Card arena ─── */}
                <div className="flex-1 relative min-w-0 overflow-hidden" ref={arenaRef}>
                    {/* Every question = one motion.div that grows/shrinks */}
                    {questions.map((q, idx) => {
                        const isActive = idx === currentIndex;
                        const offset = idx - currentIndex;
                        const isLeft = offset < 0;
                        const absOffset = Math.abs(offset);
                        const isNodeGuided = Boolean(q.knowledgeNodeId);
                        const isPieceGuided = Boolean(test.knowledgePieceId);

                        if (!isActive && absOffset > STACK_VISIBLE) return null;

                        const depth = Math.max(0, absOffset - 1);
                        const rot = isActive ? 0 : ((cardHash(q._id, isLeft ? 1 : 3) % 9) - 4) * 1.0;
                        const yOff = isActive ? 0 : ((cardHash(q._id, isLeft ? 2 : 4) % 7) - 3) * 4;

                        const stackX = isLeft
                            ? -(arenaW / 2 - 90) + depth * -16
                            : (arenaW / 2 - 90) + depth * 16;

                        const activeW = Math.min(arenaW - 48, 672);
                        const activeH = arenaH - 48;

                        return (
                            <motion.div
                                key={q._id}
                                animate={{
                                    width: isActive ? activeW : 130,
                                    height: isActive ? activeH : 170,
                                    x: isActive ? -activeW / 2 : stackX - 65,
                                    y: isActive ? -activeH / 2 : yOff - 85,
                                    rotate: rot,
                                    scale: isActive ? 1 : (1 - depth * 0.06),
                                    opacity: isActive ? 1 : ((isLeft ? 0.7 : 0.6) - depth * 0.15),
                                    zIndex: isActive ? 50 : (STACK_VISIBLE - depth + 1),
                                }}
                                transition={{
                                    x: SPRING_SNAPPY,
                                    y: SPRING_SNAPPY,
                                    scale: SPRING_SNAPPY,
                                    rotate: SPRING_SNAPPY,
                                    opacity: SPRING_SNAPPY,
                                    width: { duration: 0 },
                                    height: { duration: 0 },
                                    zIndex: { duration: 0 },
                                }}
                                className={`absolute rounded-2xl border overflow-hidden ${isActive
                                    ? 'border-white/[0.08] bg-[#0A0A0A] shadow-[0_4px_24px_rgba(0,0,0,0.5)]'
                                    : 'border-white/[0.08] bg-[#0D0D0D] shadow-[0_2px_12px_rgba(0,0,0,0.4)] cursor-pointer hover:bg-white/[0.04]'
                                    }`}
                                style={{ top: '50%', left: '50%' }}
                                onClick={!isActive ? () => { setDirection(offset > 0 ? 1 : -1); setCurrentIndex(idx); } : undefined}
                            >
                                {/* Stack preview — fades out when active */}
                                <motion.div
                                    animate={{ opacity: isActive ? 0 : 1 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute inset-0 p-3 flex flex-col gap-2 overflow-hidden"
                                    style={{ zIndex: isActive ? 0 : 1, pointerEvents: 'none' }}
                                >
                                    <p className="text-[9px] text-white/40 uppercase tracking-widest font-semibold">Q{idx + 1}</p>
                                    <p className="text-[10px] text-white/30 line-clamp-5 leading-relaxed flex-1">{q.question}</p>
                                    {isLeft && (
                                        <div className="flex items-center gap-1">
                                            {q.isCorrect === true && <CheckCircle2 className="w-3 h-3 text-green-400/60" />}
                                            {q.isCorrect === false && <XCircle className="w-3 h-3 text-red-400/60" />}
                                            {q.isCorrect === undefined && q.userAnswer && <div className="w-2 h-2 rounded-full bg-white/25" />}
                                        </div>
                                    )}
                                </motion.div>

                                {/* Full card content — fades in when active */}
                                <motion.div
                                    animate={{ opacity: isActive ? 1 : 0 }}
                                    transition={{ duration: 0.2, delay: isActive ? 0.12 : 0 }}
                                    className="absolute inset-0 flex flex-col"
                                    style={{ zIndex: isActive ? 1 : 0, pointerEvents: isActive ? 'auto' : 'none', minWidth: activeW, minHeight: activeH }}
                                >
                                    <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
                                        <div className="shrink-0 px-8 pt-7 pb-5 border-b border-white/[0.04]">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-semibold">
                                                        Question {idx + 1}
                                                    </span>
                                                    {isNodeGuided && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-emerald-400/25 bg-emerald-400/10 text-[10px] font-medium text-emerald-200/90">
                                                            <BrainCircuit className="w-3 h-3" />
                                                            Node-guided
                                                        </span>
                                                    )}
                                                    {!isNodeGuided && isPieceGuided && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-white/10 bg-white/[0.04] text-[10px] font-medium text-white/55">
                                                            <Sparkles className="w-3 h-3" />
                                                            Piece-guided
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {q.isCorrect === true && (
                                                        <div className="flex items-center gap-1.5 text-green-400 bg-green-400/10 px-2.5 py-1 rounded-md text-[10px] font-semibold border border-green-400/20">
                                                            <CheckCircle2 className="w-3 h-3" /> Correct
                                                        </div>
                                                    )}
                                                    {q.isCorrect === false && (
                                                        <div className="flex items-center gap-1.5 text-red-400 bg-red-400/10 px-2.5 py-1 rounded-md text-[10px] font-semibold border border-red-400/20">
                                                            <XCircle className="w-3 h-3" /> Incorrect
                                                        </div>
                                                    )}
                                                    {isEvaluating[q._id] && <Loader2 className="w-3.5 h-3.5 animate-spin text-white/30" />}
                                                </div>
                                            </div>
                                            <h2 className="text-lg md:text-xl font-semibold leading-relaxed text-white tracking-tight">{q.question}</h2>
                                        </div>

                                        <div className="flex-1 px-8 py-6">
                                            {test.config.type === "select" && q.options ? (
                                                <div className="grid gap-3">
                                                    {q.options.map((opt, i) => {
                                                        const selectedAnswer = answers[q._id] ?? q.userAnswer;
                                                        const isSelected = selectedAnswer === opt;
                                                        const isAnswered = !!selectedAnswer;
                                                        const isCorrectAnswer = q.answer === opt;
                                                        const showResult = isAnswered && q.isCorrect !== undefined;
                                                        let borderColor = "border-white/[0.08]";
                                                        let bgColor = "bg-white/[0.02]";
                                                        let textColor = "text-white/80";
                                                        if (showResult) {
                                                            if (isCorrectAnswer) { borderColor = "border-green-400/30"; bgColor = "bg-green-400/[0.06]"; textColor = "text-green-300"; }
                                                            else if (isSelected) { borderColor = "border-red-400/30"; bgColor = "bg-red-400/[0.06]"; textColor = "text-red-300"; }
                                                        } else if (isSelected) { borderColor = "border-white/20"; bgColor = "bg-white/[0.06]"; textColor = "text-white"; }
                                                        return (
                                                            <motion.button key={i} onClick={() => !isAnswered && handleAnswer(q._id, opt)} disabled={isAnswered} whileTap={!isAnswered ? { scale: 0.98 } : {}}
                                                                className={`group relative w-full p-4 rounded-xl text-left text-sm font-medium transition-colors border ${borderColor} ${bgColor} ${textColor} ${!isAnswered ? 'hover:bg-white/[0.05] hover:border-white/15 cursor-pointer' : 'cursor-default'}`}>
                                                                <div className="flex items-center gap-3">
                                                                    <span className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-mono font-bold ${isSelected ? 'bg-white/15 text-white' : 'bg-white/5 text-white/30'} border border-white/[0.08]`}>{i + 1}</span>
                                                                    <span className="flex-1">{opt}</span>
                                                                    {showResult && isCorrectAnswer && <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />}
                                                                    {showResult && isSelected && !isCorrectAnswer && <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                                                                </div>
                                                                {!isAnswered && <kbd className="absolute right-4 top-1/2 -translate-y-1/2 hidden md:block px-1.5 py-0.5 bg-white/5 rounded text-[10px] font-mono text-white/20 border border-white/[0.06] opacity-0 group-hover:opacity-100 transition-opacity">{i + 1}</kbd>}
                                                            </motion.button>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-4 h-full">
                                                    {(answers[q._id] ?? q.userAnswer) ? (
                                                        <div className="space-y-4">
                                                            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                                                                <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold mb-2">Your Answer</p>
                                                                <p className="text-sm text-white/80 leading-relaxed">{answers[q._id] ?? q.userAnswer}</p>
                                                            </div>
                                                            {q.answer && <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"><p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold mb-2">Reference Answer</p><p className="text-sm text-white/80 leading-relaxed">{q.answer}</p></div>}
                                                            {q.aiFeedback && <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"><div className="flex items-center gap-2 mb-2"><BrainCircuit className="w-3 h-3 text-white/40" /><p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold">AI Feedback</p></div><p className="text-sm text-white/70 leading-relaxed">{q.aiFeedback}</p></div>}
                                                        </div>
                                                    ) : (
                                                        <div className="flex-1 flex flex-col gap-3">
                                                            <textarea id={`answer-${q._id}`} placeholder="Type your answer..." className="flex-1 w-full bg-white/[0.02] border border-white/[0.08] rounded-xl p-4 resize-none focus:outline-none focus:border-white/20 text-sm text-white placeholder:text-white/20 transition-colors min-h-[120px]"
                                                                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); const el = e.currentTarget; if (el.value.trim()) void handleAnswer(q._id, el.value); } }}
                                                            />
                                                            <button onClick={() => { const el = document.getElementById(`answer-${q._id}`) as HTMLTextAreaElement; if (el?.value.trim()) void handleAnswer(q._id, el.value); }} className="self-end px-5 py-2.5 rounded-xl bg-white/10 border border-white/[0.08] text-white text-sm font-medium hover:bg-white/15 spring-interact flex items-center gap-2">
                                                                Submit <kbd className="hidden md:inline-flex px-1.5 py-0.5 bg-white/10 rounded text-[10px] font-mono text-white/40 border border-white/[0.06]">⌘↵</kbd>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                    </div>
                                    <div className="shrink-0 px-8 py-3 border-t border-white/[0.04] flex items-center justify-between">
                                        <button aria-label="Previous question" onClick={() => { setDirection(-1); setCurrentIndex(Math.max(0, currentIndex - 1)); }} disabled={currentIndex === 0} className="flex items-center gap-2 text-white/40 hover:text-white/80 disabled:text-white/10 text-xs font-medium spring-interact disabled:pointer-events-none">
                                            <ChevronLeft className="w-3.5 h-3.5" /><span className="hidden md:inline">Prev</span><kbd className="hidden md:inline px-1 py-0.5 bg-white/5 rounded text-[9px] font-mono text-white/20 border border-white/[0.06]">←</kbd>
                                        </button>
                                        <div className="flex items-center gap-1">
                                            {questions.map((_, i) => (<button key={i} onClick={() => { setDirection(i > currentIndex ? 1 : -1); setCurrentIndex(i); }} className={`w-1.5 h-1.5 rounded-full transition-all spring-interact ${i === currentIndex ? 'bg-white/80 w-3' : i < currentIndex ? 'bg-white/25' : 'bg-white/10'}`} />))}
                                        </div>
                                        <button aria-label="Next question" onClick={() => { setDirection(1); setCurrentIndex(Math.min(questions.length - 1, currentIndex + 1)); }} disabled={currentIndex >= questions.length - 1} className="flex items-center gap-2 text-white/40 hover:text-white/80 disabled:text-white/10 text-xs font-medium spring-interact disabled:pointer-events-none">
                                            <kbd className="hidden md:inline px-1 py-0.5 bg-white/5 rounded text-[9px] font-mono text-white/20 border border-white/[0.06]">→</kbd><span className="hidden md:inline">Next</span><ChevronRight className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </motion.div>
                            </motion.div>
                        );
                    })}

                    {/* Generating placeholder */}
                    {isGeneratingNext && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.85, rotate: 2 }}
                            animate={{ opacity: 0.2, x: (arenaW / 2 - 90) + Math.min(rightCards.length, STACK_VISIBLE) * 16 - 65, y: -85, rotate: 2, scale: 1 - Math.min(rightCards.length, STACK_VISIBLE) * 0.06 }}
                            transition={SPRING_GENTLE}
                            className="absolute rounded-xl border border-white/[0.08] border-dashed bg-[#0A0A0A] flex items-center justify-center shadow-[0_2px_12px_rgba(0,0,0,0.3)]"
                            style={{ zIndex: 0, width: 130, height: 170, top: '50%', left: '50%' }}
                        >
                            <div className="flex flex-col items-center gap-2">
                                <Sparkles className="w-4 h-4 text-white/20 animate-pulse" />
                                <span className="text-[8px] text-white/20 uppercase tracking-widest">Generating</span>
                            </div>
                        </motion.div>
                    )}

                    {/* Empty state: waiting for first question */}
                    {!currentQuestion && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-8">
                            {genError ? (
                                <>
                                    <XCircle className="w-8 h-8 text-red-400/50" />
                                    <p className="text-sm text-white/50 text-center max-w-sm">{genError}</p>
                                    <button onClick={() => { setGenError(null); lastGeneratedForCount.current = -1; setRetryNonce(n => n + 1); }} className="px-5 py-2.5 rounded-xl bg-white/10 border border-white/[0.08] text-white text-sm font-medium hover:bg-white/15 spring-interact">Retry Generation</button>
                                </>
                            ) : isGeneratingNext ? null : (
                                <>
                                    <Loader2 className="w-6 h-6 animate-spin text-white/20" />
                                    <p className="text-sm text-white/50">Waiting for questions...</p>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* ─── Chat sidebar ─── */}
                <div className="shrink-0 w-80 lg:w-[340px] border-l border-white/[0.06] flex flex-col bg-[#050505] hidden md:flex">
                    {/* Chat header */}
                    <div className="shrink-0 px-5 py-4 border-b border-white/[0.06] flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/[0.08] flex items-center justify-center">
                            <MessageSquare className="w-3.5 h-3.5 text-white/40" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-xs text-white/80">AI Tutor</h3>
                            <p className="text-[10px] text-white/30 truncate">
                                {currentQuestion ? `Q${currentIndex + 1} context` : "Select a question"}
                            </p>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar min-h-0">
                        {!currentQuestionId ? (
                            <div className="h-full flex items-center justify-center">
                                <p className="text-xs text-white/20 text-center">No question selected</p>
                            </div>
                        ) : testMessages === undefined ? (
                            <div className="h-full flex items-center justify-center">
                                <Loader2 className="w-4 h-4 animate-spin text-white/20" />
                            </div>
                        ) : testMessages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center px-4">
                                <BrainCircuit className="w-6 h-6 text-white/10 mb-3" />
                                <p className="text-xs text-white/40 mb-1">Need help?</p>
                                <p className="text-[10px] text-white/20 leading-relaxed">
                                    Ask the AI tutor about this question for a deeper explanation.
                                </p>
                            </div>
                        ) : (
                            testMessages.map((msg) => (
                                <motion.div
                                    key={msg._id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={SPRING_SNAPPY}
                                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                                >
                                    <div
                                        className={`relative max-w-[88%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed group/msg ${msg.role === "user"
                                            ? "bg-white/[0.08] text-white/80 border border-white/[0.06]"
                                            : "bg-transparent text-white/70 border border-white/[0.06]"
                                            }`}
                                        onContextMenu={msg.role === "ai" ? (e) => handleMessageContextMenu(e, msg._id, msg.content) : undefined}
                                    >
                                        <p className="whitespace-pre-wrap">{renderMarkdown(msg.content)}</p>
                                        {/* "Feels hard" loading indicator on this specific message */}
                                        {feelsHardLoading === msg._id && (
                                            <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                                <div className="flex items-center gap-2">
                                                    <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                                                    <span className="text-[10px] text-amber-400 font-medium">Saving...</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))
                        )}
                        {isSendingChat && (
                            <div className="flex justify-start">
                                <div className="rounded-xl px-3.5 py-2.5 border border-white/[0.06]">
                                    <Loader2 className="w-3 h-3 animate-spin text-white/30" />
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Chat input */}
                    <div className="shrink-0 p-4 border-t border-white/[0.06]">
                        <form
                            onSubmit={e => { e.preventDefault(); void handleSendChat(); }}
                            className="relative flex items-center"
                        >
                            <input
                                ref={chatInputRef}
                                type="text"
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                placeholder="Ask about this question..."
                                disabled={!currentQuestionId || isSendingChat}
                                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-white/15 transition-colors disabled:opacity-40"
                            />
                            <button
                                type="submit"
                                disabled={!chatInput.trim() || isSendingChat}
                                className="absolute right-2 p-1.5 text-white/30 hover:text-white/70 disabled:text-white/10 transition-colors spring-interact"
                            >
                                <CornerDownLeft className="w-3.5 h-3.5" />
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            {/* ─── Custom context menu ─── */}
            <AnimatePresence>
                {contextMenu && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.92 }}
                        transition={{ duration: 0.1 }}
                        className="fixed z-[200] min-w-[180px] rounded-xl border border-white/[0.1] bg-[#1a1a1a]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => handleFeelsHard(contextMenu.messageId, contextMenu.messageContent)}
                            className="w-full flex items-center gap-2.5 px-4 py-3 text-xs text-left hover:bg-white/[0.06] transition-colors spring-interact"
                        >
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-white/80 font-medium">Feels hard</span>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ─── Toast notification ─── */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, x: "-50%" }}
                        animate={{ opacity: 1, y: 0, x: "-50%" }}
                        exit={{ opacity: 0, y: 20, x: "-50%" }}
                        transition={SPRING_SNAPPY}
                        className={`fixed bottom-6 left-1/2 z-[200] flex items-center gap-2.5 px-5 py-3 rounded-xl border backdrop-blur-xl shadow-2xl text-xs font-medium ${toast.type === "success"
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            : "bg-red-500/10 border-red-500/20 text-red-400"
                            }`}
                    >
                        {toast.type === "success" ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                            <XCircle className="w-3.5 h-3.5" />
                        )}
                        {toast.message}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
