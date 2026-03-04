import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run daily at midnight UTC to reset expired usage periods
crons.daily(
  "reset expired usage",
  { hourUTC: 0, minuteUTC: 0 },
  internal.usageService.resetExpiredUsage as any,
);

export default crons;
