import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal, api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  getAuthedContextForAction,
  requireEducatorAccess,
} from "./authDecorators";

type AdvanceResult = {
  nextPhase: string;
  moduleTitle?: string;
  lessonTitle?: string;
};

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

    const course: Doc<"courses"> | null = await ctx.runQuery(internal.courses.getInternal, {
      courseId: args.courseId,
    });
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
        const moduleResult: { moduleId: Id<"courseModules">; moduleTitle: string; subTopicCount: number } =
          await ctx.runAction(api.courseAi.generateModule, {
            courseId: args.courseId,
          });

        const lessons: Doc<"courseLessons">[] = await ctx.runQuery(
          internal.courseLessons.getForModuleInternal,
          { moduleId: moduleResult.moduleId },
        );

        if (lessons.length > 0) {
          const firstLesson: Doc<"courseLessons"> = lessons.sort(
            (a: Doc<"courseLessons">, b: Doc<"courseLessons">) => a.lessonIndex - b.lessonIndex,
          )[0]!;
          await ctx.runAction(api.courseAi.setMasteryGoals, {
            lessonId: firstLesson._id,
          });
        }

        return { nextPhase: "lesson", moduleTitle: moduleResult.moduleTitle };
      }

      case "lesson": {
        const lessonModules: Doc<"courseModules">[] = await ctx.runQuery(
          internal.courseModules.getForCourseInternal,
          { courseId: args.courseId },
        );
        const lessonCurrentModule: Doc<"courseModules"> | undefined = lessonModules.find(
          (m: Doc<"courseModules">) => m.moduleIndex === course.currentModuleIndex,
        );
        if (!lessonCurrentModule) throw new Error("Current module not found");

        const lessonModuleLessons: Doc<"courseLessons">[] = await ctx.runQuery(
          internal.courseLessons.getForModuleInternal,
          { moduleId: lessonCurrentModule._id },
        );
        const lessonSorted: Doc<"courseLessons">[] = lessonModuleLessons.sort(
          (a: Doc<"courseLessons">, b: Doc<"courseLessons">) => a.lessonIndex - b.lessonIndex,
        );
        const currentLesson: Doc<"courseLessons"> | undefined = lessonSorted[course.currentLessonIndex];

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
        const modules: Doc<"courseModules">[] = await ctx.runQuery(
          internal.courseModules.getForCourseInternal,
          { courseId: args.courseId },
        );
        const currentModule: Doc<"courseModules"> | undefined = modules.find(
          (m: Doc<"courseModules">) => m.moduleIndex === course.currentModuleIndex,
        );
        if (!currentModule) throw new Error("Current module not found");

        const lessons: Doc<"courseLessons">[] = await ctx.runQuery(
          internal.courseLessons.getForModuleInternal,
          { moduleId: currentModule._id },
        );
        const sortedLessons: Doc<"courseLessons">[] = lessons.sort(
          (a: Doc<"courseLessons">, b: Doc<"courseLessons">) => a.lessonIndex - b.lessonIndex,
        );
        const nextLessonIndex: number = course.currentLessonIndex + 1;

        if (nextLessonIndex < sortedLessons.length) {
          const nextLesson: Doc<"courseLessons"> = sortedLessons[nextLessonIndex]!;
          await ctx.runAction(api.courseAi.setMasteryGoals, {
            lessonId: nextLesson._id,
          });
          await ctx.runMutation(internal.courses.updateProgress, {
            courseId: args.courseId,
            currentLessonIndex: nextLessonIndex,
            phase: "lesson",
          });
          return { nextPhase: "lesson", lessonTitle: nextLesson.title };
        } else {
          await ctx.runMutation(internal.courses.updateProgress, {
            courseId: args.courseId,
            phase: "module_complete",
          });
          return { nextPhase: "module_complete" };
        }
      }

      case "module_complete": {
        await ctx.runMutation(internal.courses.updateProgress, {
          courseId: args.courseId,
          phase: "module_generation",
        });

        const moduleResult: { moduleId: Id<"courseModules">; moduleTitle: string; subTopicCount: number } =
          await ctx.runAction(api.courseAi.generateModule, {
            courseId: args.courseId,
          });

        const lessons: Doc<"courseLessons">[] = await ctx.runQuery(
          internal.courseLessons.getForModuleInternal,
          { moduleId: moduleResult.moduleId },
        );
        if (lessons.length > 0) {
          const firstLesson: Doc<"courseLessons"> = lessons.sort(
            (a: Doc<"courseLessons">, b: Doc<"courseLessons">) => a.lessonIndex - b.lessonIndex,
          )[0]!;
          await ctx.runAction(api.courseAi.setMasteryGoals, {
            lessonId: firstLesson._id,
          });
        }

        return { nextPhase: "lesson", moduleTitle: moduleResult.moduleTitle };
      }

      case "completed": {
        return { nextPhase: "completed" };
      }

      default:
        throw new Error(`Unknown course phase: ${String(course.phase)}`);
    }
  },
});
