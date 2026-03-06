"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id, Doc } from "../../../../convex/_generated/dataModel";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Zap, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { startCourseAction } from "../../actions/learn";

const PHASE_LABELS: Record<string, { label: string; color: string }> = {
  baseline: { label: "Baseline", color: "text-blue-400" },
  module_generation: { label: "Generating Module", color: "text-amber-400" },
  lesson: { label: "In Lesson", color: "text-emerald-400" },
  lesson_summary: { label: "Summarizing", color: "text-purple-400" },
  module_complete: { label: "Module Complete", color: "text-teal-400" },
  completed: { label: "Completed", color: "text-white/60" },
};

export function LearnTab({ spaceId, userId }: { spaceId: string; userId: string }) {
  const courses = useQuery(api.courses.getForSpace, { spaceId: spaceId as Id<"spaces"> });
  const [topic, setTopic] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setIsCreating(true);
    setError(null);

    try {
      const result = await startCourseAction(spaceId, topic.trim());
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setTopic("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create course");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Create course form */}
      <form onSubmit={handleCreate} className="flex gap-3">
        <input
          type="text"
          placeholder="What do you want to learn? E.g., React Server Components, Docker Networking..."
          className="flex-1 bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-sm text-primary placeholder:text-neutral-600 focus-ring spring-interact"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
        <button
          disabled={isCreating || !topic.trim()}
          type="submit"
          className="bg-white text-black font-medium px-5 py-3 rounded-xl spring-interact flex items-center gap-2 disabled:opacity-50 hover:opacity-90 text-sm"
        >
          {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          <span className="hidden md:inline">Start Course</span>
        </button>
      </form>

      {error && (
        <p className="text-sm text-red-500 font-medium">{error}</p>
      )}

      {/* Course list */}
      {!courses ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-white/30" />
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center p-12 space-y-4 text-neutral-500">
          <Zap className="w-12 h-12 mx-auto opacity-50" />
          <p className="text-lg">No courses yet.</p>
          <p className="text-sm text-secondary">Enter a topic above to start your first adaptive course.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence>
            {courses.map((course: Doc<"courses">) => {
              const phaseInfo = PHASE_LABELS[course.phase] ?? { label: course.phase, color: "text-white/50" };
              return (
                <Link href={`/spaces/${spaceId}/learn/${course._id}`} key={course._id}>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    className="group glass-card rounded-2xl p-6 cursor-pointer h-full flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-white/5 group-hover:bg-neutral-800 flex items-center justify-center transition-colors">
                          <Zap className="w-5 h-5 text-neutral-400 group-hover:text-white transition-colors" />
                        </div>
                        <span className={`text-[10px] font-mono uppercase tracking-widest ${phaseInfo.color}`}>
                          {phaseInfo.label}
                        </span>
                      </div>
                      <h3 className="text-base font-medium text-primary line-clamp-2">{course.refinedTitle}</h3>
                      <p className="text-xs text-secondary line-clamp-2">{course.courseDescription}</p>
                    </div>
                    <div className="mt-6 flex items-center justify-between text-tertiary group-hover:text-primary transition-colors">
                      <span className="text-xs font-medium uppercase tracking-widest">Continue</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </motion.div>
                </Link>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
