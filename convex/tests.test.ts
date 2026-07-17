import { describe, it, expect } from "vitest";
import {
  countAnsweredQuestions,
  enrichTestForList,
  listAll,
  sortTestsByCreationDesc,
} from "./tests";

// Convex's mutation/query wrappers keep the original async handler on `_handler`;
// this gives us a way to unit-test the real body by injecting a mocked ctx.
type ConvexHandlerFn = (ctx: unknown, args: unknown) => Promise<unknown>;
const listAllHandlerFn = (listAll as unknown as { _handler: ConvexHandlerFn })
  ._handler;

type StubTest = {
  _id: string;
  _creationTime: number;
  spaceId: string;
  [key: string]: unknown;
};
type StubSpace = { _id: string; userId: string; name: string };
type StubQuestion = { _id: string; testId: string; userAnswer?: string };

function buildListAllCtx(data: {
  identitySubject: string | null;
  spaces: StubSpace[];
  tests: StubTest[];
  questions: StubQuestion[];
}) {
  return {
    auth: {
      getUserIdentity: async () =>
        data.identitySubject ? { subject: data.identitySubject } : null,
    },
    db: {
      query: (table: "spaces" | "tests" | "questions") => ({
        withIndex: (_name: string, cb: (q: any) => any) => {
          const captured: Record<string, unknown> = {};
          cb({
            eq: (field: string, value: unknown) => {
              captured[field] = value;
              return { eq: () => ({}) };
            },
          });
          return {
            collect: async () => {
              if (table === "spaces") {
                return data.spaces.filter((s) => s.userId === captured.userId);
              }
              if (table === "tests") {
                return data.tests.filter((t) => t.spaceId === captured.spaceId);
              }
              return data.questions.filter((q) => q.testId === captured.testId);
            },
          };
        },
      }),
    },
  };
}

describe("convex/tests - listAll helper functions", () => {
  describe("sortTestsByCreationDesc", () => {
    it("sorts tests by _creationTime descending", () => {
      const tests = [
        { _id: "a", _creationTime: 100 },
        { _id: "b", _creationTime: 300 },
        { _id: "c", _creationTime: 200 },
      ];
      expect(sortTestsByCreationDesc(tests).map((t) => t._id)).toEqual([
        "b",
        "c",
        "a",
      ]);
    });

    it("does not mutate the input array", () => {
      const tests = [
        { _id: "a", _creationTime: 100 },
        { _id: "b", _creationTime: 300 },
      ];
      const original = [...tests];
      sortTestsByCreationDesc(tests);
      expect(tests).toEqual(original);
    });

    it("handles empty input", () => {
      expect(sortTestsByCreationDesc([])).toEqual([]);
    });

    it("preserves order for equal _creationTime values", () => {
      const tests = [
        { _id: "a", _creationTime: 100 },
        { _id: "b", _creationTime: 100 },
        { _id: "c", _creationTime: 100 },
      ];
      const result = sortTestsByCreationDesc(tests);
      expect(result.map((t) => t._id)).toEqual(["a", "b", "c"]);
    });
  });

  describe("countAnsweredQuestions", () => {
    it("counts questions with a truthy userAnswer", () => {
      expect(
        countAnsweredQuestions([
          { userAnswer: "yes" },
          { userAnswer: "" },
          {},
          { userAnswer: "no" },
        ]),
      ).toBe(2);
    });

    it("returns 0 for empty list", () => {
      expect(countAnsweredQuestions([])).toBe(0);
    });

    it("returns 0 when no questions have answers", () => {
      expect(countAnsweredQuestions([{}, { userAnswer: "" }, {}])).toBe(0);
    });
  });

  describe("enrichTestForList", () => {
    const baseTest = {
      _id: "t1",
      _creationTime: 1,
      spaceId: "space_a",
      status: "active",
      config: { type: "quiz" },
    } as any;

    it("attaches spaceName and question counts", () => {
      const result = enrichTestForList(baseTest, { name: "Alpha" }, [
        { userAnswer: "a" },
        {},
      ]);
      expect(result).toMatchObject({
        _id: "t1",
        spaceName: "Alpha",
        questionCount: 2,
        answeredCount: 1,
      });
    });

    it("falls back to \"Unknown\" when space is undefined", () => {
      const result = enrichTestForList(baseTest, undefined, []);
      expect(result.spaceName).toBe("Unknown");
      expect(result.questionCount).toBe(0);
      expect(result.answeredCount).toBe(0);
    });

    it("preserves original test fields in the result", () => {
      const result = enrichTestForList(baseTest, { name: "Alpha" }, []);
      expect(result._id).toBe(baseTest._id);
      expect(result._creationTime).toBe(baseTest._creationTime);
      expect(result.status).toBe("active");
      expect(result.config).toEqual({ type: "quiz" });
    });
  });
});

describe("convex/tests - listAll handler", () => {
  const baseSpaces: StubSpace[] = [
    { _id: "space_a", userId: "user_id", name: "Alpha" },
    { _id: "space_b", userId: "user_id", name: "Beta" },
    { _id: "space_other", userId: "other_user", name: "Other" },
  ];

  it("throws when identity is missing", async () => {
    const ctx = buildListAllCtx({
      identitySubject: null,
      spaces: [],
      tests: [],
      questions: [],
    });
    await expect(listAllHandlerFn(ctx, { userId: "user_id" })).rejects.toThrow(
      "Unauthorized",
    );
  });

  it("throws when identity subject does not match args.userId", async () => {
    const ctx = buildListAllCtx({
      identitySubject: "other_user",
      spaces: baseSpaces,
      tests: [],
      questions: [],
    });
    await expect(listAllHandlerFn(ctx, { userId: "user_id" })).rejects.toThrow(
      "Unauthorized",
    );
  });

  it("returns empty array when user has no spaces", async () => {
    const ctx = buildListAllCtx({
      identitySubject: "user_id",
      spaces: [{ _id: "space_other", userId: "other_user", name: "Other" }],
      tests: [],
      questions: [],
    });
    const result = (await listAllHandlerFn(ctx, {
      userId: "user_id",
    })) as unknown[];
    expect(result).toEqual([]);
  });

  it("returns tests sorted by _creationTime desc across all user spaces", async () => {
    const ctx = buildListAllCtx({
      identitySubject: "user_id",
      spaces: baseSpaces,
      tests: [
        { _id: "t1", spaceId: "space_a", _creationTime: 100 },
        { _id: "t2", spaceId: "space_a", _creationTime: 300 },
        { _id: "t3", spaceId: "space_b", _creationTime: 200 },
      ],
      questions: [
        { _id: "q1", testId: "t1" },
        { _id: "q2", testId: "t2", userAnswer: "yes" },
      ],
    });
    const result = (await listAllHandlerFn(ctx, { userId: "user_id" })) as {
      _id: string;
    }[];
    expect(result.map((t) => t._id)).toEqual(["t2", "t3", "t1"]);
  });

  it("enriches each test with spaceName, questionCount, and answeredCount", async () => {
    const ctx = buildListAllCtx({
      identitySubject: "user_id",
      spaces: baseSpaces,
      tests: [{ _id: "t1", spaceId: "space_a", _creationTime: 100 }],
      questions: [
        { _id: "q1", testId: "t1", userAnswer: "a" },
        { _id: "q2", testId: "t1" },
        { _id: "q3", testId: "t1", userAnswer: "b" },
      ],
    });
    const result = (await listAllHandlerFn(ctx, { userId: "user_id" })) as any[];
    expect(result[0]).toMatchObject({
      _id: "t1",
      spaceName: "Alpha",
      questionCount: 3,
      answeredCount: 2,
    });
  });

  it("excludes tests from spaces owned by other users", async () => {
    const ctx = buildListAllCtx({
      identitySubject: "user_id",
      spaces: baseSpaces,
      tests: [
        { _id: "t1", spaceId: "space_a", _creationTime: 100 },
        { _id: "t_other", spaceId: "space_other", _creationTime: 500 },
      ],
      questions: [],
    });
    const result = (await listAllHandlerFn(ctx, { userId: "user_id" })) as {
      _id: string;
    }[];
    expect(result.map((t) => t._id)).toEqual(["t1"]);
  });

  it("handles users with zero tests across their spaces", async () => {
    const ctx = buildListAllCtx({
      identitySubject: "user_id",
      spaces: [{ _id: "space_a", userId: "user_id", name: "Alpha" }],
      tests: [],
      questions: [],
    });
    const result = (await listAllHandlerFn(ctx, {
      userId: "user_id",
    })) as unknown[];
    expect(result).toEqual([]);
  });
});
