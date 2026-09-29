// Worker lifecycle of ChartManager: init readiness (B29, K13) and device-loss recovery (B20, K12).
import { beforeEach, describe, expect, test } from "bun:test";
import { env, resetEnv, waitForWorker } from "../helpers/env.ts";
import {
  deviceLostMessage,
  importEngine,
  M,
  makeChart,
  range,
  series,
  settle,
  startEngine,
} from "../helpers/engine.ts";
import { LineChart } from "../../src/charts/line.ts";

beforeEach(() => resetEnv());

describe("init readiness (B29, K13)", () => {
  test("concurrent init() calls create one worker and both resolve true", async () => {
    const lib = await importEngine();
    const mgr = lib.ChartManager;
    mgr.use(LineChart);
    const p1 = Promise.resolve(mgr.init());
    const p2 = Promise.resolve(mgr.init());
    const w = await waitForWorker(0);
    await new Promise((r) => setTimeout(r, 20));
    expect(env().workers.length).toBe(1);
    expect(mgr.ready).not.toBe(true);
    w.emit({ type: M.GPU_READY });
    expect(await p1).toBe(true);
    expect(await p2).toBe(true);
    expect(mgr.ready).toBe(true);
    expect(await mgr.init()).toBe(true);
    expect(env().workers.length).toBe(1);
    expect(w.messages(M.INIT).length).toBe(1);
    expect(w.messages(M.REGISTER_RENDERER).filter((m) => m.name === "line").length).toBe(1);
  });

  test("use() and create() before GPU_READY are held back, then sent in order", async () => {
    const lib = await importEngine();
    const mgr = lib.ChartManager;
    const init = Promise.resolve(mgr.init());
    const w = await waitForWorker(0);
    mgr.use(LineChart);
    const container = document.createElement("div");
    document.body.appendChild(container);
    let createError: unknown = null;
    let created: Promise<any>;
    try {
      created = Promise.resolve(mgr.create({ type: "line", container, series: [series("a", range(10), range(10))] }));
    } catch (e) {
      createError = e;
      created = Promise.resolve(null);
    }
    expect(createError).toBeNull();
    // Before the GPU is ready the worker has only been told to initialise.
    const early = w.posted.map((p) => p.msg.type).filter((t) => t !== M.INIT && t !== M.THEME);
    expect(early).toEqual([]);

    w.emit({ type: M.GPU_READY });
    expect(await init).toBe(true);
    const chart = await created;
    await settle();
    expect(chart?.id).toBeTruthy();
    const types = w.posted.map((p) => p.msg);
    const iRenderer = types.findIndex((m) => m.type === M.REGISTER_RENDERER && m.name === "line");
    const iChart = types.findIndex((m) => m.type === M.REGISTER_CHART && m.id === chart.id);
    const iData = types.findIndex((m) => m.type === M.UPDATE_SERIES && m.id === chart.id);
    expect(iRenderer).toBeGreaterThanOrEqual(0);
    expect(iChart).toBeGreaterThan(iRenderer);
    expect(iData).toBeGreaterThan(iChart);
    expect(types[iData].series).toHaveLength(1);
  });
});

describe("device loss (B20, K12)", () => {
  test("a new worker gets the renderers, a fresh canvas per chart and the data", async () => {
    const eng = await startEngine([LineChart]);
    const c = await makeChart(eng, { type: "line" });
    c.handle.setData([series("a", range(10), range(10))]);
    const firstCanvas = eng.worker.last(M.REGISTER_CHART, c.id).canvas;

    eng.worker.emit(deviceLostMessage());
    const w2 = await waitForWorker(1);
    expect(eng.worker.terminated).toBe(true);
    await settle();
    w2.emit({ type: M.GPU_READY });
    await settle();

    expect(w2.messages(M.INIT).length).toBe(1);
    expect(w2.messages(M.REGISTER_RENDERER).map((m) => m.name)).toContain("line");
    const regs = w2.messages(M.REGISTER_CHART);
    expect(regs.length).toBe(1);
    const reg = regs[0];
    expect(reg.canvas).toBeTruthy();
    expect(reg.canvas).not.toBe(firstCanvas);
    const regPost = w2.posted.find((p) => p.msg === reg)!;
    expect(regPost.transfer).toContain(reg.canvas);
    const upd = w2.messages(M.UPDATE_SERIES, reg.id);
    expect(upd.length).toBeGreaterThan(0);
    expect(upd[upd.length - 1].series).toHaveLength(1);
    expect((upd[upd.length - 1].series[0].dataY as Float32Array).length).toBe(10);

    // Nothing more goes to the dead worker; the chart handle keeps working on the new one.
    const deadCount = eng.worker.posted.length;
    c.handle.setData([series("b", range(5), range(5))]);
    expect(eng.worker.posted.length).toBe(deadCount);
    const again = w2.messages(M.UPDATE_SERIES, reg.id);
    expect(again[again.length - 1].series[0].label).toBe("b");
  });
});
