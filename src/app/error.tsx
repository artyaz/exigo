"use client";

import posthog from "posthog-js";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    posthog.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <button
        onClick={reset}
        className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200"
      >
        Try again
      </button>
    </div>
  );
}
