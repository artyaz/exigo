/**
 * Fail-fast for Next API routes that hop into secret-gated Convex writers.
 * Call before streaming / AI work so misconfigured deploys don't look like
 * mid-stream AI failures (F-W7-014).
 */
export function requireServerMutationSecret(): string {
  const secret = process.env.EXIGO_SERVER_MUTATION_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "EXIGO_SERVER_MUTATION_SECRET is not configured on this server",
    );
  }
  return secret;
}
