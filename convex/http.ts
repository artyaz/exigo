import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const VALID_STATUSES = ["active", "canceled", "past_due", "expired"] as const;
type SubscriptionStatus = (typeof VALID_STATUSES)[number];
const MAX_ACCESS_LEVEL = 2;

function isValidStatus(value: unknown): value is SubscriptionStatus {
  return (
    typeof value === "string" &&
    VALID_STATUSES.includes(value as SubscriptionStatus)
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
  const args = p.args as Record<string, unknown>;

  if (mutation === "upsertFromPaddle") {
    if (typeof args.userId !== "string" || args.userId.trim() === "") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid userId" }),
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

    console.log("[Webhook] Upserting Paddle subscription", {
      userId: hashId(args.userId as string),
      accessLevel: args.accessLevel,
      status: args.status,
    });

    await ctx.runMutation(internal.subscriptionsInternal.upsertFromPaddle, {
      userId: args.userId as string,
      accessLevel: args.accessLevel as number,
      planSlug: args.planSlug as string | undefined,
      paddleSubscriptionId: args.paddleSubscriptionId as string,
      paddleCustomerId: args.paddleCustomerId as string | undefined,
      status: args.status as SubscriptionStatus,
      currentPeriodStart: args.currentPeriodStart as number | undefined,
      currentPeriodEnd: args.currentPeriodEnd as number | undefined,
      canceledAt: args.canceledAt as number | undefined,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (mutation === "cancelFromPaddle") {
    if (
      typeof args.paddleSubscriptionId !== "string" ||
      !args.paddleSubscriptionId
    ) {
      return new Response(
        JSON.stringify({ error: "Missing paddleSubscriptionId" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    console.log("[Webhook] Canceling Paddle subscription", {
      paddleSubscriptionId: args.paddleSubscriptionId,
    });

    await ctx.runMutation(internal.subscriptionsInternal.cancelFromPaddle, {
      paddleSubscriptionId: args.paddleSubscriptionId as string,
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
