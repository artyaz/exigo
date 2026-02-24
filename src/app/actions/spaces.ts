"use server";

import { auth } from "@clerk/nextjs/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { getTestLimit } from "../../lib/testLimits";
import { getSpaceLimit } from "../../lib/spaceLimits";
import { createAuthedConvexClient } from "../../lib/convexClientAuth";

export async function createSpaceServerAction(name: string) {
    const { userId, has, getToken } = await auth();

    if (!userId) {
        throw new Error("Unauthorized: Please sign in to create a space.");
    }

    const maxSpaces = getSpaceLimit(has);
    const convex = await createAuthedConvexClient(getToken, "actions.spaces.createSpaceServerAction");

    const currentCount = await convex.query(api.spaces.countForUser, { userId });
    if (currentCount >= maxSpaces) {
        throw new Error(`Limit reached: You can only have ${maxSpaces} spaces on your current plan.`);
    }

    const spaceId = await convex.mutation(api.spaces.create, { name, userId });

    return spaceId;
}

export async function createTestServerAction(args: {
    spaceId: string;
    type: string;
    questionCount: number;
    topicTitle: string;
    knowledgePieceId?: string;
}) {
    const { userId, has, getToken } = await auth();
    if (!userId) {
        throw new Error("Unauthorized");
    }

    const maxTests = getTestLimit(has);
    if (maxTests === 0) {
        throw new Error("You don't have access to test generation on your current plan. Please upgrade to continue.");
    }

    const convex = await createAuthedConvexClient(getToken, "actions.spaces.createTestServerAction");

    const testId = await convex.mutation(api.tests.createEmptyTest, {
        spaceId: args.spaceId as Id<"spaces">,
        type: args.type,
        questionCount: args.questionCount,
        topicTitle: args.topicTitle,
        userId,
        knowledgePieceId: args.knowledgePieceId ? (args.knowledgePieceId as Id<"knowledgePieces">) : undefined,
    });


    return testId;
}
