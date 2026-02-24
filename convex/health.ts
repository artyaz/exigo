import { query } from "./_generated/server";

// Update this string whenever you make critical backend changes 
// to verify they have been synced to the cloud.
export const VERSION = "2026-02-24-v3-robust-limits";

export const getStatus = query({
    args: {},
    handler: async () => {
        return {
            version: VERSION,
            env: process.env.NODE_ENV,
            isSynced: true
        };
    },
});
