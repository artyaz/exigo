/* ═══════════════════════════════════════════════════════════════════
   Free-HTML embedded exercise — runtime.

   The new direction: a generation agent receives ONLY a description of one
   exercise and writes a complete, self-contained HTML exercise. We impose NO
   design system, NO components, NO playability grammar. We give it three
   things and nothing else:
     1. a curated stage of well-known libraries (loaded from CDN, no build),
     2. a sandbox to run in,
     3. one tiny host bridge so we know when it's done and how tall it is.

   It runs in a sandboxed iframe (`allow-scripts`, opaque origin): the authored
   script can't touch the host app, cookies, or storage. CDN module/script
   loads still work — the sandbox only gates same-origin/storage, not network.
   The only channel back to the host is postMessage.
   ═══════════════════════════════════════════════════════════════════ */

/** Bare-specifier → CDN ESM, so the agent can write `import { animate, spring }
    from "motion"` with no build step. Major-range pinned (jsDelivr resolves the
    latest compatible patch). */
export const STAGE_IMPORT_MAP = {
  imports: {
    motion: "https://cdn.jsdelivr.net/npm/motion@11/+esm",
    "motion/mini": "https://cdn.jsdelivr.net/npm/motion@11/mini/+esm",
    d3: "https://cdn.jsdelivr.net/npm/d3@7/+esm",
  },
} as const;

/** UMD libraries exposed as globals (no import needed). */
export const STAGE_GLOBALS: { src: string; global: string }[] = [
  { src: "https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js", global: "gsap" },
  { src: "https://cdn.jsdelivr.net/npm/canvas-confetti@1/dist/confetti.browser.min.js", global: "confetti" },
];

/** Tailwind Play CDN — utility classes with no build step. */
export const STAGE_TAILWIND = "https://cdn.tailwindcss.com";

/** A plain-language manifest of the stage, embedded in the generation prompt so
    the agent knows exactly what it can reach for. Single source of truth. */
export const STAGE_MANIFEST = `Available in the page (use any, or none — no imports beyond these, no other network):
  • Tailwind CSS — utility classes, already loaded (e.g. class="flex gap-4 ...").
  • Motion (motion.dev, the vanilla Framer Motion): import { animate, spring, scroll } from "motion"
      — springy, hardware-accelerated animation. e.g.
      animate(el, { y: [20, 0], opacity: [0, 1] }, { type: spring, stiffness: 400 })
  • GSAP — global \`gsap\` (timelines, tweens, eases).
  • canvas-confetti — global \`confetti()\` for celebration.
  • d3 — import * as d3 from "d3" (data-driven SVG, optional).
  You may also write any HTML/CSS/SVG/Canvas and your own <script type="module">.`;

/** The Exigo visual language, embedded in the generation prompt so authored
    exercises feel native. These CSS variables are ALREADY defined on :root in
    the sandbox (see TOKENS_CSS) — the agent just uses them. This guides LOOK,
    never interaction (the interaction stays fully free). */
export const DESIGN_SYSTEM = `EXIGO LOOK — match it; restraint is the brief. Every CSS var below is pre-defined on :root — use them, never invent values.

WINDOW — your only canvas is a FIXED 720×600 card-window we own, on a BLACK (#000 / var(--black)) background. You CANNOT change its size, and it must NEVER grow: budget the fixed space up front and lay the whole exercise out to FILL it — use flexbox/grid that distributes into the available height, not a tall stack that overflows. Reserve room for every state (prompt, the interaction, the feedback/reveal) so that text or results appearing later drop into space you already allotted — never pushing the layout or forcing a scroll. Prefer swapping or updating content in place over appending it. Never set a page/body background, 100vw/100vh, position:fixed/:sticky, or your own outer card/border/width/height. One tidy screen on black, never a landing page.

HIERARCHY by opacity, not boxes. Text: var(--ink) primary, var(--muted) secondary, var(--faint) tertiary. Lift a region with var(--raised), recede with var(--sunken); divide with a single hairline var(--line), not borders everywhere. Let whitespace do the grouping — minimal nesting, no heavy panels, no shadows of your own (the card has one).

COLOR — one accent, spent sparingly. var(--accent) (emerald) marks only the live/correct beat. var(--ok)=emerald for success, var(--no)=rose for wrong/violation ONLY — never as decoration. To separate sibling items, cycle the inks var(--azure) → var(--violet) → var(--amber). Never rainbow; one accent per idea.

TYPE. Prose in var(--font-sans): ~15px, line-height ~1.5, weight 500; headings tracked tight (letter-spacing -.01em), weight 600. Labels, metadata, and numbers in var(--font-mono): ~10-11px, UPPERCASE, letter-spacing .16em, var(--muted). For the one figure that matters, a large mono number (~20px, var(--ink)). Comfortable sizes only — never tiny, never truncate; wrap or grow.

SHAPE & DATA. Rounded var(--r-md)/var(--r-lg); pill var(--r-full) for chips and toggles. "Few numbers, much shape": at most ~3 sparse guides, a number only at the point of attention, names written directly ON the data — no legends, axis clutter, frame boxes, or grid meshes. Curves are smooth (bézier), not polylines. An element too small to label stays silent and carries its detail in a title tooltip.

MOTION — alive but quiet. Entrances settle with a spring (var(--spring), or Motion { type: spring }, ~150-280ms); stagger siblings ~40ms apart. Press scales to var(--press); state changes ease ~150-300ms with var(--ease). No looping, auto-play, or parallax. Reduced motion is handled globally — don't override it.

CONTROLS & FEEDBACK. Interactive things show it: cursor pointer, a clear hover (lighten ~6%), :active scale var(--press), a visible :focus-visible ring in var(--accent); disabled is ~.45 opacity with no pointer; hit targets ≥32px. Feedback states the result, never shouts it — var(--ok)/var(--no)/var(--amber) with one plain sentence and a soft pop; reward completion with a settle or glow, not a takeover.

VOICE: calm, editorial, confident, quietly playful — a refined explorable explanation, de-chromed and natural, simple but informative. Tailwind utilities are welcome; pull color from the vars so the result is pixel-identical to the app.`;

/** The host bridge: the ENTIRE contract between an exercise and the app. It is
    not a constraint on the exercise — just the seam that lets the host know the
    learner finished, track progress, size the frame, and see runtime errors. */
export const HOST_BRIDGE = `<script>
(function(){
  function post(type, data){ try{ parent.postMessage({ __exigo:true, type:type, data:data||{} }, "*"); }catch(e){} }
  window.Exigo = {
    complete: function(result){ post("complete", result || {}); },
    progress: function(value){ post("progress", { value: value }); }
  };
  // No height reporting — the window is a fixed size the exercise cannot change.
  window.addEventListener("error", function(e){ post("error", { message: e && e.message ? String(e.message) : "script error" }); });
  window.addEventListener("unhandledrejection", function(e){ post("error", { message: "unhandled rejection: " + (e && e.reason ? String(e.reason) : "") }); });
})();
</script>`;

/* The Exigo design tokens, injected on :root so an authored exercise can speak
   the app's exact visual language with var(--…) — dark-only, white-on-black
   opacity hierarchy, one emerald accent, rose reserved for violations, springy
   motion. (Ported from src/styles/exigo-tokens.css, trimmed to what an exercise
   reaches for.) */
const TOKENS_CSS = `:root{
  color-scheme:dark;
  --font-sans:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  --font-mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  --black:#000; --bg:#000; --surface:#0a0a0a; --raised:#171717; --sunken:#0a0a0a;
  --ink:rgba(255,255,255,.92); --muted:rgba(255,255,255,.55); --faint:rgba(255,255,255,.3);
  --line:rgba(255,255,255,.10); --line-strong:rgba(255,255,255,.15); --line-faint:rgba(255,255,255,.06);
  --accent:#34d399; --accent-soft:rgba(52,211,153,.14);
  --ok:#34d399; --no:#fb7185; --amber:#fbbf24; --azure:#7dd3fc; --violet:#c4b5fd;
  --ink-amber:254 240 138; --ink-azure:191 219 254; --ink-violet:249 168 212; --ink-emerald:187 247 208;
  --r-sm:6px; --r-md:10px; --r-lg:14px; --r-xl:20px; --r-full:9999px;
  --shadow:0 8px 32px -12px rgba(0,0,0,.8);
  --spring:cubic-bezier(.175,.885,.32,1.275); --ease:cubic-bezier(.16,1,.3,1);
  --press:.98;
}`;

/* The exercise lives in a FIXED window — the iframe itself is the card, sized by
   the host (EMBED_WINDOW). The exercise can never change that size: the stage
   fills the window and is the only thing that scrolls. */
const BASE_CSS = `${TOKENS_CSS}
*{box-sizing:border-box}
html,body{margin:0;height:100%}
body{font-family:var(--font-sans);color:var(--ink);background:var(--bg);
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;line-height:1.5;}
.exg-stage{ height:100%; overflow:auto; padding:22px 24px; }
.exg-stage>:first-child{ margin-top:0 } .exg-stage>:last-child{ margin-bottom:0 }
.exg-stage::-webkit-scrollbar{ width:10px } .exg-stage::-webkit-scrollbar-thumb{ background:var(--line-strong); border-radius:var(--r-full); border:3px solid transparent; background-clip:content-box }
img,svg,canvas,video{ max-width:100%; height:auto }
::selection{background:var(--accent-soft)}
@media (prefers-reduced-motion: reduce){*{animation-duration:.001ms!important;transition-duration:.001ms!important}}`;

/** The predetermined window the exercise renders into. The exercise cannot
    change it; content scrolls inside. */
export const EMBED_WINDOW = { width: 720, height: 600 } as const;

/** Assemble the full sandbox document. The agent authors the BODY content
    (markup + its own <style>/<script>); we own the <head> (the library stage)
    and inject the bridge just before </body>. */
export function buildEmbedDoc(bodyHtml: string): string {
  const globals = STAGE_GLOBALS.map((g) => `<script src="${g.src}"></script>`).join("");
  return (
    "<!doctype html><html><head>" +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    `<script src="${STAGE_TAILWIND}"></script>` +
    `<script type="importmap">${JSON.stringify(STAGE_IMPORT_MAP)}</script>` +
    globals +
    `<style>${BASE_CSS}</style>` +
    "</head><body>" +
    '<main class="exg-stage">' +
    bodyHtml +
    "</main>" +
    HOST_BRIDGE +
    "</body></html>"
  );
}
