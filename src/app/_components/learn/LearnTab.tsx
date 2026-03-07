"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id, Doc } from "../../../../convex/_generated/dataModel";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Zap, ChevronRight, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { normalizeTopicAction, createCourseAction } from "../../actions/learn";

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
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [isNormalizing, setIsNormalizing] = useState(false);
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [rawTopic, setRawTopic] = useState("");
  const [refinedTitle, setRefinedTitle] = useState("");
  const [courseDescription, setCourseDescription] = useState("");

  const handleNormalize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setIsNormalizing(true);
    setError(null);

    try {
      const result = await normalizeTopicAction(topic.trim());
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRawTopic(topic.trim());
      setRefinedTitle(result.data.refinedTitle);
      setCourseDescription(result.data.courseDescription);
      setShowModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to normalize topic");
    } finally {
      setIsNormalizing(false);
    }
  };

  const handleCreateCourse = async () => {
    setIsCreatingCourse(true);
    setError(null);

    try {
      const result = await createCourseAction(spaceId, rawTopic, refinedTitle, courseDescription);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setShowModal(false);
      setTopic("");
      router.push(`/spaces/${spaceId}/learn/${result.data.courseId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create course");
    } finally {
      setIsCreatingCourse(false);
    }
  };

  const handleCancelModal = () => {
    setShowModal(false);
    setRawTopic("");
    setRefinedTitle("");
    setCourseDescription("");
    setError(null);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Create course form */}
      <form onSubmit={handleNormalize} className="flex gap-3">
        <input
          type="text"
          placeholder="What do you want to learn? E.g., React Server Components, Docker Networking..."
          className="flex-1 bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-sm text-primary placeholder:text-neutral-600 focus-ring spring-interact"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
        <button
          disabled={isNormalizing || !topic.trim()}
          type="submit"
          className="bg-white text-black font-medium px-5 py-3 rounded-xl spring-interact flex items-center gap-2 disabled:opacity-50 hover:opacity-90 text-sm"
        >
          {isNormalizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          <span className="hidden md:inline">Start Course</span>
        </button>
      </form>

      {error && !showModal && (
        <p className="text-sm text-red-500 font-medium">{error}</p>
      )}

      {/* Course creation modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/60"
            onClick={handleCancelModal}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="bg-neutral-950 border border-white/10 rounded-2xl p-6 w-full max-w-lg mx-4 space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-primary">Create Course</h2>
                <button
                  onClick={handleCancelModal}
                  className="text-neutral-500 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-secondary uppercase tracking-widest">
                    Course Title
                  </label>
                  <input
                    type="text"
                    value={refinedTitle}
                    onChange={(e) => setRefinedTitle(e.target.value)}
                    className="w-full bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-primary focus-ring"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-secondary uppercase tracking-widest">
                    Course Description
                  </label>
                  <textarea
                    value={courseDescription}
                    onChange={(e) => setCourseDescription(e.target.value)}
                    rows={4}
                    className="w-full bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-primary focus-ring resize-none"
                  />
                </div>
              </div>

              {error && showModal && (
                <p className="text-sm text-red-500 font-medium">{error}</p>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleCancelModal}
                  className="px-4 py-2 rounded-xl text-sm text-secondary hover:text-primary border border-white/10 hover:border-white/20 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateCourse}
                  disabled={isCreatingCourse || !refinedTitle.trim() || !courseDescription.trim()}
                  className="bg-white text-black font-medium px-5 py-2 rounded-xl text-sm flex items-center gap-2 disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  {isCreatingCourse && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Course
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
