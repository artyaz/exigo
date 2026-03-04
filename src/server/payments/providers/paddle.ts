import { createHmac, timingSafeEqual } from "crypto";
import type { IPaymentProvider, CheckoutResult, PlanPrice } from "../types";

function getPaddleBaseUrl(): string {
  const env = process.env.PADDLE_ENVIRONMENT ?? "sandbox";
  return env === "live"
    ? "https://api.paddle.com"
    : "https://sandbox-api.paddle.com";
}

function getHostedCheckoutBaseUrl(): string {
  return process.env.PADDLE_CHECKOUT_BASE_URL ?? "https://pay.paddle.com/checkout";
}

const DEFAULT_TIMEOUT_MS = 15_000;

function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal })
    .catch((err: unknown) => {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`Paddle API request timed out after ${timeoutMs}ms: ${url}`);
      }
      throw err;
    })
    .finally(() => clearTimeout(timer));
}

export class PaddleProvider implements IPaymentProvider {
  private apiKey: string;
  private webhookSecret?: string;

  constructor() {
    const apiKey = process.env.PADDLE_API_KEY;
    if (!apiKey) throw new Error("PADDLE_API_KEY is not set");
    this.apiKey = apiKey;
    this.webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;
  }

  async createCheckout(
    userId: string,
    priceId: string,
    customData?: Record<string, string>,
  ): Promise<CheckoutResult> {
    const baseUrl = getPaddleBaseUrl();
    const response = await fetchWithTimeout(`${baseUrl}/transactions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{ price_id: priceId, quantity: 1 }],
        custom_data: {
          ...(customData ?? {}),
          clerk_user_id: userId,
        },
        checkout: { url: null },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Paddle createCheckout failed (${response.status}): ${text}`);
    }

    const body = (await response.json()) as {
      data: {
        id: string;
        url?: string;
        checkout?: { url?: string };
      };
    };
    const hostedCheckoutUrl =
      body.data.url ??
      body.data.checkout?.url ??
      `${getHostedCheckoutBaseUrl()}?_ptxn=${body.data.id}`;

    return {
      url: hostedCheckoutUrl,
      transactionId: body.data.id,
    };
  }

  async listPlanPrices(): Promise<PlanPrice[]> {
    const baseUrl = getPaddleBaseUrl();
    const response = await fetchWithTimeout(`${baseUrl}/prices?per_page=200`, {
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
      if (productId && (!row.product_id || row.product_id !== productId)) continue;

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
    if (!this.webhookSecret) {
      throw new Error("PADDLE_WEBHOOK_SECRET is not set");
    }

    // Paddle sends: ts=<timestamp>;h1=<hash>
    const parts = signature.split(";").map((p) => p.trim());
    const tsEntry = parts.find((p) => p.startsWith("ts="));
    const h1Entry = parts.find((p) => p.startsWith("h1="));
    if (!tsEntry || !h1Entry) return false;

    const ts = tsEntry.replace("ts=", "");
    const h1 = h1Entry.replace("h1=", "");

    // Replay-attack protection: reject timestamps older than 5 seconds
    const tsNum = Number(ts);
    if (!Number.isFinite(tsNum)) return false;
    const rawTolerance = Number(process.env.PADDLE_WEBHOOK_TOLERANCE_SECONDS);
    const tolerance = Number.isFinite(rawTolerance) && rawTolerance >= 0 ? rawTolerance : 5;
    if (Math.abs(Date.now() / 1000 - tsNum) > tolerance) return false;

    const payload = typeof rawBody === "string" ? rawBody : rawBody.toString("utf-8");
    const signedPayload = `${ts}:${payload}`;
    const expectedSignature = createHmac("sha256", this.webhookSecret)
      .update(signedPayload)
      .digest("hex");

    // Timing-safe comparison
    const a = Buffer.from(h1, "utf-8");
    const b = Buffer.from(expectedSignature, "utf-8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    const baseUrl = getPaddleBaseUrl();
    const response = await fetchWithTimeout(
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
