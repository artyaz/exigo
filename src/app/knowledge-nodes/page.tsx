"use client";

import { motion } from "framer-motion";
import { ArrowLeft, BrainCircuit, Target, Zap, AlertTriangle, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

const SPRING_SNAPPY = { type: "spring" as const, stiffness: 400, damping: 30 };

const NODE_TYPES = [
    {
        title: "Active Struggles",
        icon: Target,
        color: "text-rose-400",
        bg: "bg-rose-500/10",
        border: "border-rose-500/20",
        description: "Concepts the AI identified as gaps in your understanding based on incorrect test answers.",
    },
    {
        title: "Feels Hard",
        icon: AlertTriangle,
        color: "text-amber-400",
        bg: "bg-amber-500/10",
        border: "border-amber-500/20",
        description: "Areas you manually flagged during AI tutor conversations for reinforced learning.",
    },
    {
        title: "Advanced Improvements",
        icon: TrendingUp,
        color: "text-emerald-400",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/20",
        description: "Harder, edge-case concepts automatically scheduled when you score 80%+ on a test.",
    }
];

export default function KnowledgeNodesPage() {
    const access = useQuery(api.plans.myAccessLevel);
    if (!access) {
        return null;
    }
    const isPro = access.isPro;

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-white/20 px-6 py-20 md:py-32 overflow-hidden relative">
            {/* Minimalist Grid Pattern Background */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none select-none" />

            <div className="max-w-2xl mx-auto relative z-10 flex flex-col gap-10">
                <header className="space-y-5 pt-4">
                    <Link
                        href="/spaces"
                        className="inline-flex items-center gap-2 text-xs font-medium text-white/40 hover:text-white transition-colors group"
                    >
                        <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                        Back to Spaces
                    </Link>

                    <div>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={SPRING_SNAPPY}
                            className="inline-flex items-center gap-2 px-2.5 py-1 mb-5 rounded-md border border-white/10 bg-white/5 text-[10px] font-semibold tracking-widest uppercase text-white/70"
                        >
                            <BrainCircuit className="w-3.5 h-3.5" />
                            Pro Feature
                        </motion.div>
                        <motion.h1
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ ...SPRING_SNAPPY, delay: 0.05 }}
                            className="text-4xl md:text-5xl font-medium tracking-tight"
                        >
                            Smart Knowledge Nodes
                        </motion.h1>
                    </div>
                </header>

                <div className="space-y-8 text-white/60 leading-relaxed text-[15px] sm:text-base">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING_SNAPPY, delay: 0.1 }}>
                        <p className="text-lg md:text-xl text-white/90 font-medium tracking-tight leading-relaxed">
                            Exigo doesn&apos;t just test you blindly. It builds a semantic map of your weaknesses, dynamically generating tests that force you to confront what you don&apos;t know.
                        </p>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING_SNAPPY, delay: 0.15 }} className="space-y-5">
                        <p>
                            Traditional studying assumes all information is equal. Exigo treats learning as a dynamic network. As you interact with AI tutors, take complex tests, and review material, our system quietly constructs a web of concepts—what we call <strong className="font-semibold text-white/90">Knowledge Nodes</strong>.
                        </p>
                        <p>
                            These nodes represent the exact boundaries of your understanding. When it&apos;s time to generate your next quiz, Exigo heavily weighs these active areas, ensuring you spend limited time on topics that actually demand it. Currently, the system tracks three distinct types of learning edges:
                        </p>
                    </motion.div>

                    <div className="py-2">
                        <div className="grid gap-4">
                            {NODE_TYPES.map((node, i) => {
                                const Icon = node.icon;
                                return (
                                    <motion.div
                                        key={node.title}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ ...SPRING_SNAPPY, delay: 0.2 + (i * 0.05) }}
                                        className="group relative p-6 rounded-xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm shadow-[0_4px_24px_-8px_rgba(0,0,0,0.5)] transition-colors hover:bg-white/[0.04] flex items-start gap-4"
                                    >
                                        <div className={`p-2.5 rounded-lg border ${node.bg} ${node.border} ${node.color} shrink-0`}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-semibold tracking-tight text-white/90 mb-1.5">{node.title}</h3>
                                            <p className="text-sm text-white/50 leading-relaxed">{node.description}</p>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>

                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING_SNAPPY, delay: 0.35 }} className="space-y-5 pt-4">
                        <h2 className="text-2xl font-medium tracking-tight text-white/90">The Resolution Engine</h2>
                        <p>
                            Nodes don&apos;t stick around forever. Exigo features a built-in Resolution Engine that tracks your performance against targeted questions. Every time you encounter a question spawned from a Knowledge Node, your answer directly influences its confidence state.
                        </p>
                        <p>
                            Answer correctly, and the node&apos;s resolution score increases. Once it reaches a high certainty threshold (90%), it automatically resolves, fading into the background of your knowledge graph. It&apos;s a satisfying, deterministic way to <i>prove</i> you&apos;ve mastered a previously difficult concept.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...SPRING_SNAPPY, delay: 0.4 }}
                        className="p-6 mt-8 rounded-xl border border-white/[0.08] bg-black shadow-[0_8px_32px_-12px_rgba(0,0,0,0.8)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-white/5 border border-white/10 shrink-0 border-dashed">
                                <Zap className="w-4 h-4 text-white/60" />
                            </div>
                            <div>
                                <h4 className="text-xs font-semibold tracking-tight text-white/80 uppercase">Continuous Evolution</h4>
                                <p className="text-[11px] text-white/40 mt-0.5">Your Knowledge Map updates in real-time with your activity.</p>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {!isPro && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...SPRING_SNAPPY, delay: 0.45 }}
                        className="mt-4 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-6"
                    >
                        <div>
                            <h4 className="text-sm font-medium text-white/90">Upgrade to Pro</h4>
                            <p className="text-xs text-white/50 mt-1">Unlock Knowledge Nodes and unlimited spaces.</p>
                        </div>
                        <Link
                            href="/pricing"
                            className="px-5 py-2.5 rounded-lg bg-white text-black text-xs font-semibold tracking-wide hover:bg-white/90 transition-colors active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.1)] shrink-0"
                        >
                            View Plans
                        </Link>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
