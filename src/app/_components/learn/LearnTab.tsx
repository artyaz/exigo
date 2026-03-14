"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Zap, ChevronRight, BookOpen, Play, CheckCircle2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { normalizeTopicAction, createCourseAction } from "../../actions/learn";

const PHASE_LABELS: Record<string, { label: string; color: string }> = {
  baseline: { label: "Baseline Test", color: "text-blue-400" },
  module_generation: { label: "Generating Module", color: "text-amber-400" },
  lesson: { label: "In Lesson", color: "text-emerald-400" },
  lesson_summary: { label: "Summarizing", color: "text-purple-400" },
  module_complete: { label: "Module Complete", color: "text-teal-400" },
  completed: { label: "Completed", color: "text-white/60" },
};

const LESSON_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Upcoming", color: "text-neutral-400", bg: "bg-neutral-500/10" },
  goals_set: { label: "Ready", color: "text-blue-400", bg: "bg-blue-500/10" },
  teaching: { label: "In Progress", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  completed: { label: "Completed", color: "text-amber-400", bg: "bg-amber-500/10" },
  summarized: { label: "Reviewed", color: "text-purple-400", bg: "bg-purple-500/10" },
  integrated: { label: "Done", color: "text-teal-400", bg: "bg-teal-500/10" },
};

export function LearnTab({ spaceId, userId: _userId, spaceName }: { spaceId: string; userId: string; spaceName: string }) {
  const courses = useQuery(api.courses.getForSpace, { spaceId: spaceId as Id<"spaces"> });
  const course = courses?.[0] ?? null;

  const modules = useQuery(
    api.courseModules.getForCourse,
    course ? { courseId: course._id } : "skip",
  );
  const lessons = useQuery(
    api.courseLessons.getForCourse,
    course ? { courseId: course._id } : "skip",
  );

  const router = useRouter();
  const [isNormalizing, setIsNormalizing] = useState(false);
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [rawTopic, setRawTopic] = useState("");
  const [refinedTitle, setRefinedTitle] = useState("");
  const [courseDescription, setCourseDescription] = useState("");

  const handleStartLearning = async () => {
    if (!spaceName.trim()) return;
    setIsNormalizing(true);
    setError(null);

    try {
      const result = await normalizeTopicAction(spaceName.trim());
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRawTopic(spaceName.trim());
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

  // Find the current lesson title for the continue banner
  const currentLesson = course && lessons
    ? lessons.find(
        (l) => l.lessonIndex === course.currentLessonIndex &&
          modules?.find((m) => m._id === l.moduleId)?.moduleIndex === course.currentModuleIndex,
      )
    : null;

  // Group lessons by module
  const modulesWithLessons = modules
    ? modules
        .slice()
        .sort((a, b) => a.moduleIndex - b.moduleIndex)
        .map((mod) => ({
          ...mod,
          lessons: (lessons ?? [])
            .filter((l) => l.moduleId === mod._id)
            .sort((a, b) => a.lessonIndex - b.lessonIndex),
        }))
    : null;

  return (
    <div className="flex flex-col gap-6">
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

      {/* Loading */}
      {!courses ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-white/30" />
        </div>
      ) : !course ? (
        /* Case A: No course exists — show start card */
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="flex flex-col items-center justify-center p-12 glass-card rounded-2xl space-y-5"
        >
          <div className="w-14 h-14 rounded-2xl bg-neutral-900 border border-white/5 flex items-center justify-center">
            <BookOpen className="w-7 h-7 text-neutral-400" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-lg font-medium text-primary">{spaceName || "Untitled Space"}</h3>
            <p className="text-sm text-secondary max-w-sm">
              Start an adaptive course based on this space. The AI will generate a personalized learning path.
            </p>
          </div>
          {error && !showModal && (
            <p className="text-sm text-red-500 font-medium">{error}</p>
          )}
          <button
            onClick={handleStartLearning}
            disabled={isNormalizing || !spaceName.trim()}
            className="bg-white text-black font-medium px-6 py-3 rounded-xl spring-interact flex items-center gap-2 disabled:opacity-50 hover:opacity-90 text-sm"
          >
            {isNormalizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Start Learning
          </button>
        </motion.div>
      ) : (
        /* Case B: Course exists — continue banner + module/lesson list */
        <div className="flex flex-col gap-5">
          {/* Continue banner */}
          <Link href={`/spaces/${spaceId}/learn/${course._id}`}>
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="group glass-card rounded-2xl p-5 cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-white/5 group-hover:bg-neutral-800 flex items-center justify-center shrink-0 transition-colors">
                  <Zap className="w-5 h-5 text-neutral-400 group-hover:text-white transition-colors" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-primary truncate">
                    {currentLesson?.title ?? course.refinedTitle}
                  </p>
                  <span className={`text-[10px] font-mono uppercase tracking-widest ${(PHASE_LABELS[course.phase] ?? { color: "text-white/50" }).color}`}>
                    {(PHASE_LABELS[course.phase] ?? { label: course.phase }).label}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-tertiary group-hover:text-primary transition-colors shrink-0">
                <span className="text-xs font-medium uppercase tracking-widest hidden sm:inline">Continue</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </motion.div>
          </Link>

          {/* Module/Lesson list */}
          {modulesWithLessons && modulesWithLessons.length > 0 && (
            <div className="flex flex-col gap-4">
              {modulesWithLessons.map((mod, mi) => (
                <motion.div
                  key={mod._id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25, delay: mi * 0.05 }}
                >
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-secondary">
                      Module {mod.moduleIndex + 1}
                    </span>
                    <span className="text-xs font-medium text-primary truncate">{mod.moduleTitle}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {mod.lessons.map((lesson) => {
                      const status = LESSON_STATUS[lesson.status] ?? { label: lesson.status, color: "text-white/50", bg: "bg-white/5" };
                      return (
                        <Link
                          key={lesson._id}
                          href={`/spaces/${spaceId}/learn/${course._id}?lessonId=${lesson._id}`}
                        >
                          <motion.div
                            whileHover={{ x: 4 }}
                            transition={{ type: "spring", stiffness: 400, damping: 25 }}
                            className="group flex items-center justify-between gap-3 px-4 py-3 rounded-xl hover:bg-white/[0.03] transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {lesson.status === "completed" || lesson.status === "summarized" || lesson.status === "integrated" ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              ) : lesson.status === "teaching" ? (
                                <Play className="w-4 h-4 text-emerald-400 shrink-0" />
                              ) : (
                                <BookOpen className="w-4 h-4 text-neutral-600 shrink-0" />
                              )}
                              <div className="min-w-0">
                                <p className="text-sm text-primary truncate">{lesson.title}</p>
                                <p className="text-[11px] text-tertiary truncate">{lesson.focusArea}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-md ${status.color} ${status.bg}`}>
                                {status.label}
                              </span>
                              <ChevronRight className="w-3.5 h-3.5 text-neutral-700 group-hover:text-neutral-400 transition-colors" />
                            </div>
                          </motion.div>
                        </Link>
                      );
                    })}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
