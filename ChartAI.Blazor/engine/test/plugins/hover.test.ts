// The hover plugin's pill animation (P3): it must stop requesting animation frames once the pill
// has settled, and when the hover ends while tooltips are off.
import { beforeEach, describe, expect, test } from "bun:test";
import { flushFrames, pendingFrames, resetEnv, resizeElement } from "../helpers/env.ts";
import { makeChart, range, series, startEngine } from "../helpers/engine.ts";
import { LineChart } from "../../src/charts/line.ts";
import { hoverPlugin } from "../../src/plugins/hover.ts";

beforeEach(() => resetEnv());

// A flat line through the middle of a 400 x 200 chart, and the mouse resting on it.
async function hoveredChart() {
  const eng = await startEngine([LineChart]);
  eng.mgr.use(hoverPlugin);
  const hits: unknown[] = [];
  const c = await makeChart(eng, { type: "line", showTooltip: true, onHover: (d: unknown) => hits.push(d) });
  resizeElement(c.container, 400, 200);
  c.handle.setData([series("a", range(51), range(51, () => 5))]);
  flushFrames();
  const wrap = c.internal().el.querySelector("div") as HTMLElement;
  wrap.dispatchEvent(new (globalThis as any).MouseEvent("mousemove", { clientX: 200, clientY: 100, bubbles: true }));
  expect(hits.length).toBeGreaterThan(0);
  expect(hits[hits.length - 1]).toBeTruthy(); // the cursor is on the line
  return { c, wrap, hits };
}

describe("hover pill animation (P3)", () => {
  test("stops requesting frames once the pill has settled", async () => {
    await hoveredChart();
    flushFrames({ maxRounds: 300 });
    expect(pendingFrames()).toBe(0);
  });

  test("stops when the hover ends while showTooltip is off", async () => {
    const { c, wrap } = await hoveredChart();
    c.internal().config.showTooltip = false;
    wrap.dispatchEvent(new (globalThis as any).MouseEvent("mouseleave", { bubbles: false }));
    flushFrames({ maxRounds: 300 });
    expect(pendingFrames()).toBe(0);
  });
});
