/* eslint-disable */
// @ts-nocheck
"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useState, use } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, Upload, BrainCircuit, Loader2, Sparkles, BookOpen } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SpaceDetailPage({ params }: { params: Promise<{ spaceId: string }> }) {
    const router = useRouter();
    const { spaceId } = use(params);
    const sId = spaceId as Id<"spaces">;

    const space = useQuery(api.spaces.get, { spaceId: sId });
    const pieces = useQuery(api.knowledgePieces.getForSpace, { spaceId: sId });
    const addPiece = useMutation(api.knowledgePieces.add);
    const bulkImport = useMutation(api.knowledgePieces.bulkImport);

    const [activeTab, setActiveTab] = useState<"add" | "bulk">("add");
    const [content, setContent] = useState("");
    const [source, setSource] = useState("");

    const [bulkContent, setBulkContent] = useState("");
    const [delimiter, setDelimiter] = useState("\\n\\n");

    const [isAdding, setIsAdding] = useState(false);

    // Type selection for generated test
    const [testType, setTestType] = useState<"select" | "write">("select");
    const [isGenerating, setIsGenerating] = useState(false);

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

        // Convert literal \n\n to actual newlines for regex split if specified, else use straight string
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

        // In actual implementation, we'd trigger convex AI action here
        // For now we simulate navigation to test page which handles generation visually
        // Let's create an action in our Next part anyway
        const res = await fetch("/api/tests/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ spaceId: sId, testType })
        });

        setIsGenerating(false);

        if (res.ok) {
            const data = await res.json();
            router.push(`/tests/${data.testId}`);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white p-4 md:p-8">
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* Left Column: Management */}
                <div className="lg:col-span-8 flex flex-col gap-8">
                    <header className="flex items-center gap-6">
                        <Link href="/spaces" className="p-2 glass-card rounded-xl hover:bg-white/5 spring-interact text-secondary hover:text-primary">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-primary">
                            {space.name}
                        </h1>
                    </header>

                    <section className="glass-card rounded-2xl p-6 md:p-8 space-y-6">
                        <div className="flex gap-6 border-b border-white/10 pb-4">
                            <button
                                onClick={() => setActiveTab("add")}
                                className={`pb-2 font-medium text-sm transition-colors border-b-2 -mb-[17px] ${activeTab === "add" ? "border-white text-primary" : "border-transparent text-secondary hover:text-primary"}`}
                            >
                                Add Piece
                            </button>
                            <button
                                onClick={() => setActiveTab("bulk")}
                                className={`pb-2 font-medium text-sm transition-colors border-b-2 -mb-[17px] ${activeTab === "bulk" ? "border-white text-primary" : "border-transparent text-secondary hover:text-primary"}`}
                            >
                                Bulk Import
                            </button>
                        </div>

                        <AnimatePresence mode="wait">
                            {activeTab === "add" ? (
                                <motion.form
                                    key="add"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                    onSubmit={handleAdd}
                                    className="space-y-4"
                                >
                                    <textarea
                                        placeholder="Type or paste a piece of knowledge here..."
                                        className="w-full bg-neutral-950 border border-white/10 text-primary rounded-xl p-4 focus-ring spring-interact min-h-[150px] resize-y text-sm placeholder:text-neutral-600"
                                        value={content}
                                        onChange={e => setContent(e.target.value)}
                                    />
                                    <div className="flex flex-col sm:flex-row gap-4">
                                        <input
                                            type="text"
                                            placeholder="Source (Optional URL or tag)"
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
                                            Adding
                                        </button>
                                    </div>
                                </motion.form>
                            ) : (
                                <motion.form
                                    key="bulk"
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    onSubmit={handleBulkImport}
                                    className="space-y-4"
                                >
                                    <p className="text-secondary text-xs">Paste huge text blocks and separate them by your chosen delimiter.</p>
                                    <div className="flex gap-4">
                                        <input
                                            type="text"
                                            placeholder="Delimiter (e.g., \\n\\n, ###)"
                                            className="w-1/3 bg-neutral-950 border border-white/10 text-primary rounded-xl px-4 py-2.5 focus-ring spring-interact text-sm placeholder:text-neutral-600"
                                            value={delimiter}
                                            onChange={e => setDelimiter(e.target.value)}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Global Source (Optional)"
                                            className="w-2/3 bg-neutral-950 border border-white/10 text-primary rounded-xl px-4 py-2.5 focus-ring spring-interact text-sm placeholder:text-neutral-600"
                                            value={source}
                                            onChange={e => setSource(e.target.value)}
                                        />
                                    </div>
                                    <textarea
                                        placeholder="Paste massive piece of text here..."
                                        className="w-full bg-neutral-950 border border-white/10 text-primary rounded-xl p-4 focus-ring spring-interact min-h-[250px] resize-y text-sm placeholder:text-neutral-600"
                                        value={bulkContent}
                                        onChange={e => setBulkContent(e.target.value)}
                                    />
                                    <button
                                        disabled={isAdding || !bulkContent.trim()}
                                        type="submit"
                                        className="w-full bg-white text-black font-medium px-8 py-3 rounded-xl spring-interact flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90 text-sm"
                                    >
                                        {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                        Process & Import Bulk
                                    </button>
                                </motion.form>
                            )}
                        </AnimatePresence>
                    </section>

                    <section className="space-y-4 flex-1">
                        <h2 className="text-lg font-medium flex items-center gap-2 text-primary">
                            <BookOpen className="text-secondary w-5 h-5" /> Knowledge Base <span className="text-xs font-mono text-tertiary bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">{pieces.length} items</span>
                        </h2>
                        {pieces.length === 0 ? (
                            <div className="glass-card border-dashed rounded-2xl p-12 text-center text-secondary flex flex-col items-center gap-4">
                                <BrainCircuit className="w-10 h-10 opacity-50" />
                                <p className="text-sm">This space is empty. Add some knowledge pieces above.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {pieces.slice().reverse().map((piece) => (
                                    <div key={piece._id} className="glass-card rounded-xl p-5 hover:bg-white/5 transition-colors">
                                        <p className="text-secondary text-sm leading-relaxed whitespace-pre-wrap line-clamp-4">{piece.content}</p>
                                        {piece.source && <p className="text-xs text-tertiary mt-3 font-mono truncate inline-block">Src: <span className="text-secondary">{piece.source}</span></p>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>

                {/* Right Column: AI Action Panel */}
                <div className="lg:col-span-4 relative">
                    <div className="sticky top-8 glass-card rounded-2xl p-6 md:p-8 space-y-8">
                        <div>
                            <h2 className="text-lg font-medium flex items-center gap-2 text-primary">
                                <Sparkles className="w-5 h-5 text-secondary" /> Test Me
                            </h2>
                            <p className="text-secondary mt-2 text-xs leading-relaxed">Turn your knowledge base into an interactive test and check how much you remember.</p>
                        </div>

                        <div className="space-y-4">
                            <p className="text-sm font-medium text-primary">Format:</p>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setTestType("select")}
                                    className={`border rounded-xl px-4 py-2 font-medium transition-all text-sm spring-interact ${testType === "select" ? "border-white text-primary bg-white/5" : "border-white/10 text-tertiary hover:text-secondary hover:bg-white/5"}`}
                                >
                                    Select Ans
                                </button>
                                <button
                                    onClick={() => setTestType("write")}
                                    className={`border rounded-xl px-4 py-2 font-medium transition-all text-sm spring-interact ${testType === "write" ? "border-white text-primary bg-white/5" : "border-white/10 text-tertiary hover:text-secondary hover:bg-white/5"}`}
                                >
                                    Write Ans
                                </button>
                            </div>
                        </div>

                        <button
                            disabled={pieces.length === 0 || isGenerating}
                            onClick={handleTestMe}
                            className="w-full bg-white text-black font-medium flex items-center justify-center gap-2 rounded-xl py-3 spring-interact disabled:opacity-50 hover:opacity-90 text-sm"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Generating...</span>
                                </>
                            ) : (
                                <>
                                    <BrainCircuit className="w-4 h-4" />
                                    <span>Generate Test</span>
                                    <span className="hidden sm:inline bg-black/10 px-1.5 py-0.5 rounded-md text-[10px] ml-1 opacity-60">⌘ Enter</span>
                                </>
                            )}
                        </button>
                        {pieces.length === 0 && (
                            <p className="text-xs text-center text-red-500">Need at least 1 piece of knowledge first.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
