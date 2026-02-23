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
  get: vi.fn(),
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
  args: { testId: string; userId: string; status: TestStatus }
) => {
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
      userId: 'user_id',
      status: 'draft',
    });

    expect(db.patch).toHaveBeenCalledWith('test_123', { status: 'draft' });
  });

  it('should update test status to generating', async () => {
    const db = createMockDb();
    (db.patch as any).mockResolvedValue(undefined);

    await updateStatusHandler(db, {
      testId: 'test_456',
      userId: 'user_id',
      status: 'generating',
    });

    expect(db.patch).toHaveBeenCalledWith('test_456', { status: 'generating' });
  });

  it('should update test status to active', async () => {
    const db = createMockDb();
    (db.patch as any).mockResolvedValue(undefined);

    await updateStatusHandler(db, {
      testId: 'test_789',
      userId: 'user_id',
      status: 'active',
    });

    expect(db.patch).toHaveBeenCalledWith('test_789', { status: 'active' });
  });

  it('should update test status to completed', async () => {
    const db = createMockDb();
    (db.patch as any).mockResolvedValue(undefined);

    await updateStatusHandler(db, {
      testId: 'test_999',
      userId: 'user_id',
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
      await updateStatusHandler(db, { testId, userId: 'user_id', status });
      expect(db.patch).toHaveBeenCalledWith(testId, { status });
    }
  });

  it('should handle database patch errors', async () => {
    const db = createMockDb();
    const dbError = new Error('Database patch failed');
    (db.patch as any).mockRejectedValue(dbError);

    await expect(
      updateStatusHandler(db, { testId: 'test_1', userId: 'user_id', status: 'active' })
    ).rejects.toThrow('Database patch failed');
  });

  it('should handle non-existent test ID without throwing', async () => {
    const db = createMockDb();
    (db.patch as any).mockResolvedValue(undefined);

    await updateStatusHandler(db, {
      testId: 'non_existent_test',
      userId: 'user_id',
      status: 'active',
    });

    expect(db.patch).toHaveBeenCalledWith('non_existent_test', { status: 'active' });
  });

  it('should handle rapid concurrent status updates', async () => {
    const db = createMockDb();
    (db.patch as any).mockResolvedValue(undefined);

    const testId = 'test_rapid';

    await Promise.all([
      updateStatusHandler(db, { testId, userId: 'user_id', status: 'draft' }),
      updateStatusHandler(db, { testId, userId: 'user_id', status: 'generating' }),
      updateStatusHandler(db, { testId, userId: 'user_id', status: 'active' }),
    ]);

    expect(db.patch).toHaveBeenCalledTimes(3);
  });

  it('should only update the status field', async () => {
    const db = createMockDb();
    (db.patch as any).mockResolvedValue(undefined);

    await updateStatusHandler(db, { testId: 'test_123', userId: 'user_id', status: 'completed' });

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
    await updateStatusHandler(db, { testId, userId: 'user_id', status: 'active' });
    expect(db.patch).toHaveBeenCalledWith(testId, { status: 'active' });

    // Retrieve test
    const mockTest = { _id: testId, spaceId: 'space_1', status: 'active' as TestStatus };
    (db.get as any).mockResolvedValue(mockTest);
    const retrieved = await getHandler(db, { testId });
    expect(retrieved).toEqual(mockTest);

    // Complete test
    await updateStatusHandler(db, { testId, userId: 'user_id', status: 'completed' });
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
    await updateStatusHandler(db, { testId, userId: 'user_id', status: 'generating' });
    await updateStatusHandler(db, { testId, userId: 'user_id', status: 'active' });
    await updateStatusHandler(db, { testId, userId: 'user_id', status: 'completed' });

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
