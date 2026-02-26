import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const clerkWebhook = httpAction(async (ctx, request) => {
  const payload = (await request.json()) as {
    type: string;
    data: {
      id: string;
      object?: string;
      plan?: {
        id?: string;
        slug?: string;
        name?: string;
      };
      payer_user_id?: string;
      payer_organization_id?: string;
      status?: string;
      period_start?: number;
      period_end?: number | null;
      canceled_at?: number | null;
    };
  };

  const eventType = payload.type;
  const data = payload.data;

  console.log(`[Clerk Webhook HTTP] Received event: ${eventType}`, {
    id: data.id,
  });

  const userId = data.payer_user_id;
  if (!userId) {
    console.log("[Clerk Webhook HTTP] No payer_user_id, skipping");
    return new Response(
      JSON.stringify({ received: true, skipped: "no_user_id" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  if (!eventType.startsWith("subscriptionItem.")) {
    console.log(
      `[Clerk Webhook HTTP] Event ${eventType} not a subscriptionItem event, skipping`,
    );
    return new Response(
      JSON.stringify({ received: true, skipped: "not_subscription_item" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  function parseAccessLevelFromSlug(slug: string | undefined): number {
    if (!slug) return 0;
    const normalized = slug.toLowerCase().trim();

    if (normalized === "educator") return 2;
    if (normalized === "pro_scholar" || normalized === "pro-scholar") return 1;
    if (normalized === "basic_tests") return 0;

    if (/educator|teacher/.test(normalized)) return 2;
    if (/pro|scholar|premium|plus/.test(normalized)) return 1;

    return 0;
  }

  function mapStatusToSubscriptionStatus(
    status: string | undefined,
  ): "active" | "canceled" | "past_due" | "expired" {
    switch (status) {
      case "active":
        return "active";
      case "canceled":
        return "canceled";
      case "past_due":
        return "past_due";
      case "ended":
      case "abandoned":
      case "incomplete":
        return "expired";
      case "upcoming":
        return "active";
      default:
        return "active";
    }
  }

  const planId = data.plan?.id;
  const planSlug = data.plan?.slug;
  const accessLevel = parseAccessLevelFromSlug(planSlug);
  const status = mapStatusToSubscriptionStatus(data.status);
  const periodEnd = data.period_end ?? undefined;
  const canceledAt = data.canceled_at ?? undefined;

  console.log(
    `[Clerk Webhook HTTP] Upserting subscription for user ${userId}`,
    {
      planSlug,
      accessLevel,
      status,
      periodEnd,
    },
  );

  await ctx.runMutation(internal.subscriptionsInternal.upsert, {
    userId,
    accessLevel,
    clerkPlanId: planId,
    clerkPlanSlug: planSlug,
    status,
    periodEnd,
    canceledAt,
  });

  return new Response(JSON.stringify({ received: true }), {
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
