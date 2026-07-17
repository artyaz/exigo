import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAuthedConvexClient } from "../../../../lib/convexClientAuth";
import { resolveAiProvider } from "../../../../server/ai";
import { authorEmbedExercise } from "../../../_components/exercises/embed/constructor";

/* Description → free-HTML embedded exercise. A separate agent receives only a
   description and authors a self-contained HTML exercise; we return the HTML to
   render in the sandbox. No constraints, no validation, no playability gate. */
export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { description?: unknown };
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!description) {
    return Response.json({ error: "A non-empty `description` is required." }, { status: 400 });
  }

  try {
    const convex = await createAuthedConvexClient(getToken, "api.generate.embed");
    const provider = await resolveAiProvider(convex);
    const result = await authorEmbedExercise(provider, description);
    return Response.json({ provider: provider.config.label, model: provider.config.model, ...result });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Generation failed" }, { status: 500 });
  }
}
