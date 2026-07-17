import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getPaymentProvider } from "~/server/payments";
import { clerkClient } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { slugToAccessLevel } from "../../../../../shared/planConfig";

type PaddleSubscriptionEvent = {
  event_type: string;
  data: {
    id: string; // subscription ID
    status: string;
    customer_id: string;
    custom_data?: { clerk_user_id?: string; plan_slug?: string; slug?: string };
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

/**
 * Prefer dedicated PADDLE_CONVEX_WEBHOOK_SECRET for Next→Convex hop.
 * Falls back to CONVEX_DEPLOY_KEY so existing deploys keep working until rotated.
 * Must match convex/http.ts resolveWebhookAuthSecret().
 */
function getConvexWebhookSecret(): string {
  const dedicated = process.env.PADDLE_CONVEX_WEBHOOK_SECRET;
  if (typeof dedicated === "string" && dedicated.length > 0) {
    return dedicated;
  }
  const deployKey = process.env.CONVEX_DEPLOY_KEY;
  if (typeof deployKey === "string" && deployKey.length > 0) {
    console.warn(
      "[Paddle Webhook] PADDLE_CONVEX_WEBHOOK_SECRET not set; using CONVEX_DEPLOY_KEY fallback",
    );
    return deployKey;
  }
  throw new Error(
    "Missing PADDLE_CONVEX_WEBHOOK_SECRET (preferred) or CONVEX_DEPLOY_KEY",
  );
}

async function callConvexMutation(
  name: string,
  args: Record<string, unknown>,
) {
  const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (!siteUrl) throw new Error("Missing NEXT_PUBLIC_CONVEX_SITE_URL");
  const secret = getConvexWebhookSecret();

  const response = await fetch(`${siteUrl}/paddleWebhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Convex ${secret}`,
    },
    body: JSON.stringify({ mutation: name, args }),
  });

  if (!response.ok) {
    const text = await response.text();
    // Surface 409 (userId mismatch) distinctly — fail closed, no silent success.
    const err = new Error(
      `Convex mutation ${name} failed (${response.status}): ${text}`,
    ) as Error & { status?: number };
    err.status = response.status;
    throw err;
  }
}

async function resolvePlanSlug(
  provider: ReturnType<typeof getPaymentProvider>,
  data: PaddleSubscriptionEvent["data"],
): Promise<string | undefined> {
  const fromCustomData = data.custom_data?.plan_slug ?? data.custom_data?.slug;
  if (typeof fromCustomData === "string" && fromCustomData.trim().length > 0) {
    return fromCustomData.trim().toLowerCase();
  }

  const priceId = data.items?.[0]?.price?.id;
  if (!priceId) return undefined;

  const prices = await provider.listPlanPrices();
  return prices.find((p) => p.priceId === priceId)?.slug;
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

    const paddleSubscriptionId = data.id;
    const paddleCustomerId = data.customer_id;

    // Handle cancellation before requiring clerkUserId — it only needs the subscription ID
    if (event_type === "subscription.canceled") {
      await callConvexMutation("cancelFromPaddle", {
        paddleSubscriptionId,
      });

      const clerkUserId = data.custom_data?.clerk_user_id;
      if (clerkUserId) {
        await updateClerkMetadata(clerkUserId, null, null, null);
      }

      return NextResponse.json({ received: true, action: "canceled" });
    }

    const clerkUserId = data.custom_data?.clerk_user_id;
    if (!clerkUserId) {
      console.warn("[Paddle Webhook] No clerk_user_id in custom_data, skipping");
      return NextResponse.json({ received: true, skipped: "no_user_id" });
    }

    if (
      event_type === "subscription.activated" ||
      event_type === "subscription.updated"
    ) {
      const planSlug = await resolvePlanSlug(provider, data);
      if (!planSlug) {
        throw new Error("Paddle webhook missing plan slug in custom_data");
      }
      const convex = getConvexClient();
      const plan = await convex.query(api.plans.getBySlug, { slug: planSlug });
      if (!plan) {
        throw new Error(`Unknown plan slug in Paddle webhook: ${planSlug}`);
      }

      // Entitlements are re-derived on Convex from planSlug; send matching
      // accessLevel only so Convex can verify equality (optional body check).
      const accessLevel = slugToAccessLevel(planSlug);
      if (plan.accessLevel !== accessLevel) {
        console.warn(
          "[Paddle Webhook] plans table accessLevel differs from shared slug mapping",
          { planSlug, table: plan.accessLevel, shared: accessLevel },
        );
      }

      const periodStart = data.current_billing_period?.starts_at
        ? new Date(data.current_billing_period.starts_at).getTime()
        : undefined;
      const periodEnd = data.current_billing_period?.ends_at
        ? new Date(data.current_billing_period.ends_at).getTime()
        : undefined;

      const knownStatuses: Record<string, string> = {
        active: "active",
        trialing: "active",
        canceled: "canceled",
        past_due: "past_due",
        paused: "paused",
      };
      const status = knownStatuses[data.status];
      if (!status) {
        console.warn(
          `[Paddle Webhook] Unrecognized subscription status: ${data.status}`,
        );
        return NextResponse.json(
          { error: `Unrecognized subscription status: ${data.status}` },
          { status: 400 },
        );
      }

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
        planSlug,
        periodEnd ?? null,
        paddleSubscriptionId,
      );

      return NextResponse.json({ received: true, action: "upserted" });
    }

    return NextResponse.json({ received: true, skipped: event_type });
  } catch (error) {
    console.error("[Paddle Webhook] Handler failed:", error);
    const status =
      error instanceof Error &&
      typeof (error as Error & { status?: number }).status === "number"
        ? (error as Error & { status: number }).status
        : 500;
    // Propagate 409 (userId mismatch) so Paddle retries / ops can see fail-closed.
    if (status === 409) {
      return NextResponse.json(
        { error: "Webhook conflict", detail: "userId mismatch" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
