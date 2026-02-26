import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const evt = await verifyWebhook(req);
    const eventType = evt.type;

    console.log(`[Clerk Webhook] Received event: ${eventType}`, {
      id: (evt.data as { id?: string }).id,
    });

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      throw new Error("NEXT_PUBLIC_CONVEX_URL is missing");
    }

    const adminKey = process.env.CONVEX_DEPLOY_KEY;
    if (!adminKey) {
      throw new Error("CONVEX_DEPLOY_KEY is missing for webhook operations");
    }

    const response = await fetch(`${convexUrl}/http/clerkWebhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Convex ${adminKey}`,
      },
      body: JSON.stringify(evt),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(
        `[Clerk Webhook] Convex HTTP action failed: ${response.status} ${text}`,
      );
      throw new Error(`Convex HTTP action failed: ${response.status}`);
    }

    const result = (await response.json()) as {
      received: boolean;
      skipped?: string;
    };
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Clerk Webhook] Error processing webhook:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
