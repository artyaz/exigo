"use client";

import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useState, useEffect, useMemo, useCallback } from "react";
import { verifyInputAction } from "~/app/actions/learn";
import {
  serializeCheckpointMap,
  serializeVerification,
} from "~/app/_components/learn/course/checkpointSerialize";
import {
  shouldMarkLessonComplete,
  type LessonInputRequest,
  type LessonSection,
  type LessonVerification,
  type RestoredCheckpointState as CheckpointState,
  type RestoredLessonRuntimeState,
} from "~/lib/lessonCheckpoints";

export type TeachDoneArgs = {
  finalText: string;
  isComplete: boolean;
  /** From SSE payload, if present; otherwise first section's request is used */
  inputRequest?: LessonInputRequest | null;
  parsed: LessonSection[];
};

/**
 * Checkpoint UI state: reveal cursor, answered map, verify/skip/advance, DB restore.
 * Teach stream owns `fullText`; restore writes through `setFullText`.
 */
export function useLessonCheckpoints(opts: {
  currentLesson: { _id: string } | null | undefined;
  fullText: string;
  setFullText: React.Dispatch<React.SetStateAction<string>>;
  sections: LessonSection[];
  hasLessonCompleteMarker: boolean;
  restoredLessonRuntime: RestoredLessonRuntimeState | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}): {
  revealedCount: number;
  currentInputRequest: LessonInputRequest | null;
  userInput: string;
  setUserInput: React.Dispatch<React.SetStateAction<string>>;
  lastVerification: LessonVerification | null;
  answeredCheckpoints: Map<number, CheckpointState>;
  isLessonComplete: boolean;
  advanceToNextCheckpoint: (opts?: {
    answer?: string;
    skipped?: boolean;
    verification?: LessonVerification;
  }) => void;
  handleSubmitInput: () => Promise<void>;
  handleSkip: () => Promise<void>;
  /** Clear progress UI when a new teach stream starts */
  resetForTeach: () => void;
  /** While streaming, ensure at least the first section is revealed */
  revealFirstSection: () => void;
  /** Apply teach SSE `done` payload to checkpoint / reveal state */
  applyTeachDone: (args: TeachDoneArgs) => void;
} {
  const {
    currentLesson,
    fullText,
    setFullText,
    sections,
    hasLessonCompleteMarker,
    restoredLessonRuntime,
    setError,
  } = opts;

  const [revealedCount, setRevealedCount] = useState(0);
  const [currentInputRequest, setCurrentInputRequest] = useState<LessonInputRequest | null>(
    null,
  );
  const [userInput, setUserInput] = useState("");
  const [lastVerification, setLastVerification] = useState<LessonVerification | null>(null);
  const [answeredCheckpoints, setAnsweredCheckpoints] = useState<Map<number, CheckpointState>>(
    new Map(),
  );
  const [isLessonComplete, setIsLessonComplete] = useState(false);

  const saveCheckpointState = useMutation(api.courseLessons.saveCheckpointState);

  const currentAnsweredCheckpointsKey = useMemo(
    () => serializeCheckpointMap(answeredCheckpoints),
    [answeredCheckpoints],
  );
  const restoredAnsweredCheckpointsKey = useMemo(
    () =>
      restoredLessonRuntime
        ? serializeCheckpointMap(restoredLessonRuntime.answeredCheckpoints)
        : "[]",
    [restoredLessonRuntime],
  );

  // Restore from DB whenever the active lesson snapshot changes.
  useEffect(() => {
    if (!restoredLessonRuntime) return;

    const currentInputQuestion = currentInputRequest?.question ?? null;
    const restoredInputQuestion = restoredLessonRuntime.currentInputRequest?.question ?? null;
    const waitingForLocalAdvance =
      lastVerification?.is_correct === true &&
      currentInputQuestion !== null &&
      currentInputQuestion !== restoredInputQuestion;

    if (waitingForLocalAdvance) return;

    const needsRestore =
      fullText !== restoredLessonRuntime.fullText ||
      revealedCount !== restoredLessonRuntime.revealedCount ||
      currentInputQuestion !== restoredInputQuestion ||
      currentAnsweredCheckpointsKey !== restoredAnsweredCheckpointsKey ||
      serializeVerification(lastVerification) !==
        serializeVerification(restoredLessonRuntime.lastVerification) ||
      isLessonComplete !== restoredLessonRuntime.isLessonComplete;

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
    setFullText,
  ]);

  const resetForTeach = useCallback(() => {
    setAnsweredCheckpoints(new Map());
    setCurrentInputRequest(null);
    setIsLessonComplete(false);
    setLastVerification(null);
    setRevealedCount(0);
    setUserInput("");
  }, []);

  const revealFirstSection = useCallback(() => {
    setRevealedCount((prev) => Math.max(prev, 1));
  }, []);

  const applyTeachDone = useCallback((args: TeachDoneArgs) => {
    const nextInputRequest =
      args.inputRequest ?? args.parsed[0]?.inputRequest ?? null;
    setIsLessonComplete(
      shouldMarkLessonComplete({
        hasCompletionSignal: args.isComplete,
        currentInputRequest: nextInputRequest,
      }),
    );

    if (nextInputRequest) {
      setCurrentInputRequest(nextInputRequest);
      setRevealedCount(1);
    } else {
      setCurrentInputRequest(null);
      setRevealedCount(args.parsed.length);
    }
  }, []);

  // Advance past the current checkpoint, revealing content until the next checkpoint or end
  const advanceToNextCheckpoint = useCallback(
    (advanceOpts?: {
      answer?: string;
      skipped?: boolean;
      verification?: LessonVerification;
    }) => {
      // Record the current checkpoint as answered/skipped
      const currentSectionIdx = revealedCount - 1;
      if (currentSectionIdx >= 0 && sections[currentSectionIdx]?.inputRequest) {
        setAnsweredCheckpoints((prev) => {
          const next = new Map(prev);
          next.set(currentSectionIdx, {
            answer: advanceOpts?.answer,
            skipped: advanceOpts?.skipped,
            verification: advanceOpts?.verification,
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
      setIsLessonComplete(
        shouldMarkLessonComplete({
          hasCompletionSignal: hasLessonCompleteMarker,
          currentInputRequest: null,
        }),
      );
    },
    [hasLessonCompleteMarker, revealedCount, sections],
  );

  const handleSubmitInput = useCallback(async () => {
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
  }, [
    advanceToNextCheckpoint,
    currentInputRequest,
    currentLesson,
    revealedCount,
    setError,
    userInput,
  ]);

  const handleSkip = useCallback(async () => {
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
  }, [
    advanceToNextCheckpoint,
    currentLesson,
    revealedCount,
    saveCheckpointState,
    sections,
    setError,
  ]);

  return {
    revealedCount,
    currentInputRequest,
    userInput,
    setUserInput,
    lastVerification,
    answeredCheckpoints,
    isLessonComplete,
    advanceToNextCheckpoint,
    handleSubmitInput,
    handleSkip,
    resetForTeach,
    revealFirstSection,
    applyTeachDone,
  };
}
