import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { UNLIMITED_LIMIT } from "../shared/planConfig";
import { getEffectiveLimits } from "./subscriptionService";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const ALLOWED_METRICS = ["tests", "deepDives"] as const;
export type MetricName = (typeof ALLOWED_METRICS)[number];
const vMetric = v.union(v.literal("tests"), v.literal("deepDives"));

export const getUsage = query({
  args: { userId: v.string(), metric: vMetric },
  handler: async (ctx, args) => {
    const now = Date.now();
    const usage = await ctx.db
      .query("usage")
      .withIndex("by_user_metric", (q) =>
        q.eq("userId", args.userId).eq("metric", args.metric),
      )
      .first();

    if (!usage || usage.periodEnd < now) {
      return { count: 0, periodStart: now, periodEnd: now + THIRTY_DAYS_MS };
    }

    return {
      count: usage.count,
      periodStart: usage.periodStart,
      periodEnd: usage.periodEnd,
    };
  },
});

export const incrementUsage = mutation({
  args: { userId: v.string(), metric: vMetric },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("usage")
      .withIndex("by_user_metric", (q) =>
        q.eq("userId", args.userId).eq("metric", args.metric),
      )
      .first();

    if (existing && existing.periodEnd > now) {
      await ctx.db.patch(existing._id, { count: existing.count + 1 });
      return existing.count + 1;
    }

    // Start new rolling 30-day period
    const periodStart = now;
    const periodEnd = now + THIRTY_DAYS_MS;

    if (existing) {
      await ctx.db.patch(existing._id, { count: 1, periodStart, periodEnd });
    } else {
      await ctx.db.insert("usage", {
        userId: args.userId,
        metric: args.metric,
        count: 1,
        periodStart,
        periodEnd,
      });
    }

    return 1;
  },
});

export const checkUsageLimit = query({
  args: { userId: v.string(), metric: vMetric },
  handler: async (ctx, args) => {
    const now = Date.now();
    const limits = await getEffectiveLimits(ctx, args.userId);

    let maxForMetric: number;
    switch (args.metric) {
      case "tests":
        maxForMetric = limits.maxTestsPerMonth;
        break;
      case "deepDives":
        maxForMetric = limits.deepDiveLimit;
        break;
      default:
        maxForMetric = 0;
    }

    const usage = await ctx.db
      .query("usage")
      .withIndex("by_user_metric", (q) =>
        q.eq("userId", args.userId).eq("metric", args.metric),
      )
      .first();

    const currentCount =
      usage && usage.periodEnd > now ? usage.count : 0;

    return {
      allowed:
        maxForMetric === UNLIMITED_LIMIT || currentCount < maxForMetric,
      used: currentCount,
      limit: maxForMetric,
    };
  },
});

export const resetExpiredUsage = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const allUsage = await ctx.db.query("usage").collect();
    let resetCount = 0;

    for (const usage of allUsage) {
      if (usage.periodEnd < now) {
        await ctx.db.patch(usage._id, { count: 0, periodStart: now, periodEnd: now + THIRTY_DAYS_MS });
        resetCount++;
      }
    }

    return { resetCount };
  },
});
