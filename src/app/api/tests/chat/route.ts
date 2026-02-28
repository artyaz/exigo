import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import {
  ConvexAuthError,
  createAuthedConvexClient,
} from "../../../../lib/convexClientAuth";

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

export async function POST(req: NextRequest) {
  try {
    const { getToken } = await auth();

    const convex = await createAuthedConvexClient(getToken, "api.tests.chat");

    const rawBody = (await req.json()) as Record<string, unknown>;
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
    const errorMessage = err instanceof Error ? err.message : undefined;
    if (errorMessage?.includes("higher subscription")) {
      return NextResponse.json(
        { error: "Upgrade to Pro to chat further about answers!" },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: errorMessage ?? "Unknown error" },
      { status: 500 },
    );
  }
}
