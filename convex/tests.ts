"use node";
import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY || "dummy" });

export const generate = action({
    args: { spaceId: v.id("spaces"), testType: v.string() },
    handler: async (ctx: any, args: any) => {
        // 1. Fetch knowledge pieces using a query
        const pieces = await ctx.runQuery("knowledgePieces:getForSpace", { spaceId: args.spaceId });
        if (!pieces || pieces.length === 0) throw new Error("No knowledge pieces found in space.");

        // 2. Create the test entry in draft/generating status
        const testId = await ctx.runMutation("tests:create", { spaceId: args.spaceId, type: args.testType });

        // 3. Prepare AI prompt
        const knowledgeText = pieces.map((p: any) => p.content).join("\n\n---\n\n");
        const prompt = `
      You are an expert educator. Create a knowledge test based ONLY on the following knowledge pieces.
      The test must have exactly 5 questions.
      The question type requested is: ${args.testType} ('select' means multiple choice, 'write' means open-ended).
      
      If 'select', provide exactly 4 options per question, and indicate the exactly complete answer string.
      If 'write', do not provide options, just provide a sample correct answer.
      
      Respond STRICTLY with a JSON array of objects, with no markdown formatting.
      Example 'select' format: [{"question":"...","options":["A","B","C","D"],"answer":"A"}]
      Example 'write' format: [{"question":"...","answer":"Correct open ended answer"}]
      
      Knowledge:
      ${knowledgeText}
    `;

        // 4. Call Google Gen AI
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });

        try {
            const resultText = response.text;
            if (!resultText) throw new Error("No response from AI");
            const questionsData = JSON.parse(resultText);

            // 5. Save generated questions
            for (const q of questionsData) {
                await ctx.runMutation("questions:create", {
                    testId,
                    type: args.testType as "select" | "write",
                    question: q.question,
                    options: q.options || undefined,
                    answer: q.answer || undefined,
                });
            }

            // 6. Mark test as active
            await ctx.runMutation("tests:updateStatus", { testId, status: "active" });

            return testId;
        } catch (e) {
            console.error("AI parse error", e);
            await ctx.runMutation("tests:updateStatus", { testId, status: "draft" }); // fallback
            throw new Error("Failed to generate test questions.");
        }
    },
});

export const create = mutation({
    args: { spaceId: v.id("spaces"), type: v.string() },
    handler: async (ctx: any, args: any) => {
        return await ctx.db.insert("tests", {
            spaceId: args.spaceId,
            status: "generating",
            config: { type: args.type },
        });
    },
});

export const updateStatus = mutation({
    args: { testId: v.id("tests"), status: v.union(v.literal("draft"), v.literal("generating"), v.literal("active"), v.literal("completed")) },
    handler: async (ctx: any, args: any) => {
        await ctx.db.patch(args.testId, { status: args.status });
    },
});

export const getForSpace = query({
    args: { spaceId: v.id("spaces") },
    handler: async (ctx: any, args: any) => {
        return await ctx.db
            .query("tests")
            .withIndex("by_space", (q: any) => q.eq("spaceId", args.spaceId))
            .collect();
    },
});

export const get = query({
    args: { testId: v.id("tests") },
    handler: async (ctx: any, args: any) => {
        return await ctx.db.get(args.testId);
    },
});
