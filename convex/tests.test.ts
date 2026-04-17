import { describe, it, expect, vi } from 'vitest';

/**
 * Unit tests for convex/tests.ts
 *
 * These tests verify the business logic of the test management functions.
 * Since Convex functions are wrapped by mutation() and query(), we test
 * the handler logic directly by recreating it.
 */

// Type definitions matching our Convex schema
type TestStatus = 'draft' | 'generating' | 'active' | 'completed';

interface TestRecord {
  _id?: string;
  spaceId: string;
  userId?: string;
  status: TestStatus;
  config?: {
    type: string;
    [key: string]: any;
  };
}

// Mock context type
interface MockDbContext {
  insert: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  query: ReturnType<typeof vi.fn>;
}

// Helper to create mock database context
const createMockDb = (): MockDbContext => ({
  insert: vi.fn(),
  patch: vi.fn(),
  get: vi.fn(async () => ({ _id: 'test_default', userId: 'user_id' })),
  query: vi.fn(() => ({
    withIndex: vi.fn(() => ({
      collect: vi.fn(),
    })),
  })),
});

// Handler functions that mirror the actual implementation in convex/tests.ts
const createHandler = async (db: MockDbContext, args: { spaceId: string; type: string; topicTitle?: string }) => {
  const insertData: any = {
    spaceId: args.spaceId,
    status: 'generating',
    config: { type: args.type },
  };
  if (args.topicTitle !== undefined) {
    insertData.topicTitle = args.topicTitle;
  }
  return await (db.insert as any)('tests', insertData);
};

const updateStatusHandler = async (
  db: MockDbContext,
  args: { testId: string; status: TestStatus }
) => {
  const authenticatedUserId = 'user_id';
  const test = await (db.get as any)(args.testId) as { userId?: string } | null;
  if (!test) throw new Error('Test not found');
  if (test.userId === undefined || test.userId !== authenticatedUserId) {
    throw new Error('Unauthorized access to this test');
  }
  await (db.patch as any)(args.testId, { status: args.status });
};

const getForSpaceHandler = async (db: MockDbContext, args: { spaceId: string }) => {
  return await (db.query as any)('tests')
    .withIndex('by_space', (q: any) => q.eq('spaceId', args.spaceId))
    .collect();
};

const getHandler = async (db: MockDbContext, args: { testId: string }) => {
  return await (db.get as any)(args.testId);
};

describe('convex/tests - create mutation logic', () => {
  it('should create a new test with generating status', async () => {
    const db = createMockDb();
    const testId = 'test_123';
    (db.insert as any).mockResolvedValue(testId);

    const result = await createHandler(db, {
      spaceId: 'space_456',
      type: 'multiple-choice',
    });

    expect(db.insert).toHaveBeenCalledWith('tests', {
      spaceId: 'space_456',
      status: 'generating',
      config: { type: 'multiple-choice' },
    });
    expect(result).toBe(testId);
  });

  it('should create test with different test types', async () => {
    const db = createMockDb();
    (db.insert as any).mockResolvedValue('test_789');

    const testTypes = ['true-false', 'short-answer', 'essay', 'fill-in-blank'];

    for (const type of testTypes) {
      (db.insert as any).mockClear();
      await createHandler(db, { spaceId: 'space_1', type });

      expect(db.insert).toHaveBeenCalledWith('tests', {
        spaceId: 'space_1',
        status: 'generating',
        config: { type },
      });
    }
  });

  it('should handle empty string type', async () => {
    const db = createMockDb();
    (db.insert as any).mockResolvedValue('test_empty');

    const result = await createHandler(db, {
      spaceId: 'space_1',
      type: '',
    });

    expect(db.insert).toHaveBeenCalledWith('tests', {
      spaceId: 'space_1',
      status: 'generating',
      config: { type: '' },
    });
    expect(result).toBe('test_empty');
  });

  it('should handle special characters in type', async () => {
    const db = createMockDb();
    (db.insert as any).mockResolvedValue('test_special');

    const result = await createHandler(db, {
      spaceId: 'space_1',
      type: 'test@type#with$special%chars',
    });

    expect(db.insert).toHaveBeenCalledWith('tests', {
      spaceId: 'space_1',
      status: 'generating',
      config: { type: 'test@type#with$special%chars' },
    });
    expect(result).toBe('test_special');
  });

  it('should handle database insertion errors', async () => {
    const db = createMockDb();
    const dbError = new Error('Database insertion failed');
    (db.insert as any).mockRejectedValue(dbError);

    await expect(
      createHandler(db, { spaceId: 'space_1', type: 'quiz' })
    ).rejects.toThrow('Database insertion failed');
  });

  it('should handle very long type strings', async () => {
    const db = createMockDb();
    (db.insert as any).mockResolvedValue('test_long');

    const longType = 'a'.repeat(1000);
    const result = await createHandler(db, {
      spaceId: 'space_1',
      type: longType,
    });

    expect(db.insert).toHaveBeenCalledWith('tests', {
      spaceId: 'space_1',
      status: 'generating',
      config: { type: longType },
    });
    expect(result).toBe('test_long');
  });

  it('should always set status to generating on creation', async () => {
    const db = createMockDb();
    (db.insert as any).mockResolvedValue('test_status');

    await createHandler(db, { spaceId: 'space_1', type: 'quiz' });

    const callArgs = (db.insert as any).mock.calls[0];
    expect(callArgs[1]).toHaveProperty('status', 'generating');
  });

  it('should create test with topicTitle when provided', async () => {
    const db = createMockDb();
    (db.insert as any).mockResolvedValue('test_topic');

    await createHandler(db, { spaceId: 'space_1', type: 'quiz', topicTitle: 'My Custom Topic' });

    expect(db.insert).toHaveBeenCalledWith('tests', expect.objectContaining({
      spaceId: 'space_1',
      topicTitle: 'My Custom Topic',
      status: 'generating'
    }));
  });

  it('should create test with undefined topicTitle when omitted', async () => {
    const db = createMockDb();
    (db.insert as any).mockResolvedValue('test_notopic');

    await createHandler(db, { spaceId: 'space_1', type: 'quiz' });

    const callArgs = (db.insert as any).mock.calls[0];
    expect(callArgs[1].topicTitle).toBeUndefined();
  });
});

describe('convex/tests - updateStatus mutation logic', () => {
  it('should update test status to draft', async () => {
    const db = createMockDb();
    (db.patch as any).mockResolvedValue(undefined);

    await updateStatusHandler(db, {
      testId: 'test_123',
      status: 'draft',
    });

    expect(db.patch).toHaveBeenCalledWith('test_123', { status: 'draft' });
  });

  it('should update test status to generating', async () => {
    const db = createMockDb();
    (db.patch as any).mockResolvedValue(undefined);

    await updateStatusHandler(db, {
      testId: 'test_456',
      status: 'generating',
    });

    expect(db.patch).toHaveBeenCalledWith('test_456', { status: 'generating' });
  });

  it('should update test status to active', async () => {
    const db = createMockDb();
    (db.patch as any).mockResolvedValue(undefined);

    await updateStatusHandler(db, {
      testId: 'test_789',
      status: 'active',
    });

    expect(db.patch).toHaveBeenCalledWith('test_789', { status: 'active' });
  });

  it('should update test status to completed', async () => {
    const db = createMockDb();
    (db.patch as any).mockResolvedValue(undefined);

    await updateStatusHandler(db, {
      testId: 'test_999',
      status: 'completed',
    });

    expect(db.patch).toHaveBeenCalledWith('test_999', { status: 'completed' });
  });

  it('should handle all valid status transitions', async () => {
    const db = createMockDb();
    (db.patch as any).mockResolvedValue(undefined);

    const testId = 'test_lifecycle';
    const statuses: TestStatus[] = ['draft', 'generating', 'active', 'completed'];

    for (const status of statuses) {
      (db.patch as any).mockClear();
      await updateStatusHandler(db, { testId, status });
      expect(db.patch).toHaveBeenCalledWith(testId, { status });
    }
  });

  it('should handle database patch errors', async () => {
    const db = createMockDb();
    const dbError = new Error('Database patch failed');
    (db.patch as any).mockRejectedValue(dbError);

    await expect(
      updateStatusHandler(db, { testId: 'test_1', status: 'active' })
    ).rejects.toThrow('Database patch failed');
  });

  it('should reject status updates for unauthorized user', async () => {
    const db = createMockDb();
    (db.get as any).mockResolvedValue({ _id: 'test_1', userId: 'other_user' });

    await expect(
      updateStatusHandler(db, { testId: 'test_1', status: 'active' })
    ).rejects.toThrow('Unauthorized access to this test');
    expect(db.patch).not.toHaveBeenCalled();
  });

  it('should throw when test record is missing', async () => {
    const db = createMockDb();
    (db.get as any).mockResolvedValue(null);

    await expect(
      updateStatusHandler(db, { testId: 'non_existent_test', status: 'active' })
    ).rejects.toThrow('Test not found');
    expect(db.patch).not.toHaveBeenCalled();
  });

  it('should handle rapid concurrent status updates', async () => {
    const db = createMockDb();
    (db.patch as any).mockResolvedValue(undefined);

    const testId = 'test_rapid';

    await Promise.all([
      updateStatusHandler(db, { testId, status: 'draft' }),
      updateStatusHandler(db, { testId, status: 'generating' }),
      updateStatusHandler(db, { testId, status: 'active' }),
    ]);

    expect(db.patch).toHaveBeenCalledTimes(3);
  });

  it('should only update the status field', async () => {
    const db = createMockDb();
    (db.patch as any).mockResolvedValue(undefined);

    await updateStatusHandler(db, { testId: 'test_123', status: 'completed' });

    const callArgs = (db.patch as any).mock.calls[0];
    expect(Object.keys(callArgs[1])).toEqual(['status']);
  });
});

describe('convex/tests - getForSpace query logic', () => {
  it('should retrieve all tests for a space', async () => {
    const db = createMockDb();
    const mockTests = [
      { _id: 'test_1', spaceId: 'space_1', status: 'active', config: { type: 'quiz' } },
      { _id: 'test_2', spaceId: 'space_1', status: 'draft', config: { type: 'exam' } },
    ];

    const mockCollect = vi.fn().mockResolvedValue(mockTests);
    const mockWithIndex = vi.fn().mockReturnValue({ collect: mockCollect });
    (db.query as any).mockReturnValue({ withIndex: mockWithIndex });

    const result = await getForSpaceHandler(db, { spaceId: 'space_1' });

    expect(db.query).toHaveBeenCalledWith('tests');
    expect(mockWithIndex).toHaveBeenCalled();
    expect(result).toEqual(mockTests);
  });

  it('should return empty array when no tests exist for space', async () => {
    const db = createMockDb();
    const mockCollect = vi.fn().mockResolvedValue([]);
    const mockWithIndex = vi.fn().mockReturnValue({ collect: mockCollect });
    (db.query as any).mockReturnValue({ withIndex: mockWithIndex });

    const result = await getForSpaceHandler(db, { spaceId: 'empty_space' });

    expect(result).toEqual([]);
    expect(mockCollect).toHaveBeenCalled();
  });

  it('should handle large number of tests', async () => {
    const db = createMockDb();
    const mockTests = Array.from({ length: 100 }, (_, i) => ({
      _id: `test_${i}`,
      spaceId: 'space_many',
      status: 'active' as TestStatus,
      config: { type: 'quiz' },
    }));

    const mockCollect = vi.fn().mockResolvedValue(mockTests);
    const mockWithIndex = vi.fn().mockReturnValue({ collect: mockCollect });
    (db.query as any).mockReturnValue({ withIndex: mockWithIndex });

    const result = await getForSpaceHandler(db, { spaceId: 'space_many' });

    expect(result).toHaveLength(100);
    expect(result).toEqual(mockTests);
  });

  it('should query using by_space index', async () => {
    const db = createMockDb();
    const mockCollect = vi.fn().mockResolvedValue([]);
    const mockEq = vi.fn();
    const mockWithIndex = vi.fn().mockImplementation((indexName, callback) => {
      const q = { eq: mockEq };
      callback(q);
      return { collect: mockCollect };
    });
    (db.query as any).mockReturnValue({ withIndex: mockWithIndex });

    await getForSpaceHandler(db, { spaceId: 'space_1' });

    expect(mockWithIndex).toHaveBeenCalledWith('by_space', expect.any(Function));
    expect(mockEq).toHaveBeenCalledWith('spaceId', 'space_1');
  });

  it('should handle database query errors', async () => {
    const db = createMockDb();
    const dbError = new Error('Database query failed');
    const mockCollect = vi.fn().mockRejectedValue(dbError);
    const mockWithIndex = vi.fn().mockReturnValue({ collect: mockCollect });
    (db.query as any).mockReturnValue({ withIndex: mockWithIndex });

    await expect(
      getForSpaceHandler(db, { spaceId: 'space_1' })
    ).rejects.toThrow('Database query failed');
  });

  it('should handle tests with various statuses', async () => {
    const db = createMockDb();
    const mockTests = [
      { _id: 'test_1', spaceId: 'space_1', status: 'draft' as TestStatus },
      { _id: 'test_2', spaceId: 'space_1', status: 'generating' as TestStatus },
      { _id: 'test_3', spaceId: 'space_1', status: 'active' as TestStatus },
      { _id: 'test_4', spaceId: 'space_1', status: 'completed' as TestStatus },
    ];

    const mockCollect = vi.fn().mockResolvedValue(mockTests);
    const mockWithIndex = vi.fn().mockReturnValue({ collect: mockCollect });
    (db.query as any).mockReturnValue({ withIndex: mockWithIndex });

    const result = await getForSpaceHandler(db, { spaceId: 'space_1' });

    expect(result).toHaveLength(4);
    expect(result.map((t: any) => t.status)).toEqual(['draft', 'generating', 'active', 'completed']);
  });

  it('should handle single test in space', async () => {
    const db = createMockDb();
    const mockTests = [
      { _id: 'test_only', spaceId: 'space_single', status: 'active' as TestStatus },
    ];

    const mockCollect = vi.fn().mockResolvedValue(mockTests);
    const mockWithIndex = vi.fn().mockReturnValue({ collect: mockCollect });
    (db.query as any).mockReturnValue({ withIndex: mockWithIndex });

    const result = await getForSpaceHandler(db, { spaceId: 'space_single' });

    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe('test_only');
  });
});

describe('convex/tests - get query logic', () => {
  it('should retrieve a specific test by ID', async () => {
    const db = createMockDb();
    const mockTest = {
      _id: 'test_123',
      spaceId: 'space_456',
      status: 'active' as TestStatus,
      config: { type: 'quiz' },
    };
    (db.get as any).mockResolvedValue(mockTest);

    const result = await getHandler(db, { testId: 'test_123' });

    expect(db.get).toHaveBeenCalledWith('test_123');
    expect(result).toEqual(mockTest);
  });

  it('should return null when test does not exist', async () => {
    const db = createMockDb();
    (db.get as any).mockResolvedValue(null);

    const result = await getHandler(db, { testId: 'non_existent' });

    expect(db.get).toHaveBeenCalledWith('non_existent');
    expect(result).toBeNull();
  });

  it('should return undefined when test does not exist', async () => {
    const db = createMockDb();
    (db.get as any).mockResolvedValue(undefined);

    const result = await getHandler(db, { testId: 'non_existent' });

    expect(result).toBeUndefined();
  });

  it('should retrieve tests with different statuses', async () => {
    const db = createMockDb();
    const statuses: TestStatus[] = ['draft', 'generating', 'active', 'completed'];

    for (const status of statuses) {
      (db.get as any).mockClear();
      const mockTest = { _id: `test_${status}`, status, spaceId: 'space_1' };
      (db.get as any).mockResolvedValue(mockTest);

      const result = await getHandler(db, { testId: `test_${status}` });

      expect(result).toEqual(mockTest);
      expect(result?.status).toBe(status);
    }
  });

  it('should handle database get errors', async () => {
    const db = createMockDb();
    const dbError = new Error('Database get failed');
    (db.get as any).mockRejectedValue(dbError);

    await expect(
      getHandler(db, { testId: 'test_1' })
    ).rejects.toThrow('Database get failed');
  });

  it('should retrieve test with complex config object', async () => {
    const db = createMockDb();
    const mockTest = {
      _id: 'test_complex',
      spaceId: 'space_1',
      status: 'active' as TestStatus,
      config: {
        type: 'multiple-choice',
        duration: 60,
        questions: 25,
        difficulty: 'hard',
        topics: ['math', 'science'],
      },
    };
    (db.get as any).mockResolvedValue(mockTest);

    const result = await getHandler(db, { testId: 'test_complex' });

    expect(result).toEqual(mockTest);
    expect(result?.config).toHaveProperty('type', 'multiple-choice');
    expect(result?.config).toHaveProperty('duration', 60);
    expect(result?.config?.topics).toEqual(['math', 'science']);
  });

  it('should handle concurrent get requests', async () => {
    const db = createMockDb();
    const mockTests = [
      { _id: 'test_1', status: 'active' as TestStatus },
      { _id: 'test_2', status: 'draft' as TestStatus },
      { _id: 'test_3', status: 'completed' as TestStatus },
    ];

    (db.get as any).mockImplementation((id: string) => {
      return Promise.resolve(mockTests.find((t) => t._id === id));
    });

    const results = await Promise.all([
      getHandler(db, { testId: 'test_1' }),
      getHandler(db, { testId: 'test_2' }),
      getHandler(db, { testId: 'test_3' }),
    ]);

    expect(results).toHaveLength(3);
    expect(results[0]?._id).toBe('test_1');
    expect(results[1]?._id).toBe('test_2');
    expect(results[2]?._id).toBe('test_3');
  });

  it('should handle test with minimal data', async () => {
    const db = createMockDb();
    const mockTest = {
      _id: 'test_minimal',
      spaceId: 'space_1',
      status: 'draft' as TestStatus,
    };
    (db.get as any).mockResolvedValue(mockTest);

    const result = await getHandler(db, { testId: 'test_minimal' });

    expect(result).toEqual(mockTest);
  });

  it('should call db.get exactly once per request', async () => {
    const db = createMockDb();
    (db.get as any).mockResolvedValue({ _id: 'test_1' });

    await getHandler(db, { testId: 'test_1' });

    expect(db.get).toHaveBeenCalledTimes(1);
  });
});

describe('convex/tests - integration scenarios', () => {
  it('should handle complete test lifecycle', async () => {
    const db = createMockDb();
    const testId = 'test_lifecycle';

    // Create test
    (db.insert as any).mockResolvedValue(testId);
    const createdId = await createHandler(db, {
      spaceId: 'space_1',
      type: 'quiz',
    });
    expect(createdId).toBe(testId);

    // Update to active
    (db.patch as any).mockResolvedValue(undefined);
    await updateStatusHandler(db, { testId, status: 'active' });
    expect(db.patch).toHaveBeenCalledWith(testId, { status: 'active' });

    // Retrieve test
    const mockTest = { _id: testId, spaceId: 'space_1', userId: 'user_id', status: 'active' as TestStatus };
    (db.get as any).mockResolvedValue(mockTest);
    const retrieved = await getHandler(db, { testId });
    expect(retrieved).toEqual(mockTest);

    // Complete test
    await updateStatusHandler(db, { testId, status: 'completed' });
    expect(db.patch).toHaveBeenLastCalledWith(testId, { status: 'completed' });
  });

  it('should handle multiple tests in same space', async () => {
    const db = createMockDb();
    const spaceId = 'space_multi';

    // Create multiple tests
    (db.insert as any).mockResolvedValueOnce('test_1');
    (db.insert as any).mockResolvedValueOnce('test_2');
    (db.insert as any).mockResolvedValueOnce('test_3');

    await createHandler(db, { spaceId, type: 'quiz' });
    await createHandler(db, { spaceId, type: 'exam' });
    await createHandler(db, { spaceId, type: 'assignment' });

    expect(db.insert).toHaveBeenCalledTimes(3);

    // Get all tests for space
    const mockTests = [
      { _id: 'test_1', spaceId, status: 'generating' as TestStatus, config: { type: 'quiz' } },
      { _id: 'test_2', spaceId, status: 'generating' as TestStatus, config: { type: 'exam' } },
      { _id: 'test_3', spaceId, status: 'generating' as TestStatus, config: { type: 'assignment' } },
    ];
    const mockCollect = vi.fn().mockResolvedValue(mockTests);
    const mockWithIndex = vi.fn().mockReturnValue({ collect: mockCollect });
    (db.query as any).mockReturnValue({ withIndex: mockWithIndex });

    const allTests = await getForSpaceHandler(db, { spaceId });
    expect(allTests).toHaveLength(3);
    expect(allTests.map((t: any) => t.config.type)).toEqual(['quiz', 'exam', 'assignment']);
  });

  it('should handle error recovery scenarios', async () => {
    const db = createMockDb();

    // Simulate transient error on first attempt
    (db.insert as any)
      .mockRejectedValueOnce(new Error('Temporary error'))
      .mockResolvedValueOnce('test_retry');

    // First attempt fails
    await expect(
      createHandler(db, { spaceId: 'space_1', type: 'quiz' })
    ).rejects.toThrow('Temporary error');

    // Retry succeeds
    const result = await createHandler(db, { spaceId: 'space_1', type: 'quiz' });
    expect(result).toBe('test_retry');
  });

  it('should validate status transitions are called with correct values', async () => {
    const db = createMockDb();
    (db.patch as any).mockResolvedValue(undefined);

    const testId = 'test_status_validation';

    // Valid transition: generating -> active -> completed
    await updateStatusHandler(db, { testId, status: 'generating' });
    await updateStatusHandler(db, { testId, status: 'active' });
    await updateStatusHandler(db, { testId, status: 'completed' });

    expect(db.patch).toHaveBeenNthCalledWith(1, testId, { status: 'generating' });
    expect(db.patch).toHaveBeenNthCalledWith(2, testId, { status: 'active' });
    expect(db.patch).toHaveBeenNthCalledWith(3, testId, { status: 'completed' });
  });

  it('should handle creating and retrieving tests with identical types', async () => {
    const db = createMockDb();
    const spaceId = 'space_duplicate';

    // Create multiple tests with same type
    (db.insert as any).mockResolvedValueOnce('test_1');
    (db.insert as any).mockResolvedValueOnce('test_2');

    await createHandler(db, { spaceId, type: 'quiz' });
    await createHandler(db, { spaceId, type: 'quiz' });

    expect(db.insert).toHaveBeenCalledTimes(2);

    // Both tests should have the same config type
    expect(db.insert).toHaveBeenNthCalledWith(1, 'tests', {
      spaceId,
      status: 'generating',
      config: { type: 'quiz' },
    });
    expect(db.insert).toHaveBeenNthCalledWith(2, 'tests', {
      spaceId,
      status: 'generating',
      config: { type: 'quiz' },
    });
  });

  it('should handle stress test with many operations', async () => {
    const db = createMockDb();
    (db.insert as any).mockResolvedValue('test_id');
    (db.patch as any).mockResolvedValue(undefined);

    // Create 50 tests
    const createPromises = Array.from({ length: 50 }, (_, i) =>
      createHandler(db, { spaceId: 'space_stress', type: `type_${i}` })
    );
    await Promise.all(createPromises);

    expect(db.insert).toHaveBeenCalledTimes(50);
  });

  it('should verify all config data is preserved on creation', async () => {
    const db = createMockDb();
    (db.insert as any).mockResolvedValue('test_config');

    const testType = 'comprehensive-exam';
    await createHandler(db, { spaceId: 'space_1', type: testType });

    const callArgs = (db.insert as any).mock.calls[0][1];
    expect(callArgs.config.type).toBe(testType);
    expect(callArgs.status).toBe('generating');
    expect(callArgs.spaceId).toBe('space_1');
  });
});

// Mirrors the handler in convex/tests.ts (listAll) so we can exercise the
// space-scoped scan and ordering without a Convex runtime.
const listAllHandler = async (
  ctx: {
    auth: { getUserIdentity: () => Promise<{ subject?: string } | null> };
    db: {
      query: (table: string) => {
        withIndex: (name: string, cb: (q: any) => any) => {
          collect: () => Promise<any[]>;
        };
      };
    };
  },
  args: { userId: string },
) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject || identity.subject !== args.userId) {
    throw new Error('Unauthorized');
  }

  const spaces = await ctx.db
    .query('spaces')
    .withIndex('by_user', (q) => q.eq('userId', args.userId))
    .collect();

  if (spaces.length === 0) return [];

  const spaceById = new Map<string, { _id: string; name: string }>(
    spaces.map((s) => [s._id, s]),
  );

  const testsBySpace = await Promise.all(
    spaces.map((space) =>
      ctx.db
        .query('tests')
        .withIndex('by_space', (q) => q.eq('spaceId', space._id))
        .collect(),
    ),
  );

  const tests = testsBySpace
    .flat()
    .sort((a, b) => b._creationTime - a._creationTime);

  return await Promise.all(
    tests.map(async (test) => {
      const questions = await ctx.db
        .query('questions')
        .withIndex('by_test', (q) => q.eq('testId', test._id))
        .collect();
      const answeredCount = questions.filter((q) => q.userAnswer).length;
      return {
        ...test,
        spaceName: spaceById.get(test.spaceId)?.name ?? 'Unknown',
        questionCount: questions.length,
        answeredCount,
      };
    }),
  );
};

describe('convex/tests - listAll query logic', () => {
  const makeCtx = (
    identitySubject: string | null,
    tablesByQuery: Record<string, any[]>,
  ) => {
    const tableCursor = { current: '' };
    return {
      auth: {
        getUserIdentity: vi
          .fn()
          .mockResolvedValue(
            identitySubject ? { subject: identitySubject } : null,
          ),
      },
      db: {
        query: vi.fn((table: string) => {
          tableCursor.current = table;
          return {
            withIndex: (_name: string, cb: (q: any) => any) => {
              // Record the key the handler keys on per table for routing.
              const keyHolder: { field?: string; value?: unknown } = {};
              cb({
                eq: (field: string, value: unknown) => {
                  keyHolder.field = field;
                  keyHolder.value = value;
                  return keyHolder;
                },
              });
              return {
                collect: vi.fn(async () => {
                  const bucket = tablesByQuery[table] ?? [];
                  if (keyHolder.field && keyHolder.value !== undefined) {
                    return bucket.filter(
                      (row) => row[keyHolder.field!] === keyHolder.value,
                    );
                  }
                  return bucket;
                }),
              };
            },
          };
        }),
      },
    };
  };

  it('throws when auth subject does not match requested userId', async () => {
    const ctx = makeCtx('someone_else', { spaces: [], tests: [], questions: [] });
    await expect(listAllHandler(ctx, { userId: 'me' })).rejects.toThrow(
      'Unauthorized',
    );
  });

  it('returns empty when user owns no spaces', async () => {
    const ctx = makeCtx('me', { spaces: [], tests: [], questions: [] });
    const result = await listAllHandler(ctx, { userId: 'me' });
    expect(result).toEqual([]);
  });

  it('scopes tests to user-owned spaces and orders by _creationTime desc', async () => {
    const ctx = makeCtx('me', {
      spaces: [
        { _id: 'space_mine', userId: 'me', name: 'Mine' },
        { _id: 'space_other', userId: 'other', name: 'Other' },
      ],
      tests: [
        { _id: 'test_old', spaceId: 'space_mine', _creationTime: 1 },
        { _id: 'test_new', spaceId: 'space_mine', _creationTime: 3 },
        { _id: 'test_mid', spaceId: 'space_mine', _creationTime: 2 },
        { _id: 'test_stranger', spaceId: 'space_other', _creationTime: 10 },
      ],
      questions: [
        { _id: 'q1', testId: 'test_new', userAnswer: 'a' },
        { _id: 'q2', testId: 'test_new' },
        { _id: 'q3', testId: 'test_mid', userAnswer: 'b' },
      ],
    });

    const result = await listAllHandler(ctx, { userId: 'me' });

    expect(result.map((t: any) => t._id)).toEqual([
      'test_new',
      'test_mid',
      'test_old',
    ]);
    expect(result.find((t: any) => t._id === 'test_stranger')).toBeUndefined();
    expect(result[0]).toMatchObject({
      spaceName: 'Mine',
      questionCount: 2,
      answeredCount: 1,
    });
    expect(result[1]).toMatchObject({ questionCount: 1, answeredCount: 1 });
    expect(result[2]).toMatchObject({ questionCount: 0, answeredCount: 0 });
  });

  it('does not fetch tests for spaces the user does not own', async () => {
    const ctx = makeCtx('me', {
      spaces: [{ _id: 'space_mine', userId: 'me', name: 'Mine' }],
      tests: [{ _id: 'only', spaceId: 'space_mine', _creationTime: 1 }],
      questions: [],
    });

    await listAllHandler(ctx, { userId: 'me' });

    const queriedTables = (ctx.db.query as any).mock.calls.map(
      (c: any[]) => c[0],
    );
    // First call is spaces (by_user); then one tests call per owned space; then one questions call per test.
    expect(queriedTables[0]).toBe('spaces');
    expect(queriedTables.filter((t: string) => t === 'tests')).toHaveLength(1);
  });
});
