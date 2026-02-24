import { describe, it, expect, vi } from 'vitest';
import { getServerPlanLimitsForUser } from './planLimits';
import { UNLIMITED_LIMIT } from '../shared/planConfig';

/**
 * Server-side limit enforcement and security tests for Convex mutations.
 */

// Mock context type
interface MockCtx {
  db: {
    insert: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
  };
  auth: {
    getUserIdentity: ReturnType<typeof vi.fn>;
  };
}

const createMockCtx = (userId: string, identityData: Record<string, any> = {}): MockCtx => {
  return {
    db: {
      insert: vi.fn(),
      patch: vi.fn(),
      get: vi.fn(),
      query: vi.fn(),
    },
    auth: {
      getUserIdentity: vi.fn(async () => ({ subject: userId, ...identityData })),
    },
  };
};

// --- HANDLER IMPLEMENTATIONS (Simulated from actual files) ---

async function createSpaceHandler(ctx: any, args: { name: string, userId: string }) {
    const identity = await ctx.auth.getUserIdentity();
    const authenticatedUserId = identity?.subject;
    if (!authenticatedUserId || authenticatedUserId !== args.userId) {
        throw new Error("Unauthorized");
    }

    const mockSpaces = await ctx.db.query("spaces")
        .withIndex("by_user", (q: any) => q.eq("userId", args.userId))
        .collect();
    const currentCount = mockSpaces.length;

    const serverLimit = getServerPlanLimitsForUser(args.userId, identity).maxSpaces;
    if (serverLimit !== Infinity && currentCount >= serverLimit) {
        throw new Error(`Limit reached: You can only have ${serverLimit} spaces on your current plan.`);
    }

    return await ctx.db.insert("spaces", { name: args.name, userId: args.userId });
}

async function addKnowledgePieceHandler(ctx: any, args: { spaceId: any, content: string }) {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject;
    if (!userId) {
        throw new Error("Unauthorized access to this space");
    }

    const space = await ctx.db.get(args.spaceId);
    if (!space || (space.userId !== userId && space.userId !== "default_user")) {
        throw new Error("Unauthorized access to this space");
    }

    const existingPieces = await ctx.db.query("knowledgePieces")
        .withIndex("by_space", (q: any) => q.eq("spaceId", args.spaceId))
        .collect();

    const serverLimit = getServerPlanLimitsForUser(userId, identity).maxKnowledgePiecesPerSpace;
    const projectedTotal = existingPieces.length + 1;
    if (serverLimit !== Infinity && projectedTotal > serverLimit) {
        throw new Error(`Limit reached: You can only have ${serverLimit} knowledge pieces per space on your current plan.`);
    }

    return await ctx.db.insert("knowledgePieces", {
        spaceId: args.spaceId,
        content: args.content,
    });
}

async function createEmptyTestHandler(ctx: any, args: { spaceId: any, userId: string, type: string, questionCount: number }) {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject;
    if (!userId || args.userId !== userId) {
        throw new Error("Unauthorized");
    }

    const limits = getServerPlanLimitsForUser(userId, identity);
    const maxAllowed = limits.maxTestsPerMonth;
    if (maxAllowed === 0) {
        throw new Error("You don't have access to test generation on your current plan.");
    }

    const space = await ctx.db.get(args.spaceId);
    if (!space || (space.userId !== userId && space.userId !== "default_user")) {
        throw new Error("Unauthorized access to this space");
    }

    const mockTests = await ctx.db.query("tests")
        .withIndex("by_space", (q: any) => q.eq("spaceId", args.spaceId))
        .collect();
    const count = mockTests.length;

    if (count >= maxAllowed) {
        throw new Error(`Limit reached: You have created ${count} tests this month.`);
    }

    return await ctx.db.insert("tests", {
        spaceId: args.spaceId,
        status: "active",
        config: { type: args.type, questionCount: args.questionCount },
    });
}

async function bulkImportHandler(ctx: any, args: { spaceId: any, pieces: any[] }) {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject;
    if (!userId) {
        throw new Error("Unauthorized access to this space");
    }

    const space = await ctx.db.get(args.spaceId);
    if (!space || (space.userId !== userId && space.userId !== "default_user")) {
        throw new Error("Unauthorized access to this space");
    }

    const existingPieces = await ctx.db.query("knowledgePieces")
        .withIndex("by_space", (q: any) => q.eq("spaceId", args.spaceId))
        .collect();

    const serverLimit = getServerPlanLimitsForUser(userId, identity).maxKnowledgePiecesPerSpace;
    const nonEmptyIncomingCount = args.pieces.filter((piece) => piece.content.trim() !== "").length;
    const projectedTotal = existingPieces.length + nonEmptyIncomingCount;
    
    if (serverLimit !== Infinity && projectedTotal > serverLimit) {
        throw new Error(`Limit reached: Bulk import would exceed the limit of ${serverLimit} knowledge pieces per space.`);
    }

    for (const piece of args.pieces) {
        if (piece.content.trim() === "") continue;
        await ctx.db.insert("knowledgePieces", {
            spaceId: args.spaceId,
            content: piece.content,
        });
    }
}

// --- TESTS ---

describe('Convex Limit Enforcement & Security', () => {
    describe('Exploit Prevention', () => {
        it('prevents spoofing userId in createSpace', async () => {
            const ctx = createMockCtx('attacker_id');
            await expect(
                createSpaceHandler(ctx, { name: 'Evil Space', userId: 'victim_id' })
            ).rejects.toThrow("Unauthorized");
        });

        it('prevents adding knowledge piece to someone else\'s space', async () => {
            const ctx = createMockCtx('attacker_id');
            ctx.db.get.mockResolvedValue({ userId: 'victim_id' });
            await expect(
                addKnowledgePieceHandler(ctx, { spaceId: 'victim_space' as any, content: 'Spam' })
            ).rejects.toThrow("Unauthorized access to this space");
        });
    });

    describe('Space Limits', () => {
        it('verifies the full createSpace mutation flow with auth', async () => {
            const userId = 'user_test_123';
            // Simulate a user with Free plan (no special metadata)
            const ctx = createMockCtx(userId);
            
            // Mock empty spaces for this user
            const mockCollect = vi.fn().mockResolvedValue([]);
            (ctx.db.query as any).mockReturnValue({ withIndex: () => ({ collect: mockCollect }) });
            
            // Execute handler
            await createSpaceHandler(ctx, { name: 'Test Flow', userId });
            
            // Verify execution path
            expect(ctx.auth.getUserIdentity).toHaveBeenCalled();
            expect(ctx.db.insert).toHaveBeenCalledWith('spaces', { name: 'Test Flow', userId });
        });

        it('blocks creating a space when at the limit (free plan)', async () => {
            const ctx = createMockCtx('user_free');
            const mockCollect = vi.fn().mockResolvedValue([{}, {}, {}]); // 3 existing spaces
            (ctx.db.query as any).mockReturnValue({ withIndex: () => ({ collect: mockCollect }) });
            
            await expect(
                createSpaceHandler(ctx, { name: 'Too Many', userId: 'user_free' })
            ).rejects.toThrow(/Limit reached: You can only have 3 spaces/);
        });

        it('allows unlimited spaces on Pro plan', async () => {
            const ctx = createMockCtx('user_pro', { publicMetadata: { plan: 'pro' } });
            const mockCollect = vi.fn().mockResolvedValue(new Array(10).fill({})); 
            (ctx.db.query as any).mockReturnValue({ withIndex: () => ({ collect: mockCollect }) });
            
            await createSpaceHandler(ctx, { name: 'Pro Space', userId: 'user_pro' });
            expect(ctx.db.insert).toHaveBeenCalled();
        });
    });

    describe('Knowledge Piece Limits', () => {
        it('blocks adding a knowledge piece when at the limit (free plan)', async () => {
            const ctx = createMockCtx('user_free');
            ctx.db.get.mockResolvedValue({ userId: 'user_free' });
            const mockCollect = vi.fn().mockResolvedValue(new Array(20).fill({})); 
            (ctx.db.query as any).mockReturnValue({ withIndex: () => ({ collect: mockCollect }) });
            
            await expect(
                addKnowledgePieceHandler(ctx, { spaceId: 'space_123' as any, content: 'Too much' })
            ).rejects.toThrow(/Limit reached: You can only have 20 knowledge pieces/);
        });

        it('blocks bulk import that would exceed limit', async () => {
            const ctx = createMockCtx('user_free');
            ctx.db.get.mockResolvedValue({ userId: 'user_free' });
            const mockCollect = vi.fn().mockResolvedValue(new Array(15).fill({})); // 15 existing
            (ctx.db.query as any).mockReturnValue({ withIndex: () => ({ collect: mockCollect }) });
            
            // Try to import 6 pieces (total 21, exceeds 20)
            const pieces = new Array(6).fill({ content: 'content' });
            
            await expect(
                bulkImportHandler(ctx, { spaceId: 'space_123' as any, pieces })
            ).rejects.toThrow(/Bulk import would exceed the limit of 20/);
        });
    });

    describe('Test Generation Limits', () => {
        it('blocks creating a test when at the limit (free plan)', async () => {
            const ctx = createMockCtx('user_free');
            ctx.db.get.mockResolvedValue({ userId: 'user_free' });
            const mockCollect = vi.fn().mockResolvedValue(new Array(10).fill({})); 
            (ctx.db.query as any).mockReturnValue({ withIndex: () => ({ collect: mockCollect }) });
            
            await expect(
                createEmptyTestHandler(ctx, { spaceId: 'space_123' as any, userId: 'user_free', type: 'select', questionCount: 5 })
            ).rejects.toThrow(/Limit reached: You have created 10 tests/);
        });
    });
});
