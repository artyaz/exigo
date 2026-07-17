"use client";

import { useState, useEffect, useRef, useCallback, type MutableRefObject } from "react";
import {
  parseLessonSections,
  type RestoredLessonRuntimeState,
} from "~/lib/lessonCheckpoints";
import type { TeachDoneArgs } from "~/app/_components/learn/useLessonCheckpoints";

/** Methods supplied by useLessonCheckpoints; read via ref to avoid declaration-order cycles. */
export type LessonTeachCheckpointBridge = {
  resetForTeach: () => void;
  revealFirstSection: () => void;
  applyTeachDone: (args: TeachDoneArgs) => void;
};

/**
 * Progressive teach SSE: fullText, isTeaching, start-once auto-start.
 * Checkpoint reveal/input mutations go through `checkpointBridgeRef`.
 */
export function useLessonTeachStream(opts: {
  currentLesson: { _id: string } | null | undefined;
  currentLessonId: string | null;
  lessonMessages: unknown[] | undefined;
  restoredLessonRuntime: RestoredLessonRuntimeState | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  checkpointBridgeRef: MutableRefObject<LessonTeachCheckpointBridge>;
}): {
  fullText: string;
  setFullText: React.Dispatch<React.SetStateAction<string>>;
  isTeaching: boolean;
  teach: () => Promise<void>;
} {
  const {
    currentLesson,
    currentLessonId,
    lessonMessages,
    restoredLessonRuntime,
    setError,
    checkpointBridgeRef,
  } = opts;

  const [fullText, setFullText] = useState("");
  const [isTeaching, setIsTeaching] = useState(false);
  const teachStartedForLessonRef = useRef<string | null>(null);

  const teach = useCallback(async () => {
    if (!currentLesson) return;
    setIsTeaching(true);
    setError(null);
    setFullText("");
    checkpointBridgeRef.current.resetForTeach();

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
              inputRequest?: {
                type: string;
                question: string;
                expectedAnswer: string;
              } | null;
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
                checkpointBridgeRef.current.revealFirstSection();
              }
            } else if (payload.type === "done") {
              const final = payload.fullText ?? accumulated;
              setFullText(final);

              // Pause at first input request
              const parsed = parseLessonSections(final);
              checkpointBridgeRef.current.applyTeachDone({
                finalText: final,
                isComplete: payload.isComplete ?? false,
                inputRequest: payload.inputRequest,
                parsed,
              });
            } else if (payload.type === "error") {
              setError(payload.error ?? "Teaching failed");
            }
          } catch {
            /* skip malformed SSE */
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Teaching failed");
    } finally {
      setIsTeaching(false);
    }
  }, [checkpointBridgeRef, currentLesson, setError]);

  // Start teaching only after the lesson snapshot has definitively loaded empty.
  useEffect(() => {
    if (!currentLessonId || lessonMessages === undefined) return;
    if (restoredLessonRuntime?.fullText) return;
    if (fullText.length > 0 || isTeaching) return;
    if (teachStartedForLessonRef.current === currentLessonId) return;

    teachStartedForLessonRef.current = currentLessonId;
    void teach();
  }, [currentLessonId, fullText, isTeaching, lessonMessages, restoredLessonRuntime, teach]);

  return {
    fullText,
    setFullText,
    isTeaching,
    teach,
  };
}
