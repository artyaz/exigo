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
            <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
            </div>
        );
    }

    if (space === null) {
        return (
            <div className="min-h-screen bg-neutral-950 text-neutral-50 flex items-center justify-center flex-col gap-4">
                <h1 className="text-3xl font-bold">Space not found</h1>
                <Link href="/spaces" className="text-emerald-500 hover:text-emerald-400">
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
        <div className="min-h-screen bg-neutral-950 text-neutral-50 p-4 md:p-8">
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* Left Column: Management */}
                <div className="lg:col-span-8 flex flex-col gap-8">
                    <header className="flex items-center gap-6">
                        <Link href="/spaces" className="p-3 bg-neutral-900 hover:bg-neutral-800 rounded-2xl transition-colors border border-neutral-800">
                            <ArrowLeft className="w-6 h-6" />
                        </Link>
                        <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-600">
                            {space.name}
                        </h1>
                    </header>

                    <section className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 md:p-8 space-y-6">
                        <div className="flex gap-4 border-b border-neutral-800 pb-4">
                            <button
                                onClick={() => setActiveTab("add")}
                                className={`px-4 py-2 font-semibold text-lg transition-colors border-b-2 ${activeTab === "add" ? "border-emerald-500 text-emerald-500" : "border-transparent text-neutral-500 hover:text-neutral-300"}`}
                            >
                                Add Piece
                            </button>
                            <button
                                onClick={() => setActiveTab("bulk")}
                                className={`px-4 py-2 font-semibold text-lg transition-colors border-b-2 ${activeTab === "bulk" ? "border-emerald-500 text-emerald-500" : "border-transparent text-neutral-500 hover:text-neutral-300"}`}
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
                                        className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 min-h-[150px] resize-y text-lg"
                                        value={content}
                                        onChange={e => setContent(e.target.value)}
                                    />
                                    <div className="flex flex-col sm:flex-row gap-4">
                                        <input
                                            type="text"
                                            placeholder="Source (Optional URL or tag)"
                                            className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                            value={source}
                                            onChange={e => setSource(e.target.value)}
                                        />
                                        <button
                                            disabled={isAdding || !content.trim()}
                                            type="submit"
                                            className="bg-emerald-500 text-neutral-950 font-semibold px-8 py-3 rounded-xl hover:bg-emerald-400 focus:outline-none transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            {isAdding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
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
                                    <p className="text-neutral-400 text-sm">Paste huge text blocks and separate them by your chosen delimiter.</p>
                                    <div className="flex gap-4">
                                        <input
                                            type="text"
                                            placeholder="Delimiter (e.g., \\n\\n, ###)"
                                            className="w-1/3 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                            value={delimiter}
                                            onChange={e => setDelimiter(e.target.value)}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Global Source (Optional)"
                                            className="w-2/3 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                            value={source}
                                            onChange={e => setSource(e.target.value)}
                                        />
                                    </div>
                                    <textarea
                                        placeholder="Paste massive piece of text here..."
                                        className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 min-h-[250px] resize-y"
                                        value={bulkContent}
                                        onChange={e => setBulkContent(e.target.value)}
                                    />
                                    <button
                                        disabled={isAdding || !bulkContent.trim()}
                                        type="submit"
                                        className="w-full bg-emerald-500 text-neutral-950 font-semibold px-8 py-4 rounded-xl hover:bg-emerald-400 focus:outline-none transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-lg"
                                    >
                                        {isAdding ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                                        Process & Import Bulk
                                    </button>
                                </motion.form>
                            )}
                        </AnimatePresence>
                    </section>

                    <section className="space-y-4 flex-1">
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <BookOpen className="text-emerald-500 w-6 h-6" /> Knowledge Base <span className="text-sm font-normal text-neutral-500 bg-neutral-900 px-3 py-1 rounded-full">{pieces.length} items</span>
                        </h2>
                        {pieces.length === 0 ? (
                            <div className="bg-neutral-900/50 border border-neutral-800 border-dashed rounded-3xl p-12 text-center text-neutral-500 flex flex-col items-center gap-4">
                                <BrainCircuit className="w-12 h-12 opacity-50" />
                                <p className="text-lg">This space is empty. Add some knowledge pieces above to start generating tests.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {pieces.slice().reverse().map((piece) => (
                                    <div key={piece._id} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 hover:border-neutral-700 transition-colors">
                                        <p className="text-neutral-300 leading-relaxed whitespace-pre-wrap line-clamp-4">{piece.content}</p>
                                        {piece.source && <p className="text-sm text-neutral-500 mt-4 font-mono truncate bg-neutral-950 inline-block px-3 py-1 rounded-lg">Src: {piece.source}</p>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>

                {/* Right Column: AI Action Panel */}
                <div className="lg:col-span-4 relative">
                    <div className="sticky top-8 bg-neutral-900 border border-neutral-800 rounded-3xl p-6 md:p-8 space-y-8 shadow-2xl overflow-hidden">
                        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-400 to-cyan-500" />

                        <div>
                            <h2 className="text-2xl font-bold flex items-center gap-2 text-white">
                                <Sparkles className="w-6 h-6 text-emerald-400" /> Test Me
                            </h2>
                            <p className="text-neutral-400 mt-2 text-sm leading-relaxed">Turn your knowledge base into an interactive test and check how much you remember.</p>
                        </div>

                        <div className="space-y-4">
                            <p className="font-semibold text-neutral-300">Format:</p>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setTestType("select")}
                                    className={`border rounded-xl px-4 py-3 font-medium transition-all ${testType === "select" ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-neutral-800 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50"}`}
                                >
                                    Select Ans
                                </button>
                                <button
                                    onClick={() => setTestType("write")}
                                    className={`border rounded-xl px-4 py-3 font-medium transition-all ${testType === "write" ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-neutral-800 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50"}`}
                                >
                                    Write Ans
                                </button>
                            </div>
                        </div>

                        <button
                            disabled={pieces.length === 0 || isGenerating}
                            onClick={handleTestMe}
                            className="w-full group relative overflow-hidden rounded-2xl p-[1px] disabled:opacity-50"
                        >
                            <span className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-2xl opacity-80 group-hover:opacity-100 transition-opacity" />
                            <div className="relative bg-neutral-950 rounded-[15px] px-8 py-4 flex items-center justify-center gap-3">
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
                                        <span className="text-emerald-400 font-bold text-lg">Generating DB...</span>
                                    </>
                                ) : (
                                    <>
                                        <BrainCircuit className="w-6 h-6 text-white" />
                                        <span className="text-white font-bold text-lg">Generate Test</span>
                                    </>
                                )}
                            </div>
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
