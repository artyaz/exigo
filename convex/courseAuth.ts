import type { ActionCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

/**
 * Load a course for an action and require the authenticated user owns it.
 * Matches ownership checks used by generateModule / setMasteryGoals.
 */
export async function requireOwnedCourseForAction(
  ctx: ActionCtx,
  courseId: Id<"courses">,
  userId: string,
): Promise<Doc<"courses">> {
  const course: Doc<"courses"> | null = await ctx.runQuery(
    internal.courses.getInternal,
    { courseId },
  );
  if (!course || course.userId !== userId) {
    throw new Error("Course not found");
  }
  return course;
}
