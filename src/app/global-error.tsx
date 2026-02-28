"use client";

import posthog from "posthog-js";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  useEffect(() => {
    posthog.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <NextError statusCode={0} />
        <button
          onClick={reset}
          style={{ display: "block", margin: "1rem auto", padding: "0.5rem 1rem" }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
