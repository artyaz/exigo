"use client";

import Link from "next/link";
import Script from "next/script";
import { Loader2 } from "lucide-react";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { useEffect, useState } from "react";

export default function CheckoutPage() {
  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;

  const [planSlug, setPlanSlug] = useState<string | null>(null);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [isCheckoutOpened, setIsCheckoutOpened] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPlanSlug(params.get("planSlug"));
  }, []);

  useEffect(() => {
    if (planSlug === null) return; // still loading from URL
    if (!planSlug) {
      setError("Missing planSlug");
      return;
    }
    setError(null);
    if (!token) {
      setError("Missing NEXT_PUBLIC_PADDLE_CLIENT_TOKEN");
      return;
    }

    let cancelled = false;
    const loadTransaction = async () => {
      setError(null);
      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planSlug }),
        });
        if (!res.ok) {
          if (!cancelled) setError(await res.text());
          return;
        }
        const data = (await res.json()) as { transactionId?: string };
        if (!data.transactionId) {
          if (!cancelled) setError("Missing transactionId");
          return;
        }
        if (!cancelled) {
          setError(null);
          setTransactionId(data.transactionId);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    };
    void loadTransaction();
    return () => {
      cancelled = true;
    };
  }, [planSlug, token]);

  useEffect(() => {
    if (!token || !transactionId || !isScriptLoaded || isCheckoutOpened) return;
    const paddle = window.Paddle;
    if (!paddle) return;
    const frameContainer = document.getElementsByClassName("paddle-inline-checkout")[0];
    if (!frameContainer) return;

    if (token.startsWith("test_")) {
      paddle.Environment.set("sandbox");
    }

    paddle.Initialize({
      token,
      eventCallback: (event) => {
        if (event.name === "checkout.completed") {
          window.location.href = "/pricing";
        }
      },
    });

    paddle.Checkout.open({
      transactionId,
      settings: {
        displayMode: "inline",
        frameTarget: "paddle-inline-checkout",
        frameInitialHeight: 640,
        frameStyle: "width: 100%; min-width: 312px; background: transparent; border: 0;",
      },
    });
    setIsCheckoutOpened(true);
  }, [isCheckoutOpened, isScriptLoaded, token, transactionId]);

  return (
    <div className="min-h-screen bg-black text-white px-5 py-8 md:px-10">
      <SignedOut>
        <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
          <p className="mb-4 text-white/80">Please sign in to continue checkout.</p>
          <Link href="/sign-in" className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black">
            Sign in
          </Link>
        </div>
      </SignedOut>
      <SignedIn>
        <div className="mx-auto w-full max-w-3xl">
          <div className="mb-5 flex items-center justify-between">
            <h1 className="text-xl font-semibold">Checkout</h1>
            <Link href="/pricing" className="text-sm text-white/60 hover:text-white">
              Back to pricing
            </Link>
          </div>

          {token && (
            <Script
              src="https://cdn.paddle.com/paddle/v2/paddle.js"
              strategy="afterInteractive"
              onLoad={() => setIsScriptLoaded(true)}
              onError={() => setError("Failed to load Paddle checkout script")}
            />
          )}

          {error ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
              {error}
            </div>
          ) : (
            <>
              {!isCheckoutOpened && (
                <div className="mb-4 flex items-center gap-2 text-sm text-white/60">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading secure checkout...
                </div>
              )}
              <div
                id="paddle-inline-checkout"
                className="paddle-inline-checkout w-full rounded-2xl border border-white/10 bg-white p-3"
              />
            </>
          )}
        </div>
      </SignedIn>
    </div>
  );
}
