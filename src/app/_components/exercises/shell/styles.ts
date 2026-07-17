"use client";
/* Injected-once stylesheet for the exercise runtime. Ported from the
   design system and extended for the reactive display layers. */
import React from "react";

const EX_CSS = `
.exg-ex{
  --ex-rgb: 254 240 138;
  position:relative; font-family:var(--font-sans);
  border-radius:var(--radius-2xl); margin:22px auto; color:var(--white-80);
  max-width:760px;
  isolation:isolate; overflow:hidden;
}
.exg-ex--inset{
  background:radial-gradient(120% 100% at 0% 0%, rgb(var(--ex-rgb) / 0.05), transparent 60%), var(--surface-glass);
  backdrop-filter:blur(var(--blur-card)); -webkit-backdrop-filter:blur(var(--blur-card));
  border:1px solid var(--border); box-shadow:var(--shadow-card);
}
.exg-ex--framed{ background:var(--surface-sunken); border:1px dashed rgb(var(--ex-rgb) / 0.32); box-shadow:var(--shadow-soft); }
.exg-ex--focus{ background:linear-gradient(180deg, var(--neutral-900), var(--neutral-950)); border:1px solid rgb(var(--ex-rgb) / 0.22); box-shadow:var(--shadow-deep), 0 0 60px -28px rgb(var(--ex-rgb) / 0.5); }
.exg-ex__bar{ display:flex; align-items:center; gap:10px; padding:14px 18px 0; }
.exg-ex__tab{ display:inline-flex; align-items:center; gap:7px; white-space:nowrap; flex:none; font-family:var(--font-mono); font-size:10px; font-weight:500; text-transform:uppercase; letter-spacing:0.2em; color:rgb(var(--ex-rgb) / 0.95); }
.exg-ex__tab::before{ content:""; width:6px; height:6px; border-radius:50%; background:rgb(var(--ex-rgb)); box-shadow:0 0 10px rgb(var(--ex-rgb) / 0.7); }
.exg-ex__kind{ margin-left:auto; white-space:nowrap; flex:none; font-family:var(--font-mono); font-size:10px; letter-spacing:0.16em; text-transform:uppercase; color:var(--white-30); }
.exg-ex__prompt{ padding:8px 18px 14px; font-size:16px; line-height:1.55; color:var(--white-90); font-weight:500; letter-spacing:var(--tracking-snug); max-width:62ch; text-wrap:pretty; }
.exg-ex__prompt b, .exg-ex__prompt strong{ color:#fff; font-weight:600; }
.exg-ex__prompt code{ font-family:var(--font-mono); font-size:0.86em; background:var(--white-08); border:1px solid var(--border-faint); padding:0.06em 0.34em; border-radius:var(--radius-sm); color:var(--white-90); }
.exg-ex__body{ padding:0 18px; display:flex; flex-direction:column; gap:12px; }
.exg-ex__foot{ display:flex; align-items:center; gap:14px; padding:14px 18px 16px; min-height:34px; }
.exg-ex__spacer{ flex:1; }
.exg-ex__btn{ display:inline-flex; align-items:center; justify-content:center; gap:8px; font-family:var(--font-sans); font-weight:500; font-size:14px; padding:9px 18px; border-radius:var(--radius-xl); cursor:pointer; border:1px solid transparent; white-space:nowrap; transition:all var(--duration-base) var(--ease-spring); }
.exg-ex__btn:active{ transform:scale(var(--press-scale)); }
.exg-ex__btn--check{ background:#fff; color:#000; }
.exg-ex__btn--check:hover{ opacity:.9; }
.exg-ex__btn--check:disabled{ opacity:.4; pointer-events:none; }
.exg-ex__btn--ghost{ background:var(--white-03); color:var(--white-60); border-color:var(--border); }
.exg-ex__btn--ghost:hover{ background:var(--white-06); color:#fff; }
.exg-ex__fb{ display:inline-flex; align-items:center; gap:8px; font-size:13.5px; font-weight:500; letter-spacing:var(--tracking-snug); opacity:0; transform:translateY(4px); transition:all 260ms var(--ease-spring); }
.exg-ex__fb--show{ opacity:1; transform:none; }
.exg-ex__fb--ok{ color:var(--emerald-400); }
.exg-ex__fb--no{ color:var(--rose-400); }
.exg-ex__fb--hint{ color:var(--amber-400); }
.exg-ex__fb svg{ width:16px; height:16px; }
.exg-ex--solved{ border-color:rgb(52 211 153 / 0.45) !important; }
.exg-ex__burst{ position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:5; }
@keyframes exg-pop{ 0%{transform:scale(.96)} 55%{transform:scale(1.012)} 100%{transform:scale(1)} }
.exg-ex--pop{ animation:exg-pop 460ms var(--ease-spring); }
@media (prefers-reduced-motion: reduce){ .exg-ex--pop{ animation:none; } }
.exg-ex__btn > svg{ width:16px; height:16px; flex:none; }
.exg-ex__prox{ position:absolute; left:0; right:0; top:0; height:2px; overflow:hidden; border-radius:var(--radius-2xl) var(--radius-2xl) 0 0; z-index:6; pointer-events:none; }
.exg-ex__prox > i{ display:block; height:100%; width:0%; background:linear-gradient(90deg, rgb(var(--ex-rgb) / .5), rgb(var(--ex-rgb))); box-shadow:0 0 12px rgb(var(--ex-rgb) / .6); transition:width 320ms var(--ease-spring), background 320ms ease; }
.exg-ex--solved .exg-ex__prox > i{ background:linear-gradient(90deg, var(--emerald-500), var(--emerald-400)); box-shadow:0 0 12px rgb(52 211 153 / .6); }
.exg-ex__hook{ display:flex; gap:9px; align-items:flex-start; margin:14px 18px 0; padding:11px 13px; border-radius:var(--radius-lg); background:rgb(var(--ex-rgb) / .07); border:1px solid rgb(var(--ex-rgb) / .2); }
.exg-ex__hook svg{ width:15px; height:15px; flex:none; margin-top:1px; color:rgb(var(--ex-rgb)); }
.exg-ex__hook span{ font-size:13.5px; line-height:1.5; color:var(--white-80); text-wrap:pretty; }
.exg-ex__hook span b{ color:#fff; font-weight:600; }
.exg-ex__streak{ display:inline-flex; align-items:center; gap:5px; margin-left:auto; font-family:var(--font-mono); font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--amber-400); padding:3px 8px; border-radius:99px; background:rgb(251 191 36 / .1); border:1px solid rgb(251 191 36 / .24); opacity:0; transform:scale(.8); transition:all 300ms var(--ease-spring); }
.exg-ex__streak--show{ opacity:1; transform:none; }
.exg-ex__streak svg{ width:11px; height:11px; }
.exg-ex__kind + .exg-ex__streak{ margin-left:12px; }
`;

const HL_CSS = `
.exg-hl .ws{white-space:pre}
.exg-hl .com{color:var(--white-30); font-style:italic}
.exg-hl .str{color:#86efac}
.exg-hl .num{color:#fdba74}
.exg-hl .kw{color:#f9a8d4}
.exg-hl .type{color:#7dd3fc}
.exg-hl .fn{color:#fde047}
.exg-hl .id{color:var(--white-80)}
.exg-hl .pun{color:var(--white-40)}
.exg-hl .op{color:#c4b5fd}
`;

const DISPLAY_CSS = `
/* generic value text */
.exg-d-text{ font-size:14px; line-height:1.6; color:var(--white-80); }
.exg-d-text--muted{ color:var(--white-40); }
/* state badge */
.exg-badge{ display:inline-flex; flex-direction:column; gap:3px; padding:10px 14px; border-radius:var(--radius-lg); background:var(--surface-sunken); border:1px solid var(--border); align-self:flex-start; }
.exg-badge__lab{ font-family:var(--font-mono); font-size:9px; letter-spacing:.16em; text-transform:uppercase; color:var(--white-30); }
.exg-badge__val{ font-family:var(--font-mono); font-size:20px; color:#fff; }
/* number line */
.exg-nl{ position:relative; height:46px; }
.exg-nl__track{ position:absolute; top:50%; left:0; right:0; height:2px; background:var(--border); }
.exg-nl__dot{ position:absolute; top:50%; width:14px; height:14px; border-radius:50%; transform:translate(-50%,-50%); background:rgb(var(--ex-rgb)); box-shadow:0 0 12px rgb(var(--ex-rgb) / .6); transition:left 320ms var(--ease-spring); }
.exg-nl__ghost{ position:absolute; top:50%; width:14px; height:14px; border-radius:50%; transform:translate(-50%,-50%); border:1.5px dashed var(--white-30); }
/* cards */
.exg-cards{ display:flex; flex-wrap:wrap; gap:8px; }
.exg-card{ padding:8px 12px; border-radius:var(--radius-lg); background:var(--surface-raised); border:1px solid var(--border); font-size:13px; color:var(--white-80); }
/* tape (Turing) */
.exg-tape{ display:flex; gap:4px; overflow-x:auto; padding:6px 0; }
.exg-tape__cell{ flex:none; width:38px; height:42px; display:flex; align-items:center; justify-content:center; border-radius:var(--radius-md); background:var(--surface-sunken); border:1px solid var(--border); font-family:var(--font-mono); font-size:15px; color:var(--white-80); transition:all 240ms var(--ease-spring); }
.exg-tape__cell--head{ border-color:rgb(var(--ex-rgb)); color:#fff; box-shadow:0 0 0 1px rgb(var(--ex-rgb) / .5), 0 0 16px -4px rgb(var(--ex-rgb) / .7); transform:translateY(-3px); }
/* controls */
.exg-controls{ display:flex; flex-wrap:wrap; gap:10px; align-items:center; }
.exg-ctl-btn{ font-family:var(--font-sans); font-weight:500; font-size:13px; padding:8px 14px; border-radius:var(--radius-lg); background:var(--white-03); border:1px solid var(--border); color:var(--white-80); cursor:pointer; transition:all var(--duration-base) var(--ease-spring); }
.exg-ctl-btn:hover{ background:var(--white-08); color:#fff; }
.exg-ctl-btn:active{ transform:scale(var(--press-scale)); }
.exg-ctl-btn:disabled{ opacity:.4; pointer-events:none; }
.exg-ctl-slider{ display:flex; align-items:center; gap:10px; font-size:12px; color:var(--white-50); }
.exg-ctl-slider input{ accent-color:rgb(var(--ex-rgb)); }
/* sequence (structural viz primitive) */
.exg-seq{ display:flex; flex-direction:column; gap:6px; }
.exg-seq__lab{ font-family:var(--font-mono); font-size:9px; letter-spacing:.16em; text-transform:uppercase; color:var(--white-30); }
.exg-seq__track{ display:flex; gap:6px; flex-wrap:wrap; min-height:44px; align-items:flex-end; padding:4px 0; }
.exg-seq--stack .exg-seq__track{ flex-direction:column-reverse; align-items:stretch; }
.exg-seq__empty{ font-family:var(--font-mono); font-size:18px; color:var(--white-20); align-self:center; }
.exg-seq__chip{ display:flex; flex-direction:column; gap:2px; min-width:54px; padding:7px 11px; border-radius:var(--radius-lg); background:rgb(var(--seq-rgb) / .08); border:1px solid rgb(var(--seq-rgb) / .3); opacity:0; transform:translateY(8px) scale(.96); animation:exg-seq-in 360ms var(--ease-spring) forwards; }
@keyframes exg-seq-in{ to{ opacity:1; transform:none; } }
@media (prefers-reduced-motion: reduce){ .exg-seq__chip{ animation:none; opacity:1; transform:none; } }
.exg-seq__chip--cur{ box-shadow:0 0 0 1px rgb(var(--seq-rgb) / .6), 0 0 18px -4px rgb(var(--seq-rgb) / .7); transform:translateY(-3px); }
.exg-seq__idx{ font-family:var(--font-mono); font-size:9px; color:var(--white-30); }
.exg-seq__txt{ font-family:var(--font-mono); font-size:13px; color:#fff; white-space:nowrap; }
/* observation player (transport) */
.exg-play{ display:flex; flex-direction:column; gap:6px; }
.exg-play__lab{ font-family:var(--font-mono); font-size:9px; letter-spacing:.16em; text-transform:uppercase; color:var(--white-30); }
.exg-play__bar{ display:flex; align-items:center; gap:6px; padding:6px 8px; border-radius:var(--radius-lg); background:var(--surface-sunken); border:1px solid var(--border); }
.exg-play__btn{ flex:none; width:28px; height:28px; display:inline-flex; align-items:center; justify-content:center; font-size:11px; border-radius:var(--radius-md); background:var(--white-03); border:1px solid var(--border); color:var(--white-70); cursor:pointer; transition:all var(--duration-base) var(--ease-spring); }
.exg-play__btn:hover:not(:disabled){ background:var(--white-08); color:#fff; }
.exg-play__btn:active:not(:disabled){ transform:scale(var(--press-scale)); }
.exg-play__btn:disabled{ opacity:.3; pointer-events:none; }
.exg-play__btn--play{ background:rgb(var(--ex-rgb) / .12); border-color:rgb(var(--ex-rgb) / .4); color:rgb(var(--ex-rgb)); }
.exg-play__scrub{ flex:1; min-width:60px; accent-color:rgb(var(--ex-rgb)); }
.exg-play__count{ flex:none; font-family:var(--font-mono); font-size:11px; color:var(--white-50); min-width:48px; text-align:right; }
/* diagram scene */
.exg-scene{ width:100%; background:radial-gradient(120% 120% at 50% 0%, rgb(var(--ex-rgb) / 0.04), transparent 55%), var(--neutral-950); border:1px solid var(--border); border-radius:var(--radius-xl); }
/* code probe */
.exg-cp{ display:flex; flex-direction:column; gap:12px; }
.exg-cp__editor{ background:var(--surface-sunken); border:1px solid var(--border); border-radius:var(--radius-xl); overflow:hidden; }
.exg-cp__top{ display:flex; align-items:center; gap:8px; padding:8px 12px; border-bottom:1px solid var(--border-faint); font-family:var(--font-mono); font-size:10px; letter-spacing:.16em; text-transform:uppercase; color:var(--white-30); }
.exg-cp__lang{ margin-left:auto; color:rgb(var(--ex-rgb)); }
.exg-cp__code{ margin:0; padding:14px 16px; font-family:var(--font-mono); font-size:13px; line-height:1.7; white-space:pre-wrap; word-break:break-word; }
.exg-cp__locked{ color:var(--white-50); }
.exg-cp__seg-text{ display:inline-block; min-width:60px; padding:1px 7px; margin:0 1px; border-radius:var(--radius-sm); background:var(--neutral-900); border:1px solid var(--border-strong); color:#fff; font-family:var(--font-mono); font-size:13px; outline:none; }
.exg-cp__seg-text:focus{ border-color:rgb(var(--ex-rgb)); box-shadow:0 0 0 2px rgb(var(--ex-rgb) / .25); }
.exg-cp__seg-choice{ padding:2px 9px; margin:0 1px; border-radius:var(--radius-sm); background:var(--neutral-900); border:1px solid var(--border-strong); color:#fff; font-family:var(--font-mono); font-size:13px; cursor:pointer; }
.exg-cp__seg-choice:focus-visible{ border-color:rgb(var(--ex-rgb)); box-shadow:0 0 0 2px rgb(var(--ex-rgb) / .25); outline:none; }
/* symbol autocomplete (observation-harness IDE) */
.exg-cp__hole{ position:relative; display:inline-block; }
.exg-cp__ac{ position:absolute; top:calc(100% + 4px); left:0; z-index:30; min-width:200px; max-width:340px; display:flex; flex-direction:column; padding:4px; background:var(--neutral-950); border:1px solid var(--border-strong); border-radius:var(--radius-lg); box-shadow:0 14px 36px rgb(0 0 0 / .5); }
.exg-cp__ac-item{ display:flex; flex-direction:column; gap:2px; padding:5px 8px; border-radius:var(--radius-sm); cursor:pointer; }
.exg-cp__ac-item--on{ background:rgb(var(--ex-rgb) / .16); }
.exg-cp__ac-name{ font-family:var(--font-mono); font-size:12px; color:var(--white-85); }
.exg-cp__ac-doc{ font-size:10.5px; color:var(--white-40); line-height:1.4; }
/* full free-text code editor (IDE) */
.exg-ed{ position:relative; background:var(--neutral-950); border:1px solid var(--border-strong); border-radius:var(--radius-lg); }
.exg-ed--ro{ opacity:.85; }
.exg-ed:focus-within{ border-color:rgb(var(--ex-rgb) / .5); box-shadow:0 0 0 2px rgb(var(--ex-rgb) / .18); }
.exg-ed__ruler{ position:absolute; visibility:hidden; pointer-events:none; top:0; left:0; white-space:pre; font-family:var(--font-mono); font-size:13px; line-height:1.6; }
.exg-ed__scroll{ position:relative; }
.exg-ed__hl{ position:absolute; inset:0; margin:0; padding:12px 14px; overflow:hidden; pointer-events:none; z-index:1; font-family:var(--font-mono); font-size:13px; line-height:1.6; white-space:pre; color:var(--white-85); }
.exg-ed__hl .exg-hl{ white-space:pre; }
.exg-ed__ta{ position:relative; display:block; width:100%; margin:0; padding:12px 14px; z-index:2; resize:none; border:0; outline:none; background:transparent; color:transparent; caret-color:rgb(var(--ex-rgb)); font-family:var(--font-mono); font-size:13px; line-height:1.6; white-space:pre; overflow:auto; tab-size:2; }
.exg-ed__ta::placeholder{ color:var(--white-30); }
.exg-ed__ta::selection{ background:rgb(var(--ex-rgb) / .28); }
.exg-ed__lang{ position:absolute; top:6px; right:10px; z-index:3; pointer-events:none; font-family:var(--font-mono); font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:var(--white-30); }
.exg-ed__ac{ position:absolute; z-index:40; min-width:200px; max-width:340px; display:flex; flex-direction:column; padding:4px; background:var(--neutral-950); border:1px solid var(--border-strong); border-radius:var(--radius-lg); box-shadow:0 14px 36px rgb(0 0 0 / .5); }
/* free-text region stack */
.exg-cp__regions{ display:flex; flex-direction:column; gap:6px; padding:10px; }
.exg-cp__locked-block{ margin:0; padding:8px 14px; border-radius:var(--radius-md); background:var(--surface-sunken); border-left:2px solid var(--border-strong); font-family:var(--font-mono); font-size:13px; line-height:1.6; white-space:pre-wrap; color:var(--white-50); }
.exg-cp__trace{ display:flex; flex-direction:column; gap:8px; }
.exg-cp__row{ display:flex; gap:10px; align-items:stretch; opacity:0; transform:translateY(8px); animation:exg-row-in 380ms var(--ease-spring) forwards; }
@keyframes exg-row-in{ to{ opacity:1; transform:none; } }
@media (prefers-reduced-motion: reduce){ .exg-cp__row{ animation:none; opacity:1; transform:none; } }
.exg-cp__lab{ font-family:var(--font-mono); font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--white-40); padding-top:9px; width:64px; flex:none; text-align:right; }
.exg-cp__card{ flex:1; background:var(--neutral-900); border:1px solid var(--border); border-radius:var(--radius-lg); padding:9px 12px; min-width:0; }
.exg-cp__card--out{ border-color:rgb(52 211 153 / .4); background:rgb(52 211 153 / .06); }
.exg-cp__card--err{ border-color:rgb(251 113 133 / .4); background:rgb(251 113 133 / .06); }
.exg-cp__ctext{ font-family:var(--font-mono); font-size:12.5px; color:var(--white-85); white-space:pre-wrap; word-break:break-word; }
.exg-cp__note{ margin-top:4px; font-size:11px; color:var(--white-40); line-height:1.5; }
.exg-cp__log{ font-family:var(--font-mono); font-size:11.5px; color:var(--white-50); white-space:pre-wrap; }
/* arena — region/block semantic primitive */
.exg-arena{ display:flex; flex-direction:column; gap:8px; }
.exg-arena__lab{ font-family:var(--font-mono); font-size:10px; letter-spacing:.16em; text-transform:uppercase; color:var(--white-40); }
.exg-arena__body{ position:relative; display:flex; flex-wrap:wrap; gap:14px; align-items:flex-start; }
.exg-arena__region{ flex:1 1 200px; min-width:160px; box-sizing:border-box; padding:10px 12px 11px; background:var(--neutral-900); border:1px solid rgb(var(--reg-rgb) / .35); border-radius:var(--radius-lg); }
.exg-arena__region--open{ border-style:dashed; background:var(--surface-sunken); }
.exg-arena__region--over{ border-color:rgb(251 113 133 / .7); box-shadow:0 0 0 1px rgb(251 113 133 / .4); }
.exg-arena__head{ display:flex; justify-content:space-between; align-items:baseline; gap:8px; margin-bottom:7px; }
.exg-arena__name{ font-family:var(--font-mono); font-size:11.5px; color:var(--white-85); }
.exg-arena__meta{ font-family:var(--font-mono); font-size:10.5px; color:var(--white-50); white-space:nowrap; }
.exg-arena__gauge{ height:4px; border-radius:999px; background:rgb(255 255 255 / .07); overflow:hidden; margin-bottom:9px; }
.exg-arena__gaugefill{ height:100%; border-radius:999px; background:rgb(var(--reg-rgb) / .85); transition:width 320ms var(--ease-spring); }
.exg-arena__slots{ display:flex; flex-wrap:wrap; gap:5px; align-content:flex-start; min-height:32px; }
.exg-arena__block{ box-sizing:border-box; height:29px; padding:2px 7px; display:flex; align-items:center; justify-content:center; overflow:hidden; border-radius:var(--radius-md); background:rgb(var(--blk-rgb) / .16); border:1px solid rgb(var(--blk-rgb) / .5); opacity:0; transform:translateY(6px) scale(.94); animation:exg-blk-in 320ms var(--ease-spring) forwards; }
@keyframes exg-blk-in{ to{ opacity:1; transform:none; } }
@media (prefers-reduced-motion: reduce){ .exg-arena__block{ animation:none; opacity:1; transform:none; } }
.exg-arena__blk-lab{ font-family:var(--font-mono); font-size:10.5px; color:rgb(var(--blk-rgb)); line-height:1.1; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
/* chip mode: uniform-size blocks are text labels, not proportional bars — size to
   content and wrap the full label instead of truncating it ("Limit…" → "Limited time"). */
.exg-arena__block--chip{ width:auto; max-width:100%; height:auto; min-height:29px; padding:5px 9px; }
.exg-arena__block--chip .exg-arena__blk-lab{ white-space:normal; overflow:visible; text-overflow:clip; line-height:1.3; }
.exg-arena__empty{ font-family:var(--font-mono); font-size:10px; color:var(--white-30); font-style:italic; align-self:center; }
.exg-arena__arrows{ position:absolute; inset:0; width:100%; height:100%; overflow:visible; pointer-events:none; z-index:6; }
.exg-arena__spill{ fill:none; stroke:rgb(251 113 133 / .85); stroke-width:2; stroke-linecap:round; stroke-dasharray:5 4; animation:exg-arena-dash 600ms linear infinite; }
@keyframes exg-arena-dash{ to{ stroke-dashoffset:-18; } }
@media (prefers-reduced-motion: reduce){ .exg-arena__spill{ animation:none; } }
.exg-arena__spill-lab{ font-family:var(--font-mono); font-size:9.5px; letter-spacing:.03em; fill:rgb(251 113 133 / .95); paint-order:stroke; stroke:var(--neutral-950); stroke-width:3px; stroke-linejoin:round; }
/* plot — cartesian semantic primitive, editorial voice: no frame, no grid
   mesh, no legend. Whisper guides, smooth curves, names on the data. */
.exg-plot{ display:flex; flex-direction:column; gap:6px; }
.exg-plot__lab{ font-family:var(--font-mono); font-size:10px; letter-spacing:.16em; text-transform:uppercase; color:var(--white-40); }
.exg-plot__svg{ width:100%; max-width:560px; margin-inline:auto; height:auto; display:block; overflow:visible; }
.exg-plot__guide{ stroke:rgb(255 255 255 / .06); stroke-width:1; }
.exg-plot__base{ stroke:rgb(255 255 255 / .18); stroke-width:1; stroke-linecap:round; }
.exg-plot__tick{ font-family:var(--font-mono); font-size:8px; fill:var(--white-30); }
.exg-plot__corner{ font-family:var(--font-mono); font-size:8.5px; letter-spacing:.05em; fill:var(--white-40); }
.exg-plot__line{ fill:none; stroke-width:2.2; stroke-linejoin:round; stroke-linecap:round; }
.exg-plot__line--draw{ stroke-dasharray:1; stroke-dashoffset:1; animation:exg-plot-draw 750ms cubic-bezier(.3,.7,.3,1) forwards; }
@keyframes exg-plot-draw{ to{ stroke-dashoffset:0; } }
.exg-plot__line--ghost{ stroke-dasharray:5 4; opacity:.6; }
.exg-plot__fill{ stroke:none; animation:exg-plot-fade 600ms ease-out; }
@keyframes exg-plot-fade{ from{ opacity:0; } }
.exg-plot__bar{ stroke:none; transform-box:fill-box; transform-origin:center bottom; animation:exg-plot-grow 420ms var(--ease-spring) backwards; }
@keyframes exg-plot-grow{ from{ transform:scaleY(.1); opacity:0; } }
.exg-plot__dot{ stroke:var(--neutral-950); stroke-width:.8; transform-box:fill-box; transform-origin:center; animation:exg-plot-pop 380ms var(--ease-spring) backwards; }
@keyframes exg-plot-pop{ 0%{ transform:scale(.2); opacity:0; } 70%{ transform:scale(1.18); } 100%{ transform:scale(1); opacity:1; } }
.exg-plot--ghost{ opacity:.55; }
.exg-plot__drop{ stroke-width:1; stroke-dasharray:2 3; }
.exg-plot__halo{ animation:exg-plot-breathe 2.4s ease-in-out infinite; transform-box:fill-box; transform-origin:center; }
@keyframes exg-plot-breathe{ 0%,100%{ transform:scale(1); } 50%{ transform:scale(1.25); } }
.exg-plot__cursordot{ stroke:var(--neutral-950); stroke-width:1.2; }
.exg-plot__readout,.exg-plot__endlab{ font-family:var(--font-mono); font-size:9.5px; paint-order:stroke; stroke:var(--neutral-950); stroke-width:3px; stroke-linejoin:round; }
.exg-plot__endlab--ghost{ opacity:.75; }
@media (prefers-reduced-motion: reduce){
  .exg-plot__line--draw{ animation:none; stroke-dashoffset:0; }
  .exg-plot__fill,.exg-plot__bar,.exg-plot__dot,.exg-plot__halo{ animation:none; }
}
/* graph — node/link semantic primitive (soft pills, gentle curves) */
.exg-graph{ display:flex; flex-direction:column; gap:6px; }
.exg-graph__lab{ font-family:var(--font-mono); font-size:10px; letter-spacing:.16em; text-transform:uppercase; color:var(--white-40); }
.exg-graph__svg{ width:100%; max-width:560px; margin-inline:auto; height:auto; display:block; overflow:visible; }
.exg-graph__empty{ font-family:var(--font-mono); font-size:10px; color:var(--white-30); font-style:italic; padding:14px 2px; }
.exg-graph__edge path{ fill:none; stroke-width:1.6; stroke-linecap:round; animation:exg-plot-fade 500ms ease-out; }
.exg-graph__elab{ font-family:var(--font-mono); font-size:8.5px; fill:var(--white-40); paint-order:stroke; stroke:var(--neutral-950); stroke-width:3px; stroke-linejoin:round; }
.exg-graph__node{ transform-box:fill-box; transform-origin:center; animation:exg-plot-pop 380ms var(--ease-spring) backwards; }
.exg-graph__node rect{ stroke-width:1; }
.exg-graph__nlab{ font-family:var(--font-mono); font-size:10px; }
@media (prefers-reduced-motion: reduce){ .exg-graph__node,.exg-graph__edge path{ animation:none; } }
`;

export function useExerciseStyles(): void {
  React.useEffect(() => {
    if (document.getElementById("exg-ex-styles")) return;
    const el = document.createElement("style");
    el.id = "exg-ex-styles";
    el.textContent = EX_CSS + HL_CSS + DISPLAY_CSS;
    document.head.appendChild(el);
  }, []);
}
