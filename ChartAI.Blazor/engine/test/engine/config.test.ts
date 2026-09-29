// Chart configuration through the engine API: uniform normalisation (B4, K4), configure's null
// semantics (B14, K5) and the runtime window vs defaultBounds (B14, K6).
import { beforeEach, describe, expect, test } from "bun:test";
import { resetEnv } from "../helpers/env.ts";
import { M, makeChart, range, series, settle, startEngine } from "../helpers/engine.ts";
import { LineChart } from "../../src/charts/line.ts";
import { CandlestickChart, packRGB } from "../../src/charts/candlestick.ts";
import { StepChart } from "../../src/charts/experimental/step.ts";
import { HeatmapChart } from "../../src/charts/experimental/heatmap.ts";

beforeEach(() => resetEnv());

describe("uniform normalisation in the engine (B4, K4)", () => {
  test("a stepMode name reaches the GPU as its number at create", async () => {
    const eng = await startEngine([StepChart]);
    for (const [mode, value] of [
      ["after", 0],
      ["before", 1],
      ["center", 2],
    ] as const) {
      const c = await makeChart(eng, { type: "step", stepMode: mode });
      expect(eng.worker.last(M.REGISTER_CHART, c.id).customUniformValues.stepMode).toBe(value);
    }
  });

  test("configure maps stepMode names too", async () => {
    const eng = await startEngine([StepChart]);
    const c = await makeChart(eng, { type: "step" });
    c.handle.configure({ stepMode: "before" });
    expect(eng.worker.last(M.SET_UNIFORMS, c.id)?.values?.stepMode).toBe(1);
    c.handle.configure({ stepMode: "center" });
    expect(eng.worker.last(M.SET_UNIFORMS, c.id)?.values?.stepMode).toBe(2);
  });

  test("[r,g,b] colours of u32 uniforms are packed like packRGB (create and configure)", async () => {
    const eng = await startEngine([CandlestickChart]);
    const c = await makeChart(eng, { type: "candlestick", upColor: [1, 0, 0], downColor: [0, 0, 1] });
    const reg = eng.worker.last(M.REGISTER_CHART, c.id);
    expect(reg.customUniformValues.upColor).toBe(packRGB(1, 0, 0));
    expect(reg.customUniformValues.downColor).toBe(packRGB(0, 0, 1));
    c.handle.configure({ downColor: [0, 0.5, 1] });
    expect(eng.worker.last(M.SET_UNIFORMS, c.id)?.values?.downColor).toBe(packRGB(0, 0.5, 1));
  });

  test("numbers still pass through unchanged", async () => {
    const eng = await startEngine([CandlestickChart]);
    const c = await makeChart(eng, { type: "candlestick", upColor: packRGB(0.1, 0.2, 0.3), interval: 60 });
    const reg = eng.worker.last(M.REGISTER_CHART, c.id);
    expect(reg.customUniformValues.upColor).toBe(packRGB(0.1, 0.2, 0.3));
    expect(reg.customUniformValues.interval).toBe(60);
  });

  test("a heatmap colorScale name is applied at create (install runs before the uniforms)", async () => {
    const eng = await startEngine([HeatmapChart]);
    const c = await makeChart(eng, { type: "heatmap", colorScale: "plasma", gridColumns: 4, gridRows: 4 });
    expect(eng.worker.last(M.REGISTER_CHART, c.id).customUniformValues.colorScale).toBe(1);
  });

  test("a renderer's install hook runs before the uniforms are computed", async () => {
    const r = {
      ...LineChart,
      name: "install-order",
      uniforms: [{ name: "k", type: "u32" as const, default: 0 }],
      install(chart: any) {
        chart.config.k = 7;
      },
    };
    const eng = await startEngine([r]);
    const c = await makeChart(eng, { type: "install-order" });
    expect(eng.worker.last(M.REGISTER_CHART, c.id).customUniformValues.k).toBe(7);
  });
});

describe("configure: null resets, omitted keys merge (B14, K5)", () => {
  test("a uniform set to null goes back to its default", async () => {
    const eng = await startEngine([LineChart]);
    const c = await makeChart(eng, { type: "line" });
    c.handle.configure({ maxSamplesPerPixel: 5 });
    expect(eng.worker.last(M.SET_UNIFORMS, c.id).values.maxSamplesPerPixel).toBe(5);
    c.handle.configure({ maxSamplesPerPixel: null });
    const def = LineChart.uniforms!.find((u) => u.name === "maxSamplesPerPixel")!.default;
    expect(eng.worker.last(M.SET_UNIFORMS, c.id).values.maxSamplesPerPixel).toBe(def);
  });

  test("bgColor: null does not throw and hands the background back to the theme", async () => {
    const eng = await startEngine([LineChart]);
    const c = await makeChart(eng, { type: "line", bgColor: [0.1, 0.2, 0.3] });
    expect(() => c.handle.configure({ bgColor: null })).not.toThrow();
    const style = eng.worker.messages(M.SET_STYLE, c.id).filter((m) => "bgColor" in m);
    expect(style.length).toBeGreaterThan(0);
    expect(style[style.length - 1].bgColor).toBeNull();
    expect(c.internal().config.bgColor == null).toBe(true);
  });

  test("formatX, annotations and yAxes set to null are unset", async () => {
    const eng = await startEngine([LineChart]);
    const fmt = (v: number) => `${v}`;
    const c = await makeChart(eng, {
      type: "line",
      formatX: fmt,
      annotations: [{ type: "hline", value: 1 }],
      yAxes: [{ id: "a" }, { id: "b", side: "right" }],
    });
    c.handle.setData([series("s", range(5), range(5))]);
    c.handle.configure({ formatX: null, annotations: null, yAxes: null });
    const cfg = c.internal().config;
    expect(typeof cfg.formatX).not.toBe("function");
    expect(cfg.annotations == null).toBe(true);
    expect(cfg.yAxes == null).toBe(true);
    expect(c.internal().yAxes == null).toBe(true);
  });

  test("keys missing from the patch keep their values", async () => {
    const eng = await startEngine([LineChart]);
    const fmt = (v: number) => `${v}`;
    const c = await makeChart(eng, { type: "line", formatX: fmt });
    c.handle.configure({ annotations: [{ type: "hline", value: 2 }] });
    c.handle.configure({ maxSamplesPerPixel: 3 });
    const cfg = c.internal().config;
    expect(cfg.formatX).toBe(fmt);
    expect(cfg.annotations).toEqual([{ type: "hline", value: 2 }]);
  });

  test("defaultBounds: null lets the data decide the window again", async () => {
    const eng = await startEngine([LineChart]);
    const c = await makeChart(eng, { type: "line", defaultBounds: { minY: -100, maxY: 100 } });
    c.handle.setData([series("s", range(11), range(11))]);
    expect(c.internal().bounds.minY).toBe(-100);
    c.handle.configure({ defaultBounds: null });
    expect(c.internal().bounds.minY).toBeGreaterThan(-5);
    expect(c.internal().bounds.maxY).toBeLessThan(15);
  });
});

describe("runtime window vs defaultBounds (B14, K6)", () => {
  async function followChart() {
    const eng = await startEngine([LineChart]);
    const c = await makeChart(eng, { type: "line", defaultBounds: { minY: 0, maxY: 50 } });
    c.handle.setData([series("s", range(10), range(10))], { capacity: 20 });
    return { eng, c };
  }

  test("setBounds moves the window but leaves config.defaultBounds alone", async () => {
    const { c } = await followChart();
    c.handle.setBounds({ minX: 2, maxX: 8, minY: 1, maxY: 9 });
    expect(c.internal().bounds).toMatchObject({ minX: 2, maxX: 8, minY: 1, maxY: 9 });
    expect(c.internal().config.defaultBounds).toEqual({ minY: 0, maxY: 50 });
  });

  test("patchData({ bounds }) leaves config.defaultBounds alone", async () => {
    const { c } = await followChart();
    c.handle.patchData({
      offset: 10,
      count: 11,
      x: range(11),
      series: [{ y: range(11) }],
      bounds: { minX: 3, maxX: 10, minY: 0, maxY: 10 },
    });
    expect(c.internal().bounds).toMatchObject({ minX: 3, maxX: 10 });
    expect(c.internal().config.defaultBounds).toEqual({ minY: 0, maxY: 50 });
  });

  test("a full setData without bounds starts again from defaultBounds and the data", async () => {
    const { c } = await followChart();
    c.handle.setBounds({ minX: 2, maxX: 8, minY: 1, maxY: 9 });
    c.handle.setData([series("s", range(10), range(10))]);
    const b = c.internal().bounds;
    expect(b.minY).toBe(0);
    expect(b.maxY).toBe(50);
    expect(b.minX).toBeLessThan(0);
    expect(b.maxX).toBeGreaterThan(9);
  });

  test("resetView goes home within the current runtime window", async () => {
    const { eng, c } = await followChart();
    c.handle.setBounds({ minX: 2, maxX: 8, minY: 1, maxY: 9 });
    const ic = c.internal();
    ic.view = { panX: 0.4, panY: 0.1, zoomX: 4, zoomY: 2 };
    eng.mgr.resetView(c.id);
    await settle();
    for (const k of ["panX", "panY", "zoomX", "zoomY"]) expect(ic.view[k]).toBeCloseTo(ic.homeView[k], 6);
    expect(ic.bounds).toMatchObject({ minX: 2, maxX: 8, minY: 1, maxY: 9 });
  });
});
