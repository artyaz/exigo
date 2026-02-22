"use server";

import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function createSpaceServerAction(name: string) {
    const { userId, has } = await auth();

    if (!userId) {
        throw new Error("Unauthorized: Please sign in to create a space.");
    }

    const hasUnlimitedSpaces = has({ feature: "unlimited_spaces" });

    if (!hasUnlimitedSpaces) {
        const spaceCount = await convex.query(api.spaces.countForUser, { userId });
        if (spaceCount >= 3) {
            throw new Error("You have reached the free limit of 3 spaces. Please upgrade your plan.");
        }
    }

    const spaceId = await convex.mutation(api.spaces.create, { name, userId });
    return spaceId;
}
