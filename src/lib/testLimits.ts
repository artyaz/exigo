export function getTestLimit(has: (params: { feature: string }) => boolean): number {
    if (has({ feature: "unlimited_ai_tests" })) return 300;
    if (has({ feature: "pro_tests" })) return 100;
    if (has({ feature: "basic_tests" })) return 10;
    return 0;
}
