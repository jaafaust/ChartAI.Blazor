// Test environment: happy-dom for the DOM plus deterministic fakes for everything the engine's
// main thread needs from a browser that happy-dom does not provide (or provides without ever
// firing): Worker, ResizeObserver, IntersectionObserver, matchMedia, requestAnimationFrame,
// devicePixelRatio and canvas.transferControlToOffscreen.
//
// State lives on globalThis so the preload (test/setup/preload.ts) and the test files share it
// even when `bun test --isolate` gives every file its own module registry.
import { GlobalRegistrator } from "@happy-dom/global-registrator";

export interface Posted {
  msg: any;
  transfer: unknown[];
}

type Listener = (ev: any) => void;

// ─── Worker ──────────────────────────────────────────────────────────────────
// Records every message the main thread posts; tests answer with emit().
export class FakeWorker {
  url: unknown;
  options: unknown;
  posted: Posted[] = [];
  onmessage: Listener | null = null;
  onerror: Listener | null = null;
  onmessageerror: Listener | null = null;
  terminated = false;
  private listeners = new Map<string, Set<Listener>>();

  constructor(url?: unknown, options?: unknown) {
    this.url = url;
    this.options = options;
    env().workers.push(this);
  }

  postMessage(msg: any, transfer?: unknown): void {
    const list = Array.isArray(transfer)
      ? transfer
      : ((transfer as { transfer?: unknown[] } | undefined)?.transfer ?? []);
    this.posted.push({ msg, transfer: list });
  }

  addEventListener(type: string, fn: Listener): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }

  removeEventListener(type: string, fn: Listener): void {
    this.listeners.get(type)?.delete(fn);
  }

  terminate(): void {
    this.terminated = true;
  }

  // Delivers a message from the (fake) worker to the main thread.
  emit(data: any): void {
    const ev = { data, type: "message", target: this, currentTarget: this };
    this.onmessage?.(ev);
    for (const fn of [...(this.listeners.get("message") ?? [])]) fn(ev);
  }

  emitError(error: unknown): void {
    const ev = { type: "error", error, message: String(error), target: this };
    this.onerror?.(ev);
    for (const fn of [...(this.listeners.get("error") ?? [])]) fn(ev);
  }

  // Posted messages, optionally filtered by type (M.*) and chart id.
  messages(type?: number, id?: string): any[] {
    return this.posted
      .map((p) => p.msg)
      .filter((m) => m && (type === undefined || m.type === type) && (id === undefined || m.id === id));
  }

  last(type: number, id?: string): any {
    const list = this.messages(type, id);
    return list[list.length - 1];
  }

  clear(): void {
    this.posted = [];
  }
}

// ─── Observers ───────────────────────────────────────────────────────────────
export class FakeResizeObserver {
  callback: (entries: any[], observer: FakeResizeObserver) => void;
  targets = new Map<Element, { box?: string }>();

  constructor(cb: (entries: any[], observer: FakeResizeObserver) => void) {
    this.callback = cb;
    env().resizeObservers.push(this);
  }
  observe(target: Element, options?: { box?: string }): void {
    this.targets.set(target, options ?? {});
  }
  unobserve(target: Element): void {
    this.targets.delete(target);
  }
  disconnect(): void {
    this.targets.clear();
  }
}

export class FakeIntersectionObserver {
  callback: (entries: any[], observer: FakeIntersectionObserver) => void;
  targets = new Set<Element>();
  root = null;
  rootMargin = "0px";
  thresholds = [0.01];

  constructor(cb: (entries: any[], observer: FakeIntersectionObserver) => void) {
    this.callback = cb;
    env().intersectionObservers.push(this);
  }
  observe(t: Element): void {
    this.targets.add(t);
  }
  unobserve(t: Element): void {
    this.targets.delete(t);
  }
  disconnect(): void {
    this.targets.clear();
  }
  takeRecords(): any[] {
    return [];
  }
}

// ─── matchMedia ──────────────────────────────────────────────────────────────
export class FakeMediaQueryList {
  media: string;
  onchange: Listener | null = null;
  private listeners = new Set<Listener>();

  constructor(media: string) {
    this.media = media;
    env().mediaQueries.push(this);
  }
  get matches(): boolean {
    const m = /resolution\s*:\s*([\d.]+)\s*dppx/i.exec(this.media);
    if (m) return Math.abs(Number(m[1]) - env().dpr) < 1e-9;
    const r = /device-pixel-ratio\s*:\s*([\d.]+)/i.exec(this.media);
    if (r) return Math.abs(Number(r[1]) - env().dpr) < 1e-9;
    return false;
  }
  addEventListener(type: string, fn: Listener): void {
    if (type === "change") this.listeners.add(fn);
  }
  removeEventListener(type: string, fn: Listener): void {
    if (type === "change") this.listeners.delete(fn);
  }
  addListener(fn: Listener): void {
    this.listeners.add(fn);
  }
  removeListener(fn: Listener): void {
    this.listeners.delete(fn);
  }
  dispatchEvent(): boolean {
    return true;
  }
  fireChange(): void {
    const ev = { type: "change", matches: this.matches, media: this.media, target: this };
    this.onchange?.(ev);
    for (const fn of [...this.listeners]) fn(ev);
  }
  get listenerCount(): number {
    return this.listeners.size + (this.onchange ? 1 : 0);
  }
}

// ─── OffscreenCanvas ─────────────────────────────────────────────────────────
export class FakeOffscreenCanvas {
  width: number;
  height: number;
  source: unknown;
  contexts: unknown[] = [];

  constructor(width: number, height: number, source?: unknown) {
    this.width = width;
    this.height = height;
    this.source = source;
    env().offscreens.push(this);
  }
  getContext(type: string): unknown {
    const factory = env().gpuContextFactory;
    if (type === "webgpu" && factory) {
      const ctx = factory(this);
      this.contexts.push(ctx);
      return ctx;
    }
    return null;
  }
}

// ─── Shared state ────────────────────────────────────────────────────────────
interface FrameCallback {
  id: number;
  cb: (t: number) => void;
}

export interface TestEnv {
  workers: FakeWorker[];
  resizeObservers: FakeResizeObserver[];
  intersectionObservers: FakeIntersectionObserver[];
  mediaQueries: FakeMediaQueryList[];
  offscreens: FakeOffscreenCanvas[];
  frames: FrameCallback[];
  nextFrameId: number;
  timeOffset: number;
  dpr: number;
  sizes: WeakMap<Element, { width: number; height: number }>;
  gpuContextFactory: ((canvas: FakeOffscreenCanvas) => unknown) | null;
}

const KEY = "__chartaiTestEnv";

export function env(): TestEnv {
  const g = globalThis as any;
  if (!g[KEY]) throw new Error("test env not installed: bunfig.toml preload missing?");
  return g[KEY];
}

function setGlobal(name: string, value: unknown): void {
  const targets = [globalThis as any];
  const w = (globalThis as any).window;
  if (w && w !== globalThis) targets.push(w);
  for (const t of targets) {
    try {
      Object.defineProperty(t, name, { value, writable: true, configurable: true });
    } catch {
      try {
        t[name] = value;
      } catch {}
    }
  }
}

export function installEnv(): void {
  const g = globalThis as any;
  if (g[KEY]) return;
  if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register({ width: 1280, height: 800 });

  const state: TestEnv = {
    workers: [],
    resizeObservers: [],
    intersectionObservers: [],
    mediaQueries: [],
    offscreens: [],
    frames: [],
    nextFrameId: 1,
    timeOffset: 0,
    dpr: 1,
    sizes: new WeakMap(),
    gpuContextFactory: null,
  };
  g[KEY] = state;

  setGlobal("Worker", FakeWorker);
  setGlobal("ResizeObserver", FakeResizeObserver);
  setGlobal("IntersectionObserver", FakeIntersectionObserver);
  setGlobal("OffscreenCanvas", FakeOffscreenCanvas);
  setGlobal("matchMedia", (q: string) => new FakeMediaQueryList(String(q)));
  setGlobal("requestAnimationFrame", (cb: (t: number) => void) => {
    const id = state.nextFrameId++;
    state.frames.push({ id, cb });
    return id;
  });
  setGlobal("cancelAnimationFrame", (id: number) => {
    state.frames = state.frames.filter((f) => f.id !== id);
  });
  for (const t of [globalThis as any, (globalThis as any).window]) {
    if (!t) continue;
    try {
      Object.defineProperty(t, "devicePixelRatio", {
        get: () => state.dpr,
        set: (v: number) => {
          state.dpr = v;
        },
        configurable: true,
      });
    } catch {}
  }

  // A controllable clock: advanceTime() and flushFrames() move performance.now() forward.
  const perf = globalThis.performance as any;
  const realNow = perf.now.bind(perf);
  try {
    Object.defineProperty(perf, "now", {
      value: () => realNow() + state.timeOffset,
      writable: true,
      configurable: true,
    });
  } catch {}

  // Browser semantics: a canvas can hand its control to an OffscreenCanvas once.
  const canvasProto = (globalThis as any).HTMLCanvasElement.prototype;
  canvasProto.transferControlToOffscreen = function (this: any) {
    if (this.__chartaiTransferred)
      throw new DOMException("Cannot transfer control from a canvas more than once.", "InvalidStateError");
    this.__chartaiTransferred = true;
    return new FakeOffscreenCanvas(this.width || 300, this.height || 150, this);
  };
  canvasProto.getContext = function () {
    return null;
  };

  // Layout: elements report the size a test gave them (resizeElement), else happy-dom's zeros.
  const elProto = (globalThis as any).Element.prototype;
  const realRect = elProto.getBoundingClientRect;
  elProto.getBoundingClientRect = function (this: Element) {
    const s = state.sizes.get(this);
    if (!s) return realRect.call(this);
    return {
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      width: s.width,
      height: s.height,
      right: s.width,
      bottom: s.height,
      toJSON() {
        return this;
      },
    };
  };
}

// Resets the fakes between tests (objects created by earlier tests are forgotten).
export function resetEnv(): void {
  const s = env();
  s.workers.length = 0;
  s.resizeObservers.length = 0;
  s.intersectionObservers.length = 0;
  s.mediaQueries.length = 0;
  s.offscreens.length = 0;
  s.frames = [];
  s.timeOffset = 0;
  s.dpr = 1;
  s.gpuContextFactory = null;
}

// ─── Helpers for tests ───────────────────────────────────────────────────────

export function advanceTime(ms: number): void {
  env().timeOffset += ms;
}

// Runs queued animation frames (and the frames they queue) until none are left, advancing the
// clock by `stepMs` per frame. Returns the number of frame rounds run.
export function flushFrames(opts: { stepMs?: number; maxRounds?: number } = {}): number {
  const s = env();
  const step = opts.stepMs ?? 16;
  const max = opts.maxRounds ?? 500;
  let rounds = 0;
  while (s.frames.length > 0 && rounds < max) {
    const batch = s.frames;
    s.frames = [];
    s.timeOffset += step;
    const now = performance.now();
    for (const f of batch) f.cb(now);
    rounds++;
  }
  return rounds;
}

export function pendingFrames(): number {
  return env().frames.length;
}

export function setElementSize(el: Element, width: number, height: number): void {
  env().sizes.set(el, { width, height });
}

function entryFor(target: Element, width: number, height: number, dpr: number) {
  return {
    target,
    contentRect: { x: 0, y: 0, left: 0, top: 0, width, height, right: width, bottom: height },
    contentBoxSize: [{ inlineSize: width, blockSize: height }],
    borderBoxSize: [{ inlineSize: width, blockSize: height }],
    devicePixelContentBoxSize: [{ inlineSize: Math.round(width * dpr), blockSize: Math.round(height * dpr) }],
  };
}

// Simulates a CSS size change of `root` (and everything observed inside it): fires every
// ResizeObserver watching root or one of its descendants.
export function resizeElement(root: Element, width: number, height: number): void {
  const s = env();
  for (const ro of [...s.resizeObservers]) {
    const entries: any[] = [];
    for (const [t] of ro.targets) {
      if (t === root || root.contains(t)) {
        setElementSize(t, width, height);
        entries.push(entryFor(t, width, height, s.dpr));
      }
    }
    if (entries.length) ro.callback(entries, ro);
  }
  setElementSize(root, width, height);
}

// Simulates moving the window to a monitor with another devicePixelRatio without any CSS size
// change: resolution media queries fire "change", and only ResizeObservers watching the
// device-pixel-content-box fire (a content-box observer does not, as in a browser).
export function changeDevicePixelRatio(dpr: number): void {
  const s = env();
  s.dpr = dpr;
  for (const mq of [...s.mediaQueries]) {
    if (/resolution|pixel-ratio|dppx/i.test(mq.media)) mq.fireChange();
  }
  for (const ro of [...s.resizeObservers]) {
    const entries: any[] = [];
    for (const [t, opts] of ro.targets) {
      if (opts?.box === "device-pixel-content-box") {
        const size = s.sizes.get(t) ?? { width: 400, height: 200 };
        entries.push(entryFor(t, size.width, size.height, dpr));
      }
    }
    if (entries.length) ro.callback(entries, ro);
  }
}

export async function waitFor<T>(
  fn: () => T | undefined | null | false,
  timeoutMs = 2000,
  label = "condition",
): Promise<T> {
  const t0 = Date.now();
  for (;;) {
    const v = fn();
    if (v) return v as T;
    if (Date.now() - t0 > timeoutMs) throw new Error(`timed out after ${timeoutMs} ms waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 2));
  }
}

export async function waitForWorker(index = 0, timeoutMs = 2000): Promise<FakeWorker> {
  return waitFor(() => env().workers[index], timeoutMs, `worker #${index}`);
}
