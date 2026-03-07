"use server";

import { auth } from "@clerk/nextjs/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { createAuthedConvexClient } from "../../lib/convexClientAuth";

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unexpected error";
}

export async function normalizeTopicAction(
  rawTopic: string,
): Promise<ActionResult<{ refinedTitle: string; courseDescription: string }>> {
  const { userId, getToken } = await auth();
  if (!userId) return { ok: false, error: "Unauthorized" };

  try {
    const convex = await createAuthedConvexClient(getToken, "actions.learn.normalizeTopicAction");
    const result = await convex.action(api.courseAi.normalizeTopicOnly, {
      rawTopic,
    });
    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function createCourseAction(
  spaceId: string,
  rawTopic: string,
  refinedTitle: string,
  courseDescription: string,
): Promise<ActionResult<{ courseId: string }>> {
  const { userId, getToken } = await auth();
  if (!userId) return { ok: false, error: "Unauthorized" };

  try {
    const convex = await createAuthedConvexClient(getToken, "actions.learn.createCourseAction");
    const courseId = await convex.mutation(api.courses.createCourseFromNormalized, {
      spaceId: spaceId as Id<"spaces">,
      rawTopic,
      refinedTitle,
      courseDescription,
    });
    return { ok: true, data: { courseId } };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function startCourseAction(
  spaceId: string,
  rawTopic: string,
): Promise<ActionResult<{ courseId: Id<"courses">; refinedTitle: string; courseDescription: string }>> {
  const { userId, getToken } = await auth();
  if (!userId) return { ok: false, error: "Unauthorized" };

  try {
    const convex = await createAuthedConvexClient(getToken, "actions.learn.startCourseAction");
    const result = await convex.action(api.courseAi.normalizeTopic, {
      spaceId: spaceId as Id<"spaces">,
      rawTopic,
    });
    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function generateBaselineQuestionAction(
  courseId: string,
  courseTopic: string,
  currentStep: number,
  previousQuestions: string[],
  previousResults?: Array<{ question: string; isCorrect: boolean; feedback?: string }>,
): Promise<ActionResult<{
  question_id: number;
  question_text: string;
  reference_answer: string;
  concept_tag: string;
}>> {
  const { userId, getToken } = await auth();
  if (!userId) return { ok: false, error: "Unauthorized" };

  try {
    const convex = await createAuthedConvexClient(getToken, "actions.learn.generateBaselineQuestionAction");
    const result = await convex.action(api.courseAi.generateBaselineQuestion, {
      courseId: courseId as Id<"courses">,
      courseTopic,
      currentStep,
      previousQuestions,
      previousResults,
    });
    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function submitBaselineAction(
  courseId: string,
  baselineResults: string,
): Promise<ActionResult<void>> {
  const { userId, getToken } = await auth();
  if (!userId) return { ok: false, error: "Unauthorized" };

  try {
    const convex = await createAuthedConvexClient(getToken, "actions.learn.submitBaselineAction");
    await convex.mutation(api.courses.updateBaseline, {
      courseId: courseId as Id<"courses">,
      baselineResults,
    });
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function evaluateBaselineAnswerAction(
  courseId: string,
  questionText: string,
  referenceAnswer: string,
  userAnswer: string,
): Promise<ActionResult<{ is_correct: boolean; feedback: string }>> {
  const { userId, getToken } = await auth();
  if (!userId) return { ok: false, error: "Unauthorized" };

  try {
    const convex = await createAuthedConvexClient(getToken, "actions.learn.evaluateBaselineAnswerAction");
    const result = await convex.action(api.courseAi.evaluateBaselineAnswer, {
      courseId: courseId as Id<"courses">,
      questionText,
      referenceAnswer,
      userAnswer,
    });
    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function advanceCourseAction(
  courseId: string,
): Promise<ActionResult<{ nextPhase: string; moduleTitle?: string; lessonTitle?: string }>> {
  const { userId, getToken } = await auth();
  if (!userId) return { ok: false, error: "Unauthorized" };

  try {
    const convex = await createAuthedConvexClient(getToken, "actions.learn.advanceCourseAction");
    const result = await convex.action(api.courseOrchestrator.advanceCourse, {
      courseId: courseId as Id<"courses">,
    });
    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function teachLessonAction(
  lessonId: string,
  userMessage?: string,
): Promise<ActionResult<{
  teacherResponse: string;
  isComplete: boolean;
  inputRequest: { type: string; question: string; expectedAnswer: string } | null;
}>> {
  const { userId, getToken } = await auth();
  if (!userId) return { ok: false, error: "Unauthorized" };

  try {
    const convex = await createAuthedConvexClient(getToken, "actions.learn.teachLessonAction");
    const result = await convex.action(api.courseAi.teachLesson, {
      lessonId: lessonId as Id<"courseLessons">,
      userMessage,
    });
    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function verifyInputAction(
  lessonId: string,
  question: string,
  expectedAnswer: string,
  userAnswer: string,
): Promise<ActionResult<{
  is_correct: boolean;
  feedback_block: string;
  internal_reasoning: string;
}>> {
  const { userId, getToken } = await auth();
  if (!userId) return { ok: false, error: "Unauthorized" };

  try {
    const convex = await createAuthedConvexClient(getToken, "actions.learn.verifyInputAction");
    const result = await convex.action(api.courseAi.verifyInput, {
      lessonId: lessonId as Id<"courseLessons">,
      question,
      expectedAnswer,
      userAnswer,
    });
    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function completeLessonAction(
  lessonId: string,
): Promise<ActionResult<void>> {
  const { userId, getToken } = await auth();
  if (!userId) return { ok: false, error: "Unauthorized" };

  try {
    const convex = await createAuthedConvexClient(getToken, "actions.learn.completeLessonAction");
    await convex.mutation(api.courseLessons.markCompleted, {
      lessonId: lessonId as Id<"courseLessons">,
    });
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function summarizeLessonAction(
  lessonId: string,
): Promise<ActionResult<{ summaryMarkdown: string; knowledgePieceId: string }>> {
  const { userId, getToken } = await auth();
  if (!userId) return { ok: false, error: "Unauthorized" };

  try {
    const convex = await createAuthedConvexClient(getToken, "actions.learn.summarizeLessonAction");
    const result = await convex.action(api.courseAi.summarizeLesson, {
      lessonId: lessonId as Id<"courseLessons">,
    });
    return { ok: true, data: { summaryMarkdown: result.summaryMarkdown, knowledgePieceId: result.knowledgePieceId } };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
