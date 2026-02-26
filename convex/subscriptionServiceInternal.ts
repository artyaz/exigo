import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import {
  getEffectiveAccessLevel,
  getEffectiveLimits,
  type AccessLevel,
  type PlanLimits,
} from "./subscriptionService";

export const getAccessLevel = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args): Promise<AccessLevel> => {
    return await getEffectiveAccessLevel(ctx, args.userId);
  },
});

export const getLimits = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args): Promise<PlanLimits> => {
    return await getEffectiveLimits(ctx, args.userId);
  },
});
