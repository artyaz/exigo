"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import Link from "next/link";
import {
    CheckCircle2, Clock, Zap, ArrowDown, ArrowUp, FileText,
} from "lucide-react";
import type { Doc } from "../../../../convex/_generated/dataModel";

// Utility function for hashCode used in 3D stack
function hashCode(str: string) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + (str.codePointAt(i) ?? 0);
        hash = Math.trunc(hash);
    }
    return hash;
}

interface TestGridProps {
    spaceTests: Doc<"tests">[] | undefined;
    spaceQuestions: Doc<"questions">[] | undefined;
}

export function TestGrid({ spaceTests, spaceQuestions }: TestGridProps) {
    // Sort & filter state
    const [sortBy, setSortBy] = useState<"date" | "status" | "questions" | "performance">("date");
    const [sortDesc, setSortDesc] = useState(true);
    const [filterStatus, setFilterStatus] = useState<"all" | "done" | "in_progress" | "new">("all");
    const [filterTopic, setFilterTopic] = useState<string>("all");

    // Hover state for 3D stack effect
    const [hoveredTestId, setHoveredTestId] = useState<string | null>(null);
    const [testMousePos, setTestMousePos] = useState({ x: 0, y: 0 });

    if (!spaceTests || spaceTests.length === 0) {
        return (
            <div className="glass-card border-dashed rounded-2xl p-12 text-center flex flex-col items-center gap-3">
                <FileText className="w-8 h-8 text-white/10" />
                <p className="text-secondary text-sm">No tests match your filters.</p>
            </div>
        );
    }

    // Enrich tests with computed data
    const enriched = spaceTests.map(test => {
        const testQuestions = spaceQuestions?.filter(q => q.testId === test._id) ?? [];
        const answeredCount = testQuestions.filter(q => q.userAnswer).length;
        const target = test.config?.questionCount ?? 5;
        const correctCount = testQuestions.filter(q => q.isCorrect === true).length;
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
            ...test, testQuestions, answeredCount, target, progressStatus, performance,
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
        const order: Record<"done" | "in_progress" | "new", number> = { done: 0, in_progress: 1, new: 2 };
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
                                                            <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] font-semibold text-white/50 uppercase tracking-wider">
                                                                {test.config?.type === "select" ? "Multiple Choice" : "Written"}
                                                            </div>
                                                        </div>

                                                        {/* Topic */}
                                                        <p className="font-medium text-sm text-primary leading-tight mt-1 line-clamp-2">
                                                            {test.topicLabel}
                                                        </p>

                                                        {/* Progress bar */}
                                                        <div className="mt-3 space-y-1.5">
                                                            <div className="flex items-center justify-between text-[10px] font-mono">
                                                                <span className="text-secondary">{test.answeredCount} / {test.target} q</span>
                                                                {progress > 0 && <span className="text-tertiary">{Math.round(progress)}%</span>}
                                                            </div>
                                                            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                                                <motion.div
                                                                    className={`h-full ${test.progressStatus === "done" ? "bg-emerald-500/50" : "bg-white/20"}`}
                                                                    initial={{ width: 0 }}
                                                                    animate={{ width: `${progress}%` }}
                                                                    transition={{ duration: 0.5, delay: 0.1 }}
                                                                />
                                                            </div>
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
}
