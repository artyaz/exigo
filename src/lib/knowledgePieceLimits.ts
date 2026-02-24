export function getKnowledgePieceLimit(has: (params: { feature: string }) => boolean): number {
    if (has({ feature: "unlimited_knowledge" }) || has({ feature: "unlimited_ai_tests" })) {
        return Number.MAX_SAFE_INTEGER;
    }

    if (has({ feature: "pro_knowledge" }) || has({ feature: "pro_tests" })) {
        return 200;
    }

    if (has({ feature: "basic_knowledge" }) || has({ feature: "basic_tests" })) {
        return 50;
    }

    return 20;
}
