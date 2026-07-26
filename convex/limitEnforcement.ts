/**
 * Shared plan-limit enforcement primitives.
 *
 * The *numbers* live in `shared/planConfig.ts` (LIMITS_BY_TIER).
 * The *wording + comparison* live here — one place, no drift.
 *
 * Pure functions, no DB access, fully unit-testable.
 */
import { UNLIMITED_LIMIT } from "../shared/planConfig";

/**
 * Throw the canonical "feature not on your plan" error when a limit is 0.
 * Call at the top of any mutation gated by a feature flag.
 */
export function requireFeatureEnabled(limit: number, featureNoun: string): void {
  if (limit === 0) {
    throw new Error(
      `You don't have access to ${featureNoun} on your current plan. Please upgrade to continue.`,
    );
  }
}

export interface AssertWithinLimitOpts {
  limit: number;
  count: number;
  /** Plural noun, e.g. "tests", "spaces", "knowledge pieces". */
  noun: string;
  /** Optional scope qualifier, e.g. "per month", "per space". */
  scope?: string;
}

/**
 * Throw the canonical "limit reached" error when count meets/exceeds a finite cap.
 * Passes silently when limit is UNLIMITED_LIMIT (Infinity).
 */
export function assertWithinLimit(opts: AssertWithinLimitOpts): void {
  const { limit, count, noun, scope } = opts;
  if (limit !== UNLIMITED_LIMIT && count >= limit) {
    throw new Error(
      `Limit reached: You can only have ${limit} ${noun}${scope ? ` ${scope}` : ""} on your current plan. Please upgrade for more!`,
    );
  }
}
