"use server";

import { auth } from "@clerk/nextjs/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { createAuthedConvexClient } from "../../lib/convexClientAuth";

export async function addKnowledgePieceAction(spaceId: string, content: string, title?: string, source?: string) {
    const { userId, getToken } = await auth();

    if (!userId) {
        throw new Error("Unauthorized: Please sign in to add knowledge.");
    }

    const convex = await createAuthedConvexClient(getToken, "actions.knowledge.addKnowledgePieceAction");

    const pieceId = await convex.mutation(api.knowledgePieces.add, {
        spaceId: spaceId as Id<"spaces">,
        content,
        title,
        source,
    });


    return pieceId;
}

export async function bulkImportKnowledgeAction(spaceId: string, pieces: { title?: string; content: string; source?: string }[]) {
    const { userId, getToken } = await auth();

    if (!userId) {
        throw new Error("Unauthorized: Please sign in to add knowledge.");
    }

    const convex = await createAuthedConvexClient(getToken, "actions.knowledge.bulkImportKnowledgeAction");

    const filteredPieces = pieces.filter((piece) => piece.content.trim() !== "");
    if (filteredPieces.length === 0) {
        return [];
    }

    const ids = await convex.mutation(api.knowledgePieces.bulkImport, {
        spaceId: spaceId as Id<"spaces">,
        pieces: filteredPieces,
    });


    return ids;
}
