"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { advanceCourseAction } from "../../../../actions/learn";

export function GeneratingPhase({ courseId, phase }: { courseId: string; phase: string }) {
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
