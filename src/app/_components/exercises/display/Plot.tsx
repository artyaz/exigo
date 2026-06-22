"use client";
/* plot — the cartesian semantic primitive ("models, not pixels"). The author
   declares `series` (expressions → `[[x, y], …]` or `[{x, y}, …]`), an
   optional `target` ghost (the goal/budget curve), and an optional `cursor`
   (a highlighted point synced to state). THIS file owns every coordinate.

   Visual voice (see visual.ts): editorial, not spreadsheet. No frame box, no
   grid mesh, no legend — a soft baseline, two or three whisper guides, smooth
   bézier curves, names written directly at the end of each line, and a halo
   cursor with a single readout. Numbers appear only where attention goes. */
import React from "react";
import type { Env } from "../runtime/expr";
import { run } from "../runtime/expr";
import type { PlotAxis, PlotCursor, PlotSeries, Value } from "../runtime/types";
import { fmtNum, niceTicks, smoothPath, toneRgb } from "./visual";
import { fitLabel, labelGutter, placeReadout, PLOT_VB_W } from "./plotLabels";

const VB_W = PLOT_VB_W;
const VB_H = 216;
let GRAD_SEQ = 0;

type Pt = [number, number];

/** Coerce an expr value into finite [x, y] pairs. Accepts pair arrays (the
    documented shape) and `{x, y}` records, so a series can be folded straight
    from observations via `record(...)`. */
function asPoints(v: Value | undefined): Pt[] {
  if (!Array.isArray(v)) return [];
  const out: Pt[] = [];
  for (const it of v) {
    let x: unknown, y: unknown;
    if (Array.isArray(it)) {
      x = it[0];
      y = it[1];
    } else if (it && typeof it === "object") {
      const o = it as Record<string, Value>;
      x = o.x;
      y = o.y;
    }
    if (typeof x === "number" && typeof y === "number" && Number.isFinite(x) && Number.isFinite(y)) {
      out.push([x, y]);
    }
  }
  return out;
}

function evalPoints(expr: string, env: Env): Pt[] {
  try {
    return asPoints(run(expr, env));
  } catch {
    return [];
  }
}
function evalNum(expr: string, env: Env): number | null {
  try {
    const v = run(expr, env);
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

export function Plot({
  layer,
  env,
}: {
  layer: { label?: string; x?: PlotAxis; y?: PlotAxis; series: PlotSeries[]; target?: PlotSeries; cursor?: PlotCursor };
  env: Env;
}): React.JSX.Element {
  const uid = React.useMemo(() => `exg-grad-${++GRAD_SEQ}`, []);
  const series = layer.series.map((s, i) => ({ spec: s, pts: evalPoints(s.points, env), idx: i }));
  const targetPts = layer.target ? evalPoints(layer.target.points, env) : [];
  const cx = layer.cursor ? evalNum(layer.cursor.x, env) : null;
  const cy = layer.cursor ? evalNum(layer.cursor.y, env) : null;

  // Domain: pinned by axis min/max, else auto-fit to every drawn point
  // (series + ghost + cursor) so nothing ever clips.
  const allX: number[] = [];
  const allY: number[] = [];
  for (const s of series) for (const [x, y] of s.pts) { allX.push(x); allY.push(y); }
  for (const [x, y] of targetPts) { allX.push(x); allY.push(y); }
  if (cx != null) allX.push(cx);
  if (cy != null) allY.push(cy);
  const hasBar = series.some((s) => s.spec.style === "bar") || layer.target?.style === "bar";

  const dataMinX = allX.length ? Math.min(...allX) : 0;
  const dataMaxX = allX.length ? Math.max(...allX) : 1;
  let dataMinY = allY.length ? Math.min(...allY) : 0;
  const dataMaxY = allY.length ? Math.max(...allY) : 1;
  if (hasBar) dataMinY = Math.min(dataMinY, 0); // bars read from a zero baseline

  const xMin = layer.x?.min ?? dataMinX;
  const xMaxRaw = layer.x?.max ?? dataMaxX;
  const yMin = layer.y?.min ?? dataMinY;
  const yMaxRaw = layer.y?.max ?? dataMaxY;
  const xMax = xMaxRaw === xMin ? xMin + 1 : xMaxRaw;
  const yMax = yMaxRaw === yMin ? yMin + 1 : yMaxRaw;

  // Names are written at the end of their line, so reserve exactly enough
  // right margin for the longest one — labels must never leave the frame
  // (ancestors clip, so "overflow: visible" cannot be relied on).
  const named = [
    ...series.filter((s) => s.spec.label && s.pts.length > 0).map((s) => s.spec.label!),
    ...(layer.target?.label && targetPts.length > 0 ? [layer.target.label] : []),
  ];
  // Reserve right margin for the longest name, but never starve the plot: the
  // gutter is capped and any name that still overruns is fit to it (ellipsis +
  // a <title> tooltip), so labels are always whole inside the frame. Math lives
  // in plotLabels.ts so the "never leaves the frame" invariant is unit-tested.
  const { padR, maxChars: labelMaxChars } = labelGutter(named);
  const PAD = { l: 34, r: padR, t: 16, b: 28 };
  const AX = { x0: PAD.l, x1: VB_W - PAD.r, y0: VB_H - PAD.b, y1: PAD.t };

  const sx = (x: number): number => AX.x0 + ((x - xMin) / (xMax - xMin)) * (AX.x1 - AX.x0);
  const sy = (y: number): number => AX.y0 + ((y - yMin) / (yMax - yMin)) * (AX.y1 - AX.y0);
  const baseY = sy(Math.max(yMin, Math.min(yMax, 0)));

  const yGuides = niceTicks(yMin, yMax, 3);
  const xMid = Number(((xMin + xMax) / 2).toFixed(2));
  const xTicks = [...new Set([xMin, xMid, xMax])];
  const yCorner = layer.y?.unit ?? layer.y?.label;

  const barW =
    series.length && series[0]!.pts.length > 1 ? ((AX.x1 - AX.x0) / series[0]!.pts.length) * 0.6 : 14;

  // Gradients for area fills, one per filled series.
  const areaDefs: { id: string; color: string }[] = [];
  for (const s of series) {
    if ((s.spec.style ?? "scatter") === "area" && s.pts.length) {
      areaDefs.push({ id: `${uid}-s${s.idx}`, color: toneRgb(s.spec.tone, s.idx) });
    }
  }
  if (layer.target?.style === "area" && targetPts.length) {
    areaDefs.push({ id: `${uid}-t`, color: toneRgb(layer.target.tone ?? "ghost", 0) });
  }

  const renderSeries = (
    pts: Pt[],
    style: PlotSeries["style"],
    color: string,
    key: string,
    gradId: string,
    ghost = false,
  ): React.JSX.Element | null => {
    if (pts.length === 0) return null;
    const px: Pt[] = pts.map(([x, y]) => [sx(x), sy(y)]);
    const stroke = `rgb(${color})`;
    switch (style ?? "scatter") {
      case "line":
        return ghost ? (
          <path key={key} className="exg-plot__line exg-plot__line--ghost" d={smoothPath(px)} style={{ stroke }} />
        ) : (
          <path key={key} className="exg-plot__line exg-plot__line--draw" d={smoothPath(px)} pathLength={1} style={{ stroke }} />
        );
      case "area": {
        const d = smoothPath(px);
        const close = ` L ${px[px.length - 1]![0].toFixed(2)} ${baseY.toFixed(2)} L ${px[0]![0].toFixed(2)} ${baseY.toFixed(2)} Z`;
        return (
          <g key={key} className={ghost ? "exg-plot--ghost" : undefined}>
            <path className="exg-plot__fill" d={d + close} style={{ fill: `url(#${gradId})` }} />
            <path className={`exg-plot__line${ghost ? "" : " exg-plot__line--draw"}`} d={d} pathLength={ghost ? undefined : 1} style={{ stroke }} />
          </g>
        );
      }
      case "bar":
        return (
          <g key={key} className={ghost ? "exg-plot--ghost" : undefined}>
            {px.map(([bx, by], i) => (
              <rect
                key={i}
                className="exg-plot__bar"
                x={bx - barW / 2}
                y={Math.min(by, baseY)}
                width={barW}
                height={Math.max(1, Math.abs(baseY - by))}
                rx={3}
                style={{ fill: `rgb(${color} / .5)`, animationDelay: `${i * 35}ms` }}
              />
            ))}
          </g>
        );
      default: // scatter
        return (
          <g key={key} className={ghost ? "exg-plot--ghost" : undefined}>
            {px.map(([dx, dy], i) => (
              <circle
                key={i}
                className="exg-plot__dot"
                cx={dx}
                cy={dy}
                r={ghost ? 2.6 : 3.4}
                style={{ fill: stroke, animationDelay: `${i * 45}ms` }}
              />
            ))}
          </g>
        );
    }
  };

  // Direct labels at each named line's last point — instead of a legend.
  const endLabels: { y: number; text: string; color: string; ghost: boolean }[] = [];
  for (const s of series) {
    if (s.spec.label && s.pts.length) {
      endLabels.push({ y: sy(s.pts[s.pts.length - 1]![1]), text: s.spec.label, color: toneRgb(s.spec.tone, s.idx), ghost: false });
    }
  }
  if (layer.target?.label && targetPts.length) {
    endLabels.push({ y: sy(targetPts[targetPts.length - 1]![1]), text: layer.target.label, color: toneRgb(layer.target.tone ?? "ghost", 0), ghost: true });
  }
  // Clamp into frame, then nudge collisions apart so names never overlap.
  for (const l of endLabels) l.y = Math.max(12, Math.min(VB_H - 6, l.y));
  endLabels.sort((a, b) => a.y - b.y);
  for (let i = 1; i < endLabels.length; i++) {
    if (endLabels[i]!.y - endLabels[i - 1]!.y < 11) endLabels[i]!.y = endLabels[i - 1]!.y + 11;
  }

  const cursorPx = cx != null ? sx(cx) : null;
  const cursorPy = cy != null ? sy(cy) : null;
  const cursorColor = toneRgb(layer.cursor?.tone ?? "no", 0);
  const readout = layer.cursor
    ? layer.cursor.label
      ? `${layer.cursor.label} ${cy != null ? fmtNum(cy) : ""}`
      : `${cx != null ? fmtNum(cx) : ""}, ${cy != null ? fmtNum(cy) : ""}`
    : "";
  // Keep the readout INSIDE the plot area so it never spills into the right-edge
  // label gutter (the overlap that garbled the readout over a series name). It
  // fits to whichever side has room; the full text rides along as a <title>.
  const readoutPlace = cursorPx != null && readout ? placeReadout(cursorPx, AX.x0, AX.x1, readout) : null;
  const readoutY = cursorPy != null ? Math.max(11, Math.min(VB_H - 6, cursorPy - 8)) : 0;

  return (
    <div className="exg-plot">
      {layer.label ? <div className="exg-plot__lab">{layer.label}</div> : null}
      <svg className="exg-plot__svg" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid meet" role="img">
        <defs>
          {areaDefs.map((g) => (
            <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={`rgb(${g.color} / .28)`} />
              <stop offset="100%" stopColor={`rgb(${g.color} / .02)`} />
            </linearGradient>
          ))}
        </defs>

        {/* whisper guides + the one number per guide */}
        {yGuides.map((t, i) => (
          <g key={`y${i}`}>
            <line className="exg-plot__guide" x1={AX.x0} y1={sy(t)} x2={AX.x1} y2={sy(t)} />
            <text className="exg-plot__tick" x={AX.x0 - 6} y={sy(t) + 3} textAnchor="end">
              {fmtNum(t)}
            </text>
          </g>
        ))}
        {yCorner ? (
          <text className="exg-plot__corner" x={AX.x0} y={AX.y1 - 6}>
            {yCorner}
          </text>
        ) : null}

        {/* baseline + sparse x values */}
        <line className="exg-plot__base" x1={AX.x0} y1={AX.y0} x2={AX.x1} y2={AX.y0} />
        {xTicks.map((t, i) => (
          <text key={`x${i}`} className="exg-plot__tick" x={sx(t)} y={AX.y0 + 13} textAnchor="middle">
            {fmtNum(t)}
          </text>
        ))}
        {layer.x?.label ? (
          <text className="exg-plot__corner" x={AX.x1} y={VB_H - 3} textAnchor="end">
            {layer.x.label}
            {layer.x.unit ? ` (${layer.x.unit})` : ""}
          </text>
        ) : null}

        {/* target ghost (the goal curve) sits beneath the live series */}
        {layer.target ? renderSeries(targetPts, layer.target.style, toneRgb(layer.target.tone ?? "ghost", 0), "target", `${uid}-t`, true) : null}

        {/* live series */}
        {series.map((s) => renderSeries(s.pts, s.spec.style, toneRgb(s.spec.tone, s.idx), `s${s.idx}`, `${uid}-s${s.idx}`))}

        {/* names written on the data, not in a legend */}
        {endLabels.map((l, i) => (
          <text
            key={`el${i}`}
            className={`exg-plot__endlab${l.ghost ? " exg-plot__endlab--ghost" : ""}`}
            x={AX.x1 + 7}
            y={l.y + 3}
            style={{ fill: `rgb(${l.color})` }}
          >
            {fitLabel(l.text, labelMaxChars) !== l.text ? <title>{l.text}</title> : null}
            {fitLabel(l.text, labelMaxChars)}
          </text>
        ))}

        {/* halo cursor: a grounded dot and a single readout */}
        {cursorPx != null && cursorPy != null ? (
          <g>
            <line className="exg-plot__drop" x1={cursorPx} y1={cursorPy} x2={cursorPx} y2={AX.y0} style={{ stroke: `rgb(${cursorColor} / .45)` }} />
            <circle className="exg-plot__halo" cx={cursorPx} cy={cursorPy} r={9} style={{ fill: `rgb(${cursorColor} / .16)` }} />
            <circle className="exg-plot__cursordot" cx={cursorPx} cy={cursorPy} r={4} style={{ fill: `rgb(${cursorColor})` }} />
            {readoutPlace ? (
              <text
                className="exg-plot__readout"
                x={readoutPlace.x}
                y={readoutY}
                textAnchor={readoutPlace.anchor}
                style={{ fill: `rgb(${cursorColor})` }}
              >
                {readoutPlace.text !== readout ? <title>{readout}</title> : null}
                {readoutPlace.text}
              </text>
            ) : null}
          </g>
        ) : null}
      </svg>
    </div>
  );
}
