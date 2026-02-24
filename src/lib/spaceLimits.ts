export function getSpaceLimit(has: (params: { feature: string }) => boolean): number {
    if (has({ feature: "unlimited_ai_tests" }) || has({ feature: "unlimited_knowledge" })) {
        return Number.MAX_SAFE_INTEGER;
    }

    if (has({ feature: "pro_tests" }) || has({ feature: "pro_knowledge" })) {
        return Number.MAX_SAFE_INTEGER;
    }

    // Free + Basic tiers are capped to 3 spaces.
    return 3;
}
