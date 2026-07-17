"use client";

import { useState, useEffect, useCallback, type RefObject } from "react";
import type { ClarificationMessage } from "~/app/_components/learn/ClarificationThread";

export type ClarificationThreadState = {
  quote: string;
  threadId: string;
  sectionIndex: number;
  blockIndex: number;
  messages: ClarificationMessage[];
  streamingText?: string;
  isLoading: boolean;
  isExpanded: boolean;
};

export type SelectionState = {
  quote: string;
  position: { top: number; left: number };
  sectionIndex: number;
  blockIndex: number;
  /** If set, submission should reply to this thread instead of creating a new one */
  replyThreadId?: string;
};

type LessonMessageRow = {
  messageType?: string;
  threadId?: string;
  clarificationQuote?: string;
  clarificationSectionIndex?: number;
  clarificationBlockIndex?: number;
  role: ClarificationMessage["role"] | string;
  content: string;
};

/**
 * Selection bubble, clarification threads Map, clarify SSE, and DB restore.
 * Leaves JSX composition to the phase component.
 */
export function useLessonClarifications(opts: {
  currentLesson: { _id: string } | null | undefined;
  fullText: string;
  lessonMessages: LessonMessageRow[] | undefined;
  lessonContentRef: RefObject<HTMLDivElement | null>;
  revealedCount: number;
}): {
  selectionState: SelectionState | null;
  setSelectionState: React.Dispatch<React.SetStateAction<SelectionState | null>>;
  clarificationThreads: Map<string, ClarificationThreadState>;
  bubbleInitialChars: string;
  handleClarify: (
    quote: string,
    question: string,
    sectionIndex: number,
    blockIndex: number,
  ) => void;
  handleClarificationReply: (threadId: string, question: string) => void;
  toggleThreadExpanded: (threadId: string) => void;
} {
  const {
    currentLesson,
    fullText,
    lessonMessages,
    lessonContentRef,
    revealedCount,
  } = opts;

  const [selectionState, setSelectionState] = useState<SelectionState | null>(null);
  const [clarificationThreads, setClarificationThreads] = useState<
    Map<string, ClarificationThreadState>
  >(new Map());
  const [bubbleInitialChars, setBubbleInitialChars] = useState("");

  // ─── Text selection + keydown trigger ───
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

        while (
          blockNode &&
          (blockNode as Element).hasAttribute &&
          !(blockNode as Element).hasAttribute("data-block-index")
        ) {
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
  }, [selectionState, clarificationThreads, revealedCount, lessonContentRef]);

  // Restore clarification threads from DB on mount / message count change
  useEffect(() => {
    if (!lessonMessages) return;
    const clarificationMsgs = lessonMessages.filter(
      (m) => m.messageType === "clarification" && m.threadId,
    );
    if (clarificationMsgs.length === 0) return;

    const threadMap = new Map<string, ClarificationThreadState>();

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
  const streamClarification = useCallback(
    async (
      quote: string,
      question: string,
      threadId: string,
      sectionIndex: number,
      blockIndex: number,
    ) => {
      if (!currentLesson) return;

      // Optimistically add user message
      setClarificationThreads((prev) => {
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
                setClarificationThreads((prev) => {
                  const next = new Map(prev);
                  const t = next.get(threadId);
                  if (t) {
                    next.set(threadId, { ...t, streamingText: snap });
                  }
                  return next;
                });
              } else if (payload.type === "done") {
                const finalText = payload.fullText ?? accumulated;
                setClarificationThreads((prev) => {
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
                setClarificationThreads((prev) => {
                  const next = new Map(prev);
                  const t = next.get(threadId);
                  if (t) {
                    next.set(threadId, {
                      ...t,
                      messages: [
                        ...t.messages,
                        {
                          role: "teacher",
                          content: "Something went wrong. Please try again.",
                        },
                      ],
                      streamingText: undefined,
                      isLoading: false,
                    });
                  }
                  return next;
                });
              }
            } catch {
              /* skip malformed SSE */
            }
          }
        }
      } catch {
        setClarificationThreads((prev) => {
          const next = new Map(prev);
          const t = next.get(threadId);
          if (t) {
            next.set(threadId, {
              ...t,
              messages: [
                ...t.messages,
                {
                  role: "teacher",
                  content: "Something went wrong. Please try again.",
                },
              ],
              streamingText: undefined,
              isLoading: false,
            });
          }
          return next;
        });
      }
    },
    [currentLesson, fullText],
  );

  const handleClarify = useCallback(
    (quote: string, question: string, sectionIndex: number, blockIndex: number) => {
      const threadId = `clarify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setSelectionState(null);
      void streamClarification(quote, question, threadId, sectionIndex, blockIndex);
    },
    [streamClarification],
  );

  const handleClarificationReply = useCallback(
    (threadId: string, question: string) => {
      const thread = clarificationThreads.get(threadId);
      if (!thread) return;
      void streamClarification(
        thread.quote,
        question,
        threadId,
        thread.sectionIndex,
        thread.blockIndex,
      );
    },
    [clarificationThreads, streamClarification],
  );

  const toggleThreadExpanded = useCallback((threadId: string) => {
    setClarificationThreads((prev) => {
      const next = new Map(prev);
      const thread = next.get(threadId);
      if (thread) next.set(threadId, { ...thread, isExpanded: !thread.isExpanded });
      return next;
    });
  }, []);

  return {
    selectionState,
    setSelectionState,
    clarificationThreads,
    bubbleInitialChars,
    handleClarify,
    handleClarificationReply,
    toggleThreadExpanded,
  };
}
