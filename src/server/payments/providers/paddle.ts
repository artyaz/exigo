import { createHmac } from "crypto";
import type { IPaymentProvider, CheckoutResult } from "../types";

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

  async createCheckout(userId: string, priceId: string): Promise<CheckoutResult> {
    const baseUrl = getPaddleBaseUrl();
    const response = await fetch(`${baseUrl}/transactions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{ price_id: priceId, quantity: 1 }],
        custom_data: { clerk_user_id: userId },
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
