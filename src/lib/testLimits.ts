import { MAX_TESTS_SENTINEL } from "../../shared/planConfig";

export function getTestLimit(has: (params: { feature: string }) => boolean): number {
    let limit = 0;
    if (has({ feature: "unlimited_ai_tests" })) limit = 300;
    else if (has({ feature: "pro_tests" })) limit = 100;
    else if (has({ feature: "basic_tests" })) limit = 10;

    return Math.min(limit, MAX_TESTS_SENTINEL);
}
