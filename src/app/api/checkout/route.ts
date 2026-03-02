import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { getPaymentProvider } from "~/server/payments";

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

    // Validate plan exists in local plans table.
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const plan = await convex.query(api.plans.getBySlug, { slug: body.planSlug });

    if (!plan) {
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 400 },
      );
    }

    const provider = getPaymentProvider();
    const planPrices = await provider.listPlanPrices();
    const selectedPrice = planPrices.find((p) => p.slug === plan.slug.toLowerCase());
    if (!selectedPrice) {
      return NextResponse.json(
        { error: "No active Paddle price configured for this plan slug" },
        { status: 400 },
      );
    }
    const result = await provider.createCheckout(
      userId,
      selectedPrice.priceId,
      { plan_slug: plan.slug.toLowerCase() },
    );

    return NextResponse.json({
      url: result.url,
      transactionId: result.transactionId,
    });
  } catch (error) {
    console.error("[Checkout] Failed:", error);
    return NextResponse.json(
      { error: "Checkout creation failed" },
      { status: 500 },
    );
  }
}
