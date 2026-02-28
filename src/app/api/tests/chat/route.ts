import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import {
  ConvexAuthError,
  createAuthedConvexClient,
} from "../../../../lib/convexClientAuth";
import { PLAN_LIMIT_CODE } from "../../../../../shared/planConfig";

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
  try {
    const { getToken } = await auth();

    const convex = await createAuthedConvexClient(getToken, "api.tests.chat");

    let rawBody: Record<string, unknown>;
    try {
      rawBody = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
    }

    const parsedBody = parseChatBody(rawBody);
    if (!parsedBody) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const result = await convex.action(api.testMessages.chat, {
      testId: parsedBody.testId as Id<"tests">,
      questionId: parsedBody.questionId as Id<"questions">,
      message: parsedBody.message,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error(err);
    if (err instanceof ConvexAuthError) {
      return NextResponse.json(
        { error: "Unauthorized: Missing Convex auth token." },
        { status: 401 },
      );
    }
    if (hasErrorCode(err, PLAN_LIMIT_CODE)) {
      return NextResponse.json(
        {
          error:
            "AI Tutor is available on Educator plan. Please upgrade your plan.",
        },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
