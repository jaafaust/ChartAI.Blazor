// Renderer definitions (src/charts/**) checked without a GPU: dispatch sizes (B11), the
// histogram's bounds (B7, B27, K10), the sortX flags (K11) and the uniform value maps (K4).
import { describe, expect, test } from "bun:test";
import * as engine from "../../src/index.ts";
import { HistogramChart } from "../../src/charts/experimental/histogram.ts";
import { StepChart } from "../../src/charts/experimental/step.ts";
import { HeatmapChart } from "../../src/charts/experimental/heatmap.ts";
import { ScatterChart } from "../../src/charts/scatter.ts";
import { BubbleChart } from "../../src/charts/experimental/bubble.ts";
import { LineChart } from "../../src/charts/line.ts";
import { env } from "../helpers/env.ts";

const renderers: any[] = Object.values(engine).filter(
  (v: any) => v && typeof v === "object" && Array.isArray(v.passes) && typeof v.name === "string",
);
// The renderers of point data that B11 is about. "boids" is a demo simulation the Blazor wrapper
// does not register; its per-boid dispatch is outside the scope of the fix.
const pointRenderers = renderers.filter((r) => r.name !== "boids");

const MAX_WG = 65535;

describe("dispatch sizes (B11)", () => {
  test("the engine exports its renderers", () => {
    expect(renderers.length).toBeGreaterThanOrEqual(13);
  });

  for (const samples of [0, 1, 1_000_000, 20_000_000, 120_000_000]) {
    test(`no pass dispatches more than ${MAX_WG} workgroups per dimension (${samples} samples)`, () => {
      const over: string[] = [];
      for (const r of pointRenderers) {
        r.passes.forEach((p: any, i: number) => {
          if (!p.dispatch) return;
          const ctx = {
            width: 8192,
            height: 4096,
            samples,
            seriesCount: 1,
            bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1 },
            view: { panX: 0, panY: 0, zoomX: 1, zoomY: 1 },
          };
          const d = p.dispatch(ctx);
          for (const k of ["x", "y", "z"] as const) {
            const v = d[k] ?? 1;
            if (!(Number.isInteger(v) && v >= 0 && v <= MAX_WG)) over.push(`${r.name} pass ${i} ${k}=${v}`);
          }
        });
      }
      expect(over).toEqual([]);
    });
  }

  test("the histogram count pass splits large inputs into a 2-D dispatch", () => {
    const counts = HistogramChart.passes.filter((p: any) => p.dispatch && p.bindings.some((b: any) => b.source === "x-data"));
    expect(counts.length).toBeGreaterThan(0);
    for (const p of counts) {
      const d = p.dispatch!({
        width: 800,
        height: 400,
        samples: 50_000_000,
        seriesCount: 1,
        bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1 },
        view: { panX: 0, panY: 0, zoomX: 1, zoomY: 1 },
      });
      // Enough invocations for every sample: x * y * z workgroups of at least 64 threads.
      expect(d.x).toBeLessThanOrEqual(MAX_WG);
      expect((d.y ?? 1) * (d.z ?? 1)).toBeGreaterThan(1);
    }
  });
});

// ─── Histogram bounds (B7, B27, K10) ─────────────────────────────────────────

function internalSeries(values: (number | null)[]): any {
  return { label: "h", color: { r: 0, g: 0, b: 0 }, rawX: values, rawY: values.map(() => 0), extra: {} };
}

// Largest bin count the GPU produces for `values` with `bins` bins over [lo, hi], samples outside
// the range and gaps discarded (the shader semantics the bounds must match).
function maxBinCount(values: (number | null)[], bins: number, lo: number, hi: number): number {
  const counts = new Array(bins).fill(0);
  for (const v of values) {
    if (v == null || !(v >= lo && v <= hi)) continue;
    const b = Math.min(bins - 1, Math.max(0, Math.floor(((v - lo) / (hi - lo)) * bins)));
    counts[b]++;
  }
  return Math.max(...counts);
}

function uniform(n: number, lo: number, hi: number): number[] {
  return Array.from({ length: n }, (_, i) => lo + ((i + 0.5) / n) * (hi - lo));
}

function fakeChart(width: number, dpr: number, config: Record<string, unknown> = {}): any {
  return {
    id: "h1",
    width,
    height: 300,
    dpr,
    config: { type: "histogram", ...config },
    bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1 },
    view: { panX: 0, panY: 0, zoomX: 1, zoomY: 1 },
    series: [],
  };
}

function expectMaxY(b: any, expectedMax: number) {
  // Bars must fit (no clipping) and not be squashed to a fraction of the plot.
  expect(b.maxY).toBeGreaterThanOrEqual(expectedMax);
  expect(b.maxY).toBeLessThanOrEqual(expectedMax * 1.5 + 1);
}

describe("histogram bounds follow the GPU's bins (B7, B27, K10)", () => {
  test("is flagged boundsDependOnSize and bins by config.binCount", () => {
    expect(HistogramChart.boundsDependOnSize).toBe(true);
    const values = uniform(2000, 0, 100);
    const b = HistogramChart.computeBounds!([internalSeries(values)], fakeChart(400, 1, { binCount: 20 }));
    expectMaxY(b, maxBinCount(values, 20, values[0], values[values.length - 1]));
  });

  // The physical width is CSS width x devicePixelRatio; chart.dpr (K9) and the global agree here.
  test("without binCount the bins follow the physical width", () => {
    const values = uniform(3000, 0, 100);
    env().dpr = 2;
    try {
      const b = HistogramChart.computeBounds!([internalSeries(values)], fakeChart(150, 2));
      expectMaxY(b, maxBinCount(values, 300, values[0], values[values.length - 1]));
    } finally {
      env().dpr = 1;
    }
  });

  test("the bin count is clamped to 4096 like in the shaders", () => {
    const values = uniform(40_960, 0, 1);
    env().dpr = 2;
    try {
      const b = HistogramChart.computeBounds!([internalSeries(values)], fakeChart(3000, 2));
      expectMaxY(b, maxBinCount(values, 4096, values[0], values[values.length - 1]));
    } finally {
      env().dpr = 1;
    }
  });

  test("minValue / maxValue set the binned range and samples outside it are discarded", () => {
    const values = uniform(2000, 0, 100);
    const b = HistogramChart.computeBounds!(
      [internalSeries(values)],
      fakeChart(400, 1, { binCount: 10, minValue: 0, maxValue: 50 }),
    );
    expectMaxY(b, maxBinCount(values, 10, 0, 50));
  });

  test("gaps are not counted as zero (B27)", () => {
    const values: (number | null)[] = [null, ...uniform(500, 100, 110), null, NaN];
    const b = HistogramChart.computeBounds!([internalSeries(values)], fakeChart(400, 1, { binCount: 10 }));
    expect(typeof b.minX).toBe("number");
    expect(b.minX).toBeGreaterThan(50);
    expect(Number.isFinite(b.maxY)).toBe(true);
  });
});

// ─── Renderer flags ──────────────────────────────────────────────────────────

describe("renderer flags", () => {
  test("K11: the histogram does not need sorted x; hover-searched renderers keep sorting", () => {
    expect(HistogramChart.sortX).toBe(false);
    for (const r of [LineChart, ScatterChart, BubbleChart]) expect(r.sortX).not.toBe(false);
  });

  test("K4: stepMode maps its names to the shader's values", () => {
    const u = StepChart.uniforms!.find((d: any) => d.name === "stepMode") as any;
    expect(u).toBeDefined();
    expect(u.values).toEqual(expect.objectContaining({ after: 0, before: 1, center: 2 }));
  });

  test("K4: the heatmap colour scale maps its names", () => {
    const u = HeatmapChart.uniforms!.find((d: any) => d.name === "colorScale") as any;
    expect(u).toBeDefined();
    expect(u.values).toEqual(expect.objectContaining({ viridis: 0, plasma: 1, cool: 2, warm: 3 }));
  });

  test("B11: no renderer declares the dead dispatchXCount uniform any more", () => {
    const users = renderers.filter((r) => (r.uniforms ?? []).some((u: any) => u.name === "dispatchXCount"));
    expect(users.map((r) => r.name)).toEqual([]);
  });
});
