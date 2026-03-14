import { describe, expect, it } from "vitest";
import {
  parseLessonSections,
  restoreLessonProgress,
  restoreLessonRuntimeState,
  shouldMarkLessonComplete,
  type PersistedLessonCheckpointState,
} from "./lessonCheckpoints";

describe("shouldMarkLessonComplete", () => {
  it("requires the completion signal and no pending checkpoint", () => {
    expect(shouldMarkLessonComplete({
      hasCompletionSignal: true,
      currentInputRequest: {
        type: "fill_in",
        question: "What is 2 + 2?",
        expectedAnswer: "4",
      },
    })).toBe(false);

    expect(shouldMarkLessonComplete({
      hasCompletionSignal: true,
      currentInputRequest: null,
    })).toBe(true);
  });
});

describe("restoreLessonProgress", () => {
  const sections = parseLessonSections(`
Intro
[INPUT_REQUEST: fill_in | What is 2 + 2? | 4]

Middle
[INPUT_REQUEST: predict | What comes next? | 5]

Wrap up
  `);

  it("restores explicit persisted checkpoint states and keeps later checkpoints pending", () => {
    const checkpointStates: PersistedLessonCheckpointState[] = [
      {
        sectionIndex: 0,
        question: "What is 2 + 2?",
        status: "skipped",
      },
    ];

    const restored = restoreLessonProgress({
      sections,
      lessonMessages: [],
      checkpointStates,
    });

    expect(restored.answeredCheckpoints.get(0)).toEqual({ skipped: true });
    expect(restored.currentInputRequest?.question).toBe("What comes next?");
    expect(restored.lastVerification).toBeNull();
    expect(restored.revealedCount).toBe(2);
  });

  it("falls back to legacy verifier logs for a pending incorrect checkpoint", () => {
    const restored = restoreLessonProgress({
      sections,
      lessonMessages: [],
      verifierLogs: JSON.stringify([
        {
          question: "What is 2 + 2?",
          userAnswer: "4",
          isCorrect: true,
          feedback: "Yep",
        },
        {
          question: "What comes next?",
          userAnswer: "6",
          isCorrect: false,
          feedback: "Close, try again",
        },
      ]),
    });

    expect(restored.answeredCheckpoints.get(0)).toEqual({
      answer: "4",
      skipped: false,
      verification: {
        is_correct: true,
        feedback_block: "Yep",
      },
    });
    expect(restored.currentInputRequest?.question).toBe("What comes next?");
    expect(restored.lastVerification).toEqual({
      is_correct: false,
      feedback_block: "Close, try again",
    });
    expect(restored.revealedCount).toBe(2);
  });
});

describe("restoreLessonRuntimeState", () => {
  it("restores the visible checkpoint from reconstructed teacher text and persisted states", () => {
    const restored = restoreLessonRuntimeState({
      lessonMessages: [
        {
          role: "teacher",
          content: [
            "Intro",
            "[INPUT_REQUEST: fill_in | First checkpoint? | alpha]",
            "",
            "More detail",
            "[INPUT_REQUEST: predict | Second checkpoint? | beta]",
          ].join("\n"),
          messageType: "input_request",
        },
      ],
      checkpointStates: [
        {
          sectionIndex: 0,
          question: "First checkpoint?",
          status: "skipped",
        },
      ],
    });

    expect(restored).not.toBeNull();
    expect(restored?.fullText).toContain("First checkpoint?");
    expect(restored?.answeredCheckpoints.get(0)).toEqual({ skipped: true });
    expect(restored?.currentInputRequest?.question).toBe("Second checkpoint?");
    expect(restored?.revealedCount).toBe(2);
    expect(restored?.isLessonComplete).toBe(false);
  });

  it("keeps the lesson incomplete while a checkpoint is still pending", () => {
    const restored = restoreLessonRuntimeState({
      lessonMessages: [
        {
          role: "teacher",
          content: [
            "Intro",
            "[INPUT_REQUEST: fill_in | What is 2 + 2? | 4]",
            "",
            "Wrap up",
            "[LESSON_COMPLETE]",
          ].join("\n"),
          messageType: "input_request",
        },
      ],
    });

    expect(restored).not.toBeNull();
    expect(restored?.isLessonComplete).toBe(false);
    expect(restored?.currentInputRequest?.question).toBe("What is 2 + 2?");
    expect(restored?.revealedCount).toBe(1);
  });

  it("reveals all sections for completed lessons", () => {
    const restored = restoreLessonRuntimeState({
      lessonMessages: [
        {
          role: "teacher",
          content: [
            "Intro",
            "[INPUT_REQUEST: fill_in | What is 2 + 2? | 4]",
            "",
            "Wrap up",
            "[LESSON_COMPLETE]",
          ].join("\n"),
          messageType: "lesson_complete",
        },
      ],
      checkpointStates: [
        {
          sectionIndex: 0,
          question: "What is 2 + 2?",
          status: "answered",
          answer: "4",
          verification: {
            is_correct: true,
            feedback_block: "Yep",
          },
        },
      ],
    });

    expect(restored).not.toBeNull();
    expect(restored?.isLessonComplete).toBe(true);
    expect(restored?.currentInputRequest).toBeNull();
    expect(restored?.lastVerification).toBeNull();
    expect(restored?.revealedCount).toBe(
      parseLessonSections([
        "Intro",
        "[INPUT_REQUEST: fill_in | What is 2 + 2? | 4]",
        "",
        "Wrap up",
        "[LESSON_COMPLETE]",
      ].join("\n")).length,
    );
  });
});
