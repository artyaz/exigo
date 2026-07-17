import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id, Doc } from "./_generated/dataModel";
import { GoogleGenAI } from "@google/genai";
import {
  getAuthedContextForAction,
  requireEducatorAccess,
} from "./authDecorators";
import { requireOwnedCourseForAction } from "./courseAuth";
import {
  captureAiGenerationEvent,
  createAiTraceId,
} from "../shared/posthogAiObservability";
import { renderPrompt } from "./coursePrompts";
import {
  isRequestedTopicCovered,
  parseInsertTopicRequestContent,
} from "../shared/courseTopicRequests";
import { MAX_MODULES } from "../shared/courseConfig";

function getAiClient() {
  if (!process.env.GOOGLE_GEMINI_API_KEY) {
    throw new Error("GOOGLE_GEMINI_API_KEY is not set");
  }
  return new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });
}

function getModel() {
  return process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";
}

function getModelPro() {
  return process.env.GEMINI_MODEL_PRO ?? "gemini-3-flash-preview";
}

/** Strip markdown code fences and parse JSON safely */
function safeParseJson<T>(text: string): T {
  let cleaned = text.trim();
  // Strip markdown code fences
  cleaned = cleaned
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  // If still not valid JSON, try extracting JSON object/array
  if (!cleaned.startsWith("{") && !cleaned.startsWith("[")) {
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    cleaned = objectMatch?.[0] ?? arrayMatch?.[0] ?? cleaned;
  }
  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    throw new Error(
      `Failed to parse AI response as JSON: ${(e as Error).message}`,
    );
  }
}

type PendingModuleTopicRequest = {
  topic: string;
  context: string;
};

function getPendingModuleTopicRequest(
  activeNodes: Doc<"knowledgeNodes">[],
  existingModuleTitles: string[],
): PendingModuleTopicRequest | null {
  const sortedNodes = [...activeNodes].sort(
    (left, right) => right._creationTime - left._creationTime,
  );

  for (const node of sortedNodes) {
    const request = parseInsertTopicRequestContent(node.content);
    if (!request) {
      continue;
    }

    const alreadyCovered = existingModuleTitles.some((moduleTitle) =>
      isRequestedTopicCovered(request.topic, moduleTitle),
    );
    if (!alreadyCovered) {
      return request;
    }
  }

  return null;
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

    // Fail-fast space ownership before burning Gemini quota
    const space = await ctx.runQuery(internal.courses.getSpaceInternal, {
      spaceId: args.spaceId,
    });
    if (!space || space.userId !== auth.userId) {
      throw new Error("Unauthorized access to this space");
    }

    const ai = getAiClient();
    const model = getModelPro();
    const promptDoc = await ctx.runQuery(
      internal.coursePrompts.getPromptInternal,
      {
        name: "course_architect",
      },
    );
    const prompt = renderPrompt(promptDoc.content, { rawInput: args.rawTopic });

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

    const courseId: Id<"courses"> = await ctx.runMutation(
      internal.courses.createInternal,
      {
        spaceId: args.spaceId,
        userId: auth.userId,
        rawTopic: args.rawTopic,
        refinedTitle: parsed.refined_title,
        courseDescription: parsed.course_description,
      },
    );

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
    const model = getModelPro();
    const promptDoc = await ctx.runQuery(
      internal.coursePrompts.getPromptInternal,
      {
        name: "course_architect",
      },
    );
    const prompt = renderPrompt(promptDoc.content, { rawInput: args.rawTopic });

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
    previousResults: v.optional(
      v.array(
        v.object({
          question: v.string(),
          isCorrect: v.boolean(),
          feedback: v.optional(v.string()),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthedContextForAction(ctx);
    requireEducatorAccess(auth);

    const course = await requireOwnedCourseForAction(
      ctx,
      args.courseId,
      auth.userId,
    );

    const ai = getAiClient();
    const model = getModel();
    const resultsContext =
      args.previousResults && args.previousResults.length > 0
        ? `\n[Previous Answer Results]: ${JSON.stringify(args.previousResults)}\n\nIMPORTANT: Adapt difficulty based on the student's performance. If they struggled with previous questions, make this question slightly easier to match their level. If they answered correctly, maintain or increase difficulty.`
        : "";

    const promptDoc = await ctx.runQuery(
      internal.coursePrompts.getPromptInternal,
      {
        name: "sequential_diagnostic",
      },
    );
    const prompt = renderPrompt(promptDoc.content, {
      courseTopic: course.refinedTitle || args.courseTopic,
      targetAudienceLevel: "intermediate",
      currentStep: args.currentStep,
      previousQuestions: JSON.stringify(args.previousQuestions),
      resultsContext,
    });

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

    await requireOwnedCourseForAction(ctx, args.courseId, auth.userId);

    const ai = getAiClient();
    const model = getModel();
    const promptDoc = await ctx.runQuery(
      internal.coursePrompts.getPromptInternal,
      {
        name: "baseline_evaluation",
      },
    );
    const prompt = renderPrompt(promptDoc.content, {
      questionText: args.questionText,
      referenceAnswer: args.referenceAnswer,
      userAnswer: args.userAnswer,
    });

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
    return safeParseJson<{ is_correct: boolean; feedback: string }>(text);
  },
});

// ─── ACTION 3: Generate Module (Adaptive Syllabus AI) ───
/**
 * Creates the next module + lessons. Entry guards:
 * - owner + educator
 * - course.phase must be "module_generation" (orchestrator claims this phase)
 * - modules.length < MAX_MODULES (terminal budget; orchestrator also enforces)
 *
 * On success, patches currentModuleIndex / currentLessonIndex and phase → "lesson"
 * so the UI leaves GeneratingPhase. Structural transitions (incl. "completed")
 * remain orchestrator-owned.
 */
export const generateModule = action({
  args: {
    courseId: v.id("courses"),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthedContextForAction(ctx);
    requireEducatorAccess(auth);

    const course = await requireOwnedCourseForAction(
      ctx,
      args.courseId,
      auth.userId,
    );

    if (course.phase !== "module_generation") {
      throw new Error(
        `Cannot generate module while course phase is "${course.phase}" (expected "module_generation")`,
      );
    }

    const existingModules: Doc<"courseModules">[] = await ctx.runQuery(
      internal.courseModules.getForCourseInternal,
      { courseId: args.courseId },
    );

    if (existingModules.length >= MAX_MODULES) {
      throw new Error(
        `Course already has the maximum of ${MAX_MODULES} modules`,
      );
    }

    const completedTopics = existingModules.map(
      (m: Doc<"courseModules">) => m.moduleTitle,
    );

    // Batch-fetch all lessons for the course (avoids N+1 per-module queries)
    const allLessons: Doc<"courseLessons">[] = await ctx.runQuery(
      internal.courseLessons.getForCourseInternal,
      { courseId: args.courseId },
    );
    const performanceSummaries: string[] = allLessons
      .filter((lesson) => lesson.summaryMarkdown)
      .map((lesson) => lesson.summaryMarkdown!);

    // Collect active knowledge nodes for the course's space
    const activeNodes = await ctx.runQuery(
      internal.knowledgeNodes.getActiveNodesForSpaceInternal,
      { spaceId: course.spaceId },
    );
    const pendingTopicRequest = getPendingModuleTopicRequest(
      activeNodes,
      completedTopics,
    );
    const knowledgeNodeLines = activeNodes
      .map((node) => {
        const request = parseInsertTopicRequestContent(node.content);
        if (request) {
          return null;
        }

        return `- [${node.type.toUpperCase()}] ${node.content}`;
      })
      .filter((line): line is string => line !== null);

    if (pendingTopicRequest) {
      knowledgeNodeLines.unshift(
        `- [FEELS_HARD] Student explicitly requested that the next module cover "${pendingTopicRequest.topic}". Context: ${pendingTopicRequest.context}`,
      );
    }

    const knowledgeNodesStr =
      knowledgeNodeLines.length > 0
        ? knowledgeNodeLines.join("\n")
        : "No knowledge nodes yet";

    const ai = getAiClient();
    const model = getModelPro();
    const promptDoc = await ctx.runQuery(
      internal.coursePrompts.getPromptInternal,
      {
        name: "adaptive_syllabus",
      },
    );
    const basePrompt = renderPrompt(promptDoc.content, {
      courseTitle: course.refinedTitle,
      courseDescription: course.courseDescription,
      baselineResults: course.baselineResults ?? "No baseline data",
      completedTopics: JSON.stringify(completedTopics),
      performanceSummaries: JSON.stringify(performanceSummaries),
      knowledgeNodes: knowledgeNodesStr,
    });
    const prompt = pendingTopicRequest
      ? [
          basePrompt,
          "",
          "Additional hard requirement:",
          `The student explicitly requested that the very next module cover "${pendingTopicRequest.topic}".`,
          `Honor this request directly. The generated module_title must clearly name or center that topic.`,
          `Use this context when shaping the module: ${pendingTopicRequest.context}.`,
          "In adaptation_rationale, mention that this module was prioritized because of the explicit topic-insert request.",
        ].join("\n")
      : basePrompt;

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

    const course: Doc<"courses"> | null = await ctx.runQuery(
      internal.courses.getInternal,
      {
        courseId: lesson.courseId,
      },
    );
    if (!course || course.userId !== auth.userId)
      throw new Error("Unauthorized");

    const ai = getAiClient();
    const model = getModel();
    const promptDoc = await ctx.runQuery(
      internal.coursePrompts.getPromptInternal,
      {
        name: "curator",
      },
    );
    const prompt = renderPrompt(promptDoc.content, {
      topic: course.refinedTitle,
      subTopic: lesson.title,
      targetAudienceLevel: "intermediate",
    });

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

    await ctx.runMutation(internal.courseLessons.updateMasteryGoalsInternal, {
      lessonId: args.lessonId,
      masteryGoals: JSON.stringify(masteryGoals),
    });

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

    const course: Doc<"courses"> | null = await ctx.runQuery(
      internal.courses.getInternal,
      {
        courseId: lesson.courseId,
      },
    );
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
    } catch {
      /* corrupted data, proceed with empty goals */
    }

    // Build context from conversation history
    const ai = getAiClient();
    const model = getModel();
    const historyStr = messages
      .slice(-20)
      .map(
        (m: Doc<"courseLessonMessages">) =>
          `${m.role === "teacher" ? "Teacher" : m.role === "user" ? "Student" : "System"}: ${m.content}`,
      )
      .join("\n");
    const context = historyStr || "This is the beginning of the lesson.";
    const isFirstMessage =
      context === "This is the beginning of the lesson." ||
      !context.includes("Teacher:");

    const promptName = isFirstMessage ? "teacher_start" : "teacher_continue";
    const promptDoc = await ctx.runQuery(
      internal.coursePrompts.getPromptInternal,
      {
        name: promptName,
      },
    );
    const prompt = renderPrompt(promptDoc.content, {
      topic: course.refinedTitle,
      subTopic: lesson.title,
      context,
      masteryArray: JSON.stringify(masteryGoals),
    });

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
    sectionIndex: v.number(),
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

    const course: Doc<"courses"> | null = await ctx.runQuery(
      internal.courses.getInternal,
      {
        courseId: lesson.courseId,
      },
    );
    if (!course || course.userId !== auth.userId)
      throw new Error("Unauthorized");

    const ai = getAiClient();
    const model = getModel();
    const promptDoc = await ctx.runQuery(
      internal.coursePrompts.getPromptInternal,
      {
        name: "verifier",
      },
    );
    const prompt = renderPrompt(promptDoc.content, {
      lessonContext: `${course.refinedTitle} - ${lesson.title}`,
      question: args.question,
      expectedAnswer: args.expectedAnswer,
      userAnswer: args.userAnswer,
    });

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
    } catch {
      /* corrupted data, proceed with empty logs */
    }
    existingLogs.push({
      question: args.question,
      userAnswer: args.userAnswer,
      isCorrect: parsed.is_correct,
      feedback: parsed.feedback_block,
    });

    await ctx.runMutation(internal.courseLessons.updateVerifierLogsInternal, {
      lessonId: args.lessonId,
      verifierLogs: JSON.stringify(existingLogs),
    });

    await ctx.runMutation(internal.courseLessons.saveCheckpointStateInternal, {
      lessonId: args.lessonId,
      checkpointState: {
        sectionIndex: args.sectionIndex,
        question: args.question,
        status: parsed.is_correct ? "answered" : "pending",
        answer: args.userAnswer,
        verification: {
          is_correct: parsed.is_correct,
          feedback_block: parsed.feedback_block,
        },
      },
    });

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

// ─── ACTION 6.5: Clarify Concept (Clarifier AI) ───
export const clarifyConcept = action({
  args: {
    lessonId: v.id("courseLessons"),
    quote: v.string(),
    question: v.string(),
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthedContextForAction(ctx);
    requireEducatorAccess(auth);

    const lesson: Doc<"courseLessons"> | null = await ctx.runQuery(
      internal.courseLessons.getInternal,
      { lessonId: args.lessonId },
    );
    if (!lesson) throw new Error("Lesson not found");

    const course: Doc<"courses"> | null = await ctx.runQuery(
      internal.courses.getInternal,
      {
        courseId: lesson.courseId,
      },
    );
    if (!course || course.userId !== auth.userId)
      throw new Error("Unauthorized");

    // Save user question
    await ctx.runMutation(internal.courseLessonMessages.sendInternal, {
      courseId: lesson.courseId,
      lessonId: args.lessonId,
      role: "user",
      content: args.question,
      messageType: "clarification",
      clarificationQuote: args.quote,
      threadId: args.threadId,
    });

    // Get previous messages in this thread
    const allMessages: Doc<"courseLessonMessages">[] = await ctx.runQuery(
      internal.courseLessonMessages.getForLessonInternal,
      { lessonId: args.lessonId },
    );
    const threadMessages = allMessages.filter(
      (m) => m.threadId === args.threadId,
    );

    // Build context
    const ai = getAiClient();
    const model = getModel();
    const historyStr = threadMessages
      .slice(-10)
      .map(
        (m) =>
          `${m.role === "teacher" || m.role === "system" ? "Teacher" : "Student"}: ${m.content}`,
      )
      .join("\n");

    const promptDoc = await ctx.runQuery(
      internal.coursePrompts.getPromptInternal,
      {
        name: "clarifier",
      },
    );

    const prompt = renderPrompt(promptDoc.content, {
      lessonContext: `${course.refinedTitle} - ${lesson.title}`,
      quote: args.quote,
      question: args.question,
      history: historyStr || "No previous conversation in this thread.",
    });

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

    const answer = response.text?.trim() ?? "";

    // Save AI clarification
    await ctx.runMutation(internal.courseLessonMessages.sendInternal, {
      courseId: lesson.courseId,
      lessonId: args.lessonId,
      role: "teacher",
      content: answer,
      messageType: "clarification",
      clarificationQuote: args.quote,
      threadId: args.threadId,
    });

    return { answer };
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

    const course: Doc<"courses"> | null = await ctx.runQuery(
      internal.courses.getInternal,
      {
        courseId: lesson.courseId,
      },
    );
    if (!course || course.userId !== auth.userId)
      throw new Error("Unauthorized");

    let masteryGoals: string[] = [];
    try {
      masteryGoals = lesson.masteryGoals ? JSON.parse(lesson.masteryGoals) : [];
    } catch {
      /* corrupted data, proceed with empty goals */
    }
    let verifierLogs: Array<{
      question: string;
      userAnswer: string;
      isCorrect: boolean;
      feedback: string;
    }> = [];
    try {
      verifierLogs = lesson.verifierLogs ? JSON.parse(lesson.verifierLogs) : [];
    } catch {
      /* corrupted data, proceed with empty logs */
    }

    // Build clarification context separately (instead of forcing isCorrect: false)
    const allMessages: Doc<"courseLessonMessages">[] = await ctx.runQuery(
      internal.courseLessonMessages.getForLessonInternal,
      { lessonId: args.lessonId },
    );
    const userClarifications = allMessages.filter(
      (m) => m.messageType === "clarification" && m.role === "user",
    );
    const teacherClarifications = allMessages.filter(
      (m) => m.messageType === "clarification" && m.role === "teacher",
    );

    // Build paired clarification context: user question + AI response
    const clarificationPairs: Array<{
      quote: string;
      userQuestion: string;
      aiResponse: string;
    }> = [];
    for (const uc of userClarifications) {
      const matchingResponse = teacherClarifications.find(
        (tc) => tc.threadId === uc.threadId && tc._creationTime > uc._creationTime,
      );
      clarificationPairs.push({
        quote: uc.clarificationQuote ?? "",
        userQuestion: uc.content,
        aiResponse: matchingResponse?.content ?? "(no response recorded)",
      });
    }

    const ai = getAiClient();
    const model = getModel();
    const promptDoc = await ctx.runQuery(
      internal.coursePrompts.getPromptInternal,
      {
        name: "summarizer",
      },
    );
    const prompt = renderPrompt(promptDoc.content, {
      topicCovered: `${course.refinedTitle} - ${lesson.title}`,
      masteryQuestions: JSON.stringify(masteryGoals),
      verifierLogs: JSON.stringify(verifierLogs),
      clarifications: clarificationPairs.length > 0
        ? JSON.stringify(clarificationPairs)
        : "None",
    });

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

    const rawSummary = response.text?.trim() ?? "";

    // Post-process: strip any strengths/weaknesses sections the AI may include despite prompt
    const summaryMarkdown = rawSummary
      .replace(
        /(?:^|\n)#+\s*(?:Strengths?|Weaknesses?|Areas?\s+(?:of\s+)?(?:Strength|Weakness|Improvement)|What\s+(?:Went\s+)?Well|(?:Areas?\s+)?(?:to\s+)?Improve).*?(?=\n#|\n\*\*[A-Z]|\n---|\Z)/gis,
        "",
      )
      .replace(/\n{3,}/g, "\n\n")
      .trim();

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
    await ctx.runMutation(internal.courseLessons.setKnowledgePieceIdInternal, {
      lessonId: args.lessonId,
      knowledgePieceId: pieceId,
    });

    // Flush any pending "feels hard" nodes queued before the piece existed
    const updatedLesson = await ctx.runQuery(
      internal.courseLessons.getInternal,
      { lessonId: args.lessonId },
    );
    if (
      updatedLesson?.pendingFeelsHardNodes &&
      updatedLesson.pendingFeelsHardNodes.length > 0
    ) {
      for (const content of updatedLesson.pendingFeelsHardNodes) {
        await ctx.runMutation(internal.knowledgeNodes.createInternal, {
          spaceId: course.spaceId,
          knowledgePieceId: pieceId,
          type: "feels_hard",
          content,
        });
      }
      await ctx.runMutation(
        internal.courseLessons.clearPendingFeelsHardInternal,
        { lessonId: args.lessonId },
      );
    }

    // 2. Generate knowledge nodes via AI
    const nodesPromptDoc = await ctx.runQuery(
      internal.coursePrompts.getPromptInternal,
      {
        name: "lesson_knowledge_nodes",
      },
    );
    const nodesPrompt = renderPrompt(nodesPromptDoc.content, {
      topicCovered: `${course.refinedTitle} - ${lesson.title}`,
      masteryQuestions: JSON.stringify(masteryGoals),
      verifierLogs: JSON.stringify(verifierLogs),
      clarifications: clarificationPairs.length > 0
        ? JSON.stringify(clarificationPairs)
        : "None",
    });

    const nodesStartedAt = Date.now();
    const nodesResponse = await ai.models.generateContent({
      model,
      contents: nodesPrompt,
    });
    captureAiGenerationEvent({
      distinctId: auth.userId,
      traceId: createAiTraceId(),
      provider: "google",
      model,
      input: [{ role: "user", content: nodesPrompt }],
      response: nodesResponse,
      latencySeconds: (Date.now() - nodesStartedAt) / 1000,
    });

    const nodesText = nodesResponse.text?.trim() ?? "[]";
    let knowledgeNodeEntries: Array<{
      type: "improvement" | "struggle";
      content: string;
    }> = [];
    try {
      knowledgeNodeEntries =
        safeParseJson<
          Array<{ type: "improvement" | "struggle"; content: string }>
        >(nodesText);
    } catch {
      console.error(
        "Failed to parse knowledge nodes from AI response, falling back to empty nodes.",
      );
    }

    for (const entry of knowledgeNodeEntries) {
      const nodeType =
        entry.type === "improvement" ? "improvement" : "struggle";
      await ctx.runMutation(internal.knowledgeNodes.createInternal, {
        spaceId: course.spaceId,
        knowledgePieceId: pieceId,
        type: nodeType,
        content: entry.content,
      });
    }

    // 4. Update lesson status
    await ctx.runMutation(internal.courseLessons.updateStatusInternal, {
      lessonId: args.lessonId,
      status: "integrated",
    });

    return { summaryMarkdown, knowledgePieceId: pieceId };
  },
});
