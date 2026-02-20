"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useState, use, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowLeft, CheckCircle2, XCircle, ChevronRight, BrainCircuit } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function TestPage({ params }: { params: Promise<{ testId: string }> }) {
    const router = useRouter();
    const { testId } = use(params);
    const tId = testId as Id<"tests">;

    const test = useQuery(api.tests.get, { testId: tId });
    const questions = useQuery(api.questions.getForTest, { testId: tId });

    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [isEvaluating, setIsEvaluating] = useState<Record<string, boolean>>({});

    useEffect(() => {
        // Basic sync from db if user refreshes
        if (questions) {
            const existing: Record<string, string> = {};
            questions.forEach(q => {
                if (q.answer) existing[q._id] = q.answer;
            });
            setAnswers(prev => ({ ...existing, ...prev }));

            // Advance current index to first unanswered question
            const firstUnansweredIndex = questions.findIndex(q => !q.answer && !answers[q._id]);
            if (firstUnansweredIndex !== -1 && currentIndex === 0) {
                setCurrentIndex(firstUnansweredIndex);
            } else if (firstUnansweredIndex === -1 && questions.length > 0 && currentIndex === 0) {
                setCurrentIndex(questions.length); // means completed
            }
        }
    }, [questions]);

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

        // Move to next immediately (Progressive)
        setCurrentIndex(prev => prev + 1);

        // Trigger validation
        try {
            await fetch("/api/tests/validate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ questionId, answer, testType: test.config.type })
            });
        } catch (e) {
            console.error("Validation failed", e);
        } finally {
            setIsEvaluating(prev => ({ ...prev, [questionId]: false }));
        }
    };

    const isCompleted = currentIndex >= questions.length;

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

            <div className="w-full max-w-lg relative min-h-[500px]">
                <AnimatePresence mode="popLayout">
                    {isCompleted ? (
                        <motion.div
                            key="completed"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 flex flex-col items-center text-center gap-6"
                        >
                            <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                            </div>
                            <h2 className="text-3xl font-bold">Test Finished!</h2>
                            <p className="text-neutral-400">Great job. Your answers have been recorded and AI feedback is ready.</p>

                            <div className="w-full space-y-4 text-left mt-6 h-64 overflow-y-auto pr-2 custom-scrollbar">
                                {questions.map((q, i) => (
                                    <div key={q._id} className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
                                        <p className="font-medium text-sm text-neutral-400 mb-2">Q{i + 1}: {q.question}</p>
                                        <div className="flex justify-between items-start gap-4">
                                            <p className="text-white font-medium">{answers[q._id] || q.answer}</p>
                                            {q.isCorrect === true && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />}
                                            {q.isCorrect === false && <XCircle className="w-5 h-5 text-red-500 shrink-0" />}
                                        </div>
                                        {q.aiFeedback && (
                                            <div className="mt-3 bg-neutral-900 border border-neutral-800 p-3 rounded-lg flex gap-3 items-start">
                                                <BrainCircuit className="w-4 h-4 text-emerald-500 mt-1 shrink-0" />
                                                <p className="text-xs text-neutral-400">{q.aiFeedback}</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <Link href={`/spaces/${test.spaceId}`} className="w-full bg-emerald-500 text-neutral-950 font-bold py-4 rounded-xl mt-4 hover:bg-emerald-400 transition-colors">
                                Back to Space
                            </Link>
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
                                    <p className="text-emerald-500 font-semibold mb-6 uppercase tracking-wider text-sm">Question {idx + 1}</p>
                                    <h2 className="text-2xl md:text-3xl font-bold leading-relaxed mb-12 flex-1">{q.question}</h2>

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
                                                    if (el) handleNext(q._id, el.value);
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
