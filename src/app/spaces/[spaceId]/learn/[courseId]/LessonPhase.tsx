"use client";

import { useMutation, useQuery } from "convex/react";
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
  verifyInputAction,
  completeLessonAction,
  summarizeLessonAction,
} from "../../../../actions/learn";
import { createFeelsHardNodeAction, queueFeelsHardNodeAction } from "../../../../actions/knowledge";
import { LessonMarkdown } from "~/app/_components/learn/LessonMarkdown";
import { LessonPractice } from "~/app/_components/learn/LessonPractice";
import { SelectionBubble } from "~/app/_components/learn/SelectionBubble";
import { ClarificationThread, type ClarificationMessage } from "~/app/_components/learn/ClarificationThread";
import { FocusModeToggle, useActiveFocusTargets } from "~/app/_components/learn/course/focusMode";
import { unwrapActionResult } from "~/app/_components/learn/course/actionResult";
import {
  serializeCheckpointMap,
  serializeVerification,
} from "~/app/_components/learn/course/checkpointSerialize";
import {
  parseLessonSections,
  restoreLessonRuntimeState,
  shouldMarkLessonComplete,
  type LessonInputRequest,
  type LessonVerification,
  type PersistedLessonCheckpointState,
  type RestoredCheckpointState as CheckpointState,
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

  // Full streamed text from AI
  const [fullText, setFullText] = useState("");
  const [isTeaching, setIsTeaching] = useState(false);
  // Progressive reveal: how many sections to show
  const [revealedCount, setRevealedCount] = useState(0);
  // Current input request state for retry flow
  const [currentInputRequest, setCurrentInputRequest] = useState<LessonInputRequest | null>(null);
  const [userInput, setUserInput] = useState("");
  const [lastVerification, setLastVerification] = useState<LessonVerification | null>(null);
  // Track answered/skipped checkpoints: sectionIndex → { answer?, skipped?, verification? }
  const [answeredCheckpoints, setAnsweredCheckpoints] = useState<Map<number, CheckpointState>>(new Map());
  const [isLessonComplete, setIsLessonComplete] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isAdvancingCourse, setIsAdvancingCourse] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const teachStartedForLessonRef = useRef<string | null>(null);

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
  const saveCheckpointState = useMutation(api.courseLessons.saveCheckpointState);
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
  const currentAnsweredCheckpointsKey = useMemo(
    () => serializeCheckpointMap(answeredCheckpoints),
    [answeredCheckpoints],
  );
  const restoredAnsweredCheckpointsKey = useMemo(
    () => restoredLessonRuntime
      ? serializeCheckpointMap(restoredLessonRuntime.answeredCheckpoints)
      : "[]",
    [restoredLessonRuntime],
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
  const isClarifySubmitting = false;

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
        role: msg.role,
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

  // Restore from DB whenever the active lesson snapshot changes.
  useEffect(() => {
    if (!restoredLessonRuntime) return;

    const currentInputQuestion = currentInputRequest?.question ?? null;
    const restoredInputQuestion = restoredLessonRuntime.currentInputRequest?.question ?? null;
    const waitingForLocalAdvance =
      lastVerification?.is_correct === true
      && currentInputQuestion !== null
      && currentInputQuestion !== restoredInputQuestion;

    if (waitingForLocalAdvance) return;

    const needsRestore =
      fullText !== restoredLessonRuntime.fullText
      || revealedCount !== restoredLessonRuntime.revealedCount
      || currentInputQuestion !== restoredInputQuestion
      || currentAnsweredCheckpointsKey !== restoredAnsweredCheckpointsKey
      || serializeVerification(lastVerification) !== serializeVerification(restoredLessonRuntime.lastVerification)
      || isLessonComplete !== restoredLessonRuntime.isLessonComplete;

    if (!needsRestore) return;

    setFullText(restoredLessonRuntime.fullText);
    setAnsweredCheckpoints(new Map(restoredLessonRuntime.answeredCheckpoints));
    setIsLessonComplete(restoredLessonRuntime.isLessonComplete);
    setRevealedCount(restoredLessonRuntime.revealedCount);
    setCurrentInputRequest(restoredLessonRuntime.currentInputRequest);
    setLastVerification(restoredLessonRuntime.lastVerification);
    setUserInput("");
  }, [
    currentAnsweredCheckpointsKey,
    currentInputRequest,
    fullText,
    isLessonComplete,
    lastVerification,
    restoredAnsweredCheckpointsKey,
    restoredLessonRuntime,
    revealedCount,
  ]);

  const teach = useCallback(async () => {
    if (!currentLesson) return;
    setIsTeaching(true);
    setError(null);
    setFullText("");
    setAnsweredCheckpoints(new Map());
    setCurrentInputRequest(null);
    setIsLessonComplete(false);
    setLastVerification(null);
    setRevealedCount(0);
    setUserInput("");

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

              // Pause at first input request
              const parsed = parseLessonSections(final);
              const nextInputRequest = payload.inputRequest ?? parsed[0]?.inputRequest ?? null;
              setIsLessonComplete(shouldMarkLessonComplete({
                hasCompletionSignal: payload.isComplete ?? false,
                currentInputRequest: nextInputRequest,
              }));

              if (nextInputRequest) {
                setCurrentInputRequest(nextInputRequest);
                setRevealedCount(1);
              } else {
                setCurrentInputRequest(null);
                setRevealedCount(parsed.length);
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

  // Start teaching only after the lesson snapshot has definitively loaded empty.
  useEffect(() => {
    if (!currentLessonId || lessonMessages === undefined) return;
    if (restoredLessonRuntime?.fullText) return;
    if (fullText.length > 0 || isTeaching) return;
    if (teachStartedForLessonRef.current === currentLessonId) return;

    teachStartedForLessonRef.current = currentLessonId;
    void teach();
  }, [currentLessonId, fullText, isTeaching, lessonMessages, restoredLessonRuntime, teach]);

  // Advance past the current checkpoint, revealing content until the next checkpoint or end
  const advanceToNextCheckpoint = (opts?: { answer?: string; skipped?: boolean; verification?: LessonVerification }) => {
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
      const upcoming = sections[nextIdx];
      nextIdx += 1;
      // If the next section has a checkpoint, pause there
      if (upcoming?.inputRequest) {
        setRevealedCount(nextIdx);
        setCurrentInputRequest(upcoming.inputRequest);
        return;
      }
    }
    setRevealedCount(sections.length);
    setIsLessonComplete(shouldMarkLessonComplete({
      hasCompletionSignal: hasLessonCompleteMarker,
      currentInputRequest: null,
    }));
  };

  const handleSubmitInput = async () => {
    if (!userInput.trim() || !currentInputRequest || !currentLesson) return;

    const input = userInput.trim();
    const currentSectionIdx = revealedCount - 1;
    setUserInput("");

    try {
      const verifyResult = await verifyInputAction(
        currentLesson._id,
        currentSectionIdx,
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

  const handleSkip = async () => {
    if (!currentLesson) return;

    const currentSectionIdx = revealedCount - 1;
    const currentSection = sections[currentSectionIdx];
    if (!currentSection?.inputRequest) return;

    try {
      await saveCheckpointState({
        lessonId: currentLesson._id as Id<"courseLessons">,
        checkpointState: {
          sectionIndex: currentSectionIdx,
          question: currentSection.inputRequest.question,
          status: "skipped",
        },
      });
      advanceToNextCheckpoint({ skipped: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save checkpoint");
    }
  };

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

      {/* Lesson complete */}
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
