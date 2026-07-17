import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAuthedConvexClient } from "../../../../lib/convexClientAuth";
import { resolveAiProvider } from "../../../../server/ai";
import { constructExercise, exerciseBriefSchema } from "../../../_components/exercises/generate";

/* Brief → exercise. The constructor-isolation path: take a brief, route to the
   user's provider, run generate→validate→repair, and return the spec plus the
   full attempt trace so the playground can show the repair loop at work. */
export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { brief?: unknown; maxRepairs?: number };
  const parsed = exerciseBriefSchema.safeParse(body.brief);
  if (!parsed.success) {
    return Response.json({ error: "Invalid brief", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const convex = await createAuthedConvexClient(getToken, "api.generate.exercise");
    const provider = await resolveAiProvider(convex);
    const result = await constructExercise(provider, parsed.data, { maxRepairs: body.maxRepairs ?? 2 });
    return Response.json({ provider: provider.config.label, model: provider.config.model, ...result });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Generation failed" }, { status: 500 });
  }
}
