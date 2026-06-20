import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* Loads AUTHORING.md — the single authoring guide — so the constructor prompt
   and the human-facing docs never diverge. Cached after first read. */

let cached: string | null = null;

export function loadAuthoringGuide(): string {
  if (cached != null) return cached;
  try {
    cached = readFileSync(join(process.cwd(), "src/app/_components/exercises/AUTHORING.md"), "utf8");
  } catch {
    // In environments where the file isn't on disk, fall back to an empty guide;
    // the manifest-derived vocabulary in the prompt still constrains output.
    cached = "";
  }
  return cached;
}
