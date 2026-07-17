"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";
import {
  createFeelsHardNodeAction,
  queueFeelsHardNodeAction,
} from "../../actions/knowledge";

type LessonRef = {
  _id: string;
  knowledgePieceId?: string;
} | null | undefined;

/**
 * Right-click "Feels Hard" context menu + toast for lesson content.
 * Extracted from LessonPhase (F-W7-009 / P8-A).
 */
export function useFeelsHardMenu(opts: {
  lessonContentRef: RefObject<HTMLDivElement | null>;
  spaceId: string;
  currentLesson: LessonRef;
}): {
  contextMenu: { x: number; y: number; selectedText: string } | null;
  feelsHardFeedback: string | null;
  handleFeelsHard: (text: string) => Promise<void>;
  dismissContextMenu: () => void;
} {
  const { lessonContentRef, spaceId, currentLesson } = opts;
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    selectedText: string;
  } | null>(null);
  const [feelsHardFeedback, setFeelsHardFeedback] = useState<string | null>(null);

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
  }, [lessonContentRef]);

  const handleFeelsHard = useCallback(
    async (text: string) => {
      setContextMenu(null);
      const content = `Feels hard: "${text.slice(0, 200)}"`;
      try {
        if (currentLesson?.knowledgePieceId) {
          await createFeelsHardNodeAction(
            spaceId,
            currentLesson.knowledgePieceId,
            content,
          );
        } else if (currentLesson?._id) {
          await queueFeelsHardNodeAction(currentLesson._id, content);
        } else {
          return;
        }
        setFeelsHardFeedback("Marked as hard — we'll focus on this! 💪");
        setTimeout(() => setFeelsHardFeedback(null), 2000);
      } catch {
        setFeelsHardFeedback("Failed to save, try again.");
        setTimeout(() => setFeelsHardFeedback(null), 2000);
      }
    },
    [spaceId, currentLesson],
  );

  return {
    contextMenu,
    feelsHardFeedback,
    handleFeelsHard,
    dismissContextMenu: () => setContextMenu(null),
  };
}
