/**
 * Course lifecycle constants shared by Convex backend (and available to UI).
 *
 * MAX_MODULES assumption (S2-B003 / P4-B):
 * Product has no separate "finish course" control yet, but the learn UI already
 * renders a terminal "Course Completed!" state for phase === "completed".
 * Until product picks a richer policy (user-ended, AI-ended, plan-tier length),
 * a fixed module budget is the simplest honest terminal rule so the state
 * machine can exit instead of generating forever.
 */
export const MAX_MODULES = 5;

/**
 * Stable error substring when a second concurrent advance/generate loses the
 * generation claim (P5-C). Orchestrator soft-returns instead of erroring the UI.
 */
export const MODULE_GENERATION_IN_PROGRESS_MSG =
  "Module generation already in progress";

/**
 * How long a generationInProgress claim may stick before a later claim steals it
 * (P6-A / P5-C residual). Covers process death mid-generateModule after claim
 * but before release/success. Gemini module gen can be slow; 15 minutes is
 * generous vs a stuck forever lock.
 */
export const GENERATION_LOCK_TTL_MS = 15 * 60 * 1000;
