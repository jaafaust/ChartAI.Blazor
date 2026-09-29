// Pure plugin helpers of contract K14: niceTicks (B1), rebaseViewOnHomeChange (B16),
// clickFollowsDrag (B17) and computeStats (B30). Every test first checks that the export exists,
// so on a tree without it the test fails with a clear message instead of aborting the file.
import { describe, expect, test } from "bun:test";
import path from "path";

const SHARED = "../../src/plugins/shared.ts";
const STATS = "../../src/plugins/experimental/stats.ts";

async function shared(): Promise<any> {
  return import(SHARED);
}

// ─── niceTicks (B1) ──────────────────────────────────────────────────────────

type Case = [number, number, number];

// Runs niceTicks in a child process with a timeout: the baseline loops forever for some inputs.
function runNiceTicks(cases: Case[]): { ticks: (number | null)[]; ms: number }[] {
  const runner = path.join(import.meta.dir, "..", "fixtures", "nice-ticks-runner.ts");
  const proc = Bun.spawnSync({
    cmd: [process.execPath, runner],
    env: { ...process.env, NICE_TICKS_CASES: JSON.stringify(cases) },
    stdout: "pipe",
    stderr: "pipe",
    timeout: 15_000,
  });
  const out = proc.stdout.toString().trim().split("\n").pop() ?? "";
  if (!proc.success)
    throw new Error(
      `niceTicks runner did not finish (exit ${proc.exitCode}, signal ${proc.signalCode}): ` +
        `a niceTicks call never returned (B1)? ${proc.stderr.toString().slice(0, 500)}`,
    );
  const parsed = JSON.parse(out);
  if (parsed.missing) throw new Error("src/plugins/shared.ts does not export niceTicks (K14)");
  return parsed.results;
}

// The K14 invariants: strictly increasing finite ticks inside [min, max], and a bounded count.
function expectValidTicks(ticks: (number | null)[], min: number, max: number, count: number) {
  expect(ticks.length).toBeLessThanOrEqual(10 * count + 10);
  for (const t of ticks) {
    expect(typeof t).toBe("number");
    expect(Number.isFinite(t as number)).toBe(true);
    expect(t as number).toBeGreaterThanOrEqual(min);
    expect(t as number).toBeLessThanOrEqual(max);
  }
  for (let i = 1; i < ticks.length; i++) expect((ticks[i] as number) > (ticks[i - 1] as number)).toBe(true);
}

const T0 = 1.75e12; // epoch milliseconds

describe("niceTicks (B1, K14)", () => {
  test("is exported from plugins/shared.ts", async () => {
    expect(typeof (await shared()).niceTicks).toBe("function");
  });

  test("returns promptly and within bounds at deep zoom on epoch-ms data (the freeze)", () => {
    const cases: Case[] = [
      [T0, T0 + 8000 / 1e6, 8], // zoom 1e6 on an 8 s span: still resolvable
      [T0, T0 + 8000 / 1e7, 8], // zoom 1e7 (MAX_ZOOM): hung the baseline
      [T0, T0 + 1e-4, 8], // below the float64 spacing at 1.75e12 (~2.4e-4)
      [1e15, 1e15 + 0.5, 10], // step (0.05) below the spacing (0.125)
      [-T0 - 1e-4, -T0, 7],
    ];
    const results = runNiceTicks(cases);
    results.forEach((r, i) => {
      const [min, max, count] = cases[i];
      expect(r.ms).toBeLessThan(250);
      expectValidTicks(r.ticks, min, max, count);
    });
  });

  test("underflowing steps give [] or [min]-like output, never duplicate ticks", () => {
    const [r] = runNiceTicks([[1e15, 1e15 + 0.5, 10]]);
    const distinct = new Set(r.ticks);
    expect(distinct.size).toBe(r.ticks.length);
  });

  test("ordinary ranges still get evenly spaced round ticks", () => {
    const cases: Case[] = [
      [0, 100, 5],
      [-1, 1, 4],
      [0.001, 0.0095, 6],
      [T0, T0 + 3_600_000, 8],
    ];
    const results = runNiceTicks(cases);
    results.forEach((r, i) => {
      const [min, max, count] = cases[i];
      expectValidTicks(r.ticks, min, max, count);
      expect(r.ticks.length).toBeGreaterThanOrEqual(2);
      const t = r.ticks as number[];
      const step = t[1] - t[0];
      for (let k = 2; k < t.length; k++) expect(Math.abs(t[k] - t[k - 1] - step)).toBeLessThan(step * 1e-6);
      // Round values: every tick is a whole multiple of the step.
      for (const v of t) expect(Math.abs(v / step - Math.round(v / step))).toBeLessThan(1e-6);
    });
  });

  test("degenerate input terminates", () => {
    const cases: Case[] = [
      [5, 5, 5],
      [10, 0, 5],
      [0, 1, 0],
      [-1e308, 1e308, 5],
      [0, Number.MAX_VALUE, 3],
    ];
    const results = runNiceTicks(cases);
    results.forEach((r, i) => {
      expect(r.ms).toBeLessThan(250);
      expect(r.ticks.length).toBeLessThanOrEqual(10 * Math.max(cases[i][2], 1) + 10);
    });
  });
});

// ─── rebaseViewOnHomeChange (B16) ────────────────────────────────────────────

interface View {
  panX: number;
  panY: number;
  zoomX: number;
  zoomY: number;
}

// Normalised data at the left/right plot edge of `view` for a chart whose home view is `home`.
function plotEdges(view: View, home: View, axis: "X" | "Y"): [number, number] {
  const hp = home[`pan${axis}`],
    hz = home[`zoom${axis}`];
  const uL = -hp * hz,
    uR = (1 - hp) * hz;
  const p = view[`pan${axis}`],
    z = view[`zoom${axis}`];
  return [p + uL / z, p + uR / z];
}

const OLD_HOME: View = { panX: -0.08, panY: -0.2, zoomX: 0.9, zoomY: 0.8 };
const NEW_HOME: View = { panX: -0.05, panY: -0.25, zoomX: 0.94, zoomY: 0.75 };

describe("rebaseViewOnHomeChange (B16, K14)", () => {
  test("is exported from plugins/shared.ts", async () => {
    expect(typeof (await shared()).rebaseViewOnHomeChange).toBe("function");
  });

  test("a view at the old home becomes the new home", async () => {
    const { rebaseViewOnHomeChange } = await shared();
    expect(typeof rebaseViewOnHomeChange).toBe("function");
    const r = rebaseViewOnHomeChange({ ...OLD_HOME }, OLD_HOME, NEW_HOME);
    for (const k of ["panX", "panY", "zoomX", "zoomY"] as const) expect(r[k]).toBeCloseTo(NEW_HOME[k], 12);
  });

  test("a zoomed view keeps the data at both plot edges (resize keeps the zoom)", async () => {
    const { rebaseViewOnHomeChange } = await shared();
    expect(typeof rebaseViewOnHomeChange).toBe("function");
    const views: View[] = [
      { panX: 0.3, panY: 0.1, zoomX: 5, zoomY: 2 },
      { panX: -0.4, panY: 0.6, zoomX: 0.5, zoomY: 12.5 },
      { panX: 0.49, panY: -0.2, zoomX: 1000, zoomY: 1 },
    ];
    for (const v of views) {
      const r = rebaseViewOnHomeChange({ ...v }, OLD_HOME, NEW_HOME);
      for (const axis of ["X", "Y"] as const) {
        const [a0, a1] = plotEdges(v, OLD_HOME, axis);
        const [b0, b1] = plotEdges(r, NEW_HOME, axis);
        expect(b0).toBeCloseTo(a0, 9);
        expect(b1).toBeCloseTo(a1, 9);
      }
    }
  });

  test("works per axis: an axis at home follows the new home, the other keeps its data", async () => {
    const { rebaseViewOnHomeChange } = await shared();
    expect(typeof rebaseViewOnHomeChange).toBe("function");
    const v: View = { panX: OLD_HOME.panX, zoomX: OLD_HOME.zoomX, panY: 0.2, zoomY: 4 };
    const r = rebaseViewOnHomeChange({ ...v }, OLD_HOME, NEW_HOME);
    expect(r.panX).toBeCloseTo(NEW_HOME.panX, 12);
    expect(r.zoomX).toBeCloseTo(NEW_HOME.zoomX, 12);
    const [a0, a1] = plotEdges(v, OLD_HOME, "Y");
    const [b0, b1] = plotEdges(r, NEW_HOME, "Y");
    expect(b0).toBeCloseTo(a0, 9);
    expect(b1).toBeCloseTo(a1, 9);
  });

  test("does not modify its arguments", async () => {
    const { rebaseViewOnHomeChange } = await shared();
    expect(typeof rebaseViewOnHomeChange).toBe("function");
    const v: View = { panX: 0.3, panY: 0.1, zoomX: 5, zoomY: 2 };
    const oh = { ...OLD_HOME },
      nh = { ...NEW_HOME };
    rebaseViewOnHomeChange(v, oh, nh);
    expect(v).toEqual({ panX: 0.3, panY: 0.1, zoomX: 5, zoomY: 2 });
    expect(oh).toEqual(OLD_HOME);
    expect(nh).toEqual(NEW_HOME);
  });
});

// ─── clickFollowsDrag (B17) ──────────────────────────────────────────────────

describe("clickFollowsDrag (B17, K14)", () => {
  test("exports clickFollowsDrag and CLICK_AFTER_DRAG_MS", async () => {
    const m = await shared();
    expect(typeof m.clickFollowsDrag).toBe("function");
    expect(typeof m.CLICK_AFTER_DRAG_MS).toBe("number");
    expect(m.CLICK_AFTER_DRAG_MS).toBeGreaterThanOrEqual(20);
    expect(m.CLICK_AFTER_DRAG_MS).toBeLessThanOrEqual(500);
  });

  test("true right after a drag ended, false once the window has passed or without a drag", async () => {
    const { clickFollowsDrag, CLICK_AFTER_DRAG_MS } = await shared();
    expect(typeof clickFollowsDrag).toBe("function");
    const end = 1_000_000;
    expect(clickFollowsDrag({ lastDragEndTime: end }, end)).toBe(true);
    expect(clickFollowsDrag({ lastDragEndTime: end }, end + CLICK_AFTER_DRAG_MS - 1)).toBe(true);
    expect(clickFollowsDrag({ lastDragEndTime: end }, end + CLICK_AFTER_DRAG_MS)).toBe(false);
    expect(clickFollowsDrag({ lastDragEndTime: end }, end + 60_000)).toBe(false);
    expect(clickFollowsDrag({}, end)).toBe(false);
  });

  test("defaults `now` to Date.now()", async () => {
    const { clickFollowsDrag } = await shared();
    expect(typeof clickFollowsDrag).toBe("function");
    expect(clickFollowsDrag({ lastDragEndTime: Date.now() })).toBe(true);
    expect(clickFollowsDrag({ lastDragEndTime: Date.now() - 10_000 })).toBe(false);
  });
});

// ─── computeStats (B30) ──────────────────────────────────────────────────────

function expectStddevOf(actual: number, values: number[]) {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const ss = values.reduce((a, b) => a + (b - mean) ** 2, 0);
  const population = Math.sqrt(ss / n);
  const sample = n > 1 ? Math.sqrt(ss / (n - 1)) : 0;
  const ok = Math.abs(actual - population) < 1e-9 * (1 + population) || Math.abs(actual - sample) < 1e-9 * (1 + sample);
  if (!ok) throw new Error(`stddev ${actual} is neither the population (${population}) nor the sample (${sample}) value`);
}

describe("computeStats (B30, K14)", () => {
  test("is exported from plugins/experimental/stats.ts", async () => {
    expect(typeof (await import(STATS)).computeStats).toBe("function");
  });

  test("ignores gaps and infinities instead of reporting NaN", async () => {
    const { computeStats } = await import(STATS);
    expect(typeof computeStats).toBe("function");
    const s = computeStats([1, NaN, 3, Infinity, -Infinity, null as any, 5]);
    expect(s).not.toBeNull();
    expect(s.count).toBe(3);
    expect(s.min).toBe(1);
    expect(s.max).toBe(5);
    expect(s.mean).toBeCloseTo(3, 12);
    expectStddevOf(s.stddev, [1, 3, 5]);
    for (const k of ["min", "max", "mean", "stddev"]) expect(Number.isFinite(s[k])).toBe(true);
  });

  test("returns null when no finite value is left", async () => {
    const { computeStats } = await import(STATS);
    expect(typeof computeStats).toBe("function");
    expect(computeStats([])).toBeNull();
    expect(computeStats([NaN, NaN])).toBeNull();
    expect(computeStats(new Float64Array([NaN, Infinity]))).toBeNull();
  });

  test("accepts large typed arrays", async () => {
    const { computeStats } = await import(STATS);
    expect(typeof computeStats).toBe("function");
    const n = 200_000;
    const v = new Float64Array(n);
    for (let i = 0; i < n; i++) v[i] = 1000 + (i % 2 === 0 ? -1 : 1);
    const s = computeStats(v);
    expect(s.count).toBe(n);
    expect(s.min).toBe(999);
    expect(s.max).toBe(1001);
    expect(s.mean).toBeCloseTo(1000, 6);
    expect(s.stddev).toBeGreaterThan(0.99);
    expect(s.stddev).toBeLessThan(1.01);
  });

  test("a single value has zero spread", async () => {
    const { computeStats } = await import(STATS);
    expect(typeof computeStats).toBe("function");
    const s = computeStats([42]);
    expect(s).toMatchObject({ min: 42, max: 42, mean: 42, count: 1 });
    expect(s.stddev === 0 || Number.isNaN(s.stddev)).toBe(true);
  });
});
