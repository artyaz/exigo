#!/usr/bin/env node
/**
 * Static discrimination bench for ux-review (AC-06 / C-001-can-01).
 * Detects MECHANICAL-* planted defects from HTML source when the render
 * bridge is absent. PERCEPTUAL rows are recorded as SKIPPED (not misses).
 * A "partial" still counts as a MISS per LOOP.md §3.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** @typedef {{ id: number, name: string, class: string, detect: (html: string) => 'hit'|'miss'|'skip' }} Rule */

/** @type {Rule[]} */
export const RULES = [
  {
    id: 1,
    name: "text at ~1.9:1 contrast (.lowcontrast)",
    class: "PERCEPTUAL-PIXELS",
    detect: () => "skip", // needs screenshot; bridge absent
  },
  {
    id: 2,
    name: "text at ~1.1:1 contrast (.ghost)",
    class: "PERCEPTUAL-PIXELS",
    detect: () => "skip",
  },
  {
    id: 3,
    name: "heading order h1 → h4 skip",
    class: "MECHANICAL-DOM",
    detect: (html) => {
      const headings = [...html.matchAll(/<h([1-6])\b/gi)].map((m) => Number(m[1]));
      for (let i = 1; i < headings.length; i++) {
        const curr = headings[i];
        const prev = headings[i - 1];
        if (curr !== undefined && prev !== undefined && curr > prev + 1) return "hit";
      }
      return "miss";
    },
  },
  {
    id: 4,
    name: "<img> with no alt",
    class: "MECHANICAL-DOM",
    detect: (html) => {
      const imgs = [...html.matchAll(/<img\b([^>]*)>/gi)];
      for (const m of imgs) {
        const attrs = m[1] ?? "";
        if (!/\balt\s*=/i.test(attrs)) return "hit";
      }
      return "miss";
    },
  },
  {
    id: 5,
    name: "<input> with no <label for> / aria-label",
    class: "MECHANICAL-DOM",
    detect: (html) => {
      const inputs = [...html.matchAll(/<input\b([^>]*)>/gi)];
      for (const m of inputs) {
        const attrs = m[1] ?? "";
        const inputIndex = m.index ?? 0;
        if (/\btype\s*=\s*["']hidden["']/i.test(attrs)) continue;
        if (/\baria-label\s*=/i.test(attrs) || /\baria-labelledby\s*=/i.test(attrs)) continue;
        const idMatch = attrs.match(/\bid\s*=\s*["']([^"']+)["']/i);
        if (idMatch) {
          const id = idMatch[1];
          const labelRe = new RegExp(`<label\\b[^>]*\\bfor\\s*=\\s*["']${id}["']`, "i");
          if (labelRe.test(html)) continue;
        }
        // wrapping <label>…<input>…</label> — only the label that contains THIS input
        const before = html.slice(0, inputIndex);
        const opens = [...before.matchAll(/<label\b[^>]*>/gi)];
        const lastOpen = opens[opens.length - 1];
        const openIdx = lastOpen ? (lastOpen.index ?? -1) : -1;
        if (openIdx !== -1) {
          const closes = [...before.matchAll(/<\/label\s*>/gi)];
          const lastClose = closes[closes.length - 1];
          const closeBefore = lastClose ? (lastClose.index ?? -1) : -1;
          if (closeBefore < openIdx) {
            const afterOpen = html.slice(openIdx);
            const closeMatch = /<\/label\s*>/i.exec(afterOpen);
            const inputEnd = inputIndex + m[0].length;
            if (closeMatch && openIdx + (closeMatch.index ?? 0) > inputEnd) continue;
          }
        }
        return "hit";
      }
      return "miss";
    },
  },
  {
    id: 6,
    name: "hit target < 24px (.tiny 14px)",
    class: "MECHANICAL-CSS",
    detect: (html) => {
      // Derive from declared CSS only (AC-02). Flag if width OR height is under 24px.
      /** @param {string} block */
      const under24 = (block) => {
        const dimensions = [...block.matchAll(
          /(?:^|[;{\s])(width|height)\s*:\s*(\d+(?:\.\d+)?)px\b/gi,
        )];
        return dimensions.some((match) => Number(match[2]) < 24);
      };
      const tinyClass = /\.tiny\s*\{([^}]*)\}/i.exec(html);
      if (tinyClass && under24(tinyClass[1] ?? "")) return "hit";
      const inlines = [...html.matchAll(/style\s*=\s*["']([^"']*)["']/gi)];
      for (const m of inlines) {
        if (under24(m[1] ?? "")) return "hit";
      }
      return "miss";
    },
  },
  {
    id: 7,
    name: "<div onclick> as button",
    class: "MECHANICAL-DOM",
    detect: (html) => (/<div\b[^>]*\bonclick\s*=/i.test(html) ? "hit" : "miss"),
  },
  {
    id: 8,
    name: 'non-descriptive link "click here"',
    class: "A11Y-TREE", // name check; static text is the proxy without Observe
    detect: (html) => {
      const links = [...html.matchAll(/<a\b[^>]*>([^<]*)<\/a>/gi)];
      const bad = /^(click here|here|more|read more|link)$/i;
      return links.some((m) => bad.test((m[1] ?? "").trim())) ? "hit" : "miss";
    },
  },
];

/**
 * @param {string} label
 * @param {string} html
 * @param {boolean} expectFindings
 */
export function runArm(label, html, expectFindings) {
  /** @type {Array<{id:number,name:string,class:string,result:string}>} */
  const rows = [];
  let hits = 0;
  let misses = 0;
  let skips = 0;
  for (const rule of RULES) {
    const result = rule.detect(html);
    rows.push({ id: rule.id, name: rule.name, class: rule.class, result });
    if (result === "hit") hits++;
    else if (result === "miss") misses++;
    else skips++;
  }
  let pass;
  if (expectFindings) {
    const mech = rows.filter((r) => r.class !== "PERCEPTUAL-PIXELS");
    const mechMisses = mech.filter((r) => r.result === "miss");
    pass = mechMisses.length === 0 && mech.every((r) => r.result === "hit");
  } else {
    pass = hits === 0;
  }
  return { label, hits, misses, skips, false_positives: expectFindings ? 0 : hits, pass, rows };
}

/**
 * @param {string} runRoot
 */
export function runBench(runRoot) {
  const plantedPath = path.join(runRoot, "bench/planted.html");
  const cleanPath = path.join(runRoot, "bench/clean.html");
  const planted = fs.readFileSync(plantedPath, "utf8");
  const clean = fs.readFileSync(cleanPath, "utf8");
  const plantedArm = runArm("planted", planted, true);
  const cleanArm = runArm("clean", clean, false);
  return {
    generated_at: new Date().toISOString(),
    mode: "static-source-only",
    bridge: "absent",
    note: "PERCEPTUAL-PIXELS rows skipped (AC-04). Mechanical + A11Y-text rules run from HTML source. A clean-arm hit is a bench failure.",
    planted: plantedArm,
    clean: cleanArm,
    bench_pass: plantedArm.pass && cleanArm.pass,
    bench_planted_pass: plantedArm.pass,
    bench_clean_fp_count: cleanArm.false_positives,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const RUN = process.argv[2] ?? "agents/ux-review/runs/2026-08-07-U001";
  const report = runBench(RUN);
  const out = path.join(RUN, "bench/report.json");
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({
    bench_pass: report.bench_pass,
    planted_pass: report.planted.pass,
    clean_fp: report.clean.false_positives,
    planted_hits: report.planted.hits,
    planted_skips: report.planted.skips,
  }, null, 2));
  process.exit(report.bench_pass ? 0 : 1);
}
