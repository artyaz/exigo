import { describe, it, expect, vi } from 'vitest';
import { getServerPlanLimitsForUser } from './planLimits';
import { UNLIMITED_LIMIT } from '../shared/planConfig';

/**
 * Server-side limit enforcement tests for Convex mutations.
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
  const mockCollect = vi.fn();
  const mockEq = vi.fn(() => ({ collect: mockCollect }));
  const mockWithIndex = vi.fn(() => ({ eq: mockEq }));
  const mockQuery = vi.fn(() => ({ withIndex: mockWithIndex }));

  return {
    db: {
      insert: vi.fn(),
      patch: vi.fn(),
      get: vi.fn(),
      query: mockQuery,
    },
    auth: {
      getUserIdentity: vi.fn(async () => ({ subject: userId, ...identityData })),
    },
  };
};

// Implementation of space creation logic from convex/spaces.ts
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

// Implementation of knowledge piece add logic from convex/knowledgePieces.ts
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

describe('Convex Limit Enforcement', () => {
    describe('Space Limits', () => {
        it('allows creating a space when under the limit (free plan)', async () => {
            const ctx = createMockCtx('user_free');
            // Mock query().withIndex().collect()
            const mockCollect = vi.fn().mockResolvedValue([{}, {}]); // 2 existing spaces
            (ctx.db.query as any).mockReturnValue({
                withIndex: vi.fn().mockReturnValue({
                    collect: mockCollect
                })
            });
            
            await createSpaceHandler(ctx, { name: 'New Space', userId: 'user_free' });
            
            expect(ctx.db.insert).toHaveBeenCalledWith('spaces', expect.objectContaining({ name: 'New Space' }));
        });

        it('blocks creating a space when at the limit (free plan)', async () => {
            const ctx = createMockCtx('user_free');
            const mockCollect = vi.fn().mockResolvedValue([{}, {}, {}]); // 3 existing spaces
            (ctx.db.query as any).mockReturnValue({
                withIndex: vi.fn().mockReturnValue({
                    collect: mockCollect
                })
            });
            
            await expect(
                createSpaceHandler(ctx, { name: 'Too Many', userId: 'user_free' })
            ).rejects.toThrow(/Limit reached: You can only have 3 spaces/);
            
            expect(ctx.db.insert).not.toHaveBeenCalled();
        });

        it('allows more spaces on Pro plan', async () => {
            const ctx = createMockCtx('user_pro', { pro_tests: true });
            const mockCollect = vi.fn().mockResolvedValue(new Array(10).fill({})); 
            (ctx.db.query as any).mockReturnValue({
                withIndex: vi.fn().mockReturnValue({
                    collect: mockCollect
                })
            });
            
            await createSpaceHandler(ctx, { name: 'Pro Space', userId: 'user_pro' });
            
            expect(ctx.db.insert).toHaveBeenCalled();
        });
    });

    describe('Knowledge Piece Limits', () => {
        it('allows adding a knowledge piece when under the limit (free plan)', async () => {
            const ctx = createMockCtx('user_free');
            ctx.db.get.mockResolvedValue({ userId: 'user_free' });
            const mockCollect = vi.fn().mockResolvedValue(new Array(19).fill({})); 
            (ctx.db.query as any).mockReturnValue({
                withIndex: vi.fn().mockReturnValue({
                    collect: mockCollect
                })
            });
            
            await addKnowledgePieceHandler(ctx, { spaceId: 'space_123' as any, content: 'Some content' });
            
            expect(ctx.db.insert).toHaveBeenCalled();
        });

        it('blocks adding a knowledge piece when at the limit (free plan)', async () => {
            const ctx = createMockCtx('user_free');
            ctx.db.get.mockResolvedValue({ userId: 'user_free' });
            const mockCollect = vi.fn().mockResolvedValue(new Array(20).fill({})); 
            (ctx.db.query as any).mockReturnValue({
                withIndex: vi.fn().mockReturnValue({
                    collect: mockCollect
                })
            });
            
            await expect(
                addKnowledgePieceHandler(ctx, { spaceId: 'space_123' as any, content: 'Too much' })
            ).rejects.toThrow(/Limit reached: You can only have 20 knowledge pieces/);
            
            expect(ctx.db.insert).not.toHaveBeenCalled();
        });

        it('allows more knowledge pieces on Basic plan', async () => {
            const ctx = createMockCtx('user_basic', { basic_tests: true });
            ctx.db.get.mockResolvedValue({ userId: 'user_basic' });
            const mockCollect = vi.fn().mockResolvedValue(new Array(49).fill({})); 
            (ctx.db.query as any).mockReturnValue({
                withIndex: vi.fn().mockReturnValue({
                    collect: mockCollect
                })
            });
            
            await addKnowledgePieceHandler(ctx, { spaceId: 'space_123' as any, content: 'Basic content' });
            
            expect(ctx.db.insert).toHaveBeenCalled();
        });
    });
});
