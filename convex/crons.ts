import { cronJobs } from "convex/server";

const crons = cronJobs();

// No scheduled jobs currently. Add real jobs here when needed.
// (Previously: daily reset of dead usageService rolling-window rows — removed in P0-E.)

export default crons;
