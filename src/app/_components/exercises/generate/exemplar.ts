/* The canonical worked example the constructor adapts. A weak model copies a
   complete example far more reliably than it composes from a grammar — and
   showing ONE full, valid markup exercise (rather than a JSON skeleton it must
   translate) is what kills the JSON-back-translation and HTML-contamination
   failure modes. Every structural decision a model tends to get wrong is made
   correctly here, so the shape itself teaches:
     • prose is markdown text (**bold**, `code`) — never nested HTML tags
     • state is attributes — never a JSON blob
     • a reaction is <on> with <set> children — never a `do=` attribute
     • <ok>/<no> live INSIDE <goal>; a region's label is its inner text
     • code is real, runnable text between <locked>/<edit>
   It is pinned valid by exemplar.test.ts — a broken example would teach broken
   output, so it must always parse + validate. */
export const MARKUP_EXEMPLAR = `<exercise accent="azure">
  <prompt>
    A \`monotonic_buffer_resource\` bumps a pointer and **never frees**. Keep
    every allocation inside the **128 B buffer** so nothing spills to the heap.
  </prompt>

  <think>A monotonic buffer is often faster than a general allocator despite never reclaiming. When is "waste memory, never free" the right trade — and when would it bite you?</think>

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
      // Reserve the final size once so the doubling churn never spills.
      reserve("data", 128);
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
</exercise>`;

/* The DEFAULT shape: a fully interactive exercise with NO code. The learner
   acts through <controls> (tap a button), reactions fold the event into the
   model, the stage shows the result, the evaluator scores it. This is what
   most exercises look like — sales, biology, history, language — anything that
   isn't literally about programming. The model should reach for THIS first and
   only add <code> when the concept is writing/running code. Pinned valid by
   exemplar.test.ts. */
export const NOCODE_EXEMPLAR = `<exercise accent="violet">
  <prompt>
    Each pitch is a **hard sale** (urgency, pressure) or a **soft sale**
    (questions, trust). Send every pitch to the right bucket.
  </prompt>

  <think>Both hard and soft sells can close a deal — what about the customer in front of you decides which one builds trust instead of resistance?</think>

  <state texts='["Buy now — only 2 left!", "What are you hoping to improve?", "This price ends at midnight.", "Tell me about your team."]' answers='["hard", "soft", "hard", "soft"]' i="0" correct="0" blocks="[]"/>

  <on event="answer" when="i < len(texts)" seq>
    <set key="blocks" to='push(blocks, record("id", i, "label", at(texts, i), "region", event.choice))'/>
    <set key="correct" to='correct + if(event.choice == at(answers, i), 1, 0)'/>
    <set key="i" to="i + 1"/>
  </on>
  <on event="play:reset" seq>
    <set key="blocks" to="[]"/>
    <set key="i" to="0"/>
    <set key="correct" to="0"/>
  </on>

  <controls>
    <button event="answer" choice='"hard"' disabledWhen="i >= len(texts)">This is a hard sale</button>
    <button event="answer" choice='"soft"' disabledWhen="i >= len(texts)">This is a soft sale</button>
  </controls>

  <arena label="Pitch classifier">
    <region id="hard" tone="amber">hard sale</region>
    <region id="soft" tone="emerald">soft sale</region>
    <blocks bind="blocks"/>
  </arena>

  <readout label="now classifying" value="at(texts, i)"/>
  <readout label="correct" value='concat(correct, " / ", len(texts))'/>

  <goal when="i >= len(texts) and correct == len(texts)" proximity="correct / len(texts)">
    <ok>Every pitch placed right. Hard sells push, soft sells pull — and the customer's readiness tells you which one lands.</ok>
    <no>Keep going — match each pitch to the tactic it uses. Urgency and scarcity are hard; open questions and rapport are soft.</no>
  </goal>
</exercise>`;
