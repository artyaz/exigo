import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getServerPlanLimitsForUser } from "./planLimits";

function getStartOfMonthMs() {
    const now = new Date();
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0);
}

async function getOwnedSpaceIds(ctx: QueryCtx | MutationCtx, userId: string): Promise<Id<"spaces">[]> {
    const [userSpaces, defaultSpaces] = await Promise.all([
        ctx.db
            .query("spaces")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .collect(),
        ctx.db
            .query("spaces")
            .withIndex("by_user", (q) => q.eq("userId", "default_user"))
            .collect(),
    ]);

    return [...new Set([...userSpaces, ...defaultSpaces].map((space) => space._id))];
}

async function countTestsForSpacesSince(
    ctx: QueryCtx | MutationCtx,
    spaceIds: Id<"spaces">[],
    createdAfterMs: number
) {
    if (spaceIds.length === 0) {
        return 0;
    }

    const testsBySpace = await Promise.all(
        spaceIds.map((spaceId) =>
            ctx.db
                .query("tests")
                .withIndex("by_space", (q) => q.eq("spaceId", spaceId))
                .filter((q) => q.gte(q.field("_creationTime"), createdAfterMs))
                .collect()
        )
    );

    return testsBySpace.reduce((sum, tests) => sum + tests.length, 0);
}

async function countForUserThisMonthInternal(ctx: QueryCtx | MutationCtx, userId: string) {
    const spaceIds = await getOwnedSpaceIds(ctx, userId);
    return await countTestsForSpacesSince(ctx, spaceIds, getStartOfMonthMs());
}

async function getAuthenticatedUser(ctx: QueryCtx | MutationCtx) {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject;
    if (!userId) {
        throw new Error("Unauthorized");
    }
    return { userId, identity };
}

/**
 * Initializes a new test generation request for a given space.
 * The test is linked to the space and marks itself as generating status.
 *
 * @returns ID reference of the newly provisioned test
 */
// Status "active": the test is immediately usable — questions are generated
// asynchronously one-by-one via the /api/tests/generate streaming endpoint.
export const createEmptyTest = mutation({
    args: { spaceId: v.id("spaces"), type: v.string(), questionCount: v.number(), topicTitle: v.optional(v.string()), userId: v.string() },
    handler: async (ctx, args) => {
        const { userId, identity } = await getAuthenticatedUser(ctx);
        if (args.userId !== userId) {
            throw new Error("Unauthorized");
        }

        const maxAllowed = getServerPlanLimitsForUser(userId, identity).maxTestsPerMonth;
        if (maxAllowed === 0) {
            throw new Error("You don't have access to test generation on your current plan. Please upgrade to continue.");
        }

        const space = await ctx.db.get(args.spaceId);
        if (!space) {
            throw new Error("Space not found");
        }

        if (space.userId !== userId && space.userId !== "default_user") {
            throw new Error("Unauthorized access to this space");
        }

        const count = await countForUserThisMonthInternal(ctx, userId);

        if (count >= maxAllowed) {
            throw new Error(`Limit reached: You can only create ${maxAllowed} tests per month on your current plan.`);
        }

        return await ctx.db.insert("tests", {
            spaceId: args.spaceId,
            topicTitle: args.topicTitle,
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
    args: { spaceId: v.id("spaces"), type: v.string(), questionCount: v.optional(v.number()), userId: v.string() },
    handler: async (ctx, args) => {
        const { userId, identity } = await getAuthenticatedUser(ctx);
        if (args.userId !== userId) {
            throw new Error("Unauthorized");
        }

        const maxAllowed = getServerPlanLimitsForUser(userId, identity).maxTestsPerMonth;
        if (maxAllowed === 0) {
            throw new Error("You don't have access to test generation on your current plan. Please upgrade to continue.");
        }

        const space = await ctx.db.get(args.spaceId);
        if (!space) {
            throw new Error("Space not found");
        }

        if (space.userId !== userId && space.userId !== "default_user") {
            throw new Error("Unauthorized access to this space");
        }

        const count = await countForUserThisMonthInternal(ctx, userId);
        if (count >= maxAllowed) {
            throw new Error(`Limit reached: You can only create ${maxAllowed} tests per month on your current plan.`);
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
 * Counts the total number of tests an authenticated user has generated during the current month.
 */
export const countForUserThisMonth = query({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        return await countForUserThisMonthInternal(ctx, args.userId);
    },
});

/**
 * Performs a strict status override on the specified active test.
 * Allowed states: "draft", "generating", "active", or "completed".
 */
export const updateStatus = mutation({
    args: { testId: v.id("tests"), status: v.union(v.literal("draft"), v.literal("generating"), v.literal("active"), v.literal("completed")) },
    handler: async (ctx, args) => {
        const { userId } = await getAuthenticatedUser(ctx);

        const test = await ctx.db.get(args.testId);
        if (!test) throw new Error("Test not found");

        const space = await ctx.db.get(test.spaceId);
        if (!space || (space.userId !== userId && space.userId !== "default_user")) {
            throw new Error("Unauthorized access to this test");
        }

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
        const { userId } = await getAuthenticatedUser(ctx);
        const space = await ctx.db.get(args.spaceId);
        if (!space || (space.userId !== userId && space.userId !== "default_user")) {
            throw new Error("Unauthorized access to this space");
        }

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
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        const tests = await ctx.db.query("tests").order("desc").collect();
        const enriched = await Promise.all(
            tests.map(async (test) => {
                const space = await ctx.db.get(test.spaceId);
                if (!space || (space.userId !== args.userId && space.userId !== "default_user")) return null;
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
        return enriched.filter((t): t is NonNullable<typeof t> => t !== null);
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
        const { userId } = await getAuthenticatedUser(ctx);
        const test = await ctx.db.get(args.testId);
        if (!test) {
            return null;
        }

        const space = await ctx.db.get(test.spaceId);
        if (!space || (space.userId !== userId && space.userId !== "default_user")) {
            throw new Error("Unauthorized access to this test");
        }

        return test;
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
        userId: v.string(),
        questions: v.array(v.object({
            type: v.string(),
            question: v.string(),
            options: v.optional(v.array(v.string())),
            answer: v.optional(v.string()),
        })),
    },
    handler: async (ctx, args) => {
        const { userId, identity } = await getAuthenticatedUser(ctx);
        if (args.userId !== userId) {
            throw new Error("Unauthorized");
        }

        const maxAllowed = getServerPlanLimitsForUser(userId, identity).maxTestsPerMonth;
        if (maxAllowed === 0) {
            throw new Error("You don't have access to test generation on your current plan. Please upgrade to continue.");
        }

        const space = await ctx.db.get(args.spaceId);
        if (!space) {
            throw new Error("Space not found");
        }

        if (space.userId !== userId && space.userId !== "default_user") {
            throw new Error("Unauthorized access to this space");
        }

        const count = await countForUserThisMonthInternal(ctx, userId);
        if (count >= maxAllowed) {
            throw new Error(`Limit reached: You can only create ${maxAllowed} tests per month on your current plan.`);
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
