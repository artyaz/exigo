"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, FileText } from "lucide-react";
import type { Doc } from "../../../../convex/_generated/dataModel";
import {
  TestStackCard,
  formatTestTypeLabel,
  getProgressStatus,
} from "./TestStackCard";

interface TestGridProps {
  spaceTests: Doc<"tests">[] | undefined;
  spaceQuestions: Doc<"questions">[] | undefined;
}

export function TestGrid({ spaceTests, spaceQuestions }: TestGridProps) {
  const [sortBy, setSortBy] = useState<
    "date" | "status" | "questions" | "performance"
  >("date");
  const [sortDesc, setSortDesc] = useState(true);
  const [filterStatus, setFilterStatus] = useState<
    "all" | "done" | "in_progress" | "new"
  >("all");
  const [filterTopic, setFilterTopic] = useState<string>("all");

  if (!spaceTests || spaceTests.length === 0) {
    return (
      <div className="glass-card border-dashed rounded-2xl p-12 text-center flex flex-col items-center gap-3">
        <FileText className="w-8 h-8 text-white/10" />
        <p className="text-secondary text-sm">No tests match your filters.</p>
      </div>
    );
  }

  const enriched = spaceTests.map((test) => {
    const testQuestions =
      spaceQuestions?.filter((q) => q.testId === test._id) ?? [];
    const answeredCount = testQuestions.filter((q) => q.userAnswer).length;
    const target = test.config?.questionCount ?? 5;
    const correctCount = testQuestions.filter((q) => q.isCorrect === true)
      .length;
    const progressStatus = getProgressStatus(answeredCount, target);
    const performance =
      answeredCount > 0 ? correctCount / answeredCount : -1;
    return {
      ...test,
      testQuestions,
      answeredCount,
      target,
      progressStatus,
      performance,
      topicLabel: test.topicTitle ?? "—",
    };
  });

  const uniqueTopics = [
    ...new Set(enriched.map((t) => t.topicLabel)),
  ].sort((a, b) => a.localeCompare(b));

  let filtered = enriched;
  if (filterStatus !== "all") {
    filtered = filtered.filter((t) => t.progressStatus === filterStatus);
  }
  if (filterTopic !== "all") {
    filtered = filtered.filter((t) => t.topicLabel === filterTopic);
  }

  const sorted = [...filtered];
  if (sortBy === "date") {
    sorted.sort((a, b) => b._creationTime - a._creationTime);
  } else if (sortBy === "status") {
    const order: Record<"done" | "in_progress" | "new", number> = {
      done: 0,
      in_progress: 1,
      new: 2,
    };
    sorted.sort(
      (a, b) => order[a.progressStatus] - order[b.progressStatus],
    );
  } else if (sortBy === "questions") {
    sorted.sort((a, b) => b.testQuestions.length - a.testQuestions.length);
  } else if (sortBy === "performance") {
    sorted.sort((a, b) => b.performance - a.performance);
  }
  if (!sortDesc) {
    sorted.reverse();
  }

  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
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

  const getGroup = (t: (typeof sorted)[0]) => {
    if (sortBy === "date") return getDateGroup(t._creationTime);
    if (sortBy === "status") return getStatusGroup(t.progressStatus);
    if (sortBy === "performance") return getPerformanceGroup(t.performance);
    if (sortBy === "questions") return `${t.testQuestions.length} questions`;
    return "";
  };

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
        <div className="flex items-center gap-1 text-[10px] text-white/30 mr-1">
          <span className="font-semibold uppercase tracking-widest">Sort</span>
        </div>
        {(
          ["date", "status", "questions", "performance"] as const
        ).map((s) => (
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
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium spring-interact transition-colors flex items-center gap-1 ${
              sortBy === s
                ? "bg-white/10 text-white border border-white/15"
                : "text-white/30 hover:text-white/60 hover:bg-white/5 border border-transparent"
            }`}
          >
            {s === "date"
              ? "Date"
              : s === "status"
                ? "Status"
                : s === "questions"
                  ? "Questions"
                  : "Performance"}
            {sortBy === s &&
              (sortDesc ? (
                <ArrowDown className="w-3 h-3" />
              ) : (
                <ArrowUp className="w-3 h-3" />
              ))}
          </button>
        ))}

        <div className="w-px h-4 bg-white/10 mx-1" />

        <div className="flex items-center gap-1 text-[10px] text-white/30 mr-1">
          <span className="font-semibold uppercase tracking-widest">
            Filter
          </span>
        </div>
        <select
          value={filterStatus}
          onChange={(e) =>
            setFilterStatus(e.target.value as typeof filterStatus)
          }
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
            onChange={(e) => setFilterTopic(e.target.value)}
            className="bg-transparent border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white/50 spring-interact hover:border-white/20 focus:outline-none cursor-pointer max-w-[150px] truncate"
          >
            <option value="all">All Topics</option>
            {uniqueTopics.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}

        <span className="text-[10px] font-mono text-white/15 ml-auto">
          {filtered.length} test{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card border-dashed rounded-2xl p-12 text-center flex flex-col items-center gap-3">
          <FileText className="w-8 h-8 text-white/10" />
          <p className="text-secondary text-sm">No tests match your filters.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group, gi) => (
            <div key={group.label}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/25 shrink-0">
                  {group.label}
                </span>
                <div className="flex-1 h-px bg-white/[0.06]" />
                <span className="text-[10px] font-mono text-white/15 shrink-0">
                  {group.items.length}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-8">
                {group.items.map((test, index) => (
                  <TestStackCard
                    key={test._id}
                    id={test._id}
                    href={`/tests/${test._id}`}
                    stackDepth={Math.max(test.testQuestions.length, 1)}
                    status={test.progressStatus}
                    typeLabel={formatTestTypeLabel(test.config?.type)}
                    title={test.topicLabel}
                    answered={test.answeredCount}
                    target={test.target}
                    animationDelay={(gi * 3 + index) * 0.02}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
