/* eslint-disable */
// @ts-nocheck
"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useState, use, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft, Plus, Upload, BrainCircuit, Loader2, BookOpen,
    CheckCircle2, Clock, Zap, ChevronRight, ChevronDown, FileText, ListChecks, PenLine
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Computes a 32-bit integer hash for the given string.
 *
 * @param str - Input string to hash.
 * @returns A 32-bit signed integer hash derived from `str`.
 */
function hashCode(str: string) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return hash;
}

/**
 * Renders the detail view for a space, providing tabs to manage and generate tests and to add or import knowledge pieces.
 *
 * Persists the selected test type to localStorage and navigates to a newly created test when generation completes.
 *
 * @param params - A Promise that resolves to route parameters; must include `spaceId` identifying the space to display.
 * @returns The React element for the Space detail page.
 */
export default function SpaceDetailPage({ params }: { params: Promise<{ spaceId: string }> }) {
    const router = useRouter();
    const { spaceId } = use(params);
    const sId = spaceId as Id<"spaces">;

    const space = useQuery(api.spaces.get, { spaceId: sId });
    const pieces = useQuery(api.knowledgePieces.getForSpace, { spaceId: sId });
    const addPiece = useMutation(api.knowledgePieces.add);
    const bulkImport = useMutation(api.knowledgePieces.bulkImport);
    const createEmptyTest = useMutation(api.tests.createEmptyTest);
    const spaceTests = useQuery(api.tests.getForSpace, { spaceId: sId });
    const spaceQuestions = useQuery(api.questions.getForSpace, { spaceId: sId });

    // Main tabs
    const [mainTab, setMainTab] = useState<"tests" | "knowledge">("tests");

    // Knowledge sub-mode
    const [knowledgeMode, setKnowledgeMode] = useState<"add" | "bulk">("add");
    const [content, setContent] = useState("");
    const [source, setSource] = useState("");
    const [bulkContent, setBulkContent] = useState("");
    const [delimiter, setDelimiter] = useState("\\n\\n");
    const [isAdding, setIsAdding] = useState(false);

    // Test generation
    const [testType, setTestType] = useState<"select" | "write">(() => {
        if (typeof window !== "undefined") {
            return (localStorage.getItem("exigo_test_type") as "select" | "write") || "select";
        }
        return "select";
    });
    const [isGenerating, setIsGenerating] = useState(false);
    const [showTypeDropdown, setShowTypeDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Test card hover
    const [hoveredTestId, setHoveredTestId] = useState<string | null>(null);
    const [testMousePos, setTestMousePos] = useState({ x: 0, y: 0 });

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
        await addPiece({ spaceId: sId, content, source: source.trim() || undefined });
        setContent("");
        setSource("");
        setIsAdding(false);
    };

    const handleBulkImport = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!bulkContent.trim()) return;
        setIsAdding(true);
        const splitRegex = new RegExp(delimiter.replace(/\\n/g, '\n'));
        const parts = bulkContent.split(splitRegex).filter(p => p.trim().length > 0);
        const structuredPieces = parts.map(p => ({
            content: p.trim(),
            source: source.trim() || undefined
        }));
        await bulkImport({ spaceId: sId, pieces: structuredPieces });
        setBulkContent("");
        setIsAdding(false);
    };

    const handleTestMe = async () => {
        if (pieces.length === 0) return;
        setIsGenerating(true);
        try {
            const testId = await createEmptyTest({ spaceId: sId, type: testType, questionCount: 5 });
            router.push(`/tests/${testId}`);
        } catch (error) {
            console.error("Failed to create test", error);
            setIsGenerating(false);
        }
    };

    const selectType = (type: "select" | "write") => {
        setTestType(type);
        setShowTypeDropdown(false);
    };

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
                                                className="absolute top-full left-0 mt-2 w-56 glass-card rounded-xl border border-white/10 shadow-2xl z-50 overflow-hidden"
                                            >
                                                <button
                                                    onClick={() => selectType("select")}
                                                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left spring-interact transition-colors ${testType === "select" ? "bg-white/5 text-primary" : "text-secondary hover:bg-white/5 hover:text-primary"
                                                        }`}
                                                >
                                                    <ListChecks className="w-4 h-4 shrink-0" />
                                                    <div>
                                                        <p className="font-medium">Multiple Choice</p>
                                                        <p className="text-[11px] text-white/30 mt-0.5">Select from 4 options</p>
                                                    </div>
                                                    {testType === "select" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 ml-auto" />}
                                                </button>
                                                <div className="border-t border-white/5" />
                                                <button
                                                    onClick={() => selectType("write")}
                                                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left spring-interact transition-colors ${testType === "write" ? "bg-white/5 text-primary" : "text-secondary hover:bg-white/5 hover:text-primary"
                                                        }`}
                                                >
                                                    <PenLine className="w-4 h-4 shrink-0" />
                                                    <div>
                                                        <p className="font-medium">Written Answer</p>
                                                        <p className="text-[11px] text-white/30 mt-0.5">Full explanation required</p>
                                                    </div>
                                                    {testType === "write" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 ml-auto" />}
                                                </button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {pieces.length === 0 && (
                                    <p className="text-xs text-red-500/80">Add knowledge first</p>
                                )}
                            </div>

                            {/* Tests grid */}
                            {!spaceTests ? (
                                <div className="flex justify-center p-12">
                                    <Loader2 className="w-6 h-6 animate-spin text-white/20" />
                                </div>
                            ) : spaceTests.length === 0 ? (
                                <div className="glass-card border-dashed rounded-2xl p-16 text-center flex flex-col items-center gap-4">
                                    <FileText className="w-10 h-10 text-white/10" />
                                    <p className="text-secondary text-sm">No tests yet. Hit generate to create your first one.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {spaceTests.slice().reverse().map((test, index) => {
                                        const testQuestions = spaceQuestions?.filter(q => q.testId === test._id) ?? [];
                                        const answeredCount = testQuestions.filter(q => q.userAnswer).length;
                                        const target = test.config?.questionCount ?? 5;
                                        const progress = target > 0 ? (answeredCount / target) * 100 : 0;
                                        const stackDepth = Math.min(Math.max(testQuestions.length, 1), 5);
                                        const isHovered = hoveredTestId === test._id;

                                        const statusInfo = answeredCount >= target
                                            ? { label: "Done", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" }
                                            : answeredCount > 0
                                                ? { label: "In Progress", icon: Zap, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" }
                                                : { label: "New", icon: Clock, color: "text-white/40", bg: "bg-white/5", border: "border-white/10" };
                                        const StatusIcon = statusInfo.icon;

                                        return (
                                            <Link href={`/tests/${test._id}`} key={test._id}>
                                                <motion.div
                                                    initial={{ opacity: 0, y: 12 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: index * 0.03, type: "spring", stiffness: 400, damping: 25 }}
                                                    className="group relative cursor-pointer"
                                                    style={{
                                                        paddingTop: `${Math.max(0, (stackDepth - 1) * 4)}px`,
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
                                                                className="absolute inset-0 rounded-xl border border-white/[0.05] bg-neutral-950/50"
                                                                animate={{
                                                                    rotate: isHovered ? rot * 1.5 : rot,
                                                                    x: isHovered ? -depth * 3 : -depth * 2,
                                                                    y: isHovered ? -depth * 5 : -depth * 4,
                                                                }}
                                                                transition={{ type: "spring", stiffness: 500, damping: 25 }}
                                                                style={{ zIndex: i }}
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
                                                            className="relative z-10 p-4 flex flex-col gap-3"
                                                            onMouseMove={(e) => {
                                                                const rect = e.currentTarget.getBoundingClientRect();
                                                                setTestMousePos({
                                                                    x: ((e.clientX - rect.left) / rect.width) * 100,
                                                                    y: ((e.clientY - rect.top) / rect.height) * 100,
                                                                });
                                                            }}
                                                        >
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
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-sm font-medium text-primary"># {spaceTests.length - index}</span>
                                                                <span className="text-[9px] font-mono text-white/15">
                                                                    {new Date(test._creationTime).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                                                </span>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <div className="flex justify-between text-[9px] font-mono text-white/25">
                                                                    <span>{answeredCount}/{target}</span>
                                                                    <span>{testQuestions.length} q</span>
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
                            )}
                        </motion.div>
                    ) : (
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
                                            <p className="text-secondary text-xs">Paste text and split by delimiter.</p>
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
                                            <textarea
                                                placeholder="Paste text here..."
                                                className="w-full bg-neutral-950 border border-white/10 text-primary rounded-xl p-4 focus-ring spring-interact min-h-[200px] resize-y text-sm placeholder:text-neutral-600"
                                                value={bulkContent}
                                                onChange={e => setBulkContent(e.target.value)}
                                            />
                                            <button
                                                disabled={isAdding || !bulkContent.trim()}
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
                                            <div key={piece._id} className="glass-card rounded-xl p-4 hover:bg-white/5 transition-colors">
                                                <p className="text-secondary text-sm leading-relaxed whitespace-pre-wrap line-clamp-4">{piece.content}</p>
                                                {piece.source && <p className="text-xs text-tertiary mt-2 font-mono truncate">Src: <span className="text-secondary">{piece.source}</span></p>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}