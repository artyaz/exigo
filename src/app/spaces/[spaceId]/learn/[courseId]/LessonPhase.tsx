"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, CheckCircle2, CornerDownLeft, SkipForward,
} from "lucide-react";
import {
  advanceCourseAction,
  completeLessonAction,
  summarizeLessonAction,
} from "../../../../actions/learn";
import { createFeelsHardNodeAction, queueFeelsHardNodeAction } from "../../../../actions/knowledge";
import { LessonMarkdown } from "~/app/_components/learn/LessonMarkdown";
import { LessonPractice } from "~/app/_components/learn/LessonPractice";
import { SelectionBubble } from "~/app/_components/learn/SelectionBubble";
import { ClarificationThread } from "~/app/_components/learn/ClarificationThread";
import { FocusModeToggle, useActiveFocusTargets } from "~/app/_components/learn/course/focusMode";
import { unwrapActionResult } from "~/app/_components/learn/course/actionResult";
import { useLessonClarifications } from "~/app/_components/learn/useLessonClarifications";
import { useLessonCheckpoints } from "~/app/_components/learn/useLessonCheckpoints";
import {
  useLessonTeachStream,
  type LessonTeachCheckpointBridge,
} from "~/app/_components/learn/useLessonTeachStream";
import {
  parseLessonSections,
  restoreLessonRuntimeState,
  type PersistedLessonCheckpointState,
} from "~/lib/lessonCheckpoints";

export function LessonPhase({
  courseId,
  spaceId,
  currentModuleIndex,
  currentLessonIndex,
  focusModeEnabled,
  onToggleFocusMode,
  onReturnToActiveLesson,
  modules,
  lessons,
}: {
  courseId: string;
  spaceId: string;
  currentModuleIndex: number;
  currentLessonIndex: number;
  focusModeEnabled: boolean;
  onToggleFocusMode: () => void;
  onReturnToActiveLesson: () => void;
  modules: Array<{ _id: string; moduleIndex: number; moduleTitle: string; subTopics: string }>;
  lessons: Array<{ _id: string; moduleId: string; lessonIndex: number; title: string; focusArea: string; status: string; masteryGoals?: string; knowledgePieceId?: string; verifierLogs?: string; checkpointStates?: PersistedLessonCheckpointState[] }>;
}) {
  const currentModule = modules.find((m) => m.moduleIndex === currentModuleIndex);
  const moduleLessons = lessons
    .filter((l) => l.moduleId === currentModule?._id)
    .sort((a, b) => a.lessonIndex - b.lessonIndex);
  const currentLesson = moduleLessons[currentLessonIndex];

  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isAdvancingCourse, setIsAdvancingCourse] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const content = `Feels hard: "${text.slice(0, 200)}"`;

    try {
      if (lesson?.knowledgePieceId) {
        await createFeelsHardNodeAction(spaceId, lesson.knowledgePieceId, content);
      } else if (lesson?._id) {
        await queueFeelsHardNodeAction(lesson._id, content);
      } else {
        return;
      }
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
  const currentLessonId = currentLesson?._id ?? null;
  const currentLessonCheckpointStates = currentLesson?.checkpointStates;
  const currentLessonVerifierLogs = currentLesson?.verifierLogs;
  const restoredLessonRuntime = useMemo(() => {
    if (!currentLessonId || lessonMessages === undefined) return null;

    return restoreLessonRuntimeState({
      lessonMessages,
      verifierLogs: currentLessonVerifierLogs,
      checkpointStates: currentLessonCheckpointStates,
    });
  }, [
    currentLessonCheckpointStates,
    currentLessonId,
    currentLessonVerifierLogs,
    lessonMessages,
  ]);

  // Bridge teach SSE → checkpoint UI without circular hook order
  const checkpointBridgeRef = useRef<LessonTeachCheckpointBridge>({
    resetForTeach: () => {},
    revealFirstSection: () => {},
    applyTeachDone: () => {},
  });

  const { fullText, setFullText, isTeaching } = useLessonTeachStream({
    currentLesson,
    currentLessonId,
    lessonMessages,
    restoredLessonRuntime,
    setError,
    checkpointBridgeRef,
  });

  const sections = useMemo(() => parseLessonSections(fullText), [fullText]);
  const totalSections = sections.length;
  const hasLessonCompleteMarker = fullText.includes("[LESSON_COMPLETE]");

  const {
    revealedCount,
    currentInputRequest,
    userInput,
    setUserInput,
    lastVerification,
    answeredCheckpoints,
    handleSubmitInput,
    handleSkip,
    resetForTeach,
    revealFirstSection,
    applyTeachDone,
  } = useLessonCheckpoints({
    currentLesson,
    fullText,
    setFullText,
    sections,
    hasLessonCompleteMarker,
    restoredLessonRuntime,
    setError,
  });

  checkpointBridgeRef.current = {
    resetForTeach,
    revealFirstSection,
    applyTeachDone,
  };

  const {
    selectionState,
    setSelectionState,
    clarificationThreads,
    bubbleInitialChars,
    handleClarify,
    handleClarificationReply,
    toggleThreadExpanded,
  } = useLessonClarifications({
    currentLesson,
    fullText,
    lessonMessages,
    lessonContentRef,
    revealedCount,
  });

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

  const handleSummarize = async () => {
    if (!currentLesson) return;
    setIsSummarizing(true);
    setError(null);
    try {
      unwrapActionResult(
        await completeLessonAction(currentLesson._id),
        "Failed to complete lesson",
      );
      unwrapActionResult(
        await summarizeLessonAction(currentLesson._id),
        "Failed to generate knowledge piece",
      );
      unwrapActionResult(
        await advanceCourseAction(courseId),
        "Failed to advance course",
      );
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
            isSubmitting={false}
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
                      const existing = acc[t.blockIndex] ?? null;
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
                              onToggleExpanded={() => toggleThreadExpanded(t.threadId)}
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
                        onKeyDown={(e) => e.key === "Enter" && void handleSubmitInput()}
                        placeholder="Type your answer..."
                        className="flex-1 bg-neutral-950 border border-white/10 rounded-lg px-3 py-2.5 text-[15px] text-primary placeholder:text-neutral-600 focus-ring"
                      />
                      <button
                        disabled={!userInput.trim()}
                        onClick={() => { void handleSubmitInput(); }}
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
                      onClick={() => { void handleSkip(); }}
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
            onKeyDown={(e) => e.stopPropagation()}
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

      {/* Inline practice — 1-3 exercises built from this lesson, once its content is fully revealed */}
      {totalSections > 0 && revealedCount >= totalSections && !isTeaching && !isSummarizing && !currentInputRequest && (
        <LessonPractice content={fullText} title={currentLesson?.title} />
      )}

      {/* Lesson complete — show when all sections revealed and not streaming */}
      {!currentInputRequest && (hasLessonCompleteMarker || (revealedCount >= totalSections && totalSections > 0)) && revealedCount >= totalSections && !isTeaching && !isSummarizing && (
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
                    const advanceResult = unwrapActionResult(
                      await advanceCourseAction(courseId),
                      "Failed to advance course",
                    );
                    if (advanceResult.nextPhase !== "lesson_summary") {
                      onReturnToActiveLesson();
                    }
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
