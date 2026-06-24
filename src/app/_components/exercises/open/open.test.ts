/* The open path hands the model full scripting freedom, so there's little to
   validate — but the two seams that must hold are: pulling the authored HTML
   out of the model's reply (design rationale vs. the ```html block), and
   assembling the sandbox document with the toolkit injected. */
import { describe, it, expect } from "vitest";
import { extractOpenHtml } from "./constructor";
import { buildOpenDoc, TOOLKIT_CSS, TOOLKIT_JS } from "./toolkit";

describe("extractOpenHtml", () => {
  it("splits the design rationale from the fenced HTML", () => {
    const raw = "I chose a slider simulator because margin is abstract.\n```html\n<div class=\"x-stack\">hi</div>\n```";
    const { plan, html } = extractOpenHtml(raw);
    expect(plan).toContain("slider simulator");
    expect(html).toBe('<div class="x-stack">hi</div>');
  });

  it("falls back to the first tag when there is no fence", () => {
    const { plan, html } = extractOpenHtml("Plan text.\n<section>x</section>");
    expect(plan).toBe("Plan text.");
    expect(html).toBe("<section>x</section>");
  });
});

describe("buildOpenDoc", () => {
  it("wraps the fragment in a full document with the toolkit injected", () => {
    const doc = buildOpenDoc("<div id=card>hi</div>");
    expect(doc.startsWith("<!doctype html>")).toBe(true);
    expect(doc).toContain("<div id=card>hi</div>");
    expect(doc).toContain(TOOLKIT_JS); // the Exigo runtime is present
    expect(doc).toContain("window.Exigo"); // and exposes the API
  });

  it("bounds authored content to a centered measure (no edge-to-edge stretch)", () => {
    const doc = buildOpenDoc("<div id=card>hi</div>");
    // The fragment is wrapped in the bounded column, not dropped raw on <body>.
    expect(doc).toContain('<div class="x-root"><div id=card>hi</div></div>');
    // …and that column is capped + centered.
    expect(TOOLKIT_CSS).toMatch(/\.x-root\{[^}]*max-width:\s*640px/);
    expect(TOOLKIT_CSS).toMatch(/\.x-root\{[^}]*margin:\s*0 auto/);
  });

  it("caps authored media so charts/images never overflow the measure", () => {
    // The exact failure in the screenshots: a 900px chart stretching the frame.
    expect(TOOLKIT_CSS).toMatch(/img,\s*svg,\s*canvas,\s*video\{[^}]*max-width:\s*100%/);
    // In-SVG text has a legible default so labels can't balloon when stretched.
    expect(TOOLKIT_CSS).toMatch(/svg text\{[^}]*font-size:\s*12px/);
  });

  it("gives interactive elements keyboard-focus + disabled states", () => {
    // Crafted feel + a11y: keyboard users see focus, disabled buttons read dead.
    expect(TOOLKIT_CSS).toContain(":focus-visible");
    expect(TOOLKIT_CSS).toMatch(/\.x-btn:disabled[^{]*\{[^}]*cursor:\s*not-allowed/);
  });

  it("disables the entrance animation under prefers-reduced-motion", () => {
    // Motion-sensitive users get a calm render; the .x-pop pop is neutralized.
    expect(TOOLKIT_CSS).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\{[\s\S]*?\.x-pop\{\s*animation:\s*none/,
    );
  });

  it("nests real-shaped content (wide chart, long labels) inside the bounded measure", () => {
    // The shapes that clipped/stretched in the original screenshots: an over-wide
    // chart and a card with a long, unbroken label.
    const fragment =
      '<div class="x-stack">' +
      '<svg width="900" viewBox="0 0 900 400"><text>Ideal adaptive curve over the whole conversation</text></svg>' +
      '<div class="x-card">Email: Your cart is waiting — complete checkout before the discount expires tonight</div>' +
      "</div>";
    const doc = buildOpenDoc(fragment);
    // The whole fragment is nested in the 640px column — the 900px chart can't escape it.
    expect(doc).toContain('<div class="x-root">' + fragment + "</div>");
    // The ASSEMBLED doc (not just the exported constant) actually carries the caps,
    // so what ships to the sandbox is bounded end-to-end.
    const style = doc.slice(doc.indexOf("<style>"), doc.indexOf("</style>"));
    expect(style).toMatch(/\.x-root\{[^}]*max-width:\s*640px/);
    expect(style).toMatch(/img,\s*svg,\s*canvas,\s*video\{[^}]*max-width:\s*100%/);
  });
});
