// The zoom plugin on a DOM element (happy-dom): zoomMode "none" must leave page scrolling alone
// (B18), and wheel zoom must stop before the visible span collapses into float64 spacing (B1
// backup, plugin side).
import { beforeEach, describe, expect, test } from "bun:test";
import { resetEnv, setElementSize } from "../helpers/env.ts";
import { zoomPlugin } from "../../src/plugins/zoom.ts";

beforeEach(() => resetEnv());

const W = 400,
  H = 300;

function fakeChart(zoomMode: string, bounds = { minX: 0, maxX: 100, minY: 0, maxY: 10 }) {
  const el = document.createElement("div");
  document.body.appendChild(el);
  setElementSize(el, W, H);
  const mk = () => document.createElement("canvas");
  const chart: any = {
    id: `zoom-${Math.random().toString(36).slice(2)}`,
    config: { type: "line", container: el, series: [], zoomMode },
    el,
    backCanvas: mk(),
    frontCanvas: mk(),
    width: W,
    height: H,
    dpr: 1,
    series: [],
    bounds,
    view: { panX: 0, panY: 0, zoomX: 1, zoomY: 1 },
    homeView: { panX: 0, panY: 0, zoomX: 1, zoomY: 1 },
    visible: false,
    dragging: false,
    plugins: [],
    renderer: { name: "line", shaders: {}, passes: [] },
    customUniforms: {},
    yAxes: null,
  };
  return { chart, el };
}

// A wheel event over the middle of the plot area (outside the axis gutters).
function wheel(el: HTMLElement, deltaY: number): Event {
  const ev = new (globalThis as any).WheelEvent("wheel", {
    deltaY,
    clientX: W / 2,
    clientY: H / 3,
    bubbles: true,
    cancelable: true,
  });
  // happy-dom's WheelEvent ignores the MouseEvent coordinates of its init dict.
  Object.defineProperty(ev, "clientX", { value: W / 2 });
  Object.defineProperty(ev, "clientY", { value: H / 3 });
  el.dispatchEvent(ev);
  return ev;
}

describe('zoomMode "none" (B18)', () => {
  test("a wheel over the plot is not prevented, so the page scrolls", () => {
    const plugin = zoomPlugin();
    const { chart, el } = fakeChart("none");
    plugin.install!(chart, el);
    const ev = wheel(el, 100);
    expect(ev.defaultPrevented).toBe(false);
    expect(chart.view).toEqual({ panX: 0, panY: 0, zoomX: 1, zoomY: 1 });
    plugin.uninstall!(chart);
  });

  test("touch-action is not forced to none", () => {
    const plugin = zoomPlugin();
    const { chart, el } = fakeChart("none");
    plugin.install!(chart, el);
    expect(el.style.touchAction).not.toBe("none");
    plugin.uninstall!(chart);
  });

  test('other modes still capture the wheel (regression guard)', () => {
    const plugin = zoomPlugin();
    const { chart, el } = fakeChart("both");
    plugin.install!(chart, el);
    const ev = wheel(el, -100);
    expect(ev.defaultPrevented).toBe(true);
    expect(chart.view.zoomX).toBeGreaterThan(1);
    plugin.uninstall!(chart);
  });
});

describe("zoom clamp at float64 spacing (B1 backup)", () => {
  test("wheel zoom on epoch-ms data stops while the visible span is still above the float spacing", () => {
    const plugin = zoomPlugin();
    const T0 = 1.75e12;
    const { chart, el } = fakeChart("x-only", { minX: T0, maxX: T0 + 1000, minY: 0, maxY: 1 });
    plugin.install!(chart, el);
    for (let i = 0; i < 400; i++) wheel(el, -1000);
    const span = (chart.bounds.maxX - chart.bounds.minX) / chart.view.zoomX;
    const ulp = 2 ** (Math.floor(Math.log2(T0)) - 52);
    expect(Number.isFinite(span)).toBe(true);
    expect(span).toBeGreaterThan(2 * ulp);
    plugin.uninstall!(chart);
  });
});
