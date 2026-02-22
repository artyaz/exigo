import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Initializes a new test generation request for a given space.
 * The test is linked to the space and marks itself as generating status.
 *
 * @returns ID reference of the newly provisioned test
 */
// Status "active": the test is immediately usable — questions are generated
// asynchronously one-by-one via the /api/tests/generate streaming endpoint.
export const createEmptyTest = mutation({
    args: { spaceId: v.id("spaces"), type: v.string(), questionCount: v.number() },
    handler: async (ctx, args) => {
        const space = await ctx.db.get(args.spaceId);
        if (!space) {
            throw new Error("Space not found");
        }

        const userId = "default_user"; // MVP mock
        if (space.userId !== userId) {
            throw new Error("Unauthorized access to this space");
        }

        return await ctx.db.insert("tests", {
            spaceId: args.spaceId,
            status: "active",
            config: {
                type: args.type,
                questionCount: args.questionCount,
            },
        });
    },
});

// Status "generating": used when the server batch-generates all questions before
// the test becomes usable. The caller is expected to flip status to "active" once done.
export const create = mutation({
    args: { spaceId: v.id("spaces"), type: v.string(), questionCount: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const space = await ctx.db.get(args.spaceId);
        if (!space) {
            throw new Error("Space not found");
        }

        const userId = "default_user"; // MVP mock
        if (space.userId !== userId) {
            throw new Error("Unauthorized access to this space");
        }

        return await ctx.db.insert("tests", {
            spaceId: args.spaceId,
            status: "generating",
            config: {
                type: args.type,
                questionCount: args.questionCount ?? 5,
            },
        });
    },
});

/**
 * Performs a strict status override on the specified active test.
 * Allowed states: "draft", "generating", "active", or "completed".
 */
export const updateStatus = mutation({
    args: { testId: v.id("tests"), status: v.union(v.literal("draft"), v.literal("generating"), v.literal("active"), v.literal("completed")) },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.testId, { status: args.status });
    },
});

/**
 * Retrieves all tests mapped to a unique space context.
 * Utilizes the internal by_space DB index for performance.
 *
 * @returns Array collection of available tests
 */
export const getForSpace = query({
    args: { spaceId: v.id("spaces") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("tests")
            .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
            .collect();
    },
});

/**
 * Lists all tests across all spaces, enriched with the parent space name.
 */
export const listAll = query({
    args: {},
    handler: async (ctx) => {
        const tests = await ctx.db.query("tests").order("desc").collect();
        const enriched = await Promise.all(
            tests.map(async (test) => {
                const space = await ctx.db.get(test.spaceId);
                const questions = await ctx.db
                    .query("questions")
                    .withIndex("by_test", (q) => q.eq("testId", test._id))
                    .collect();
                const answeredCount = questions.filter(q => q.userAnswer).length;
                return {
                    ...test,
                    spaceName: space?.name ?? "Unknown",
                    questionCount: questions.length,
                    answeredCount,
                };
            })
        );
        return enriched;
    },
});

/**
 * Fetches the document entry of an individual granular test directly by its ID.
 *
 * @returns Serialized test data or null
 */
export const get = query({
    args: { testId: v.id("tests") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.testId);
    },
});

/**
 * Transactionally provisions a new test along with its complete set of verified questions.
 * Ensures tests are never left in a partially created state if inserting a question errors.
 *
 * @returns ID reference of the newly committed active test
 */
// Status "active": the full set of questions is provided up-front so the test
// is immediately ready to take — no async generation step required.
export const createWithQuestions = mutation({
    args: {
        spaceId: v.id("spaces"),
        type: v.string(),
        questions: v.array(v.object({
            type: v.string(),
            question: v.string(),
            options: v.optional(v.array(v.string())),
            answer: v.optional(v.string()),
        })),
    },
    handler: async (ctx, args) => {
        const space = await ctx.db.get(args.spaceId);
        if (!space) {
            throw new Error("Space not found");
        }

        const userId = "default_user"; // MVP mock
        if (space.userId !== userId) {
            throw new Error("Unauthorized access to this space");
        }

        const testId = await ctx.db.insert("tests", {
            spaceId: args.spaceId,
            status: "active",
            config: {
                type: args.type,
                questionCount: args.questions.length,
            },
        });

        for (const q of args.questions) {
            await ctx.db.insert("questions", {
                testId: testId,
                type: q.type as "select" | "write",
                question: q.question,
                options: q.options,
                answer: q.answer,
            });
        }

        return testId;
    },
});
