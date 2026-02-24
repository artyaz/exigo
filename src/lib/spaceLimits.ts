import { UNLIMITED_LIMIT } from "../../shared/planConfig";

export function getSpaceLimit(has: (params: { feature: string }) => boolean): number {
    if (
        has({ feature: "unlimited_ai_tests" }) ||
        has({ feature: "unlimited_knowledge" }) ||
        has({ feature: "pro_tests" }) ||
        has({ feature: "pro_knowledge" })
    ) {
        return UNLIMITED_LIMIT;
    }

    // Free + Basic tiers are capped to 3 spaces.
    return 3;
}
