import { UNLIMITED_LIMIT } from "../../../shared/planConfig";

export function getMaxKnowledgePieces(has: (params: { feature: string }) => boolean): number {
    if (has({ feature: "unlimited_knowledge" })) return UNLIMITED_LIMIT;
    if (has({ feature: "pro_knowledge" })) return 200;
    if (has({ feature: "basic_knowledge" })) return 50;
    return 20;
}
