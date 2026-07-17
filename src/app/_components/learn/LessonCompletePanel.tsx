"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Loader2 } from "lucide-react";

/**
 * Post-lesson CTAs: generate knowledge piece vs continue after summarize.
 * Extracted from LessonPhase (F-W7-009 / P8-A).
 */
export function LessonCompletePanel(props: {
  status: string | undefined;
  isSummarizing: boolean;
  isAdvancingCourse: boolean;
  onSummarize: () => void;
  onAdvance: () => void;
}) {
  const { status, isSummarizing, isAdvancingCourse, onSummarize, onAdvance } =
    props;

  if (status && ["summarized", "integrated"].includes(status)) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="lesson-callout text-center py-6 space-y-4"
      >
        <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400" />
        <h3 className="text-base font-medium text-primary">
          Knowledge Piece Generated
        </h3>
        <p className="text-sm text-white/40">
          Your knowledge piece has been saved.
        </p>
        {isAdvancingCourse ? (
          <div className="flex items-center justify-center gap-2 text-white/50 text-sm py-3">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Advancing...</span>
          </div>
        ) : (
          <button
            onClick={onAdvance}
            className="bg-white text-black font-medium px-6 py-3 rounded-xl spring-interact hover:opacity-90 text-sm"
            type="button"
          >
            Continue →
          </button>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="lesson-callout text-center py-6 space-y-4"
    >
      <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400" />
      <h3 className="text-base font-medium text-primary">Lesson Complete</h3>
      <p className="text-sm text-white/40">
        Ready to generate your knowledge piece.
      </p>
      <button
        onClick={onSummarize}
        disabled={isSummarizing}
        className="bg-white text-black font-medium px-6 py-3 rounded-xl spring-interact hover:opacity-90 disabled:opacity-50 text-sm"
        type="button"
      >
        Generate Knowledge Piece →
      </button>
    </motion.div>
  );
}
