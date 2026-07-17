"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Loader2, ChevronRight } from "lucide-react";
import { advanceCourseAction } from "../../../../actions/learn";
import { LessonMarkdown } from "~/app/_components/learn/LessonMarkdown";
import { FocusModeToggle, useActiveFocusTargets } from "~/app/_components/learn/course/focusMode";
import { unwrapActionResult } from "~/app/_components/learn/course/actionResult";

export function SummaryPhase({
  courseId,
  currentLessonId,
  focusModeEnabled,
  onToggleFocusMode,
  onReturnToActiveLesson,
  lessons,
}: {
  courseId: string;
  currentLessonId: string | null;
  focusModeEnabled: boolean;
  onToggleFocusMode: () => void;
  onReturnToActiveLesson: () => void;
  lessons: Array<{ _id: string; lessonIndex: number; summaryMarkdown?: string; status: string }>;
}) {
  const currentLesson = lessons.find((lesson) => lesson._id === currentLessonId);
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
    setError(null);
    try {
      unwrapActionResult(
        await advanceCourseAction(courseId),
        "Failed to advance course",
      );
      onReturnToActiveLesson();
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
