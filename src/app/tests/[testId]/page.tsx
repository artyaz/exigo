
"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
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
    Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useTestQuestionGeneration } from "../../_components/tests/useTestQuestionGeneration";
import {
    useTestAnswerValidation,
    type ToastPayload,
} from "../../_components/tests/useTestAnswerValidation";
import { TestChatSidebar } from "../../_components/tests/TestChatSidebar";

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

export default function TestPage({ params }: { params: Promise<{ testId: string }> }) {
    const { testId } = use(params);
    const tId = testId as Id<"tests">;
    const { userId } = useAuth();

    const test = useQuery(api.tests.get, userId ? { testId: tId } : "skip");
    const questions = useQuery(api.questions.getForTest, userId ? { testId: tId } : "skip");

    const [currentIndex, setCurrentIndex] = useState(0);
    const [toast, setToast] = useState<ToastPayload | null>(null);

    // Arena dimensions for card positioning
    const arenaRef = useRef<HTMLDivElement>(null);
    const [arenaW, setArenaW] = useState(800);
    const [arenaH, setArenaH] = useState(600);

    const targetQuestionCount = test?.config?.questionCount ?? 5;
    const currentQuestion = questions?.[currentIndex];
    const currentQuestionId = currentQuestion?._id;

    const { isGeneratingNext, genError, retry } = useTestQuestionGeneration({
        questionsLength: questions?.length,
        test,
        testId: tId,
        targetQuestionCount,
    });

    const showToast = useCallback((payload: ToastPayload) => {
        setToast(payload);
    }, []);

    const { answers, isEvaluating, handleAnswer } = useTestAnswerValidation({
        questions,
        test,
        testId: tId,
        currentIndex,
        setCurrentIndex,
        targetQuestionCount,
        onToast: showToast,
    });

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

    // Auto-dismiss toast
    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 3500);
        return () => clearTimeout(timer);
    }, [toast]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const tag = document.activeElement?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA") return;

            if (!questions || !currentQuestion) return;

            if (e.key === "ArrowLeft" && currentIndex > 0) {
                e.preventDefault();
                setCurrentIndex(currentIndex - 1);
            } else if (e.key === "ArrowRight" && currentIndex < questions.length - 1) {
                e.preventDefault();
                setCurrentIndex(currentIndex + 1);
            }

            if (test?.config.type === "select" && currentQuestion.options && !answers[currentQuestion._id] && !currentQuestion.userAnswer) {
                const num = Number.parseInt(e.key);
                const opt = currentQuestion.options[num - 1];
                if (num >= 1 && num <= 4 && opt) {
                    e.preventDefault();
                    void handleAnswer(currentQuestion._id, opt);
                }
            }

            if (e.key === "Escape") {
                globalThis.history.back();
            }
        };
        globalThis.addEventListener("keydown", handleKeyDown);
        return () => globalThis.removeEventListener("keydown", handleKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [questions, currentIndex, currentQuestion, answers, test, handleAnswer]);

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
                                onClick={!isActive ? () => setCurrentIndex(idx) : undefined}
                            >
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
                                        <button aria-label="Previous question" onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))} disabled={currentIndex === 0} className="flex items-center gap-2 text-white/40 hover:text-white/80 disabled:text-white/10 text-xs font-medium spring-interact disabled:pointer-events-none">
                                            <ChevronLeft className="w-3.5 h-3.5" /><span className="hidden md:inline">Prev</span><kbd className="hidden md:inline px-1 py-0.5 bg-white/5 rounded text-[9px] font-mono text-white/20 border border-white/[0.06]">←</kbd>
                                        </button>
                                        <div className="flex items-center gap-1">
                                            {questions.map((_, i) => (<button key={i} onClick={() => setCurrentIndex(i)} className={`w-1.5 h-1.5 rounded-full transition-all spring-interact ${i === currentIndex ? 'bg-white/80 w-3' : i < currentIndex ? 'bg-white/25' : 'bg-white/10'}`} />))}
                                        </div>
                                        <button aria-label="Next question" onClick={() => setCurrentIndex(Math.min(questions.length - 1, currentIndex + 1))} disabled={currentIndex >= questions.length - 1} className="flex items-center gap-2 text-white/40 hover:text-white/80 disabled:text-white/10 text-xs font-medium spring-interact disabled:pointer-events-none">
                                            <kbd className="hidden md:inline px-1 py-0.5 bg-white/5 rounded text-[9px] font-mono text-white/20 border border-white/[0.06]">→</kbd><span className="hidden md:inline">Next</span><ChevronRight className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </motion.div>
                            </motion.div>
                        );
                    })}

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

                    {!currentQuestion && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-8">
                            {genError ? (
                                <>
                                    <XCircle className="w-8 h-8 text-red-400/50" />
                                    <p className="text-sm text-white/50 text-center max-w-sm">{genError}</p>
                                    <button onClick={retry} className="px-5 py-2.5 rounded-xl bg-white/10 border border-white/[0.08] text-white text-sm font-medium hover:bg-white/15 spring-interact">Retry Generation</button>
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

                <TestChatSidebar
                    testId={tId}
                    currentQuestionId={currentQuestionId}
                    currentIndex={currentIndex}
                    knowledgePieceId={test.knowledgePieceId}
                    userId={userId}
                    onToast={showToast}
                />
            </div>

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
