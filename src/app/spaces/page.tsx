
"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, BookOpen, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { RedirectToSignIn, SignedIn, SignedOut, UserButton, useAuth } from "@clerk/nextjs";
import { USER_BUTTON_APPEARANCE } from "~/lib/clerk-shared";
import { createSpaceServerAction } from "~/app/actions/spaces";

export default function SpacesPage() {
    const { userId, isLoaded } = useAuth();
    const spaces = useQuery(api.spaces.list, userId ? { userId } : "skip");

    const [isCreating, setIsCreating] = useState(false);
    const [newSpaceName, setNewSpaceName] = useState("");
    const [error, setError] = useState<string | null>(null);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSpaceName.trim()) return;

        setIsCreating(true);
        setError(null);
        try {
            await createSpaceServerAction(newSpaceName);
            setNewSpaceName("");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create space");
        } finally {
            setIsCreating(false);
        }
    };

    if (!isLoaded) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-white/50" />
            </div>
        );
    }

    return (
        <>
            <SignedOut>
                <RedirectToSignIn />
            </SignedOut>

            <SignedIn>
                <div className="min-h-screen bg-black text-white p-6 md:p-12">
                    <div className="max-w-4xl mx-auto space-y-12">
                        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="space-y-2 flex-1">
                                <div className="flex justify-between items-center w-full mt-2">
                                    <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-primary">Your Spaces</h1>
                                    <div className="flex items-center gap-4">
                                        <Link
                                            href="/pricing"
                                            className="text-sm font-medium text-white/50 hover:text-white transition-colors"
                                        >
                                            Pricing
                                        </Link>
                                        <div className="glass-card p-1.5 rounded-full">
                                            <UserButton
                                                appearance={USER_BUTTON_APPEARANCE}
                                                afterSignOutUrl="/sign-in"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <p className="text-secondary text-sm">Create a dedicated space to manage knowledge and test yourself.</p>
                            </div>
                        </header>

                        <section className="glass-card rounded-2xl p-6 md:p-8">
                            <form onSubmit={handleCreate} className="flex gap-4">
                                <div className="relative flex-1 group">
                                    <input
                                        type="text"
                                        placeholder="E.g., Biology 101, JavaScript Basics..."
                                        className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 focus-ring spring-interact text-sm text-primary placeholder:text-neutral-600"
                                        value={newSpaceName}
                                        onChange={(e) => setNewSpaceName(e.target.value)}
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-neutral-600 text-xs font-mono">
                                        ⌘K
                                    </div>
                                </div>
                                <button
                                    disabled={isCreating || !newSpaceName.trim()}
                                    type="submit"
                                    className="bg-white text-black font-medium px-6 py-3 rounded-xl spring-interact flex items-center gap-2 disabled:opacity-50 text-sm hover:opacity-90"
                                >
                                    {isCreating ? <Loader2 className="animate-spin w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                    <span className="hidden md:inline">Create Space</span>
                                </button>
                            </form>
                            {error && (
                                <p className="mt-4 text-sm text-red-500 font-medium">
                                    {error} <Link href="/pricing" className="underline hover:text-red-400">Upgrade</Link>
                                </p>
                            )}
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
                                                    initial={{ opacity: 0, scale: 0.98 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.98 }}
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.98 }}
                                                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                                    className="group glass-card rounded-2xl p-6 cursor-pointer h-full flex flex-col justify-between"
                                                >
                                                    <div className="space-y-4 text-left">
                                                        <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-white/5 group-hover:bg-neutral-800 flex items-center justify-center transition-colors">
                                                            <BookOpen className="w-5 h-5 text-neutral-400 group-hover:text-white transition-colors" />
                                                        </div>
                                                        <h2 className="text-lg font-medium line-clamp-2 text-primary">{space.name}</h2>
                                                    </div>
                                                    <div className="mt-8 flex items-center justify-between text-tertiary group-hover:text-primary transition-colors">
                                                        <span className="text-xs font-medium uppercase tracking-widest">Enter Space</span>
                                                        <ChevronRight className="w-4 h-4" />
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
            </SignedIn>
        </>
    );
}
