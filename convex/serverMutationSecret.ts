import { ConvexError } from "convex/values";

/**
 * Shared gate for Next.js → Convex teacher/tutor writes.
 * Only routes that know EXIGO_SERVER_MUTATION_SECRET may forge privileged roles.
 */
export function assertServerMutationSecret(serverSecret: string): void {
  const expected = process.env.EXIGO_SERVER_MUTATION_SECRET;
  if (!expected || serverSecret !== expected) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Server mutation secret required",
    });
  }
}
