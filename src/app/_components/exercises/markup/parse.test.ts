/* The markup frontend must lower onto the SAME IR the JSON authoring
   surface produces — otherwise we'd fork the runtime. The headline test
   round-trips the pmr-arena flagship: its markup compiles to a spec
   deep-equal to the hand-written preset (minus the legacy `hook`). The
   rest pin the repair-oriented error behaviour that makes the closed
   vocabulary teachable to a weak author. */
import { describe, it, expect } from "vitest";
import { parseMarkup } from "./parse";
import { validateSpec } from "../runtime/validate";
import { PRESETS } from "../../../playground/presets";

// The pmr-arena flagship, authored in markup. Note: raw JS sits between
// <locked>/<edit> with zero escaping, and `and` stands in for `&&`.
const PMR_MARKUP = `
<exercise accent="azure">
  <prompt>
    This JS models a \`std::pmr::monotonic_buffer_resource\` of **128 B** — it
    bumps a pointer and **never frees**. The doubling vector spills to the
    heap. **Hold all 128 B in the buffer with no heap spill.**
  </prompt>

  <state obs="[]" blocks="[]" bufUsed="0" heapCount="0" runId="0"/>

  <on event="ran">
    <set key="obs" to="event.observations"/>
    <set key="blocks" to="[]"/>
    <set key="bufUsed" to="0"/>
    <set key="heapCount" to="0"/>
    <set key="runId" to="runId + 1"/>
  </on>
  <on event="obs:alloc" when='event.region == "buf"' seq>
    <set key="blocks" to='push(blocks, record("id", event.id, "size", event.size, "region", event.region, "label", event.label))'/>
    <set key="bufUsed" to="bufUsed + event.size"/>
  </on>
  <on event="obs:alloc" when='event.region == "heap"' seq>
    <set key="blocks" to='push(blocks, record("id", event.id, "size", event.size, "region", event.region, "label", event.label))'/>
    <set key="heapCount" to="heapCount + 1"/>
  </on>
  <on event="play:reset" seq>
    <set key="blocks" to="[]"/>
    <set key="bufUsed" to="0"/>
    <set key="heapCount" to="0"/>
  </on>

  <code harness="js-observation" edit="free" event="ran">
    <locked id="alloc">
      // monotonic_buffer_resource: bump a pointer, NEVER free.
      const CAP = 128;
      let used = 0;
      function reserve(name, bytes) {
        if (used + bytes <= CAP) {
          used += bytes;
          alloc(name, bytes, "buf", name);
        } else {
          alloc(name, bytes, "heap", name);
        }
      }
    </locked>
    <edit id="body" maxChars="1200">
      // std::pmr::vector<int> growing by doubling.
      // Every growth reallocates; the old block is never reclaimed.
      reserve("cap=2", 8);
      reserve("cap=4", 16);
      reserve("cap=8", 32);
      reserve("cap=16", 64);
      reserve("cap=32", 128);
    </edit>
  </code>

  <arena label="std::pmr::monotonic_buffer_resource">
    <region id="buf" capacity="128" unit="B" tone="azure">buffer</region>
    <region id="heap" unit="B" tone="no">system heap</region>
    <blocks bind="blocks"/>
    <overflow from="buf" to="heap" label="overflow"/>
  </arena>

  <readout label="buffer used" value='concat(bufUsed, " / 128 B")'/>

  <player source="obs" version="runId" label="allocations" fps="2"/>

  <goal when="heapCount == 0 and bufUsed >= 128" proximity="1 - heapCount / 4">
    <ok>No spill — the live data sits entirely in the buffer. Reserve once, churn never.</ok>
    <no>Something escaped to the heap. Doubling reallocations leave dead blocks the monotonic buffer can't reclaim — reserve the final size up front.</no>
  </goal>

  <think>
    A monotonic buffer never reclaims, yet it's often *faster* than a general
    allocator. When is 'waste memory, never free' the right trade — and when
    would it bite you?
  </think>
</exercise>`;

describe("markup → ReactiveSpec", () => {
  it("round-trips the pmr-arena flagship to the same IR as the JSON preset", () => {
    const { spec, errors } = parseMarkup(PMR_MARKUP);
    expect(errors).toEqual([]);

    const pmr = PRESETS.find((p) => p.id === "pmr-arena")!.spec;
    // `hook` is the legacy free-text field the structured surface drops.
    const expected: Record<string, unknown> = { ...pmr };
    delete expected.hook;
    expect(spec).toEqual(expected);
  });

  it("produces a spec that passes the existing validator", () => {
    const { spec } = parseMarkup(PMR_MARKUP);
    const result = validateSpec(spec!);
    expect(result.errors).toEqual([]);
  });

  it("preserves code regions byte-for-byte despite indented markup", () => {
    const { spec } = parseMarkup(PMR_MARKUP);
    const locked = spec!.code!.source[0]!;
    expect(locked).toMatchObject({ kind: "locked", id: "alloc" });
    const text = (locked as { text: string }).text;
    expect(text.startsWith("// monotonic_buffer_resource")).toBe(true);
    expect(text).toContain("  if (used + bytes <= CAP) {"); // inner indent kept
    expect(text.endsWith("}\n")).toBe(true); // trailing newline kept
  });
});

describe("markup errors teach the fix (repair-oriented)", () => {
  it("rejects an unknown tag and lists the vocabulary", () => {
    const { spec, errors } = parseMarkup(`<exercise><widget/></exercise>`);
    expect(spec).toBeUndefined();
    expect(errors[0]!.message).toContain("<widget>");
    expect(errors[0]!.message).toContain("Allowed"); // lists the vocabulary to repair toward
  });

  it("rejects an unknown attribute and lists the allowed ones", () => {
    const { errors } = parseMarkup(`<exercise><region id="a" colour="red">x</region></exercise>`);
    expect(errors.some((e) => e.message.includes('no attribute "colour"'))).toBe(true);
  });

  it("flags a missing required attribute", () => {
    const { errors } = parseMarkup(`<exercise><blocks/></exercise>`);
    expect(errors.some((e) => e.message.includes('missing required attribute "bind"'))).toBe(true);
  });

  it("rejects an out-of-vocabulary tone", () => {
    const { errors } = parseMarkup(`<exercise><region id="a" tone="crimson">x</region></exercise>`);
    expect(errors.some((e) => e.message.includes('tone "crimson"'))).toBe(true);
  });

  it("rejects a child that isn't allowed under its parent", () => {
    const { errors } = parseMarkup(`<exercise><arena><player source="obs"/></arena></exercise>`);
    expect(errors.some((e) => e.message.includes("not allowed inside <arena>"))).toBe(true);
  });

  it("reports a line number for a syntax fault", () => {
    const { errors } = parseMarkup(`<exercise>\n<region id=bad>x</region>\n</exercise>`);
    expect(errors[0]!.line).toBeGreaterThan(1);
  });
});

// Weak models have overwhelming priors toward a JSON state blob and toward
// valued boolean attributes. Rather than fight those forever in the prompt, the
// grammar meets them — these are the dominant failure shapes from real runs.
describe("markup tolerates strong model priors", () => {
  const STAGE = `<arena><region id="a">A</region><blocks bind="count"/></arena>`;

  it("accepts a JSON object as the <state> body", () => {
    const { spec, errors } = parseMarkup(
      `<exercise><state>{"count":3,"items":[]}</state><prompt>p</prompt>${STAGE}</exercise>`,
    );
    expect(errors).toEqual([]);
    expect(spec!.state).toEqual({ count: 3, items: [] });
  });

  it("still accepts the attribute form of <state>", () => {
    const { spec } = parseMarkup(`<exercise><state count="3"/><prompt>p</prompt>${STAGE}</exercise>`);
    expect(spec!.state).toEqual({ count: 3 });
  });

  it('treats seq="true" the same as a bare seq flag', () => {
    const { spec } = parseMarkup(
      `<exercise><state count="0"/><prompt>p</prompt>` +
        `<on event="tick" seq="true"><set key="count" to="count + 1"/></on>${STAGE}</exercise>`,
    );
    expect(spec!.reactions?.[0]?.allowSequentialWrite).toBe(true);
  });
});
