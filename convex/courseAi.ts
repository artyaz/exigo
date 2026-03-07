import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id, Doc } from "./_generated/dataModel";
import { GoogleGenAI } from "@google/genai";
import {
  getAuthedContextForAction,
  requireEducatorAccess,
} from "./authDecorators";
import {
  captureAiGenerationEvent,
  createAiTraceId,
} from "../shared/posthogAiObservability";
import {
  buildCourseArchitectPrompt,
  buildSequentialDiagnosticPrompt,
  buildAdaptiveSyllabusPrompt,
  buildCuratorPrompt,
  buildTeacherPrompt,
  buildVerifierPrompt,
  buildSummarizerPrompt,
} from "./coursePrompts";

function getAiClient() {
  if (!process.env.GOOGLE_GEMINI_API_KEY) {
    throw new Error("GOOGLE_GEMINI_API_KEY is not set");
  }
  return new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });
}

function getModel() {
  return process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
}

/** Strip markdown code fences and parse JSON safely */
function safeParseJson<T>(text: string): T {
  let cleaned = text.trim();
  // Strip markdown code fences
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  // If still not valid JSON, try extracting JSON object/array
  if (!cleaned.startsWith("{") && !cleaned.startsWith("[")) {
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    cleaned = objectMatch?.[0] ?? arrayMatch?.[0] ?? cleaned;
  }
  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    throw new Error(`Failed to parse AI response as JSON: ${(e as Error).message}\nRaw text: ${text.slice(0, 200)}`);
  }
}

// ─── ACTION 1: Normalize Topic (Course Architect AI) ───
export const normalizeTopic = action({
  args: {
    spaceId: v.id("spaces"),
    rawTopic: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthedContextForAction(ctx);
    requireEducatorAccess(auth);

    const ai = getAiClient();
    const model = getModel();
    const prompt = buildCourseArchitectPrompt(args.rawTopic);

    const startedAt = Date.now();
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    captureAiGenerationEvent({
      distinctId: auth.userId,
      traceId: createAiTraceId(),
      provider: "google",
      model,
      input: [{ role: "user", content: prompt }],
      response,
      latencySeconds: (Date.now() - startedAt) / 1000,
    });

    const text = response.text?.trim() ?? "";
    const parsed = safeParseJson<{
      refined_title: string;
      course_description: string;
    }>(text);

    const courseId: Id<"courses"> = await ctx.runMutation(internal.courses.createInternal, {
      spaceId: args.spaceId,
      userId: auth.userId,
      rawTopic: args.rawTopic,
      refinedTitle: parsed.refined_title,
      courseDescription: parsed.course_description,
    });

    return {
      courseId,
      refinedTitle: parsed.refined_title,
      courseDescription: parsed.course_description,
    };
  },
});

// ─── ACTION 1b: Normalize Topic Only (no course creation) ───
export const normalizeTopicOnly = action({
  args: {
    rawTopic: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthedContextForAction(ctx);
    requireEducatorAccess(auth);

    const ai = getAiClient();
    const model = getModel();
    const prompt = buildCourseArchitectPrompt(args.rawTopic);

    const startedAt = Date.now();
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    captureAiGenerationEvent({
      distinctId: auth.userId,
      traceId: createAiTraceId(),
      provider: "google",
      model,
      input: [{ role: "user", content: prompt }],
      response,
      latencySeconds: (Date.now() - startedAt) / 1000,
    });

    const text = response.text?.trim() ?? "";
    const parsed = safeParseJson<{
      refined_title: string;
      course_description: string;
    }>(text);

    return {
      refinedTitle: parsed.refined_title,
      courseDescription: parsed.course_description,
    };
  },
});

// ─── ACTION 2: Generate Baseline Question (Sequential Diagnostic AI) ───
export const generateBaselineQuestion = action({
  args: {
    courseId: v.id("courses"),
    courseTopic: v.string(),
    currentStep: v.number(),
    previousQuestions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthedContextForAction(ctx);
    requireEducatorAccess(auth);

    const ai = getAiClient();
    const model = getModel();
    const prompt = buildSequentialDiagnosticPrompt(
      args.courseTopic,
      "intermediate",
      args.currentStep,
      args.previousQuestions,
    );

    const startedAt = Date.now();
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    captureAiGenerationEvent({
      distinctId: auth.userId,
      traceId: createAiTraceId(),
      provider: "google",
      model,
      input: [{ role: "user", content: prompt }],
      response,
      latencySeconds: (Date.now() - startedAt) / 1000,
    });

    const text = response.text?.trim() ?? "";
    const parsed = safeParseJson<{
      question_id: number;
      question_text: string;
      reference_answer: string;
      concept_tag: string;
    }>(text);

    return parsed;
  },
});

// ─── ACTION 2b: Evaluate Baseline Answer ───
export const evaluateBaselineAnswer = action({
  args: {
    courseId: v.id("courses"),
    questionText: v.string(),
    referenceAnswer: v.string(),
    userAnswer: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthedContextForAction(ctx);
    requireEducatorAccess(auth);

    const ai = getAiClient();
    const model = getModel();
    const prompt = `You are an educational assessor evaluating a student's written answer to a baseline diagnostic question.

Question: ${args.questionText}
Reference Answer: ${args.referenceAnswer}
Student's Answer: ${args.userAnswer}

Evaluate if the student demonstrates understanding of the concept. Be semantically forgiving (typos/phrasing don't matter, conceptual understanding does).

Output Format (Strict JSON ONLY):
{
  "is_correct": true/false,
  "feedback": "Brief 1-sentence explanation"
}`;

    const startedAt = Date.now();
    const response = await ai.models.generateContent({ model, contents: prompt });
    captureAiGenerationEvent({
      distinctId: auth.userId,
      traceId: createAiTraceId(),
      provider: "google",
      model,
      input: [{ role: "user", content: prompt }],
      response,
      latencySeconds: (Date.now() - startedAt) / 1000,
    });

    const text = response.text?.trim() ?? "";
    return safeParseJson<{ is_correct: boolean; feedback: string }>(text);
  },
});

// ─── ACTION 3: Generate Module (Adaptive Syllabus AI) ───
export const generateModule = action({
  args: {
    courseId: v.id("courses"),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthedContextForAction(ctx);
    requireEducatorAccess(auth);

    const course: Doc<"courses"> | null = await ctx.runQuery(internal.courses.getInternal, {
      courseId: args.courseId,
    });
    if (!course || course.userId !== auth.userId)
      throw new Error("Course not found");

    const existingModules: Doc<"courseModules">[] = await ctx.runQuery(
      internal.courseModules.getForCourseInternal,
      { courseId: args.courseId },
    );
    const completedTopics = existingModules.map((m: Doc<"courseModules">) => m.moduleTitle);

    // Collect performance summaries from completed lessons
    const performanceSummaries: string[] = [];
    for (const mod of existingModules) {
      const lessons: Doc<"courseLessons">[] = await ctx.runQuery(
        internal.courseLessons.getForModuleInternal,
        { moduleId: mod._id },
      );
      for (const lesson of lessons) {
        if (lesson.summaryMarkdown) {
          performanceSummaries.push(lesson.summaryMarkdown);
        }
      }
    }

    const ai = getAiClient();
    const model = getModel();
    const prompt = buildAdaptiveSyllabusPrompt(
      course.refinedTitle,
      course.courseDescription,
      course.baselineResults ?? "No baseline data",
      completedTopics,
      performanceSummaries,
    );

    const startedAt = Date.now();
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    captureAiGenerationEvent({
      distinctId: auth.userId,
      traceId: createAiTraceId(),
      provider: "google",
      model,
      input: [{ role: "user", content: prompt }],
      response,
      latencySeconds: (Date.now() - startedAt) / 1000,
    });

    const text = response.text?.trim() ?? "";
    const parsed = safeParseJson<{
      module_title: string;
      adaptation_rationale: string;
      sub_topics: Array<{
        title: string;
        focus_area: string;
        targets_weakness: boolean;
      }>;
    }>(text);

    const moduleId: Id<"courseModules"> = await ctx.runMutation(
      internal.courseModules.createInternal,
      {
        courseId: args.courseId,
        moduleIndex: existingModules.length,
        moduleTitle: parsed.module_title,
        adaptationRationale: parsed.adaptation_rationale,
        subTopics: JSON.stringify(parsed.sub_topics),
      },
    );

    // Create lesson records for each sub-topic
    for (let i = 0; i < parsed.sub_topics.length; i++) {
      const st = parsed.sub_topics[i]!;
      await ctx.runMutation(internal.courseLessons.createInternal, {
        courseId: args.courseId,
        moduleId,
        lessonIndex: i,
        title: st.title,
        focusArea: st.focus_area,
        targetsWeakness: st.targets_weakness,
        status: "pending",
      });
    }

    await ctx.runMutation(internal.courses.updateProgress, {
      courseId: args.courseId,
      currentModuleIndex: existingModules.length,
      currentLessonIndex: 0,
      phase: "lesson",
    });

    return {
      moduleId,
      moduleTitle: parsed.module_title,
      subTopicCount: parsed.sub_topics.length,
    };
  },
});

// ─── ACTION 4: Set Mastery Goals (Curator AI) ───
export const setMasteryGoals = action({
  args: {
    lessonId: v.id("courseLessons"),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthedContextForAction(ctx);
    requireEducatorAccess(auth);

    const lesson: Doc<"courseLessons"> | null = await ctx.runQuery(
      internal.courseLessons.getInternal,
      { lessonId: args.lessonId },
    );
    if (!lesson) throw new Error("Lesson not found");

    const course: Doc<"courses"> | null = await ctx.runQuery(internal.courses.getInternal, {
      courseId: lesson.courseId,
    });
    if (!course || course.userId !== auth.userId)
      throw new Error("Unauthorized");

    const ai = getAiClient();
    const model = getModel();
    const prompt = buildCuratorPrompt(
      course.refinedTitle,
      lesson.title,
      "intermediate",
    );

    const startedAt = Date.now();
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    captureAiGenerationEvent({
      distinctId: auth.userId,
      traceId: createAiTraceId(),
      provider: "google",
      model,
      input: [{ role: "user", content: prompt }],
      response,
      latencySeconds: (Date.now() - startedAt) / 1000,
    });

    const text = response.text?.trim() ?? "";
    const masteryGoals = safeParseJson<string[]>(text);

    await ctx.runMutation(
      internal.courseLessons.updateMasteryGoalsInternal,
      {
        lessonId: args.lessonId,
        masteryGoals: JSON.stringify(masteryGoals),
      },
    );

    return { masteryGoals };
  },
});

// ─── ACTION 5: Teach Lesson (Teacher AI) ───
export const teachLesson = action({
  args: {
    lessonId: v.id("courseLessons"),
    userMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthedContextForAction(ctx);
    requireEducatorAccess(auth);

    const lesson: Doc<"courseLessons"> | null = await ctx.runQuery(
      internal.courseLessons.getInternal,
      { lessonId: args.lessonId },
    );
    if (!lesson) throw new Error("Lesson not found");

    const course: Doc<"courses"> | null = await ctx.runQuery(internal.courses.getInternal, {
      courseId: lesson.courseId,
    });
    if (!course || course.userId !== auth.userId)
      throw new Error("Unauthorized");

    // Save user message if provided
    if (args.userMessage) {
      await ctx.runMutation(internal.courseLessonMessages.sendInternal, {
        courseId: lesson.courseId,
        lessonId: args.lessonId,
        role: "user",
        content: args.userMessage,
      });
    }

    // Get conversation history
    const messages: Doc<"courseLessonMessages">[] = await ctx.runQuery(
      internal.courseLessonMessages.getForLessonInternal,
      { lessonId: args.lessonId },
    );

    let masteryGoals: string[] = [];
    try {
      masteryGoals = lesson.masteryGoals ? JSON.parse(lesson.masteryGoals) : [];
    } catch { /* corrupted data, proceed with empty goals */ }

    // Build context from conversation history
    const historyStr = messages
      .slice(-20)
      .map(
        (m: Doc<"courseLessonMessages">) =>
          `${m.role === "teacher" ? "Teacher" : m.role === "user" ? "Student" : "System"}: ${m.content}`,
      )
      .join("\n");

    const ai = getAiClient();
    const model = getModel();
    const prompt = buildTeacherPrompt(
      course.refinedTitle,
      lesson.title,
      historyStr || "This is the beginning of the lesson.",
      masteryGoals,
    );

    const startedAt = Date.now();
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    captureAiGenerationEvent({
      distinctId: auth.userId,
      traceId: createAiTraceId(),
      provider: "google",
      model,
      input: [{ role: "user", content: prompt }],
      response,
      latencySeconds: (Date.now() - startedAt) / 1000,
    });

    const teacherResponse = response.text?.trim() ?? "";
    const isComplete = teacherResponse.includes("[LESSON_COMPLETE]");

    // Detect input request
    const inputRequestMatch = teacherResponse.match(
      /\[INPUT_REQUEST:\s*([^|\]]+?)\s*\|\s*([^|\]]+?)\s*(?:\|\s*([^\]]*?))?\s*\]/,
    );

    const messageType = inputRequestMatch
      ? "input_request"
      : isComplete
        ? "lesson_complete"
        : "narrative";

    await ctx.runMutation(internal.courseLessonMessages.sendInternal, {
      courseId: lesson.courseId,
      lessonId: args.lessonId,
      role: "teacher",
      content: teacherResponse,
      messageType,
    });

    // Update lesson status to teaching if it's the first message
    if (lesson.status === "goals_set" || lesson.status === "pending") {
      await ctx.runMutation(internal.courseLessons.updateStatusInternal, {
        lessonId: args.lessonId,
        status: "teaching",
      });
    }

    return {
      teacherResponse,
      isComplete,
      inputRequest: inputRequestMatch
        ? {
            type: inputRequestMatch[1]!.trim(),
            question: inputRequestMatch[2]!.trim(),
            expectedAnswer: inputRequestMatch[3]!.trim(),
          }
        : null,
    };
  },
});

// ─── ACTION 6: Verify Input (Verifier AI) ───
export const verifyInput = action({
  args: {
    lessonId: v.id("courseLessons"),
    question: v.string(),
    expectedAnswer: v.string(),
    userAnswer: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthedContextForAction(ctx);
    requireEducatorAccess(auth);

    const lesson: Doc<"courseLessons"> | null = await ctx.runQuery(
      internal.courseLessons.getInternal,
      { lessonId: args.lessonId },
    );
    if (!lesson) throw new Error("Lesson not found");

    const course: Doc<"courses"> | null = await ctx.runQuery(internal.courses.getInternal, {
      courseId: lesson.courseId,
    });
    if (!course || course.userId !== auth.userId)
      throw new Error("Unauthorized");

    const ai = getAiClient();
    const model = getModel();
    const prompt = buildVerifierPrompt(
      `${course.refinedTitle} - ${lesson.title}`,
      args.question,
      args.expectedAnswer,
      args.userAnswer,
    );

    const startedAt = Date.now();
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    captureAiGenerationEvent({
      distinctId: auth.userId,
      traceId: createAiTraceId(),
      provider: "google",
      model,
      input: [{ role: "user", content: prompt }],
      response,
      latencySeconds: (Date.now() - startedAt) / 1000,
    });

    const text = response.text?.trim() ?? "";
    const parsed = safeParseJson<{
      is_correct: boolean;
      feedback_block: string;
      internal_reasoning: string;
    }>(text);

    // Append to verifier logs
    let existingLogs: Array<{
      question: string;
      userAnswer: string;
      isCorrect: boolean;
      feedback: string;
    }> = [];
    try {
      existingLogs = lesson.verifierLogs ? JSON.parse(lesson.verifierLogs) : [];
    } catch { /* corrupted data, proceed with empty logs */ }
    existingLogs.push({
      question: args.question,
      userAnswer: args.userAnswer,
      isCorrect: parsed.is_correct,
      feedback: parsed.feedback_block,
    });

    await ctx.runMutation(
      internal.courseLessons.updateVerifierLogsInternal,
      {
        lessonId: args.lessonId,
        verifierLogs: JSON.stringify(existingLogs),
      },
    );

    // Save verification as a system message
    await ctx.runMutation(internal.courseLessonMessages.sendInternal, {
      courseId: lesson.courseId,
      lessonId: args.lessonId,
      role: "system",
      content: parsed.feedback_block,
      messageType: "verification",
    });

    return parsed;
  },
});

// ─── ACTION 7: Summarize Lesson (Summarizer AI + Exigo Integration) ───
export const summarizeLesson = action({
  args: {
    lessonId: v.id("courseLessons"),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthedContextForAction(ctx);
    requireEducatorAccess(auth);

    const lesson: Doc<"courseLessons"> | null = await ctx.runQuery(
      internal.courseLessons.getInternal,
      { lessonId: args.lessonId },
    );
    if (!lesson) throw new Error("Lesson not found");

    const course: Doc<"courses"> | null = await ctx.runQuery(internal.courses.getInternal, {
      courseId: lesson.courseId,
    });
    if (!course || course.userId !== auth.userId)
      throw new Error("Unauthorized");

    let masteryGoals: string[] = [];
    try {
      masteryGoals = lesson.masteryGoals ? JSON.parse(lesson.masteryGoals) : [];
    } catch { /* corrupted data, proceed with empty goals */ }
    let verifierLogs: Array<{
      question: string;
      userAnswer: string;
      isCorrect: boolean;
      feedback: string;
    }> = [];
    try {
      verifierLogs = lesson.verifierLogs ? JSON.parse(lesson.verifierLogs) : [];
    } catch { /* corrupted data, proceed with empty logs */ }

    const ai = getAiClient();
    const model = getModel();
    const prompt = buildSummarizerPrompt(
      `${course.refinedTitle} - ${lesson.title}`,
      masteryGoals,
      verifierLogs,
    );

    const startedAt = Date.now();
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    captureAiGenerationEvent({
      distinctId: auth.userId,
      traceId: createAiTraceId(),
      provider: "google",
      model,
      input: [{ role: "user", content: prompt }],
      response,
      latencySeconds: (Date.now() - startedAt) / 1000,
    });

    const summaryMarkdown = response.text?.trim() ?? "";

    // Save summary to lesson
    await ctx.runMutation(internal.courseLessons.updateSummaryInternal, {
      lessonId: args.lessonId,
      summaryMarkdown,
      status: "summarized",
    });

    // ─── Exigo Integration ───

    // 1. Create Knowledge Piece
    const pieceId: Id<"knowledgePieces"> = await ctx.runMutation(
      internal.knowledgePieces.addInternal,
      {
        spaceId: course.spaceId,
        title: lesson.title,
        content: summaryMarkdown,
        source: `adaptive-course:${course._id}`,
      },
    );

    // Link piece to lesson
    await ctx.runMutation(
      internal.courseLessons.setKnowledgePieceIdInternal,
      {
        lessonId: args.lessonId,
        knowledgePieceId: pieceId,
      },
    );

    // 2. Parse strengths and weaknesses from verifier logs
    const strengths = verifierLogs.filter((l) => l.isCorrect);
    const weaknesses = verifierLogs.filter((l) => !l.isCorrect);

    // Create improvement nodes for strengths
    for (const s of strengths) {
      await ctx.runMutation(internal.knowledgeNodes.createInternal, {
        spaceId: course.spaceId,
        knowledgePieceId: pieceId,
        type: "improvement",
        content: s.question,
      });
    }

    // Create struggle nodes for weaknesses
    for (const w of weaknesses) {
      await ctx.runMutation(internal.knowledgeNodes.createInternal, {
        spaceId: course.spaceId,
        knowledgePieceId: pieceId,
        type: "struggle",
        content: `${w.question} — ${w.feedback}`,
      });
    }

    // 3. Trigger Exigo test generation for the new knowledge piece
    await ctx.runMutation(api.tests.createEmptyTest, {
      spaceId: course.spaceId,
      type: "select",
      questionCount: 5,
      topicTitle: lesson.title,
      userId: auth.userId,
      knowledgePieceId: pieceId,
    });

    // 4. Update lesson status
    await ctx.runMutation(internal.courseLessons.updateStatusInternal, {
      lessonId: args.lessonId,
      status: "integrated",
    });

    return { summaryMarkdown, knowledgePieceId: pieceId };
  },
});
