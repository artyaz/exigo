import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAuthedConvexClient } from "../../../../lib/convexClientAuth";
import { resolveAiProvider } from "../../../../server/ai";
import { runAtlas } from "../../../_components/exercises/atlas/generate";
import { ATLAS_DEFAULT, ATLAS_QUICK, type AtlasConfig, type AtlasEvent } from "../../../_components/exercises/atlas/types";

export const maxDuration = 800; // the pyramid is many calls deep

/* Streams the Atlas pyramid as NDJSON — one event per node as it lands, so the
   explorer fills in live while generation fans out. */
export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { quick?: boolean; config?: Partial<AtlasConfig> };
  const cfg: AtlasConfig = { ...(body.quick ? ATLAS_QUICK : ATLAS_DEFAULT), ...body.config };

  const convex = await createAuthedConvexClient(getToken, "api.generate.atlas");
  const provider = await resolveAiProvider(convex);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: AtlasEvent): void => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          /* stream closed by the client — ignore */
        }
      };
      try {
        await runAtlas(provider, cfg, emit);
      } catch (e) {
        emit({ type: "error", stage: "root", message: e instanceof Error ? e.message : "generation failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
