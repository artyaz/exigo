"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useEffect } from "react";
import { FileText, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  TestStackCard,
  formatTestTypeLabel,
  getProgressStatus,
} from "../_components/tests/TestStackCard";

/**
 * Global tests list: all of the signed-in user's tests across spaces.
 */
export default function TestsPage() {
  const { userId } = useAuth();
  const tests = useQuery(api.tests.listAll, userId ? {} : "skip");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") window.history.back();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const total = tests?.length ?? 0;

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-12">
      <div className="max-w-5xl mx-auto">
        <header className="mb-12 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/spaces"
              className="p-2.5 glass-card rounded-xl hover:bg-white/5 spring-interact text-secondary hover:text-primary"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-primary">
                Tests
              </h1>
              <p className="text-secondary text-sm mt-1">
                {total > 0
                  ? `${total} test${total === 1 ? "" : "s"}`
                  : "All your knowledge challenges in one place."}
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-tertiary">
            <kbd className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[11px] font-mono">
              Esc
            </kbd>
            <span className="text-xs">Back</span>
          </div>
        </header>

        {!tests ? (
          <div className="flex justify-center p-24">
            <Loader2 className="w-8 h-8 animate-spin text-white/30" />
          </div>
        ) : tests.length === 0 ? (
          <div className="text-center p-24 space-y-4">
            <FileText className="w-16 h-16 mx-auto text-white/10" />
            <p className="text-secondary text-lg">No tests yet.</p>
            <p className="text-tertiary text-sm">
              Generate a test from any of your spaces to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
            {tests.map((test, index) => {
              const target = test.config?.questionCount ?? 5;
              return (
                <TestStackCard
                  key={test._id}
                  id={test._id}
                  href={`/tests/${test._id}`}
                  stackDepth={test.questionCount}
                  status={getProgressStatus(test.answeredCount, target)}
                  typeLabel={formatTestTypeLabel(test.config?.type)}
                  eyebrow={test.spaceName}
                  title={`Test #${total - index}`}
                  answered={test.answeredCount}
                  target={target}
                  secondaryCountLabel={`${test.questionCount} questions`}
                  createdAt={test._creationTime}
                  showOpenCta
                  animationDelay={index * 0.04}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
