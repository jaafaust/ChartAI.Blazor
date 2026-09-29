import type { InternalChart, ResolvedYAxis } from "../types.ts";

// This module stays free of runtime imports (ChartManager in particular): chart-library.ts
// imports it, and the helpers below are tested on their own.

export interface Margin {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export const MARGIN: Margin = { left: 55, right: 10, top: 8, bottom: 45 };

// ─── Multi Y-axis support ────────────────────────────────────────────────────
const DEFAULT_AXIS_WIDTH = 55;
const DEFAULT_AXIS_GAP = 6;
// Extra channels holding Y positions that must be remapped into primary-axis
// space for series bound to a secondary axis.
export const Y_PLOT_CHANNELS = new Set(["open", "high", "low", "lo", "hi"]);

// Resolve config.yAxes into normalized descriptors, or null when the chart
// uses the implicit single default axis. Defaults: first axis left, others right.
export function yAxisDefs(chart: InternalChart<any>): ResolvedYAxis[] | null {
  const defs = chart.config.yAxes;
  if (!Array.isArray(defs) || defs.length === 0) return null;
  return defs.map((d, i) => ({
    id: d.id ?? String(i),
    side:
      d.side === "right" ? "right" : d.side === "left" ? "left" : i === 0 ? "left" : "right",
    width: d.width ?? DEFAULT_AXIS_WIDTH,
    format: typeof d.format === "function" ? d.format : undefined,
    color: d.color,
    min: d.min,
    max: d.max,
  }));
}

export function hasRightAxes(chart: InternalChart<any>): boolean {
  const defs = yAxisDefs(chart);
  return !!defs && defs.some((d) => d.side === "right");
}

// Chart margins including the strip claimed by every configured y-axis.
// Falls back to the classic MARGIN for implicit single-axis charts.
export function chartMargin(chart: InternalChart<any>): Margin {
  const defs = yAxisDefs(chart);
  if (!defs) return MARGIN;
  const gap: number = chart.config.yAxisGap ?? DEFAULT_AXIS_GAP;
  let left = 0,
    right = 0,
    nl = 0,
    nr = 0;
  for (const d of defs) {
    if (d.side === "right") right += (nr++ > 0 ? gap : 0) + d.width;
    else left += (nl++ > 0 ? gap : 0) + d.width;
  }
  return {
    left: nl > 0 ? left : MARGIN.right,
    right: nr > 0 ? right : MARGIN.right,
    top: MARGIN.top,
    bottom: MARGIN.bottom,
  };
}

export interface YAxisStrip extends ResolvedYAxis {
  // The axis as last resolved by ChartManager.refreshSeriesData (with scale/offset).
  axis?: ResolvedYAxis;
  x0: number;
  x1: number;
}

// Horizontal strip [x0, x1] occupied by each y-axis: the first axis of a side
// sits next to the plot, later ones stack outward separated by yAxisGap.
export function yAxisStrips(
  chart: InternalChart<any>,
  m: Margin,
  w: number,
): YAxisStrip[] | null {
  const defs = yAxisDefs(chart);
  if (!defs) return null;
  const gap: number = chart.config.yAxisGap ?? DEFAULT_AXIS_GAP;
  let leftEdge = m.left,
    rightEdge = w - m.right;
  return defs.map((d, i) => {
    const axis = chart.yAxes?.[i];
    if (d.side === "right") {
      const strip = { ...d, axis, x0: rightEdge, x1: rightEdge + d.width };
      rightEdge += d.width + gap;
      return strip;
    }
    const strip = { ...d, axis, x0: leftEdge - d.width, x1: leftEdge };
    leftEdge -= d.width + gap;
    return strip;
  });
}

// Formatter for the axis a given series is bound to (falls back to formatY).
export function seriesAxisFormat(
  chart: InternalChart<any>,
  seriesIndex: number,
): (value: number) => string {
  const ax = chart.yAxes?.[chart.series[seriesIndex]?.axisIndex ?? 0];
  return ax?.format ?? chart.config.formatY ?? String;
}

// ─── Axis ticks ──────────────────────────────────────────────────────────────

// A tick step below this fraction of the axis' magnitude (2^-51, about two float64 steps)
// yields no ticks: the multiples of the step would stop being distinct doubles.
const TICK_MIN_RELATIVE_STEP = 2 ** -51;

// Tick values for an axis showing [min, max]: the multiples of a 1-2-5 step that fall in the
// range, about `count` of them, strictly increasing. They are computed by index rather than
// by accumulating the step, so a step lost in the float64 spacing of the values cannot stall
// the loop (it used to hang the tab at deep zoom on epoch-millisecond x); such a step gives [].
export function niceTicks(min: number, max: number, count: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || !(count > 0)) return [];
  const range = max - min;
  if (!(range > 0)) return [min];
  const rough = range / count;
  const exp = Math.floor(Math.log10(rough));
  const res = rough / 10 ** exp;
  const nice = res <= 1.5 ? 1 : res <= 3 ? 2 : res <= 7 ? 5 : 10;
  const step = nice * 10 ** exp;
  const magnitude = Math.max(Math.abs(min), Math.abs(max));
  if (!Number.isFinite(step) || !(step > magnitude * TICK_MIN_RELATIVE_STEP)) return [];
  // A fractional step divides by a power of ten, which gives the double nearest the decimal
  // (0.3 rather than 3 * 0.1 = 0.30000000000000004), so default labels read cleanly.
  const div = exp < 0 ? 10 ** -exp : 1;
  const at =
    div > 1 && Number.isFinite(div) ? (k: number) => (k * nice) / div : (k: number) => k * step;
  const first = Math.ceil(min / step);
  const n = Math.min(Math.floor(max / step) - first + 1, 10 * count + 10);
  const ticks: number[] = [];
  for (let i = 0; i < n; i++) {
    const v = at(first + i);
    if (v > max) break;
    // Near the float64 limit two multiples can round to one double; each tick is kept once.
    if (v < min || (ticks.length > 0 && v <= ticks[ticks.length - 1])) continue;
    ticks.push(v);
  }
  return ticks;
}

// ─── View transforms ─────────────────────────────────────────────────────────

// chart.view and chart.homeView: along each axis, the canvas fraction u shows the normalised
// data coordinate pan + u / zoom (0..1 spans chart.bounds).
export interface ViewTransform {
  panX: number;
  panY: number;
  zoomX: number;
  zoomY: number;
}

const HOME_EPSILON = 1e-9;

function rebaseAxis(
  pan: number,
  zoom: number,
  homePan: number,
  homeZoom: number,
  newPan: number,
  newZoom: number,
): [number, number] {
  const atHome =
    Math.abs(pan - homePan) <= HOME_EPSILON && Math.abs(zoom - homeZoom) <= HOME_EPSILON;
  if (atHome || !(zoom > 0 && homeZoom > 0 && newZoom > 0)) return [newPan, newZoom];
  // A home view puts data 0..1 exactly on the plot area, whose edges are therefore the canvas
  // fractions uL = -homePan * homeZoom and uR = uL + homeZoom. The data at both edges stays:
  // pan' + uL' / zoom' = pan + uL / zoom, and the same for uR, which solves to the below.
  const z = (zoom * newZoom) / homeZoom;
  return [pan + (-homePan * homeZoom) / zoom - (-newPan * newZoom) / z, z];
}

// The view after the home view (the plot area inside the axis margins) moved from oldHome to
// newHome, as it does when the chart is resized: an axis that was at home follows the new home,
// any other keeps the data it showed at the edges of the plot area.
export function rebaseViewOnHomeChange(
  view: ViewTransform,
  oldHome: ViewTransform,
  newHome: ViewTransform,
): ViewTransform {
  const [panX, zoomX] = rebaseAxis(
    view.panX, view.zoomX, oldHome.panX, oldHome.zoomX, newHome.panX, newHome.zoomX,
  );
  const [panY, zoomY] = rebaseAxis(
    view.panY, view.zoomY, oldHome.panY, oldHome.zoomY, newHome.panY, newHome.zoomY,
  );
  return { panX, panY, zoomX, zoomY };
}

// The narrowest span the zoom plugin lets an axis show, relative to the largest magnitude in
// view (2^-36, about 1.5e-11): a tick step stays thousands of float64 steps wide.
export const MIN_RELATIVE_SPAN = 2 ** -36;

// The largest zoom (relative to the full [min, max]) that keeps the visible span above
// MIN_RELATIVE_SPAN of the values around `anchor`; Infinity when nothing limits it. With x in
// epoch milliseconds (about 1.75e12) the visible span cannot drop below about 25 ms.
export function floatZoomLimit(min: number, max: number, anchor = 0): number {
  const full = max - min;
  // A non-finite anchor (a pointer position that could not be read) must not lift the limit.
  const magnitude = Math.max(Math.abs(min), Math.abs(max), Number.isFinite(anchor) ? Math.abs(anchor) : 0);
  if (!(full > 0) || !Number.isFinite(full) || !(magnitude > 0) || !Number.isFinite(magnitude))
    return Infinity;
  return full / (magnitude * MIN_RELATIVE_SPAN);
}

// ─── Pointer and device helpers ──────────────────────────────────────────────

// The zoom plugin stamps chart.lastDragEndTime when a drag ends. The browser then fires a click
// for the same press; handlers that act on a click (ruler, tooltip pin, minimap) ignore it.
export const CLICK_AFTER_DRAG_MS = 100;

export function clickFollowsDrag(
  chart: { lastDragEndTime?: number },
  now: number = Date.now(),
): boolean {
  const t = chart.lastDragEndTime;
  return t != null && now - t < CLICK_AFTER_DRAG_MS;
}

// The device pixel ratio the chart was last sized for (chart.dpr, see ChartManager), or the
// live one. Canvases a plugin owns are sized with it, so they match the chart's own canvases.
export function chartDpr(chart: InternalChart<any>): number {
  return chart.dpr || globalThis.devicePixelRatio || 1;
}

// Element-wise equality of two cache keys (Object.is, so NaN matches NaN).
export function sameKey(a: readonly unknown[] | null, b: readonly unknown[]): boolean {
  if (!a || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
  return true;
}

// The hidden series of a chart as a comparable string.
export function hiddenKey(chart: InternalChart<any>): string {
  const hidden = chart.config.hiddenSeries;
  return hidden && hidden.size > 0 ? [...hidden].join(",") : "";
}
