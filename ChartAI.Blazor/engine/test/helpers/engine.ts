// Drives the real main-thread engine (src/chart-library.ts) against the FakeWorker of env.ts.
// Every call to startEngine() loads a fresh copy of the module, i.e. a fresh ChartManager
// singleton, so tests never share charts, workers or sync settings.
import { E, M } from "../../src/msg.ts";
import { env, FakeWorker, flushFrames, waitForWorker } from "./env.ts";

export { E, M };

// Lets queued work finish: animation frames, microtasks and one macrotask, twice.
export async function settle(): Promise<void> {
  for (let i = 0; i < 2; i++) {
    flushFrames();
    await new Promise((r) => setTimeout(r, 0));
  }
  flushFrames();
}

// The worker's "device lost" report. K12 leaves the message to the implementers: a dedicated
// M.DEVICE_LOST if msg.ts has one, else the existing M.ERROR with code E.DEVICE_LOST.
export function deviceLostMessage(): any {
  const dedicated = (M as any).DEVICE_LOST;
  return typeof dedicated === "number" ? { type: dedicated } : { type: M.ERROR, code: E.DEVICE_LOST };
}

export function isDeviceLostMessage(msg: any): boolean {
  const dedicated = (M as any).DEVICE_LOST;
  return (
    (typeof dedicated === "number" && msg?.type === dedicated) ||
    (msg?.type === M.ERROR && msg?.code === E.DEVICE_LOST)
  );
}

let seq = 0;

// A fresh instance of src/chart-library.ts (and with it a fresh ChartManager singleton).
export async function importEngine(): Promise<any> {
  return import(`../../src/chart-library.ts?engine-instance=${++seq}`);
}

export interface Engine {
  lib: any;
  mgr: any;
  worker: FakeWorker;
  init: Promise<boolean>;
}

// Loads a fresh engine, registers the renderers, starts init() and (unless ready: false)
// answers GPU_READY from the fake worker.
export async function startEngine(
  renderers: any[] = [],
  opts: { ready?: boolean } = {},
): Promise<Engine> {
  const lib = await importEngine();
  const mgr = lib.ChartManager;
  for (const r of renderers) mgr.use(r);
  const index = env().workers.length;
  const init = Promise.resolve(mgr.init());
  const worker = await waitForWorker(index);
  if (opts.ready !== false) {
    worker.emit({ type: M.GPU_READY });
    const ok = await init;
    if (ok !== true) throw new Error(`init() resolved ${ok}`);
  }
  return { lib, mgr, worker, init };
}

export interface TestChart {
  handle: any;
  id: string;
  container: HTMLElement;
  // The engine's InternalChart (a documented, exported type; plugins read it).
  internal: () => any;
}

export async function makeChart(eng: Engine, config: Record<string, any>): Promise<TestChart> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const handle = await eng.mgr.create({ container, series: [], ...config });
  const id: string = handle.id;
  return { handle, id, container, internal: () => eng.mgr["charts"].get(id) };
}

export const BLUE = { r: 0.2, g: 0.4, b: 0.8 };
export const RED = { r: 0.9, g: 0.2, b: 0.1 };

export function series(
  label: string,
  x: ArrayLike<number | null>,
  y: ArrayLike<number | null>,
  extra: Record<string, unknown> = {},
): any {
  return { label, color: BLUE, x, y, ...extra };
}

export function range(n: number, f: (i: number) => number = (i) => i): number[] {
  return Array.from({ length: n }, (_, i) => f(i));
}

// The x values of series `i` as the worker received them in an UPDATE_SERIES message.
export function postedX(msg: any, i = 0): Float32Array {
  return (msg.sharedX ?? msg.series[i].dataX) as Float32Array;
}

// Visible data window of a chart view over its bounds (whole canvas, normalised pan/zoom).
export function visibleX(c: { bounds: any; view: any }): [number, number] {
  const full = c.bounds.maxX - c.bounds.minX;
  const x0 = c.bounds.minX + c.view.panX * full;
  return [x0, x0 + full / c.view.zoomX];
}

export function visibleY(c: { bounds: any; view: any }): [number, number] {
  const full = c.bounds.maxY - c.bounds.minY;
  const y0 = c.bounds.minY + c.view.panY * full;
  return [y0, y0 + full / c.view.zoomY];
}

// View transform that shows [x0, x1] x [y0, y1] of the given bounds across the whole canvas.
export function viewFor(bounds: any, x0: number, x1: number, y0: number, y1: number) {
  const fx = bounds.maxX - bounds.minX,
    fy = bounds.maxY - bounds.minY;
  return {
    panX: (x0 - bounds.minX) / fx,
    zoomX: fx / (x1 - x0),
    panY: (y0 - bounds.minY) / fy,
    zoomY: fy / (y1 - y0),
  };
}
