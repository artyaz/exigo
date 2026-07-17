"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { useState, useEffect, use, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, Loader2, CheckCircle2, Zap, BookOpen, FileText,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { CourseTutor } from "~/app/_components/learn/CourseTutor";
import { TestGrid } from "~/app/_components/tests/TestGrid";
import { TestGenerateButton } from "~/app/_components/tests/TestGenerateButton";
import { BaselinePhase } from "./BaselinePhase";
import { GeneratingPhase } from "./GeneratingPhase";
import { LessonPhase } from "./LessonPhase";
import { SummaryPhase } from "./SummaryPhase";

export default function CoursePage({ params }: { params: Promise<{ spaceId: string; courseId: string }> }) {
  const { userId } = useAuth();
  const { spaceId, courseId } = use(params);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedLessonId = searchParams.get("lessonId");
  const [focusModeEnabled, setFocusModeEnabled] = useState(false);

  const course = useQuery(api.courses.get, userId ? { courseId: courseId as Id<"courses"> } : "skip");
  const modules = useQuery(api.courseModules.getForCourse, userId ? { courseId: courseId as Id<"courses"> } : "skip");
  const lessons = useQuery(api.courseLessons.getForCourse, userId ? { courseId: courseId as Id<"courses"> } : "skip");

  // Determine which lesson/module to actually show.
  // By default, it's the user's active progress (`course.current...`).
  // But if there's a specific `?lessonId=...` requested in the URL, override it.
  const resolvedIndices = useMemo(() => {
    if (!course || !lessons || !modules) return null;
    
    if (requestedLessonId) {
      const requestedLesson = lessons.find(l => l._id === requestedLessonId);
      if (requestedLesson) {
        // Find which module this lesson belongs to
        const parentModule = modules.find(m => m._id === requestedLesson.moduleId);
        if (parentModule) {
          return {
            moduleIndex: parentModule.moduleIndex,
            lessonIndex: requestedLesson.lessonIndex,
          };
        }
      }
    }
    
    return {
      moduleIndex: course.currentModuleIndex,
      lessonIndex: course.currentLessonIndex,
    };
  }, [course, lessons, modules, requestedLessonId]);

  const activeModuleId = useMemo(() => {
    if (!modules || !resolvedIndices) return null;
    return modules.find((module) => module.moduleIndex === resolvedIndices.moduleIndex)?._id ?? null;
  }, [modules, resolvedIndices]);

  const activeLesson = useMemo(() => {
    if (!lessons || !resolvedIndices || !activeModuleId) return null;
    return lessons.find(
      (lesson) =>
        lesson.moduleId === activeModuleId
        && lesson.lessonIndex === resolvedIndices.lessonIndex,
    ) ?? null;
  }, [activeModuleId, lessons, resolvedIndices]);

  const spaceTests = useQuery(api.tests.getForSpace, userId ? { spaceId: spaceId as Id<"spaces"> } : "skip");
  const spaceQuestions = useQuery(api.questions.getForSpace, userId ? { spaceId: spaceId as Id<"spaces"> } : "skip");
  const pieces = useQuery(api.knowledgePieces.getForSpace, userId ? { spaceId: spaceId as Id<"spaces"> } : "skip");

  const [activeTab, setActiveTab] = useState<"lesson" | "summary" | "tests">("lesson");

  // Auto-switch to summary when lesson is summarized AND summary content exists
  useEffect(() => {
    if (
      (course?.phase === "lesson_summary" || course?.phase === "completed") &&
      activeLesson?.summaryMarkdown
    ) {
        setActiveTab("summary");
    } else if (course?.phase === "lesson") {
        setActiveTab("lesson");
    }
  }, [course?.phase, activeLesson?.summaryMarkdown]);

  const toggleFocusMode = useCallback(() => {
    setFocusModeEnabled((previousValue) => !previousValue);
  }, []);

  const returnToActiveLesson = useCallback(() => {
    if (!requestedLessonId) return;

    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.delete("lessonId");
    const nextQuery = nextSearchParams.toString();

    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  }, [pathname, requestedLessonId, router, searchParams]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key.toLowerCase() !== "f") {
        return;
      }

      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLInputElement
        || activeElement instanceof HTMLTextAreaElement
        || activeElement instanceof HTMLSelectElement
        || (activeElement instanceof HTMLElement && activeElement.isContentEditable)
      ) {
        return;
      }

      event.preventDefault();
      setFocusModeEnabled((previousValue) => !previousValue);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!userId || course === undefined) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-white/50" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-black text-white p-6 md:p-12">
        <div className="max-w-3xl mx-auto text-center py-20">
          <p className="text-secondary">Course not found.</p>
          <Link href={`/spaces/${spaceId}?tab=learn`} className="text-sm text-white/60 hover:text-white mt-4 inline-block">
            ← Back to space
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-12">
      <div className="max-w-[680px] mx-auto space-y-8">
        {/* Compact breadcrumb header */}
        {course.phase !== "baseline" && (
          <header className="flex items-center gap-3">
            <Link
              href={`/spaces/${spaceId}?tab=learn`}
              className="p-1.5 -ml-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 spring-interact"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <span className="text-[11px] font-[family-name:var(--font-geist-mono)] uppercase tracking-[0.15em] text-white/30">
              {course.refinedTitle}
            </span>
          </header>
        )}

        {/* Phase-specific content */}
        {course.phase === "baseline" && (
          <BaselinePhase courseId={courseId} courseTopic={course.refinedTitle} baselineResults={course.baselineResults} />
        )}

        {(course.phase === "module_generation" || course.phase === "module_complete") && (
          <GeneratingPhase courseId={courseId} phase={course.phase} />
        )}

        {(course.phase === "lesson" || course.phase === "lesson_summary") && lessons && modules && resolvedIndices && (
          <>
            {/* Tab navigation */}
            <div className="flex gap-4 border-b border-white/10 pb-3 mb-6 overflow-x-auto hide-scrollbar">
                <button
                    onClick={() => setActiveTab("lesson")}
                    className={`pb-2 font-medium text-sm transition-colors border-b-2 -mb-[13px] flex items-center gap-1.5 whitespace-nowrap ${activeTab === "lesson" ? "border-white text-primary" : "border-transparent text-secondary hover:text-primary"}`}
                >
                    <Zap className="w-3.5 h-3.5" /> Lesson Content
                </button>
                {course.phase === "lesson_summary" && (
                    <button
                        onClick={() => setActiveTab("summary")}
                        className={`pb-2 font-medium text-sm transition-colors border-b-2 -mb-[13px] flex items-center gap-1.5 whitespace-nowrap ${activeTab === "summary" ? "border-white text-primary" : "border-transparent text-secondary hover:text-primary"}`}
                    >
                        <BookOpen className="w-3.5 h-3.5" /> Summary
                    </button>
                )}
                <button
                    onClick={() => setActiveTab("tests")}
                    className={`pb-2 font-medium text-sm transition-colors border-b-2 -mb-[13px] flex items-center gap-1.5 whitespace-nowrap ${activeTab === "tests" ? "border-white text-primary" : "border-transparent text-secondary hover:text-primary"}`}
                >
                    <FileText className="w-3.5 h-3.5" /> Tests
                </button>
            </div>

            <AnimatePresence mode="wait">
              {activeTab === "lesson" ? (
                <motion.div
                  key="lesson-view"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                    <LessonPhase
                      key={`lesson-${requestedLessonId ?? `${resolvedIndices.moduleIndex}-${resolvedIndices.lessonIndex}`}`}
                      courseId={courseId}
                      spaceId={spaceId}
                      currentModuleIndex={resolvedIndices.moduleIndex}
                      currentLessonIndex={resolvedIndices.lessonIndex}
                      focusModeEnabled={focusModeEnabled}
                      onToggleFocusMode={toggleFocusMode}
                      onReturnToActiveLesson={returnToActiveLesson}
                      modules={modules}
                      lessons={lessons}
                    />
                </motion.div>
              ) : activeTab === "summary" ? (
                <motion.div
                  key="summary-view"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                    <SummaryPhase
                      key={`summary-${requestedLessonId ?? activeLesson?._id ?? `${resolvedIndices.moduleIndex}-${resolvedIndices.lessonIndex}`}`}
                      courseId={courseId}
                      currentLessonId={activeLesson?._id ?? null}
                      focusModeEnabled={focusModeEnabled}
                      onToggleFocusMode={toggleFocusMode}
                      onReturnToActiveLesson={returnToActiveLesson}
                      lessons={lessons}
                    />
                </motion.div>
              ) : (
                <motion.div
                  key="tests-view"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col gap-6"
                >
                  {activeLesson?.knowledgePieceId && pieces && spaceTests && spaceQuestions ? (
                    <>
                      <TestGenerateButton 
                        spaceId={spaceId} 
                        pieces={pieces} 
                        fixedTopicId={activeLesson.knowledgePieceId} 
                      />
                      <div className="border-t border-white/5 my-2" />
                      <p className="text-secondary text-sm">Tests specifically focused on this lesson knowledge.</p>
                      <TestGrid 
                        spaceTests={spaceTests.filter(t => t.knowledgePieceId === activeLesson.knowledgePieceId)} 
                        spaceQuestions={spaceQuestions} 
                      />
                    </>
                  ) : (
                    <div className="glass-card border-dashed rounded-2xl p-12 text-center flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 text-white/10 animate-spin" />
                        <p className="text-secondary text-sm">Waiting for lesson knowledge piece...</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {course.phase === "completed" && (
          <div className="text-center py-16 space-y-4">
            <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-400" />
            <h2 className="text-xl font-semibold text-primary">Course Completed!</h2>
            <p className="text-sm text-secondary">Check your Knowledge tab for all the generated study material.</p>
          </div>
        )}
      </div>

      {/* AI Tutor — available during lesson, summary, and completed phases */}
      {(course.phase === "lesson" || course.phase === "lesson_summary" || course.phase === "completed") && (
        <CourseTutor courseId={courseId as Id<"courses">} spaceId={spaceId as Id<"spaces">} />
      )}
    </div>
  );
}
