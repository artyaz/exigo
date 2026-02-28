import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // Read the body text for manual parsing since verifyWebhook strips custom fields 
    // when returning the structured standard webhook payload.
    const rawBody = await req.text();

    // Construct a new request so verifyWebhook can read the body again to verify signatures.
    const reqForVerify = new Request(req.url, {
      method: req.method,
      headers: req.headers,
      body: rawBody,
    });
    // Cast via unknown to NextRequest to satisfy strict TS and ESLint rules
    await verifyWebhook(reqForVerify as unknown as NextRequest);

    // After Clerk webhook transformation, the structure of the data changes.
    // Ensure we handle it with the properties we expect.
    type TransformedPayload = {
      eventType?: string;
      userId?: string;
      accessLevel?: number;
      clerkPlanSlug?: string;
      status?: string;
      periodEnd?: number;
      canceledAt?: number;
    };
    const payload = JSON.parse(rawBody) as TransformedPayload;

    console.log(`[Clerk Webhook] Full Transformed Payload:`, JSON.stringify(payload, null, 2));

    const eventType = payload.eventType ?? "";

    if (!eventType.startsWith("subscription") && !eventType.startsWith("subscriptionItem")) {
      console.log(`[Clerk Webhook] Skipping event type: ${eventType}`);
      return NextResponse.json({ received: true, skipped: "not_subscription" });
    }

    if (!payload?.userId) {
      console.log(`[Clerk Webhook] Missing userId, skipping`);
      return NextResponse.json({ received: true, skipped: "no_userid" });
    }

    const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
    const adminKey = process.env.CONVEX_DEPLOY_KEY;

    if (!convexSiteUrl || !adminKey) {
      console.error("[Clerk Webhook] Missing Convex configuration");
      throw new Error("Missing Convex configuration");
    }

    console.log("[Clerk Webhook] Forwarding to Convex...");

    const response = await fetch(`${convexSiteUrl}/clerkWebhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Convex ${adminKey}`,
      },
      body: JSON.stringify(payload),
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
