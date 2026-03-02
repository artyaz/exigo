import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    GOOGLE_GEMINI_API_KEY: z.string().optional(),
    CONVEX_DEPLOYMENT: z.string().optional(),
    POSTHOG_PERSONAL_API_KEY: z.string().optional(),
    POSTHOG_PROJECT_ID: z.string().optional(),
    POSTHOG_ENV_ID: z.string().optional(),
    POSTHOG_PROJECT_TOKEN: z.string().optional(),
    PADDLE_API_KEY: z.string().optional(),
    PADDLE_WEBHOOK_SECRET: z.string().optional(),
    PADDLE_ENVIRONMENT: z.enum(["sandbox", "live"]).default("sandbox"),
    PADDLE_PRICE_PRO_MONTHLY: z.string().optional(),
    PADDLE_PRICE_PRO_ANNUAL: z.string().optional(),
    PADDLE_PRICE_EDUCATOR_MONTHLY: z.string().optional(),
    PADDLE_PRICE_EDUCATOR_ANNUAL: z.string().optional(),
    PADDLE_CHECKOUT_SUCCESS_URL: z.string().optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_CONVEX_URL: z.string().url().optional(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    GOOGLE_GEMINI_API_KEY: process.env.GOOGLE_GEMINI_API_KEY,
    CONVEX_DEPLOYMENT: process.env.CONVEX_DEPLOYMENT,
    POSTHOG_PERSONAL_API_KEY: process.env.POSTHOG_PERSONAL_API_KEY,
    POSTHOG_PROJECT_ID: process.env.POSTHOG_PROJECT_ID,
    POSTHOG_ENV_ID: process.env.POSTHOG_ENV_ID,
    POSTHOG_PROJECT_TOKEN: process.env.POSTHOG_PROJECT_TOKEN,
    PADDLE_API_KEY: process.env.PADDLE_API_KEY,
    PADDLE_WEBHOOK_SECRET: process.env.PADDLE_WEBHOOK_SECRET,
    PADDLE_ENVIRONMENT: process.env.PADDLE_ENVIRONMENT,
    PADDLE_PRICE_PRO_MONTHLY: process.env.PADDLE_PRICE_PRO_MONTHLY,
    PADDLE_PRICE_PRO_ANNUAL: process.env.PADDLE_PRICE_PRO_ANNUAL,
    PADDLE_PRICE_EDUCATOR_MONTHLY: process.env.PADDLE_PRICE_EDUCATOR_MONTHLY,
    PADDLE_PRICE_EDUCATOR_ANNUAL: process.env.PADDLE_PRICE_EDUCATOR_ANNUAL,
    PADDLE_CHECKOUT_SUCCESS_URL: process.env.PADDLE_CHECKOUT_SUCCESS_URL,
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
