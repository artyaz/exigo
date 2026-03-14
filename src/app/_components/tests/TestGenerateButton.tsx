"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../../../../convex/_generated/api";
import { useMutation } from "convex/react";
import type { Id, Doc } from "../../../../convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import {
    BrainCircuit, TypeIcon, ChevronDown, ListChecks,
    PenLine, CheckCircle2, Shuffle, Target, X, Loader2
} from "lucide-react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";

interface TestGenerateButtonProps {
    spaceId: string;
    pieces: Doc<"knowledgePieces">[];
    fixedTopicId?: Id<"knowledgePieces">;
}

function getErrorMessage(error: unknown): string | null {
    return error instanceof Error ? error.message : null;
}

export function TestGenerateButton({ spaceId, pieces, fixedTopicId }: TestGenerateButtonProps) {
    const router = useRouter();
    const createTest = useMutation(api.tests.createEmptyTest);
    const { user } = useUser();
    const userId = user?.id;

    // Persist test type in localStorage (except when unmounting, we just read/write directly)
    const [testType, setTestType] = useState<"select" | "write">("select");
    useEffect(() => {
        const saved = localStorage.getItem("preffered-test-type");
        if (saved === "select" || saved === "write") {
            setTestType(saved);
        }
    }, []);

    const selectType = (type: "select" | "write") => {
        setTestType(type);
        localStorage.setItem("preffered-test-type", type);
    };

    const [isGenerating, setIsGenerating] = useState(false);
    const [testGenerateError, setTestGenerateError] = useState<string | null>(null);
    const [selectedTopicId, setSelectedTopicId] = useState<string | null>(fixedTopicId ?? null);

    // Dropdowns
    const [showTypeDropdown, setShowTypeDropdown] = useState(false);
    const [showTopicPicker, setShowTopicPicker] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowTypeDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleTestMe = useCallback(async () => {
        if (pieces.length === 0 || isGenerating) return;
        setIsGenerating(true);
        setTestGenerateError(null);
        setShowTypeDropdown(false);

        try {
            // Find topic
            let topic: Doc<"knowledgePieces"> | undefined;
            if (selectedTopicId) {
                topic = pieces.find(p => p._id === selectedTopicId);
            } else {
                topic = pieces[Math.floor(Math.random() * pieces.length)];
            }

            if (!topic) throw new Error("Could not determine topic.");
            if (!userId) throw new Error("User not found.");

            const testId = await createTest({
                userId,
                spaceId: spaceId as Id<"spaces">,
                topicTitle: topic.title,
                knowledgePieceId: topic._id,
                type: testType,
                questionCount: 5,
            });

            router.push(`/tests/${testId}`);
        } catch (error) {
            console.error("Failed to generate test:", error);
            const errorMessage = getErrorMessage(error);
            if (errorMessage?.includes("Upgrade your plan")) {
                setTestGenerateError(errorMessage);
            } else {
                setTestGenerateError("Failed to generate test. Please try again.");
            }
        } finally {
            setIsGenerating(false);
        }
    }, [createTest, isGenerating, pieces, router, selectedTopicId, spaceId, testType, userId]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (showTopicPicker && event.key === "Escape") {
                setShowTopicPicker(false);
            }
            if (!showTopicPicker && !showTypeDropdown && (event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                void handleTestMe();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleTestMe, showTopicPicker, showTypeDropdown]);

    const selectedTopic = selectedTopicId ? pieces.find(p => p._id === selectedTopicId) : null;

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
                <div className="relative flex" ref={dropdownRef}>
                    {/* Main generate button */}
                    <button
                        disabled={pieces.length === 0 || isGenerating}
                        onClick={() => void handleTestMe()}
                        className={`flex items-center gap-2.5 bg-white text-black font-medium pl-5 pr-4 py-2.5 spring-interact disabled:opacity-50 hover:opacity-90 text-sm ${!fixedTopicId ? 'rounded-l-xl' : 'rounded-xl'}`}
                    >
                        {isGenerating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <BrainCircuit className="w-4 h-4" />
                        )}
                        <span>Generate Test</span>
                        <TypeIcon className="w-3 h-3 opacity-50" />
                        <kbd className="hidden md:inline px-1.5 py-0.5 rounded bg-black/10 text-[10px] font-mono opacity-40">⌘↵</kbd>
                    </button>

                    {/* Divider + dropdown arrow */}
                    {!fixedTopicId && (
                        <button
                            onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                            className="flex items-center px-2.5 py-2.5 bg-white text-black rounded-r-xl border-l border-black/10 spring-interact hover:bg-neutral-100 disabled:opacity-50"
                            disabled={pieces.length === 0 || isGenerating}
                        >
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showTypeDropdown ? 'rotate-180' : ''}`} />
                        </button>
                    )}

                    {/* Dropdown */}
                    <AnimatePresence>
                        {showTypeDropdown && !fixedTopicId && (
                            <motion.div
                                initial={{ opacity: 0, y: -4, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                                transition={{ duration: 0.12 }}
                                className="absolute top-full left-0 mt-2 w-64 glass-card rounded-xl border border-white/10 shadow-2xl z-50 overflow-hidden"
                            >
                                {/* Test type options */}
                                <div className="px-3 pt-2 pb-1">
                                    <p className="text-[9px] text-white/25 uppercase tracking-widest font-semibold px-1">Question Type</p>
                                </div>
                                <button
                                    onClick={() => selectType("select")}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left spring-interact transition-colors ${testType === "select" ? "bg-white/5 text-primary" : "text-secondary hover:bg-white/5 hover:text-primary"
                                        }`}
                                >
                                    <ListChecks className="w-4 h-4 shrink-0" />
                                    <div>
                                        <p className="font-medium">Multiple Choice</p>
                                        <p className="text-[11px] text-white/30 mt-0.5">Select from 4 options</p>
                                    </div>
                                    {testType === "select" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 ml-auto" />}
                                </button>
                                <button
                                    onClick={() => selectType("write")}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left spring-interact transition-colors ${testType === "write" ? "bg-white/5 text-primary" : "text-secondary hover:bg-white/5 hover:text-primary"
                                        }`}
                                >
                                    <PenLine className="w-4 h-4 shrink-0" />
                                    <div>
                                        <p className="font-medium">Written Answer</p>
                                        <p className="text-[11px] text-white/30 mt-0.5">Full explanation required</p>
                                    </div>
                                    {testType === "write" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 ml-auto" />}
                                </button>

                                {/* Topic picker - ONLY showing when NO fixed topic is provided */}
                                <div className="border-t border-white/5 my-1" />
                                <div className="px-3 pt-1 pb-1">
                                    <p className="text-[9px] text-white/25 uppercase tracking-widest font-semibold px-1">Topic</p>
                                </div>
                                <button
                                    onClick={() => { setSelectedTopicId(null); }}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left spring-interact transition-colors ${!selectedTopicId ? "bg-white/5 text-primary" : "text-secondary hover:bg-white/5 hover:text-primary"}`}
                                >
                                    <Shuffle className="w-4 h-4 shrink-0" />
                                    <div>
                                        <p className="font-medium">Random Topic</p>
                                        <p className="text-[11px] text-white/30 mt-0.5">Pick a random knowledge piece</p>
                                    </div>
                                    {!selectedTopicId && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 ml-auto" />}
                                </button>
                                <button
                                    onClick={() => { setShowTopicPicker(true); setShowTypeDropdown(false); }}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left spring-interact transition-colors ${selectedTopicId ? "bg-white/5 text-primary" : "text-secondary hover:bg-white/5 hover:text-primary"}`}
                                >
                                    <Target className="w-4 h-4 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium">Pick Topic</p>
                                        {selectedTopic ? (
                                            <p className="text-[11px] text-white/50 mt-0.5 truncate">{selectedTopic.title ?? selectedTopic.content.slice(0, 40) + "..."}</p>
                                        ) : (
                                            <p className="text-[11px] text-white/30 mt-0.5">Choose a specific knowledge piece</p>
                                        )}
                                    </div>
                                    {selectedTopicId && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 ml-auto shrink-0" />}
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Selected topic indicator */}
                {selectedTopic && !fixedTopicId && (
                    <motion.div
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2 text-xs text-white/40"
                    >
                        <Target className="w-3 h-3" />
                        <span className="truncate max-w-[200px]">{selectedTopic.title ?? selectedTopic.content.slice(0, 30) + "..."}</span>
                        <button onClick={() => setSelectedTopicId(null)} className="p-0.5 rounded hover:bg-white/10 spring-interact">
                            <X className="w-3 h-3" />
                        </button>
                    </motion.div>
                )}

                {pieces.length === 0 && (
                    <p className="text-xs text-red-500/80">Add knowledge first</p>
                )}
            </div>

            {testGenerateError && (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white max-w-sm">
                    <p className="text-white/90">{testGenerateError}</p>
                    <Link href="/pricing" className="mt-1 inline-flex text-xs font-medium text-white/60 hover:text-white/90 transition-colors">
                        Open plans
                    </Link>
                </div>
            )}

            {/* ─── Topic Picker Modal ─── */}
            <AnimatePresence>
                {showTopicPicker && !fixedTopicId && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                        onClick={() => setShowTopicPicker(false)}
                    >
                        {/* Backdrop */}
                        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

                        {/* Modal */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 8 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative w-full max-w-lg max-h-[70vh] glass-card rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden"
                        >
                            {/* Modal header */}
                            <div className="shrink-0 px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Target className="w-4 h-4 text-white/40" />
                                    <h3 className="text-sm font-semibold text-primary tracking-tight">Pick Topic</h3>
                                    <span className="text-[10px] font-mono text-tertiary bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-md">{pieces.length}</span>
                                </div>
                                <button
                                    onClick={() => setShowTopicPicker(false)}
                                    className="p-1.5 rounded-lg hover:bg-white/10 spring-interact text-white/40 hover:text-white"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Topic list */}
                            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                                <div className="grid gap-2">
                                    {pieces.map((piece) => {
                                        const isSelected = selectedTopicId === String(piece._id);
                                        return (
                                            <motion.button
                                                key={piece._id}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={() => {
                                                    setSelectedTopicId(String(piece._id));
                                                    setShowTopicPicker(false);
                                                }}
                                                className={`group w-full text-left p-4 rounded-xl border transition-colors spring-interact ${isSelected
                                                    ? 'border-white/20 bg-white/[0.06]'
                                                    : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10'
                                                    }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        {piece.title && (
                                                            <p className="text-xs font-semibold text-white/70 uppercase tracking-widest mb-1">{piece.title}</p>
                                                        )}
                                                        <p className="text-sm text-white/50 line-clamp-2 leading-relaxed">{piece.content}</p>
                                                        {piece.source && (
                                                            <p className="text-[10px] text-white/20 font-mono mt-1.5 truncate">{piece.source}</p>
                                                        )}
                                                    </div>
                                                    {isSelected && (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                                    )}
                                                </div>
                                            </motion.button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Modal footer */}
                            <div className="shrink-0 px-6 py-3 border-t border-white/[0.06] flex items-center justify-between">
                                <button
                                    onClick={() => { setSelectedTopicId(null); setShowTopicPicker(false); }}
                                    className="text-xs text-white/30 hover:text-white/60 spring-interact"
                                >
                                    Clear selection
                                </button>
                                <div className="flex items-center gap-2 text-white/20">
                                    <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono">Esc</kbd>
                                    <span className="text-[10px]">Close</span>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
