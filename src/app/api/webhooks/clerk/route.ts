import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const payload = await verifyWebhook(req);
    const eventType = payload.type as string;

    console.log(`[Clerk Webhook] Event: ${eventType}`);

    if (!eventType?.startsWith("subscription")) {
      return NextResponse.json({ received: true, skipped: "not_subscription" });
    }

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    const adminKey = process.env.CONVEX_DEPLOY_KEY;

    if (!convexUrl || !adminKey) {
      console.error("[Clerk Webhook] Missing Convex configuration");
      throw new Error("Missing Convex configuration");
    }

    console.log("[Clerk Webhook] Forwarding to Convex...");

    const response = await fetch(`${convexUrl}/clerkWebhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Convex ${adminKey}`,
      },
      body: JSON.stringify(payload.data),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[Clerk Webhook] Convex error: ${response.status}`, text);
      throw new Error(`Convex failed: ${response.status}`);
    }

    console.log("[Clerk Webhook] Success");
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Clerk Webhook] Error:", error);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
