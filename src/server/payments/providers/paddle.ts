import { createHmac } from "crypto";
import type { IPaymentProvider, CheckoutResult, PlanPrice } from "../types";

function getPaddleBaseUrl(): string {
  const env = process.env.PADDLE_ENVIRONMENT ?? "sandbox";
  return env === "live"
    ? "https://api.paddle.com"
    : "https://sandbox-api.paddle.com";
}

export class PaddleProvider implements IPaymentProvider {
  private apiKey: string;
  private webhookSecret: string;

  constructor() {
    const apiKey = process.env.PADDLE_API_KEY;
    const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;
    if (!apiKey) throw new Error("PADDLE_API_KEY is not set");
    if (!webhookSecret) throw new Error("PADDLE_WEBHOOK_SECRET is not set");
    this.apiKey = apiKey;
    this.webhookSecret = webhookSecret;
  }

  async createCheckout(
    userId: string,
    priceId: string,
    customData?: Record<string, string>,
  ): Promise<CheckoutResult> {
    const baseUrl = getPaddleBaseUrl();
    const response = await fetch(`${baseUrl}/transactions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{ price_id: priceId, quantity: 1 }],
        custom_data: {
          clerk_user_id: userId,
          ...(customData ?? {}),
        },
        checkout: { url: process.env.PADDLE_CHECKOUT_SUCCESS_URL ?? "/" },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Paddle createCheckout failed (${response.status}): ${text}`);
    }

    const body = (await response.json()) as {
      data: { id: string; checkout: { url: string } };
    };

    return {
      url: body.data.checkout.url,
      transactionId: body.data.id,
    };
  }

  async listPlanPrices(): Promise<PlanPrice[]> {
    const baseUrl = getPaddleBaseUrl();
    const response = await fetch(`${baseUrl}/prices?per_page=200`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Paddle listPlanPrices failed (${response.status}): ${text}`);
    }

    const body = (await response.json()) as {
      data?: Array<{
        id: string;
        status?: string;
        product_id?: string;
        custom_data?: Record<string, unknown>;
        unit_price?: { amount?: string };
      }>;
    };

    const productId = process.env.PADDLE_SUBSCRIPTION_PRODUCT_ID;
    const rows = Array.isArray(body.data) ? body.data : [];
    const results: PlanPrice[] = [];

    for (const row of rows) {
      if (row.status && row.status !== "active") continue;
      if (productId && row.product_id && row.product_id !== productId) continue;

      const slugCandidate =
        row.custom_data?.plan_slug ??
        row.custom_data?.slug;
      const slug =
        typeof slugCandidate === "string" && slugCandidate.trim().length > 0
          ? slugCandidate.trim().toLowerCase()
          : null;
      if (!slug) continue;

      const amountCents = Number(row.unit_price?.amount ?? "0");
      if (!Number.isFinite(amountCents) || amountCents < 0) continue;

      results.push({
        slug,
        priceId: row.id,
        amountCents,
      });
    }

    return results;
  }

  verifyWebhook(rawBody: string | Buffer, signature: string): boolean {
    // Paddle sends: ts=<timestamp>;h1=<hash>
    const parts = signature.split(";");
    const tsEntry = parts.find((p) => p.startsWith("ts="));
    const h1Entry = parts.find((p) => p.startsWith("h1="));
    if (!tsEntry || !h1Entry) return false;

    const ts = tsEntry.replace("ts=", "");
    const h1 = h1Entry.replace("h1=", "");

    const payload = typeof rawBody === "string" ? rawBody : rawBody.toString("utf-8");
    const signedPayload = `${ts}:${payload}`;
    const expectedSignature = createHmac("sha256", this.webhookSecret)
      .update(signedPayload)
      .digest("hex");

    return h1 === expectedSignature;
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    const baseUrl = getPaddleBaseUrl();
    const response = await fetch(
      `${baseUrl}/subscriptions/${subscriptionId}/cancel`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ effective_from: "next_billing_period" }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Paddle cancelSubscription failed (${response.status}): ${text}`);
    }
  }
}
