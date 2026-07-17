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
