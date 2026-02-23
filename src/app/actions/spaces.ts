"use server";

import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not defined in environment variables");
}
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);

function getTestLimit(has: (params: { feature: string }) => boolean): number {
    if (has({ feature: "unlimited_ai_tests" })) return 300;
    if (has({ feature: "pro_tests" })) return 100;
    if (has({ feature: "basic_tests" })) return 10;
    return 0;
}

export async function createSpaceServerAction(name: string) {
    const { userId, has } = await auth();

    if (!userId) {
        throw new Error("Unauthorized: Please sign in to create a space.");
    }

    const hasUnlimitedSpaces = has({ feature: "unlimited_spaces" });
    const maxSpaces = hasUnlimitedSpaces ? Infinity : 3;

    const spaceId = await convex.mutation(api.spaces.create, { name, userId, maxSpaces });

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

    let maxTests = getTestLimit(has);

    const testId = await convex.mutation(api.tests.createEmptyTest, {
        spaceId: args.spaceId as Id<"spaces">,
        type: args.type,
        questionCount: args.questionCount,
        topicTitle: args.topicTitle,
        userId,
        maxTests,
    });


    return testId;
}

