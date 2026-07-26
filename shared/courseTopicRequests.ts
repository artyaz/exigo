export const INSERT_TOPIC_REQUEST_PREFIX = "INSERT TOPIC REQUEST:";

export interface CourseTopicInsertRequest {
  topic: string;
  context: string;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeComparisonValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseJsonRequestPayload(
  payload: string,
): CourseTopicInsertRequest | null {
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const topic =
      "topic" in parsed && typeof parsed.topic === "string"
        ? normalizeWhitespace(parsed.topic)
        : "";
    if (!topic) {
      return null;
    }

    const context =
      "context" in parsed && typeof parsed.context === "string"
        ? normalizeWhitespace(parsed.context)
        : "Student request";

    return {
      topic,
      context: context || "Student request",
    };
  } catch {
    return null;
  }
}

function parseLegacyRequestPayload(
  payload: string,
): CourseTopicInsertRequest | null {
  const topicMatch = /"([^"]+)"/.exec(payload);
  const topic = normalizeWhitespace(topicMatch?.[1] ?? "");
  if (!topic) {
    return null;
  }

  const contextMatch =
    /Context:\s*(.+?)(?:\.\s*This should be the next module topic\.?)?$/i.exec(
      payload,
    );
  const context = normalizeWhitespace(contextMatch?.[1] ?? "Student request");

  return {
    topic,
    context: context || "Student request",
  };
}

export function parseInsertTopicRequestContent(
  content: string,
): CourseTopicInsertRequest | null {
  if (!content.startsWith(INSERT_TOPIC_REQUEST_PREFIX)) {
    return null;
  }

  const payload = content.slice(INSERT_TOPIC_REQUEST_PREFIX.length).trim();
  if (!payload) {
    return null;
  }

  return parseJsonRequestPayload(payload) ?? parseLegacyRequestPayload(payload);
}

export function isRequestedTopicCovered(
  requestedTopic: string,
  moduleTitle: string,
): boolean {
  const normalizedTopic = normalizeComparisonValue(requestedTopic);
  const normalizedModuleTitle = normalizeComparisonValue(moduleTitle);

  if (!normalizedTopic || !normalizedModuleTitle) {
    return false;
  }

  return (
    normalizedModuleTitle.includes(normalizedTopic) ||
    normalizedTopic.includes(normalizedModuleTitle)
  );
}
