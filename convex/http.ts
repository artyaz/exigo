import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { SUBSCRIPTION_STATUSES } from "../shared/subscriptionStatuses";
import type { SubscriptionStatus } from "../shared/subscriptionStatuses";

const MAX_ACCESS_LEVEL = 2;

function isValidStatus(value: unknown): value is SubscriptionStatus {
  return (
    typeof value === "string" &&
    (SUBSCRIPTION_STATUSES as readonly string[]).includes(value)
  );
}

function isValidAccessLevel(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_ACCESS_LEVEL
  );
}

function hashId(id: string): string {
  if (id.length > 8) return `${id.slice(0, 4)}...${id.slice(-4)}`;
  if (id.length >= 4) return `${id.slice(0, 2)}...${id.slice(-2)}`;
  return "*".repeat(id.length);
}

const paddleWebhook = httpAction(async (ctx, request) => {
  const deployKey = process.env.CONVEX_DEPLOY_KEY;

  if (!deployKey) {
    console.error("[Webhook] CONVEX_DEPLOY_KEY is not configured");
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const authHeader = request.headers.get("Authorization");
  const expectedAuth = `Convex ${deployKey}`;

  if (!authHeader || authHeader !== expectedAuth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (typeof payload !== "object" || payload === null) {
    return new Response(
      JSON.stringify({ error: "Payload must be an object" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const p = payload as Record<string, unknown>;
  const mutation = p.mutation as string;

  if (typeof p.args !== "object" || p.args === null) {
    return new Response(
      JSON.stringify({ error: "Missing or invalid args object" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  const args = p.args as Record<string, unknown>;

  if (mutation === "upsertFromPaddle") {
    if (typeof args.userId !== "string" || args.userId.trim() === "") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid userId" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (
      typeof args.paddleSubscriptionId !== "string" ||
      !args.paddleSubscriptionId.trim()
    ) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid paddleSubscriptionId" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!isValidAccessLevel(args.accessLevel)) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid accessLevel" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!isValidStatus(args.status)) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid status" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Normalize validated ID fields once
    const userId = args.userId.trim();
    const paddleSubscriptionId = args.paddleSubscriptionId.trim();

    console.log("[Webhook] Upserting Paddle subscription", {
      userId: hashId(userId),
      accessLevel: args.accessLevel,
      status: args.status,
    });

    // Validate optional string fields — must be strings or undefined
    const planSlug =
      typeof args.planSlug === "string" && args.planSlug.trim().length > 0
        ? args.planSlug.trim()
        : undefined;
    const paddleCustomerId =
      typeof args.paddleCustomerId === "string" && args.paddleCustomerId.trim().length > 0
        ? args.paddleCustomerId.trim()
        : undefined;

    // Validate optional timestamp fields — only pass finite numbers
    const currentPeriodStart = typeof args.currentPeriodStart === "number" && Number.isFinite(args.currentPeriodStart)
      ? args.currentPeriodStart : undefined;
    const currentPeriodEnd = typeof args.currentPeriodEnd === "number" && Number.isFinite(args.currentPeriodEnd)
      ? args.currentPeriodEnd : undefined;
    const canceledAt = typeof args.canceledAt === "number" && Number.isFinite(args.canceledAt)
      ? args.canceledAt : undefined;

    await ctx.runMutation(internal.subscriptionsInternal.upsertFromPaddle, {
      userId,
      accessLevel: args.accessLevel as number,
      planSlug,
      paddleSubscriptionId,
      paddleCustomerId,
      status: args.status as SubscriptionStatus,
      currentPeriodStart,
      currentPeriodEnd,
      canceledAt,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (mutation === "cancelFromPaddle") {
    if (
      typeof args.paddleSubscriptionId !== "string" ||
      !args.paddleSubscriptionId.trim()
    ) {
      return new Response(
        JSON.stringify({ error: "Missing paddleSubscriptionId" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const cancelSubId = args.paddleSubscriptionId.trim();

    console.log("[Webhook] Canceling Paddle subscription", {
      paddleSubscriptionId: hashId(cancelSubId),
    });

    await ctx.runMutation(internal.subscriptionsInternal.cancelFromPaddle, {
      paddleSubscriptionId: cancelSubId,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Unknown mutation" }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
});

const http = httpRouter();

http.route({
  path: "/paddleWebhook",
  method: "POST",
  handler: paddleWebhook,
});

export default http;
