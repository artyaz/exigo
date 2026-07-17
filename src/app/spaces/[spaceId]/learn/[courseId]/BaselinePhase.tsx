"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Loader2, CheckCircle2, ChevronRight, ChevronLeft, XCircle,
} from "lucide-react";
import {
  generateBaselineQuestionAction,
  evaluateBaselineAnswerAction,
  submitBaselineAction,
  advanceCourseAction,
} from "../../../../actions/learn";

export function BaselinePhase({ courseId, courseTopic, baselineResults }: { courseId: string; courseTopic: string; baselineResults?: string }) {
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

  if (baselineResults) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-white/30" />
        <p className="text-sm text-secondary">Loading your course...</p>
      </div>
    );
  }

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
