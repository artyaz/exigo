import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
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

    // Resolve price ID from plan slug via env vars
    const slugToPriceEnv: Record<string, string> = {
      "pro-monthly": "PADDLE_PRICE_PRO_MONTHLY",
      "pro-annual": "PADDLE_PRICE_PRO_ANNUAL",
      "educator-monthly": "PADDLE_PRICE_EDUCATOR_MONTHLY",
      "educator-annual": "PADDLE_PRICE_EDUCATOR_ANNUAL",
    };

    const envKey = slugToPriceEnv[body.planSlug];
    if (!envKey) {
      return NextResponse.json(
        { error: "Invalid plan slug" },
        { status: 400 },
      );
    }

    const priceId = process.env[envKey];
    if (!priceId) {
      return NextResponse.json(
        { error: "Price not configured for this plan" },
        { status: 500 },
      );
    }

    const provider = getPaymentProvider();
    const result = await provider.createCheckout(userId, priceId);

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
