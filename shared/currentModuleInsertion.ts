export const CURRENT_MODULE_INSERT_PLACEMENTS = [
  "after_current_lesson",
  "before_lesson",
  "after_lesson",
  "end_of_module",
] as const;

export type CurrentModuleInsertionPlacement =
  (typeof CURRENT_MODULE_INSERT_PLACEMENTS)[number];

export type CurrentModuleLessonReference = {
  lessonIndex: number;
  title: string;
};

export type CurrentModuleInsertionPlan = {
  insertIndex: number;
  summary: string;
};

function normalizeLessonTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function findLessonPosition(
  lessons: CurrentModuleLessonReference[],
  referenceLessonTitle: string,
): number {
  const normalizedReference = normalizeLessonTitle(referenceLessonTitle);
  if (!normalizedReference) {
    throw new Error("A reference lesson title is required for this placement.");
  }

  const matchIndex = lessons.findIndex(
    (lesson) => normalizeLessonTitle(lesson.title) === normalizedReference,
  );
  if (matchIndex === -1) {
    throw new Error(
      `Couldn't find a lesson titled "${referenceLessonTitle}" in the current module.`,
    );
  }

  return matchIndex;
}

export function getCurrentLessonIndexAfterInsertion(
  currentLessonIndex: number,
  insertIndex: number,
): number {
  return insertIndex <= currentLessonIndex ? insertIndex : currentLessonIndex;
}

export function planCurrentModuleLessonInsertion(args: {
  lessons: CurrentModuleLessonReference[];
  currentLessonIndex: number;
  placement?: CurrentModuleInsertionPlacement;
  referenceLessonTitle?: string;
}): CurrentModuleInsertionPlan {
  const sortedLessons = [...args.lessons].sort(
    (left, right) => left.lessonIndex - right.lessonIndex,
  );

  if (sortedLessons.length === 0) {
    return {
      insertIndex: 0,
      summary: "as the first lesson in the current module",
    };
  }

  const clampedCurrentIndex = Math.min(
    Math.max(args.currentLessonIndex, 0),
    sortedLessons.length - 1,
  );
  const currentLesson = sortedLessons[clampedCurrentIndex] ?? null;
  const nextLessonPosition = Math.min(
    clampedCurrentIndex + 1,
    sortedLessons.length,
  );

  switch (args.placement ?? "after_current_lesson") {
    case "before_lesson": {
      const lessonPosition = findLessonPosition(
        sortedLessons,
        args.referenceLessonTitle ?? "",
      );
      const referencedLesson = sortedLessons[lessonPosition]!;
      return {
        insertIndex: lessonPosition,
        summary:
          lessonPosition === clampedCurrentIndex
            ? `before the current lesson "${referencedLesson.title}"`
            : `before "${referencedLesson.title}" in the current module`,
      };
    }

    case "after_lesson": {
      const lessonPosition = findLessonPosition(
        sortedLessons,
        args.referenceLessonTitle ?? "",
      );
      const referencedLesson = sortedLessons[lessonPosition]!;
      return {
        insertIndex: lessonPosition + 1,
        summary:
          lessonPosition === clampedCurrentIndex
            ? `right after the current lesson "${referencedLesson.title}"`
            : `after "${referencedLesson.title}" in the current module`,
      };
    }

    case "end_of_module":
      return {
        insertIndex: sortedLessons.length,
        summary: "at the end of the current module",
      };

    case "after_current_lesson":
    default:
      return {
        insertIndex: nextLessonPosition,
        summary: currentLesson
          ? `right after the current lesson "${currentLesson.title}"`
          : "as the next lesson in the current module",
      };
  }
}
