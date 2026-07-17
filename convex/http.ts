import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { SUBSCRIPTION_STATUSES } from "../shared/subscriptionStatuses";
import type { SubscriptionStatus } from "../shared/subscriptionStatuses";
import { hashId } from "../shared/hashId";
import { slugToAccessLevel } from "../shared/planConfig";

function isValidStatus(value: unknown): value is SubscriptionStatus {
  return (
    typeof value === "string" &&
    (SUBSCRIPTION_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Next → Convex hop auth.
 * Prefer dedicated PADDLE_CONVEX_WEBHOOK_SECRET; fall back to CONVEX_DEPLOY_KEY
 * only when the dedicated secret is unset (loud warn — dual-use deploy key).
 */
function resolveWebhookAuthSecret(): {
  secret: string | null;
  source: "paddle_convex_webhook_secret" | "convex_deploy_key" | null;
} {
  const dedicated = process.env.PADDLE_CONVEX_WEBHOOK_SECRET;
  if (typeof dedicated === "string" && dedicated.length > 0) {
    return { secret: dedicated, source: "paddle_convex_webhook_secret" };
  }
  const deployKey = process.env.CONVEX_DEPLOY_KEY;
  if (typeof deployKey === "string" && deployKey.length > 0) {
    return { secret: deployKey, source: "convex_deploy_key" };
  }
  return { secret: null, source: null };
}

const paddleWebhook = httpAction(async (ctx, request) => {
  const { secret, source } = resolveWebhookAuthSecret();

  if (!secret) {
    console.error(
      "[Webhook] Neither PADDLE_CONVEX_WEBHOOK_SECRET nor CONVEX_DEPLOY_KEY is configured",
    );
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (source === "convex_deploy_key") {
    console.warn(
      "[Webhook] PADDLE_CONVEX_WEBHOOK_SECRET not set; falling back to CONVEX_DEPLOY_KEY. Set a dedicated secret for the Next→Convex hop.",
    );
  }

  const authHeader = request.headers.get("Authorization");
  const expectedAuth = `Convex ${secret}`;

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

    // planSlug is required — accessLevel is derived from it server-side.
    if (typeof args.planSlug !== "string" || args.planSlug.trim() === "") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid planSlug" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!isValidStatus(args.status)) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid status" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const userId = args.userId.trim();
    const paddleSubscriptionId = args.paddleSubscriptionId.trim();
    const planSlug = args.planSlug.trim();
    const derivedAccessLevel = slugToAccessLevel(planSlug);

    // If caller still sends accessLevel, require it match derived (catch drift/bugs).
    if (args.accessLevel !== undefined && args.accessLevel !== null) {
      if (
        typeof args.accessLevel !== "number" ||
        !Number.isInteger(args.accessLevel) ||
        args.accessLevel !== derivedAccessLevel
      ) {
        console.warn("[Webhook] accessLevel mismatch vs planSlug — rejecting", {
          planSlug,
          derivedAccessLevel,
          bodyAccessLevel: args.accessLevel,
        });
        return new Response(
          JSON.stringify({
            error: "accessLevel does not match planSlug",
            planSlug,
            expectedAccessLevel: derivedAccessLevel,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    console.log("[Webhook] Upserting Paddle subscription", {
      userId: hashId(userId),
      planSlug,
      accessLevel: derivedAccessLevel,
      status: args.status,
    });

    const paddleCustomerId =
      typeof args.paddleCustomerId === "string" &&
      args.paddleCustomerId.trim().length > 0
        ? args.paddleCustomerId.trim()
        : undefined;

    const currentPeriodStart =
      typeof args.currentPeriodStart === "number" &&
      Number.isFinite(args.currentPeriodStart)
        ? args.currentPeriodStart
        : undefined;
    const currentPeriodEnd =
      typeof args.currentPeriodEnd === "number" &&
      Number.isFinite(args.currentPeriodEnd)
        ? args.currentPeriodEnd
        : undefined;
    const canceledAt =
      typeof args.canceledAt === "number" && Number.isFinite(args.canceledAt)
        ? args.canceledAt
        : undefined;

    const result = await ctx.runMutation(
      internal.subscriptionsInternal.upsertFromPaddle,
      {
        userId,
        planSlug,
        paddleSubscriptionId,
        paddleCustomerId,
        status: args.status as SubscriptionStatus,
        currentPeriodStart,
        currentPeriodEnd,
        canceledAt,
      },
    );

    if (!result.ok) {
      if (result.reason === "userId_mismatch") {
        return new Response(
          JSON.stringify({
            error: "userId mismatch for existing paddle subscription",
            reason: result.reason,
          }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ error: "Upsert rejected" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
    }

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
