/* eslint-disable */
// @ts-nocheck
"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, ChevronRight, Loader2, CheckCircle2, Clock, Zap, ArrowLeft } from "lucide-react";
import Link from "next/link";

function hashCode(str: string) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return hash;
}

export default function TestsPage() {
    const tests = useQuery(api.tests.listAll);
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") window.history.back();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>, id: string) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setMousePos({
            x: ((e.clientX - rect.left) / rect.width) * 100,
            y: ((e.clientY - rect.top) / rect.height) * 100,
        });
        setHoveredId(id);
    };

    const getStatusInfo = (test: { answeredCount: number; config?: { questionCount?: number } }) => {
        const target = test.config?.questionCount ?? 5;
        if (test.answeredCount >= target) {
            return { label: "Completed", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" };
        }
        if (test.answeredCount > 0) {
            return { label: "In Progress", icon: Zap, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" };
        }
        return { label: "Not Started", icon: Clock, color: "text-white/40", bg: "bg-white/5", border: "border-white/10" };
    };

    const total = tests?.length ?? 0;

    return (
        <div className="min-h-screen bg-black text-white p-6 md:p-12">
            <div className="max-w-5xl mx-auto">
                <header className="mb-12 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/spaces" className="p-2.5 glass-card rounded-xl hover:bg-white/5 spring-interact text-secondary hover:text-primary">
                            <ArrowLeft className="w-4 h-4" />
                        </Link>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-primary">Tests</h1>
                            <p className="text-secondary text-sm mt-1">
                                {total > 0 ? `${total} test${total === 1 ? '' : 's'}` : 'All your knowledge challenges in one place.'}
                            </p>
                        </div>
                    </div>
                    <div className="hidden md:flex items-center gap-2 text-tertiary">
                        <kbd className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[11px] font-mono">Esc</kbd>
                        <span className="text-xs">Back</span>
                    </div>
                </header>

                {!tests ? (
                    <div className="flex justify-center p-24">
                        <Loader2 className="w-8 h-8 animate-spin text-white/30" />
                    </div>
                ) : tests.length === 0 ? (
                    <div className="text-center p-24 space-y-4">
                        <FileText className="w-16 h-16 mx-auto text-white/10" />
                        <p className="text-secondary text-lg">No tests yet.</p>
                        <p className="text-tertiary text-sm">Generate a test from any of your spaces to get started.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
                        <AnimatePresence>
                            {tests.map((test, index) => {
                                const status = getStatusInfo(test);
                                const StatusIcon = status.icon;
                                const isHovered = hoveredId === test._id;
                                const target = test.config?.questionCount ?? 5;
                                const progress = target > 0 ? (test.answeredCount / target) * 100 : 0;
                                // Number of visible "cards" in the stack — based on generated questions
                                const stackDepth = Math.min(test.questionCount, 5);

                                return (
                                    <Link href={`/tests/${test._id}`} key={test._id}>
                                        <motion.div
                                            initial={{ opacity: 0, y: 16 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ type: "spring", stiffness: 400, damping: 25, delay: index * 0.04 }}
                                            className="group relative cursor-pointer"
                                            style={{ paddingTop: `${Math.max(0, (stackDepth - 1) * 6)}px`, paddingLeft: `${Math.max(0, (stackDepth - 1) * 3)}px` }}
                                            onMouseMove={(e) => handleMouseMove(e, test._id)}
                                            onMouseLeave={() => setHoveredId(null)}
                                        >
                                            {/* Background stacked cards */}
                                            {Array.from({ length: stackDepth }).map((_, i) => {
                                                if (i === stackDepth - 1) return null; // top card rendered separately
                                                const depth = stackDepth - 1 - i; // how far back
                                                const h = hashCode(test._id + i);
                                                const rot = ((h % 5) - 2) * 0.8; // ±1.6 deg
                                                const offsetX = -depth * 3;
                                                const offsetY = -depth * 6;

                                                return (
                                                    <motion.div
                                                        key={`bg-${i}`}
                                                        className="absolute inset-0 rounded-2xl border border-white/[0.06] bg-neutral-950/60"
                                                        animate={{
                                                            rotate: isHovered ? rot * 1.5 : rot,
                                                            x: isHovered ? offsetX * 1.3 : offsetX,
                                                            y: isHovered ? offsetY * 1.3 : offsetY,
                                                        }}
                                                        transition={{ type: "spring", stiffness: 500, damping: 25 }}
                                                        style={{
                                                            zIndex: i,
                                                            transformOrigin: "center center",
                                                        }}
                                                    />
                                                );
                                            })}

                                            {/* Top card — the main content */}
                                            <motion.div
                                                className="relative glass-card rounded-2xl overflow-hidden"
                                                animate={{
                                                    scale: isHovered ? 1.02 : 1,
                                                    y: isHovered ? -4 : 0,
                                                }}
                                                whileTap={{ scale: 0.98 }}
                                                transition={{ type: "spring", stiffness: 500, damping: 28 }}
                                                style={{ zIndex: stackDepth }}
                                            >
                                                {/* Spotlight */}
                                                <div
                                                    className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                                    style={{
                                                        background: isHovered
                                                            ? `radial-gradient(300px circle at ${mousePos.x}% ${mousePos.y}%, rgba(255,255,255,0.05), transparent 60%)`
                                                            : 'none'
                                                    }}
                                                />

                                                <div className="relative z-10 p-5 flex flex-col gap-4">
                                                    {/* Status + type */}
                                                    <div className="flex items-center justify-between">
                                                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider ${status.color} ${status.bg} border ${status.border}`}>
                                                            <StatusIcon className="w-3 h-3" />
                                                            {status.label}
                                                        </div>
                                                        <span className="text-[10px] font-mono text-white/20 tracking-wider uppercase">
                                                            {test.config?.type ?? "write"}
                                                        </span>
                                                    </div>

                                                    {/* Space + title */}
                                                    <div>
                                                        <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold mb-1">{test.spaceName}</p>
                                                        <h3 className="text-base font-medium text-primary leading-snug">
                                                            Test #{total - index}
                                                        </h3>
                                                    </div>

                                                    {/* Progress */}
                                                    <div className="space-y-1.5">
                                                        <div className="flex justify-between text-[10px] font-mono">
                                                            <span className="text-white/30">{test.answeredCount}/{target} answered</span>
                                                            <span className="text-white/30">{test.questionCount} questions</span>
                                                        </div>
                                                        <div className="w-full h-0.5 rounded-full bg-white/5 overflow-hidden">
                                                            <motion.div
                                                                className="h-full rounded-full bg-white/25"
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${progress}%` }}
                                                                transition={{ type: "spring", stiffness: 300, damping: 30, delay: index * 0.05 }}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Footer */}
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] text-white/15 font-mono">
                                                            {new Date(test._creationTime).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                                        </span>
                                                        <div className="flex items-center gap-1 text-white/20 group-hover:text-white/70 transition-colors">
                                                            <span className="text-[10px] font-semibold uppercase tracking-widest">Open</span>
                                                            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        </motion.div>
                                    </Link>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
}
