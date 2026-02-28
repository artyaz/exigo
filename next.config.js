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

const personalApiKey = process.env.POSTHOG_PERSONAL_API_KEY;
const projectId = process.env.POSTHOG_PROJECT_ID ?? process.env.POSTHOG_ENV_ID;

const posthogConfig =
    personalApiKey && projectId
        ? withPostHogConfig(nextConfig, {
            personalApiKey,
            projectId,
            host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
            sourcemaps: { enabled: true },
        })
        : nextConfig;

export default posthogConfig;
