"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

type PaddleEvent = {
  name?: string;
};

type PaddleSDK = {
  Environment: {
    set: (environment: "sandbox" | "live") => void;
  };
  Checkout: {
    open: (options: {
      transactionId: string;
      settings?: {
        displayMode?: "inline" | "overlay";
        frameTarget?: string;
        frameInitialHeight?: number;
        frameStyle?: string;
      };
    }) => void;
  };
  Initialize: (options: {
    token: string;
    eventCallback?: (event: PaddleEvent) => void;
  }) => void;
};

declare global {
  interface Window {
    Paddle?: PaddleSDK;
  }
}

function removeTransactionQueryParam() {
  const currentUrl = new URL(window.location.href);
  if (!currentUrl.searchParams.has("_ptxn")) return;
  currentUrl.searchParams.delete("_ptxn");
  window.history.replaceState(null, "", currentUrl.toString());
}

export function PaddleCheckoutReceiver({ token }: { token?: string }) {
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [isCheckoutOpened, setIsCheckoutOpened] = useState(false);

  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams(window.location.search);
    setTransactionId(params.get("_ptxn"));
  }, [token]);

  useEffect(() => {
    if (!token || !transactionId || !isScriptLoaded || isCheckoutOpened) return;

    const paddle = window.Paddle;
    if (!paddle) return;

    if (token.startsWith("test_")) {
      paddle.Environment.set("sandbox");
    }

    paddle.Initialize({
      token,
      eventCallback: (event) => {
        if (event.name === "checkout.completed" || event.name === "checkout.closed") {
          removeTransactionQueryParam();
        }
      },
    });
    paddle.Checkout.open({ transactionId });
    setIsCheckoutOpened(true);
  }, [isCheckoutOpened, isScriptLoaded, token, transactionId]);

  if (!token) return null;

  return (
    <Script
      src="https://cdn.paddle.com/paddle/v2/paddle.js"
      strategy="afterInteractive"
      onLoad={() => setIsScriptLoaded(true)}
    />
  );
}
