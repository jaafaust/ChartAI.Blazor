import type { InternalChart, ResolvedYAxis } from "../types.ts";

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
