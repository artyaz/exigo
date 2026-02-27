import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const clerkWebhook = httpAction(async (ctx, request) => {
  const authHeader = request.headers.get("Authorization");
  const expectedAuth = `Convex ${process.env.CONVEX_DEPLOY_KEY}`;

  if (!authHeader || authHeader !== expectedAuth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = (await request.json()) as {
    userId: string;
    accessLevel: number;
    clerkPlanSlug?: string;
    status: "active" | "canceled" | "past_due" | "expired";
    periodEnd?: number;
    canceledAt?: number;
  };

  if (!payload.userId) {
    return new Response(JSON.stringify({ error: "Missing userId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log("[Webhook] Syncing subscription", {
    accessLevel: payload.accessLevel,
    status: payload.status,
  });

  await ctx.runMutation(internal.subscriptionsInternal.upsert, {
    userId: payload.userId,
    accessLevel: payload.accessLevel,
    clerkPlanId: undefined,
    clerkPlanSlug: payload.clerkPlanSlug,
    status: payload.status,
    periodEnd: payload.periodEnd,
    canceledAt: payload.canceledAt,
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
