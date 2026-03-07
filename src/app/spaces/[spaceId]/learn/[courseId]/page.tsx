"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { useState, useEffect, useRef, use, useCallback, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Loader2, Zap, CheckCircle2, ChevronRight, ChevronLeft,
  CornerDownLeft, XCircle,
} from "lucide-react";
import Link from "next/link";
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

/* ─── Basic markdown renderer ─── */
function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const result: ReactNode[] = [];
  const tokenRegex = /(\*\*(.+?)\*\*|`(.+?)`|\*([^*]+?)\*|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let partIdx = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }
    const key = `${keyPrefix}-${partIdx++}`;
    if (match[2] !== undefined) {
      result.push(<strong key={key} className="font-semibold text-white">{match[2]}</strong>);
    } else if (match[3] !== undefined) {
      result.push(<code key={key} className="px-1.5 py-0.5 rounded bg-white/[0.08] text-[11px] font-mono text-white/90 border border-white/[0.06]">{match[3]}</code>);
    } else if (match[4] !== undefined) {
      result.push(<em key={key} className="italic text-white/80">{match[4]}</em>);
    } else if (match[5] !== undefined && match[6] !== undefined) {
      result.push(<a key={key} href={match[6]} target="_blank" rel="noopener noreferrer" className="text-blue-400/80 hover:text-blue-300 underline underline-offset-2">{match[5]}</a>);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }
  return result;
}

function renderMarkdown(text: string): ReactNode[] {
  const result: ReactNode[] = [];

  // First pass: split by fenced code blocks
  const blocks = text.split(/(```[\s\S]*?```)/g);
  let blockIdx = 0;

  for (const block of blocks) {
    const codeMatch = /^```(\w+)?\n([\s\S]*?)```$/.exec(block);
    if (codeMatch) {
      const lang = codeMatch[1];
      const code = codeMatch[2] ?? "";
      result.push(
        <div key={`codeblock-${blockIdx}`} className="relative my-3">
          {lang && (
            <span className="absolute top-2 right-3 text-[10px] font-mono text-white/30 select-none">{lang}</span>
          )}
          <pre className="bg-[#0D0D0D] border border-white/[0.06] rounded-xl p-4 overflow-x-auto text-[13px] font-mono text-white/80">
            <code>{code}</code>
          </pre>
        </div>
      );
      blockIdx++;
      continue;
    }

    // Non-code block: process line by line
    const lines = block.split("\n");
    lines.forEach((line, lineIdx) => {
      const key = `${blockIdx}-${lineIdx}`;
      if (lineIdx > 0) result.push(<br key={`br-${key}`} />);

      // Horizontal divider
      if (/^---+\s*$/.test(line)) {
        result.push(<hr key={`hr-${key}`} className="border-white/[0.06] my-4" />);
        return;
      }

      // Headers (check longest first)
      const h4Match = /^####\s+(.*)/.exec(line);
      if (h4Match) {
        result.push(<span key={`h4-${key}`} className="block text-sm font-medium text-white/90 mt-3 mb-1">{renderInlineMarkdown(h4Match[1] ?? "", key)}</span>);
        return;
      }
      const h3Match = /^###\s+(.*)/.exec(line);
      if (h3Match) {
        result.push(<span key={`h3-${key}`} className="block text-sm font-semibold text-white mt-4 mb-1">{renderInlineMarkdown(h3Match[1] ?? "", key)}</span>);
        return;
      }
      const h2Match = /^##\s+(.*)/.exec(line);
      if (h2Match) {
        result.push(<span key={`h2-${key}`} className="block text-base font-semibold text-white mt-5 mb-2">{renderInlineMarkdown(h2Match[1] ?? "", key)}</span>);
        return;
      }
      const h1Match = /^#\s+(.*)/.exec(line);
      if (h1Match) {
        result.push(<span key={`h1-${key}`} className="block text-lg font-bold text-white mt-6 mb-2">{renderInlineMarkdown(h1Match[1] ?? "", key)}</span>);
        return;
      }

      // Ordered list
      const orderedMatch = /^(\s*)\d+\.\s+(.*)/.exec(line);
      if (orderedMatch) {
        const indent = orderedMatch[1] ?? "";
        const content = orderedMatch[2] ?? "";
        const num = line.trimStart().match(/^(\d+)\./)?.[1] ?? "1";
        result.push(
          <span key={`ol-${key}`} style={{ paddingLeft: indent.length * 8 }} className="inline-flex gap-1.5">
            <span className="text-white/40 select-none shrink-0">{num}.</span>
            <span>{renderInlineMarkdown(content, key)}</span>
          </span>
        );
        return;
      }

      // Bullet list
      const bulletMatch = /^(\s*)[*-]\s+(.*)/.exec(line);
      if (bulletMatch) {
        const indent = bulletMatch[1] ?? "";
        const content = bulletMatch[2] ?? "";
        result.push(
          <span key={`li-${key}`} style={{ paddingLeft: indent.length * 8 }} className="inline-flex gap-1.5">
            <span className="text-white/40 select-none shrink-0">•</span>
            <span>{renderInlineMarkdown(content, key)}</span>
          </span>
        );
        return;
      }

      // Regular line
      result.push(...renderInlineMarkdown(line, key));
    });

    blockIdx++;
  }

  return result;
}

/** Strip [INPUT_REQUEST: ...] and [LESSON_COMPLETE] tokens from display text */
function stripProtocolTokens(text: string): string {
  return text
    .replace(/\[INPUT_REQUEST:\s*[^\]]+\]/g, "")
    .replace(/\[LESSON_COMPLETE\]/g, "")
    .trim();
}

export default function CoursePage({ params }: { params: Promise<{ spaceId: string; courseId: string }> }) {
  const { userId } = useAuth();
  const { spaceId, courseId } = use(params);

  const course = useQuery(api.courses.get, userId ? { courseId: courseId as Id<"courses"> } : "skip");
  const modules = useQuery(api.courseModules.getForCourse, userId ? { courseId: courseId as Id<"courses"> } : "skip");
  const lessons = useQuery(api.courseLessons.getForCourse, userId ? { courseId: courseId as Id<"courses"> } : "skip");

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
          <Link href={`/spaces/${spaceId}`} className="text-sm text-white/60 hover:text-white mt-4 inline-block">
            ← Back to space
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-12">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        {course.phase !== "baseline" && (
          <header className="flex items-center gap-4">
            <Link
              href={`/spaces/${spaceId}`}
              className="p-2 -ml-2 rounded-xl text-secondary hover:text-primary hover:bg-white/5 spring-interact"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-primary">{course.refinedTitle}</h1>
              <p className="text-sm text-secondary">{course.courseDescription}</p>
            </div>
          </header>
        )}

        {/* Phase-specific content */}
        {course.phase === "baseline" && (
          <BaselinePhase courseId={courseId} courseTopic={course.refinedTitle} baselineResults={course.baselineResults} />
        )}

        {(course.phase === "module_generation" || course.phase === "module_complete") && (
          <GeneratingPhase courseId={courseId} phase={course.phase} />
        )}

        {course.phase === "lesson" && lessons && modules && (
          <LessonPhase
            courseId={courseId}
            currentModuleIndex={course.currentModuleIndex}
            currentLessonIndex={course.currentLessonIndex}
            modules={modules}
            lessons={lessons}
          />
        )}

        {course.phase === "lesson_summary" && lessons && (
          <SummaryPhase
            courseId={courseId}
            currentLessonIndex={course.currentLessonIndex}
            lessons={lessons}
          />
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
  const [arenaW, setArenaW] = useState(800);
  const [arenaH, setArenaH] = useState(600);

  useEffect(() => {
    if (baselineResults) {
      void advanceCourseAction(courseId).catch(() => {});
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

    setIsLoading(true);
    setError(null);
    try {
      const result = await generateBaselineQuestionAction(
        courseId, courseTopic, step,
        prevQuestions.map(q => q.question_text)
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
      setIsLoading(false);
    }
  }, [courseId, courseTopic]);

  useEffect(() => {
    void generateNextQuestion([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      const updatedQuestions = questions.map(qu =>
        qu.id === questionId
          ? { ...qu, userAnswer: answer, isCorrect: evalResult.ok ? evalResult.data.is_correct : undefined, feedback: evalResult.ok ? evalResult.data.feedback : undefined }
          : qu
      );
      setQuestions(updatedQuestions);

      setTimeout(() => {
        if (currentIndex < 4) {
          setCurrentIndex(prev => prev + 1);
        }
      }, 800);

      if (updatedQuestions.length < 5) {
        void generateNextQuestion(updatedQuestions);
      }

      const answeredCount = updatedQuestions.filter(qu => qu.userAnswer).length;
      if (answeredCount === 5) {
        setIsSubmitting(true);
        try {
          const baselineData = JSON.stringify(updatedQuestions.map(qu => ({
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
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Evaluation failed");
    } finally {
      setIsEvaluating(false);
    }
  };

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
                className={`absolute rounded-2xl border overflow-hidden ${
                  isActive
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

                    <div className="flex-1 px-8 py-6">
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

                  {/* Card navigation footer */}
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
  currentModuleIndex,
  currentLessonIndex,
  modules,
  lessons,
}: {
  courseId: string;
  currentModuleIndex: number;
  currentLessonIndex: number;
  modules: Array<{ _id: string; moduleIndex: number; moduleTitle: string; subTopics: string }>;
  lessons: Array<{ _id: string; moduleId: string; lessonIndex: number; title: string; focusArea: string; status: string; masteryGoals?: string }>;
}) {
  const currentModule = modules.find((m) => m.moduleIndex === currentModuleIndex);
  const moduleLessons = lessons
    .filter((l) => l.moduleId === currentModule?._id)
    .sort((a, b) => a.lessonIndex - b.lessonIndex);
  const currentLesson = moduleLessons[currentLessonIndex];

  const [messages, setMessages] = useState<Array<{ role: string; content: string; messageType?: string }>>([]);
  const [userInput, setUserInput] = useState("");
  const [isTeaching, setIsTeaching] = useState(false);
  const [currentInputRequest, setCurrentInputRequest] = useState<{
    type: string;
    question: string;
    expectedAnswer: string;
  } | null>(null);
  const [lastVerification, setLastVerification] = useState<{
    is_correct: boolean;
    feedback_block: string;
  } | null>(null);
  const [isLessonComplete, setIsLessonComplete] = useState(false);
  const [pendingContinueInput, setPendingContinueInput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const lessonMessages = useQuery(
    api.courseLessonMessages.getForLesson,
    currentLesson ? { lessonId: currentLesson._id as Id<"courseLessons"> } : "skip"
  );

  useEffect(() => {
    if (initialized || !lessonMessages) return;

    if (lessonMessages.length > 0) {
      // Restore messages from DB
      const restored = lessonMessages.map((m) => ({
        role: m.role,
        content: m.content,
        messageType: m.messageType ?? undefined,
      }));
      setMessages(restored);

      // Restore input request state from last message
      const lastTeacherMsg = [...lessonMessages].reverse().find((m) => m.role === "teacher");
      if (lastTeacherMsg?.messageType === "input_request") {
        const match = lastTeacherMsg.content.match(
          /\[INPUT_REQUEST:\s*([^|\]]+?)\s*\|\s*([^|\]]+?)\s*(?:\|\s*([^\]]*?))?\s*\]/
        );
        if (match) {
          setCurrentInputRequest({
            type: match[1]!.trim(),
            question: match[2]!.trim(),
            expectedAnswer: match[3]?.trim() ?? "",
          });
        }
      }

      // Check if lesson was already completed
      if (lastTeacherMsg?.messageType === "lesson_complete") {
        setIsLessonComplete(true);
      }
    }

    setInitialized(true);
  }, [lessonMessages, initialized]);

  const teach = useCallback(async (userMessage?: string, skipLocalMessage?: boolean) => {
    if (!currentLesson) return;
    setIsTeaching(true);
    setError(null);
    setLastVerification(null);

    // Add user message to local state immediately
    if (userMessage && !skipLocalMessage) {
      setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    }

    // Add empty teacher message that we'll stream into
    setMessages((prev) => [...prev, { role: "teacher", content: "", messageType: "narrative" }]);

    try {
      const res = await fetch("/api/learn/teach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: currentLesson._id, userMessage }),
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error ?? `Server error (${res.status})`);
      }

      if (!res.body) throw new Error("No stream body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

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
              setMessages((prev) => {
                const updated = [...prev];
                const lastTeacher = updated[updated.length - 1];
                if (lastTeacher && lastTeacher.role === "teacher") {
                  updated[updated.length - 1] = {
                    ...lastTeacher,
                    content: lastTeacher.content + payload.text,
                  };
                }
                return updated;
              });
            } else if (payload.type === "done") {
              setMessages((prev) => {
                const updated = [...prev];
                const lastTeacher = updated[updated.length - 1];
                if (lastTeacher && lastTeacher.role === "teacher") {
                  updated[updated.length - 1] = {
                    ...lastTeacher,
                    content: payload.fullText ?? lastTeacher.content,
                    messageType: payload.inputRequest ? "input_request" : payload.isComplete ? "lesson_complete" : "narrative",
                  };
                }
                return updated;
              });
              setCurrentInputRequest(payload.inputRequest ?? null);
              setIsLessonComplete(payload.isComplete ?? false);
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
    if (currentLesson && initialized && messages.length === 0) {
      void teach();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized]);

  const handleSubmitInput = async () => {
    if (!userInput.trim() || !currentInputRequest || !currentLesson) return;

    const input = userInput.trim();
    setUserInput("");

    // Verify the input
    try {
      const verifyResult = await verifyInputAction(
        currentLesson._id,
        currentInputRequest.question,
        currentInputRequest.expectedAnswer,
        input,
      );

      if (verifyResult.ok) {
        setLastVerification(verifyResult.data);
        setMessages((prev) => [
          ...prev,
          { role: "user", content: input },
          { role: "system", content: verifyResult.data.feedback_block, messageType: "verification" },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
      return;
    }

    setCurrentInputRequest(null);
    setPendingContinueInput(input);
  };

  const handleSummarize = async () => {
    if (!currentLesson) return;
    setIsTeaching(true);
    try {
      await completeLessonAction(currentLesson._id);
      await summarizeLessonAction(currentLesson._id);
      await advanceCourseAction(courseId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Summary failed");
    } finally {
      setIsTeaching(false);
    }
  };

  if (!currentModule || !currentLesson) {
    return <div className="text-center py-12 text-secondary">Loading lesson...</div>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Lesson title */}
      <h2 className="text-xl font-semibold text-primary tracking-tight">{currentLesson.title}</h2>

      {/* Lesson content */}
      <div className="space-y-5 overflow-y-auto pr-2">
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={
              msg.role === "teacher"
                ? "text-sm text-white/85 leading-relaxed"
                : msg.role === "user"
                ? "text-sm bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/80 ml-6"
                : msg.messageType === "verification"
                ? "text-xs bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-emerald-300"
                : "text-xs text-white/50"
            }
          >
            <div className="whitespace-pre-wrap leading-relaxed">
              {msg.role === "teacher" ? renderMarkdown(stripProtocolTokens(msg.content)) : msg.content}
            </div>
          </motion.div>
        ))}

        {isTeaching && (
          <div className="flex items-center gap-2 text-secondary text-sm py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Teaching...</span>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Input area */}
      {currentInputRequest && !isTeaching && (
        <div className="border-l-2 border-white/20 pl-4 space-y-3">
          <p className="text-xs text-white/50">
            {currentInputRequest.question}
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmitInput()}
              placeholder="Type your answer..."
              className="flex-1 bg-neutral-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-primary placeholder:text-neutral-600 focus-ring"
            />
            <button
              disabled={!userInput.trim()}
              onClick={handleSubmitInput}
              className="bg-white text-black font-medium px-4 py-2 rounded-lg spring-interact disabled:opacity-50 hover:opacity-90 text-sm flex items-center gap-1"
            >
              <CornerDownLeft className="w-3.5 h-3.5" />
              Submit
            </button>
          </div>
        </div>
      )}

      {/* Continue teaching button */}
      {!currentInputRequest && !isTeaching && !isLessonComplete && messages.length > 0 && (
        <button
          onClick={() => {
            const input = pendingContinueInput;
            setPendingContinueInput(null);
            void teach(input ?? undefined, !!input);
          }}
          className="w-full bg-white/5 border border-white/10 text-primary font-medium py-3 rounded-xl spring-interact hover:bg-white/10 text-sm"
        >
          Continue Lesson →
        </button>
      )}

      {/* Lesson complete */}
      {isLessonComplete && !isTeaching && (
        <div className="glass-card rounded-xl p-6 text-center space-y-4">
          <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400" />
          <h3 className="text-base font-medium text-primary">Lesson Complete!</h3>
          <button
            onClick={handleSummarize}
            className="bg-white text-black font-medium px-6 py-3 rounded-xl spring-interact hover:opacity-90 text-sm"
          >
            Generate Summary & Knowledge Piece →
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ─── Summary Phase ───
function SummaryPhase({
  courseId,
  currentLessonIndex,
  lessons,
}: {
  courseId: string;
  currentLessonIndex: number;
  lessons: Array<{ _id: string; lessonIndex: number; summaryMarkdown?: string; status: string }>;
}) {
  const currentLesson = lessons.find((l) => l.lessonIndex === currentLessonIndex);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <h2 className="text-lg font-medium text-primary">Lesson Summary</h2>

      {currentLesson?.summaryMarkdown ? (
        <div className="glass-card rounded-2xl p-6">
          <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-sm text-primary/90">
            {renderMarkdown(currentLesson.summaryMarkdown)}
          </div>
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
