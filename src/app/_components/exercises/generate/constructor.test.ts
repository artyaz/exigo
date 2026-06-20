/* The constructor is the weak-AI thesis wired end to end: model writes
   markup, the parser/validator reject with repair-oriented errors, those
   errors feed the next turn. We drive it with a stub provider that returns a
   broken attempt first, then a good one — proving the repair loop closes. */
import { describe, it, expect } from "vitest";
import { constructExercise, extractMarkup, evaluateMarkup } from "./constructor";
import type { ExerciseBrief } from "./brief";
import type { AiProvider, AiGenerateRequest, AiResult, AiChunk } from "../../../../server/ai";

const GOOD_MARKUP = `
<exercise accent="azure">
  <prompt>Hold all 128 B in the buffer with no heap spill.</prompt>
  <state obs="[]" blocks="[]" bufUsed="0" heapCount="0" runId="0"/>
  <on event="ran">
    <set key="obs" to="event.observations"/>
    <set key="blocks" to="[]"/>
    <set key="runId" to="runId + 1"/>
  </on>
  <on event="obs:alloc" seq>
    <set key="blocks" to='push(blocks, record("id", event.id, "size", event.size, "region", event.region))'/>
  </on>
  <code harness="js-observation" edit="free" event="ran">
    <edit id="body" maxChars="800">
      alloc("a", 128, "buf", "a");
    </edit>
  </code>
  <arena label="buffer">
    <region id="buf" capacity="128" unit="B" tone="azure">buffer</region>
    <region id="heap" unit="B" tone="no">heap</region>
    <blocks bind="blocks"/>
    <overflow from="buf" to="heap" label="overflow"/>
  </arena>
  <goal when="heapCount == 0 and bufUsed >= 0"><ok>No spill.</ok></goal>
  <think>When is never-freeing the right trade?</think>
</exercise>`;

// First attempt uses a tag that isn't in the vocabulary → parser rejects it.
const BROKEN_MARKUP = `<exercise accent="azure"><widget/></exercise>`;

class StubProvider implements AiProvider {
  readonly config = { kind: "gemini" as const, model: "stub", apiKey: "x", label: "stub" };
  private turn = 0;
  constructor(private readonly replies: string[]) {}
  async generate(_req: AiGenerateRequest): Promise<AiResult> {
    const text = this.replies[Math.min(this.turn, this.replies.length - 1)]!;
    this.turn++;
    return { text, raw: { stub: true } };
  }
  async *stream(_req: AiGenerateRequest): AsyncIterable<AiChunk> {
    await Promise.resolve();
    yield { text: "", raw: null };
    throw new Error("not used");
  }
}

const BRIEF: ExerciseBrief = {
  concept: "monotonic buffer never frees",
  archetype: "arena",
  dataModel: "blocks list, bufUsed, heapCount",
  goal: "no heap spill",
  criticalThinking: "When is never-freeing the right trade?",
};

describe("extractMarkup", () => {
  it("unwraps a code-fenced reply", () => {
    expect(extractMarkup("```xml\n<exercise></exercise>\n```")).toBe("<exercise></exercise>");
  });
  it("trims prose around the markup", () => {
    expect(extractMarkup("Sure!\n<exercise>x</exercise>\nDone")).toBe("<exercise>x</exercise>");
  });
});

describe("evaluateMarkup", () => {
  it("returns a spec for valid markup", () => {
    expect(evaluateMarkup(GOOD_MARKUP).spec).toBeDefined();
  });
  it("surfaces errors for invalid markup", () => {
    const { spec, errors } = evaluateMarkup(BROKEN_MARKUP);
    expect(spec).toBeUndefined();
    expect(errors.length).toBeGreaterThan(0);
  });

  // Weak models copy the exemplar's shape but drop the small <think> element —
  // observed live (3 identical repair loops). Two fixes verified here.
  const NO_THINK = GOOD_MARKUP.replace(/<think>[\s\S]*?<\/think>/, "");

  it("back-fills criticalThinking from the brief when <think> is dropped", () => {
    const { spec, errors } = evaluateMarkup(NO_THINK, { criticalThinking: "Why does this matter?" });
    expect(errors).toEqual([]);
    expect(spec?.criticalThinking).toBe("Why does this matter?");
  });

  it("reports a spec error in markup vocabulary, not spec-field paths", () => {
    const { spec, errors } = evaluateMarkup(NO_THINK); // no brief → can't back-fill
    expect(spec).toBeUndefined();
    expect(errors.some((e) => e.message.includes("<think>"))).toBe(true);
    expect(errors.every((e) => !e.message.startsWith("spec."))).toBe(true);
  });
});

describe("constructExercise repair loop", () => {
  it("recovers on the repair turn after a broken first attempt", async () => {
    const provider = new StubProvider([BROKEN_MARKUP, GOOD_MARKUP]);
    const result = await constructExercise(provider, BRIEF, { maxRepairs: 2 });
    expect(result.ok).toBe(true);
    expect(result.spec).toBeDefined();
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0]!.ok).toBe(false);
    expect(result.attempts[1]!.ok).toBe(true);
  });

  it("gives up after maxRepairs and reports the attempts", async () => {
    const provider = new StubProvider([BROKEN_MARKUP]);
    const result = await constructExercise(provider, BRIEF, { maxRepairs: 1 });
    expect(result.ok).toBe(false);
    expect(result.attempts).toHaveLength(2); // initial + 1 repair
    expect(result.spec).toBeUndefined();
  });
});
