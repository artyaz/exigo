"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { useState, useEffect, useLayoutEffect, useRef, use, useCallback, useMemo, type RefObject } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Loader2, CheckCircle2, ChevronRight, ChevronLeft,
  CornerDownLeft, XCircle, SkipForward, Zap, BookOpen
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  generateBaselineQuestionAction,
  evaluateBaselineAnswerAction,
  submitBaselineAction,
  advanceCourseAction,
  verifyInputAction,
  completeLessonAction,
  summarizeLessonAction,
} from "../../../../actions/learn";
import { createFeelsHardNodeAction } from "../../../../actions/knowledge";
import { LessonMarkdown } from "~/app/_components/learn/LessonMarkdown";
import { SelectionBubble } from "~/app/_components/learn/SelectionBubble";
import { ClarificationThread, type ClarificationMessage } from "~/app/_components/learn/ClarificationThread";
import { TestGrid } from "~/app/_components/tests/TestGrid";
import { TestGenerateButton } from "~/app/_components/tests/TestGenerateButton";
import { FileText, Target } from "lucide-react";

/* ─── Lesson section parser ─── */
interface LessonSection {
  content: string;
  inputRequest?: {
    type: string;
    question: string;
    expectedAnswer: string;
  };
}

function parseLessonSections(fullText: string): LessonSection[] {
  const sections: LessonSection[] = [];
  const inputRegex = /\[INPUT_REQUEST:\s*([^|\]]+?)\s*\|\s*([^|\]]+?)\s*(?:\|\s*([^\]]*?))?\s*\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inputRegex.exec(fullText)) !== null) {
    const content = fullText.slice(lastIndex, match.index).trim();
    sections.push({
      content,
      inputRequest: {
        type: match[1]!.trim(),
        question: match[2]!.trim(),
        expectedAnswer: match[3]?.trim() ?? "",
      },
    });
    lastIndex = match.index + match[0].length;
  }

  // Remaining content after last INPUT_REQUEST
  const remaining = fullText.slice(lastIndex).trim();
  if (remaining) {
    sections.push({ content: remaining });
  }

  return sections;
}



function useActiveFocusTargets({
  containerRef,
  enabled,
  contentVersion,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  enabled: boolean;
  contentVersion: string;
}) {
  const [activeFocusTargets, setActiveFocusTargets] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) {
      setActiveFocusTargets(new Set());
      return;
    }

    const container = containerRef.current;
    if (!container) {
      setActiveFocusTargets(new Set());
      return;
    }

    let animationFrameId = 0;

    const updateActiveTargets = () => {
      animationFrameId = 0;

      const focusTargets = Array.from(
        container.querySelectorAll<HTMLElement>("[data-focus-target]")
      );

      if (focusTargets.length === 0) {
        setActiveFocusTargets(new Set());
        return;
      }

      // Collect elements in the focus band (generous viewport region)
      const bandTop = window.innerHeight * 0.15;
      const bandBottom = window.innerHeight * 0.75;
      const anchor = window.innerHeight * 0.34;

      const scored = focusTargets
        .map((target) => {
          const rect = target.getBoundingClientRect();
          const mid = rect.top + rect.height / 2;
          const inBand = rect.bottom >= bandTop && rect.top <= bandBottom;
          return { id: target.dataset.focusTarget!, distance: Math.abs(mid - anchor), inBand };
        })
        .filter((s) => s.inBand);

      // Pick closest elements — up to 5, or all within 200px of best
      scored.sort((a, b) => a.distance - b.distance);
      const threshold = scored.length > 0 ? scored[0]!.distance + 200 : 0;
      const active = new Set(
        scored.filter((s) => s.distance <= threshold).slice(0, 5).map((s) => s.id)
      );

      setActiveFocusTargets(active);
    };

    const scheduleUpdate = () => {
      if (animationFrameId !== 0) return;
      animationFrameId = window.requestAnimationFrame(updateActiveTargets);
    };

    scheduleUpdate();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      if (animationFrameId !== 0) window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [containerRef, contentVersion, enabled]);

  return activeFocusTargets;
}

function FocusModeToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={enabled}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-[family-name:var(--font-geist-mono)] uppercase tracking-[0.12em] transition-all ${enabled
        ? "border-cyan-400/40 bg-cyan-400/12 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.08)]"
        : "border-white/10 bg-white/[0.03] text-white/45 hover:border-white/20 hover:text-white/70"
        }`}
      title="Toggle focus mode (F)"
    >
      <span>{enabled ? "Focus On" : "Focus Off"}</span>
      <kbd className="rounded-md border border-current/20 bg-black/30 px-1.5 py-0.5 text-[10px] tracking-[0.08em]">
        F
      </kbd>
    </button>
  );
}

export default function CoursePage({ params }: { params: Promise<{ spaceId: string; courseId: string }> }) {
  const { userId } = useAuth();
  const { spaceId, courseId } = use(params);
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

  const activeLesson = useMemo(() => {
    if (!lessons || !resolvedIndices) return null;
    return lessons[resolvedIndices.lessonIndex] ?? null;
  }, [lessons, resolvedIndices]);

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
                      courseId={courseId}
                      spaceId={spaceId}
                      currentModuleIndex={resolvedIndices.moduleIndex}
                      currentLessonIndex={resolvedIndices.lessonIndex}
                      focusModeEnabled={focusModeEnabled}
                      onToggleFocusMode={toggleFocusMode}
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
                      courseId={courseId}
                      currentLessonIndex={resolvedIndices.lessonIndex}
                      focusModeEnabled={focusModeEnabled}
                      onToggleFocusMode={toggleFocusMode}
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
                      <p className="text-secondary text-sm">Tests specifically focused on this lesson's knowledge.</p>
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
    </div>
  );
}

// ─── Baseline Phase ───
function BaselinePhase({ courseId, courseTopic, baselineResults }: { courseId: string; courseTopic: string; baselineResults?: string }) {
  const SPRING_SNAPPY = { type: "spring" as const, stiffness: 500, damping: 30 };
  const STACK_VISIBLE = 3;

  function cardHash(id: string, seed: number) {
    let h = seed;
    for (let i = 0; i < id.length; i++) h = Math.trunc(((h << 5) - h + (id.codePointAt(i) ?? 0)));
    return h;
  }

  const [questions, setQuestions] = useState<Array<{
    id: string;
    question_text: string;
    reference_answer: string;
    concept_tag: string;
    userAnswer?: string;
    isCorrect?: boolean;
    feedback?: string;
  }>>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const arenaRef = useRef<HTMLDivElement>(null);
  const isGeneratingRef = useRef(false);
  const [arenaW, setArenaW] = useState(800);
  const [arenaH, setArenaH] = useState(600);

  useEffect(() => {
    if (baselineResults) {
      void advanceCourseAction(courseId).catch((advanceError: unknown) => {
        setError(advanceError instanceof Error ? advanceError.message : "Failed to advance baseline");
      });
    }
  }, [baselineResults, courseId]);

  useEffect(() => {
    if (!arenaRef.current) return;
    const ro = new ResizeObserver(entries => {
      if (!entries?.[0]) return;
      const { width, height } = entries[0].contentRect;
      setArenaW(width);
      setArenaH(height);
    });
    ro.observe(arenaRef.current);
    return () => ro.disconnect();
  }, []);

  const generateNextQuestion = useCallback(async (prevQuestions: typeof questions) => {
    const step = prevQuestions.length + 1;
    if (step > 5) return;
    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;

    setIsLoading(true);
    setError(null);
    try {
      // Build previous results from answered questions for adaptive difficulty
      const previousResults = prevQuestions
        .filter(q => q.userAnswer !== undefined)
        .map(q => ({
          question: q.question_text,
          isCorrect: q.isCorrect ?? false,
          feedback: q.feedback,
        }));

      // Include concept tags alongside question text for stronger deduplication
      const prevQuestionsWithConcepts = prevQuestions.map(
        q => `[${q.concept_tag}] ${q.question_text}`,
      );

      const result = await generateBaselineQuestionAction(
        courseId, courseTopic, step,
        prevQuestionsWithConcepts,
        previousResults.length > 0 ? previousResults : undefined,
      );
      if (!result.ok) { setError(result.error); return; }

      const newQ = {
        id: `baseline-${step}-${Math.random().toString(36).slice(2, 8)}`,
        question_text: result.data.question_text,
        reference_answer: result.data.reference_answer,
        concept_tag: result.data.concept_tag,
      };
      setQuestions(prev => [...prev, newQ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate question");
    } finally {
      isGeneratingRef.current = false;
      setIsLoading(false);
    }
  }, [courseId, courseTopic]);

  useEffect(() => {
    void generateNextQuestion([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pre-generate next question as soon as current one finishes
  useEffect(() => {
    if (questions.length > 0 && questions.length < 5 && !isLoading) {
      void generateNextQuestion(questions);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions.length, isLoading]);

  if (baselineResults) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-white/30" />
        <p className="text-sm text-secondary">Loading your course...</p>
      </div>
    );
  }

  const handleAnswer = async (questionId: string, answer: string) => {
    if (!answer.trim()) return;
    const q = questions.find(qu => qu.id === questionId);
    if (!q) return;

    setIsEvaluating(true);
    try {
      const evalResult = await evaluateBaselineAnswerAction(
        courseId, q.question_text, q.reference_answer, answer
      );

      setQuestions(prev => prev.map(qu =>
        qu.id === questionId
          ? { ...qu, userAnswer: answer, isCorrect: evalResult.ok ? evalResult.data.is_correct : undefined, feedback: evalResult.ok ? evalResult.data.feedback : undefined }
          : qu
      ));

      setTimeout(() => {
        if (currentIndex < 4) {
          setCurrentIndex(prev => prev + 1);
        }
      }, 800);

      // Pre-gen effect handles generating next question — no explicit call needed
    } catch (err) {
      setError(err instanceof Error ? err.message : "Evaluation failed");
    } finally {
      setIsEvaluating(false);
    }
  };

  // Submit when all 5 questions are answered
  useEffect(() => {
    const answeredCount = questions.filter(qu => qu.userAnswer).length;
    if (answeredCount < 5 || isSubmitting) return;

    setIsSubmitting(true);
    const submit = async () => {
      try {
        const baselineData = JSON.stringify(questions.map(qu => ({
          step: parseInt(qu.id.split('-')[1]!),
          question: qu.question_text,
          answer: qu.userAnswer,
          isCorrect: qu.isCorrect ?? false,
        })));
        await submitBaselineAction(courseId, baselineData);
        await advanceCourseAction(courseId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to submit baseline");
      } finally {
        setIsSubmitting(false);
      }
    };
    void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions]);

  return (
    <div className="h-[calc(100vh-12rem)] flex flex-col">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between pb-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-white/90">
            Question {currentIndex + 1}
          </span>
          <span className="text-white/20">/</span>
          <span className="text-sm text-white/40">5</span>
          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1.5 ml-2">
              <Loader2 className="w-3 h-3 animate-spin text-white/30" />
              <span className="text-[10px] text-white/30 uppercase tracking-widest">Generating</span>
            </motion.div>
          )}
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => {
            const q = questions[i];
            const isCurrentlyGenerating = isLoading && i === questions.length;

            if (isCurrentlyGenerating) {
              return (
                <motion.div key={`${i}-gen`} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} className="w-3 h-3 flex items-center justify-center">
                  <motion.div className="w-2 h-2 rounded-full border border-white/30 border-t-white/70" animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }} />
                </motion.div>
              );
            }

            return (
              <motion.div
                key={`${i}-dot`}
                className="h-1 rounded-full"
                animate={{
                  width: i === currentIndex ? 20 : 8,
                  backgroundColor: q?.userAnswer
                    ? q.isCorrect === true ? "rgba(74, 222, 128, 0.7)" : q.isCorrect === false ? "rgba(248, 113, 113, 0.7)" : "rgba(255, 255, 255, 0.4)"
                    : i === currentIndex ? "rgba(255, 255, 255, 0.6)" : i < questions.length ? "rgba(255, 255, 255, 0.15)" : "rgba(255, 255, 255, 0.06)",
                }}
                transition={SPRING_SNAPPY}
              />
            );
          })}
        </div>
      </header>

      {isSubmitting ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-white/30" />
          <p className="text-sm text-secondary">Analyzing results & generating your syllabus...</p>
        </div>
      ) : (
        /* Card arena */
        <div className="flex-1 relative min-w-0 overflow-hidden" ref={arenaRef}>
          {questions.map((q, idx) => {
            const isActive = idx === currentIndex;
            const offset = idx - currentIndex;
            const isLeft = offset < 0;
            const absOffset = Math.abs(offset);

            if (!isActive && absOffset > STACK_VISIBLE) return null;

            const depth = Math.max(0, absOffset - 1);
            const rot = isActive ? 0 : ((cardHash(q.id, isLeft ? 1 : 3) % 9) - 4) * 1.0;
            const yOff = isActive ? 0 : ((cardHash(q.id, isLeft ? 2 : 4) % 7) - 3) * 4;

            const stackX = isLeft
              ? -(arenaW / 2 - 90) + depth * -16
              : (arenaW / 2 - 90) + depth * 16;

            const activeW = Math.min(arenaW - 48, 672);
            const activeH = arenaH - 48;

            return (
              <motion.div
                key={q.id}
                animate={{
                  width: isActive ? activeW : 130,
                  height: isActive ? activeH : 170,
                  x: isActive ? -activeW / 2 : stackX - 65,
                  y: isActive ? -activeH / 2 : yOff - 85,
                  rotate: rot,
                  scale: isActive ? 1 : (1 - depth * 0.06),
                  opacity: isActive ? 1 : ((isLeft ? 0.7 : 0.6) - depth * 0.15),
                  zIndex: isActive ? 50 : (STACK_VISIBLE - depth + 1),
                }}
                transition={{
                  x: SPRING_SNAPPY, y: SPRING_SNAPPY, scale: SPRING_SNAPPY,
                  rotate: SPRING_SNAPPY, opacity: SPRING_SNAPPY,
                  width: { duration: 0 }, height: { duration: 0 }, zIndex: { duration: 0 },
                }}
                className={`absolute rounded-2xl border overflow-hidden ${isActive
                  ? 'border-white/[0.08] bg-[#0A0A0A] shadow-[0_4px_24px_rgba(0,0,0,0.5)]'
                  : 'border-white/[0.08] bg-[#0D0D0D] shadow-[0_2px_12px_rgba(0,0,0,0.4)] cursor-pointer hover:bg-white/[0.04]'
                  }`}
                style={{ top: '50%', left: '50%' }}
                onClick={!isActive ? () => setCurrentIndex(idx) : undefined}
              >
                {/* Stack preview */}
                <motion.div
                  animate={{ opacity: isActive ? 0 : 1 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 p-3 flex flex-col gap-2 overflow-hidden"
                  style={{ zIndex: isActive ? 0 : 1, pointerEvents: 'none' }}
                >
                  <p className="text-[9px] text-white/40 uppercase tracking-widest font-semibold">Q{idx + 1}</p>
                  <p className="text-[10px] text-white/30 line-clamp-5 leading-relaxed flex-1">{q.question_text}</p>
                  {isLeft && q.userAnswer && (
                    <div className="flex items-center gap-1">
                      {q.isCorrect === true && <CheckCircle2 className="w-3 h-3 text-green-400/60" />}
                      {q.isCorrect === false && <XCircle className="w-3 h-3 text-red-400/60" />}
                    </div>
                  )}
                </motion.div>

                {/* Full card content */}
                <motion.div
                  animate={{ opacity: isActive ? 1 : 0 }}
                  transition={{ duration: 0.2, delay: isActive ? 0.12 : 0 }}
                  className="absolute inset-0 flex flex-col"
                  style={{ zIndex: isActive ? 1 : 0, pointerEvents: isActive ? 'auto' : 'none', minWidth: activeW, minHeight: activeH }}
                >
                  <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
                    <div className="shrink-0 px-8 pt-7 pb-5 border-b border-white/[0.04]">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-semibold">
                          Question {idx + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          {q.isCorrect === true && (
                            <div className="flex items-center gap-1.5 text-green-400 bg-green-400/10 px-2.5 py-1 rounded-md text-[10px] font-semibold border border-green-400/20">
                              <CheckCircle2 className="w-3 h-3" /> Correct
                            </div>
                          )}
                          {q.isCorrect === false && (
                            <div className="flex items-center gap-1.5 text-red-400 bg-red-400/10 px-2.5 py-1 rounded-md text-[10px] font-semibold border border-red-400/20">
                              <XCircle className="w-3 h-3" /> Incorrect
                            </div>
                          )}
                          {isEvaluating && idx === currentIndex && <Loader2 className="w-3.5 h-3.5 animate-spin text-white/30" />}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-secondary block mb-2">{q.concept_tag}</span>
                      <h2 className="text-lg md:text-xl font-semibold leading-relaxed text-white tracking-tight">{q.question_text}</h2>
                    </div>

                    <div className="flex-1 flex flex-col px-8 py-6">
                      {q.userAnswer ? (
                        <div className="space-y-4">
                          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                            <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold mb-2">Your Answer</p>
                            <p className="text-sm text-white/80 leading-relaxed">{q.userAnswer}</p>
                          </div>
                          {q.feedback && (
                            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                              <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold mb-2">AI Feedback</p>
                              <p className="text-sm text-white/70 leading-relaxed">{q.feedback}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col gap-3">
                          <textarea
                            id={`baseline-answer-${q.id}`}
                            placeholder="Type your answer..."
                            className="flex-1 w-full bg-white/[0.02] border border-white/[0.08] rounded-xl p-4 resize-none focus:outline-none focus:border-white/20 text-sm text-white placeholder:text-white/20 transition-colors min-h-[120px]"
                            onKeyDown={(e) => {
                              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                                e.preventDefault();
                                const el = e.currentTarget;
                                if (el.value.trim()) void handleAnswer(q.id, el.value);
                              }
                            }}
                          />
                          <button
                            onClick={() => {
                              const el = document.getElementById(`baseline-answer-${q.id}`) as HTMLTextAreaElement;
                              if (el?.value.trim()) void handleAnswer(q.id, el.value);
                            }}
                            disabled={isEvaluating}
                            className="self-end px-5 py-2.5 rounded-xl bg-white/10 border border-white/[0.08] text-white text-sm font-medium hover:bg-white/15 spring-interact flex items-center gap-2 disabled:opacity-50"
                          >
                            Submit <kbd className="hidden md:inline-flex px-1.5 py-0.5 bg-white/10 rounded text-[10px] font-mono text-white/40 border border-white/[0.06]">⌘↵</kbd>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card footer removed — navigation is now outside card arena */}
                </motion.div>
              </motion.div>
            );
          })}

          {/* Generating placeholder card */}
          {isLoading && questions.length < 5 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{
                opacity: 0.2,
                x: (arenaW / 2 - 90) + Math.min(questions.length - currentIndex - 1, STACK_VISIBLE) * 16 - 65,
                y: -85,
                rotate: 2,
                scale: 1 - Math.min(questions.length - currentIndex, STACK_VISIBLE) * 0.06,
              }}
              transition={SPRING_SNAPPY}
              className="absolute top-1/2 left-1/2 w-[130px] h-[170px] rounded-2xl border border-dashed border-white/10 bg-[#0D0D0D] flex items-center justify-center"
            >
              <Loader2 className="w-4 h-4 animate-spin text-white/20" />
            </motion.div>
          )}
        </div>
      )}

      {/* Card navigation footer — always stable, outside the card arena */}
      {!isSubmitting && questions.length > 0 && (
        <div className="shrink-0 px-8 py-3 border-t border-white/[0.04] flex items-center justify-between">
          <button onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))} disabled={currentIndex === 0}
            className="flex items-center gap-2 text-white/40 hover:text-white/80 disabled:text-white/10 text-xs font-medium spring-interact disabled:pointer-events-none">
            <ChevronLeft className="w-3.5 h-3.5" /><span className="hidden md:inline">Prev</span>
          </button>
          <div className="flex items-center gap-1">
            {questions.map((_, i) => (
              <button key={i} onClick={() => setCurrentIndex(i)}
                className={`w-1.5 h-1.5 rounded-full transition-all spring-interact ${i === currentIndex ? 'bg-white/80 w-3' : i < currentIndex ? 'bg-white/25' : 'bg-white/10'}`} />
            ))}
          </div>
          <button onClick={() => setCurrentIndex(Math.min(questions.length - 1, currentIndex + 1))} disabled={currentIndex >= questions.length - 1}
            className="flex items-center gap-2 text-white/40 hover:text-white/80 disabled:text-white/10 text-xs font-medium spring-interact disabled:pointer-events-none">
            <span className="hidden md:inline">Next</span><ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-500 pt-2">{error}</p>}
    </div>
  );
}

// ─── Generating Phase ───
function GeneratingPhase({ courseId, phase }: { courseId: string; phase: string }) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const advance = async () => {
      try {
        await advanceCourseAction(courseId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to advance");
      }
    };
    void advance();
  }, [courseId]);

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      {error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : (
        <>
          <Loader2 className="w-10 h-10 animate-spin text-white/30" />
          <p className="text-sm text-secondary">
            {phase === "module_generation" ? "Building your personalized module..." : "Preparing next module..."}
          </p>
        </>
      )}
    </div>
  );
}

// ─── Lesson Phase ───
function LessonPhase({
  courseId,
  spaceId,
  currentModuleIndex,
  currentLessonIndex,
  focusModeEnabled,
  onToggleFocusMode,
  modules,
  lessons,
}: {
  courseId: string;
  spaceId: string;
  currentModuleIndex: number;
  currentLessonIndex: number;
  focusModeEnabled: boolean;
  onToggleFocusMode: () => void;
  modules: Array<{ _id: string; moduleIndex: number; moduleTitle: string; subTopics: string }>;
  lessons: Array<{ _id: string; moduleId: string; lessonIndex: number; title: string; focusArea: string; status: string; masteryGoals?: string; knowledgePieceId?: string }>;
}) {
  const currentModule = modules.find((m) => m.moduleIndex === currentModuleIndex);
  const moduleLessons = lessons
    .filter((l) => l.moduleId === currentModule?._id)
    .sort((a, b) => a.lessonIndex - b.lessonIndex);
  const currentLesson = moduleLessons[currentLessonIndex];

  // Full streamed text from AI
  const [fullText, setFullText] = useState("");
  const [isTeaching, setIsTeaching] = useState(false);
  // Progressive reveal: how many sections to show
  const [revealedCount, setRevealedCount] = useState(0);
  // Current input request state for retry flow
  const [currentInputRequest, setCurrentInputRequest] = useState<{
    type: string;
    question: string;
    expectedAnswer: string;
  } | null>(null);
  const [userInput, setUserInput] = useState("");
  const [lastVerification, setLastVerification] = useState<{
    is_correct: boolean;
    feedback_block: string;
  } | null>(null);
  // Track answered/skipped checkpoints: sectionIndex → { answer?, skipped?, verification? }
  const [answeredCheckpoints, setAnsweredCheckpoints] = useState<Map<number, {
    answer?: string;
    skipped?: boolean;
    verification?: { is_correct: boolean; feedback_block: string };
  }>>(new Map());
  const [isLessonComplete, setIsLessonComplete] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isAdvancingCourse, setIsAdvancingCourse] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // ─── Clarification state ───
  const [selectionState, setSelectionState] = useState<{
    quote: string;
    position: { top: number; left: number };
    sectionIndex: number;
    blockIndex: number;
    /** If set, submission should reply to this thread instead of creating a new one */
    replyThreadId?: string;
  } | null>(null);
  const [clarificationThreads, setClarificationThreads] = useState<Map<string, {
    quote: string;
    threadId: string;
    sectionIndex: number;
    blockIndex: number;
    messages: ClarificationMessage[];
    streamingText?: string;
    isLoading: boolean;
    isExpanded: boolean;
  }>>(new Map());

  const lessonContentRef = useRef<HTMLDivElement>(null);
  const contentEndRef = useRef<HTMLDivElement>(null);

  // ─── "Feels Hard" context menu ───
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    selectedText: string;
  } | null>(null);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const container = lessonContentRef.current;
      if (!container) return;
      if (!container.contains(e.target as Node)) {
        setContextMenu(null);
        return;
      }

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;
      const selectedText = selection.toString().trim();
      if (selectedText.length < 3) return;

      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, selectedText });
    };

    const handleClick = () => setContextMenu(null);

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("click", handleClick);
    };
  }, []);

  const handleFeelsHard = useCallback(async (text: string) => {
    setContextMenu(null);
    const lesson = moduleLessons[currentLessonIndex];
    if (!lesson?.knowledgePieceId) return;

    try {
      await createFeelsHardNodeAction(
        spaceId,
        lesson.knowledgePieceId,
        `Feels hard: "${text.slice(0, 200)}"`,
      );
      setFeelsHardFeedback("Marked as hard — we'll focus on this! 💪");
      setTimeout(() => setFeelsHardFeedback(null), 2000);
    } catch {
      setFeelsHardFeedback("Failed to save, try again.");
      setTimeout(() => setFeelsHardFeedback(null), 2000);
    }
  }, [spaceId, moduleLessons, currentLessonIndex]);

  const [feelsHardFeedback, setFeelsHardFeedback] = useState<string | null>(null);

  const lessonMessages = useQuery(
    api.courseLessonMessages.getForLesson,
    currentLesson ? { lessonId: currentLesson._id as Id<"courseLessons"> } : "skip"
  );

  // Parse sections from accumulated text
  const sections = useMemo(() => parseLessonSections(fullText), [fullText]);
  const totalSections = sections.length;
  const hasLessonCompleteMarker = fullText.includes("[LESSON_COMPLETE]");
  const focusContentVersion = `${revealedCount}:${fullText.length}:${currentInputRequest?.question ?? ""}:${lastVerification?.feedback_block ?? ""}`;
  const activeFocusTargets = useActiveFocusTargets({
    containerRef: lessonContentRef,
    enabled: focusModeEnabled,
    contentVersion: focusContentVersion,
  });

  // Auto-scroll only on verification feedback (not on section reveal)
  useEffect(() => {
    if (lastVerification) {
      contentEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [lastVerification]);

  // ─── Text selection + keydown trigger ───
  const [bubbleInitialChars, setBubbleInitialChars] = useState("");
  const [isClarifySubmitting, setIsClarifySubmitting] = useState(false);

  // Ref-based pending in-thread reply to avoid forward dependency on handlers
  const pendingInThreadReply = useRef<{ threadId: string; question: string } | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectionState) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.length !== 1) return;

      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement ||
        (active instanceof HTMLElement && active.isContentEditable)
      ) {
        return;
      }

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) return;

      const selectedText = selection.toString().trim();
      if (selectedText.length < 3 || selectedText.length > 500) return;

      const container = lessonContentRef.current;
      if (!container) return;
      const range = selection.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) return;

      // Check if selection is inside a clarification thread — show the bubble
      // but route submission as a reply to that thread instead of a new one.
      let node: Node | null = range.commonAncestorContainer;
      while (node && node !== container) {
        if (node instanceof HTMLElement && node.hasAttribute("data-clarify-thread-id")) {
          const existingThreadId = node.getAttribute("data-clarify-thread-id")!;
          const thread = clarificationThreads.get(existingThreadId);
          if (thread && !thread.isLoading) {
            e.preventDefault();
            const rect = range.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            setBubbleInitialChars(e.key);
            setSelectionState({
              quote: selectedText,
              position: {
                top: rect.bottom - containerRect.top,
                left: rect.left - containerRect.left + rect.width / 2,
              },
              sectionIndex: thread.sectionIndex,
              blockIndex: thread.blockIndex,
              replyThreadId: existingThreadId,
            });
          }
          return;
        }
        node = node.parentNode;
      }

      e.preventDefault();

      // Find section index by walking DOM to parent [data-section-index]
      let sectionIndex = Math.max(0, revealedCount - 1);
      let sectionEl: HTMLElement | null = null;
      let el: Node | null = range.commonAncestorContainer;
      while (el && el !== container) {
        if (el instanceof HTMLElement && el.hasAttribute("data-section-index")) {
          sectionIndex = parseInt(el.getAttribute("data-section-index")!, 10);
          sectionEl = el;
          break;
        }
        el = el.parentNode;
      }

      let blockIndex = 0;
      if (sectionEl) {
        let blockNode: Node | null = range.commonAncestorContainer;
        if (blockNode.nodeType !== Node.ELEMENT_NODE) blockNode = blockNode.parentNode;
        
        while (blockNode && (blockNode as Element).hasAttribute && !(blockNode as Element).hasAttribute("data-block-index")) {
          if ((blockNode as Element).classList?.contains("lesson-content")) break;
          blockNode = blockNode.parentNode;
        }
        
        if (blockNode && (blockNode as Element).hasAttribute?.("data-block-index")) {
          blockIndex = parseInt((blockNode as Element).getAttribute("data-block-index")!, 10);
        }
      }

      const rect = range.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      setBubbleInitialChars(e.key);
      setSelectionState({
        quote: selectedText,
        position: {
          top: rect.bottom - containerRect.top,
          left: rect.left - containerRect.left + rect.width / 2,
        },
        sectionIndex,
        blockIndex,
      });

    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectionState, clarificationThreads, revealedCount]);

  // Restore clarification threads from DB on mount
  useEffect(() => {
    if (!lessonMessages) return;
    const clarificationMsgs = lessonMessages.filter(
      (m) => m.messageType === "clarification" && m.threadId
    );
    if (clarificationMsgs.length === 0) return;

    const threadMap = new Map<string, {
      quote: string;
      threadId: string;
      sectionIndex: number;
      blockIndex: number;
      messages: ClarificationMessage[];
      isLoading: boolean;
      isExpanded: boolean;
    }>();

    for (const msg of clarificationMsgs) {
      const tid = msg.threadId!;
      if (!threadMap.has(tid)) {
        threadMap.set(tid, {
          quote: msg.clarificationQuote ?? "",
          threadId: tid,
          sectionIndex: msg.clarificationSectionIndex ?? 0,
          blockIndex: msg.clarificationBlockIndex ?? 0,
          messages: [],
          isLoading: false,
          isExpanded: false, // Default restored threads to collapsed
        });
      }
      threadMap.get(tid)!.messages.push({
        role: msg.role as ClarificationMessage["role"],
        content: msg.content,
      });
    }

    setClarificationThreads((prev) => {
      const next = new Map(prev);
      for (const [tid, dbThread] of threadMap.entries()) {
        const existing = next.get(tid);
        if (existing) {
          next.set(tid, {
            ...dbThread,
            // Preserve strictly active UI streaming states
            isLoading: existing.isLoading,
            streamingText: existing.streamingText,
            // Don't let DB's potential `undefined` fallback override the live UI position
            blockIndex: existing.isLoading ? existing.blockIndex : dbThread.blockIndex,
            // Keep optimistic messages while loading (Convex sync might be slightly behind)
            messages: existing.isLoading ? existing.messages : dbThread.messages,
            // Preserve the user's expand/collapse preference across DB syncs,
            // but only if this thread actually has history in the UI (not a fresh shell)
            isExpanded: existing.messages.length > 0 ? existing.isExpanded : false,
          });
        } else {
          next.set(tid, { ...dbThread, isExpanded: false });
        }
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonMessages?.length]);

  /** Stream a clarification request via SSE */
  const streamClarification = useCallback(async (
    quote: string,
    question: string,
    threadId: string,
    sectionIndex: number,
    blockIndex: number,
  ) => {
    if (!currentLesson) return;

    // Optimistically add user message
    setClarificationThreads(prev => {
      const next = new Map(prev);
      const existing = next.get(threadId);
      if (existing) {
        next.set(threadId, {
          ...existing,
          messages: [...existing.messages, { role: "user", content: question }],
          isLoading: true,
          streamingText: "",
        });
      } else {
        next.set(threadId, {
          quote,
          threadId,
          sectionIndex,
          blockIndex,
          messages: [{ role: "user", content: question }],
          streamingText: "",
          isLoading: true,
          isExpanded: true,
        });
      }
      return next;
    });

    try {
      const res = await fetch("/api/learn/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: currentLesson._id,
          quote,
          question,
          threadId,
          blockIndex,
          sectionIndex,
          lessonContext: fullText,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Stream failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const payload = JSON.parse(line.slice(6)) as {
              type: string;
              text?: string;
              fullText?: string;
              error?: string;
            };

            if (payload.type === "delta" && payload.text) {
              accumulated += payload.text;
              const snap = accumulated; // capture for closure
              setClarificationThreads(prev => {
                const next = new Map(prev);
                const t = next.get(threadId);
                if (t) {
                  next.set(threadId, { ...t, streamingText: snap });
                }
                return next;
              });
            } else if (payload.type === "done") {
              const finalText = payload.fullText ?? accumulated;
              setClarificationThreads(prev => {
                const next = new Map(prev);
                const t = next.get(threadId);
                if (t) {
                  next.set(threadId, {
                    ...t,
                    messages: [...t.messages, { role: "teacher", content: finalText }],
                    streamingText: undefined,
                    isLoading: false,
                  });
                }
                return next;
              });
            } else if (payload.type === "error") {
              setClarificationThreads(prev => {
                const next = new Map(prev);
                const t = next.get(threadId);
                if (t) {
                  next.set(threadId, {
                    ...t,
                    messages: [...t.messages, { role: "teacher", content: "Something went wrong. Please try again." }],
                    streamingText: undefined,
                    isLoading: false,
                  });
                }
                return next;
              });
            }
          } catch { /* skip malformed SSE */ }
        }
      }
    } catch {
      setClarificationThreads(prev => {
        const next = new Map(prev);
        const t = next.get(threadId);
        if (t) {
          next.set(threadId, {
            ...t,
            messages: [...t.messages, { role: "teacher", content: "Something went wrong. Please try again." }],
            streamingText: undefined,
            isLoading: false,
          });
        }
        return next;
      });
    }
  }, [currentLesson, fullText]);

  const handleClarify = useCallback((quote: string, question: string, sectionIndex: number, blockIndex: number) => {
    const threadId = `clarify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setSelectionState(null);
    void streamClarification(quote, question, threadId, sectionIndex, blockIndex);
  }, [streamClarification]);

  // Process pending in-thread reply (set by keydown handler via ref)
  useEffect(() => {
    const pending = pendingInThreadReply.current;
    if (!pending) return;
    pendingInThreadReply.current = null;
    const thread = clarificationThreads.get(pending.threadId);
    if (thread && !thread.isLoading) {
      void streamClarification(thread.quote, pending.question, pending.threadId, thread.sectionIndex, thread.blockIndex);
    }
  }, [clarificationThreads, streamClarification]);

  const handleClarificationReply = useCallback((threadId: string, question: string) => {
    const thread = clarificationThreads.get(threadId);
    if (!thread) return;
    void streamClarification(thread.quote, question, threadId, thread.sectionIndex, thread.blockIndex);
  }, [clarificationThreads, streamClarification]);

  // Restore from DB on mount
  useEffect(() => {
    if (initialized || !lessonMessages) return;

    if (lessonMessages.length > 0) {
      // Find the main teacher lesson messages (exclude clarification responses)
      const teacherMessages = lessonMessages.filter(
        (m) => m.role === "teacher" && m.messageType !== "clarification",
      );
      if (teacherMessages.length > 0) {
        // Concatenate all teacher messages to reconstruct the full lesson
        const reconstructed = teacherMessages.map(m => m.content).join("\n\n");
        setFullText(reconstructed);

        // Check if lesson was completed
        const lastMsg = teacherMessages[teacherMessages.length - 1];
        if (lastMsg?.messageType === "lesson_complete" || reconstructed.includes("[LESSON_COMPLETE]")) {
          setIsLessonComplete(true);
          // Reveal all sections
          const parsed = parseLessonSections(reconstructed);
          setRevealedCount(parsed.length);
        } else {
          // Figure out how far the user got based on verification messages
          const verifications = lessonMessages.filter((m) => m.messageType === "verification");
          const parsed = parseLessonSections(reconstructed);
          // Each verification means one checkpoint was passed
          const checkpoint = Math.min(verifications.length + 1, parsed.length);
          setRevealedCount(checkpoint);

          // If stopped at a checkpoint, restore the input request
          if (checkpoint <= parsed.length) {
            const currentSection = parsed[checkpoint - 1];
            if (currentSection?.inputRequest) {
              setCurrentInputRequest(currentSection.inputRequest);
            }
          }
        }

        // Restore answered checkpoint state from verification messages
        const verifications = lessonMessages.filter((m) => m.messageType === "verification");
        const parsed = parseLessonSections(reconstructed);
        if (verifications.length > 0) {
          const restoredCheckpoints = new Map<number, {
            answer?: string;
            skipped?: boolean;
            verification?: { is_correct: boolean; feedback_block: string };
          }>();

          // Match verifications to their corresponding checkpoint sections
          let verIdx = 0;
          for (let i = 0; i < parsed.length && verIdx < verifications.length; i++) {
            if (parsed[i]?.inputRequest) {
              const verMsg = verifications[verIdx];
              if (verMsg) {
                // Find the user message preceding this verification
                const verMsgIndex = lessonMessages.indexOf(verMsg);
                const userMsg = verMsgIndex > 0
                  ? lessonMessages.slice(0, verMsgIndex).reverse().find(
                      (m) => m.role === "user" && m.messageType !== "clarification",
                    )
                  : undefined;

                try {
                  const parsed_ver = JSON.parse(verMsg.content) as {
                    is_correct: boolean;
                    feedback_block: string;
                  };
                  restoredCheckpoints.set(i, {
                    answer: userMsg?.content,
                    verification: parsed_ver,
                  });
                } catch {
                  // If verification content isn't valid JSON, mark as answered
                  restoredCheckpoints.set(i, { answer: userMsg?.content });
                }
              }
              verIdx++;
            }
          }

          if (restoredCheckpoints.size > 0) {
            setAnsweredCheckpoints(restoredCheckpoints);
          }
        }
      }
    }

    setInitialized(true);
  }, [lessonMessages, initialized]);

  const teach = useCallback(async () => {
    if (!currentLesson) return;
    setIsTeaching(true);
    setError(null);
    setFullText("");
    setRevealedCount(1);

    try {
      const res = await fetch("/api/learn/teach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: currentLesson._id }),
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error ?? `Server error (${res.status})`);
      }

      if (!res.body) throw new Error("No stream body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const payload = JSON.parse(line.slice(6)) as {
              type: string;
              text?: string;
              error?: string;
              isComplete?: boolean;
              inputRequest?: { type: string; question: string; expectedAnswer: string } | null;
              fullText?: string;
            };

            if (payload.type === "delta" && payload.text) {
              accumulated += payload.text;
              setFullText(accumulated);

              // Auto-reveal: check if we've streamed past the current revealed section
              // and we're not waiting on an input request
              const currentSections = parseLessonSections(accumulated);
              // Reveal the first section immediately while streaming
              if (currentSections.length > 0) {
                setRevealedCount(prev => Math.max(prev, 1));
              }
            } else if (payload.type === "done") {
              const final = payload.fullText ?? accumulated;
              setFullText(final);
              setIsLessonComplete(payload.isComplete ?? false);

              // Pause at first input request
              const parsed = parseLessonSections(final);
              if (parsed.length > 0 && parsed[0]?.inputRequest) {
                setCurrentInputRequest(parsed[0].inputRequest);
                setRevealedCount(1);
              }
            } else if (payload.type === "error") {
              setError(payload.error ?? "Teaching failed");
            }
          } catch { /* skip malformed SSE */ }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Teaching failed");
    } finally {
      setIsTeaching(false);
    }
  }, [currentLesson]);

  // Start teaching on mount only if no DB messages
  useEffect(() => {
    if (currentLesson && initialized && fullText.length === 0 && !lessonMessages?.length) {
      void teach();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized]);

  // Advance past the current checkpoint, revealing content until the next checkpoint or end
  const advanceToNextCheckpoint = (opts?: { answer?: string; skipped?: boolean; verification?: { is_correct: boolean; feedback_block: string } }) => {
    // Record the current checkpoint as answered/skipped
    const currentSectionIdx = revealedCount - 1;
    if (currentSectionIdx >= 0 && sections[currentSectionIdx]?.inputRequest) {
      setAnsweredCheckpoints(prev => {
        const next = new Map(prev);
        next.set(currentSectionIdx, {
          answer: opts?.answer,
          skipped: opts?.skipped,
          verification: opts?.verification,
        });
        return next;
      });
    }

    setCurrentInputRequest(null);
    setLastVerification(null);
    setUserInput("");

    // Reveal sections one at a time, but skip through content-only sections
    let nextIdx = revealedCount;
    while (nextIdx < sections.length) {
      nextIdx += 1;
      const upcoming = sections[nextIdx];
      // If the next section has a checkpoint, pause there
      if (upcoming?.inputRequest) {
        setRevealedCount(nextIdx + 1);
        setCurrentInputRequest(upcoming.inputRequest);
        return;
      }
      // If we've revealed everything, stop
      if (nextIdx >= sections.length) {
        setRevealedCount(nextIdx);
        return;
      }
    }
    setRevealedCount(nextIdx);
  };

  const handleSubmitInput = async () => {
    if (!userInput.trim() || !currentInputRequest || !currentLesson) return;

    const input = userInput.trim();
    setUserInput("");

    try {
      const verifyResult = await verifyInputAction(
        currentLesson._id,
        currentInputRequest.question,
        currentInputRequest.expectedAnswer,
        input,
      );

      if (verifyResult.ok) {
        setLastVerification(verifyResult.data);

        if (verifyResult.data.is_correct) {
          // Correct: advance to next checkpoint after brief delay
          setTimeout(() => {
            advanceToNextCheckpoint({
              answer: input,
              verification: verifyResult.data,
            });
          }, 1200);
        }
        // If incorrect: keep currentInputRequest active for retry
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    }
  };

  const handleSkip = () => {
    advanceToNextCheckpoint({ skipped: true });
  };

  const handleSummarize = async () => {
    if (!currentLesson) return;
    setIsSummarizing(true);
    try {
      await completeLessonAction(currentLesson._id);
      await summarizeLessonAction(currentLesson._id);
      await advanceCourseAction(courseId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Summary failed");
    } finally {
      setIsSummarizing(false);
    }
  };

  if (!currentModule || !currentLesson) {
    return <div className="text-center py-12 text-secondary">Loading lesson...</div>;
  }

  // Progress calculation
  const progressPct = totalSections > 0 ? Math.min((revealedCount / totalSections) * 100, 100) : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Progress bar */}
      <div className="w-full h-[2px] bg-white/[0.06] rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-emerald-500/80 to-emerald-400/60"
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>

      {/* Lesson eyebrow + title */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="lesson-eyebrow flex items-center gap-2">
            <span>MODULE {currentModuleIndex + 1}</span>
            <span className="text-white/15">/</span>
            <span>LESSON {currentLessonIndex + 1}</span>
          </p>
          <h2 className="text-[22px] font-semibold text-white tracking-tight">{currentLesson.title}</h2>
          <p className="mt-1 text-sm text-white/40 font-[family-name:var(--font-geist-mono)]">{currentLesson.focusArea}</p>
        </div>

        <FocusModeToggle enabled={focusModeEnabled} onToggle={onToggleFocusMode} />
      </div>

      {/* Lesson content — progressive reveal */}
      <div ref={lessonContentRef} className="space-y-0 relative">
        {/* Selection bubble — appears when user starts typing with text selected */}
        {selectionState && (
          <SelectionBubble
            position={selectionState.position}
            quote={selectionState.quote}
            initialChars={bubbleInitialChars}
            isSubmitting={isClarifySubmitting}
            onSubmit={(question) => {
              if (selectionState.replyThreadId) {
                // Reply inside an existing thread — include the selected text as context
                const questionWithContext = selectionState.quote
                  ? `About: "${selectionState.quote}"\n\n${question}`
                  : question;
                setSelectionState(null);
                handleClarificationReply(selectionState.replyThreadId, questionWithContext);
              } else {
                // New thread from lesson text
                handleClarify(selectionState.quote, question, selectionState.sectionIndex, selectionState.blockIndex);
              }
            }}
            onClose={() => {
              setSelectionState(null);
            }}
          />
        )}

        {sections.slice(0, revealedCount).map((section, i) => {
          const pastCheckpoint = answeredCheckpoints.get(i);
          const isCurrentCheckpoint = i === revealedCount - 1 && currentInputRequest && section.inputRequest;

          return (
            <motion.div
              key={i}
              data-section-index={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i === revealedCount - 1 ? 0.1 : 0 }}
            >
              <LessonMarkdown
                content={section.content}
                sectionKey={`lesson-section-${i}`}
                focusModeEnabled={focusModeEnabled}
                activeFocusTargets={activeFocusTargets}
                blockAppendages={
                  Array.from(clarificationThreads.values())
                    .filter(t => t.sectionIndex === i)
                    .reduce((acc, t) => {
                      const existing = acc[t.blockIndex] || null;
                      acc[t.blockIndex] = (
                        <div key={t.threadId}>
                          {existing}
                          <div className="mb-6" data-clarify-thread-id={t.threadId}>
                            <ClarificationThread
                              quote={t.quote}
                              messages={t.messages}
                              streamingText={t.streamingText}
                              onReply={(q) => handleClarificationReply(t.threadId, q)}
                              isLoading={t.isLoading}
                              isExpanded={t.isExpanded}
                              onToggleExpanded={() => {
                                setClarificationThreads(prev => {
                                  const next = new Map(prev);
                                  const thread = next.get(t.threadId);
                                  if (thread) next.set(t.threadId, { ...thread, isExpanded: !thread.isExpanded });
                                  return next;
                                });
                              }}
                            />
                          </div>
                        </div>
                      );
                      return acc;
                    }, {} as Record<number, React.ReactNode>)
                }
              />

              {/* Past checkpoint — greyed out */}
              {pastCheckpoint && section.inputRequest && (
                <div className="lesson-callout my-6 opacity-40 pointer-events-none">
                  <p className="text-[11px] font-[family-name:var(--font-geist-mono)] uppercase tracking-[0.15em] text-white/30 mb-2">
                    {section.inputRequest.type === "challenge" ? "🎯 Challenge" : section.inputRequest.type === "predict" ? "🔮 Predict" : "✍️ Fill in"}
                  </p>
                  <p className="text-white/80 text-[15px] mb-3 leading-relaxed">
                    {section.inputRequest.question}
                  </p>
                  {pastCheckpoint.skipped ? (
                    <p className="text-xs text-white/30 italic flex items-center gap-1">
                      <SkipForward className="w-3 h-3" /> Skipped
                    </p>
                  ) : pastCheckpoint.verification ? (
                    <div className={`rounded-lg px-4 py-3 text-sm ${pastCheckpoint.verification.is_correct
                      ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                      : "bg-amber-500/10 border border-amber-500/20 text-amber-300"
                      }`}>
                      {pastCheckpoint.answer && <p className="text-xs text-white/40 mb-1">Your answer: {pastCheckpoint.answer}</p>}
                      {pastCheckpoint.verification.feedback_block}
                    </div>
                  ) : null}
                </div>
              )}
              {/* Threads for this section are rendered via portal — see below */}

              {isCurrentCheckpoint && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="lesson-callout my-6"
                >
                  <p className="text-[11px] font-[family-name:var(--font-geist-mono)] uppercase tracking-[0.15em] text-white/30 mb-2">
                    {currentInputRequest.type === "challenge" ? "🎯 Challenge" : currentInputRequest.type === "predict" ? "🔮 Predict" : "✍️ Fill in"}
                  </p>
                  <p className="text-white/80 text-[15px] mb-4 leading-relaxed">
                    {currentInputRequest.question}
                  </p>

                  {/* Verification feedback */}
                  {lastVerification && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className={`rounded-lg px-4 py-3 mb-3 text-sm ${lastVerification.is_correct
                        ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                        : "bg-amber-500/10 border border-amber-500/20 text-amber-300"
                        }`}
                    >
                      {lastVerification.feedback_block}
                      {lastVerification.is_correct && (
                        <span className="block mt-1 text-xs text-emerald-400/60">✓ Correct — continuing...</span>
                      )}
                    </motion.div>
                  )}

                  {/* Input area (show when not correct yet) */}
                  {!lastVerification?.is_correct && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSubmitInput()}
                        placeholder="Type your answer..."
                        className="flex-1 bg-neutral-950 border border-white/10 rounded-lg px-3 py-2.5 text-[15px] text-primary placeholder:text-neutral-600 focus-ring"
                      />
                      <button
                        disabled={!userInput.trim()}
                        onClick={handleSubmitInput}
                        className="bg-white text-black font-medium px-4 py-2.5 rounded-lg spring-interact disabled:opacity-50 hover:opacity-90 text-sm flex items-center gap-1.5"
                      >
                        <CornerDownLeft className="w-3.5 h-3.5" />
                        Submit
                      </button>
                    </div>
                  )}

                  {/* Skip button */}
                  {!lastVerification?.is_correct && (
                    <button
                      onClick={handleSkip}
                      className="mt-2 text-xs text-white/30 hover:text-white/50 transition-colors flex items-center gap-1"
                    >
                      <SkipForward className="w-3 h-3" />
                      Skip this question
                    </button>
                  )}
                </motion.div>
              )}
            </motion.div>
          );
        })}

        {/* Streaming indicator */}
        {(isTeaching || isSummarizing) && (
          <div className="flex items-center gap-2 text-white/30 text-sm py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="font-[family-name:var(--font-geist-mono)] text-xs">
              {isSummarizing ? "Generating knowledge piece..." : "Generating lesson..."}
            </span>
          </div>
        )}

        <div ref={contentEndRef} />

        {/* "Feels Hard" context menu */}
        {contextMenu && createPortal(
          <div
            className="fixed z-[100] bg-neutral-900 border border-white/10 rounded-lg shadow-2xl py-1 min-w-[180px]"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => void handleFeelsHard(contextMenu.selectedText)}
              className="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/[0.06] transition-colors flex items-center gap-2"
              type="button"
            >
              <span>😣</span> Feels Hard
            </button>
          </div>,
          document.body,
        )}

        {/* "Feels Hard" feedback toast */}
        <AnimatePresence>
          {feelsHardFeedback && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-sm text-white/80 shadow-xl"
            >
              {feelsHardFeedback}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Lesson complete */}
      {/* Lesson complete — show when all sections revealed and not streaming */}
      {(hasLessonCompleteMarker || (revealedCount >= totalSections && totalSections > 0)) && revealedCount >= totalSections && !isTeaching && !isSummarizing && (
        currentLesson && ["summarized", "integrated"].includes(currentLesson.status) ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="lesson-callout text-center py-6 space-y-4"
          >
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400" />
            <h3 className="text-base font-medium text-primary">Knowledge Piece Generated</h3>
            <p className="text-sm text-white/40">Your knowledge piece has been saved.</p>
            {isAdvancingCourse ? (
              <div className="flex items-center justify-center gap-2 text-white/50 text-sm py-3">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Advancing...</span>
              </div>
            ) : (
              <button
                onClick={async () => {
                  setIsAdvancingCourse(true);
                  setError(null);
                  try {
                    await advanceCourseAction(courseId);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Failed to advance course");
                  } finally {
                    setIsAdvancingCourse(false);
                  }
                }}
                className="bg-white text-black font-medium px-6 py-3 rounded-xl spring-interact hover:opacity-90 text-sm"
              >
                Continue →
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="lesson-callout text-center py-6 space-y-4"
          >
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400" />
            <h3 className="text-base font-medium text-primary">Lesson Complete</h3>
            <p className="text-sm text-white/40">Ready to generate your knowledge piece.</p>
            <button
              onClick={handleSummarize}
              disabled={isSummarizing}
              className="bg-white text-black font-medium px-6 py-3 rounded-xl spring-interact hover:opacity-90 disabled:opacity-50 text-sm"
            >
              Generate Knowledge Piece →
            </button>
          </motion.div>
        )
      )}
    </motion.div>
  );
}

// ─── Summary Phase ───
function SummaryPhase({
  courseId,
  currentLessonIndex,
  focusModeEnabled,
  onToggleFocusMode,
  lessons,
}: {
  courseId: string;
  currentLessonIndex: number;
  focusModeEnabled: boolean;
  onToggleFocusMode: () => void;
  lessons: Array<{ _id: string; lessonIndex: number; summaryMarkdown?: string; status: string }>;
}) {
  const currentLesson = lessons.find((l) => l.lessonIndex === currentLessonIndex);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const summaryContentRef = useRef<HTMLDivElement>(null);
  const activeFocusTargets = useActiveFocusTargets({
    containerRef: summaryContentRef,
    enabled: focusModeEnabled,
    contentVersion: currentLesson?.summaryMarkdown ?? "",
  });

  const handleAdvance = async () => {
    setIsAdvancing(true);
    try {
      await advanceCourseAction(courseId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to advance");
    } finally {
      setIsAdvancing(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-medium text-primary">Lesson Summary</h2>
        <FocusModeToggle enabled={focusModeEnabled} onToggle={onToggleFocusMode} />
      </div>

      {currentLesson?.summaryMarkdown ? (
        <div ref={summaryContentRef} className="glass-card rounded-2xl p-6">
          <LessonMarkdown
            content={currentLesson.summaryMarkdown}
            sectionKey={`summary-${currentLesson._id}`}
            focusModeEnabled={focusModeEnabled}
            activeFocusTargets={activeFocusTargets}
          />
        </div>
      ) : (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-white/30" />
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        disabled={isAdvancing}
        onClick={handleAdvance}
        className="w-full bg-white text-black font-medium py-3 rounded-xl spring-interact disabled:opacity-50 hover:opacity-90 text-sm flex items-center justify-center gap-2"
      >
        {isAdvancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
        Continue to Next Lesson
      </button>
    </motion.div>
  );
}
