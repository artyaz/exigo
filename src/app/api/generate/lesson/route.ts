import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAuthedConvexClient } from "../../../../lib/convexClientAuth";
import { resolveAiProvider } from "../../../../server/ai";
import { draftLesson, constructLessonExercises } from "../../../_components/exercises/generate";

/* Topic → lesson → exercises. The full pipeline: a smart model drafts a lesson
   with one inline brief per step, then the constructor realises each brief.
   Returns the draft, each constructed step, and per-step attempt traces. */
export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { topic?: unknown };
  if (typeof body.topic !== "string" || !body.topic.trim()) {
    return Response.json({ error: "Missing topic" }, { status: 400 });
  }

  try {
    const convex = await createAuthedConvexClient(getToken, "api.generate.lesson");
    const provider = await resolveAiProvider(convex);

    const draftResult = await draftLesson(provider, body.topic.trim());
    if (!draftResult.draft) {
      return Response.json({ error: draftResult.error ?? "Could not draft lesson", raw: draftResult.raw }, { status: 422 });
    }
    const steps = await constructLessonExercises(provider, draftResult.draft);
    return Response.json({
      provider: provider.config.label,
      model: provider.config.model,
      draft: draftResult.draft,
      steps,
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Generation failed" }, { status: 500 });
  }
}
