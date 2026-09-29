// The real GPU worker (src/gpu-worker.ts) driven by the real main thread (src/chart-library.ts)
// against a recording fake WebGPU device (test/helpers/fake-gpu.ts). Assertions are invariants
// of the GPU command stream, not worker internals: K1, K2, P4, P6, B11, B20 (worker side).
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { flushFrames, resetEnv, resizeElement } from "../helpers/env.ts";
import { isDeviceLostMessage, M, makeChart, range, series, startEngine } from "../helpers/engine.ts";
import { installGpuBridge, settleBridge, uninstallGpuBridge, type BridgeState } from "../helpers/fake-gpu.ts";
import { HistogramChart } from "../../src/charts/experimental/histogram.ts";
import { ScatterChart } from "../../src/charts/scatter.ts";

// A minimal renderer with fixed binding numbers, so the test can tell resources apart:
// 7 = chart uniforms, 4 = series info, 1/2 = x/y data (compute), 3 and render 1 = per-series
// output buffer, 5 = custom uniforms.
const UNIFORMS = 7,
  SERIES_INFO = 4;
const TestRenderer: any = {
  name: "test-line",
  shaders: { compute: "// compute", render: "// render", highlight: "// highlight" },
  uniforms: [{ name: "k", type: "u32", default: 1 }],
  buffers: [{ name: "outBuf", bytes: ({ width }: any) => Math.max(16, width * 16), usages: ["STORAGE"] }],
  passes: [
    {
      type: "compute",
      shader: "compute",
      perSeries: true,
      dispatch: ({ width }: any) => ({ x: Math.ceil(Math.max(1, width) / 256) }),
      bindings: [
        { binding: UNIFORMS, source: "uniforms" },
        { binding: 1, source: "x-data" },
        { binding: 2, source: "y-data" },
        { binding: 3, source: "outBuf", write: true },
        { binding: SERIES_INFO, source: "series-info" },
        { binding: 5, source: "custom-uniforms" },
      ],
    },
    {
      type: "render",
      shader: "render",
      topology: "line-list",
      loadOp: "load",
      draw: ({ width }: any) => Math.max(0, width * 4 - 2),
      bindings: [
        { binding: UNIFORMS, source: "uniforms" },
        { binding: 1, source: "outBuf" },
        { binding: SERIES_INFO, source: "series-info" },
      ],
    },
    {
      type: "render",
      shader: "highlight",
      topology: "triangle-list",
      loadOp: "load",
      highlight: true,
      draw: ({ width }: any) => Math.max(0, (width - 1) * 6),
      bindings: [
        { binding: UNIFORMS, source: "uniforms" },
        { binding: 1, source: "outBuf" },
        { binding: SERIES_INFO, source: "series-info" },
      ],
    },
  ],
};

let s: BridgeState;

beforeEach(() => {
  resetEnv();
  s = installGpuBridge();
});

afterEach(() => {
  uninstallGpuBridge();
});

const settle = () => settleBridge(() => flushFrames());

async function setup(renderers: any[] = [TestRenderer]) {
  const eng = await startEngine(renderers, { ready: false });
  await settle();
  expect(await eng.init).toBe(true);
  return eng;
}

async function chartWith(eng: any, type: string, data: any[], opts?: any) {
  const c = await makeChart(eng, { type });
  resizeElement(c.container, 400, 200);
  c.handle.setData(data, opts);
  await settle();
  return c;
}

function expectClean() {
  expect(s.errors.map(String)).toEqual([]);
  expect(s.gpu.violations).toEqual([]);
}

function dispatchCount(submits: { passes: any[] }[]): number {
  return submits.reduce((n, sub) => n + sub.passes.reduce((k: number, p: any) => k + p.dispatches.length, 0), 0);
}

// visibleRange (x = first column, y = column count) of every series from the SeriesInfo buffer:
// 32 bytes per series, color vec4f then visibleRange vec2u.
function visibleRanges(n: number): [number, number][] {
  const buf = s.gpu.latestBoundAt(SERIES_INFO);
  expect(buf).toBeDefined();
  return Array.from({ length: n }, (_, i) => [buf!.u32(i * 8 + 4), buf!.u32(i * 8 + 5)] as [number, number]);
}

describe("GPU worker against a fake device", () => {
  test("harness: a chart renders and presents a frame without validation errors", async () => {
    const eng = await setup();
    await chartWith(eng, "test-line", [series("a", range(10), range(10))]);
    expect(s.gpu.submits.length).toBeGreaterThan(0);
    const last = s.gpu.submits[s.gpu.submits.length - 1];
    expect(last.passes.some((p) => p.kind === "render" && p.target?.canvas)).toBe(true);
    expectClean();
  });

  test("K1/B2: the shared uniform buffer is written once per frame, however many series", async () => {
    const eng = await setup();
    const c = await chartWith(eng, "test-line", [
      series("a", range(10), range(10)),
      series("b", range(20), range(20)),
      series("c", range(30), range(30)),
    ]);
    const uniforms = s.gpu.latestBoundAt(UNIFORMS)!;
    expect(uniforms).toBeDefined();
    const m = s.gpu.mark();
    c.internal().view = { panX: 0.1, panY: 0, zoomX: 2, zoomY: 1 };
    eng.mgr.requestRender(c.id);
    await settle();
    const since = s.gpu.since(m);
    expect(since.submits.length).toBeGreaterThanOrEqual(1);
    const writes = since.writes.filter((w) => w.buffer === uniforms).length;
    // The view changed, so the frame must write them; never more than once per frame.
    expect(writes).toBeGreaterThanOrEqual(1);
    expect(writes).toBeLessThanOrEqual(since.submits.length);
    expectClean();
  });

  test("K1: SeriesInfo.visibleRange carries each series' own count", async () => {
    const eng = await setup();
    await chartWith(eng, "test-line", [
      series("a", range(10), range(10)),
      series("b", range(20), range(20)),
      series("c", range(30), range(30)),
    ]);
    expect(visibleRanges(3)).toEqual([
      [0, 10],
      [0, 20],
      [0, 30],
    ]);
    expectClean();
  });

  test("K1/P7: PATCH_SERIES start moves visibleRange.x and shortens visibleRange.y", async () => {
    const eng = await setup();
    const x = range(10);
    const c = await chartWith(eng, "test-line", [series("a", x, range(10)), series("b", x, range(10))], { capacity: 20 });
    c.handle.patchData({ offset: 10, count: 12, start: 3, x: range(12), series: [{ y: range(12) }, { y: range(12) }] });
    await settle();
    expect(visibleRanges(2)).toEqual([
      [3, 9],
      [3, 9],
    ]);
    expectClean();
  });

  test("K2/B10: an empty UPDATE_SERIES frees the series buffers and presents one cleared frame", async () => {
    const eng = await setup();
    const c = await chartWith(eng, "test-line", [series("a", range(10), range(10)), series("b", range(12), range(12))]);
    const seriesBuffers = [1, 2, 3, SERIES_INFO].flatMap((b) => s.gpu.boundAt(b));
    expect(seriesBuffers.length).toBeGreaterThan(0);
    const m = s.gpu.mark();
    c.handle.setData([]);
    await settle();
    expect(seriesBuffers.filter((b) => !b.destroyed).map((b) => b.id)).toEqual([]);
    const since = s.gpu.since(m);
    expect(since.submits.length).toBeGreaterThanOrEqual(1);
    for (const frame of since.submits) expect(frame.passes.some((p) => p.kind === "render" && p.target?.canvas)).toBe(true);
    expect(dispatchCount(since.submits)).toBe(0);
    // A later frame (e.g. a theme change) with no series stays valid.
    eng.mgr.setTheme(true);
    await settle();
    expectClean();
  });

  test("P4: a highlight-only change re-renders without re-running the compute passes", async () => {
    const eng = await setup();
    const c = await chartWith(eng, "test-line", [series("a", range(50), range(50)), series("b", range(50), range(50))]);
    const m = s.gpu.mark();
    eng.worker.postMessage({ type: M.SET_STYLE, id: c.id, highlightSeries: 1 });
    await settle();
    const since = s.gpu.since(m);
    expect(since.submits.length).toBeGreaterThan(0);
    expect(dispatchCount(since.submits)).toBe(0);
    expectClean();
  });

  test("P6: a resize to a smaller or equal size recreates no buffers", async () => {
    const eng = await setup();
    const c = await chartWith(eng, "test-line", [series("a", range(50), range(50)), series("b", range(50), range(50))]);
    const m = s.gpu.mark();
    resizeElement(c.container, 300, 150);
    await settle();
    resizeElement(c.container, 300, 150);
    await settle();
    expect(s.gpu.since(m).buffers.length).toBe(0);
    expectClean();
  });

  test("B11: large point counts never exceed the per-dimension dispatch limit", async () => {
    const eng = await setup([HistogramChart, ScatterChart]);
    const x = range(100, (i) => (i * 37) % 100);
    const h = await makeChart(eng, { type: "histogram" });
    resizeElement(h.container, 400, 200);
    h.handle.setData([series("h", x, range(100, () => 0))], { capacity: 20_000_000 });
    const sc = await makeChart(eng, { type: "scatter" });
    resizeElement(sc.container, 400, 200);
    sc.handle.setData([series("s", range(100), x)], { capacity: 20_000_000 });
    await settle();
    expect(s.gpu.submits.length).toBeGreaterThan(0);
    expect(s.gpu.violations.filter((v) => v.includes("dispatchWorkgroups"))).toEqual([]);
  });

  test("B20/K12: a lost device is reported once and the worker stops submitting", async () => {
    const eng = await setup();
    const c = await chartWith(eng, "test-line", [series("a", range(10), range(10))]);
    const bridge = s.bridges[0];
    const dev = s.gpu.devices[0];
    // A worker's postMessage reaches the newest bridge, so count over all of them (a recovered,
    // healthy worker never reports a lost device).
    const lostReports = () => s.bridges.flatMap((b) => b.posts).filter(isDeviceLostMessage).length;
    dev.lose();
    await settle();
    expect(lostReports()).toBe(1);
    // Keep poking the old worker directly (as if the main thread had not reacted yet).
    for (let i = 0; i < 3; i++) {
      bridge.deliver({ type: M.VIEW_TRANSFORM, id: c.id, panX: 0.1 * i, panY: 0, zoomX: 1 + i, zoomY: 1 });
      bridge.deliver({ type: M.SET_STYLE, id: c.id, highlightSeries: 0 });
      await settle();
    }
    expect(dev.submitsAfterLoss).toBe(0);
    expect(lostReports()).toBe(1);
    expect(s.errors.map(String)).toEqual([]);
  });
});
