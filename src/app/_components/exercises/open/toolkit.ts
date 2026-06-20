/* ═══════════════════════════════════════════════════════════════════
   Open exercise toolkit.

   The model authors an exercise as a self-contained HTML fragment with its
   own logic — drag, branching, sliders, whatever the concept needs. We
   don't constrain the logic; we hand it a sandbox and a small toolkit:
     • a consistent design system (CSS variables + base component classes)
     • a robust pointer/touch drag engine (the one genuinely-hard primitive)
     • an `Exigo` API to report completion/progress and hold state
   Built-ins are a convenience, not a cage — the AI can ignore them and
   build any component with raw HTML/CSS/SVG/canvas + script.

   It runs inside a sandboxed iframe (allow-scripts, opaque origin), so the
   AI's script can't touch the host app, the network, or storage. The only
   channel out is postMessage (completion/progress/height).
   ═══════════════════════════════════════════════════════════════════ */

/** Design system + base component classes available to authored exercises. */
export const TOOLKIT_CSS = `
:root{
  --bg: transparent; --ink: #e9e9ee; --muted: #9a9aa6;
  --card: #17171c; --card-2: #1d1d23; --line: rgba(255,255,255,.10);
  --accent: #a78bfa; --ok: #34d399; --no: #fb7185; --amber: #fcd34d; --azure: #38bdf8;
  --radius: 14px; --radius-sm: 9px; --ease: cubic-bezier(.2,.8,.2,1);
}
*{ box-sizing:border-box; }
html,body{ margin:0; background:var(--bg); color:var(--ink);
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; font-size:14px; line-height:1.5;
  -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility; }
body{ padding:10px 14px; }
/* Bounded, centered measure so authored content never stretches edge-to-edge
   on a wide host — the single biggest lever for a hand-crafted feel. */
.x-root{ max-width:640px; margin:0 auto; }
/* Media never overflows the measure; long words wrap instead of clipping. */
img,svg,canvas,video{ max-width:100%; height:auto; }
svg{ display:block; }
p,h1,h2,h3,h4,li,.x-prompt,.x-muted{ overflow-wrap:anywhere; }
/* Default in-SVG text to a legible size so authored charts never balloon
   (an explicit font-size attribute on the element still wins). */
svg text{ font-size:12px; }
.x-stack{ display:flex; flex-direction:column; gap:12px; }
.x-row{ display:flex; gap:10px; flex-wrap:wrap; }
.x-grid{ display:grid; gap:10px; }
.x-h{ font-size:17px; font-weight:600; line-height:1.3; color:#fff; margin:0; letter-spacing:-.01em; }
.x-prompt{ font-size:15px; color:#fff; line-height:1.55; margin:0; }
.x-muted{ color:var(--muted); font-size:12.5px; line-height:1.5; }
.x-card{ background:var(--card); border:1px solid var(--line); border-radius:var(--radius-sm);
  padding:11px 13px; color:var(--ink); transition:transform .18s var(--ease), border-color .18s var(--ease), background .18s var(--ease); }
.x-card:hover{ border-color:rgba(255,255,255,.2); }
.x-btn{ font:inherit; cursor:pointer; padding:9px 16px; border-radius:999px; color:var(--ink);
  background:rgba(255,255,255,.05); border:1px solid var(--line); transition:all .16s var(--ease); }
.x-btn:hover{ background:rgba(255,255,255,.1); }
.x-btn:active{ transform:scale(.97); }
.x-btn:disabled,.x-btn[disabled],.x-btn[aria-disabled="true"]{ opacity:.45; cursor:not-allowed; pointer-events:none; }
.x-btn--accent{ background:rgba(167,139,250,.16); border-color:rgba(167,139,250,.45); color:#c4b5fd; }
/* Keyboard focus is visible for every interactive element (a11y + crafted feel),
   matching the markup path. :focus-visible only shows for keyboard users. */
.x-btn:focus-visible,.x-card:focus-visible,.x-bucket:focus-visible,[tabindex]:focus-visible{
  outline:2px solid var(--accent); outline-offset:2px; }
@media (prefers-reduced-motion: reduce){ .x-btn:active{ transform:none; } .x-pop{ animation:none; } }
.x-bucket{ flex:1; min-width:120px; min-height:90px; border-radius:var(--radius);
  border:1.5px dashed var(--line); padding:10px; display:flex; flex-direction:column; gap:8px;
  transition:border-color .16s var(--ease), background .16s var(--ease); }
.x-bucket__title{ font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); }
.x-dropzone.x-over{ border-color:var(--accent); background:rgba(167,139,250,.08); }
.x-draggable{ cursor:grab; user-select:none; -webkit-user-select:none; }
.x-draggable:active{ cursor:grabbing; }
.x-dragging{ opacity:.92; box-shadow:0 12px 30px rgba(0,0,0,.45); transform:scale(1.03); }
.x-ok{ color:var(--ok); } .x-no{ color:var(--no); }
.x-pop{ animation:xpop .3s var(--ease); } @keyframes xpop{ from{ transform:scale(.9); opacity:0 } to{ transform:scale(1); opacity:1 } }
.x-done{ filter:saturate(1.1); }
`;

/** The `Exigo` runtime injected into the sandbox. Plain JS (runs in-iframe). */
export const TOOLKIT_JS = `
(function(){
  function post(type, data){ try{ parent.postMessage({ __exigo:true, type:type, data:data||{} }, "*"); }catch(e){} }
  var dragging = null, offX = 0, offY = 0, overZone = null;
  function onMove(ev){
    if(!dragging) return;
    dragging.style.position="fixed"; dragging.style.left=(ev.clientX-offX)+"px";
    dragging.style.top=(ev.clientY-offY)+"px"; dragging.style.zIndex="9999"; dragging.style.pointerEvents="none";
    var t = document.elementFromPoint(ev.clientX, ev.clientY);
    var z = t && t.closest ? t.closest(".x-dropzone") : null;
    if(z!==overZone){ if(overZone) overZone.classList.remove("x-over"); overZone=z; if(z) z.classList.add("x-over"); }
  }
  function onUp(ev){
    if(!dragging) return;
    var item = dragging; dragging = null;
    item.classList.remove("x-dragging");
    item.style.position=""; item.style.left=""; item.style.top=""; item.style.zIndex=""; item.style.pointerEvents="";
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    if(overZone){ overZone.classList.remove("x-over"); var z=overZone; overZone=null;
      if(z.__onDrop) z.__onDrop(item, z); }
    else { overZone=null; if(item.__onDropOutside) item.__onDropOutside(item); }
  }
  var Exigo = {
    state: {},
    set: function(patch){ if(patch) for(var k in patch) Exigo.state[k]=patch[k]; },
    complete: function(result){ document.body.classList.add("x-done"); post("complete", result||{}); },
    progress: function(value){ post("progress", { value: value }); },
    draggable: function(el, opts){
      opts = opts||{}; el.classList.add("x-draggable"); el.style.touchAction="none";
      if(opts.onDropOutside) el.__onDropOutside = opts.onDropOutside;
      el.addEventListener("pointerdown", function(e){
        e.preventDefault();
        var r = el.getBoundingClientRect(); offX = e.clientX - r.left; offY = e.clientY - r.top;
        dragging = el; el.classList.add("x-dragging");
        document.addEventListener("pointermove", onMove); document.addEventListener("pointerup", onUp);
      });
      return el;
    },
    dropzone: function(el, opts){ opts=opts||{}; el.classList.add("x-dropzone"); el.__onDrop = opts.onDrop; return el; },
    el: function(tag, props){
      var n = document.createElement(tag); props = props||{};
      for(var k in props){ if(k==="class") n.className=props[k]; else if(k==="text") n.textContent=props[k];
        else if(k==="html") n.innerHTML=props[k]; else if(k.slice(0,2)==="on"&&typeof props[k]==="function") n.addEventListener(k.slice(2).toLowerCase(), props[k]);
        else n.setAttribute(k, props[k]); }
      for(var i=2;i<arguments.length;i++){ var c=arguments[i]; if(c==null) continue; n.appendChild(typeof c==="string"?document.createTextNode(c):c); }
      return n;
    }
  };
  window.Exigo = Exigo;
  function reportHeight(){ post("height", { height: Math.ceil(document.documentElement.scrollHeight) }); }
  window.addEventListener("load", reportHeight);
  try{ new ResizeObserver(reportHeight).observe(document.documentElement); }catch(e){ setInterval(reportHeight, 600); }
})();
`;

/** A human/AI-readable description of the toolkit, embedded in the prompt. */
export const TOOLKIT_API = `
You author the exercise as a single self-contained HTML fragment. A sandbox
provides these globally (no imports). You may also write ANY HTML/CSS/SVG/canvas
and your own <script> logic — the toolkit is a convenience, not a limit.

Your fragment renders inside a centered ~640px column (.x-root) — design for
that width, not the full viewport. Media (img/svg/canvas) is capped to 100% and
long words wrap automatically, so nothing clips. Give SVG/canvas an explicit
viewBox/width so charts stay legible, not stretched.

Design classes (use for a consistent look, or style your own):
  .x-stack (vertical), .x-row (horizontal wrap), .x-grid (css grid),
  .x-h (heading ~17px), .x-prompt (lead text), .x-muted (small/secondary),
  .x-card, .x-btn / .x-btn--accent, .x-bucket + .x-bucket__title,
  .x-ok / .x-no (green/red text), .x-pop (entrance animation).
In-SVG <text> defaults to 12px — keep chart labels in this 11–13px range.
CSS variables: --ink --muted --card --line --accent --ok --no --amber --azure.

Exigo API (window.Exigo):
  Exigo.draggable(el, { onDropOutside? })   make an element drag with pointer/touch
  Exigo.dropzone(el, { onDrop(item, zone) })  receive a dragged element
      (give a dropzone the class .x-bucket too for the drop styling)
  Exigo.complete({ correct, score, ... })   tell the host the learner finished
  Exigo.progress(0..1)                      optional progress
  Exigo.el(tag, props, ...children)         tiny element helper (props: class/text/html/onClick…)
  Exigo.state                               a scratch object you own

Call Exigo.complete(...) when the exercise is solved. Use standard DOM events
(onclick, etc.) for taps/branching/sliders. There is no network and no imports.`;

/** Assemble the full sandbox document from an authored HTML fragment. */
export function buildOpenDoc(html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${TOOLKIT_CSS}</style></head><body><div class="x-root">${html}</div><script>${TOOLKIT_JS}</script></body></html>`;
}
