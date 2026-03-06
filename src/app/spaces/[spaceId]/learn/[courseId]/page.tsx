"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { useState, useEffect, use, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Loader2, Zap, CheckCircle2, ChevronRight,
  CornerDownLeft,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  generateBaselineQuestionAction,
  submitBaselineAction,
  advanceCourseAction,
  teachLessonAction,
  verifyInputAction,
  summarizeLessonAction,
} from "../../../../actions/learn";

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

        {/* Phase-specific content */}
        {course.phase === "baseline" && (
          <BaselinePhase courseId={courseId} courseTopic={course.refinedTitle} />
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
function BaselinePhase({ courseId, courseTopic }: { courseId: string; courseTopic: string }) {
  const [step, setStep] = useState(1);
  const [currentQuestion, setCurrentQuestion] = useState<{
    question_text: string;
    options: string[];
    correct_option: string;
    concept_tag: string;
  } | null>(null);
  const [previousQuestions, setPreviousQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Array<{ step: number; answer: string; correct: string; isCorrect: boolean }>>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionFailed, setSubmissionFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateQuestion = useCallback(async (stepNum: number, prevQs: string[]) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await generateBaselineQuestionAction(courseId, courseTopic, stepNum, prevQs);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCurrentQuestion(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate question");
    } finally {
      setIsLoading(false);
    }
  }, [courseId, courseTopic]);

  // Generate first question on mount
  useEffect(() => {
    void generateQuestion(1, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAnswer = async () => {
    if (!selectedOption || !currentQuestion) return;

    const isCorrect = selectedOption === currentQuestion.correct_option;
    const newAnswers = [...answers, { step, answer: selectedOption, correct: currentQuestion.correct_option, isCorrect }];
    setAnswers(newAnswers);
    const newPrevQs = [...previousQuestions, currentQuestion.question_text];
    setPreviousQuestions(newPrevQs);

    if (step < 5) {
      setStep(step + 1);
      setSelectedOption(null);
      setCurrentQuestion(null);
      await generateQuestion(step + 1, newPrevQs);
    } else {
      // Baseline complete
      setIsSubmitting(true);
      setSubmissionFailed(false);
      try {
        const baselineData = JSON.stringify(newAnswers);
        await submitBaselineAction(courseId, baselineData);
        await advanceCourseAction(courseId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to submit baseline");
        setSubmissionFailed(true);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleRetrySubmission = async () => {
    setIsSubmitting(true);
    setSubmissionFailed(false);
    setError(null);
    try {
      const baselineData = JSON.stringify(answers);
      await submitBaselineAction(courseId, baselineData);
      await advanceCourseAction(courseId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit baseline");
      setSubmissionFailed(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-primary">Baseline Assessment</h2>
        <span className="text-xs font-mono text-secondary">{step} / 5</span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-white/5 rounded-full h-1.5">
        <div
          className="bg-white h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${(step / 5) * 100}%` }}
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {isLoading || !currentQuestion ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-white/30" />
        </div>
      ) : isSubmitting ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-white/30" />
          <p className="text-sm text-secondary">Analyzing results & generating your syllabus...</p>
        </div>
      ) : submissionFailed ? (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <p className="text-sm text-red-500">{error}</p>
          <button
            onClick={handleRetrySubmission}
            className="bg-white text-black font-medium px-6 py-3 rounded-xl spring-interact hover:opacity-90 text-sm"
          >
            Retry Submission
          </button>
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-6 space-y-6">
          <div className="space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-secondary">{currentQuestion.concept_tag}</span>
            <p className="text-base text-primary">{currentQuestion.question_text}</p>
          </div>

          <div className="space-y-2">
            {currentQuestion.options.map((option, i) => {
              const optionLetter = option.charAt(0);
              const isSelected = selectedOption === optionLetter;
              return (
                <button
                  key={i}
                  onClick={() => setSelectedOption(optionLetter)}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all spring-interact ${
                    isSelected
                      ? "border-white bg-white/10 text-primary"
                      : "border-white/10 bg-white/[0.02] text-secondary hover:bg-white/5 hover:text-primary"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>

          <button
            disabled={!selectedOption || isLoading}
            onClick={handleAnswer}
            className="w-full bg-white text-black font-medium py-3 rounded-xl spring-interact disabled:opacity-50 hover:opacity-90 text-sm flex items-center justify-center gap-2"
          >
            {step < 5 ? "Next Question" : "Complete Assessment"}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </motion.div>
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
  const [error, setError] = useState<string | null>(null);

  const teach = useCallback(async (userMessage?: string) => {
    if (!currentLesson) return;
    setIsTeaching(true);
    setError(null);
    setLastVerification(null);

    try {
      const result = await teachLessonAction(currentLesson._id, userMessage);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setMessages((prev) => [
        ...prev,
        ...(userMessage ? [{ role: "user", content: userMessage }] : []),
        { role: "teacher", content: result.data.teacherResponse, messageType: result.data.inputRequest ? "input_request" : "narrative" },
      ]);

      setCurrentInputRequest(result.data.inputRequest);
      setIsLessonComplete(result.data.isComplete);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Teaching failed");
    } finally {
      setIsTeaching(false);
    }
  }, [currentLesson]);

  // Start teaching on mount
  useEffect(() => {
    if (currentLesson && messages.length === 0) {
      void teach();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    // Continue teaching
    await teach(input);
  };

  const handleSummarize = async () => {
    if (!currentLesson) return;
    setIsTeaching(true);
    try {
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
      {/* Module / Lesson header */}
      <div className="space-y-1">
        <p className="text-[10px] font-mono uppercase tracking-widest text-secondary">
          Module {currentModuleIndex + 1}: {currentModule.moduleTitle}
        </p>
        <h2 className="text-lg font-medium text-primary">
          Lesson {currentLessonIndex + 1}: {currentLesson.title}
        </h2>
        <p className="text-xs text-tertiary">{currentLesson.focusArea}</p>
      </div>

      {/* Lesson progress */}
      <div className="flex gap-1">
        {moduleLessons.map((l, i) => (
          <div
            key={l._id}
            className={`h-1 flex-1 rounded-full ${
              i < currentLessonIndex ? "bg-emerald-500" : i === currentLessonIndex ? "bg-white" : "bg-white/10"
            }`}
          />
        ))}
      </div>

      {/* Chat messages */}
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-xl px-4 py-3 text-sm ${
              msg.role === "teacher"
                ? "bg-white/[0.03] border border-white/10 text-primary"
                : msg.role === "user"
                ? "bg-white/10 text-primary ml-8"
                : msg.messageType === "verification"
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs"
                : "bg-white/[0.02] text-secondary text-xs"
            }`}
          >
            <div className="whitespace-pre-wrap">{msg.content}</div>
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
        <div className="glass-card rounded-xl p-4 space-y-3">
          <p className="text-xs font-mono uppercase tracking-widest text-secondary">
            {currentInputRequest.type}
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
          onClick={() => teach()}
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
            {currentLesson.summaryMarkdown}
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
