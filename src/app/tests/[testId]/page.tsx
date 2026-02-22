/* eslint-disable */
// @ts-nocheck
"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useState, use, useEffect, useRef, useCallback } from "react";
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
    Send,
    Sparkles,
    CornerDownLeft,
} from "lucide-react";
import Link from "next/link";

/* ─── spring presets ─── */
const SPRING_SNAPPY = { type: "spring" as const, stiffness: 500, damping: 30 };
const SPRING_GENTLE = { type: "spring" as const, stiffness: 300, damping: 28 };

/* ─── card stack config ─── */
const STACK_VISIBLE = 3;

/** Deterministic hash for pseudo-random card offsets */
function cardHash(id: string, seed: number) {
    let h = seed;
    for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
    return h;
}

export default function TestPage({ params }: { params: Promise<{ testId: string }> }) {
    const { testId } = use(params);
    const tId = testId as Id<"tests">;

    const test = useQuery(api.tests.get, { testId: tId });
    const questions = useQuery(api.questions.getForTest, { testId: tId });

    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [isEvaluating, setIsEvaluating] = useState<Record<string, boolean>>({});
    const [isGeneratingNext, setIsGeneratingNext] = useState(false);
    const [streamingText, setStreamingText] = useState("");
    const [genError, setGenError] = useState<string | null>(null);
    const [retryNonce, setRetryNonce] = useState(0);
    const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward
    const [prevQuestionsLength, setPrevQuestionsLength] = useState(0);

    // Chat State
    const [chatInput, setChatInput] = useState("");
    const [isSendingChat, setIsSendingChat] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const chatInputRef = useRef<HTMLInputElement>(null);

    // Arena dimensions for card positioning
    const arenaRef = useRef<HTMLDivElement>(null);
    const [arenaW, setArenaW] = useState(800);
    const [arenaH, setArenaH] = useState(600);

    const targetQuestionCount = test?.config?.questionCount ?? 5;
    const isCompleted = questions && questions.length >= targetQuestionCount &&
        questions.every(q => q.userAnswer || answers[q._id]);
    const currentQuestion = questions?.[currentIndex];

    // Chat for current question
    const currentQuestionId = currentQuestion?._id;
    const testMessages = useQuery(
        api.testMessages.getForQuestion,
        currentQuestionId ? { questionId: currentQuestionId } : "skip"
    );

    // Detect new question appearing (for animation)
    useEffect(() => {
        if (questions && questions.length > prevQuestionsLength) {
            setPrevQuestionsLength(questions.length);
        }
    }, [questions?.length]);

    // Track arena size
    useEffect(() => {
        if (!arenaRef.current) return;
        const ro = new ResizeObserver(entries => {
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
            if (firstUnanswered !== -1 && currentIndex === 0 && !answers[questions[0]?._id]) {
                setCurrentIndex(firstUnanswered);
            }
        }
    }, [questions, targetQuestionCount]);

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

        (async () => {
            try {
                const res = await fetch("/api/tests/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        spaceId: test.spaceId,
                        testType: test.config.type,
                        testId: tId,
                    }),
                    signal: abortController.signal,
                });

                if (!res.ok) {
                    const errBody = await res.text().catch(() => "");
                    const msg = errBody || `Server error (${res.status})`;
                    setGenError(msg.includes("429") || msg.includes("quota")
                        ? "API rate limit reached. Please wait a moment and retry."
                        : msg);
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
                    buffer = lines.pop() || "";

                    for (const line of lines) {
                        if (!line.startsWith("data: ")) continue;
                        try {
                            const payload = JSON.parse(line.slice(6));
                            if (payload.type === "delta") {
                                setStreamingText(prev => prev + payload.text);
                            } else if (payload.type === "error") {
                                hadError = true;
                                const msg = (payload.error as string) || "Generation failed";
                                if (msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED")) {
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
                const num = parseInt(e.key);
                if (num >= 1 && num <= 4 && currentQuestion.options[num - 1]) {
                    e.preventDefault();
                    handleAnswer(currentQuestion._id, currentQuestion.options[num - 1]);
                }
            }

            // Escape to go back
            if (e.key === "Escape") {
                window.history.back();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [questions, currentIndex, currentQuestion, answers, test]);

    const handleAnswer = async (questionId: string, answer: string) => {
        if (!answer.trim()) return;
        setAnswers(prev => ({ ...prev, [questionId]: answer }));
        setIsEvaluating(prev => ({ ...prev, [questionId]: true }));

        fetch("/api/tests/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ questionId, answer, testType: test?.config.type }),
        }).finally(() => {
            setIsEvaluating(prev => ({ ...prev, [questionId]: false }));
        });

        // Auto-advance after brief delay
        setTimeout(() => {
            if (questions && currentIndex < questions.length - 1) {
                setDirection(1);
                setCurrentIndex(prev => prev + 1);
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
            if (!response.ok) throw new Error("Chat failed");
        } catch (e) {
            console.error("Chat failed", e);
            setChatInput(msg);
        } finally {
            setIsSendingChat(false);
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

    const answeredCount = questions.filter(q => q.userAnswer || answers[q._id]).length;
    const progress = targetQuestionCount > 0 ? Math.min(100, (answeredCount / targetQuestionCount) * 100) : 0;

    // Build left stack (answered/past) and right stack (upcoming)
    const leftCards = questions.filter((_, i) => i < currentIndex);
    const rightCards = questions.filter((_, i) => i > currentIndex);

    return (
        <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
            {/* ─── Header ─── */}
            <header className="shrink-0 px-6 py-4 flex items-center justify-between border-b border-white/[0.06]">
                <div className="flex items-center gap-4">
                    <Link
                        href={`/spaces/${test.spaceId}`}
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
                        {Array.from({ length: targetQuestionCount }).map((_, i) => (
                            <motion.div
                                key={i}
                                className="h-1 rounded-full"
                                animate={{
                                    width: i === currentIndex ? 20 : 8,
                                    backgroundColor:
                                        i < questions.length && (questions[i]?.userAnswer || answers[questions[i]?._id])
                                            ? questions[i]?.isCorrect === true
                                                ? "rgba(74, 222, 128, 0.7)"
                                                : questions[i]?.isCorrect === false
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
                        ))}
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
                                    <div className="shrink-0 px-8 pt-7 pb-5 border-b border-white/[0.04]">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-semibold">
                                                Question {idx + 1}
                                            </span>
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

                                    <div className="flex-1 px-8 py-6 overflow-y-auto custom-scrollbar">
                                        {test.config.type === "select" && q.options ? (
                                            <div className="grid gap-3">
                                                {q.options.map((opt, i) => {
                                                    const selectedAnswer = answers[q._id] || q.userAnswer;
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
                                                {(answers[q._id] || q.userAnswer) ? (
                                                    <div className="space-y-4">
                                                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                                                            <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold mb-2">Your Answer</p>
                                                            <p className="text-sm text-white/80 leading-relaxed">{answers[q._id] || q.userAnswer}</p>
                                                        </div>
                                                        {q.answer && <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"><p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold mb-2">Reference Answer</p><p className="text-sm text-white/80 leading-relaxed">{q.answer}</p></div>}
                                                        {q.aiFeedback && <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"><div className="flex items-center gap-2 mb-2"><BrainCircuit className="w-3 h-3 text-white/40" /><p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold">AI Feedback</p></div><p className="text-sm text-white/70 leading-relaxed">{q.aiFeedback}</p></div>}
                                                    </div>
                                                ) : (
                                                    <div className="flex-1 flex flex-col gap-3">
                                                        <textarea id={`answer-${q._id}`} placeholder="Type your answer..." className="flex-1 w-full bg-white/[0.02] border border-white/[0.08] rounded-xl p-4 resize-none focus:outline-none focus:border-white/20 text-sm text-white placeholder:text-white/20 transition-colors min-h-[120px]" />
                                                        <button onClick={() => { const el = document.getElementById(`answer-${q._id}`) as HTMLTextAreaElement; if (el?.value.trim()) handleAnswer(q._id, el.value); }} className="self-end px-5 py-2.5 rounded-xl bg-white/10 border border-white/[0.08] text-white text-sm font-medium hover:bg-white/15 spring-interact flex items-center gap-2">
                                                            Submit <kbd className="hidden md:inline-flex px-1.5 py-0.5 bg-white/10 rounded text-[10px] font-mono text-white/40 border border-white/[0.06]">⌘↵</kbd>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="shrink-0 px-8 py-3 border-t border-white/[0.04] flex items-center justify-between">
                                        <button onClick={() => { setDirection(-1); setCurrentIndex(Math.max(0, currentIndex - 1)); }} disabled={currentIndex === 0} className="flex items-center gap-2 text-white/40 hover:text-white/80 disabled:text-white/10 text-xs font-medium spring-interact disabled:pointer-events-none">
                                            <ChevronLeft className="w-3.5 h-3.5" /><span className="hidden md:inline">Prev</span><kbd className="hidden md:inline px-1 py-0.5 bg-white/5 rounded text-[9px] font-mono text-white/20 border border-white/[0.06]">←</kbd>
                                        </button>
                                        <div className="flex items-center gap-1">
                                            {questions.map((_, i) => (<button key={i} onClick={() => { setDirection(i > currentIndex ? 1 : -1); setCurrentIndex(i); }} className={`w-1.5 h-1.5 rounded-full transition-all spring-interact ${i === currentIndex ? 'bg-white/80 w-3' : i < currentIndex ? 'bg-white/25' : 'bg-white/10'}`} />))}
                                        </div>
                                        <button onClick={() => { setDirection(1); setCurrentIndex(Math.min(questions.length - 1, currentIndex + 1)); }} disabled={currentIndex >= questions.length - 1} className="flex items-center gap-2 text-white/40 hover:text-white/80 disabled:text-white/10 text-xs font-medium spring-interact disabled:pointer-events-none">
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
                                    <div className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${msg.role === "user"
                                        ? "bg-white/[0.08] text-white/80 border border-white/[0.06]"
                                        : "bg-transparent text-white/70 border border-white/[0.06]"
                                        }`}>
                                        <p className="whitespace-pre-wrap">{msg.content}</p>
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
                            onSubmit={e => { e.preventDefault(); handleSendChat(); }}
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
        </div>
    );
}