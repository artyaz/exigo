"use server";

import { auth } from "@clerk/nextjs/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { createAuthedConvexClient } from "../../lib/convexClientAuth";
import { getErrorAttributes, logError, logInfo } from "../../lib/otlpLogger";

type ActionResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: string; code: "UNAUTHORIZED" | "PLAN_LIMIT" | "UNKNOWN" };

function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    if (error && typeof error === "object") {
        const withMessage = error as { message?: unknown };
        if (typeof withMessage.message === "string" && withMessage.message) {
            return withMessage.message;
        }
    }
    return "Unexpected error";
}

function isPlanLimitErrorMessage(message: string): boolean {
    return message.includes("Limit reached") || message.includes("don't have access to test generation");
}

export async function createSpaceServerAction(name: string): Promise<ActionResult<Id<"spaces">>> {
    const { userId, getToken } = await auth();

    if (!userId) {
        return { ok: false, error: "Unauthorized: Please sign in to create a space.", code: "UNAUTHORIZED" };
    }

    logInfo("Create space action requested", {
        source: "actions.spaces.createSpaceServerAction",
        userId,
        spaceName: name,
    });

    try {
        const convex = await createAuthedConvexClient(getToken, "actions.spaces.createSpaceServerAction");
        const spaceId = await convex.mutation(api.spaces.create, { name, userId });
        return { ok: true, data: spaceId };
    } catch (error) {
        const message = getErrorMessage(error);
        if (isPlanLimitErrorMessage(message)) {
            return {
                ok: false,
                error: "You reached your space limit on the current plan. Please upgrade to create more spaces.",
                code: "PLAN_LIMIT",
            };
        }
        logError("Create space action failed", {
            source: "actions.spaces.createSpaceServerAction",
            userId,
            spaceName: name,
            ...getErrorAttributes(error),
        });
        return { ok: false, error: "Failed to create space. Please try again.", code: "UNKNOWN" };
    }
}

export async function createTestServerAction(args: {
    spaceId: string;
    type: string;
    questionCount: number;
    topicTitle: string;
    knowledgePieceId?: string;
}): Promise<ActionResult<Id<"tests">>> {
    const { userId, getToken } = await auth();
    if (!userId) {
        return { ok: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    try {
        const convex = await createAuthedConvexClient(getToken, "actions.spaces.createTestServerAction");
        const testId = await convex.mutation(api.tests.createEmptyTest, {
            spaceId: args.spaceId as Id<"spaces">,
            type: args.type,
            questionCount: args.questionCount,
            topicTitle: args.topicTitle,
            userId,
            knowledgePieceId: args.knowledgePieceId ? (args.knowledgePieceId as Id<"knowledgePieces">) : undefined,
        });
        return { ok: true, data: testId };
    } catch (error) {
        const message = getErrorMessage(error);
        if (isPlanLimitErrorMessage(message)) {
            return {
                ok: false,
                error: "You reached your monthly test limit on the current plan. Please upgrade to continue.",
                code: "PLAN_LIMIT",
            };
        }
        logError("Create test action failed", {
            source: "actions.spaces.createTestServerAction",
            userId,
            spaceId: args.spaceId,
            testType: args.type,
            ...getErrorAttributes(error),
        });
        return { ok: false, error: "Failed to create test. Please try again.", code: "UNKNOWN" };
    }
}
