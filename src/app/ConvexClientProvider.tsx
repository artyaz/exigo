"use client";

import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth, useUser } from "@clerk/nextjs";
import posthog from "posthog-js";
import { useEffect, type ReactNode } from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

function ConvexClientProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { user } = useUser();

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn && userId) {
      posthog.identify(userId, {
        email: user?.primaryEmailAddress?.emailAddress,
        name: user?.fullName ?? undefined,
      });
      return;
    }

    posthog.reset();
  }, [isLoaded, isSignedIn, userId, user?.fullName, user?.primaryEmailAddress?.emailAddress]);

  if (!convex) {
    return (
      <div style={{ padding: 20, color: "red" }}>
        NEXT_PUBLIC_CONVEX_URL is not configured. Please set it in your
        environment variables.
      </div>
    );
  }

  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}

export default ConvexClientProvider;
