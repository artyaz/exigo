import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const VALID_STATUSES = ["active", "canceled", "past_due", "expired"] as const;
type SubscriptionStatus = (typeof VALID_STATUSES)[number];

function isValidStatus(value: unknown): value is SubscriptionStatus {
  return (
    typeof value === "string" &&
    VALID_STATUSES.includes(value as SubscriptionStatus)
  );
}

function hashId(id: string): string {
  if (id.length > 8) return `${id.slice(0, 4)}...${id.slice(-4)}`;
  if (id.length >= 4) return `${id.slice(0, 2)}...${id.slice(-2)}`;
  return "*".repeat(id.length);
}

const clerkWebhook = httpAction(async (ctx, request) => {
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

  if (typeof p.userId !== "string" || p.userId.trim() === "") {
    return new Response(
      JSON.stringify({ error: "Missing or invalid userId" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  if (typeof p.accessLevel !== "number") {
    return new Response(
      JSON.stringify({ error: "Missing or invalid accessLevel" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  if (!isValidStatus(p.status)) {
    return new Response(
      JSON.stringify({ error: "Missing or invalid status" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  if (p.clerkPlanSlug !== undefined && typeof p.clerkPlanSlug !== "string") {
    return new Response(JSON.stringify({ error: "Invalid clerkPlanSlug" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (p.periodEnd !== undefined && typeof p.periodEnd !== "number") {
    return new Response(JSON.stringify({ error: "Invalid periodEnd" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (p.canceledAt !== undefined && typeof p.canceledAt !== "number") {
    return new Response(JSON.stringify({ error: "Invalid canceledAt" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log("[Webhook] Syncing subscription", {
    userId: hashId(p.userId),
    accessLevel: p.accessLevel,
    status: p.status,
  });

  await ctx.runMutation(internal.subscriptionsInternal.upsert, {
    userId: p.userId,
    accessLevel: p.accessLevel,
    clerkPlanId: undefined,
    clerkPlanSlug: p.clerkPlanSlug as string | undefined,
    status: p.status as SubscriptionStatus,
    periodEnd: p.periodEnd as number | undefined,
    canceledAt: p.canceledAt as number | undefined,
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

const http = httpRouter();

http.route({
  path: "/clerkWebhook",
  method: "POST",
  handler: clerkWebhook,
});

export default http;
