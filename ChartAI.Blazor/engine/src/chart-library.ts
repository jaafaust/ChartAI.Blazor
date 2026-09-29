export type {
  ZoomMode,
  ChartColor,
  ChartSeries,
  HoverData,
  RenderContext,
  BindingDef,
  PassDef,
  BufferDef,
  UniformDef,
  PassMeta,
  RendererPlugin,
  ChartPlugin,
  ChartConfig,
  ChartStats,
  InternalChart,
  InternalSeries,
  BufferUsage,
  BlendFactor,
  BlendOperation,
  BlendComponent,
  BlendState,
  Bounds,
  DataArray,
  YAxisDef,
  ResolvedYAxis,
  SeriesPatch,
  UpdateSeriesOptions,
  SyncViews,
  ConfigPatch,
} from "./types.ts";

import type {
  ChartColor,
  ChartSeries,
  ChartConfig,
  ChartStats,
  ChartPlugin,
  InternalChart,
  InternalSeries,
  RendererPlugin,
  RenderContext,
  PassMeta,
  ChartTypeRegistry,
  AllPluginOptions,
  Bounds,
  DataArray,
  SeriesPatch,
  UpdateSeriesOptions,
  SyncViews,
  UniformDef,
  ConfigPatch,
} from "./types.ts";
import { M, E } from "./msg.ts";
import { Y_PLOT_CHANNELS, yAxisDefs } from "./plugins/shared.ts";

export class Chart<C extends ChartConfig = ChartConfig> {
  readonly id: string;
  private readonly _mgr: _ChartManager;

  constructor(id: string, mgr: _ChartManager) {
    this.id = id;
    this._mgr = mgr;
  }

  private get _c(): InternalChart<any> | undefined {
    return this._mgr["charts"].get(this.id);
  }

  setData(series: ChartSeries[], opts?: UpdateSeriesOptions): void {
    this._mgr.updateSeries(this.id, series, opts);
  }

  // Follow-mode path: writes columns [offset, count) into the existing GPU buffers, see ChartManager.patchSeries.
  patchData(patch: SeriesPatch): void {
    this._mgr.patchSeries(this.id, patch);
  }

  // Moves the runtime window; resetView also puts the view home (and reports the view change).
  setBounds(bounds: Partial<Bounds>, resetView = false): void {
    this._mgr.setBounds(this.id, bounds, resetView);
  }

  // Merges `patch` into the config; a key set to null resets that option (see ConfigPatch).
  configure(patch: ConfigPatch<C>): void {
    this._mgr.configureChart(this.id, patch as Record<string, unknown>);
  }

  addPlugin(plugin: ChartPlugin<any>): void {
    const c = this._c;
    if (!c || c.plugins.some((p) => p.name === plugin.name)) return;
    const wrap = c.el.querySelector("div") as HTMLElement;
    plugin.install?.(c, wrap);
    c.plugins.push(plugin);
    this._mgr.drawChart(c);
  }

  removePlugin(name: string): void {
    const c = this._c;
    if (!c) return;
    const idx = c.plugins.findIndex((p) => p.name === name);
    if (idx >= 0) {
      c.plugins[idx].uninstall?.(c);
      c.plugins.splice(idx, 1);
      this._mgr.drawChart(c);
    }
  }

  hasPlugin(name: string): boolean {
    return this._c?.plugins.some((p) => p.name === name) ?? false;
  }

  resetView(): void {
    this._mgr.resetView(this.id);
  }
  destroy(): void {
    this._mgr.destroy(this.id);
  }
}

// The value a missing sample becomes in the GPU buffers; the shaders treat anything below
// -1e38 as a gap (see shaders/line.ts).
const GPU_GAP = -3e38;
// A missing x of sorted data, which sortOrder puts last: +3e38 keeps the x buffer ascending for
// the shaders' binary search (-3e38 at its end would not), and it lies off every view.
const GPU_X_GAP_SORTED = 3e38;

function isNumericArray(v: unknown): v is DataArray {
  return Array.isArray(v) || (ArrayBuffer.isView(v) && !(v instanceof DataView));
}

// A missing sample is null/NaN on the JS side and GPU_GAP on the GPU: NaN is not reliable in
// WGSL, and Float32Array would silently turn null into 0. `offset` is applied in float64 before
// the conversion, which is what keeps rebased x (offset = -originX) precise.
export function toGpu(arr: DataArray, scale = 1, offset = 0, gap = GPU_GAP): Float32Array {
  const n = arr.length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = arr[i];
    out[i] = v == null || v !== v ? gap : v * scale + offset;
  }
  return out;
}

// The gap marker of x on the GPU for a chart's renderer (see GPU_X_GAP_SORTED).
function xGap(chart: InternalChart<any>): number {
  return chart.renderer.sortX !== false ? GPU_X_GAP_SORTED : GPU_GAP;
}

function packInto(
  dst: Float32Array,
  dstOffset: number,
  src: DataArray,
  srcOffset: number,
  k: number,
  scale = 1,
  offset = 0,
): void {
  for (let i = 0; i < k; i++) {
    const v = src[srcOffset + i];
    dst[dstOffset + i] = v == null || v !== v ? GPU_GAP : v * scale + offset;
  }
}

// The affine remap of a secondary-axis series into primary-axis space; a gap stays a gap.
function mapInto(
  dst: Float64Array,
  dstOffset: number,
  src: DataArray,
  srcOffset: number,
  k: number,
  scale: number,
  offset: number,
): void {
  for (let i = 0; i < k; i++) {
    const v = src[srcOffset + i];
    dst[dstOffset + i] = v == null || v !== v ? NaN : v * scale + offset;
  }
}

// Columns [start, end) of an array: the array itself when that is all of it, a view of a typed
// array, a copy of a plain one.
function view(arr: DataArray, start: number, end: number): DataArray {
  if (start === 0 && arr.length === end) return arr;
  const a = arr as any;
  return typeof a.subarray === "function"
    ? a.subarray(start, end)
    : Array.prototype.slice.call(arr, start, end);
}

// ─── x origin (float32 precision) ────────────────────────────────────────────
// The GPU works in float32, whose 24-bit mantissa quantises epoch milliseconds (~1.7e12) to
// 131 s steps. The main thread therefore subtracts a per-chart float64 origin from every x it
// sends; the worker and the shaders only ever see x - originX. The origin is a multiple of a
// round period (day, hour, minute, second in ms or s) so time buckets stay aligned.
const ORIGIN_PERIODS = [86400000, 3600000, 86400, 60000, 3600, 1000, 60, 1];

// The origin for data spanning [minX, maxX]: 0 when the values are small against their range
// (nothing to gain), else minX rounded down to the largest period of at most 16 ranges.
// Never above minX.
export function chooseOriginX(minX: number, maxX: number): number {
  if (!Number.isFinite(minX)) return 0;
  const range = Number.isFinite(maxX) && maxX > minX ? maxX - minX : 0;
  const limit = 16 * range;
  if (minX >= 0 && minX <= limit) return 0;
  for (const p of ORIGIN_PERIODS) if (p <= limit) return Math.floor(minX / p) * p;
  return Math.floor(minX);
}

// Once rebased x lies further from the origin than this many data (or window) spans, patched
// data re-uploads with a fresh origin: float32 then starts to quantise what is drawn.
const REORIGIN_SPANS = 64;

// The first and last finite value of an ascending array (gaps at either end are skipped), or of
// any array with `sorted` false. [Infinity, -Infinity] when there is none.
function finiteRange(arr: DataArray, sorted: boolean): [number, number] {
  const n = arr.length;
  let lo = Infinity,
    hi = -Infinity;
  if (sorted) {
    for (let i = 0; i < n; i++) {
      const v = arr[i];
      // v - v is 0 for a finite number and NaN for NaN or +-Infinity.
      if (v != null && v - v === 0) {
        lo = v;
        break;
      }
    }
    for (let i = n - 1; i >= 0; i--) {
      const v = arr[i];
      if (v != null && v - v === 0) {
        hi = v;
        break;
      }
    }
    return [lo, hi];
  }
  for (let i = 0; i < n; i++) {
    const v = arr[i];
    if (v == null || v - v !== 0) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return [lo, hi];
}

// ─── Sorting x ───────────────────────────────────────────────────────────────

// Stable sort of the indices a[0..m) by keys[], typed arrays only (no boxed comparator):
// insertion-sorted runs merged bottom-up.
function sortIndices(a: Uint32Array, m: number, keys: Float64Array): void {
  const RUN = 32;
  for (let lo = 0; lo < m; lo += RUN) {
    const hi = Math.min(lo + RUN, m);
    for (let i = lo + 1; i < hi; i++) {
      const t = a[i],
        kt = keys[t];
      let j = i - 1;
      while (j >= lo && keys[a[j]] > kt) {
        a[j + 1] = a[j];
        j--;
      }
      a[j + 1] = t;
    }
  }
  if (m <= RUN) return;
  let src: Uint32Array = a,
    dst: Uint32Array = new Uint32Array(m);
  for (let w = RUN; w < m; w *= 2) {
    for (let lo = 0; lo < m; lo += 2 * w) {
      const mid = Math.min(lo + w, m),
        hi = Math.min(lo + 2 * w, m);
      if (mid >= hi || keys[src[mid - 1]] <= keys[src[mid]]) {
        dst.set(src.subarray(lo, hi), lo);
        continue;
      }
      let i = lo,
        j = mid,
        k = lo;
      while (i < mid && j < hi) dst[k++] = keys[src[j]] < keys[src[i]] ? src[j++] : src[i++];
      while (i < mid) dst[k++] = src[i++];
      while (j < hi) dst[k++] = src[j++];
    }
    const t = src;
    src = dst;
    dst = t;
  }
  if (src !== a) a.set(src.subarray(0, m));
}

// The permutation that sorts x ascending, a missing x (null/NaN) last, or null when x already
// is in that order. An ascending time axis costs one pass, a descending one two.
export function sortOrder(x: DataArray): Uint32Array | null {
  const n = x.length;
  let asc = true,
    desc = true,
    gap = false,
    prev = NaN;
  for (let i = 0; i < n && (asc || desc); i++) {
    const v = x[i];
    if (v == null || v !== v) {
      gap = true;
      desc = false;
      continue;
    }
    if (gap) asc = false;
    if (prev === prev) {
      if (v < prev) asc = false;
      else if (v > prev) desc = false;
    }
    prev = v;
  }
  if (asc) return null;
  const order = new Uint32Array(n);
  if (desc) {
    for (let i = 0; i < n; i++) order[i] = n - 1 - i;
    return order;
  }
  const keys = new Float64Array(n);
  let m = 0;
  for (let i = 0; i < n; i++) {
    const v = x[i];
    if (v == null || v !== v) continue;
    keys[i] = v;
    order[m++] = i;
  }
  let g = m;
  for (let i = 0; i < n; i++) {
    const v = x[i];
    if (v == null || v !== v) order[g++] = i;
  }
  sortIndices(order, m, keys);
  return order;
}

// arr reordered by `order`; a gap (null) becomes NaN, which a Float64Array keeps as a gap.
function permute(arr: DataArray, order: Uint32Array): Float64Array {
  const n = order.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const v = arr[order[i]];
    out[i] = v == null ? NaN : v;
  }
  return out;
}

// ─── Config normalisation ────────────────────────────────────────────────────

// [r, g, b] in 0..1 packed into a u32 exactly like packRGB in charts/candlestick.ts.
function packColor(r: number, g: number, b: number): number {
  return (
    ((Math.round(r * 255) & 0xff) |
      ((Math.round(g * 255) & 0xff) << 8) |
      ((Math.round(b * 255) & 0xff) << 16) |
      (0xff << 24)) >>>
    0
  );
}

function isColorArray(v: unknown): v is ArrayLike<number> {
  if (!Array.isArray(v) && !(ArrayBuffer.isView(v) && !(v instanceof DataView))) return false;
  const a = v as ArrayLike<unknown>;
  if (a.length !== 3 && a.length !== 4) return false;
  for (let i = 0; i < a.length; i++) if (typeof a[i] !== "number") return false;
  return true;
}

// The number a config value stands for in a renderer uniform: numbers as they are, a name
// through the uniform's `values` map, [r, g, b] (0..1, alpha ignored) packed for a u32 colour.
// undefined when the value means nothing to the uniform (the default then applies).
export function normalizeUniform(def: UniformDef, value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") {
    const v = def.values?.[value] ?? def.values?.[value.toLowerCase()];
    return typeof v === "number" ? v : undefined;
  }
  if (def.type === "u32" && isColorArray(value)) return packColor(value[0], value[1], value[2]);
  return undefined;
}

// Structural equality for config values (arrays, plain objects); functions and everything
// else by identity.
function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a),
    kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka)
    if (!sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
      return false;
  return true;
}

const BOUND_KEYS = ["minX", "maxX", "minY", "maxY"] as const;

// The sides of a (partial) bounds object that hold a finite number.
function definedSides(b: Partial<Bounds> | null | undefined): Partial<Bounds> {
  const r: Partial<Bounds> = {};
  if (b)
    for (const k of BOUND_KEYS) {
      const v = b[k];
      if (typeof v === "number" && Number.isFinite(v)) r[k] = v;
    }
  return r;
}

function isRgb(v: unknown): v is [number, number, number] {
  return isColorArray(v);
}

function cssRgb(c: ArrayLike<number>): string {
  return `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;
}

let _colorEl: HTMLElement | null = null;
function parseColor(c: ChartColor | string): ChartColor {
  if (typeof c !== "string") return c;
  if (!_colorEl) {
    _colorEl = document.createElement("i");
    _colorEl.style.cssText = "display:none";
    document.body.appendChild(_colorEl);
  }
  _colorEl.style.color = c;
  const m = getComputedStyle(_colorEl).color.match(/\d+/g)!;
  return { r: +m[0] / 255, g: +m[1] / 255, b: +m[2] / 255 };
}

function currentDpr(): number {
  const d = typeof devicePixelRatio === "number" ? devicePixelRatio : 1;
  return d > 0 ? d : 1;
}

function resizeCanvas(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  cssW: number,
  cssH: number,
  dpr: number,
): void {
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  if (canvas instanceof HTMLCanvasElement) {
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
  }
}

// One of the three stacked canvases of a chart (background plugins, GPU, foreground plugins).
function makeLayer(z: number, events: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.style.cssText = `position:absolute;inset:0;width:100%;height:100%;pointer-events:${events};z-index:${z};`;
  return c;
}

// ─── View geometry ───────────────────────────────────────────────────────────
// Canvas fraction u of an axis shows normalised data pan + u / zoom (data 0..1 = bounds). A
// home view maps data 0..1 exactly onto the plot area, so the plot-area edges sit at the
// canvas fractions -homePan * homeZoom and (1 - homePan) * homeZoom.

type Axis = "x" | "y";

function plotEdges(chart: InternalChart<any>, axis: Axis): [number, number] {
  const hv = chart.homeView;
  const pan = axis === "x" ? hv.panX : hv.panY;
  const zoom = axis === "x" ? hv.zoomX : hv.zoomY;
  const a = -pan * zoom,
    b = (1 - pan) * zoom;
  return Number.isFinite(a) && Number.isFinite(b) && b > a ? [a, b] : [0, 1];
}

// The data range [lo, hi] shown between the plot-area edges of one axis.
function visibleRange(chart: InternalChart<any>, axis: Axis): [number, number] {
  const [uL, uR] = plotEdges(chart, axis);
  const b = chart.bounds,
    v = chart.view;
  const min = axis === "x" ? b.minX : b.minY;
  const full = (axis === "x" ? b.maxX : b.maxY) - min;
  const pan = axis === "x" ? v.panX : v.panY;
  const zoom = axis === "x" ? v.zoomX : v.zoomY;
  return [min + (pan + uL / zoom) * full, min + (pan + uR / zoom) * full];
}

// The pan and zoom that make `chart` show [lo, hi] between its plot-area edges, through its own
// bounds; null when that is not possible (an empty range or bounds).
function viewFor(
  chart: InternalChart<any>,
  axis: Axis,
  lo: number,
  hi: number,
): { pan: number; zoom: number } | null {
  const [uL, uR] = plotEdges(chart, axis);
  const b = chart.bounds;
  const min = axis === "x" ? b.minX : b.minY;
  const full = (axis === "x" ? b.maxX : b.maxY) - min;
  const aL = (lo - min) / full,
    aR = (hi - min) / full;
  if (!Number.isFinite(aL) || !Number.isFinite(aR) || !(aR > aL)) return null;
  const zoom = (uR - uL) / (aR - aL);
  return { pan: aL - uL / zoom, zoom };
}

type StatsCallback = (stats: ChartStats) => void;
type ViewChangeListener = (chartId: string) => void;

// One series as sent to the worker (UPDATE_SERIES). dataX is null when every series shares the
// chart's x array, which then travels once as `sharedX`. x is rebased by the chart's originX.
interface WorkerSeriesData {
  label: string;
  colorR: number;
  colorG: number;
  colorB: number;
  dataX: Float32Array | null;
  dataY: Float32Array;
  extra: Record<string, Float32Array>;
  hidden: boolean;
}

// Main-thread bookkeeping per chart that the plugins never read.
interface ChartState {
  // The OffscreenCanvas create() took from the GPU canvas, until REGISTER_CHART posts it.
  offscreen: OffscreenCanvas | null;
  // Caller column of rawX[0] (SeriesPatch.start of the last patch; 0 after a full update)...
  colStart: number;
  // ...and the caller column the GPU buffers hold in their column 0.
  colBase: number;
  // Per series: the caller's x array (indexed like the patch columns).
  srcX: DataArray[];
  // Per series on a secondary axis: plot-space y, reused across patches, holding caller column
  // plotBase + i at index i.
  plotBuf: (Float64Array | null)[];
  plotBase: number[];
  // Legend toggles that differ from the series' own `hidden`, by label.
  hiddenOverrides: Map<string, boolean>;
}

class _ChartManager {
  private static instance: _ChartManager | null = null;

  private worker: Worker | null = null;
  private charts = new Map<string, InternalChart<any>>();
  private states = new WeakMap<InternalChart<any>, ChartState>();
  private renderers = new Map<string, RendererPlugin>();
  private uiPlugins: ChartPlugin<any>[] = [];
  private chartIdCounter = 0;
  private _isDark = false;
  private _syncViews: SyncViews = false;
  // init() runs once; the worker takes chart messages only after GPU_READY.
  private initPromise: Promise<boolean> | null = null;
  private _ready = false;
  private failed = false;
  private deviceLosses: number[] = [];
  private statsCallbacks: StatsCallback[] = [];
  private viewListeners = new Set<ViewChangeListener>();
  // Charts whose overlays are being drawn, and those to draw once more afterwards.
  private drawing = new Set<InternalChart<any>>();
  private redraw = new Set<InternalChart<any>>();
  private currentStats: ChartStats = {
    fps: 0,
    renderMs: 0,
    total: 0,
    active: 0,
  };
  private visibilityObserver: IntersectionObserver;
  private resizeObserver: ResizeObserver;

  private constructor() {
    this._isDark = document.documentElement.classList.contains("dark");

    this.visibilityObserver = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.chartId;
          if (!id) continue;
          const chart = this.charts.get(id);
          if (!chart) continue;
          chart.visible = e.isIntersecting;
          this.post({ type: M.SET_VISIBILITY, id, visible: e.isIntersecting });
          if (e.isIntersecting) this.drawChart(chart);
        }
      },
      { threshold: 0.01 },
    );

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const e of entries) {
        const id = (e.target as HTMLElement).dataset.chartId;
        if (!id) continue;
        const chart = this.charts.get(id);
        if (!chart) continue;
        const { width, height } = e.contentRect;
        if (width <= 0 || height <= 0) continue;
        this.resizeChart(chart, width, height);
      }
    });

    this.watchDpr();
  }

  static getInstance(): _ChartManager {
    if (!_ChartManager.instance) _ChartManager.instance = new _ChartManager();
    return _ChartManager.instance;
  }

  get isDark(): boolean {
    return this._isDark;
  }
  get syncViews(): SyncViews {
    return this._syncViews;
  }
  // True once the GPU worker reported GPU_READY (again false while a lost device is replaced).
  get ready(): boolean {
    return this._ready;
  }

  use(plugin: RendererPlugin | ChartPlugin<any>): void {
    if ("passes" in plugin) {
      const r = plugin as RendererPlugin;
      this.renderers.set(r.name, r);
      // Before GPU_READY the renderer waits in the map; every renderer is sent on GPU_READY.
      if (this._ready) this.sendRendererRegistration(r);
    } else {
      const p = plugin as ChartPlugin<any>;
      if (!this.uiPlugins.some((x) => x.name === p.name))
        this.uiPlugins.push(p);
    }
  }

  // Starts the GPU worker once: every call returns the same promise, true on GPU_READY.
  init(): Promise<boolean> {
    if (!this.initPromise) {
      this.initPromise = this.startWorker().then((ok) => {
        if (!ok) this.failed = true;
        return ok;
      });
    }
    return this.initPromise;
  }

  // A new GPU worker (the inlined one, else gpu-worker.js next to the bundle); resolves true on
  // its GPU_READY, false when it cannot get a device.
  private startWorker(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const attach = (worker: Worker) => {
        this.worker = worker;
        this.setupWorkerHandlers(worker, resolve);
      };
      const fallback = () => {
        try {
          attach(new Worker(new URL("./gpu-worker.js", import.meta.url), { type: "module" }));
        } catch (e) {
          console.error("chartai:", e);
          resolve(false);
        }
      };
      import("./worker-inline.js")
        .then(({ WORKER_CODE }) => {
          const blob = new Blob([WORKER_CODE], {
            type: "application/javascript",
          });
          let worker: Worker;
          try {
            worker = new Worker(URL.createObjectURL(blob), { type: "module" });
          } catch {
            fallback();
            return;
          }
          attach(worker);
        })
        .catch(fallback);
    });
  }

  private setupWorkerHandlers(worker: Worker, resolve: (v: boolean) => void): void {
    worker.onmessage = (e) => {
      // A worker replaced after a device loss may still deliver a message or two.
      if (worker !== this.worker) return;
      const { type, ...data } = e.data;
      switch (type) {
        case M.GPU_READY:
          this.onGpuReady();
          resolve(true);
          break;
        case M.ERROR:
          if (data.code === E.DEVICE_LOST && this._ready) {
            this.handleDeviceLost();
            break;
          }
          console.error("chartai:", data.code, data.message ?? "");
          if (!this._ready) resolve(false);
          break;
        case M.STATS:
          this.currentStats = {
            fps: data.fps,
            renderMs: data.renderMs,
            total: data.totalCharts,
            active: data.activeCharts,
          };
          for (const cb of this.statsCallbacks) cb(this.currentStats);
          break;
      }
    };
    worker.onerror = (e) => {
      if (worker !== this.worker) return;
      console.error("chartai:", e);
      if (!this._ready) resolve(false);
    };
    worker.postMessage({ type: M.INIT, isDark: this._isDark });
  }

  // The worker has a device: send it every renderer, then every chart with its data, whether
  // the chart was created before this point or belonged to a worker that lost its device.
  private onGpuReady(): void {
    this._ready = true;
    for (const r of this.renderers.values()) this.sendRendererRegistration(r);
    for (const chart of this.charts.values()) {
      try {
        this.registerChart(chart);
      } catch (e) {
        console.error("chartai:", e);
        continue;
      }
      if (!chart.visible) this.post({ type: M.SET_VISIBILITY, id: chart.id, visible: false });
      this.uploadSeries(chart);
      this.sendViewTransform(chart);
      this.drawChart(chart);
    }
  }

  // A lost GPU device (driver reset, GPU switch) is replaced by a new worker with a new device;
  // onGpuReady then re-registers everything. Repeated losses give up instead of looping.
  private handleDeviceLost(): void {
    const now = Date.now();
    this.deviceLosses = this.deviceLosses.filter((t) => now - t < 60_000);
    this.deviceLosses.push(now);
    const old = this.worker;
    this._ready = false;
    this.worker = null;
    old?.terminate();
    if (this.deviceLosses.length > 3) {
      this.failed = true;
      console.error("chartai: the GPU device was lost repeatedly; reload the page to draw again");
      return;
    }
    console.warn("chartai: the GPU device was lost; restarting the GPU worker");
    void this.startWorker().then((ok) => {
      if (!ok) console.error("chartai: the GPU could not be restarted after a device loss");
    });
  }

  // Chart messages need a worker with a device; until then the charts keep their state here and
  // onGpuReady sends all of it.
  private post(msg: Record<string, unknown>, transfer?: Transferable[]): void {
    if (!this._ready || !this.worker) return;
    if (transfer) this.worker.postMessage(msg, transfer);
    else this.worker.postMessage(msg);
  }

  private state(chart: InternalChart<any>): ChartState {
    let st = this.states.get(chart);
    if (!st) {
      st = {
        offscreen: null,
        colStart: 0,
        colBase: 0,
        srcX: [],
        plotBuf: [],
        plotBase: [],
        hiddenOverrides: new Map(),
      };
      this.states.set(chart, st);
    }
    return st;
  }

  private sendRendererRegistration(renderer: RendererPlugin): void {
    const bufferDefs = (renderer.buffers ?? []).map((buf) => ({
      name: buf.name,
      usages: buf.usages,
      perSeries: renderer.passes.some(
        (p) =>
          p.perSeries !== false &&
          p.bindings.some((b) => b.source === buf.name),
      ),
    }));
    this.post({
      type: M.REGISTER_RENDERER,
      name: renderer.name,
      shaders: renderer.shaders,
      passes: renderer.passes.map((p) => ({
        type: p.type,
        shader: p.shader,
        bindings: p.bindings,
        perSeries: p.perSeries !== false,
        topology: p.topology,
        loadOp: p.loadOp,
        blend: p.blend,
        highlight: p.highlight === true,
      })),
      bufferDefs,
      uniformDefs: renderer.uniforms ?? [],
    });
  }

  // Posts REGISTER_CHART with the chart's GPU canvas. A canvas hands its control to an
  // OffscreenCanvas only once, so a chart re-registered with a new worker gets a fresh one.
  private registerChart(chart: InternalChart<any>): void {
    const st = this.state(chart);
    let offscreen = st.offscreen;
    st.offscreen = null;
    if (!offscreen) {
      const fresh = makeLayer(1, "auto");
      if (chart.gpuCanvas?.parentNode) chart.gpuCanvas.replaceWith(fresh);
      else chart.frontCanvas.parentNode?.insertBefore(fresh, chart.frontCanvas);
      chart.gpuCanvas = fresh;
      offscreen = fresh.transferControlToOffscreen();
    }
    resizeCanvas(offscreen, chart.width, chart.height, chart.dpr);
    this.post(
      {
        type: M.REGISTER_CHART,
        id: chart.id,
        canvas: offscreen,
        rendererName: chart.config.type,
        bgColor: isRgb(chart.config.bgColor) ? chart.config.bgColor : null,
        ...this.computeRendererMeta(chart.renderer, chart),
        customUniformValues: this.gpuUniforms(chart),
        width: Math.round(chart.width * chart.dpr),
        height: Math.round(chart.height * chart.dpr),
      },
      [offscreen],
    );
  }

  private computeRendererMeta(
    renderer: RendererPlugin,
    chart: InternalChart<any>,
  ): {
    bufferSizes: Record<string, number>;
    perSeriesPassMeta: PassMeta[][];
  } {
    const bufferSizes: Record<string, number> = {};
    const perSeriesPassMeta: PassMeta[][] = [];
    const series: InternalSeries[] =
      chart.series.length > 0
        ? chart.series
        : [
            {
              rawX: [] as number[],
              rawY: [] as number[],
              extra: {},
              label: "",
              color: { r: 0, g: 0, b: 0 },
            },
          ];

    // Buffer sizes and dispatch counts must use physical pixels — the worker renders at physical
    // resolution, with the device pixel ratio the canvases were sized for.
    const dpr = chart.dpr || 1;
    const physW = Math.round(chart.width * dpr);
    const physH = Math.round(chart.height * dpr);

    for (const s of series) {
      const ctx: RenderContext = {
        width: physW,
        height: physH,
        // Buffers are sized to the capacity so patchSeries can append without reallocating.
        samples: Math.max(s.rawX.length, chart.capacity ?? 0),
        seriesCount: series.length,
        bounds: chart.bounds,
        view: chart.view,
      };
      for (const buf of renderer.buffers ?? []) {
        const size = buf.bytes(ctx);
        bufferSizes[buf.name] = Math.max(bufferSizes[buf.name] ?? 0, size);
      }
      perSeriesPassMeta.push(
        renderer.passes.map((p) => ({
          dispatch: p.dispatch?.(ctx),
          draw: p.draw?.(ctx),
        })),
      );
    }
    return { bufferSizes, perSeriesPassMeta };
  }

  // Overload 1: type is in the registry → infer renderer config, suggest plugin options
  create<T extends string & keyof ChartTypeRegistry>(
    config: Omit<ChartConfig, "type"> & { type: T } & ChartTypeRegistry[T] &
      AllPluginOptions,
  ): Chart<ChartConfig & ChartTypeRegistry[T] & AllPluginOptions>;
  // Overload 2: unknown/custom type → preserve whatever shape was passed
  create<C extends ChartConfig>(
    config: C & AllPluginOptions,
  ): Chart<C & AllPluginOptions>;
  // Implementation. Before GPU_READY the chart is set up completely here and reaches the
  // worker (canvas, data, view) once it is ready.
  create(config: any): Chart<any> {
    if (!this.initPromise) throw new Error("No worker. Call init().");
    if (this.failed) throw new Error("chartai: WebGPU is not available (init() failed).");
    const renderer = this.renderers.get(config.type);
    if (!renderer)
      throw new Error(
        `No renderer "${config.type}". Call manager.use() first.`,
      );

    const id = `chart-${++this.chartIdCounter}`;

    const el = document.createElement("div");
    el.dataset.chartId = id;
    el.style.cssText = "width:100%;height:100%;position:relative;";

    const wrap = document.createElement("div");
    wrap.dataset.chartId = id;
    wrap.style.cssText = "width:100%;height:100%;position:relative;";

    const backCanvas = makeLayer(0, "none");
    const gpuCanvas = makeLayer(1, "auto");
    const frontCanvas = makeLayer(2, "none");

    wrap.append(backCanvas, gpuCanvas, frontCanvas);
    el.appendChild(wrap);
    config.container.appendChild(el);

    let offscreen: OffscreenCanvas;
    try {
      offscreen = gpuCanvas.transferControlToOffscreen();
    } catch (e) {
      el.remove();
      throw new Error(`Failed OffscreenCanvas: ${e}`);
    }

    const rect = wrap.getBoundingClientRect();
    const cssW = rect.width || 400;
    const cssH = rect.height || 200;
    const dpr = currentDpr();
    resizeCanvas(backCanvas, cssW, cssH, dpr);
    resizeCanvas(frontCanvas, cssW, cssH, dpr);

    if (isRgb(config.bgColor)) wrap.style.background = cssRgb(config.bgColor);

    const chart: InternalChart<any> = {
      id,
      config,
      el,
      backCanvas,
      frontCanvas,
      gpuCanvas,
      width: cssW,
      height: cssH,
      dpr,
      series: [],
      bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1 },
      runtimeBounds: null,
      originX: 0,
      view: { panX: 0, panY: 0, zoomX: 1, zoomY: 1 },
      homeView: { panX: 0, panY: 0, zoomX: 1, zoomY: 1 },
      visible: true,
      dragging: false,
      plugins: [...this.uiPlugins],
      renderer,
      customUniforms: {},
    };

    this.charts.set(id, chart as InternalChart<any>);
    this.state(chart).offscreen = offscreen;

    // The renderer's install may normalise config values (e.g. a colour-scale name), so it runs
    // before the uniforms are read from the config.
    renderer.install?.(chart, wrap);
    chart.customUniforms = this.resolveUniforms(renderer, config);

    if (this._ready) this.registerChart(chart);

    this.visibilityObserver.observe(el);
    this.resizeObserver.observe(wrap);

    for (const plugin of chart.plugins) plugin.install?.(chart, wrap);

    this.updateSeries(id, Array.isArray(config.series) ? config.series : [], {
      capacity: config.capacity,
    });
    return new Chart<any>(id, this);
  }

  private resolveUniforms(renderer: RendererPlugin, config: Record<string, unknown>): Record<string, number> {
    const values: Record<string, number> = {};
    for (const u of renderer.uniforms ?? [])
      values[u.name] = normalizeUniform(u, config[u.name]) ?? u.default;
    return values;
  }

  // The uniform values as the GPU gets them: x positions relative to the chart's x origin.
  private gpuUniforms(chart: InternalChart<any>, names?: string[]): Record<string, number> {
    const out: Record<string, number> = {};
    const o = chart.originX ?? 0;
    for (const u of chart.renderer.uniforms ?? []) {
      if (names && !names.includes(u.name)) continue;
      const v = chart.customUniforms[u.name] ?? u.default;
      out[u.name] = u.xPosition ? v - o : v;
    }
    return out;
  }

  // chart.bounds as the GPU gets them: x relative to the chart's x origin.
  private gpuBounds(chart: InternalChart<any>): Bounds {
    const b = chart.bounds,
      o = chart.originX ?? 0;
    return { minX: b.minX - o, maxX: b.maxX - o, minY: b.minY, maxY: b.maxY };
  }

  destroy(id: string): void {
    const chart = this.charts.get(id);
    if (!chart) return;
    chart.renderer.uninstall?.(chart);
    for (const p of chart.plugins) p.uninstall?.(chart);
    this.visibilityObserver.unobserve(chart.el);
    const wrap = chart.el.querySelector("div");
    if (wrap) this.resizeObserver.unobserve(wrap);
    chart.el.remove();
    this.post({ type: M.UNREGISTER_CHART, id });
    this.charts.delete(id);
  }

  // Replaces the data. An empty list clears the chart. x is sorted unless the renderer says
  // sortX: false. Without opts.bounds the runtime window resets to config.defaultBounds and the
  // data; legend toggles (setHiddenSeries) survive for the labels still present.
  updateSeries(id: string, series: ChartSeries[], opts: UpdateSeriesOptions = {}): void {
    const chart = this.charts.get(id);
    if (!chart) return;
    const list = Array.isArray(series) ? series : [];
    const sortX = chart.renderer.sortX !== false;

    // Series usually share one x array: it is checked (and sorted) once, and its sorted copy
    // is shared again, so it still uploads once.
    const sorted = new Map<DataArray, { order: Uint32Array | null; x: DataArray }>();
    chart.series = list.map((s): InternalSeries => {
      let e = sorted.get(s.x);
      if (!e) {
        const order = sortX ? sortOrder(s.x) : null;
        e = { order, x: order ? permute(s.x, order) : s.x };
        sorted.set(s.x, e);
      }
      const order = e.order;
      const pick = (arr: DataArray): DataArray => (order ? permute(arr, order) : arr);
      // An empty series keeps its extra arrays (empty): the renderer's bind groups need every
      // buffer to exist, and follow mode later patches columns into the capacity-sized buffers.
      const extra: Record<string, DataArray> = {};
      for (const key in s) {
        if (
          key !== "label" &&
          key !== "color" &&
          key !== "x" &&
          key !== "y" &&
          isNumericArray(s[key])
        ) {
          extra[key] = pick(s[key]);
        }
      }
      return {
        label: s.label,
        color: parseColor(s.color),
        hidden: !!s.hidden,
        yAxis: s.yAxis,
        rawX: e.x,
        rawY: pick(s.y),
        extra,
      };
    });

    const st = this.state(chart);
    st.colStart = 0;
    st.colBase = 0;
    st.srcX = chart.series.map((s) => s.rawX);
    st.plotBuf = [];
    st.plotBase = [];

    // Each series' own flag, then the legend's toggles for the labels still present.
    const labels = new Set(chart.series.map((s) => s.label));
    for (const label of [...st.hiddenOverrides.keys()])
      if (!labels.has(label)) st.hiddenOverrides.delete(label);
    chart.config.hiddenSeries = this.hiddenSet(chart);

    chart.runtimeBounds = opts.bounds ? definedSides(opts.bounds) : null;
    this.refreshSeriesData(chart, opts.capacity);
  }

  private hiddenSet(chart: InternalChart<any>): Set<number> {
    const overrides = this.state(chart).hiddenOverrides;
    const set = new Set<number>();
    chart.series.forEach((s, i) => {
      if (overrides.get(s.label) ?? s.hidden) set.add(i);
    });
    return set;
  }

  // Re-derive axes, bounds and GPU-space data from chart.series and push it to
  // the worker. Also called after axis-affecting config changes (yAxes, gap,
  // defaultBounds), so those take effect without re-supplying the data; the GPU
  // buffers keep the capacity they have then.
  refreshSeriesData(chart: InternalChart<any>, capacity?: number): void {
    // GPU buffers are sized to the capacity so patchSeries can append without recreating them;
    // a refresh after a config change keeps the capacity the buffers already have.
    let longest = 0;
    for (const s of chart.series) if (s.rawX.length > longest) longest = s.rawX.length;
    chart.capacity = Math.max(capacity ?? chart.capacity ?? 0, longest);

    this.deriveBounds(chart);
    this.uploadSeries(chart);
    this.sendViewTransform(chart);
    this.drawChart(chart);
  }

  // Axes, bounds and plot-space y from the data. Precedence per side: the data (or the
  // renderer's computeBounds), then config.defaultBounds, then the runtime window. Gaps
  // (null/NaN) never count.
  private deriveBounds(chart: InternalChart<any>): void {
    const axes = yAxisDefs(chart);
    chart.yAxes = axes;
    const series = chart.series;
    const st = this.state(chart);
    const customBounds = chart.renderer.computeBounds?.(series, chart);
    const db = definedSides(chart.config.defaultBounds);
    const rb = definedSides(chart.runtimeBounds);
    let minX: number, maxX: number, minY: number, maxY: number;

    // X: renderer-specific if available, else data extent + 5% pad.
    if (customBounds) {
      minX = customBounds.minX;
      maxX = customBounds.maxX;
    } else {
      const sorted = chart.renderer.sortX !== false;
      let lo = Infinity,
        hi = -Infinity;
      for (const s of series) {
        const [a, b] = finiteRange(s.rawX, sorted);
        if (a < lo) lo = a;
        if (b > hi) hi = b;
      }
      if (!(lo <= hi)) {
        lo = 0;
        hi = 1;
      }
      const px = (hi - lo) * 0.05 || 1;
      minX = lo - px;
      maxX = hi + px;
    }
    minX = rb.minX ?? db.minX ?? minX;
    maxX = rb.maxX ?? db.maxX ?? maxX;

    st.plotBuf = [];
    st.plotBase = [];
    if (!axes) {
      for (const s of series) {
        s.axisIndex = 0;
        s.plotY = s.rawY;
      }
      if (customBounds) {
        minY = customBounds.minY;
        maxY = customBounds.maxY;
      } else {
        let lo = Infinity,
          hi = -Infinity;
        for (const s of series) {
          const [a, b] = finiteRange(s.rawY, false);
          if (a < lo) lo = a;
          if (b > hi) hi = b;
        }
        if (!(lo <= hi)) {
          lo = 0;
          hi = 1;
        }
        const py = (hi - lo) * 0.1 || 1;
        minY = lo - py;
        maxY = hi + py;
      }
      minY = rb.minY ?? db.minY ?? minY;
      maxY = rb.maxY ?? db.maxY ?? maxY;
    } else {
      const byId = new Map(axes.map((a, i) => [a.id, i] as const));
      for (const s of series)
        s.axisIndex =
          s.yAxis != null && byId.has(String(s.yAxis)) ? byId.get(String(s.yAxis))! : 0;

      // Per-axis Y bounds from that axis' series (incl. y-positional channels),
      // 10% pad; manual min/max win.
      for (let ai = 0; ai < axes.length; ai++) {
        const ax = axes[ai];
        let lo = Infinity,
          hi = -Infinity;
        for (const s of series) {
          if (s.axisIndex !== ai) continue;
          const arrays = [s.rawY];
          for (const key of Y_PLOT_CHANNELS) if (s.extra[key]) arrays.push(s.extra[key]);
          for (const arr of arrays) {
            const [a, b] = finiteRange(arr, false);
            if (a < lo) lo = a;
            if (b > hi) hi = b;
          }
        }
        if (!(lo <= hi)) {
          lo = 0;
          hi = 1;
        }
        const pad = (hi - lo) * 0.1 || 1;
        ax.min = ax.min ?? lo - pad;
        ax.max = ax.max ?? hi + pad;
      }
      axes[0].min = rb.minY ?? db.minY ?? axes[0].min;
      axes[0].max = rb.maxY ?? db.maxY ?? axes[0].max;

      // The first axis defines the internal plot space; every other axis is an
      // affine remap into it (plotY = y * scale + offset).
      const prim = axes[0];
      const primRange = prim.max! - prim.min! || 1;
      for (const ax of axes) {
        const r = ax.max! - ax.min! || 1;
        ax.scale = primRange / r;
        ax.offset = prim.min! - ax.min! * ax.scale;
      }
      minY = prim.min!;
      maxY = prim.max!;

      // A remapped series keeps its plot-space y in a buffer of the GPU capacity, which
      // patchSeries then updates in place for the columns a patch writes.
      series.forEach((s, i) => {
        const ax = axes[s.axisIndex!];
        if (ax.scale === 1 && ax.offset === 0) {
          s.plotY = s.rawY;
          return;
        }
        const n = s.rawY.length;
        const buf = new Float64Array(Math.max(n, chart.capacity ?? 0, 1));
        mapInto(buf, 0, s.rawY, 0, n, ax.scale!, ax.offset!);
        st.plotBuf[i] = buf;
        st.plotBase[i] = st.colStart;
        s.plotY = buf.subarray(0, n);
      });
    }

    chart.bounds = { minX, maxX, minY, maxY };
  }

  // The x origin for the chart's data (see chooseOriginX): from the finite x extent, or the
  // bounds when there is no data.
  private pickOrigin(chart: InternalChart<any>): number {
    const sorted = chart.renderer.sortX !== false;
    let lo = Infinity,
      hi = -Infinity;
    for (const s of chart.series) {
      const [a, b] = finiteRange(s.rawX, sorted);
      if (a < lo) lo = a;
      if (b > hi) hi = b;
    }
    if (!(lo <= hi)) {
      lo = chart.bounds.minX;
      hi = chart.bounds.maxX;
    }
    return chooseOriginX(lo, hi);
  }

  // Sends every series in full (UPDATE_SERIES), with x rebased by a freshly chosen origin. The
  // GPU buffers then hold rawX[0] in their column 0.
  private uploadSeries(chart: InternalChart<any>): void {
    const st = this.state(chart);
    st.colBase = st.colStart;
    chart.originX = this.pickOrigin(chart);
    if (!this._ready) return;

    const o = chart.originX;
    const axes = chart.yAxes;
    const { bufferSizes, perSeriesPassMeta } = this.computeRendererMeta(
      chart.renderer,
      chart,
    );

    const hidden = chart.config.hiddenSeries ?? new Set<number>();
    // Series sharing one x array by reference (a sampled trend) upload it once, bound to every series.
    const first = chart.series[0];
    const sharedX = first && chart.series.every((s) => s.rawX === first.rawX) ? first.rawX : null;
    const sharedXData = sharedX ? toGpu(sharedX, 1, -o, xGap(chart)) : null;
    const seriesData: WorkerSeriesData[] = chart.series.map((s, i) => {
      const ax = axes?.[s.axisIndex!];
      const mapped = !!ax && (ax.scale !== 1 || ax.offset !== 0);
      const extra: Record<string, Float32Array> = {};
      for (const key in s.extra) {
        // Y-positional channels of a series on a secondary axis are remapped like its y; a
        // bar height scales without the offset. Gaps stay gaps through the mapping.
        const scale = mapped && (Y_PLOT_CHANNELS.has(key) || key === "h") ? ax.scale! : 1;
        const offset = mapped && Y_PLOT_CHANNELS.has(key) ? ax.offset! : 0;
        extra[key] = toGpu(s.extra[key], scale, offset);
      }
      return {
        label: s.label,
        colorR: s.color.r,
        colorG: s.color.g,
        colorB: s.color.b,
        dataX: sharedXData ? null : toGpu(s.rawX, 1, -o, xGap(chart)),
        dataY: toGpu(s.plotY ?? s.rawY),
        extra,
        hidden: hidden.has(i),
      };
    });

    const transferables: ArrayBuffer[] = seriesData.flatMap((s) => [
      ...(s.dataX ? [s.dataX.buffer as ArrayBuffer] : []),
      s.dataY.buffer as ArrayBuffer,
      ...Object.values(s.extra).map((a) => a.buffer as ArrayBuffer),
    ]);
    if (sharedXData) transferables.push(sharedXData.buffer as ArrayBuffer);

    this.post(
      {
        type: M.UPDATE_SERIES,
        id: chart.id,
        series: seriesData,
        bounds: this.gpuBounds(chart),
        bufferSizes,
        perSeriesPassMeta,
        capacity: chart.capacity,
        sharedX: sharedXData,
      },
      transferables,
    );
    // Uniforms holding x positions follow the origin.
    const xUniforms = (chart.renderer.uniforms ?? []).filter((u) => u.xPosition).map((u) => u.name);
    if (xUniforms.length > 0)
      this.post({ type: M.SET_UNIFORMS, id: chart.id, values: this.gpuUniforms(chart, xUniforms) });
  }

  // Writes columns [offset, count) of every series into the GPU buffers updateSeries created
  // (up to `capacity` columns per series) without recreating anything - follow mode's per-tick
  // path. `series` carries each series' full arrays of length `count` (y plus the renderer's
  // extra arrays such as lo/hi), which also become what the hover layer reads; `x` is the shared
  // x array (omitted: unchanged). Columns below `start` are dropped: hover and bounds skip them
  // and the GPU draws from `start`. All values of one tick travel in one packed transferable.
  // The patch is checked in full before anything changes.
  patchSeries(id: string, patch: SeriesPatch): void {
    const chart = this.charts.get(id);
    if (!chart || chart.series.length === 0) return;
    const st = this.state(chart);
    const { offset, count, series, bounds } = patch;
    const start = patch.start ?? 0;
    const x = patch.x ?? null;
    const n = chart.series.length;
    const cap = chart.capacity ?? 0;
    const extraKeys = Object.keys(chart.series[0].extra);

    const isIndex = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;
    if (
      !Array.isArray(series) ||
      series.length !== n ||
      !isIndex(offset) ||
      !isIndex(count) ||
      !isIndex(start) ||
      offset > count ||
      start > count ||
      count - start > cap
    )
      throw new Error(
        `patchData: ${Array.isArray(series) ? series.length : 0} series with columns ${offset}..${count} (from ${start}) do not fit a chart of ${n} series x ${cap} columns`,
      );
    if (x && x.length < count)
      throw new Error(`patchData: x has ${x.length} values for ${count} columns`);
    for (let i = 0; i < n; i++) {
      const p = series[i];
      if (!p || !p.y || p.y.length < count)
        throw new Error(`patchData: series ${i} has ${p?.y?.length ?? 0} y values for ${count} columns`);
      for (const key of extraKeys) {
        const arr = p[key];
        if (!arr || arr.length < count)
          throw new Error(`patchData: series ${i} channel "${key}" has ${arr?.length ?? 0} values for ${count} columns`);
      }
      if (!x && !(st.srcX[i] && st.srcX[i].length >= count))
        throw new Error(`patchData: no x for columns up to ${count}; pass x`);
    }

    // The caller's x for every series: the patch's, else the one last passed. One shared array
    // yields one shared view, which keeps the single x upload and the hover's shared-x path.
    const prevEnd = st.colStart + chart.series[0].rawX.length;
    const srcX = x ? chart.series.map(() => x as DataArray) : st.srcX;
    const sharedSrc = srcX.every((a) => a === srcX[0]) ? srcX[0] : null;

    // GPU column 0 holds caller column `base`. A window starting before it (the caller compacted
    // its arrays) or running past the buffers moves the base to `start` and rewrites the window.
    let base = st.colBase;
    let from = Math.max(offset, start);
    let rebased = false;
    if (start < base || count - base > cap) {
      base = start;
      from = start;
      rebased = true;
    }

    const views = new Map<DataArray, DataArray>();
    const viewOf = (arr: DataArray) => {
      let v = views.get(arr);
      if (!v) views.set(arr, (v = view(arr, start, count)));
      return v;
    };
    const axes = chart.yAxes;
    for (let i = 0; i < n; i++) {
      const s = chart.series[i],
        p = series[i];
      s.rawX = viewOf(srcX[i]);
      s.rawY = view(p.y, start, count);
      for (const key of extraKeys) s.extra[key] = view(p[key]!, start, count);
      // A series on a secondary axis is drawn in primary-axis space with the mapping of the last
      // full update (see deriveBounds); only the columns the patch writes are remapped.
      const ax = axes?.[s.axisIndex!];
      if (ax && (ax.scale !== 1 || ax.offset !== 0)) {
        let buf = st.plotBuf[i];
        let lo = from;
        if (!buf || buf.length < count - base || st.plotBase[i] !== base) {
          if (!buf || buf.length < count - base) buf = new Float64Array(Math.max(cap, count - base, 1));
          lo = start;
          st.plotBuf[i] = buf;
          st.plotBase[i] = base;
        }
        mapInto(buf, lo - base, p.y, lo, count - lo, ax.scale!, ax.offset!);
        s.plotY = buf.subarray(start - base, count - base);
      } else {
        s.plotY = s.rawY;
      }
    }
    st.srcX = srcX.slice();
    st.colStart = start;
    st.colBase = base;
    if (bounds) {
      const b = definedSides(bounds);
      chart.runtimeBounds = { ...(chart.runtimeBounds ?? {}), ...b };
      chart.bounds = { ...chart.bounds, ...b };
    }

    // A full upload instead: x drifted too far from the origin for float32, or a rebased window
    // needs per-series x the patch message cannot carry.
    const [lo, hi] = finiteRange(chart.series[0].rawX, chart.renderer.sortX !== false);
    const o = chart.originX ?? 0;
    const span = Math.max(hi - lo, chart.bounds.maxX - chart.bounds.minX);
    const dist = Math.max(Math.abs(lo - o), Math.abs(hi - o));
    const drifted = lo <= hi && (span > 0 ? dist > REORIGIN_SPANS * span : dist >= 1);
    if (drifted || (!sharedSrc && (rebased || count > prevEnd))) {
      this.uploadSeries(chart);
      this.sendViewTransform(chart);
      this.drawChart(chart);
      return;
    }
    if (!this._ready) {
      this.drawChart(chart);
      return;
    }

    const k = count - from;
    let packed: Float32Array | null = null,
      xData: Float32Array | null = null;
    const transferables: ArrayBuffer[] = [];
    if (k > 0) {
      packed = new Float32Array((1 + extraKeys.length) * n * k);
      for (let i = 0; i < n; i++) {
        const p = series[i];
        const ax = axes?.[chart.series[i].axisIndex!];
        const mapped = !!ax && (ax.scale !== 1 || ax.offset !== 0);
        packInto(packed, i * k, p.y, from, k, mapped ? ax.scale! : 1, mapped ? ax.offset! : 0);
        for (let e = 0; e < extraKeys.length; e++) {
          const key = extraKeys[e];
          const scale = mapped && (Y_PLOT_CHANNELS.has(key) || key === "h") ? ax.scale! : 1;
          const off = mapped && Y_PLOT_CHANNELS.has(key) ? ax.offset! : 0;
          packInto(packed, ((e + 1) * n + i) * k, p[key]!, from, k, scale, off);
        }
      }
      transferables.push(packed.buffer as ArrayBuffer);
      // x of the written columns, rebased; per-series x (no shared array) is unchanged here.
      if (sharedSrc) {
        xData = toGpu(view(sharedSrc, from, count), 1, -o, xGap(chart));
        transferables.push(xData.buffer as ArrayBuffer);
      }
    }

    this.post(
      {
        type: M.PATCH_SERIES,
        id,
        offset: from - base,
        k,
        count: count - base,
        start: start - base,
        x: xData,
        packed,
        extra: extraKeys,
        bounds: bounds ? this.gpuBounds(chart) : null,
      },
      transferables,
    );
    this.sendViewTransform(chart);
    this.drawChart(chart);
  }

  // Moves the runtime window without touching the data: follow mode's tick when nothing new
  // arrived. config.defaultBounds stays as configured. resetView also puts the view home, which
  // counts as a view change (onViewChange, linked charts).
  setBounds(id: string, bounds: Partial<Bounds>, resetView = false): void {
    const chart = this.charts.get(id);
    if (!chart) return;
    const b = definedSides(bounds);
    chart.runtimeBounds = { ...(chart.runtimeBounds ?? {}), ...b };
    chart.bounds = { ...chart.bounds, ...b };
    this.post({ type: M.SET_BOUNDS, id, bounds: this.gpuBounds(chart) });
    if (resetView) {
      chart.view = { ...chart.homeView };
      this.commitView(chart);
    } else {
      this.sendViewTransform(chart);
      this.drawChart(chart);
    }
  }

  // Chart.configure. Only keys present in the patch are touched; null (or undefined) resets an
  // option: a uniform to its default, bgColor to the theme, formatters and the like to unset.
  configureChart(id: string, patch: Record<string, unknown>): void {
    const c = this.charts.get(id);
    if (!c || !patch) return;
    const cfg = c.config as Record<string, unknown>;
    const defs = new Map((c.renderer.uniforms ?? []).map((u) => [u.name, u] as const));
    const changedUniforms: string[] = [];
    let refresh = false;

    for (const key of Object.keys(patch)) {
      // The renderer, host element and data are not options: they need a new chart / setData.
      if (key === "type" || key === "container" || key === "series") continue;
      const val = patch[key];
      const reset = val == null;
      const prev = cfg[key];
      if (reset) delete cfg[key];
      else cfg[key] = val;

      const def = defs.get(key);
      if (def) {
        c.customUniforms[key] = reset ? def.default : (normalizeUniform(def, val) ?? def.default);
        changedUniforms.push(key);
      }

      switch (key) {
        case "hiddenSeries": {
          const iterable = !reset && typeof (val as any)[Symbol.iterator] === "function";
          this.applyHidden(c, iterable ? new Set<number>(val as Iterable<number>) : null);
          break;
        }
        case "bgColor": {
          const rgb = isRgb(val) ? val : null;
          if (!rgb) delete cfg.bgColor;
          const wrap = c.el.querySelector("div") as HTMLElement | null;
          if (wrap) wrap.style.background = rgb ? cssRgb(rgb) : "";
          this.post({ type: M.SET_STYLE, id, bgColor: rgb ? [rgb[0], rgb[1], rgb[2]] : null });
          break;
        }
        case "yAxes":
        case "yAxisGap":
          if (!sameValue(prev, cfg[key])) refresh = true;
          break;
        case "defaultBounds":
          // New configured bounds replace the runtime window.
          if (!sameValue(prev, cfg[key])) {
            c.runtimeBounds = null;
            refresh = true;
          }
          break;
      }
    }

    if (changedUniforms.length > 0)
      this.post({ type: M.SET_UNIFORMS, id, values: this.gpuUniforms(c, changedUniforms) });
    if (refresh) this.refreshSeriesData(c);
    else if (changedUniforms.length > 0 && c.renderer.computeBounds && c.series.length > 0) {
      // A renderer's own bounds may follow its options (the histogram's bins and range).
      this.deriveBounds(c);
      if (c.yAxes) this.uploadSeries(c);
      else this.post({ type: M.SET_BOUNDS, id, bounds: this.gpuBounds(c) });
    }

    this.requestRender(id);
    this.drawChart(c);
  }

  // sync: false, or the axes linked charts share - "x", "y" or "both" (true means "both").
  setSyncViews(sync: boolean | SyncViews): void {
    this._syncViews = sync === true ? "both" : sync || false;
  }

  setTheme(dark: boolean): void {
    this._isDark = dark;
    // THEME needs no device: a worker still starting takes it too (INIT carries it otherwise).
    this.worker?.postMessage({ type: M.THEME, isDark: dark });
    for (const chart of this.charts.values()) this.drawChart(chart);
  }

  onStats(callback: StatsCallback): () => void {
    this.statsCallbacks.push(callback);
    return () => {
      const idx = this.statsCallbacks.indexOf(callback);
      if (idx >= 0) this.statsCallbacks.splice(idx, 1);
    };
  }

  getStats(): ChartStats {
    return { ...this.currentStats };
  }

  // Called with the chart id whenever a chart's view changed through commitView: a plugin
  // gesture, resetView, setBounds(..., true), or a linked chart following. Returns the
  // unsubscribe function.
  onViewChange(listener: ViewChangeListener): () => void {
    this.viewListeners.add(listener);
    return () => {
      this.viewListeners.delete(listener);
    };
  }

  private emitViewChange(id: string): void {
    for (const listener of [...this.viewListeners]) {
      try {
        listener(id);
      } catch (e) {
        console.error("chartai: onViewChange listener failed", e);
      }
    }
  }

  // The one way to apply a changed chart.view: sends it to the worker, redraws, moves the
  // linked charts (setSyncViews) and reports the change for the chart and every chart it moved.
  commitView(target: InternalChart<any> | string): void {
    const chart = typeof target === "string" ? this.charts.get(target) : target;
    if (!chart || this.charts.get(chart.id) !== chart) return;
    this.sendViewTransform(chart);
    this.drawChart(chart);
    this.syncAllViews(chart);
    this.emitViewChange(chart.id);
  }

  // Animates the view back to the home view of the current window (bounds stay as they are).
  resetView(id: string): void {
    const chart = this.charts.get(id);
    if (!chart) return;
    for (const p of chart.plugins) p.resetView?.(chart);

    const { panX: spx, panY: spy, zoomX: szx, zoomY: szy } = chart.view;
    const t0 = performance.now();

    const animate = () => {
      if (this.charts.get(id) !== chart) return;
      const { panX: tpx, panY: tpy, zoomX: tzx, zoomY: tzy } = chart.homeView;
      const t = Math.min(1, (performance.now() - t0) / 300);
      const e = 1 - Math.pow(1 - t, 3);
      chart.view = {
        panX: spx + (tpx - spx) * e,
        panY: spy + (tpy - spy) * e,
        zoomX: szx + (tzx - szx) * e,
        zoomY: szy + (tzy - szy) * e,
      };
      this.commitView(chart);
      if (t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  // The legend's path: `hidden` are series indices. The states that differ from each series'
  // own `hidden` flag are kept by label, so the next updateSeries keeps them.
  setHiddenSeries(id: string, hidden: number[]): void {
    const chart = this.charts.get(id);
    if (!chart) return;
    this.applyHidden(chart, new Set(hidden));
    this.drawChart(chart);
  }

  // null goes back to the series' own flags and forgets the overrides.
  private applyHidden(chart: InternalChart<any>, hidden: Set<number> | null): void {
    const overrides = this.state(chart).hiddenOverrides;
    if (hidden) {
      // Per label (series may share one): the state of a series that differs from its flag.
      const next = new Map<string, boolean>();
      chart.series.forEach((s, i) => {
        const h = hidden.has(i);
        if (h !== !!s.hidden) next.set(s.label, h);
      });
      for (const s of chart.series) if (!next.has(s.label)) overrides.delete(s.label);
      for (const [label, h] of next) overrides.set(label, h);
    } else {
      overrides.clear();
    }
    chart.config.hiddenSeries = hidden ?? this.hiddenSet(chart);
    this.post({
      type: M.SET_STYLE,
      id: chart.id,
      hiddenSeries: chart.config.hiddenSeries,
    });
  }

  requestRender(id: string): void {
    const chart = this.charts.get(id);
    if (chart) this.sendViewTransform(chart);
  }

  private sendViewTransform(chart: InternalChart<any>): void {
    this.post({
      type: M.VIEW_TRANSFORM,
      id: chart.id,
      panX: chart.view.panX,
      panY: chart.view.panY,
      zoomX: chart.view.zoomX,
      zoomY: chart.view.zoomY,
    });
  }

  // Linked charts share the axes setSyncViews named. Charts of one quantity want both; a trend
  // page, whose plots share the window but each have their own scale, links "x" alone. The
  // source's visible data range (between its plot-area edges) becomes every other chart's
  // view through that chart's own bounds, so charts with different data extents show the same
  // times. Each chart moved is redrawn and reported (onViewChange); they are returned.
  syncAllViews(source: InternalChart<any>): InternalChart<any>[] {
    const mode = this._syncViews;
    const x = mode === "x" || mode === "both";
    const y = mode === "y" || mode === "both";
    if (!x && !y) return [];
    const [x0, x1] = visibleRange(source, "x");
    const [y0, y1] = visibleRange(source, "y");
    const moved: InternalChart<any>[] = [];
    for (const chart of this.charts.values()) {
      if (chart === source) continue;
      const view = { ...chart.view };
      const vx = x ? viewFor(chart, "x", x0, x1) : null;
      const vy = y ? viewFor(chart, "y", y0, y1) : null;
      if (vx) {
        view.panX = vx.pan;
        view.zoomX = vx.zoom;
      }
      if (vy) {
        view.panY = vy.pan;
        view.zoomY = vy.zoom;
      }
      const v = chart.view;
      if (
        view.panX === v.panX &&
        view.panY === v.panY &&
        view.zoomX === v.zoomX &&
        view.zoomY === v.zoomY
      )
        continue;
      chart.view = view;
      this.sendViewTransform(chart);
      this.drawChart(chart);
      moved.push(chart);
      this.emitViewChange(chart.id);
    }
    return moved;
  }

  // Resize (ResizeObserver) and device-pixel-ratio changes: canvases, buffer sizes and, for a
  // renderer whose bounds depend on the size, the bounds.
  private resizeChart(chart: InternalChart<any>, width: number, height: number): void {
    const dpr = currentDpr();
    const changed = width !== chart.width || height !== chart.height || dpr !== chart.dpr;
    chart.width = width;
    chart.height = height;
    chart.dpr = dpr;
    resizeCanvas(chart.backCanvas, width, height, dpr);
    resizeCanvas(chart.frontCanvas, width, height, dpr);
    if (changed && chart.renderer.boundsDependOnSize) {
      this.deriveBounds(chart);
      // With several y axes the axis maps follow the bounds, which changes the plot-space data.
      if (chart.yAxes) this.uploadSeries(chart);
      else this.post({ type: M.SET_BOUNDS, id: chart.id, bounds: this.gpuBounds(chart) });
    }
    const { bufferSizes, perSeriesPassMeta } = this.computeRendererMeta(
      chart.renderer,
      chart,
    );
    this.post({
      type: M.RESIZE,
      id: chart.id,
      width: Math.round(width * dpr),
      height: Math.round(height * dpr),
      bufferSizes,
      perSeriesPassMeta,
    });
    this.drawChart(chart);
  }

  // A device-pixel-ratio change (browser zoom, a window moved to another monitor) without a CSS
  // size change never reaches the ResizeObserver: a resolution media query catches it and
  // re-arms itself for the new ratio.
  private watchDpr(): void {
    if (typeof matchMedia !== "function") return;
    let mq: MediaQueryList;
    try {
      mq = matchMedia(`(resolution: ${currentDpr()}dppx)`);
    } catch {
      return;
    }
    if (!mq) return;
    const onChange = () => {
      if (typeof mq.removeEventListener === "function") mq.removeEventListener("change", onChange);
      else mq.removeListener?.(onChange);
      this.watchDpr();
      for (const chart of this.charts.values()) this.resizeChart(chart, chart.width, chart.height);
    };
    if (typeof mq.addEventListener === "function") mq.addEventListener("change", onChange);
    else mq.addListener?.(onChange);
  }

  // Redraws the overlay canvases. A plugin that changes the view while drawing (commitView from
  // beforeDraw) does not draw over the half-finished frame: the chart is drawn again after it.
  drawChart(chart: InternalChart<any>): void {
    if (!chart.visible) return;
    if (this.drawing.has(chart)) {
      this.redraw.add(chart);
      return;
    }
    this.drawing.add(chart);
    try {
      for (let pass = 0; pass < 3; pass++) {
        this.redraw.delete(chart);
        this.drawLayers(chart);
        if (!this.redraw.has(chart)) break;
      }
    } finally {
      this.drawing.delete(chart);
      this.redraw.delete(chart);
    }
  }

  private drawLayers(chart: InternalChart<any>): void {
    const dpr = chart.dpr || currentDpr();
    const backCtx = chart.backCanvas.getContext("2d");
    if (backCtx) {
      backCtx.clearRect(0, 0, chart.backCanvas.width, chart.backCanvas.height);
      backCtx.save();
      backCtx.scale(dpr, dpr);
      for (const p of chart.plugins) p.beforeDraw?.(backCtx, chart);
      backCtx.restore();
    }
    const ctx = chart.frontCanvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, chart.frontCanvas.width, chart.frontCanvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);
      for (const p of chart.plugins) p.afterDraw?.(ctx, chart);
      ctx.restore();
    }
  }
}

export const ChartManager = _ChartManager.getInstance();
export type ChartManager = _ChartManager;
