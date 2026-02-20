"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, BookOpen, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";

export default function SpacesPage() {
    const spaces = useQuery(api.spaces.list);
    const createSpace = useMutation(api.spaces.create);

    const [isCreating, setIsCreating] = useState(false);
    const [newSpaceName, setNewSpaceName] = useState("");

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSpaceName.trim()) return;

        setIsCreating(true);
        await createSpace({ name: newSpaceName });
        setNewSpaceName("");
        setIsCreating(false);
    };

    return (
        <div className="min-h-screen bg-neutral-950 text-neutral-50 p-6 md:p-12">
            <div className="max-w-4xl mx-auto space-y-12">
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-2">
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Your Spaces</h1>
                        <p className="text-neutral-400 text-lg">Create a dedicated space to manage knowledge and test yourself.</p>
                    </div>
                </header>

                <section className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 md:p-8">
                    <form onSubmit={handleCreate} className="flex gap-4">
                        <input
                            type="text"
                            placeholder="E.g., Biology 101, JavaScript Basics..."
                            className="flex-1 bg-neutral-950 border border-neutral-800 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-lg"
                            value={newSpaceName}
                            onChange={(e) => setNewSpaceName(e.target.value)}
                        />
                        <button
                            disabled={isCreating || !newSpaceName.trim()}
                            type="submit"
                            className="bg-emerald-500 text-neutral-950 font-semibold px-8 rounded-2xl hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50 transition-all flex items-center gap-2"
                        >
                            {isCreating ? <Loader2 className="animate-spin w-5 h-5" /> : <Plus className="w-5 h-5" />}
                            <span className="hidden md:inline">Create Space</span>
                        </button>
                    </form>
                </section>

                <section>
                    {!spaces ? (
                        <div className="flex justify-center p-12">
                            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                        </div>
                    ) : spaces.length === 0 ? (
                        <div className="text-center p-12 space-y-4 text-neutral-500">
                            <BookOpen className="w-12 h-12 mx-auto opacity-50" />
                            <p className="text-lg">No spaces yet. Create your first one above!</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <AnimatePresence>
                                {spaces.map((space) => (
                                    <Link href={`/spaces/${space._id}`} key={space._id}>
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            whileHover={{ scale: 1.02, y: -4 }}
                                            className="group bg-neutral-900/50 hover:bg-neutral-900 border border-neutral-800 hover:border-emerald-500/30 rounded-3xl p-6 transition-all cursor-pointer h-full flex flex-col justify-between"
                                        >
                                            <div className="space-y-4 text-left">
                                                <div className="w-12 h-12 rounded-2xl bg-neutral-800 group-hover:bg-emerald-500/10 flex items-center justify-center transition-colors">
                                                    <BookOpen className="w-6 h-6 text-neutral-400 group-hover:text-emerald-500 transition-colors" />
                                                </div>
                                                <h2 className="text-2xl font-bold line-clamp-2">{space.name}</h2>
                                            </div>
                                            <div className="mt-8 flex items-center justify-between text-neutral-500 group-hover:text-emerald-500 transition-colors">
                                                <span className="text-sm font-medium">Enter Space</span>
                                                <ChevronRight className="w-5 h-5" />
                                            </div>
                                        </motion.div>
                                    </Link>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
