"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useState, use, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft, Plus, Upload, BrainCircuit, Loader2, BookOpen,
    CheckCircle2, Clock, Zap, ChevronRight, ChevronDown, FileText, ListChecks, PenLine,
    X, Shuffle, Target, ArrowDown, ArrowUp, TrendingUp, AlertTriangle
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { addKnowledgePieceAction, bulkImportKnowledgeAction } from "../../actions/knowledge";
import { LearnTab } from "../../_components/learn/LearnTab";
import { createTestServerAction } from "../../actions/spaces";
import { RESOLUTION_THRESHOLD } from "../../../../shared/planConfig";
import {
    appearsToBeCsvWithWrongHeaders,
    parseCsvKnowledgePieces,
    parseDelimiterKnowledgePieces,
    type BulkImportPiece,
} from "~/lib/bulkImportParser";

const MAX_BULK_UPLOAD_BYTES = 9 * 1024 * 1024;

function hashCode(str: string) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + (str.codePointAt(i) ?? 0);
        hash = Math.trunc(hash);
    }
    return hash;
}

function getUserFacingErrorMessage(error: unknown) {
    const fallback = "Something went wrong. Please try again.";
    const message = error instanceof Error ? error.message : fallback;

    if (message.includes("don't have access to test generation") || message.includes("create 0 tests")) {
        return "Test generation is locked on your current plan. Upgrade to continue.";
    }

    return message;
}

function useSpaceData(spaceId: Id<"spaces">, userId: string | null | undefined) {
    const space = useQuery(api.spaces.get, userId ? { spaceId, userId } : "skip");
    const pieces = useQuery(api.knowledgePieces.getForSpace, userId ? { spaceId } : "skip");
    const spaceTests = useQuery(api.tests.getForSpace, userId ? { spaceId } : "skip");
    const spaceQuestions = useQuery(api.questions.getForSpace, userId ? { spaceId } : "skip");
    return { space, pieces, spaceTests, spaceQuestions };
}

function getNodeTypeInfo(nodeType: "feels_hard" | "struggle" | "improvement") {
    switch (nodeType) {
        case "feels_hard":
            return { label: "Feels Hard", icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" };
        case "struggle":
            return { label: "Struggle Area", icon: Target, color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" };
        default:
            return { label: "Improvement", icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" };
    }
}


export default function SpaceDetailPage({ params }: { params: Promise<{ spaceId: string }> }) {
    const router = useRouter();
    const { userId } = useAuth();
    const { spaceId } = use(params);
    const sId = spaceId as Id<"spaces">;

    const { space, pieces, spaceTests, spaceQuestions } = useSpaceData(sId, userId);


    const updateTitle = useMutation(api.knowledgePieces.updateTitle);


    // Main tabs
    const [mainTab, setMainTab] = useState<"tests" | "knowledge" | "learn">("tests");

    // Knowledge sub-mode
    const [knowledgeMode, setKnowledgeMode] = useState<"add" | "bulk">("add");
    const [content, setContent] = useState("");
    const [title, setTitle] = useState("");
    const [source, setSource] = useState("");
    const [bulkFileName, setBulkFileName] = useState("");
    const [bulkFileContent, setBulkFileContent] = useState("");
    const [delimiter, setDelimiter] = useState(String.raw`\n\n`);
    const [isAdding, setIsAdding] = useState(false);

    // Test generation
    const [testType, setTestType] = useState<"select" | "write">(() => {
        if (typeof globalThis.window !== "undefined") {
            const stored = localStorage.getItem("exigo_test_type");
            if (stored === "select" || stored === "write") return stored;
        }
        return "select";
    });
    const [isGenerating, setIsGenerating] = useState(false);
    const [showTypeDropdown, setShowTypeDropdown] = useState(false);
    const [showTopicPicker, setShowTopicPicker] = useState(false);
    const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
    const [testGenerateError, setTestGenerateError] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const bulkFileInputRef = useRef<HTMLInputElement>(null);

    // Test card hover
    const [hoveredTestId, setHoveredTestId] = useState<string | null>(null);
    const [testMousePos, setTestMousePos] = useState({ x: 0, y: 0 });

    // Knowledge Viewer
    const [viewingPieceId, setViewingPieceId] = useState<string | null>(null);
    const activeNodes = useQuery(api.knowledgeNodes.getActiveForPiece, (userId && viewingPieceId) ? { knowledgePieceId: viewingPieceId as Id<"knowledgePieces"> } : "skip");

    // Sort & filter
    const [sortBy, setSortBy] = useState<"date" | "status" | "questions" | "performance">("date");
    const [sortDesc, setSortDesc] = useState(true);
    const [filterStatus, setFilterStatus] = useState<"all" | "done" | "in_progress" | "new">("all");
    const [filterTopic, setFilterTopic] = useState<string>("all");

    // Persist test type
    useEffect(() => {
        localStorage.setItem("exigo_test_type", testType);
    }, [testType]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowTypeDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    if (space === undefined || pieces === undefined) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
        );
    }

    if (space === null) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center flex-col gap-4">
                <h1 className="text-2xl font-medium tracking-tight">Space not found</h1>
                <Link href="/spaces" className="text-secondary hover:text-primary text-sm transition-colors">
                    Return to Spaces
                </Link>
            </div>
        );
    }

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim()) return;
        setIsAdding(true);

        try {
            const pieceId = await addKnowledgePieceAction(sId, content, title.trim() || undefined, source.trim() || undefined);

            // Auto-generate title if not provided
            if (!title.trim()) {
                fetch("/api/knowledge/title", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ content: content.slice(0, 2000) }),
                })
                    .then(res => res.json() as Promise<{ title?: string }>)
                    .then(data => {
                        if (!userId) {
                            return;
                        }
                        if (data.title && data.title !== "Untitled") {
                            void updateTitle({ id: pieceId as Id<"knowledgePieces">, title: data.title });
                        }

                    })
                    .catch(() => { /* silent */ });
            }

            setContent("");
            setTitle("");
            setSource("");
        } catch (err) {
            console.error("Failed to add piece", err);
            // We should use a toast here if available, or alert
            alert((err as Error).message);
        } finally {
            setIsAdding(false);
        }
    };

    const handleBulkFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) {
            setBulkFileName("");
            setBulkFileContent("");
            return;
        }

        if (file.size > MAX_BULK_UPLOAD_BYTES) {
            setBulkFileName("");
            setBulkFileContent("");
            if (bulkFileInputRef.current) {
                bulkFileInputRef.current.value = "";
            }
            alert("File is too large. Maximum supported upload size is 9 MB.");
            return;
        }

        try {
            const text = await file.text();
            setBulkFileName(file.name);
            setBulkFileContent(text);
        } catch (error) {
            console.error("Failed to read bulk import file", error);
            setBulkFileName("");
            setBulkFileContent("");
            if (bulkFileInputRef.current) {
                bulkFileInputRef.current.value = "";
            }
            alert("Could not read selected file. Please try another file.");
        }
    };

    const handleBulkImport = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!bulkFileContent.trim()) return;
        setIsAdding(true);
        try {
            const resolvedSource = source.trim() || undefined;
            const csvPieces = parseCsvKnowledgePieces(bulkFileContent, resolvedSource);
            if (!csvPieces && appearsToBeCsvWithWrongHeaders(bulkFileContent)) {
                throw new Error('CSV format is invalid. Expected headers: Content,Name');
            }

            const structuredPieces: BulkImportPiece[] = csvPieces ?? parseDelimiterKnowledgePieces(bulkFileContent, delimiter, resolvedSource);
            if (structuredPieces.length === 0) {
                throw new Error("No importable knowledge pieces found.");
            }

            const ids = await bulkImportKnowledgeAction(sId, structuredPieces);

            // Auto-generate titles only for entries that did not provide a title.
            structuredPieces.forEach((piece, i) => {
                if (ids[i] && !piece.title?.trim()) {
                    void fetch("/api/knowledge/title", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ content: piece.content.slice(0, 2000) }),
                    })
                        .then(res => res.json() as Promise<{ title?: string }>)
                        .then(data => {
                            if (!userId) {
                                return;
                            }
                            if (data?.title && data.title !== "Untitled") {
                                void updateTitle({ id: ids[i] as Id<"knowledgePieces">, title: String(data.title) });
                            }

                        })
                        .catch(() => { /* silent */ });
                }
            });

            setBulkFileName("");
            setBulkFileContent("");
            if (bulkFileInputRef.current) {
                bulkFileInputRef.current.value = "";
            }
        } catch (err) {
            console.error("Bulk import failed", err);
            alert((err as Error).message);
        } finally {
            setIsAdding(false);
        }
    };

    const handleTestMe = async () => {
        if (pieces.length === 0) return;
        setTestGenerateError(null);
        setIsGenerating(true);
        try {
            const selectedTopicInPieces = pieces.find(p => String(p._id) === selectedTopicId);
            const resolvedTopic = selectedTopicInPieces ?? pieces[Math.floor(Math.random() * pieces.length)];
            if (!resolvedTopic) {
                throw new Error("No topic available for test generation.");
            }
            const resolvedTopicId = String(resolvedTopic._id);
            const topicLabel = resolvedTopic.title ?? resolvedTopic.content.slice(0, 40);

            const result = await createTestServerAction({
                spaceId: sId,
                type: testType,
                questionCount: 5,
                topicTitle: topicLabel,
                knowledgePieceId: resolvedTopicId,
            });
            if (!result.ok) {
                const errorMessage =
                    result.code === "UNAUTHORIZED" ? "Please sign in to generate tests." :
                    result.code === "PLAN_LIMIT" ? result.error :
                    "Failed to create test. Please try again.";
                setTestGenerateError(errorMessage);
                setIsGenerating(false);
                return;
            }
            const testId = result.data;

            // Store selected topic for test page to use
            sessionStorage.setItem(`exigo_test_topic_${testId}`, resolvedTopicId);
            router.push(`/tests/${testId}`);
        } catch (error) {
            console.error("Failed to create test", error);
            setTestGenerateError(getUserFacingErrorMessage(error));
            setIsGenerating(false);
        }
    };

    const selectType = (type: "select" | "write") => {
        setTestType(type);
        setShowTypeDropdown(false);
    };

    const selectedTopic = selectedTopicId ? pieces.find(p => String(p._id) === selectedTopicId) : null;
    const TypeIcon = testType === "select" ? ListChecks : PenLine;

    return (
        <div className="min-h-screen bg-black text-white p-4 md:p-8">
            <div className="max-w-5xl mx-auto flex flex-col gap-6">

                {/* Header */}
                <header className="flex items-center gap-4">
                    <Link href="/spaces" className="p-2 glass-card rounded-xl hover:bg-white/5 spring-interact text-secondary hover:text-primary">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-primary">{space.name}</h1>
                </header>

                {/* Tab bar */}
                <div className="flex items-center gap-1 border-b border-white/10">
                    <button
                        onClick={() => setMainTab("tests")}
                        className={`px-4 py-2.5 font-medium text-sm transition-colors border-b-2 -mb-px flex items-center gap-2 ${mainTab === "tests"
                            ? "border-white text-primary"
                            : "border-transparent text-secondary hover:text-primary"
                            }`}
                    >
                        <FileText className="w-3.5 h-3.5" />
                        Tests
                        {spaceTests && spaceTests.length > 0 && (
                            <span className="text-[10px] font-mono text-tertiary bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-md">{spaceTests.length}</span>
                        )}
                    </button>
                    <button
                        onClick={() => setMainTab("knowledge")}
                        className={`px-4 py-2.5 font-medium text-sm transition-colors border-b-2 -mb-px flex items-center gap-2 ${mainTab === "knowledge"
                            ? "border-white text-primary"
                            : "border-transparent text-secondary hover:text-primary"
                            }`}
                    >
                        <BookOpen className="w-3.5 h-3.5" />
                        Knowledge
                        {pieces && pieces.length > 0 && (
                            <span className="text-[10px] font-mono text-tertiary bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-md">{pieces.length}</span>
                        )}
                    </button>
                    <button
                        onClick={() => setMainTab("learn")}
                        className={`px-4 py-2.5 font-medium text-sm transition-colors border-b-2 -mb-px flex items-center gap-2 ${mainTab === "learn"
                            ? "border-white text-primary"
                            : "border-transparent text-secondary hover:text-primary"
                            }`}
                    >
                        <Zap className="w-3.5 h-3.5" />
                        Learn
                    </button>
                </div>

                {/* Tab Content */}
                <AnimatePresence mode="wait">
                    {mainTab === "tests" ? (
                        <motion.div
                            key="tests-tab"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.15 }}
                            className="flex flex-col gap-6"
                        >
                            {/* Generate button - split button */}
                            <div className="flex items-center gap-3">
                                <div className="relative flex" ref={dropdownRef}>
                                    {/* Main generate button */}
                                    <button
                                        disabled={pieces.length === 0 || isGenerating}
                                        onClick={handleTestMe}
                                        className="flex items-center gap-2.5 bg-white text-black font-medium pl-5 pr-4 py-2.5 rounded-l-xl spring-interact disabled:opacity-50 hover:opacity-90 text-sm"
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
                                    <button
                                        onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                                        className="flex items-center px-2.5 py-2.5 bg-white text-black rounded-r-xl border-l border-black/10 spring-interact hover:bg-neutral-100 disabled:opacity-50"
                                        disabled={pieces.length === 0 || isGenerating}
                                    >
                                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showTypeDropdown ? 'rotate-180' : ''}`} />
                                    </button>

                                    {/* Dropdown */}
                                    <AnimatePresence>
                                        {showTypeDropdown && (
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

                                                {/* Topic picker */}
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
                                {selectedTopic && (
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
                                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white">
                                    <p className="text-white/90">{testGenerateError}</p>
                                    <Link href="/pricing" className="mt-1 inline-flex text-xs font-medium text-white/60 hover:text-white/90 transition-colors">
                                        Open plans
                                    </Link>
                                </div>
                            )}

                            {/* Filter / Sort bar */}
                            {spaceTests && spaceTests.length > 0 && (() => {
                                // Enrich tests with computed data
                                const enriched = spaceTests.map(test => {
                                    const testQuestions = spaceQuestions?.filter(q => q.testId === test._id) ?? [];
                                    const answeredCount = testQuestions.filter(q => q.userAnswer).length;
                                    const target = test.config?.questionCount ?? 5;
                                    const correctCount = testQuestions.filter(q => q.isCorrect === true).length;
                                    const wrongCount = testQuestions.filter(q => q.isCorrect === false).length;
                                    let progressStatus: "done" | "in_progress" | "new";
                                    if (answeredCount >= target) {
                                        progressStatus = "done";
                                    } else if (answeredCount > 0) {
                                        progressStatus = "in_progress";
                                    } else {
                                        progressStatus = "new";
                                    }
                                    const performance = answeredCount > 0
                                        ? correctCount / answeredCount
                                        : -1;
                                    return {
                                        ...test, testQuestions, answeredCount, target, correctCount, wrongCount, progressStatus, performance,
                                        topicLabel: test.topicTitle ?? "—",
                                    };
                                });

                                // Unique topics for filter
                                const uniqueTopics = [...new Set(enriched.map(t => t.topicLabel))].sort((a, b) => a.localeCompare(b));

                                // Apply filters
                                let filtered = enriched;
                                if (filterStatus !== "all") {
                                    filtered = filtered.filter(t => t.progressStatus === filterStatus);
                                }
                                if (filterTopic !== "all") {
                                    filtered = filtered.filter(t => t.topicLabel === filterTopic);
                                }

                                // Sort
                                const sorted = [...filtered];
                                if (sortBy === "date") sorted.sort((a, b) => b._creationTime - a._creationTime);
                                else if (sortBy === "status") {
                                    const order = { done: 0, in_progress: 1, new: 2 };
                                    sorted.sort((a, b) => order[a.progressStatus] - order[b.progressStatus]);
                                } else if (sortBy === "questions") {
                                    sorted.sort((a, b) => b.testQuestions.length - a.testQuestions.length);
                                } else if (sortBy === "performance") {
                                    sorted.sort((a, b) => b.performance - a.performance);
                                }
                                if (!sortDesc) {
                                    sorted.reverse();
                                }

                                // Grouping logic
                                const now = new Date();
                                const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                                const yesterdayStart = todayStart - 86400000;
                                const weekStart = todayStart - 7 * 86400000;
                                const twoWeeksStart = todayStart - 14 * 86400000;

                                const getDateGroup = (ts: number) => {
                                    if (ts >= todayStart) return "Today";
                                    if (ts >= yesterdayStart) return "Yesterday";
                                    if (ts >= weekStart) return "Past Week";
                                    if (ts >= twoWeeksStart) return "Past 2 Weeks";
                                    return "Older";
                                };
                                const getStatusGroup = (s: string) => {
                                    if (s === "done") return "Completed";
                                    if (s === "in_progress") return "In Progress";
                                    return "Not Started";
                                };
                                const getPerformanceGroup = (p: number) => {
                                    if (p < 0) return "Not Started";
                                    if (p >= 0.7) return "Mostly Good";
                                    if (p >= 0.4) return "Mixed";
                                    return "Needs Work";
                                };

                                const getGroup = (t: typeof sorted[0]) => {
                                    if (sortBy === "date") return getDateGroup(t._creationTime);
                                    if (sortBy === "status") return getStatusGroup(t.progressStatus);
                                    if (sortBy === "performance") return getPerformanceGroup(t.performance);
                                    if (sortBy === "questions") return `${t.testQuestions.length} questions`;
                                    return "";
                                };

                                // Build grouped entries
                                const groups: { label: string; items: typeof sorted }[] = [];
                                let currentGroup = "";
                                for (const item of sorted) {
                                    const g = getGroup(item);
                                    if (g !== currentGroup) {
                                        currentGroup = g;
                                        groups.push({ label: g, items: [] });
                                    }
                                    const lastGroup = groups[groups.length - 1];
                                    if (lastGroup) {
                                        lastGroup.items.push(item);
                                    }
                                }

                                return (
                                    <>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {/* Sort dropdown */}
                                            <div className="flex items-center gap-1 text-[10px] text-white/30 mr-1">
                                                <span className="font-semibold uppercase tracking-widest">Sort</span>
                                            </div>
                                            {(["date", "status", "questions", "performance"] as const).map(s => (
                                                <button
                                                    key={s}
                                                    onClick={() => {
                                                        if (sortBy === s) {
                                                            setSortDesc(!sortDesc);
                                                        } else {
                                                            setSortBy(s);
                                                            setSortDesc(true);
                                                        }
                                                    }}
                                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium spring-interact transition-colors flex items-center gap-1 ${sortBy === s
                                                        ? "bg-white/10 text-white border border-white/15"
                                                        : "text-white/30 hover:text-white/60 hover:bg-white/5 border border-transparent"
                                                        }`}
                                                >
                                                    {s === "date" ? "Date" : s === "status" ? "Status" : s === "questions" ? "Questions" : "Performance"}
                                                    {sortBy === s && (
                                                        sortDesc ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
                                                    )}
                                                </button>
                                            ))}

                                            <div className="w-px h-4 bg-white/10 mx-1" />

                                            {/* Status filter */}
                                            <div className="flex items-center gap-1 text-[10px] text-white/30 mr-1">
                                                <span className="font-semibold uppercase tracking-widest">Filter</span>
                                            </div>
                                            <select
                                                value={filterStatus}
                                                onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
                                                className="bg-transparent border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white/50 spring-interact hover:border-white/20 focus:outline-none cursor-pointer"
                                            >
                                                <option value="all">All Status</option>
                                                <option value="done">Completed</option>
                                                <option value="in_progress">In Progress</option>
                                                <option value="new">Not Started</option>
                                            </select>

                                            {uniqueTopics.length > 1 && (
                                                <select
                                                    value={filterTopic}
                                                    onChange={e => setFilterTopic(e.target.value)}
                                                    className="bg-transparent border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white/50 spring-interact hover:border-white/20 focus:outline-none cursor-pointer max-w-[150px] truncate"
                                                >
                                                    <option value="all">All Topics</option>
                                                    {uniqueTopics.map(t => (
                                                        <option key={t} value={t}>{t}</option>
                                                    ))}
                                                </select>
                                            )}

                                            <span className="text-[10px] font-mono text-white/15 ml-auto">{filtered.length} test{filtered.length !== 1 ? 's' : ''}</span>
                                        </div>

                                        {/* Grouped grid */}
                                        {filtered.length === 0 ? (
                                            <div className="glass-card border-dashed rounded-2xl p-12 text-center flex flex-col items-center gap-3">
                                                <FileText className="w-8 h-8 text-white/10" />
                                                <p className="text-secondary text-sm">No tests match your filters.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-6">
                                                {groups.map((group, gi) => (
                                                    <div key={group.label}>
                                                        {/* Group separator */}
                                                        <div className="flex items-center gap-3 mb-4">
                                                            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/25 shrink-0">{group.label}</span>
                                                            <div className="flex-1 h-px bg-white/[0.06]" />
                                                            <span className="text-[10px] font-mono text-white/15 shrink-0">{group.items.length}</span>
                                                        </div>

                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-8">
                                                            {group.items.map((test, index) => {
                                                                const progress = Math.min(100, Math.max(0, test.target > 0 ? (test.answeredCount / test.target) * 100 : 0));
                                                                const stackDepth = Math.min(Math.max(test.testQuestions.length, 1), 5);
                                                                const isHovered = hoveredTestId === test._id;

                                                                const statusInfo = test.progressStatus === "done"
                                                                    ? { label: "Done", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" }
                                                                    : test.progressStatus === "in_progress"
                                                                        ? { label: "In Progress", icon: Zap, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" }
                                                                        : { label: "New", icon: Clock, color: "text-white/40", bg: "bg-white/5", border: "border-white/10" };
                                                                const StatusIcon = statusInfo.icon;

                                                                return (
                                                                    <Link href={`/tests/${test._id}`} key={test._id}>
                                                                        <motion.div
                                                                            initial={{ opacity: 0, y: 12 }}
                                                                            animate={{ opacity: 1, y: 0 }}
                                                                            transition={{ delay: (gi * 3 + index) * 0.02, type: "spring", stiffness: 400, damping: 25 }}
                                                                            className="group relative cursor-pointer"
                                                                            style={{
                                                                                paddingTop: `${Math.max(0, (stackDepth - 1) * 6)}px`,
                                                                                paddingLeft: `${Math.max(0, (stackDepth - 1) * 2)}px`,
                                                                            }}
                                                                            onMouseEnter={() => setHoveredTestId(test._id)}
                                                                            onMouseLeave={() => setHoveredTestId(null)}
                                                                        >
                                                                            {/* Stack background cards */}
                                                                            {Array.from({ length: stackDepth }).map((_, i) => {
                                                                                if (i === stackDepth - 1) return null;
                                                                                const depth = stackDepth - 1 - i;
                                                                                const h = hashCode(test._id + i);
                                                                                const rot = ((h % 5) - 2) * 0.6;
                                                                                return (
                                                                                    <motion.div
                                                                                        key={`bg-${i}`}
                                                                                        className="absolute rounded-xl border border-white/[0.05] bg-neutral-950/50"
                                                                                        animate={{
                                                                                            rotate: isHovered ? rot * 1.5 : rot,
                                                                                            x: isHovered ? -depth * 3 : -depth * 2,
                                                                                            y: isHovered ? -depth * 5 : -depth * 4,
                                                                                        }}
                                                                                        transition={{ type: "spring", stiffness: 500, damping: 25 }}
                                                                                        style={{
                                                                                            zIndex: i,
                                                                                            top: `${Math.max(0, (stackDepth - 1) * 6)}px`,
                                                                                            left: `${Math.max(0, (stackDepth - 1) * 2)}px`,
                                                                                            right: 0,
                                                                                            bottom: 0,
                                                                                        }}
                                                                                    />
                                                                                );
                                                                            })}

                                                                            {/* Top card */}
                                                                            <motion.div
                                                                                className="relative glass-card rounded-xl overflow-hidden"
                                                                                animate={{ scale: isHovered ? 1.02 : 1, y: isHovered ? -3 : 0 }}
                                                                                whileTap={{ scale: 0.98 }}
                                                                                transition={{ type: "spring", stiffness: 500, damping: 28 }}
                                                                                style={{ zIndex: stackDepth }}
                                                                            >
                                                                                <div
                                                                                    className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                                                                    style={{
                                                                                        background: isHovered
                                                                                            ? `radial-gradient(250px circle at ${testMousePos.x}% ${testMousePos.y}%, rgba(255,255,255,0.04), transparent 60%)`
                                                                                            : 'none'
                                                                                    }}
                                                                                />
                                                                                <div
                                                                                    className="relative z-10 p-3.5 flex flex-col gap-2"
                                                                                    onMouseMove={(e) => {
                                                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                                                        setTestMousePos({
                                                                                            x: ((e.clientX - rect.left) / rect.width) * 100,
                                                                                            y: ((e.clientY - rect.top) / rect.height) * 100,
                                                                                        });
                                                                                    }}
                                                                                >
                                                                                    {/* Status + type row */}
                                                                                    <div className="flex items-center justify-between">
                                                                                        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold uppercase tracking-wider ${statusInfo.color} ${statusInfo.bg} border ${statusInfo.border}`}>
                                                                                            <StatusIcon className="w-2.5 h-2.5" />
                                                                                            {statusInfo.label}
                                                                                        </div>
                                                                                        <div className="flex items-center gap-1.5 text-[9px] font-mono text-white/15">
                                                                                            {test.config?.type === "select" ? <ListChecks className="w-2.5 h-2.5" /> : <PenLine className="w-2.5 h-2.5" />}
                                                                                            {test.config?.type ?? "write"}
                                                                                        </div>
                                                                                    </div>

                                                                                    {/* Topic + number */}
                                                                                    <div>
                                                                                        <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold truncate">{test.topicLabel}</p>
                                                                                        <div className="flex items-center justify-between mt-0.5">
                                                                                            <span className="text-sm font-medium text-primary"># {spaceTests.length - spaceTests.indexOf(test)}</span>
                                                                                            <span className="text-[9px] font-mono text-white/15">
                                                                                                {new Date(test._creationTime).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                                                                            </span>
                                                                                        </div>
                                                                                    </div>

                                                                                    {/* Progress */}
                                                                                    <div className="space-y-1">
                                                                                        <div className="flex justify-between text-[9px] font-mono text-white/25">
                                                                                            <span>{test.answeredCount}/{test.target}</span>
                                                                                            <span>
                                                                                                {test.correctCount > 0 && <span className="text-emerald-500/60">{test.correctCount}✓ </span>}
                                                                                                {test.wrongCount > 0 && <span className="text-red-400/60">{test.wrongCount}✗ </span>}
                                                                                                {test.testQuestions.length} q
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="w-full h-0.5 rounded-full bg-white/5 overflow-hidden">
                                                                                            <motion.div
                                                                                                className="h-full rounded-full bg-white/20"
                                                                                                initial={{ width: 0 }}
                                                                                                animate={{ width: `${progress}%` }}
                                                                                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                                                                            />
                                                                                        </div>
                                                                                    </div>

                                                                                    {/* Footer */}
                                                                                    <div className="flex items-center justify-end gap-1 text-white/20 group-hover:text-white/60 transition-colors">
                                                                                        <span className="text-[9px] font-semibold uppercase tracking-widest">Open</span>
                                                                                        <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                                                                                    </div>
                                                                                </div>
                                                                            </motion.div>
                                                                        </motion.div>
                                                                    </Link>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                );
                            })()}

                            {/* Tests - loading or empty state */}
                            {!spaceTests ? (
                                <div className="flex justify-center p-12">
                                    <Loader2 className="w-6 h-6 animate-spin text-white/20" />
                                </div>
                            ) : spaceTests.length === 0 && (
                                <div className="glass-card border-dashed rounded-2xl p-16 text-center flex flex-col items-center gap-4">
                                    <FileText className="w-10 h-10 text-white/10" />
                                    <p className="text-secondary text-sm">No tests yet. Hit generate to create your first one.</p>
                                </div>
                            )}
                        </motion.div>
                    ) : mainTab === "knowledge" ? (
                        <motion.div
                            key="knowledge-tab"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.15 }}
                            className="flex flex-col gap-6"
                        >
                            {/* Add / Bulk mode toggle */}
                            <section className="glass-card rounded-2xl p-6 space-y-5">
                                <div className="flex gap-4 border-b border-white/10 pb-3">
                                    <button
                                        onClick={() => setKnowledgeMode("add")}
                                        className={`pb-2 font-medium text-sm transition-colors border-b-2 -mb-[13px] flex items-center gap-1.5 ${knowledgeMode === "add" ? "border-white text-primary" : "border-transparent text-secondary hover:text-primary"}`}
                                    >
                                        <Plus className="w-3 h-3" /> Add Piece
                                    </button>
                                    <button
                                        onClick={() => setKnowledgeMode("bulk")}
                                        className={`pb-2 font-medium text-sm transition-colors border-b-2 -mb-[13px] flex items-center gap-1.5 ${knowledgeMode === "bulk" ? "border-white text-primary" : "border-transparent text-secondary hover:text-primary"}`}
                                    >
                                        <Upload className="w-3 h-3" /> Bulk Import
                                    </button>
                                </div>

                                <AnimatePresence mode="wait">
                                    {knowledgeMode === "add" ? (
                                        <motion.form
                                            key="add"
                                            initial={{ opacity: 0, x: -8 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 8 }}
                                            onSubmit={handleAdd}
                                            className="space-y-4"
                                        >
                                            <input
                                                type="text"
                                                placeholder="Title (auto-generated if empty)"
                                                className="w-full bg-neutral-950 border border-white/10 text-primary rounded-xl px-4 py-2.5 focus-ring spring-interact text-sm placeholder:text-neutral-600"
                                                value={title}
                                                onChange={e => setTitle(e.target.value)}
                                            />
                                            <textarea
                                                placeholder="Type or paste a piece of knowledge here..."
                                                className="w-full bg-neutral-950 border border-white/10 text-primary rounded-xl p-4 focus-ring spring-interact min-h-[150px] resize-y text-sm placeholder:text-neutral-600"
                                                value={content}
                                                onChange={e => setContent(e.target.value)}
                                            />
                                            <div className="flex flex-col sm:flex-row gap-3">
                                                <input
                                                    type="text"
                                                    placeholder="Source (Optional)"
                                                    className="flex-1 bg-neutral-950 border border-white/10 text-primary rounded-xl px-4 py-2.5 focus-ring spring-interact text-sm placeholder:text-neutral-600"
                                                    value={source}
                                                    onChange={e => setSource(e.target.value)}
                                                />
                                                <button
                                                    disabled={isAdding || !content.trim()}
                                                    type="submit"
                                                    className="bg-white text-black font-medium px-6 py-2.5 rounded-xl spring-interact flex items-center justify-center gap-2 disabled:opacity-50 text-sm hover:opacity-90"
                                                >
                                                    {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                                    Add
                                                </button>
                                            </div>
                                        </motion.form>
                                    ) : (
                                        <motion.form
                                            key="bulk"
                                            initial={{ opacity: 0, x: 8 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -8 }}
                                            onSubmit={handleBulkImport}
                                            className="space-y-4"
                                        >
                                            <p className="text-secondary text-xs">
                                                Upload a text or CSV file. CSV format must use headers: <span className="text-primary">Content,Name</span>.
                                            </p>
                                            <div className="space-y-2">
                                                <input
                                                    ref={bulkFileInputRef}
                                                    type="file"
                                                    accept=".csv,.txt,.md,text/csv,text/plain"
                                                    className="w-full bg-neutral-950 border border-white/10 text-primary rounded-xl px-4 py-2.5 focus-ring spring-interact text-sm file:mr-3 file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-black hover:file:opacity-90"
                                                    onChange={handleBulkFileChange}
                                                />
                                                {bulkFileName && (
                                                    <p className="text-[11px] text-white/50 truncate">
                                                        Selected file: <span className="text-white/75">{bulkFileName}</span>
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex gap-3">
                                                <input
                                                    type="text"
                                                    placeholder="Delimiter"
                                                    className="w-1/3 bg-neutral-950 border border-white/10 text-primary rounded-xl px-4 py-2.5 focus-ring spring-interact text-sm placeholder:text-neutral-600"
                                                    value={delimiter}
                                                    onChange={e => setDelimiter(e.target.value)}
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="Source (Optional)"
                                                    className="w-2/3 bg-neutral-950 border border-white/10 text-primary rounded-xl px-4 py-2.5 focus-ring spring-interact text-sm placeholder:text-neutral-600"
                                                    value={source}
                                                    onChange={e => setSource(e.target.value)}
                                                />
                                            </div>
                                            <button
                                                disabled={isAdding || !bulkFileContent.trim()}
                                                type="submit"
                                                className="w-full bg-white text-black font-medium py-3 rounded-xl spring-interact flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90 text-sm"
                                            >
                                                {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                                Process & Import
                                            </button>
                                        </motion.form>
                                    )}
                                </AnimatePresence>
                            </section>

                            {/* Knowledge pieces list */}
                            <section className="space-y-4">
                                <h2 className="text-sm font-medium flex items-center gap-2 text-secondary">
                                    <BookOpen className="w-4 h-4" /> Knowledge Base
                                    <span className="text-[10px] font-mono text-tertiary bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-md">{pieces.length}</span>
                                </h2>
                                {pieces.length === 0 ? (
                                    <div className="glass-card border-dashed rounded-2xl p-12 text-center text-secondary flex flex-col items-center gap-4">
                                        <BrainCircuit className="w-10 h-10 opacity-30" />
                                        <p className="text-sm">This space is empty. Add some knowledge above.</p>
                                    </div>
                                ) : (
                                    <div className="grid gap-3">
                                        {pieces.slice().reverse().map((piece) => (
                                            <button
                                                key={piece._id}
                                                type="button"
                                                onClick={() => setViewingPieceId(String(piece._id))}
                                                className="glass-card rounded-xl p-4 hover:bg-white/5 transition-colors cursor-pointer relative group text-left"
                                            >
                                                {piece.title && (
                                                    <p className="text-xs text-white/50 font-semibold uppercase tracking-widest mb-1.5 pr-24">{piece.title}</p>
                                                )}
                                                <p className="text-secondary text-sm leading-relaxed whitespace-pre-wrap line-clamp-4">{piece.content}</p>
                                                {piece.source && <p className="text-xs text-tertiary mt-2 font-mono truncate">Src: <span className="text-secondary">{piece.source}</span></p>}
                                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <div className="px-2 py-1 rounded-md bg-white/5 text-white/40 border border-white/10 flex items-center gap-1.5 text-[10px] uppercase font-semibold tracking-widest hover:text-white hover:bg-white/10 transition-colors">
                                                        <BrainCircuit className="w-3 h-3" />
                                                        Nodes
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="learn-tab"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.15 }}
                            className="flex flex-col gap-6"
                        >
                            <LearnTab spaceId={spaceId} userId={userId ?? ""} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ─── Topic Picker Modal ─── */}
            <AnimatePresence>
                {showTopicPicker && (
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

            {/* ─── Knowledge Node Viewer Modal ─── */}
            <AnimatePresence>
                {viewingPieceId && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                        onClick={() => setViewingPieceId(null)}
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
                            className="relative w-full max-w-lg max-h-[85vh] glass-card rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden"
                        >
                            {/* Modal header */}
                            <div className="shrink-0 px-6 py-4 border-b border-white/[0.06] flex items-center justify-between bg-white/[0.02]">
                                <div className="flex items-center gap-3">
                                    <BrainCircuit className="w-4 h-4 text-white/40" />
                                    <h3 className="text-sm font-semibold text-primary tracking-tight">Knowledge Nodes</h3>
                                    {activeNodes !== undefined && (
                                        <span className="text-[10px] font-mono text-tertiary bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-md">{activeNodes.length}</span>
                                    )}
                                </div>
                                <button
                                    onClick={() => setViewingPieceId(null)}
                                    className="p-1.5 rounded-lg hover:bg-white/10 spring-interact text-white/40 hover:text-white"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Node list */}
                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                {(() => {
                                    if (activeNodes === undefined) {
                                        return (
                                            <div className="flex justify-center p-12">
                                                <Loader2 className="w-6 h-6 animate-spin text-white/20" />
                                            </div>
                                        );
                                    }

                                    if (activeNodes.length === 0) {
                                        return (
                                            <div className="text-center flex flex-col items-center gap-3 p-12 opacity-50">
                                                <CheckCircle2 className="w-8 h-8 opacity-50" />
                                                <p className="text-sm">No active focus areas. You&apos;re doing great.</p>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="grid gap-3">
                                            {activeNodes.map((node) => {
                                                const nodeInfo = getNodeTypeInfo(node.type);
                                                const Icon = nodeInfo.icon;
                                                const progressPct = Math.round((node.resolutionScore / RESOLUTION_THRESHOLD) * 100);

                                                return (
                                                    <div
                                                        key={node._id}
                                                        className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-start gap-4"
                                                    >
                                                        <div className={`p-2 rounded-lg border shrink-0 ${nodeInfo.bg} ${nodeInfo.border} ${nodeInfo.color}`}>
                                                            <Icon className="w-4 h-4" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between mb-1.5">
                                                                <h4 className="text-xs font-semibold uppercase tracking-widest text-white/80">{nodeInfo.label}</h4>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[10px] font-mono text-white/30 truncate">
                                                                        Target: {node.resolutionScore}/{RESOLUTION_THRESHOLD} ({progressPct}%)
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <p className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap">{node.content}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Modal footer */}
                            <div className="shrink-0 px-6 py-3 border-t border-white/[0.06] flex items-center justify-between bg-black/50">
                                <p className="text-xs text-white/30 truncate max-w-[250px]">
                                    Nodes are generated by your interactions and resolve as you test accurately.
                                </p>
                                <div className="flex items-center gap-2 text-white/20 shrink-0">
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
