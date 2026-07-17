import type { GoogleGenAI } from "@google/genai";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import type { ConvexHttpClient } from "convex/browser";
import { generateEmbedding } from "./tutorTools";

export async function assembleContext(
  convex: ConvexHttpClient,
  spaceId: Id<"spaces">,
  courseId: Id<"courses"> | null,
  ai: GoogleGenAI,
  userMessage: string,
) {
  // Knowledge nodes — always space-level
  const knowledgeNodes = await convex.query(api.knowledgeNodes.getActiveForSpace, {
    spaceId,
  });

  const activeNodes = (knowledgeNodes ?? []).filter(
    (n: { isActive: boolean }) => n.isActive,
  );
  const nodesContext =
    activeNodes.length > 0
      ? activeNodes
          .map((n: { type: string; content: string }) => `[${n.type.toUpperCase()}] ${n.content}`)
          .join("\n")
      : "No active knowledge nodes yet";

  // Semantic memory search
  let relevantMemories: Array<{ content: string; category: string; _score?: number }> = [];
  try {
    const queryEmbedding = await generateEmbedding(ai, userMessage);
    if (queryEmbedding.length > 0) {
      const memories = await convex.query(api.courseTutor.getMemoriesForSpace, { spaceId });
      relevantMemories = memories
        .filter((m: { embedding: number[] }) => m.embedding && m.embedding.length > 0)
        .map((m: { embedding: number[]; content: string; category: string }) => {
          const dotProduct = m.embedding.reduce(
            (sum: number, val: number, i: number) => sum + val * (queryEmbedding[i] ?? 0),
            0,
          );
          const magA = Math.sqrt(m.embedding.reduce((sum: number, val: number) => sum + val * val, 0));
          const magB = Math.sqrt(queryEmbedding.reduce((sum: number, val: number) => sum + val * val, 0));
          const score = magA && magB ? dotProduct / (magA * magB) : 0;
          return { content: m.content, category: m.category, _score: score };
        })
        .sort((a: { _score?: number }, b: { _score?: number }) => (b._score ?? 0) - (a._score ?? 0))
        .slice(0, 5);
    }
  } catch {
    // Embedding search failed — continue without memories
  }

  const memoriesContext =
    relevantMemories.length > 0
      ? relevantMemories.map((m) => `[${m.category.toUpperCase()}] ${m.content}`).join("\n")
      : "No memories yet — this is a new conversation";

  // Course-specific context (if courseId provided)
  let courseContext = "No specific course context — space-level conversation";
  let currentLessonContext = "No active lesson";
  let currentModuleContext = "No active module context";
  let courseName = "General";

  if (courseId) {
    const course = await convex.query(api.courses.get, { courseId });
    if (course) {
      courseName = course.refinedTitle;
      const modules = await convex.query(api.courseModules.getForCourse, { courseId });
      const lessons = await convex.query(api.courseLessons.getForCourse, { courseId });

      courseContext = [
        `Course: ${course.refinedTitle}`,
        `Description: ${course.courseDescription}`,
        `Phase: ${course.phase}`,
        `Modules: ${modules?.map((m: { moduleIndex: number; moduleTitle: string }) => `${m.moduleIndex + 1}. ${m.moduleTitle}`).join("; ") ?? "none"}`,
        `Lessons completed: ${lessons?.filter((l: { status: string }) => ["summarized", "integrated"].includes(l.status)).length ?? 0}/${lessons?.length ?? 0}`,
      ].join("\n");

      const currentModule = modules?.find(
        (m: { moduleIndex: number; _id: string; moduleTitle: string }) =>
          m.moduleIndex === course.currentModuleIndex,
      );
      if (currentModule) {
        const currentModuleLessons = (lessons ?? [])
          .filter(
            (lesson: { moduleId: string }) => lesson.moduleId === currentModule._id,
          )
          .sort(
            (
              left: { lessonIndex: number },
              right: { lessonIndex: number },
            ) => left.lessonIndex - right.lessonIndex,
          );
        const currentLesson =
          currentModuleLessons[course.currentLessonIndex] ?? null;

        if (currentLesson) {
          currentLessonContext = [
            `Title: ${currentLesson.title}`,
            `Focus: ${currentLesson.focusArea}`,
            `Status: ${currentLesson.status}`,
            currentLesson.summaryMarkdown
              ? `Summary: ${currentLesson.summaryMarkdown.slice(0, 500)}`
              : "",
          ]
            .filter(Boolean)
            .join("\n");
        }

        currentModuleContext = [
          `Current module: ${currentModule.moduleTitle}`,
          `Current module lesson sequence:`,
          ...currentModuleLessons.map(
            (
              lesson: { title: string; status: string },
              index: number,
            ) =>
              `- ${index + 1}. ${lesson.title} [${lesson.status}]${
                index === course.currentLessonIndex
                  ? " (current)"
                  : index < course.currentLessonIndex
                    ? " (already passed)"
                    : ""
              }`,
          ),
        ].join("\n");
      }
    }
  } else {
    // Space-level: list all courses for broader context
    const courses = await convex.query(api.courses.getForSpace, { spaceId });
    if (courses && courses.length > 0) {
      courseContext = [
        "Courses in this space:",
        ...courses.map(
          (c: { refinedTitle: string; phase: string }) => `- ${c.refinedTitle} (${c.phase})`,
        ),
      ].join("\n");
    }
  }

  return {
    courseContext,
    currentLessonContext,
    nodesContext,
    memoriesContext,
    relevantMemories,
    courseName,
    currentModuleContext,
  };
}
