import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { getPaymentProvider } from "~/server/payments";

function getCheckoutErrorStatus(message: string): number {
  return message === "Plan not found" ||
      message === "No active Paddle price configured for this plan slug"
    ? 400
    : 500;
}

async function createCheckoutForSlug(userId: string, planSlug: string) {
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const plan = await convex.query(api.plans.getBySlug, { slug: planSlug });
  if (!plan) {
    throw new Error("Plan not found");
  }

  const provider = getPaymentProvider();
  const planPrices = await provider.listPlanPrices();
  const selectedPrice = planPrices.find((p) => p.slug === plan.slug.toLowerCase());
  if (!selectedPrice) {
    throw new Error("No active Paddle price configured for this plan slug");
  }

  return await provider.createCheckout(
    userId,
    selectedPrice.priceId,
    { plan_slug: plan.slug.toLowerCase() },
  );
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const planSlug = req.nextUrl.searchParams.get("planSlug");
    if (!planSlug) {
      return NextResponse.json({ error: "Missing planSlug" }, { status: 400 });
    }

    const result = await createCheckoutForSlug(userId, planSlug);
    return NextResponse.redirect(result.url, 302);
  } catch (error) {
    console.error("[Checkout] Failed:", error);
    const message = error instanceof Error
      ? error.message
      : `Checkout creation failed: ${String(error)}`;
    const status = getCheckoutErrorStatus(message);
    return NextResponse.json(
      { error: message },
      { status },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { planSlug: string };
    if (!body.planSlug) {
      return NextResponse.json(
        { error: "Missing planSlug" },
        { status: 400 },
      );
    }

    const result = await createCheckoutForSlug(userId, body.planSlug);

    return NextResponse.json({
      url: result.url,
      transactionId: result.transactionId,
    });
  } catch (error) {
    console.error("[Checkout] Failed:", error);
    const message = error instanceof Error
      ? error.message
      : `Checkout creation failed: ${String(error)}`;
    const status = getCheckoutErrorStatus(message);
    return NextResponse.json(
      { error: message },
      { status },
    );
  }
}
