export const SUBSCRIPTION_STATUSES = [
  "active",
  "canceled",
  "past_due",
  "expired",
  "paused",
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
