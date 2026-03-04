import { NextResponse } from "next/server";
import { getPaymentProvider } from "~/server/payments";

export async function GET() {
  try {
    const provider = getPaymentProvider();
    const prices = await provider.listPlanPrices();
    const bySlug: Record<string, number> = {};

    for (const price of prices) {
      if (bySlug[price.slug] !== undefined) {
        console.error(`[Plans Prices] Duplicate slug "${price.slug}" — price ${price.priceId} conflicts with existing entry`);
        return NextResponse.json(
          { error: `Duplicate price slug: ${price.slug}` },
          { status: 500 },
        );
      }
      bySlug[price.slug] = price.amountCents;
    }

    return NextResponse.json({ prices: bySlug });
  } catch (error) {
    console.error("[Plans Prices] Failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch plan prices" },
      { status: 500 },
    );
  }
}
