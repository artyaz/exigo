"use node";
/* Node-runtime action for testMessages (the AI tutor chat). Depends on
   @google/genai + posthog-node, so it lives in a "use node" file with only
   actions — letting `convex codegen` bundle the deterministic functions in
   testMessages.ts. Queries/mutations stay there; this calls them via
   internal references. */
import { v } from "convex/values";
import { action } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { GoogleGenAI } from "@google/genai";
import { getAuthedContextForAction, requireEducatorAccess } from "./authDecorators";
import { internal } from "./_generated/api";
import { captureAiGenerationEvent, createAiTraceId } from "../shared/posthogAiObservability";

const MAX_CHAT_HISTORY = 20;

function buildHistoryPrompt(pastMessages: Doc<"testMessages">[], latestMessage: string): string {
  const recentMessages = pastMessages.slice(-MAX_CHAT_HISTORY);
  if (recentMessages.length === 0) {
    return `\nStudent: ${latestMessage}`;
  }
  const history = recentMessages
    .map((m) => `${m.role === "user" ? "Student" : "You"}: ${m.content}`)
    .join("\n");
  return `\nPrevious conversation about this question:\n${history}\nStudent: ${latestMessage}`;
}

function buildTutorPrompt(question: Doc<"questions">, historyPrompt: string): string {
  return `
        You are a helpful, brilliant, and patient AI tutor. A student is reviewing a test question and has a follow-up question for you.

        [Context Information]
        Question: ${question.question}
        Perfect Answer Outline: ${question.answer ?? "N/A"}
        Student's Given Answer: ${question.userAnswer ?? "N/A"}
        Correct?: ${question.isCorrect ? "Yes" : "No"}
        Your Initial Feedback: ${question.aiFeedback ?? "N/A"}

        [Conversation]${historyPrompt}

        Respond directly and concisely to the student's latest message. Be encouraging but highly accurate. Format your response in plain text.
        ### OUTPUT FORMAT REQUIREMENTS (STRICT)
1. Tone: Casual, slightly witty, professional. Use emojis 🧠.
2. Structure: NO WALLS OF TEXT. Bullet points & bold text.
3. Keep in mind that the chat window is horizontally small, so keep your responses not hard to read in this format.
        `;
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

    const data = await ctx.runQuery(internal.testMessages.getQuestionDataForChat, {
      questionId: args.questionId,
      userId: auth.userId,
    });

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
        const prompt = buildTutorPrompt(question, historyPrompt);
        const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
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
