/**
 * @param {object} webhook the webhook object
 * @param {string} webhook.method destination method. Allowed values: "POST", "PUT"
 * @param {string} webhook.url current destination address
 * @param {string} webhook.eventType current webhook Event Type
 * @param {any} webhook.payload JSON payload
 * @param {boolean} webhook.cancel whether to cancel dispatch of the given webhook
 *
 * ACCESS_LEVELS mapping (from convex/subscriptionService.ts):
 * FREE = 0, PRO_SCHOLAR = 1, EDUCATOR = 2
 */
function handler(webhook) {
  const d = webhook.payload.data;

  // User ID is in payer.user_id
  const userId = d.payer?.user_id;

  // Validate userId before processing
  if (!userId || typeof userId !== "string" || userId.trim() === "") {
    console.error("[Webhook Transform] Missing or invalid userId, skipping");
    webhook.cancel = true;
    return webhook;
  }

  // Plan info
  const planSlug = d.plan?.slug || "free";
  const planName = d.plan?.name || "";

  // Determine access level from slug or name
  const s = (planSlug + planName).toLowerCase();
  let accessLevel = 0; // FREE
  if (s.includes("educator") || s.includes("teacher")) {
    accessLevel = 2; // EDUCATOR
  } else if (
    s.includes("pro") ||
    s.includes("scholar") ||
    s.includes("premium")
  ) {
    accessLevel = 1; // PRO_SCHOLAR
  }

  // Map status (default to "past_due" for unrecognized values)
  let status = "past_due";
  if (d.status === "active" || d.status === "upcoming") {
    status = "active";
  } else if (d.status === "canceled") {
    status = "canceled";
  } else if (d.status === "expired") {
    status = "expired";
  } else if (d.status !== "past_due") {
    console.warn(
      `[Webhook Transform] Unrecognized status: ${d.status}, defaulting to past_due`,
    );
  }

  // Create transformed flat payload to send to NextJS
  // Note: Convex v.optional requires undefined, not null. So we coalesce nulls to undefined.
  webhook.payload = {
    eventType: webhook.payload.type, // Extract original clerk type
    userId,
    accessLevel,
    clerkPlanSlug: planSlug,
    status,
    periodEnd: d.period_end === null ? undefined : d.period_end,
    canceledAt: d.canceled_at === null ? undefined : d.canceled_at,
  };

  return webhook;
}
