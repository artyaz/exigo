/* The lesson draft path must tolerate what models actually return: JSON wrapped
   in ```json fences (endpoints routinely ignore json-mode) and the natural
   field-name variant `stageArchetype`. Both were observed from a live run. */
import { describe, it, expect } from "vitest";
import { extractJson, normalizeDraftJson, draftLesson } from "./lesson";
import type { AiProvider, AiGenerateRequest, AiResult, AiChunk } from "../../../../server/ai";

describe("extractJson", () => {
  it("unwraps a ```json fenced object", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });
  it("grabs the object out of surrounding prose", () => {
    expect(extractJson('Here you go:\n{"a":1}\nHope that helps')).toBe('{"a":1}');
  });
});

describe("normalizeDraftJson", () => {
  it("maps stageArchetype → archetype inside each brief", () => {
    const out = normalizeDraftJson({ steps: [{ role: "prime", brief: { stageArchetype: "arena" } }] }) as {
      steps: { brief: Record<string, unknown> }[];
    };
    expect(out.steps[0]!.brief.archetype).toBe("arena");
    expect(out.steps[0]!.brief.stageArchetype).toBeUndefined();
  });
});

class StubProvider implements AiProvider {
  readonly config = { kind: "openai" as const, model: "stub", apiKey: "x", baseUrl: "http://x", label: "openai" };
  constructor(private readonly reply: string) {}
  async generate(_req: AiGenerateRequest): Promise<AiResult> {
    return { text: this.reply, raw: {} };
  }
  async *stream(_req: AiGenerateRequest): AsyncIterable<AiChunk> {
    await Promise.resolve();
    yield { text: "", raw: null };
  }
}

const FENCED_DRAFT = `\`\`\`json
{
  "title": "Monotonic allocator",
  "steps": [
    {
      "role": "prime",
      "brief": {
        "concept": "bump pointer never frees",
        "misconception": "every allocator tracks each block",
        "stageArchetype": "arena",
        "dataModel": "one arena region, offset counter",
        "goal": "fill the buffer",
        "criticalThinking": "why no free-list?"
      }
    }
  ]
}
\`\`\``;

describe("draftLesson", () => {
  it("parses a fenced reply with stageArchetype into a valid draft", async () => {
    const { draft, error } = await draftLesson(new StubProvider(FENCED_DRAFT), "allocators");
    expect(error).toBeUndefined();
    expect(draft?.title).toBe("Monotonic allocator");
    expect(draft?.steps[0]!.brief.archetype).toBe("arena");
  });
});
