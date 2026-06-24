"use client";
/* Inline practice exercises for a completed lesson. On demand it asks the
   server for 1-3 briefs derived from the lesson content, builds each as a
   self-contained embed exercise, and renders them (commentable). Additive —
   it lives at the bottom of a finished lesson and never touches teaching. */
import React from "react";
import { Loader2, Sparkles, RefreshCw } from "lucide-react";
import { EmbedExercise } from "../exercises/embed";
import { Commentable } from "../exercises/comments/Commentable";

interface BuiltEx {
  description: string;
  html: string;
  error?: string;
}

export function LessonPractice({ content, title }: { content: string; title?: string }): React.JSX.Element {
  const [state, setState] = React.useState<"idle" | "loading" | "done" | "error">("idle");
  const [exercises, setExercises] = React.useState<BuiltEx[]>([]);

  const generate = async (): Promise<void> => {
    setState("loading");
    try {
      const res = await fetch("/api/generate/lesson-exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, title }),
      });
      const data = (await res.json()) as { exercises?: BuiltEx[]; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? `Request failed (${res.status})`);
      setExercises(data.exercises ?? []);
      setState("done");
    } catch {
      setState("error");
    }
  };

  const built = exercises.filter((e) => e.html);

  return (
    <div className="mt-6 border-t border-white/10 pt-6 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-medium text-white">Practice</h3>
        {state === "done" && built.length > 0 ? (
          <button
            onClick={() => void generate()}
            className="ml-auto inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white spring-interact"
          >
            <RefreshCw className="w-3 h-3" /> regenerate
          </button>
        ) : null}
      </div>

      {state === "idle" ? (
        <button
          onClick={() => void generate()}
          className="bg-white text-black font-medium px-5 py-2.5 rounded-xl spring-interact hover:opacity-90 text-sm"
        >
          Practice what you learned →
        </button>
      ) : null}

      {state === "loading" ? (
        <div className="flex items-center gap-2 text-white/50 text-sm py-3">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Building 1–3 exercises from this lesson…</span>
        </div>
      ) : null}

      {state === "error" ? <p className="text-sm text-rose-400">Couldn&apos;t build exercises. Try again.</p> : null}

      {state === "done" && built.length === 0 ? (
        <p className="text-sm text-white/40">No exercises were produced for this lesson.</p>
      ) : null}

      <div className="space-y-5">
        {built.map((ex, i) => (
          <Commentable key={i} html={ex.html} source="lesson" context={`${title ?? "Lesson"} — ${ex.description}`}>
            <EmbedExercise html={ex.html} />
          </Commentable>
        ))}
      </div>
    </div>
  );
}
