import type { RendererPlugin, InternalChart, InternalSeries, Bounds } from "../../types.ts";
import { COMPUTE_WG, dispatch2D } from "../../shaders/shared.ts";
import {
  HIST_CLEAR_SHADER,
  HIST_COUNT_SHADER,
  HIST_FIND_MAX_SHADER,
  HIST_RENDER_SHADER,
} from "../../shaders/experimental/histogram.ts";

export interface HistogramConfig {
  binCount?: number;
  minValue?: number;
  maxValue?: number;
}

declare module "../../types.ts" {
  interface ChartTypeRegistry {
    histogram: HistogramConfig;
  }
}

// Bins histBuffer holds, and the most the shaders count into.
const MAX_BINS = 4096;

// The bin count the shaders use (histBins in shaders/experimental/histogram.ts): binCount when set,
// else one bin per physical pixel column (the worker's width), 1..MAX_BINS.
function histogramBins(chart: InternalChart<any> | undefined): number {
  const set = (chart?.config.binCount ?? 0) >>> 0;
  if (set > 0) return Math.min(MAX_BINS, set);
  if (!chart) return 512;
  const dpr = (chart as { dpr?: number }).dpr || globalThis.devicePixelRatio || 1;
  return Math.max(1, Math.min(MAX_BINS, Math.round(chart.width * dpr)));
}

export const HistogramChart: RendererPlugin = {
  name: "histogram",
  shaders: {
    clear: HIST_CLEAR_SHADER,
    count: HIST_COUNT_SHADER,
    findMax: HIST_FIND_MAX_SHADER,
    render: HIST_RENDER_SHADER,
  },
  // Order matters: it is the field order of HistUniforms in shaders/experimental/histogram.ts.
  // minValue..maxValue is the binned range when set; they are x positions, rebased like the data.
  uniforms: [
    { name: "binCount", type: "u32", default: 0 },
    { name: "minValue", type: "f32", default: 0, xPosition: true },
    { name: "maxValue", type: "f32", default: 0, xPosition: true },
  ],
  buffers: [
    {
      name: "histBuffer",
      bytes: () => MAX_BINS * 4,
      usages: ["STORAGE"],
    },
    {
      name: "maxBuffer",
      bytes: () => 4,
      usages: ["STORAGE"],
    },
  ],
  passes: [
    {
      type: "compute",
      shader: "clear",
      perSeries: true,
      dispatch: () => ({ x: Math.ceil(MAX_BINS / COMPUTE_WG) }),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "histBuffer", write: true },
        { binding: 2, source: "custom-uniforms" },
      ],
    },
    {
      type: "compute",
      shader: "count",
      perSeries: true,
      dispatch: ({ samples }) => dispatch2D(samples),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "x-data" },
        { binding: 2, source: "histBuffer", write: true },
        { binding: 3, source: "custom-uniforms" },
        { binding: 4, source: "series-info" },
        { binding: 5, source: "series-index" },
      ],
    },
    {
      type: "compute",
      shader: "findMax",
      perSeries: true,
      dispatch: () => ({ x: 1 }),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "histBuffer" },
        { binding: 2, source: "maxBuffer", write: true },
        { binding: 3, source: "custom-uniforms" },
      ],
    },
    {
      type: "render",
      shader: "render",
      topology: "triangle-list",
      loadOp: "load",
      blend: {
        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
        alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
      },
      perSeries: true,
      draw: () => MAX_BINS * 6,
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "histBuffer" },
        { binding: 2, source: "maxBuffer" },
        { binding: 3, source: "series-info" },
        { binding: 4, source: "series-index" },
        { binding: 5, source: "custom-uniforms" },
      ],
    },
  ],
  // The binned values need no order: neither the shaders nor the bounds look at it.
  sortX: false,
  // The default bin count follows the chart's width, and the y axis follows the bin count.
  boundsDependOnSize: true,
  // x: the binned range - minValue..maxValue when set (and increasing), else the data extent.
  // y: 0 up to the fullest bin, counted as the GPU counts (histRange / histBins in the shaders), so
  // the tallest bar fits. Without minValue..maxValue the GPU bins over the chart's x bounds, which
  // defaultBounds.minX/maxX override, so the count does too. Gaps (null / NaN) and values outside
  // the range are not counted.
  computeBounds(series: InternalSeries[], chart?: InternalChart<any>): Bounds {
    const cfg = chart?.config ?? {};
    const custom =
      typeof cfg.minValue === "number" && typeof cfg.maxValue === "number" && cfg.minValue < cfg.maxValue;
    let lo = Infinity;
    let hi = -Infinity;
    if (custom) {
      lo = cfg.minValue;
      hi = cfg.maxValue;
    } else {
      for (const s of series) {
        for (const x of s.rawX) {
          if (x == null || x !== x) continue;
          if (x < lo) lo = x;
          if (x > hi) hi = x;
        }
      }
    }
    if (!isFinite(lo) || !isFinite(hi)) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
    if (!(hi > lo)) {
      lo -= 0.5;
      hi += 0.5;
    }
    const db = custom ? undefined : cfg.defaultBounds;
    const binLo: number = db?.minX ?? lo;
    const binHi: number = db?.maxX ?? hi;
    const bins = histogramBins(chart);
    const counts = new Uint32Array(bins);
    const span = binHi - binLo;
    if (span > 0) {
      for (const s of series) {
        for (const x of s.rawX) {
          if (x == null || !(x >= binLo && x <= binHi)) continue;
          counts[Math.min(bins - 1, Math.floor(((x - binLo) / span) * bins))]++;
        }
      }
    }
    let maxCount = 0;
    for (let i = 0; i < bins; i++) if (counts[i] > maxCount) maxCount = counts[i];
    return { minX: lo, maxX: hi, minY: 0, maxY: Math.max(1, Math.ceil(maxCount * 1.1)) };
  },
};
