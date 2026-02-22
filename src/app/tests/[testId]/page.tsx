/* eslint-disable */
// @ts-nocheck
"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useState, use, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowLeft, CheckCircle2, XCircle, ChevronRight, BrainCircuit, MessageSquare, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Render the interactive test-taking page that handles question progression, background question generation, review mode with stacked question cards, and a tutor chat sidebar.
 *
 * @param params - A promise resolving to route parameters; must include `testId` identifying the test to load.
 * @returns The rendered React element tree for the test page.
 */
export default function TestPage({ params }: { params: Promise<{ testId: string }> }) {
    const router = useRouter();
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

    // Review Mode State
    const [activeReviewIndex, setActiveReviewIndex] = useState(0);

    // Chat State
    const [chatInput, setChatInput] = useState("");
    const [isSendingChat, setIsSendingChat] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const activeReviewQuestionId = questions && activeReviewIndex < questions.length ? questions[activeReviewIndex]._id : undefined;
    const testMessages = useQuery(api.testMessages.getForQuestion, activeReviewQuestionId ? { questionId: activeReviewQuestionId } : "skip");

    const targetQuestionCount = test?.config?.questionCount ?? 5;
    const isCompleted = currentIndex >= targetQuestionCount;

    useEffect(() => {
        // Basic sync from db if user refreshes
        if (questions) {
            const existing: Record<string, string> = {};
            questions.forEach(q => {
                if (q.userAnswer) existing[q._id] = q.userAnswer;
            });
            setAnswers(prev => ({ ...existing, ...prev }));

            // Advance current index to first unanswered question
            const firstUnansweredIndex = questions.findIndex(q => !q.userAnswer && !answers[q._id]);
            if (firstUnansweredIndex !== -1 && currentIndex === 0) {
                setCurrentIndex(firstUnansweredIndex);
            } else if (firstUnansweredIndex === -1 && questions.length > 0 && currentIndex === 0) {
                setCurrentIndex(questions.length >= targetQuestionCount ? targetQuestionCount : questions.length);
            }
        }
    }, [questions, targetQuestionCount]);

    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [testMessages]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isCompleted && questions) {
                // If focus is in an input/textarea, don't navigate the stack
                if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;

                if (e.key === "ArrowLeft") {
                    setActiveReviewIndex(Math.max(0, activeReviewIndex - 1));
                } else if (e.key === "ArrowRight") {
                    setActiveReviewIndex(Math.min(questions.length - 1, activeReviewIndex + 1));
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isCompleted, activeReviewIndex, questions]);

    // Eagerly generate questions in the background until we hit the target count
    // Use a ref to prevent infinite re-trigger loops: only fire when questions.length actually changes
    const lastGeneratedForCount = useRef(-1);

    useEffect(() => {
        if (!questions || !test) return;
        if (questions.length >= targetQuestionCount) return;
        // Only trigger if questions.length changed since last generation
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
                        testId: tId
                    }),
                    signal: abortController.signal,
                });

                if (!res.ok) {
                    const errBody = await res.text().catch(() => "");
                    const msg = errBody || `Server error (${res.status})`;
                    setGenError(msg.includes("429") || msg.includes("quota") ? "API rate limit reached. Please wait a moment and retry." : msg);
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
                        } catch {
                            // skip malformed lines
                        }
                    }
                }
                if (hadError) {
                    // Allow retry by resetting the ref
                    lastGeneratedForCount.current = -1;
                }
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

    if (test === undefined || questions === undefined) {
        return (
            <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
                <p className="text-emerald-500 font-medium tracking-widest uppercase">Preparing your test</p>
            </div>
        );
    }

    if (test === null) {
        return (
            <div className="min-h-screen bg-neutral-950 text-neutral-50 flex items-center justify-center flex-col gap-4">
                <h1 className="text-3xl font-bold">Test not found</h1>
                <Link href="/spaces" className="text-emerald-500 hover:text-emerald-400">
                    Return to Spaces
                </Link>
            </div>
        );
    }

    const handleNext = async (questionId: string, answer: string) => {
        if (!answer.trim()) return;

        // Save answer optimistic
        setAnswers(prev => ({ ...prev, [questionId]: answer }));
        setIsEvaluating(prev => ({ ...prev, [questionId]: true }));

        // Fire Validation asynchronously (Fire and Forget)
        fetch("/api/tests/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ questionId, answer, testType: test.config.type })
        }).finally(() => {
            setIsEvaluating(prev => ({ ...prev, [questionId]: false }));
        });

        const nextIndex = currentIndex + 1;
        setCurrentIndex(nextIndex); // Optimistically move index
    };

    const handleSendChat = async () => {
        if (!chatInput.trim() || !activeReviewQuestionId) return;

        setIsSendingChat(true);
        const currentMessage = chatInput;
        setChatInput("");

        try {
            const response = await fetch("/api/tests/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    testId: tId,
                    questionId: activeReviewQuestionId,
                    message: currentMessage
                })
            });

            if (!response.ok) {
                const errText = await response.text().catch(() => "");
                throw new Error(errText || `Chat failed (${response.status})`);
            }
        } catch (e) {
            console.error("Chat failed", e);
            setChatInput(currentMessage); // restore on fail
        } finally {
            setIsSendingChat(false);
        }
    };

    return (
        <div className="min-h-screen bg-neutral-950 text-neutral-50 p-4 md:p-8 flex flex-col items-center">
            <div className="w-full max-w-2xl mt-4 flex justify-between items-center mb-12">
                <Link href={`/spaces/${test.spaceId}`} className="p-3 bg-neutral-900 border border-neutral-800 rounded-full hover:bg-neutral-800 transition-colors">
                    <ArrowLeft className="w-5 h-5 text-neutral-300" />
                </Link>
                <div className="flex gap-2">
                    {questions.map((q, idx) => (
                        <div
                            key={q._id}
                            className={`h-2 rounded-full transition-all duration-500 ${idx < currentIndex ? 'bg-emerald-500 w-8' : idx === currentIndex ? 'bg-neutral-600 w-8' : 'bg-neutral-800 w-4'}`}
                        />
                    ))}
                </div>
            </div>

            <div className={`w-full ${isCompleted ? 'max-w-6xl h-[700px]' : 'max-w-3xl h-[700px] md:h-[600px]'} relative transition-all duration-500`}>
                <AnimatePresence mode="popLayout">
                    {isCompleted ? (
                        <motion.div
                            key="review-mode"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex gap-6 h-full w-full"
                        >
                            {/* LEFT: Stack Area */}
                            <div className="flex-1 relative flex items-center justify-center">
                                {/* Stack Items */}
                                {questions.map((q, idx) => {
                                    // Stack math
                                    const diff = idx - activeReviewIndex;
                                    // if diff < 0, it's a previous question (could hide or slide left)
                                    // we only show diff >= 0 (the stack below it) or active
                                    if (diff < 0) return null;
                                    if (diff > 3) return null; // Only show top 3 behind it

                                    const isTop = diff === 0;

                                    return (
                                        <motion.div
                                            key={q._id}
                                            initial={false}
                                            animate={{
                                                scale: 1 - diff * 0.05,
                                                y: diff * -15, // Moves upwards behind
                                                opacity: 1 - diff * 0.2,
                                                zIndex: questions.length - idx,
                                            }}
                                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                            className={`absolute w-full max-w-xl mx-auto bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] flex flex-col pt-8 pb-6 px-8 ${isTop ? 'pointer-events-auto' : 'pointer-events-none blur-[1px]'}`}
                                        >
                                            {isTop && (
                                                <div className="flex justify-between items-center mb-6">
                                                    <p className="text-white/60 font-medium text-xs tracking-widest uppercase">Question {idx + 1} of {questions.length}</p>
                                                    <div className="flex items-center gap-2">
                                                        {q.isCorrect === true && <div className="flex items-center gap-1.5 text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md text-xs font-semibold"><CheckCircle2 className="w-3.5 h-3.5" /> Correct</div>}
                                                        {q.isCorrect === false && <div className="flex items-center gap-1.5 text-red-500 bg-red-500/10 px-2 py-1 rounded-md text-xs font-semibold"><XCircle className="w-3.5 h-3.5" /> Incorrect</div>}
                                                    </div>
                                                </div>
                                            )}

                                            <h2 className={`text-xl md:text-2xl font-semibold leading-relaxed mb-6 flex-1 text-white`}>{q.question}</h2>

                                            {isTop && (
                                                <div className="space-y-4">
                                                    {/* Context blocks */}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="bg-white/5 border border-white/5 rounded-xl p-4 flex flex-col gap-2">
                                                            <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Your Answer</span>
                                                            <p className="text-sm text-white/90">{answers[q._id] || q.userAnswer}</p>
                                                        </div>
                                                        <div className="bg-white/5 border border-white/5 rounded-xl p-4 flex flex-col gap-2">
                                                            <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">System Answer</span>
                                                            <p className="text-sm text-white/90">{q.answer || 'N/A'}</p>
                                                        </div>
                                                    </div>

                                                    {/* AI Feedback */}
                                                    {q.aiFeedback && (
                                                        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 flex gap-3 items-start">
                                                            <BrainCircuit className="w-4 h-4 text-emerald-500 mt-1 shrink-0" />
                                                            <div className="flex-1">
                                                                <span className="text-[10px] uppercase tracking-widest text-emerald-500/70 font-semibold block mb-1">AI Feedback</span>
                                                                <p className="text-sm text-emerald-100/90 leading-relaxed">{q.aiFeedback}</p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Navigation Controls */}
                                                    <div className="flex items-center justify-between mt-8 pt-4 border-t border-white/5">
                                                        <button
                                                            onClick={() => setActiveReviewIndex(Math.max(0, activeReviewIndex - 1))}
                                                            disabled={activeReviewIndex === 0}
                                                            className="flex items-center gap-2 text-white/60 hover:text-white disabled:opacity-30 transition-colors text-sm font-medium spring-interact"
                                                        >
                                                            <ArrowLeft className="w-4 h-4" /> Prev <kbd className="hidden md:inline-block ml-1 px-1.5 py-0.5 bg-white/10 rounded font-mono text-[10px]">←</kbd>
                                                        </button>

                                                        <div className="flex items-center justify-center gap-1">
                                                            {questions.map((_, i) => (
                                                                <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === activeReviewIndex ? 'bg-white' : 'bg-white/20'}`} />
                                                            ))}
                                                        </div>

                                                        <button
                                                            onClick={() => setActiveReviewIndex(Math.min(questions.length - 1, activeReviewIndex + 1))}
                                                            disabled={activeReviewIndex === questions.length - 1}
                                                            className="flex items-center gap-2 text-white/60 hover:text-white disabled:opacity-30 transition-colors text-sm font-medium spring-interact"
                                                        >
                                                            <kbd className="hidden md:inline-block mr-1 px-1.5 py-0.5 bg-white/10 rounded font-mono text-[10px]">→</kbd> Next <ChevronRight className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </motion.div>
                                    );
                                })}
                            </div>

                            {/* RIGHT: Chat Sidebar */}
                            <div className="w-80 lg:w-96 bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden">
                                <div className="p-4 border-b border-white/10 bg-white/5 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                        <MessageSquare className="w-4 h-4 text-emerald-500" />
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-sm text-white">Review Tutor</h3>
                                        <p className="text-[10px] text-white/60 uppercase tracking-widest">Question {activeReviewIndex + 1} Context</p>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                                    {testMessages === undefined ? (
                                        <div className="h-full flex items-center justify-center">
                                            <Loader2 className="w-5 h-5 animate-spin text-white/30" />
                                        </div>
                                    ) : testMessages.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-center px-4 opacity-50">
                                            <BrainCircuit className="w-8 h-8 text-white/50 mb-3" />
                                            <p className="text-sm text-white/80">Still confused about this answer?</p>
                                            <p className="text-xs text-white/50 mt-1">Ask the AI tutor for a deeper explanation.</p>
                                        </div>
                                    ) : (
                                        testMessages.map((msg) => (
                                            <div key={msg._id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${msg.role === 'user' ? 'bg-white/10 text-white border border-white/5' : 'bg-transparent border border-white/10 text-white/90'}`}>
                                                    <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                    {isSendingChat && (
                                        <div className="flex justify-start">
                                            <div className="max-w-[85%] rounded-2xl px-4 py-2.5 bg-transparent border border-white/10 text-white/90">
                                                <Loader2 className="w-4 h-4 animate-spin text-white/50" />
                                            </div>
                                        </div>
                                    )}
                                    <div ref={chatEndRef} />
                                </div>

                                <div className="p-4 border-t border-white/10 bg-[#0A0A0A]">
                                    <form
                                        onSubmit={e => { e.preventDefault(); handleSendChat(); }}
                                        className="relative flex items-center"
                                    >
                                        <input
                                            type="text"
                                            value={chatInput}
                                            onChange={e => setChatInput(e.target.value)}
                                            placeholder="Ask a follow up..."
                                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/20 spring-interact disabled:opacity-50"
                                            disabled={isSendingChat}
                                        />
                                        <button
                                            type="submit"
                                            disabled={!chatInput.trim() || isSendingChat}
                                            className="absolute right-2 p-1.5 text-white/60 hover:text-white disabled:opacity-30 transition-colors spring-interact"
                                        >
                                            <Send className="w-4 h-4" />
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </motion.div>
                    ) : !isCompleted && currentIndex >= questions.length ? (
                        <motion.div
                            key="generating-next"
                            initial={{ opacity: 0, y: 50, rotateX: 20 }}
                            animate={{ opacity: 1, y: 0, rotateX: 0 }}
                            exit={{ opacity: 0, x: -200, rotateZ: -10 }}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                            className="absolute inset-0 bg-neutral-900 border border-neutral-800 shadow-2xl rounded-3xl p-8 flex flex-col"
                        >
                            {genError ? (
                                <div className="flex items-center gap-3 mb-6">
                                    <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                                    <p className="text-red-500 font-semibold uppercase tracking-wider text-sm">Generation Failed</p>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 mb-6">
                                    <Loader2 className="w-5 h-5 text-emerald-500 animate-spin shrink-0" />
                                    <p className="text-emerald-500 font-semibold uppercase tracking-wider text-sm">Generating Question {(questions?.length ?? 0) + 1}</p>
                                </div>
                            )}
                            {genError ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
                                    <p className="text-white/60 text-sm max-w-sm">{genError}</p>
                                    <button
                                        onClick={() => {
                                            setGenError(null);
                                            lastGeneratedForCount.current = -1;
                                            setRetryNonce(n => n + 1);
                                        }}
                                        className="px-6 py-3 bg-white/10 border border-white/10 rounded-xl text-white text-sm font-medium hover:bg-white/20 transition-colors"
                                    >
                                        Retry Generation
                                    </button>
                                </div>
                            ) : streamingText ? (
                                <div className="flex-1 overflow-y-auto custom-scrollbar pr-4">
                                    <h2 className="text-2xl md:text-3xl font-bold leading-relaxed text-white">
                                        {(() => {
                                            try {
                                                const match = streamingText.match(/"question"\s*:\s*"((?:[^"\\]|\\.)*)/)
                                                if (match?.[1]) return match[1];
                                            } catch { /* ignore */ }
                                            return null;
                                        })()}
                                        <span className="inline-block w-0.5 h-6 bg-emerald-500 animate-pulse ml-1 align-text-bottom" />
                                    </h2>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
                                    <p className="text-white/60 text-sm">Reviewing previous answers to synthesize the next challenge...</p>
                                </div>
                            )}
                        </motion.div>
                    ) : (
                        questions.map((q, idx) => {
                            if (idx !== currentIndex) return null;

                            return (
                                <motion.div
                                    key={q._id}
                                    initial={{ opacity: 0, y: 50, rotateX: 20 }}
                                    animate={{ opacity: 1, y: 0, rotateX: 0 }}
                                    exit={{ opacity: 0, x: -200, rotateZ: -10 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                    className="absolute inset-0 bg-neutral-900 border border-neutral-800 shadow-2xl rounded-3xl p-8 flex flex-col"
                                >
                                    <p className="text-emerald-500 font-semibold mb-6 uppercase tracking-wider text-sm shrink-0">Question {idx + 1}</p>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 mb-8">
                                        <h2 className="text-2xl md:text-3xl font-bold leading-relaxed text-white">{q.question}</h2>
                                    </div>

                                    {test.config.type === "select" && q.options ? (
                                        <div className="grid gap-4">
                                            {q.options.map((opt, i) => {
                                                const isSelected = answers[q._id] === opt;
                                                return (
                                                    <button
                                                        key={i}
                                                        onClick={() => handleNext(q._id, opt)}
                                                        className={`p-5 rounded-2xl text-left font-medium text-lg transition-all border ${isSelected ? 'border-emerald-500 bg-emerald-500/10 text-white' : 'border-neutral-800 bg-neutral-950 text-neutral-300 hover:border-neutral-600'}`}
                                                    >
                                                        {opt}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <div className="mt-auto space-y-4">
                                            <textarea
                                                id={`answer-${q._id}`}
                                                placeholder="Type your answer here..."
                                                className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl p-5 min-h-[150px] resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500 text-lg"
                                            />
                                            <button
                                                onClick={() => {
                                                    const el = document.getElementById(`answer-${q._id}`) as HTMLTextAreaElement;
                                                    if (el) {
                                                        handleNext(q._id, el.value);
                                                        el.value = ''; // clear input
                                                    }
                                                }}
                                                className="w-full bg-emerald-500 text-neutral-950 font-bold text-lg py-5 rounded-2xl flex items-center justify-center gap-2 hover:bg-emerald-400 transition-colors"
                                            >
                                                Next Question <ChevronRight className="w-5 h-5" />
                                            </button>
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}