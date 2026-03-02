import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getPaymentProvider } from "~/server/payments";
import { clerkClient } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

type PaddleSubscriptionEvent = {
  event_type: string;
  data: {
    id: string; // subscription ID
    status: string;
    customer_id: string;
    custom_data?: { clerk_user_id?: string };
    items?: Array<{
      price?: { id: string };
    }>;
    current_billing_period?: {
      starts_at: string;
      ends_at: string;
    };
    canceled_at?: string;
  };
};

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("Missing NEXT_PUBLIC_CONVEX_URL");
  return new ConvexHttpClient(url);
}

async function callConvexMutation(
  name: string,
  args: Record<string, unknown>,
) {
  const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  const adminKey = process.env.CONVEX_DEPLOY_KEY;
  if (!siteUrl || !adminKey) throw new Error("Missing Convex configuration");

  const response = await fetch(`${siteUrl}/paddleWebhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Convex ${adminKey}`,
    },
    body: JSON.stringify({ mutation: name, args }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Convex mutation ${name} failed (${response.status}): ${text}`);
  }
}

async function resolvePlanFromPriceId(priceId: string) {
  const convex = getConvexClient();
  return await convex.query(api.plans.getByPriceId, { priceId });
}

async function updateClerkMetadata(
  userId: string,
  plan: string | null,
  expiresAt: number | null,
  paddleSubscriptionId: string | null,
) {
  const client = await clerkClient();
  await client.users.updateUserMetadata(userId, {
    privateMetadata: {
      plan: plan ?? undefined,
      expiresAt: expiresAt ?? undefined,
      paddleSubscriptionId: paddleSubscriptionId ?? undefined,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("paddle-signature") ?? "";

    const provider = getPaymentProvider();
    if (!provider.verifyWebhook(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(rawBody) as PaddleSubscriptionEvent;
    const { event_type, data } = event;

    const clerkUserId = data.custom_data?.clerk_user_id;
    if (!clerkUserId) {
      console.warn("[Paddle Webhook] No clerk_user_id in custom_data, skipping");
      return NextResponse.json({ received: true, skipped: "no_user_id" });
    }

    const paddleSubscriptionId = data.id;
    const paddleCustomerId = data.customer_id;

    if (
      event_type === "subscription.activated" ||
      event_type === "subscription.updated"
    ) {
      const priceId = data.items?.[0]?.price?.id;
      const plan = priceId ? await resolvePlanFromPriceId(priceId) : null;
      const planSlug = plan?.slug;
      const accessLevel = plan?.accessLevel ?? 0;

      const periodStart = data.current_billing_period?.starts_at
        ? new Date(data.current_billing_period.starts_at).getTime()
        : undefined;
      const periodEnd = data.current_billing_period?.ends_at
        ? new Date(data.current_billing_period.ends_at).getTime()
        : undefined;

      const status =
        data.status === "active" || data.status === "trialing"
          ? "active"
          : data.status === "canceled"
            ? "canceled"
            : data.status === "past_due"
              ? "past_due"
              : "active";

      await callConvexMutation("upsertFromPaddle", {
        userId: clerkUserId,
        accessLevel,
        planSlug,
        paddleSubscriptionId,
        paddleCustomerId,
        status,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      });

      await updateClerkMetadata(
        clerkUserId,
        planSlug ?? null,
        periodEnd ?? null,
        paddleSubscriptionId,
      );

      return NextResponse.json({ received: true, action: "upserted" });
    }

    if (event_type === "subscription.canceled") {
      await callConvexMutation("cancelFromPaddle", {
        paddleSubscriptionId,
      });

      await updateClerkMetadata(clerkUserId, null, null, null);

      return NextResponse.json({ received: true, action: "canceled" });
    }

    return NextResponse.json({ received: true, skipped: event_type });
  } catch (error) {
    console.error("[Paddle Webhook] Handler failed:", error);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
