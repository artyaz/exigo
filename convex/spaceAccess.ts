import type { Doc } from "./_generated/dataModel";

/**
 * Shared / demo spaces owned by this sentinel may be **read** by any authed user.
 * Writes always require real ownership (`canWriteSpace`).
 *
 * Product note (F-W7-004 / P10-A): keep this exception in one place so tenancy
 * rules do not drift. Do **not** count default_user spaces toward personal plan
 * quotas (tests/month, etc.).
 */
export const DEFAULT_SPACE_OWNER = "default_user";

export function canReadSpace(space: Doc<"spaces">, userId: string): boolean {
  return space.userId === userId || space.userId === DEFAULT_SPACE_OWNER;
}

/** Mutations and privileged writes — never the shared-demo exception. */
export function canWriteSpace(space: Doc<"spaces">, userId: string): boolean {
  return space.userId === userId;
}
