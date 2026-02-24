"use server";

import { auth } from "@clerk/nextjs/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { createAuthedConvexClient } from "../../lib/convexClientAuth";
import { getKnowledgePieceLimit } from "../../lib/knowledgePieceLimits";

export async function addKnowledgePieceAction(spaceId: string, content: string, title?: string, source?: string) {
    const { userId, has, getToken } = await auth();

    if (!userId) {
        throw new Error("Unauthorized: Please sign in to add knowledge.");
    }

    const maxKnowledgePieces = getKnowledgePieceLimit(has);
    const convex = await createAuthedConvexClient(getToken, "actions.knowledge.addKnowledgePieceAction");

    // Verify space ownership
    const space = await convex.query(api.spaces.get, { spaceId: spaceId as Id<"spaces">, userId });
    if (!space) {
        throw new Error("Access denied or space not found");
    }

    const existingPieces = await convex.query(api.knowledgePieces.getForSpace, { spaceId: spaceId as Id<"spaces"> });
    if (existingPieces.length + 1 > maxKnowledgePieces) {
        throw new Error(`Limit reached: You can only have ${maxKnowledgePieces} knowledge pieces per space on your current plan.`);
    }

    const pieceId = await convex.mutation(api.knowledgePieces.add, {
        spaceId: spaceId as Id<"spaces">,
        content,
        title,
        source,
    });


    return pieceId;
}

export async function bulkImportKnowledgeAction(spaceId: string, pieces: { title?: string; content: string; source?: string }[]) {
    const { userId, has, getToken } = await auth();

    if (!userId) {
        throw new Error("Unauthorized: Please sign in to add knowledge.");
    }

    const maxKnowledgePieces = getKnowledgePieceLimit(has);
    const convex = await createAuthedConvexClient(getToken, "actions.knowledge.bulkImportKnowledgeAction");

    // Verify space ownership
    const space = await convex.query(api.spaces.get, { spaceId: spaceId as Id<"spaces">, userId });
    if (!space) {
        throw new Error("Access denied or space not found");
    }

    const existingPieces = await convex.query(api.knowledgePieces.getForSpace, { spaceId: spaceId as Id<"spaces"> });
    const nonEmptyIncomingCount = pieces.filter((piece) => piece.content.trim() !== "").length;
    if (existingPieces.length + nonEmptyIncomingCount > maxKnowledgePieces) {
        throw new Error(`Limit reached: You can only have ${maxKnowledgePieces} knowledge pieces per space on your current plan.`);
    }

    const ids = await convex.mutation(api.knowledgePieces.bulkImport, {
        spaceId: spaceId as Id<"spaces">,
        pieces,
    });


    return ids;
}
