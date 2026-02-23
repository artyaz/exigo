"use server";

import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { getTestLimit } from "../../lib/testLimits";

if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not defined in environment variables");
}

function createConvexClient() {
    return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
}

export async function createSpaceServerAction(name: string) {
    const { userId, getToken } = await auth();

    if (!userId) {
        throw new Error("Unauthorized: Please sign in to create a space.");
    }

    let token: string | null = null;
    try {
        token = await getToken({ template: "convex" });
    } catch {
        token = await getToken();
    }
    if (!token) {
        throw new Error("Unauthorized: Missing Convex auth token.");
    }

    const convex = createConvexClient();
    convex.setAuth(token);

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

    let token: string | null = null;
    try {
        token = await getToken({ template: "convex" });
    } catch {
        token = await getToken();
    }
    if (!token) {
        throw new Error("Unauthorized: Missing Convex auth token.");
    }

    const convex = createConvexClient();
    convex.setAuth(token);

    const testId = await convex.mutation(api.tests.createEmptyTest, {
        spaceId: args.spaceId as Id<"spaces">,
        type: args.type,
        questionCount: args.questionCount,
        topicTitle: args.topicTitle,
        userId,
        knowledgePieceId: args.knowledgePieceId as Id<"knowledgePieces">,
    });


    return testId;
}
