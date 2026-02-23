"use server";

import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not defined in environment variables");
}
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);

export async function addKnowledgePieceAction(spaceId: string, content: string, title?: string, source?: string) {
    const { userId, has } = await auth();

    if (!userId) {
        throw new Error("Unauthorized: Please sign in to add knowledge.");
    }

    // Verify space ownership
    const space = await convex.query(api.spaces.get, { spaceId: spaceId as Id<"spaces">, userId });
    if (!space) {
        throw new Error("Access denied or space not found");
    }


    const hasUnlimitedKnowledge = has({ feature: "unlimited_knowledge" });
    const hasProKnowledge = has({ feature: "pro_knowledge" });
    const hasBasicKnowledge = has({ feature: "basic_knowledge" });

    let maxPieces = 20; // Default for Free
    if (hasUnlimitedKnowledge) maxPieces = Infinity;
    else if (hasProKnowledge) maxPieces = 200;
    else if (hasBasicKnowledge) maxPieces = 50;

    const pieceId = await convex.mutation(api.knowledgePieces.add, {
        spaceId: spaceId as Id<"spaces">,
        userId,
        maxPieces,
        content,
        title,
        source,
    });


    return pieceId;
}

export async function bulkImportKnowledgeAction(spaceId: string, pieces: { title?: string; content: string; source?: string }[]) {
    const { userId, has } = await auth();

    if (!userId) {
        throw new Error("Unauthorized: Please sign in to add knowledge.");
    }

    // Verify space ownership
    const space = await convex.query(api.spaces.get, { spaceId: spaceId as Id<"spaces">, userId });
    if (!space) {
        throw new Error("Access denied or space not found");
    }


    const hasUnlimitedKnowledge = has({ feature: "unlimited_knowledge" });
    const hasProKnowledge = has({ feature: "pro_knowledge" });
    const hasBasicKnowledge = has({ feature: "basic_knowledge" });

    let maxPieces = 20;
    if (hasUnlimitedKnowledge) maxPieces = Infinity;
    else if (hasProKnowledge) maxPieces = 200;
    else if (hasBasicKnowledge) maxPieces = 50;

    const ids = await convex.mutation(api.knowledgePieces.bulkImport, {
        spaceId: spaceId as Id<"spaces">,
        userId,
        maxPieces,
        pieces,
    });


    return ids;
}
