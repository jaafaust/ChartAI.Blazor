// View changes: linked views in data space (B5, K7), onViewChange / commitView (B28, K7) and
// device-pixel-ratio changes (B19, K9).
import { beforeEach, describe, expect, test } from "bun:test";
import { changeDevicePixelRatio, resetEnv, resizeElement } from "../helpers/env.ts";
import {
  M,
  makeChart,
  range,
  series,
  settle,
  startEngine,
  viewFor,
  visibleX,
  visibleY,
} from "../helpers/engine.ts";
import { LineChart } from "../../src/charts/line.ts";

beforeEach(() => resetEnv());

// Chart A holds x, y in [0, 100], chart B in [0, 50]: the same data range maps to different
// normalised pan/zoom in each.
async function linkedPair(mode: false | "x" | "y" | "both") {
  const eng = await startEngine([LineChart]);
  const a = await makeChart(eng, { type: "line" });
  const b = await makeChart(eng, { type: "line" });
  a.handle.setData([series("a", range(101), range(101))]);
  b.handle.setData([series("b", range(51), range(51))]);
  eng.mgr.setSyncViews(mode);
  return { eng, a, b };
}

function showX(c: any, x0: number, x1: number) {
  const ic = c.internal();
  const v = viewFor(ic.bounds, x0, x1, ic.bounds.minY, ic.bounds.maxY);
  ic.view = { ...ic.view, panX: v.panX, zoomX: v.zoomX };
}

describe("linked views sync in data space (B5, K7)", () => {
  test("syncAllViews maps the source's visible x range through each target's bounds", async () => {
    const { eng, a, b } = await linkedPair("x");
    showX(a, 40, 60);
    const yBefore = { panY: b.internal().view.panY, zoomY: b.internal().view.zoomY };
    eng.mgr.syncAllViews(a.internal());
    const [x0, x1] = visibleX(b.internal());
    expect(x0).toBeCloseTo(40, 6);
    expect(x1).toBeCloseTo(60, 6);
    // "x" leaves the target's y alone.
    expect(b.internal().view.panY).toBe(yBefore.panY);
    expect(b.internal().view.zoomY).toBe(yBefore.zoomY);
    // The target's new transform is sent to the worker.
    const vt = eng.worker.last(M.VIEW_TRANSFORM, b.id);
    expect(vt.panX).toBeCloseTo(b.internal().view.panX, 12);
    expect(vt.zoomX).toBeCloseTo(b.internal().view.zoomX, 12);
  });

  test('"both" maps y in data space too', async () => {
    const { eng, a, b } = await linkedPair("both");
    const A = a.internal();
    A.view = viewFor(A.bounds, 40, 60, 10, 30);
    eng.mgr.syncAllViews(A);
    const [x0, x1] = visibleX(b.internal());
    const [y0, y1] = visibleY(b.internal());
    expect(x0).toBeCloseTo(40, 6);
    expect(x1).toBeCloseTo(60, 6);
    expect(y0).toBeCloseTo(10, 6);
    expect(y1).toBeCloseTo(30, 6);
  });
});

describe("commitView and onViewChange (B28, K7)", () => {
  test("ChartManager has commitView and onViewChange", async () => {
    const { eng } = await linkedPair("x");
    expect(typeof eng.mgr.commitView).toBe("function");
    expect(typeof eng.mgr.onViewChange).toBe("function");
  });

  test("commitView sends the view, moves linked charts in data space and emits for each", async () => {
    const { eng, a, b } = await linkedPair("x");
    expect(typeof eng.mgr.commitView).toBe("function");
    const seen: string[] = [];
    const off = eng.mgr.onViewChange((id: string) => seen.push(id));
    expect(typeof off).toBe("function");
    showX(a, 40, 60);
    eng.worker.clear();
    eng.mgr.commitView(a.internal());
    await settle();
    const vt = eng.worker.last(M.VIEW_TRANSFORM, a.id);
    expect(vt).toBeDefined();
    expect(vt.panX).toBeCloseTo(a.internal().view.panX, 12);
    expect(vt.zoomX).toBeCloseTo(a.internal().view.zoomX, 12);
    const [x0, x1] = visibleX(b.internal());
    expect(x0).toBeCloseTo(40, 6);
    expect(x1).toBeCloseTo(60, 6);
    expect(new Set(seen)).toEqual(new Set([a.id, b.id]));

    off();
    seen.length = 0;
    eng.mgr.commitView(a.internal());
    await settle();
    expect(seen).toEqual([]);
  });

  test("without linking, commitView emits for the source only and moves nothing else", async () => {
    const { eng, a, b } = await linkedPair(false);
    expect(typeof eng.mgr.commitView).toBe("function");
    const seen: string[] = [];
    eng.mgr.onViewChange((id: string) => seen.push(id));
    const bView = { ...b.internal().view };
    showX(a, 40, 60);
    eng.mgr.commitView(a.internal());
    await settle();
    expect(seen).toEqual([a.id]);
    expect(b.internal().view).toEqual(bView);
  });

  test("resetView emits onViewChange", async () => {
    const { eng, a } = await linkedPair(false);
    expect(typeof eng.mgr.onViewChange).toBe("function");
    const seen: string[] = [];
    eng.mgr.onViewChange((id: string) => seen.push(id));
    showX(a, 40, 60);
    eng.mgr.resetView(a.id);
    await settle();
    expect(seen).toContain(a.id);
  });

  test("setBounds(…, resetView = true) puts the view home and emits onViewChange", async () => {
    const { eng, a } = await linkedPair(false);
    expect(typeof eng.mgr.onViewChange).toBe("function");
    const seen: string[] = [];
    eng.mgr.onViewChange((id: string) => seen.push(id));
    showX(a, 40, 60);
    eng.mgr.setBounds(a.id, { minX: 0, maxX: 50, minY: 0, maxY: 100 }, true);
    await settle();
    expect(seen).toContain(a.id);
    const ic = a.internal();
    for (const k of ["panX", "panY", "zoomX", "zoomY"]) expect(ic.view[k]).toBeCloseTo(ic.homeView[k], 6);
  });

  test("resetView of a linked chart is reported for the charts it moves as well", async () => {
    const { eng, a, b } = await linkedPair("x");
    expect(typeof eng.mgr.onViewChange).toBe("function");
    showX(a, 40, 60);
    eng.mgr.syncAllViews(a.internal());
    await settle();
    const seen: string[] = [];
    eng.mgr.onViewChange((id: string) => seen.push(id));
    eng.mgr.resetView(a.id);
    await settle();
    expect(seen).toContain(a.id);
    expect(seen).toContain(b.id);
  });
});

describe("device pixel ratio (B19, K9)", () => {
  test("the chart records the DPR it was sized with", async () => {
    const eng = await startEngine([LineChart]);
    const c = await makeChart(eng, { type: "line" });
    resizeElement(c.container, 400, 200);
    expect(c.internal().dpr).toBe(1);
  });

  test("a DPR change without a CSS resize re-sizes the GPU canvas and the overlays", async () => {
    const eng = await startEngine([LineChart]);
    const c = await makeChart(eng, { type: "line" });
    c.handle.setData([series("s", range(10), range(10))]);
    resizeElement(c.container, 400, 200);
    eng.worker.clear();
    changeDevicePixelRatio(2);
    await settle();
    const r = eng.worker.last(M.RESIZE, c.id);
    expect(r).toBeDefined();
    expect(r.width).toBe(800);
    expect(r.height).toBe(400);
    expect(c.internal().dpr).toBe(2);
    expect(c.internal().backCanvas.width).toBe(800);
    expect(c.internal().frontCanvas.height).toBe(400);
  });
});
