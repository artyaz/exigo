import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAuthedConvexClient } from "../../../../lib/convexClientAuth";
import { resolveAiProvider } from "../../../../server/ai";
import { exerciseBriefSchema } from "../../../_components/exercises/generate";
import { authorOpenExercise } from "../../../_components/exercises/open/constructor";

/* Brief → open scripted exercise. The model designs the interaction and authors
   a self-contained HTML exercise; we return its design rationale + the HTML to
   render in the sandbox. No playability gating (per current direction). */
export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { brief?: unknown };
  const parsed = exerciseBriefSchema.safeParse(body.brief);
  if (!parsed.success) {
    return Response.json({ error: "Invalid brief", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const convex = await createAuthedConvexClient(getToken, "api.generate.open");
    const provider = await resolveAiProvider(convex, userId);
    const result = await authorOpenExercise(provider, parsed.data);
    return Response.json({ provider: provider.config.label, model: provider.config.model, ...result });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Generation failed" }, { status: 500 });
  }
}
