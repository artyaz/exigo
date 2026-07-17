import { v } from "convex/values";
import { action } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { internal, api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  getAuthedContextForAction,
  requireEducatorAccess,
} from "./authDecorators";
import { MAX_MODULES } from "../shared/courseConfig";

type AdvanceResult = {
  nextPhase: string;
  moduleTitle?: string;
  lessonTitle?: string;
};

/**
 * Course phase machine (orchestrator is the structural phase writer).
 *
 *   baseline
 *     → module_generation
 *     → lesson ⇄ lesson_summary  (per lesson in current module)
 *     → module_complete
 *         if modules.length >= MAX_MODULES → completed (terminal)
 *         else → module_generation → … (next module)
 *
 * generateModule may set phase "lesson" after creating content (generation
 * completion); only this action sets "completed" and other structural hops.
 * generateModule itself requires phase === "module_generation".
 */

/** Load lessons for the course's current module, sorted by lessonIndex. */
async function loadCurrentModuleLessons(
  ctx: ActionCtx,
  course: Doc<"courses">,
): Promise<{
  currentModule: Doc<"courseModules">;
  sortedLessons: Doc<"courseLessons">[];
}> {
  const modules: Doc<"courseModules">[] = await ctx.runQuery(
    internal.courseModules.getForCourseInternal,
    { courseId: course._id },
  );
  const currentModule = modules.find(
    (m) => m.moduleIndex === course.currentModuleIndex,
  );
  if (!currentModule) throw new Error("Current module not found");

  const lessons: Doc<"courseLessons">[] = await ctx.runQuery(
    internal.courseLessons.getForModuleInternal,
    { moduleId: currentModule._id },
  );
  const sortedLessons = [...lessons].sort(
    (a, b) => a.lessonIndex - b.lessonIndex,
  );
  return { currentModule, sortedLessons };
}

/**
 * Shared arm: generate next module (requires phase module_generation),
 * seed mastery goals on the first lesson, return lesson phase.
 * generateModule patches phase → lesson after content is written.
 */
async function generateModuleAndStartLessons(
  ctx: ActionCtx,
  courseId: Id<"courses">,
): Promise<AdvanceResult> {
  const moduleResult: {
    moduleId: Id<"courseModules">;
    moduleTitle: string;
    subTopicCount: number;
  } = await ctx.runAction(api.courseAi.generateModule, { courseId });

  const lessons: Doc<"courseLessons">[] = await ctx.runQuery(
    internal.courseLessons.getForModuleInternal,
    { moduleId: moduleResult.moduleId },
  );

  if (lessons.length > 0) {
    const firstLesson = [...lessons].sort(
      (a, b) => a.lessonIndex - b.lessonIndex,
    )[0]!;
    await ctx.runAction(api.courseAi.setMasteryGoals, {
      lessonId: firstLesson._id,
    });
  }

  return { nextPhase: "lesson", moduleTitle: moduleResult.moduleTitle };
}

/**
 * Main orchestrator: reads current course phase and advances to the next step.
 * Called by the frontend after each phase completes.
 */
export const advanceCourse = action({
  args: {
    courseId: v.id("courses"),
  },
  handler: async (ctx, args): Promise<AdvanceResult> => {
    const auth = await getAuthedContextForAction(ctx);
    requireEducatorAccess(auth);

    const course: Doc<"courses"> | null = await ctx.runQuery(
      internal.courses.getInternal,
      {
        courseId: args.courseId,
      },
    );
    if (!course || course.userId !== auth.userId) {
      throw new Error("Course not found or unauthorized");
    }

    switch (course.phase) {
      case "baseline": {
        await ctx.runMutation(internal.courses.updateProgress, {
          courseId: args.courseId,
          phase: "module_generation",
        });
        return { nextPhase: "module_generation" };
      }

      case "module_generation": {
        return await generateModuleAndStartLessons(ctx, args.courseId);
      }

      case "lesson": {
        const { sortedLessons } = await loadCurrentModuleLessons(ctx, course);
        const currentLesson = sortedLessons[course.currentLessonIndex];

        const lessonDoneStatuses = ["completed", "summarized", "integrated"];
        if (!currentLesson || !lessonDoneStatuses.includes(currentLesson.status)) {
          return { nextPhase: "lesson" as const };
        }

        await ctx.runMutation(internal.courses.updateProgress, {
          courseId: args.courseId,
          phase: "lesson_summary",
        });
        return { nextPhase: "lesson_summary" };
      }

      case "lesson_summary": {
        const { sortedLessons } = await loadCurrentModuleLessons(ctx, course);
        const nextLessonIndex = course.currentLessonIndex + 1;

        if (nextLessonIndex < sortedLessons.length) {
          const nextLesson = sortedLessons[nextLessonIndex]!;
          await ctx.runAction(api.courseAi.setMasteryGoals, {
            lessonId: nextLesson._id,
          });
          await ctx.runMutation(internal.courses.updateProgress, {
            courseId: args.courseId,
            currentLessonIndex: nextLessonIndex,
            phase: "lesson",
          });
          return { nextPhase: "lesson", lessonTitle: nextLesson.title };
        }

        await ctx.runMutation(internal.courses.updateProgress, {
          courseId: args.courseId,
          phase: "module_complete",
        });
        return { nextPhase: "module_complete" };
      }

      case "module_complete": {
        const modules: Doc<"courseModules">[] = await ctx.runQuery(
          internal.courseModules.getForCourseInternal,
          { courseId: args.courseId },
        );

        // Terminal rule: fixed max modules (see shared/courseConfig.ts).
        if (modules.length >= MAX_MODULES) {
          await ctx.runMutation(internal.courses.updateProgress, {
            courseId: args.courseId,
            phase: "completed",
          });
          return { nextPhase: "completed" };
        }

        // Claim generation phase before public generateModule (phase guard).
        await ctx.runMutation(internal.courses.updateProgress, {
          courseId: args.courseId,
          phase: "module_generation",
        });

        return await generateModuleAndStartLessons(ctx, args.courseId);
      }

      case "completed": {
        return { nextPhase: "completed" };
      }

      default:
        throw new Error(`Unknown course phase: ${String(course.phase)}`);
    }
  },
});
