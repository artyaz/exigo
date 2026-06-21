"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";

export default function Home() {
  const { isSignedIn } = useUser();

  return (
    <main className="relative min-h-screen bg-black px-6 py-12 text-white md:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:24px_24px]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-5xl flex-col justify-between">
        <section className="space-y-8 rounded-2xl border border-white/10 bg-neutral-950/60 p-8 shadow-[0_2px_14px_-6px_rgba(0,0,0,0.9)] backdrop-blur-sm md:p-10">
          <div className="space-y-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Exigo</p>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
              AI-powered study spaces for precise, focused learning.
            </h1>
            <p className="max-w-2xl text-sm text-white/60 md:text-base">
              Organize knowledge, generate tests, and track weak points with a minimal, fast workflow.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={isSignedIn ? "/spaces" : "/sign-up"}
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black hover:bg-neutral-200 spring-interact"
            >
              Get started
            </Link>
            <Link
              href="/pricing"
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white/80 hover:bg-white/[0.06] hover:text-white spring-interact"
            >
              Pricing
            </Link>
          </div>
        </section>

        <footer className="mt-8 flex flex-wrap items-center gap-4 text-xs text-white/60">
          <Link href="/terms" className="hover:text-white transition-colors spring-interact">
            Terms
          </Link>
          <Link href="/terms#privacy-policy" className="hover:text-white transition-colors spring-interact">
            Privacy
          </Link>
          <Link href="/terms#refund-policy" className="hover:text-white transition-colors spring-interact">
            Refunds
          </Link>
          <Link href="/pricing" className="hover:text-white transition-colors spring-interact">
            Pricing
          </Link>
        </footer>
      </div>
    </main>
  );
}
