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
import { useRouter, useSearchParams } from "next/navigation";
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
import { TestGrid } from "../../_components/tests/TestGrid";
import { TestGenerateButton } from "../../_components/tests/TestGenerateButton";

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
    const searchParams = useSearchParams();
    const { userId } = useAuth();
    const { spaceId } = use(params);
    const sId = spaceId as Id<"spaces">;

    const { space, pieces, spaceTests, spaceQuestions } = useSpaceData(sId, userId);


    const updateTitle = useMutation(api.knowledgePieces.updateTitle);


    // Main tabs — honour ?tab= param from learn page back link
    const [mainTab, setMainTab] = useState<"tests" | "knowledge" | "learn">(() => {
      const tab = searchParams.get("tab");
      if (tab === "tests" || tab === "knowledge") return tab;
      return "learn";
    });

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

    // Knowledge piece viewing state
    const [viewingPieceId, setViewingPieceId] = useState<string | null>(null);
    const activeNodes = useQuery(api.knowledgeNodes.getActiveForPiece, (userId && viewingPieceId) ? { knowledgePieceId: viewingPieceId as Id<"knowledgePieces"> } : "skip");

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
                            if (userId && data.title && data.title !== "Untitled") {
                                void updateTitle({ id: ids[i] as Id<"knowledgePieces">, title: data.title });
                            }
                        })
                        .catch(() => { /* silent */ });
                }
            });

            setBulkFileContent("");
            setBulkFileName("");
            if (bulkFileInputRef.current) {
                bulkFileInputRef.current.value = "";
            }
            // Switch back to "add" mode to clear view
            setKnowledgeMode("add");
        } catch (error) {
            console.error("Failed to bulk import knowledge", error);
            alert((error as Error).message);
        } finally {
            setIsAdding(false);
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
                        onClick={() => setMainTab("learn")}
                        className={`px-4 py-2.5 font-medium text-sm transition-colors border-b-2 -mb-px flex items-center gap-2 ${mainTab === "learn"
                            ? "border-white text-primary"
                            : "border-transparent text-secondary hover:text-primary"
                            }`}
                    >
                        <Zap className="w-3.5 h-3.5" />
                        Learn
                    </button>
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
                            <TestGenerateButton spaceId={spaceId} pieces={pieces} />
                            
                            <div className="border-t border-white/5 my-2" />
                            
                            <TestGrid spaceTests={spaceTests} spaceQuestions={spaceQuestions} />
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
                            <LearnTab spaceId={spaceId} userId={userId ?? ""} spaceName={space?.name ?? ""} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>



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
