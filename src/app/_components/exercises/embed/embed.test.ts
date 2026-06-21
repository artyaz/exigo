import { describe, it, expect } from "vitest";
import { buildEmbedDoc, DESIGN_SYSTEM, EMBED_WINDOW, STAGE_IMPORT_MAP } from "./runtime";
import { extractEmbedHtml } from "./constructor";

describe("buildEmbedDoc", () => {
  const doc = buildEmbedDoc('<div id="x">hi</div>');

  it("wraps the body in a stage that fills the fixed window and scrolls inside", () => {
    expect(doc.startsWith("<!doctype html>")).toBe(true);
    expect(doc).toContain('<main class="exg-stage"><div id="x">hi</div></main>');
    expect(doc).toContain(".exg-stage{ height:100%; overflow:auto");
    expect(EMBED_WINDOW).toEqual({ width: 720, height: 600 });
  });

  it("preloads the library stage (Tailwind, import map, UMD globals)", () => {
    expect(doc).toContain("cdn.tailwindcss.com");
    expect(doc).toContain('<script type="importmap">');
    expect(doc).toContain(STAGE_IMPORT_MAP.imports.motion);
    expect(doc).toContain("gsap");
    expect(doc).toContain("canvas-confetti");
  });

  it("injects the Exigo design tokens so exercises can attune via var(--…)", () => {
    expect(doc).toContain("--accent:#34d399");
    expect(doc).toContain("--ink:");
    expect(doc).toContain("--spring:");
    expect(doc).toContain("--bg:#000"); // black canvas
    expect(doc).toContain("prefers-reduced-motion");
  });

  it("injects the host bridge (the only contract) after the body, with no height resizing", () => {
    expect(doc).toContain("window.Exigo");
    expect(doc).toContain('post("complete"');
    expect(doc).not.toContain('post("height"'); // fixed window — exercise can't resize it
    expect(doc.indexOf('<div id="x">hi</div>')).toBeLessThan(doc.indexOf("window.Exigo"));
  });
});

describe("DESIGN_SYSTEM (prompt-facing visual brief)", () => {
  it("names the fixed window, accent, opacity hierarchy, and spring motion", () => {
    expect(DESIGN_SYSTEM).toMatch(/var\(--accent\)/);
    expect(DESIGN_SYSTEM).toMatch(/var\(--ink\)/);
    expect(DESIGN_SYSTEM).toMatch(/spring/i);
    expect(DESIGN_SYSTEM).toMatch(/WINDOW/);
    expect(DESIGN_SYSTEM).toMatch(/CANNOT change its size/i);
    expect(DESIGN_SYSTEM).toMatch(/BLACK/);
    expect(DESIGN_SYSTEM).toMatch(/NEVER grow/);
  });
});

describe("extractEmbedHtml", () => {
  it("splits the brainstorm plan from the fenced html", () => {
    const { plan, html } = extractEmbedHtml("I'll use a slider sim because it's tactile.\n```html\n<section>go</section>\n```");
    expect(plan).toContain("slider sim");
    expect(html).toBe("<section>go</section>");
  });

  it("falls back to the first tag when unfenced", () => {
    const { plan, html } = extractEmbedHtml("Plan here.\n<main>x</main>");
    expect(plan).toBe("Plan here.");
    expect(html).toBe("<main>x</main>");
  });

  it("returns empty html when there is no markup", () => {
    expect(extractEmbedHtml("sorry, I cannot").html).toBe("");
  });
});
