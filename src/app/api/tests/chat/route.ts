import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { jsonError, requireAuthedApi } from "../../../../lib/apiAuth";
import { PLAN_LIMIT_CODE } from "../../../../../shared/planConfig";
import {
  createRequestId,
  getErrorAttributes,
  logError,
  logInfo,
} from "../../../../lib/otlpLogger";

type ChatBody = {
  testId: string;
  questionId: string;
  message: string;
};

function parseChatBody(raw: Record<string, unknown>): ChatBody | null {
  if (
    typeof raw.testId !== "string" ||
    typeof raw.questionId !== "string" ||
    typeof raw.message !== "string"
  ) {
    return null;
  }

  const testId = raw.testId.trim();
  const questionId = raw.questionId.trim();
  const message = raw.message.trim();
  if (!testId || !questionId || !message) {
    return null;
  }

  return { testId, questionId, message };
}

function hasErrorCode(error: unknown, code: string): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { data?: { code?: string } };
  return err.data?.code === code;
}

export async function POST(req: NextRequest) {
  const requestId = createRequestId(req.headers);
  const startedAt = Date.now();
  try {
    const authResult = await requireAuthedApi("api.tests.chat", {
      requestId,
      route: "/api/tests/chat",
      duration_ms: Date.now() - startedAt,
    });
    if (authResult instanceof Response) return authResult;
    const { userId, convex } = authResult;

    let rawBody: Record<string, unknown>;
    try {
      rawBody = (await req.json()) as Record<string, unknown>;
    } catch {
      return jsonError(400, "Malformed JSON");
    }

    const parsedBody = parseChatBody(rawBody);
    if (!parsedBody) {
      return jsonError(400, "Missing required fields");
    }

    const result = await convex.action(api.testMessagesActions.chat, {
      testId: parsedBody.testId as Id<"tests">,
      questionId: parsedBody.questionId as Id<"questions">,
      message: parsedBody.message,
    });

    logInfo("Test chat request succeeded", {
      source: "api.tests.chat",
      requestId,
      route: "/api/tests/chat",
      userId,
      testId: parsedBody.testId,
      questionId: parsedBody.questionId,
      duration_ms: Date.now() - startedAt,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    logError("Test chat request failed", {
      source: "api.tests.chat",
      requestId,
      route: "/api/tests/chat",
      duration_ms: Date.now() - startedAt,
      ...getErrorAttributes(err),
    });
    if (hasErrorCode(err, PLAN_LIMIT_CODE)) {
      return jsonError(
        403,
        "AI Tutor is available on Educator plan. Please upgrade your plan.",
      );
    }
    return jsonError(500, "Internal server error");
  }
}
