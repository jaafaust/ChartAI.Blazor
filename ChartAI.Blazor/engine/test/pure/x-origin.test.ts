// K3 (B3): x goes to the GPU as float32 relative to a float64 origin, so epoch timestamps keep
// their resolution. toGpu and chooseOriginX are exported from src/chart-library.ts (K14).
import { describe, expect, test } from "bun:test";

async function lib(): Promise<any> {
  const m = await import("../../src/chart-library.ts");
  expect(typeof m.toGpu).toBe("function");
  expect(typeof m.chooseOriginX).toBe("function");
  return m;
}

function expectStrictlyIncreasing(a: ArrayLike<number>) {
  let bad = -1;
  for (let i = 1; i < a.length; i++)
    if (!(a[i] > a[i - 1])) {
      bad = i;
      break;
    }
  if (bad >= 0) throw new Error(`not strictly increasing at ${bad}: ${a[bad - 1]} -> ${a[bad]}`);
}

const T0 = 1_750_000_000_000; // epoch ms, ~2025

function rebased(m: any, x: Float64Array): Float32Array {
  const origin = m.chooseOriginX(x[0], x[x.length - 1]);
  expect(Number.isFinite(origin)).toBe(true);
  expect(origin).toBeLessThanOrEqual(x[0]);
  const g = m.toGpu(x, 1, -origin);
  expect(g).toBeInstanceOf(Float32Array);
  expect(g.length).toBe(x.length);
  return g;
}

describe("toGpu / chooseOriginX (B3, K3)", () => {
  test("epoch-ms at 1 s spacing over one hour stay distinct and increasing in f32", async () => {
    const m = await lib();
    const x = Float64Array.from({ length: 3601 }, (_, i) => T0 + i * 1000);
    expectStrictlyIncreasing(rebased(m, x));
  });

  test("epoch-ms at 1 ms spacing (1 kHz for 10 s) stay distinct", async () => {
    const m = await lib();
    const x = Float64Array.from({ length: 10_000 }, (_, i) => T0 + 123 + i);
    expectStrictlyIncreasing(rebased(m, x));
  });

  test("epoch seconds at 60 s spacing over a day stay distinct", async () => {
    const m = await lib();
    const x = Float64Array.from({ length: 1441 }, (_, i) => 1_750_000_000 + i * 60);
    expectStrictlyIncreasing(rebased(m, x));
  });

  test("the rebased values keep the spacing (a 1 h series is not drawn as stairs)", async () => {
    const m = await lib();
    const x = Float64Array.from({ length: 3601 }, (_, i) => T0 + i * 1000);
    const g = rebased(m, x);
    for (let i = 1; i < g.length; i++) expect(Math.abs(g[i] - g[i - 1] - 1000)).toBeLessThan(1);
  });

  test("the origin is never above the minimum, also for negative and single-point data", async () => {
    const m = await lib();
    const cases: [number, number][] = [
      [0, 100],
      [-5000, -4000],
      [T0, T0],
      [-T0, -T0 + 60_000],
      [0.001, 0.002],
      [1e15, 1e15 + 1e6],
    ];
    for (const [lo, hi] of cases) {
      const o = m.chooseOriginX(lo, hi);
      expect(Number.isFinite(o)).toBe(true);
      expect(o).toBeLessThanOrEqual(lo);
    }
  });

  test("gaps (null / NaN) stay the GPU gap marker whatever the offset", async () => {
    const m = await lib();
    const g = m.toGpu([1, null, NaN, 2], 1, -1000);
    expect(g[0]).toBe(-999);
    expect(g[3]).toBe(-998);
    expect(g[1]).toBeLessThan(-1e38);
    expect(g[2]).toBeLessThan(-1e38);
    const plain = m.toGpu([5, null]);
    expect(plain[0]).toBe(5);
    expect(plain[1]).toBeLessThan(-1e38);
  });
});
