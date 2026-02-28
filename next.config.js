/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";
import { withPostHogConfig } from "@posthog/nextjs-config";

/** @type {import("next").NextConfig} */
const nextConfig = {
    experimental: {
        serverActions: {
            bodySizeLimit: "10mb",
        },
    },
};

export default withPostHogConfig(nextConfig, {
    personalApiKey: process.env.POSTHOG_PERSONAL_API_KEY ?? "",
    projectId: process.env.POSTHOG_PROJECT_ID ?? process.env.POSTHOG_ENV_ID ?? "",
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    sourcemaps: { enabled: true },
});
