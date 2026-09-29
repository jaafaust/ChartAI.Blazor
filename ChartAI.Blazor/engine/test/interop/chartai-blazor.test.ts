// wwwroot/chartai-blazor.js (the Blazor interop module) against a recording fake ChartManager:
// ./chartai.js is replaced with the real engine exports (src/index.ts) whose ChartManager is the
// fake of test/helpers/fake-manager.ts.
import { beforeEach, describe, expect, mock, test } from "bun:test";
import path from "path";
import { createFakeManager } from "../helpers/fake-manager.ts";
import { waitFor } from "../helpers/env.ts";
import { packRGB } from "../../src/charts/candlestick.ts";

const fake = createFakeManager();
const real = await import("../../src/index.ts");
const WWWROOT = path.resolve(import.meta.dir, "../../../wwwroot");
mock.module(path.join(WWWROOT, "chartai.js"), () => ({ ...real, ChartManager: fake }));

let moduleSeq = 0;
// A fresh copy of the interop module (its chart registry and init promise start empty).
async function freshInterop(): Promise<any> {
  (globalThis as any).window.ChartAIReadyPromise = null;
  return import(`${path.join(WWWROOT, "chartai-blazor.js")}?instance=${++moduleSeq}`);
}

const interop: any = await freshInterop();

let seq = 0;
function newContainer(): HTMLElement {
  const d = document.createElement("div");
  document.body.appendChild(d);
  return d;
}

async function create(config: any = { type: "line" }, plugins: string[] = [], mod: any = interop) {
  const id = `c${++seq}`;
  const container = newContainer();
  await mod.createChart(container, id, config, plugins);
  return { id, container, handle: fake.lastHandle() };
}

function dotNetRef() {
  const invocations: any[][] = [];
  return {
    invocations,
    invokeMethodAsync(...args: any[]) {
      invocations.push(args);
      return Promise.resolve();
    },
  };
}

// Data calls (setData / patchData) the engine chart `handleId` received, in order.
function dataCalls(handleId: string) {
  return fake.calls.filter((c) => c.target === handleId && (c.name === "setData" || c.name === "patchData"));
}

// The column window the engine sees after a data call: x and y of series 0 over [start, count).
function engineWindow(call: { name: string; args: any[] }): { x: number[]; y: number[] } {
  if (call.name === "setData") {
    const s = call.args[0][0];
    return { x: Array.from(s.x as ArrayLike<number>), y: Array.from(s.y as ArrayLike<number>) };
  }
  const p = call.args[0];
  const start = p.start ?? 0;
  return {
    x: Array.from(p.x as ArrayLike<number>).slice(start, p.count),
    y: Array.from(p.series[0].y as ArrayLike<number>).slice(start, p.count),
  };
}

const r10 = Array.from({ length: 10 }, (_, i) => i);

beforeEach(() => fake.reset());

describe("exports (K14)", () => {
  test("normalizeConfig and toFloat64 are exported", () => {
    expect(typeof interop.normalizeConfig).toBe("function");
    expect(typeof interop.toFloat64).toBe("function");
  });
});

describe("normalizeConfig (B4, K4)", () => {
  test("maps stepMode names, packs colours and turns 'none' formats into null", () => {
    expect(typeof interop.normalizeConfig).toBe("function");
    const out = interop.normalizeConfig({
      type: "step",
      stepMode: "center",
      upColor: [1, 0, 0],
      downColor: [0, 0.5, 1],
      totalColor: [0.2, 0.4, 0.6],
      positiveColor: [0, 1, 0],
      negativeColor: [1, 0, 1],
      formatX: "none",
      formatY: "none",
      pointSize: 3,
    });
    expect(out.type).toBe("step");
    expect(out.stepMode).toBe(2);
    expect(out.upColor).toBe(packRGB(1, 0, 0));
    expect(out.downColor).toBe(packRGB(0, 0.5, 1));
    expect(out.totalColor).toBe(packRGB(0.2, 0.4, 0.6));
    expect(out.positiveColor).toBe(packRGB(0, 1, 0));
    expect(out.negativeColor).toBe(packRGB(1, 0, 1));
    expect(out.formatX).toBeNull();
    expect(out.formatY).toBeNull();
    expect(out.pointSize).toBe(3);
  });

  test("all three step modes", () => {
    expect(typeof interop.normalizeConfig).toBe("function");
    expect(interop.normalizeConfig({ stepMode: "after" }).stepMode).toBe(0);
    expect(interop.normalizeConfig({ stepMode: "before" }).stepMode).toBe(1);
    expect(interop.normalizeConfig({ stepMode: "center" }).stepMode).toBe(2);
  });

  test("createChart sends the normalised config", async () => {
    const { handle } = await create({ type: "step", stepMode: "before", upColor: [1, 0, 0], formatX: "none" });
    const cfg = fake.callsOf("create").at(-1)!.args[0];
    expect(cfg.stepMode).toBe(1);
    expect(cfg.upColor).toBe(packRGB(1, 0, 0));
    expect(cfg.formatX == null).toBe(true);
    expect(handle).toBeDefined();
  });

  test("configure sends the normalised patch", async () => {
    const { id, handle } = await create({ type: "step" });
    interop.configure(id, { type: "step", stepMode: "center", negativeColor: [0, 0, 1] });
    const patch = fake.callsOf("configure", handle.id).at(-1)!.args[0];
    expect(patch.stepMode).toBe(2);
    expect(patch.negativeColor).toBe(packRGB(0, 0, 1));
  });

  test("recreateChart sends the normalised config", async () => {
    const { id, container } = await create({ type: "step" });
    await interop.recreateChart(container, id, { type: "step", stepMode: "center" }, ["crosshair"]);
    expect(fake.callsOf("create").at(-1)!.args[0].stepMode).toBe(2);
  });
});

describe("configure replaces instead of merging (B14, K5)", () => {
  test("keys sent before and now absent or null are sent as null", async () => {
    const { id, handle } = await create({
      type: "line",
      formatX: "date",
      watermarkText: "W",
      annotations: [{ type: "hline", value: 1 }],
      crosshairColor: "red",
    });
    interop.configure(id, { type: "line", crosshairColor: "blue" });
    let patch = fake.callsOf("configure", handle.id).at(-1)!.args[0];
    expect(patch.crosshairColor).toBe("blue");
    expect("formatX" in patch && patch.formatX === null).toBe(true);
    expect("watermarkText" in patch && patch.watermarkText === null).toBe(true);
    expect("annotations" in patch && patch.annotations === null).toBe(true);

    interop.configure(id, { type: "line", crosshairColor: null });
    patch = fake.callsOf("configure", handle.id).at(-1)!.args[0];
    expect("crosshairColor" in patch && patch.crosshairColor === null).toBe(true);
  });

  test("P13: re-sending an identical config does not reconfigure the engine", async () => {
    const { id, handle } = await create({ type: "line", watermarkText: "W" });
    interop.configure(id, { type: "line", watermarkText: "X" });
    const n = fake.callsOf("configure", handle.id).length;
    interop.configure(id, { type: "line", watermarkText: "X" });
    expect(fake.callsOf("configure", handle.id).length).toBe(n);
  });
});

// ─── Binary series payloads (P2) ─────────────────────────────────────────────
// .NET sends one byte[] of float64 values plus [offset, length] ranges (in float64 elements).

function payload(columns: number[][]): { data: Uint8Array; ranges: [number, number][] } {
  const flat = columns.flat();
  const f = new Float64Array(flat.map((v) => (v == null ? NaN : v)));
  const ranges: [number, number][] = [];
  let off = 0;
  for (const c of columns) {
    ranges.push([off, c.length]);
    off += c.length;
  }
  return { data: new Uint8Array(f.buffer), ranges };
}

describe("binary series payloads (P2)", () => {
  test("updateSeries decodes a shared x once and the channels of every series", async () => {
    const { id, handle } = await create({ type: "line" });
    const { data, ranges } = payload([
      [0, 1, 2, 3],
      [10, 11, NaN, 13],
      [20, 21, 22, 23],
    ]);
    interop.updateSeries(
      id,
      {
        data,
        x: ranges[0],
        series: [
          { label: "a", color: "#f00", ch: { y: ranges[1] } },
          { label: "b", color: "#0f0", ch: { y: ranges[2] } },
        ],
      },
      { capacity: 10 },
    );
    const call = fake.callsOf("setData", handle.id).at(-1)!;
    const [series] = call.args;
    expect(series).toHaveLength(2);
    expect(series[0].x).toBe(series[1].x);
    expect(Array.from(series[0].x as ArrayLike<number>).slice(0, 4)).toEqual([0, 1, 2, 3]);
    const y0 = Array.from(series[0].y as ArrayLike<number>);
    expect(y0[0]).toBe(10);
    expect(Number.isNaN(y0[2])).toBe(true);
    expect(Array.from(series[1].y as ArrayLike<number>).slice(0, 4)).toEqual([20, 21, 22, 23]);
    expect(series.map((s: any) => s.label)).toEqual(["a", "b"]);
  });

  test("patchSeries appends columns from a binary patch", async () => {
    const { id, handle } = await create({ type: "line" });
    const init = payload([
      [0, 1, 2],
      [5, 6, 7],
    ]);
    interop.updateSeries(id, { data: init.data, x: init.ranges[0], series: [{ label: "a", color: "#f00", ch: { y: init.ranges[1] } }] }, { capacity: 10 });
    const p = payload([[3, 4], [8, 9]]);
    const n = interop.patchSeries(id, { data: p.data, x: p.ranges[0], series: [{ ch: { y: p.ranges[1] } }] });
    expect(n).toBe(5);
    const w = engineWindow(dataCalls(handle.id).at(-1)!);
    expect(w.x).toEqual([0, 1, 2, 3, 4]);
    expect(w.y).toEqual([5, 6, 7, 8, 9]);
  });

  test("per-series x (no shared x) keeps each series' own x", async () => {
    const { id, handle } = await create({ type: "scatter" });
    const { data, ranges } = payload([
      [0, 1],
      [1, 2],
      [5, 6, 7],
      [3, 4, 5],
    ]);
    interop.updateSeries(id, {
      data,
      series: [
        { label: "a", color: "#f00", x: ranges[0], ch: { y: ranges[1] } },
        { label: "b", color: "#0f0", x: ranges[2], ch: { y: ranges[3] } },
      ],
    });
    const [series] = fake.callsOf("setData", handle.id).at(-1)!.args;
    expect(Array.from(series[0].x as ArrayLike<number>)).toEqual([0, 1]);
    expect(Array.from(series[1].x as ArrayLike<number>)).toEqual([5, 6, 7]);
    expect(Array.from(series[1].y as ArrayLike<number>)).toEqual([3, 4, 5]);
  });
});

describe("toFloat64 (P2, K14)", () => {
  test("numbers and nulls: null becomes NaN", () => {
    expect(typeof interop.toFloat64).toBe("function");
    const out = interop.toFloat64([1, null, 3.5]);
    expect(out).toBeInstanceOf(Float64Array);
    expect(out.length).toBe(3);
    expect(out[0]).toBe(1);
    expect(Number.isNaN(out[1])).toBe(true);
    expect(out[2]).toBe(3.5);
  });

  test("a Uint8Array of little-endian float64 at an unaligned byteOffset", () => {
    expect(typeof interop.toFloat64).toBe("function");
    const src = new Float64Array([1.5, NaN, -2, 1e300]);
    const buf = new ArrayBuffer(3 + src.byteLength + 5);
    new Uint8Array(buf, 3, src.byteLength).set(new Uint8Array(src.buffer));
    const out = interop.toFloat64(new Uint8Array(buf, 3, src.byteLength));
    expect(out).toBeInstanceOf(Float64Array);
    expect(out.length).toBe(4);
    expect(out[0]).toBe(1.5);
    expect(Number.isNaN(out[1])).toBe(true);
    expect(out[2]).toBe(-2);
    expect(out[3]).toBe(1e300);
  });

  test("an aligned Uint8Array and a Float64Array", () => {
    expect(typeof interop.toFloat64).toBe("function");
    const src = new Float64Array([4, 5, 6]);
    expect(Array.from(interop.toFloat64(new Uint8Array(src.buffer)))).toEqual([4, 5, 6]);
    const f = interop.toFloat64(src);
    expect(f).toBeInstanceOf(Float64Array);
    expect(Array.from(f)).toEqual([4, 5, 6]);
  });

  test("empty input", () => {
    expect(typeof interop.toFloat64).toBe("function");
    expect(interop.toFloat64([]).length).toBe(0);
    expect(interop.toFloat64(new Uint8Array(0)).length).toBe(0);
  });
});

describe("column store (B21, B22, B37, P7)", () => {
  test("B21: recreateChart (a Plugins change) keeps the live data", async () => {
    const { id, container } = await create({ type: "line" });
    interop.updateSeries(id, [{ label: "a", color: "#000", x: r10, y: r10 }], { capacity: 20 });
    await interop.recreateChart(container, id, { type: "line" }, ["crosshair"]);
    const fresh = fake.lastHandle();
    const restored = dataCalls(fresh.id);
    expect(restored.length).toBeGreaterThan(0);
    expect(engineWindow(restored[restored.length - 1]).x).toEqual(r10);
    expect(() => interop.patchSeries(id, { x: [10], series: [{ y: [10] }] })).not.toThrow();
    const last = dataCalls(fresh.id).at(-1)!;
    expect(engineWindow(last).x).toEqual([...r10, 10]);
  });

  test("B22: a type change re-sends series that do not share x", async () => {
    const { id } = await create({ type: "line" });
    interop.updateSeries(id, [
      { label: "a", color: "#000", x: [0, 1, 2], y: [1, 2, 3] },
      { label: "b", color: "#111", x: [0, 2, 4, 6], y: [4, 5, 6, 7] },
    ]);
    interop.configure(id, { type: "scatter" });
    const fresh = fake.lastHandle();
    expect(fake.callsOf("create").at(-1)!.args[0].type).toBe("scatter");
    const sent = fake.callsOf("setData", fresh.id);
    expect(sent.length).toBeGreaterThan(0);
    const series = sent.at(-1)!.args[0];
    expect(series).toHaveLength(2);
    expect(Array.from(series[1].x as ArrayLike<number>)).toEqual([0, 2, 4, 6]);
  });

  test("B22: a type change keeps AnnotationClicked working", async () => {
    const { id } = await create({ type: "line" });
    const ref = dotNetRef();
    interop.watchAnnotations(id, ref);
    interop.configure(id, { type: "area" });
    const fresh = fake.lastHandle();
    fresh._c.el.dispatchEvent(new CustomEvent("chartai-annotation-click", { detail: { id: "a1" }, bubbles: true }));
    await waitFor(() => ref.invocations.length > 0, 500, "OnAnnotationClicked").catch(() => {});
    expect(ref.invocations).toContainEqual(["OnAnnotationClicked", "a1"]);
  });

  test("a type change keeps shared-x data (regression guard)", async () => {
    const { id } = await create({ type: "line" });
    interop.updateSeries(id, [{ label: "a", color: "#000", x: r10, y: r10 }]);
    interop.configure(id, { type: "area" });
    const sent = dataCalls(fake.lastHandle().id);
    expect(sent.length).toBeGreaterThan(0);
    expect(engineWindow(sent.at(-1)!).y).toEqual(r10);
  });

  test("B37: a truncate-only patch reaches the engine", async () => {
    const { id, handle } = await create({ type: "line" });
    interop.updateSeries(id, [{ label: "a", color: "#000", x: r10, y: r10 }], { capacity: 20 });
    const before = dataCalls(handle.id).length;
    const n = interop.patchSeries(id, { offset: 5, x: [], series: [{ y: [] }] });
    expect(n).toBe(5);
    const after = dataCalls(handle.id);
    expect(after.length).toBeGreaterThan(before);
    expect(engineWindow(after.at(-1)!).x).toEqual([0, 1, 2, 3, 4]);
  });

  test("B37: resetView on a patch without new data still reaches the engine", async () => {
    const { id, handle } = await create({ type: "line" });
    interop.updateSeries(id, [{ label: "a", color: "#000", x: r10, y: r10 }], { capacity: 20 });
    handle._c.view = { panX: 0.3, panY: 0.1, zoomX: 3, zoomY: 2 };
    fake.reset();
    interop.patchSeries(id, { x: [], series: [{ y: [] }], resetView: true });
    expect(handle._c.view).toEqual(handle._c.homeView);
    const notified = fake.calls.some(
      (c) =>
        (c.target === "mgr" && ["requestRender", "commitView", "resetView"].includes(c.name)) ||
        (c.target === handle.id && ["patchData", "setData", "setBounds", "resetView"].includes(c.name)),
    );
    expect(notified).toBe(true);
  });

  test("P7: a sliding window (drop + append) shows exactly the kept columns (regression guard)", async () => {
    const { id, handle } = await create({ type: "line" });
    interop.updateSeries(id, [{ label: "a", color: "#000", x: r10, y: r10.map((v) => v * 10) }], { capacity: 20 });
    interop.patchSeries(id, { drop: 3, x: [10, 11], series: [{ y: [100, 110] }] });
    const w = engineWindow(dataCalls(handle.id).at(-1)!);
    expect(w.x).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(w.y).toEqual([30, 40, 50, 60, 70, 80, 90, 100, 110]);
    interop.patchSeries(id, { dropBefore: 6, x: [12], series: [{ y: [120] }] });
    const w2 = engineWindow(dataCalls(handle.id).at(-1)!);
    expect(w2.x).toEqual([6, 7, 8, 9, 10, 11, 12]);
    expect(w2.y).toEqual([60, 70, 80, 90, 100, 110, 120]);
  });
});

describe("view reports (B28, K7)", () => {
  test("watchView reports programmatic view changes through ChartManager.onViewChange", async () => {
    const { id, handle } = await create({ type: "line" });
    const ref = dotNetRef();
    interop.watchView(id, ref);
    expect(fake.viewListeners.size).toBeGreaterThan(0);
    handle._c.view = { panX: 0.25, panY: 0, zoomX: 2, zoomY: 1 };
    fake.emitViewChange(handle.id);
    await waitFor(() => ref.invocations.some((a) => a[0] === "OnViewChanged"), 2000, "OnViewChanged");
    const call = ref.invocations.find((a) => a[0] === "OnViewChanged")!;
    expect(call.slice(1).every((v: unknown) => typeof v === "number" && Number.isFinite(v))).toBe(true);
  });

  test("destroyChart unsubscribes", async () => {
    const { id } = await create({ type: "line" });
    const before = fake.viewListeners.size;
    interop.watchView(id, dotNetRef());
    expect(fake.viewListeners.size).toBe(before + 1);
    interop.destroyChart(id);
    expect(fake.viewListeners.size).toBe(before);
  });
});

describe("theme at startup (B23, K15)", () => {
  test("initEngine does not overwrite a setTheme made while it was starting", async () => {
    const mod = await freshInterop();
    let resolveInit!: (v: boolean) => void;
    fake.setInitResult(new Promise<boolean>((r) => (resolveInit = r)));
    document.documentElement.classList.remove("dark");
    const ready = mod.initEngine();
    mod.setTheme(true);
    resolveInit(true);
    await ready;
    const themes = fake.callsOf("setTheme");
    expect(themes.length).toBeGreaterThan(0);
    expect(themes.at(-1)!.args[0]).toBe(true);
    fake.setInitResult(Promise.resolve(true));
  });

  test("without an explicit theme, initEngine follows the <html> dark class (regression guard)", async () => {
    const mod = await freshInterop();
    fake.setInitResult(Promise.resolve(true));
    document.documentElement.classList.add("dark");
    try {
      await mod.initEngine();
      expect(fake.callsOf("setTheme").at(-1)?.args[0]).toBe(true);
    } finally {
      document.documentElement.classList.remove("dark");
    }
  });
});
