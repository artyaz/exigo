"use server";

import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { getTestLimit } from "../../lib/testLimits";

if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not defined in environment variables");
}
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);

export async function createSpaceServerAction(name: string) {
    const { userId } = await auth();

    if (!userId) {
        throw new Error("Unauthorized: Please sign in to create a space.");
    }

    const spaceId = await convex.mutation(api.spaces.create, { name, userId });

    return spaceId;
}

export async function createTestServerAction(args: {
    spaceId: string;
    type: string;
    questionCount: number;
    topicTitle: string;
}) {
    const { userId, has } = await auth();
    if (!userId) {
        throw new Error("Unauthorized");
    }

    const maxTests = getTestLimit(has);
    if (maxTests === 0) {
        throw new Error("You don't have access to test generation on your current plan. Please upgrade to continue.");
    }

    const testId = await convex.mutation(api.tests.createEmptyTest, {
        spaceId: args.spaceId as Id<"spaces">,
        type: args.type,
        questionCount: args.questionCount,
        topicTitle: args.topicTitle,
        userId,
    });


    return testId;
}
