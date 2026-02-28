/**
 * @param {object} webhook the webhook object
 * @param {string} webhook.method destination method. Allowed values: "POST", "PUT"
 * @param {string} webhook.url current destination address
 * @param {string} webhook.eventType current webhook Event Type
 * @param {any} webhook.payload JSON payload
 * @param {boolean} webhook.cancel whether to cancel dispatch of the given webhook
 */
function handler(webhook) {
    const d = webhook.payload.data;

    // User ID is in payer.user_id
    const userId = d.payer?.user_id;

    // Plan info
    const planSlug = d.plan?.slug || "free";
    const planName = d.plan?.name || "";

    // Determine access level from slug or name
    const s = (planSlug + planName).toLowerCase();
    let accessLevel = 0;
    if (s.includes("educator") || s.includes("teacher")) {
        accessLevel = 2;
    } else if (s.includes("pro") || s.includes("scholar") || s.includes("premium")) {
        accessLevel = 1;
    }

    // Map status (safely handling canceled without treating it as expired)
    let status = "expired";
    if (d.status === "active" || d.status === "upcoming") {
        status = "active";
    } else if (d.status === "canceled") {
        status = "canceled";
    } else if (d.status === "past_due") {
        status = "past_due";
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
        canceledAt: d.canceled_at === null ? undefined : d.canceled_at
    };

    return webhook;
}
