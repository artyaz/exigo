/* AUTHORING.md is prompt-embedded documentation for generator models — a
   weak AI copies it verbatim, so a vocabulary that drifts from the code
   becomes a factory for invalid specs. These tests pin the doc to the
   runtime-enumerable surfaces. */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { HELPER_NAMES } from "./runtime/helpers";
import { JS_OBSERVATION_SCHEMA, JS_OBSERVATION_SYMBOLS } from "./harness/jsObservationCore";

const doc = readFileSync(fileURLToPath(new URL("./AUTHORING.md", import.meta.url)), "utf8");

describe("AUTHORING.md stays in sync with the runtime", () => {
  it("documents every closed expression helper", () => {
    for (const h of HELPER_NAMES) {
      expect(doc, `helper \`${h}\` missing from AUTHORING.md`).toContain(h);
    }
  });

  it("documents every observation probe and its emitted fields", () => {
    for (const s of JS_OBSERVATION_SYMBOLS) {
      if (s.name === "console") continue;
      expect(doc, `probe \`${s.name}\` missing from AUTHORING.md`).toContain(`${s.name}(`);
    }
    for (const [kind, schema] of Object.entries(JS_OBSERVATION_SCHEMA)) {
      for (const field of Object.keys(schema.fields)) {
        expect(doc, `field \`${field}\` of \`${kind}\` missing from AUTHORING.md`).toContain(field);
      }
    }
  });
});
