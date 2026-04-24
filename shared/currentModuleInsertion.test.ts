import { describe, expect, it } from "vitest";
import {
  getCurrentLessonIndexAfterInsertion,
  planCurrentModuleLessonInsertion,
} from "./currentModuleInsertion";

const LESSONS = [
  { lessonIndex: 0, title: "Routing basics" },
  { lessonIndex: 1, title: "Data loading patterns" },
  { lessonIndex: 2, title: "Caching strategy" },
];

describe("planCurrentModuleLessonInsertion", () => {
  it("defaults to right after the current lesson", () => {
    expect(
      planCurrentModuleLessonInsertion({
        lessons: LESSONS,
        currentLessonIndex: 0,
      }),
    ).toEqual({
      insertIndex: 1,
      summary: 'right after the current lesson "Routing basics"',
    });
  });

  it("inserts before a named upcoming lesson", () => {
    expect(
      planCurrentModuleLessonInsertion({
        lessons: LESSONS,
        currentLessonIndex: 0,
        placement: "before_lesson",
        referenceLessonTitle: "Caching strategy",
      }),
    ).toEqual({
      insertIndex: 2,
      summary: 'before "Caching strategy" in the current module',
    });
  });

  it("inserts before the current lesson when requested", () => {
    expect(
      planCurrentModuleLessonInsertion({
        lessons: LESSONS,
        currentLessonIndex: 1,
        placement: "before_lesson",
        referenceLessonTitle: "Data loading patterns",
      }),
    ).toEqual({
      insertIndex: 1,
      summary: 'before the current lesson "Data loading patterns"',
    });
  });

  it("inserts after a named lesson", () => {
    expect(
      planCurrentModuleLessonInsertion({
        lessons: LESSONS,
        currentLessonIndex: 0,
        placement: "after_lesson",
        referenceLessonTitle: "Data loading patterns",
      }),
    ).toEqual({
      insertIndex: 2,
      summary: 'after "Data loading patterns" in the current module',
    });
  });

  it("inserts at the end of the module when requested", () => {
    expect(
      planCurrentModuleLessonInsertion({
        lessons: LESSONS,
        currentLessonIndex: 1,
        placement: "end_of_module",
      }),
    ).toEqual({
      insertIndex: 3,
      summary: "at the end of the current module",
    });
  });

  it("supports empty modules", () => {
    expect(
      planCurrentModuleLessonInsertion({
        lessons: [],
        currentLessonIndex: 0,
      }),
    ).toEqual({
      insertIndex: 0,
      summary: "as the first lesson in the current module",
    });
  });

  it("allows inserting before an earlier lesson too", () => {
    expect(
      planCurrentModuleLessonInsertion({
        lessons: LESSONS,
        currentLessonIndex: 1,
        placement: "before_lesson",
        referenceLessonTitle: "Routing basics",
      }),
    ).toEqual({
      insertIndex: 0,
      summary: 'before "Routing basics" in the current module',
    });
  });

  it("throws when reference lesson is not found", () => {
    expect(() =>
      planCurrentModuleLessonInsertion({
        lessons: LESSONS,
        currentLessonIndex: 0,
        placement: "before_lesson",
        referenceLessonTitle: "Nonexistent lesson",
      }),
    ).toThrow(/Couldn't find a lesson titled "Nonexistent lesson"/);
  });
});

describe("getCurrentLessonIndexAfterInsertion", () => {
  it("moves the course pointer to the inserted lesson when it lands before or at current", () => {
    expect(getCurrentLessonIndexAfterInsertion(1, 1)).toBe(1);
    expect(getCurrentLessonIndexAfterInsertion(2, 0)).toBe(0);
  });

  it("keeps the current lesson pointer when inserting later in the module", () => {
    expect(getCurrentLessonIndexAfterInsertion(1, 3)).toBe(1);
  });
});
