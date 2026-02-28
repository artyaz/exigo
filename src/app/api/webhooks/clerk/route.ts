import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  createRequestId,
  getErrorAttributes,
  logError,
  logInfo,
  logWarn,
} from "../../../../lib/otlpLogger";

export async function POST(req: NextRequest) {
  const requestId = createRequestId(req.headers);
  try {
    // Read the body text for manual parsing since verifyWebhook strips custom fields
    // when returning the structured standard webhook payload.
    const rawBody = await req.text();

    // Construct a new request so verifyWebhook can read the body again to verify signatures.
    const reqForVerify = new Request(req.url, {
      method: req.method,
      headers: req.headers,
      body: rawBody,
    });
    // Cast via unknown to NextRequest to satisfy strict TS and ESLint rules
    await verifyWebhook(reqForVerify as unknown as NextRequest);

    // After Clerk webhook transformation, the structure of the data changes.
    // Ensure we handle it with the properties we expect.
    type TransformedPayload = {
      eventType?: string;
      userId?: string;
      accessLevel?: number;
      clerkPlanSlug?: string;
      status?: string;
      periodEnd?: number;
      canceledAt?: number;
    };
    const payload = JSON.parse(rawBody) as TransformedPayload;

    const eventType = payload.eventType ?? "";

    logInfo("Clerk webhook received", {
      source: "clerk-webhook",
      requestId,
      eventType,
      userId: payload.userId,
      route: "/api/webhooks/clerk",
    });

    if (
      !eventType.startsWith("subscription") &&
      !eventType.startsWith("subscriptionItem")
    ) {
      logInfo("Clerk webhook ignored (non-subscription event)", {
        source: "clerk-webhook",
        requestId,
        eventType,
      });
      return NextResponse.json({ received: true, skipped: "not_subscription" });
    }

    if (!payload?.userId) {
      logWarn("Clerk webhook missing userId", {
        source: "clerk-webhook",
        requestId,
        eventType,
      });
      return NextResponse.json({ received: true, skipped: "no_userid" });
    }

    const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
    const adminKey = process.env.CONVEX_DEPLOY_KEY;

    if (!convexSiteUrl || !adminKey) {
      logError("Clerk webhook missing Convex configuration", {
        source: "clerk-webhook",
        requestId,
        eventType,
        userId: payload.userId,
      });
      throw new Error("Missing Convex configuration");
    }

    const forwardStartedAt = Date.now();
    logInfo("Forwarding Clerk webhook to Convex", {
      source: "clerk-webhook",
      requestId,
      eventType,
      userId: payload.userId,
      external_service: "convex",
      external_url: `${convexSiteUrl}/clerkWebhook`,
    });

    const timeoutMs = process.env.WEBHOOK_TIMEOUT_MS
      ? parseInt(process.env.WEBHOOK_TIMEOUT_MS, 10)
      : 15000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${convexSiteUrl}/clerkWebhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Convex ${adminKey}`,
        },
        body: JSON.stringify(payload, (k: string, v: unknown): unknown =>
          v === undefined ? undefined : v,
        ),
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
        logError("Convex webhook forwarding timed out", {
          source: "clerk-webhook",
          requestId,
          eventType,
          userId: payload.userId,
          external_service: "convex",
          timeout_ms: timeoutMs,
          duration_ms: Date.now() - forwardStartedAt,
        });
        return NextResponse.json({ error: "Webhook forwarding timed out" }, { status: 504 });
      }
      throw fetchError;
    }
    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text();
      logError("Convex webhook forwarding failed", {
        source: "clerk-webhook",
        requestId,
        eventType,
        userId: payload.userId,
        external_service: "convex",
        http_status: response.status,
        duration_ms: Date.now() - forwardStartedAt,
        response_body: text.slice(0, 500),
      });
      throw new Error(`Convex failed: ${response.status}`);
    }

    logInfo("Convex webhook forwarding succeeded", {
      source: "clerk-webhook",
      requestId,
      eventType,
      userId: payload.userId,
      external_service: "convex",
      http_status: response.status,
      duration_ms: Date.now() - forwardStartedAt,
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    logError("Clerk webhook handler failed", {
      source: "clerk-webhook",
      requestId,
      route: "/api/webhooks/clerk",
      ...getErrorAttributes(error),
    });
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
