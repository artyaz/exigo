import { describe, expect, it } from "vitest";
import {
  isRequestedTopicCovered,
  parseInsertTopicRequestContent,
} from "./courseTopicRequests";

describe("parseInsertTopicRequestContent", () => {
  it("parses the current JSON request format", () => {
    expect(
      parseInsertTopicRequestContent(
        'INSERT TOPIC REQUEST: {"topic":"GraphQL","context":"Needed before API design"}',
      ),
    ).toEqual({
      topic: "GraphQL",
      context: "Needed before API design",
    });
  });

  it("parses the legacy plain-text request format", () => {
    expect(
      parseInsertTopicRequestContent(
        'INSERT TOPIC REQUEST: "GraphQL". Context: Needed before API design. This should be the next module topic.',
      ),
    ).toEqual({
      topic: "GraphQL",
      context: "Needed before API design",
    });
  });

  it("returns null for unrelated content", () => {
    expect(
      parseInsertTopicRequestContent(
        "Student requested lesson on: GraphQL. Reason: Student interest",
      ),
    ).toBeNull();
  });
});

describe("isRequestedTopicCovered", () => {
  it("matches a requested topic against a broader module title", () => {
    expect(
      isRequestedTopicCovered("GraphQL", "GraphQL fundamentals and schema design"),
    ).toBe(true);
  });

  it("does not match unrelated module titles", () => {
    expect(
      isRequestedTopicCovered("GraphQL", "React state management"),
    ).toBe(false);
  });
});
