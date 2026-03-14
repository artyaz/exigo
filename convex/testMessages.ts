import { v } from "convex/values";
import {
  mutation,
  query,
  internalQuery,
  internalMutation,
  action,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
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
import { getPromptInternal, renderPrompt } from "./coursePrompts";
import { internal } from "./_generated/api";

async function getAuthenticatedUserId(
  ctx: QueryCtx | MutationCtx,
): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) {
    throw new Error("Not authenticated");
  }
  return identity.subject;
}

async function authorizeQuestionAccess(
  ctx: QueryCtx | MutationCtx,
  questionId: Id<"questions">,
  userId: string,
) {
  const question = await ctx.db.get(questionId);
  if (!question) {
    throw new Error("Question not found");
  }

  const test = await ctx.db.get(question.testId);
  if (!test) {
    throw new Error("Test not found");
  }

  const space = await ctx.db.get(test.spaceId);
  if (!space || (space.userId !== userId && space.userId !== "default_user")) {
    throw new Error("Unauthorized access to this question");
  }

  return { question, test };
}

export const getForQuestion = query({
  args: { questionId: v.id("questions"), userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const authenticatedUserId = await getAuthenticatedUserId(ctx);
    await authorizeQuestionAccess(ctx, args.questionId, authenticatedUserId);

    return await ctx.db
      .query("testMessages")
      .withIndex("by_question", (q) => q.eq("questionId", args.questionId))
      .collect();
  },
});

export const send = mutation({
  args: {
    testId: v.id("tests"),
    questionId: v.id("questions"),
    role: v.union(v.literal("user"), v.literal("ai")),
    content: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authenticatedUserId = await getAuthenticatedUserId(ctx);
    const { question } = await authorizeQuestionAccess(
      ctx,
      args.questionId,
      authenticatedUserId,
    );

    if (question.testId !== args.testId) {
      throw new Error("Question does not belong to this test");
    }

    return await ctx.db.insert("testMessages", {
      testId: args.testId,
      questionId: args.questionId,
      role: args.role as "user" | "ai",
      content: args.content,
    });
  },
});

export const getQuestionDataForChat = internalQuery({
  args: { questionId: v.id("questions"), userId: v.string() },
  handler: async (ctx, args) => {
    const question = await ctx.db.get(args.questionId);
    if (!question) return null;

    const test = await ctx.db.get(question.testId);
    if (!test) return null;

    const space = await ctx.db.get(test.spaceId);
    if (
      !space ||
      (space.userId !== args.userId && space.userId !== "default_user")
    ) {
      return null;
    }

    const pastMessages = await ctx.db
      .query("testMessages")
      .withIndex("by_question", (q) => q.eq("questionId", args.questionId))
      .collect();

    return { question, test, pastMessages };
  },
});

export const saveMessageInternal = internalMutation({
  args: {
    testId: v.id("tests"),
    questionId: v.id("questions"),
    role: v.union(v.literal("user"), v.literal("ai")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("testMessages", {
      testId: args.testId,
      questionId: args.questionId,
      role: args.role,
      content: args.content,
    });
  },
});

const MAX_CHAT_HISTORY = 20;

function buildHistoryPrompt(
  pastMessages: Doc<"testMessages">[],
  latestMessage: string,
): string {
  const recentMessages = pastMessages.slice(-MAX_CHAT_HISTORY);
  if (recentMessages.length === 0) {
    return `\nStudent: ${latestMessage}`;
  }
  const history = recentMessages
    .map((m) => `${m.role === "user" ? "Student" : "You"}: ${m.content}`)
    .join("\n");
  return `\nPrevious conversation about this question:\n${history}\nStudent: ${latestMessage}`;
}

export const chat = action({
  args: {
    testId: v.id("tests"),
    questionId: v.id("questions"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthedContextForAction(ctx);
    requireEducatorAccess(auth);

    const data = await ctx.runQuery(
      internal.testMessages.getQuestionDataForChat,
      {
        questionId: args.questionId,
        userId: auth.userId,
      },
    );

    if (!data) {
      throw new Error("Question not found or unauthorized");
    }

    const { question, pastMessages } = data;

    if (String(question.testId) !== String(args.testId)) {
      throw new Error("Question does not belong to this test");
    }

    await ctx.runMutation(internal.testMessages.saveMessageInternal, {
      testId: args.testId,
      questionId: args.questionId,
      role: "user",
      content: args.message,
    });

    let aiResponseText = "I'm sorry, I couldn't formulate a response.";

    if (process.env.GOOGLE_GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({
          apiKey: process.env.GOOGLE_GEMINI_API_KEY,
        });
        const historyPrompt = buildHistoryPrompt(pastMessages, args.message);

        const promptDoc = await ctx.runQuery(
          internal.coursePrompts.getPromptInternal,
          {
            name: "tutor",
          },
        );
        const prompt = renderPrompt(promptDoc.content, {
          question_text: question.question,
          question_answer: question.answer ?? "N/A",
          question_userAnswer: question.userAnswer ?? "N/A",
          question_isCorrect: question.isCorrect ? "Yes" : "No",
          question_aiFeedback: question.aiFeedback ?? "N/A",
          historyPrompt,
        });

        const model = process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";
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
        aiResponseText = response.text ?? aiResponseText;
      } catch (error) {
        console.error("Gemini request failed:", error);
      }
    }

    await ctx.runMutation(internal.testMessages.saveMessageInternal, {
      testId: args.testId,
      questionId: args.questionId,
      role: "ai",
      content: aiResponseText,
    });

    return { success: true, aiResponseText };
  },
});
