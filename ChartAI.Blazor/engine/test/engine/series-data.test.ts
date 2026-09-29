// ChartManager's data path, black-box: what setData / patchData post to the (fake) worker and
// what the documented InternalChart fields hold afterwards.
import { beforeEach, describe, expect, test } from "bun:test";
import { resetEnv, resizeElement } from "../helpers/env.ts";
import { M, makeChart, postedX, range, series, startEngine } from "../helpers/engine.ts";
import { LineChart } from "../../src/charts/line.ts";
import { ErrorBandChart } from "../../src/charts/experimental/error-band.ts";
import { HistogramChart } from "../../src/charts/experimental/histogram.ts";

beforeEach(() => resetEnv());

function expectStrictlyIncreasing(a: ArrayLike<number>) {
  for (let i = 1; i < a.length; i++)
    if (!(a[i] > a[i - 1])) throw new Error(`not strictly increasing at ${i}: ${a[i - 1]} -> ${a[i]}`);
}

const T0 = 1_750_000_000_000; // epoch ms

describe("empty data (B10, K2)", () => {
  test("setData([]) clears the chart and posts an empty UPDATE_SERIES", async () => {
    const eng = await startEngine([LineChart]);
    const c = await makeChart(eng, { type: "line" });
    c.handle.setData([series("a", range(10), range(10))]);
    const before = eng.worker.messages(M.UPDATE_SERIES, c.id).length;
    c.handle.setData([]);
    const all = eng.worker.messages(M.UPDATE_SERIES, c.id);
    expect(all.length).toBe(before + 1);
    expect(all[all.length - 1].series).toEqual([]);
    expect(c.internal().series).toEqual([]);
  });

  test("a patch after emptying the chart does not throw", async () => {
    const eng = await startEngine([LineChart]);
    const c = await makeChart(eng, { type: "line" });
    c.handle.setData([series("a", range(10), range(10))], { capacity: 20 });
    c.handle.setData([]);
    expect(() => c.handle.setBounds({ minX: 0, maxX: 1, minY: 0, maxY: 1 })).not.toThrow();
  });
});

describe("multi-axis bounds (B13)", () => {
  test("gaps (null / NaN) do not count as 0 in the per-axis y bounds", async () => {
    const eng = await startEngine([LineChart]);
    const c = await makeChart(eng, { type: "line", yAxes: [{ id: "t" }, { id: "p", side: "right" }] });
    c.handle.setData([
      { ...series("temp", [0, 1, 2, 3], [20, null, 22, NaN]), yAxis: "t" },
      { ...series("pressure", [0, 1, 2, 3], [1000, 1010, null, 1005]), yAxis: "p" },
    ]);
    const b = c.internal().bounds;
    // [20, 22] padded by 10 %; a gap read as 0 would give about [-2.2, 24.2].
    expect(b.minY).toBeGreaterThan(19);
    expect(b.maxY).toBeLessThan(23);
    const msg = eng.worker.last(M.UPDATE_SERIES, c.id);
    expect(msg.bounds.minY).toBeCloseTo(b.minY, 9);
    const axes = c.internal().yAxes;
    expect(axes[1].min).toBeGreaterThan(990);
    expect(axes[1].max).toBeLessThan(1020);
  });

  test("gaps in the renderer's extra y channels are skipped as well", async () => {
    const eng = await startEngine([ErrorBandChart]);
    const c = await makeChart(eng, { type: "error-band", yAxes: [{ id: "a" }, { id: "b", side: "right" }] });
    c.handle.setData([
      { ...series("s", [0, 1, 2], [10, 11, 12], { lo: [9, null, 11], hi: [11, 12, NaN] }), yAxis: "a" },
      { ...series("t", [0, 1, 2], [1, 2, 3], { lo: [0, 1, 2], hi: [2, 3, 4] }), yAxis: "b" },
    ]);
    const b = c.internal().bounds;
    expect(b.minY).toBeGreaterThan(8);
    expect(b.maxY).toBeLessThan(13);
  });
});

describe("x origin (B3, K3)", () => {
  test("epoch-ms x reaches the worker rebased: distinct f32 values inside the posted bounds", async () => {
    const eng = await startEngine([LineChart]);
    const c = await makeChart(eng, { type: "line" });
    const x = Float64Array.from({ length: 3601 }, (_, i) => T0 + i * 1000);
    const y = Float64Array.from({ length: 3601 }, (_, i) => Math.sin(i / 100));
    c.handle.setData([series("a", x, y)]);
    const msg = eng.worker.last(M.UPDATE_SERIES, c.id);
    const gx = postedX(msg);
    expectStrictlyIncreasing(gx);
    expect(gx[0]).toBeGreaterThanOrEqual(msg.bounds.minX);
    expect(gx[gx.length - 1]).toBeLessThanOrEqual(msg.bounds.maxX);
    const span = msg.bounds.maxX - msg.bounds.minX;
    expect(span).toBeGreaterThan(3_600_000);
    expect(span).toBeLessThan(3_600_000 * 1.25);
  });

  test("plugins and hover keep absolute float64 x", async () => {
    const eng = await startEngine([LineChart]);
    const c = await makeChart(eng, { type: "line" });
    const x = Float64Array.from({ length: 100 }, (_, i) => T0 + i * 1000);
    c.handle.setData([series("a", x, range(100))]);
    const ic = c.internal();
    expect(ic.series[0].rawX[0]).toBe(T0);
    expect(ic.bounds.minX).toBeGreaterThan(T0 - 100_000);
    expect(ic.bounds.maxX).toBeLessThan(T0 + 200_000);
  });

  test("patched columns use the same origin as the full upload", async () => {
    const eng = await startEngine([LineChart]);
    const c = await makeChart(eng, { type: "line" });
    const n = 700;
    const x = Float64Array.from({ length: n }, (_, i) => T0 + i * 1000);
    const y = Float64Array.from({ length: n }, (_, i) => i % 7);
    c.handle.setData([series("a", x.subarray(0, 600), y.subarray(0, 600))], { capacity: 1200 });
    const full = postedX(eng.worker.last(M.UPDATE_SERIES, c.id));
    const mark = eng.worker.posted.length;
    c.handle.patchData({ offset: 600, count: n, x, series: [{ y }] });
    const data = eng.worker.posted
      .slice(mark)
      .map((p) => p.msg)
      .filter((m) => m?.id === c.id && (m.type === M.PATCH_SERIES || m.type === M.UPDATE_SERIES));
    expect(data.length).toBeGreaterThan(0);
    const lastData = data[data.length - 1];
    // Either an in-place patch, or (after a re-origin) one full re-upload.
    if (lastData.type === M.PATCH_SERIES) {
      const px = lastData.x as Float32Array;
      expect(px.length).toBe(100);
      expectStrictlyIncreasing(px);
      expect(px[0] - full[599]).toBeCloseTo(1000, 0);
    } else {
      expectStrictlyIncreasing(postedX(lastData));
    }
  });
});

describe("hidden series (B15, K8)", () => {
  const abc = () => ["a", "b", "c"].map((l) => series(l, range(5), range(5)));

  test("series hidden through setHiddenSeries stay hidden across setData", async () => {
    const eng = await startEngine([LineChart]);
    const c = await makeChart(eng, { type: "line" });
    c.handle.setData(abc());
    eng.mgr.setHiddenSeries(c.id, [1]);
    c.handle.setData(abc());
    let msg = eng.worker.last(M.UPDATE_SERIES, c.id);
    expect(msg.series.map((s: any) => !!s.hidden)).toEqual([false, true, false]);
    // Keyed by label, not index.
    c.handle.setData([series("b", range(5), range(5)), series("a", range(5), range(5))]);
    msg = eng.worker.last(M.UPDATE_SERIES, c.id);
    expect(msg.series.map((s: any) => [s.label, !!s.hidden])).toEqual([
      ["b", true],
      ["a", false],
    ]);
  });

  test("a series the user showed stays shown although the data says hidden", async () => {
    const eng = await startEngine([LineChart]);
    const c = await makeChart(eng, { type: "line" });
    const data = () => [series("a", range(5), range(5)), { ...series("c", range(5), range(5)), hidden: true }];
    c.handle.setData(data());
    expect(eng.worker.last(M.UPDATE_SERIES, c.id).series.map((s: any) => !!s.hidden)).toEqual([false, true]);
    eng.mgr.setHiddenSeries(c.id, []);
    c.handle.setData(data());
    expect(eng.worker.last(M.UPDATE_SERIES, c.id).series.map((s: any) => !!s.hidden)).toEqual([false, false]);
  });

  test("without user overrides ChartSeries.hidden applies", async () => {
    const eng = await startEngine([LineChart]);
    const c = await makeChart(eng, { type: "line" });
    c.handle.setData([series("a", range(5), range(5)), { ...series("b", range(5), range(5)), hidden: true }]);
    expect(eng.worker.last(M.UPDATE_SERIES, c.id).series.map((s: any) => !!s.hidden)).toEqual([false, true]);
  });
});

describe("sorting x (P9, K11)", () => {
  test("a descending x shared by several series is sorted once and uploaded once", async () => {
    const eng = await startEngine([LineChart]);
    const c = await makeChart(eng, { type: "line" });
    const x = [5, 4, 3, 2, 1, 0];
    c.handle.setData([1, 2, 3].map((k) => series(`s${k}`, x, x.map((v) => v * k))));
    const msg = eng.worker.last(M.UPDATE_SERIES, c.id);
    expect(msg.sharedX).toBeTruthy();
    for (const s of msg.series) expect(s.dataX == null).toBe(true);
    expectStrictlyIncreasing(msg.sharedX);
    expect(Array.from(msg.series[1].dataY as Float32Array)).toEqual([0, 2, 4, 6, 8, 10]);
  });

  test("NaN in x sorts last", async () => {
    const eng = await startEngine([LineChart]);
    const c = await makeChart(eng, { type: "line" });
    c.handle.setData([series("a", [3, NaN, 1, 2], [30, 99, 10, 20])]);
    const msg = eng.worker.last(M.UPDATE_SERIES, c.id);
    expect(Array.from(msg.series[0].dataY as Float32Array)).toEqual([10, 20, 30, 99]);
    const gx = postedX(msg);
    expectStrictlyIncreasing(gx.subarray(0, 3));
  });

  test("the input arrays are not modified", async () => {
    const eng = await startEngine([LineChart]);
    const c = await makeChart(eng, { type: "line" });
    const x = [3, 1, 2],
      y = [30, 10, 20];
    c.handle.setData([series("a", x, y)]);
    expect(x).toEqual([3, 1, 2]);
    expect(y).toEqual([30, 10, 20]);
  });

  test("histogram samples are not sorted (sortX: false)", async () => {
    const eng = await startEngine([HistogramChart]);
    const c = await makeChart(eng, { type: "histogram" });
    const x = [5, 1, 4, 2, 3];
    c.handle.setData([series("h", x, [0, 0, 0, 0, 0])]);
    expect(Array.from(c.internal().series[0].rawX)).toEqual([5, 1, 4, 2, 3]);
  });
});

describe("patchData (B36, P7)", () => {
  test("a patch without x keeps the x array; resize and hover data stay valid", async () => {
    const eng = await startEngine([LineChart]);
    const c = await makeChart(eng, { type: "line" });
    c.handle.setData([series("a", range(10), range(10))], { capacity: 20 });
    c.handle.patchData({ offset: 5, count: 10, series: [{ y: range(10, (i) => i * 10) }] });
    const s = c.internal().series[0];
    expect(s.rawX).toBeDefined();
    expect(s.rawX.length).toBeGreaterThanOrEqual(10);
    expect(Array.from(s.rawX).slice(0, 10)).toEqual(range(10));
    expect(() => resizeElement(c.container, 500, 300)).not.toThrow();
  });

  test("an invalid patch (missing extra channel) changes no state", async () => {
    const eng = await startEngine([ErrorBandChart]);
    const c = await makeChart(eng, { type: "error-band" });
    c.handle.setData(
      [series("a", range(10), range(10), { lo: range(10, (i) => i - 1), hi: range(10, (i) => i + 1) })],
      { capacity: 20 },
    );
    const s0 = c.internal().series[0];
    const rawY = s0.rawY,
      rawX = s0.rawX,
      lo = s0.extra.lo;
    let threw = false;
    try {
      c.handle.patchData({ offset: 10, count: 12, x: range(12), series: [{ y: range(12) }] });
    } catch {
      threw = true;
    }
    if (threw) {
      const s = c.internal().series[0];
      expect(s.rawY).toBe(rawY);
      expect(s.rawX).toBe(rawX);
      expect(s.extra.lo).toBe(lo);
    }
  });

  test("a patch with the wrong number of series throws and changes nothing", async () => {
    const eng = await startEngine([LineChart]);
    const c = await makeChart(eng, { type: "line" });
    c.handle.setData([series("a", range(10), range(10))], { capacity: 20 });
    const rawY = c.internal().series[0].rawY;
    expect(() =>
      c.handle.patchData({ offset: 10, count: 11, x: range(11), series: [{ y: range(11) }, { y: range(11) }] }),
    ).toThrow();
    expect(c.internal().series[0].rawY).toBe(rawY);
  });

  test("SeriesPatch.start reaches the worker as PATCH_SERIES.start (K1, P7)", async () => {
    const eng = await startEngine([LineChart]);
    const c = await makeChart(eng, { type: "line" });
    c.handle.setData([series("a", range(10), range(10))], { capacity: 20 });
    c.handle.patchData({ offset: 10, count: 12, start: 3, x: range(12), series: [{ y: range(12) }] });
    expect(eng.worker.last(M.PATCH_SERIES, c.id)?.start).toBe(3);
  });
});

describe("computeBounds context (B7, K10)", () => {
  function boundsRenderer(extra: Record<string, unknown> = {}) {
    const calls: any[] = [];
    const r = {
      ...LineChart,
      name: `bounds-test-${Math.random().toString(36).slice(2)}`,
      computeBounds(_series: any[], chart?: any) {
        calls.push(chart);
        return { minX: 0, maxX: 10, minY: 0, maxY: chart?.width ?? -1 };
      },
      ...extra,
    };
    return { r, calls };
  }

  test("computeBounds receives the chart", async () => {
    const { r, calls } = boundsRenderer();
    const eng = await startEngine([r]);
    const c = await makeChart(eng, { type: r.name });
    c.handle.setData([series("a", range(10), range(10))]);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[calls.length - 1]?.id).toBe(c.id);
  });

  test("boundsDependOnSize: a resize recomputes the bounds without re-uploading the data", async () => {
    const { r, calls } = boundsRenderer({ boundsDependOnSize: true });
    const eng = await startEngine([r]);
    const c = await makeChart(eng, { type: r.name });
    c.handle.setData([series("a", range(10), range(10))]);
    const n = calls.length;
    eng.worker.clear();
    resizeElement(c.container, 640, 300);
    expect(calls.length).toBeGreaterThan(n);
    expect(c.internal().bounds.maxY).toBe(640);
    expect(eng.worker.messages(M.UPDATE_SERIES, c.id)).toEqual([]);
    expect(eng.worker.posted.some((p) => p.msg?.id === c.id && p.msg?.bounds?.maxY === 640)).toBe(true);
  });
});
