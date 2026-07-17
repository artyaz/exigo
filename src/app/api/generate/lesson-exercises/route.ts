import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAuthedConvexClient } from "../../../../lib/convexClientAuth";
import { resolveAiProvider } from "../../../../server/ai";
import { authorEmbedExercise } from "../../../_components/exercises/embed/constructor";
import { extractJson } from "../../../_components/exercises/atlas/prompts";

export const maxDuration = 300;

/* Lesson content → 1–3 inline practice exercises. Derives briefs from the
   lesson (count scaled to its depth), then builds each as a self-contained
   embed exercise. Additive to the Learn flow — it doesn't touch teaching. */
export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { content?: string; title?: string };
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return Response.json({ error: "`content` is required." }, { status: 400 });

  try {
    const convex = await createAuthedConvexClient(getToken, "api.generate.lessonExercises");
    const provider = await resolveAiProvider(convex);

    const briefsReply = await provider.generate({
      system: "You design interactive practice exercises for a lesson. Output ONLY a JSON array of strings.",
      prompt: [
        `Lesson title: ${body.title ?? "(untitled)"}`,
        "",
        "Lesson content:",
        content.slice(0, 6000),
        "",
        "Return a JSON array of 1 to 3 exercise briefs — use 1 for a short/simple lesson, up to 3 for a rich, multi-idea one. Each brief is a concrete description of what ONE inline interactive exercise should make the learner DO and grasp from THIS lesson (name the misconception it targets). Only the JSON array.",
      ].join("\n"),
      temperature: 0.8,
    });

    let briefs: string[] = [];
    try {
      briefs = extractJson<unknown[]>(briefsReply.text).map((b) => String(b)).filter(Boolean).slice(0, 3);
    } catch {
      briefs = [];
    }
    if (briefs.length === 0) return Response.json({ exercises: [] });

    const exercises = await Promise.all(
      briefs.map(async (description) => {
        try {
          const { html } = await authorEmbedExercise(provider, description);
          return { description, html };
        } catch (e) {
          return { description, html: "", error: e instanceof Error ? e.message : "build failed" };
        }
      }),
    );

    return Response.json({ provider: provider.config.label, model: provider.config.model, exercises });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Generation failed" }, { status: 500 });
  }
}
