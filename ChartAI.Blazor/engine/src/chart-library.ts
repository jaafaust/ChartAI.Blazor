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
} from "./types.ts";
import { M } from "./msg.ts";
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

  setBounds(bounds: Bounds): void {
    this._mgr.setBounds(this.id, bounds);
  }

  configure(patch: Partial<C>): void {
    const c = this._c;
    if (!c) return;
    Object.assign(c.config, patch);

    // GPU uniforms — any numeric key matching a renderer uniform def or the special pointSize field
    const uniformNames = new Set(
      (c.renderer.uniforms ?? []).map((u) => u.name),
    );
    const workerValues: Record<string, number> = {};
    for (const key of Object.keys(patch)) {
      const val = (patch as Record<string, unknown>)[key];
      if (typeof val === "number" && uniformNames.has(key)) {
        workerValues[key] = val;
      }
    }
    if (Object.keys(workerValues).length > 0) {
      Object.assign(c.customUniforms, workerValues);
      this._mgr["worker"]?.postMessage({
        type: M.SET_UNIFORMS,
        id: this.id,
        values: workerValues,
      });
    }

    if ("hiddenSeries" in patch) {
      this._mgr["worker"]?.postMessage({
        type: M.SET_STYLE,
        id: this.id,
        hiddenSeries: patch.hiddenSeries ?? new Set<number>(),
      });
    }

    if ("bgColor" in patch && patch.bgColor !== undefined) {
      const [r, g, b] = patch.bgColor as [number, number, number];
      const wrap = c.el.querySelector("div") as HTMLElement;
      if (wrap)
        wrap.style.background = `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
      this._mgr["worker"]?.postMessage({
        type: M.SET_STYLE,
        id: this.id,
        bgColor: patch.bgColor,
      });
    }

    if ("yAxes" in patch || "yAxisGap" in patch || "defaultBounds" in patch) {
      this._mgr.refreshSeriesData(c);
    }

    this._mgr.requestRender(this.id);
    this._mgr.drawChart(c);
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

function isNumericArray(v: unknown): v is DataArray {
  return Array.isArray(v) || (ArrayBuffer.isView(v) && !(v instanceof DataView));
}

function isSortedAscending(x: DataArray): boolean {
  for (let i = 1; i < x.length; i++) if (!(x[i] >= x[i - 1])) return false;
  return true;
}

// A missing sample is null/NaN on the JS side and GPU_GAP on the GPU: NaN is not reliable in
// WGSL, and Float32Array would silently turn null into 0.
function toGpu(arr: DataArray, scale = 1, offset = 0): Float32Array {
  const n = arr.length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = arr[i];
    out[i] = v == null || v !== v ? GPU_GAP : v * scale + offset;
  }
  return out;
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
function mapPlot(arr: DataArray, scale: number, offset: number): Float64Array {
  const n = arr.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const v = arr[i];
    out[i] = v == null || v !== v ? NaN : v * scale + offset;
  }
  return out;
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

function resizeCanvas(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  cssW: number,
  cssH: number,
): void {
  const dpr = devicePixelRatio || 1;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  if (canvas instanceof HTMLCanvasElement) {
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
  }
}

type StatsCallback = (stats: ChartStats) => void;

// One series as sent to the worker (UPDATE_SERIES). dataX is null when every series shares the
// chart's x array, which then travels once as `sharedX`.
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

class _ChartManager {
  private static instance: _ChartManager | null = null;

  private worker: Worker | null = null;
  private charts = new Map<string, InternalChart<any>>();
  private renderers = new Map<string, RendererPlugin>();
  private uiPlugins: ChartPlugin<any>[] = [];
  private pendingRenderers: RendererPlugin[] = [];
  private chartIdCounter = 0;
  private _isDark = false;
  private _syncViews: SyncViews = false;
  private statsCallbacks: StatsCallback[] = [];
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
          this.worker?.postMessage({
            type: M.SET_VISIBILITY,
            id,
            visible: e.isIntersecting,
          });
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
        chart.width = width;
        chart.height = height;
        const dpr = devicePixelRatio || 1;
        resizeCanvas(chart.backCanvas, width, height);
        resizeCanvas(chart.frontCanvas, width, height);
        const { bufferSizes, perSeriesPassMeta } = this.computeRendererMeta(
          chart.renderer,
          chart,
        );
        this.worker?.postMessage({
          type: M.RESIZE,
          id,
          width: Math.round(width * dpr),
          height: Math.round(height * dpr),
          bufferSizes,
          perSeriesPassMeta,
        });
        this.drawChart(chart);
      }
    });
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

  use(plugin: RendererPlugin | ChartPlugin<any>): void {
    if ("passes" in plugin) {
      const r = plugin as RendererPlugin;
      this.renderers.set(r.name, r);
      if (this.worker) this.sendRendererRegistration(r);
      else this.pendingRenderers.push(r);
    } else {
      const p = plugin as ChartPlugin<any>;
      if (!this.uiPlugins.some((x) => x.name === p.name))
        this.uiPlugins.push(p);
    }
  }

  async init(): Promise<boolean> {
    if (this.worker) return true;
    return new Promise((resolve) => {
      import("./worker-inline.js")
        .then(({ WORKER_CODE }) => {
          const blob = new Blob([WORKER_CODE], {
            type: "application/javascript",
          });
          this.worker = new Worker(URL.createObjectURL(blob), {
            type: "module",
          });
          this.setupWorkerHandlers(resolve);
        })
        .catch(() => {
          this.worker = new Worker(
            new URL("./gpu-worker.js", import.meta.url),
            { type: "module" },
          );
          this.setupWorkerHandlers(resolve);
        });
    });
  }

  private setupWorkerHandlers(resolve: (v: boolean) => void): void {
    if (!this.worker) return;
    this.worker.onmessage = (e) => {
      const { type, ...data } = e.data;
      switch (type) {
        case M.GPU_READY:
          for (const r of this.pendingRenderers)
            this.sendRendererRegistration(r);
          this.pendingRenderers = [];
          resolve(true);
          break;
        case M.ERROR:
          console.error("chartai:", data.code, data.message ?? "");
          resolve(false);
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
    this.worker.onerror = (e) => {
      console.error("chartai:", e);
      resolve(false);
    };
    this.worker.postMessage({ type: M.INIT, isDark: this._isDark });
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
    this.worker?.postMessage({
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

    // Buffer sizes and dispatch counts must use physical pixels — the worker renders at physical resolution
    const dpr = devicePixelRatio || 1;
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
  // Implementation
  create(config: any): Chart<any> {
    if (!this.worker) throw new Error("No worker. Call init().");
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

    const mkCanvas = (z: number, events: string) => {
      const c = document.createElement("canvas");
      c.style.cssText = `position:absolute;inset:0;width:100%;height:100%;pointer-events:${events};z-index:${z};`;
      return c;
    };
    const backCanvas = mkCanvas(0, "none");
    const gpuCanvas = mkCanvas(1, "auto");
    const frontCanvas = mkCanvas(2, "none");

    wrap.append(backCanvas, gpuCanvas, frontCanvas);
    el.appendChild(wrap);
    config.container.appendChild(el);

    let offscreen: OffscreenCanvas;
    try {
      offscreen = gpuCanvas.transferControlToOffscreen();
    } catch (e) {
      throw new Error(`Failed OffscreenCanvas: ${e}`);
    }

    const rect = wrap.getBoundingClientRect();
    const cssW = rect.width || 400;
    const cssH = rect.height || 200;
    resizeCanvas(offscreen, cssW, cssH);
    resizeCanvas(backCanvas, cssW, cssH);
    resizeCanvas(frontCanvas, cssW, cssH);

    if (config.bgColor) {
      const [r, g, b] = config.bgColor;
      wrap.style.background = `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
    }

    const customUniforms: Record<string, number> = {};
    for (const u of renderer.uniforms ?? []) {
      const v = (config as Record<string, unknown>)[u.name];
      customUniforms[u.name] = typeof v === "number" ? v : u.default;
    }
    const chart: InternalChart<any> = {
      id,
      config,
      el,
      backCanvas,
      frontCanvas,
      width: cssW,
      height: cssH,
      series: [],
      bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1 },
      view: { panX: 0, panY: 0, zoomX: 1, zoomY: 1 },
      homeView: { panX: 0, panY: 0, zoomX: 1, zoomY: 1 },
      visible: true,
      dragging: false,
      plugins: [...this.uiPlugins],
      renderer,
      customUniforms,
    };

    this.charts.set(id, chart as InternalChart<any>);

    const dpr = devicePixelRatio || 1;
    const { bufferSizes, perSeriesPassMeta } = this.computeRendererMeta(
      renderer,
      chart,
    );
    this.worker.postMessage(
      {
        type: M.REGISTER_CHART,
        id,
        canvas: offscreen,
        rendererName: config.type,
        bgColor: config.bgColor ?? null,
        bufferSizes,
        perSeriesPassMeta,
        customUniformValues: customUniforms,
        width: Math.round(cssW * dpr),
        height: Math.round(cssH * dpr),
      },
      [offscreen],
    );

    this.visibilityObserver.observe(el);
    this.resizeObserver.observe(wrap);

    for (const plugin of chart.plugins) plugin.install?.(chart, wrap);
    renderer.install?.(chart, wrap);

    this.updateSeries(id, config.series, { capacity: config.capacity, bounds: config.defaultBounds });
    return new Chart<any>(id, this);
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
    this.worker?.postMessage({ type: M.UNREGISTER_CHART, id });
    this.charts.delete(id);
  }

  updateSeries(id: string, series: ChartSeries[], opts: UpdateSeriesOptions = {}): void {
    const chart = this.charts.get(id);
    if (!chart || !this.worker || series.length === 0) return;

    chart.config.hiddenSeries = series.reduce<Set<number>>((acc, s, i) => {
      if (s.hidden) acc.add(i);
      return acc;
    }, new Set());

    chart.series = series.map((s): InternalSeries => {
      const n = s.x.length;
      const color = parseColor(s.color);
      // An empty series keeps its extra arrays (empty): the renderer's bind groups need every
      // buffer to exist, and follow mode later patches columns into the capacity-sized buffers.
      // Time series arrive sorted: keep them by reference and only sort the ones that are not.
      const idx = isSortedAscending(s.x)
        ? null
        : Array.from({ length: n }, (_, i) => i).sort((a, b) => s.x[a] - s.x[b]);
      const pick = (arr: DataArray): DataArray => (idx ? idx.map((i) => arr[i]) : arr);
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
        color,
        yAxis: s.yAxis,
        rawX: pick(s.x),
        rawY: pick(s.y),
        extra,
      };
    });

    if (opts.bounds) chart.config.defaultBounds = { ...opts.bounds };
    this.refreshSeriesData(chart, opts.capacity);
  }

  // Re-derive axes, bounds and GPU-space data from chart.series and push it to
  // the worker. Also called after axis-affecting config changes (yAxes, gap,
  // defaultBounds), so those take effect without re-supplying the data; the GPU
  // buffers keep the capacity they have then.
  refreshSeriesData(chart: InternalChart<any>, capacity?: number): void {
    if (!this.worker || chart.series.length === 0) return;

    const axes = yAxisDefs(chart);
    chart.yAxes = axes;

    const customBounds = chart.renderer.computeBounds?.(chart.series);
    let minX: number, maxX: number, minY: number, maxY: number;

    if (!axes) {
      for (const s of chart.series) {
        s.axisIndex = 0;
        s.plotY = s.rawY;
      }
      ({ minX, maxX, minY, maxY } =
        customBounds ??
        (() => {
          let minX = Infinity,
            maxX = -Infinity,
            minY = Infinity,
            maxY = -Infinity;
          for (const s of chart.series) {
            for (let i = 0; i < s.rawX.length; i++) {
              const x = s.rawX[i],
                y = s.rawY[i];
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y != null && y < minY) minY = y;
              if (y != null && y > maxY) maxY = y;
            }
          }
          if (!isFinite(minX)) {
            minX = 0;
            maxX = 1;
          }
          if (!isFinite(minY)) {
            minY = 0;
            maxY = 1;
          }
          const px = (maxX - minX) * 0.05 || 1;
          const py = (maxY - minY) * 0.1 || 1;
          return {
            minX: minX - px,
            maxX: maxX + px,
            minY: minY - py,
            maxY: maxY + py,
          };
        })());

      const db = chart.config.defaultBounds;
      if (db) {
        if (db.minX !== undefined) minX = db.minX;
        if (db.maxX !== undefined) maxX = db.maxX;
        if (db.minY !== undefined) minY = db.minY;
        if (db.maxY !== undefined) maxY = db.maxY;
      }
    } else {
      // X bounds: renderer-specific if available, else data extent + 5% pad.
      if (customBounds) {
        minX = customBounds.minX;
        maxX = customBounds.maxX;
      } else {
        let lo = Infinity,
          hi = -Infinity;
        for (const s of chart.series) {
          for (const x of s.rawX) {
            if (x < lo) lo = x;
            if (x > hi) hi = x;
          }
        }
        if (!isFinite(lo)) {
          lo = 0;
          hi = 1;
        }
        const px = (hi - lo) * 0.05 || 1;
        minX = lo - px;
        maxX = hi + px;
      }

      const byId = new Map(axes.map((a, i) => [a.id, i] as const));
      for (const s of chart.series)
        s.axisIndex =
          s.yAxis != null && byId.has(String(s.yAxis)) ? byId.get(String(s.yAxis))! : 0;

      // Per-axis Y bounds from that axis' series (incl. y-positional channels),
      // 10% pad; manual min/max win.
      for (let ai = 0; ai < axes.length; ai++) {
        const ax = axes[ai];
        let lo = Infinity,
          hi = -Infinity;
        for (const s of chart.series) {
          if (s.axisIndex !== ai) continue;
          for (const v of s.rawY) {
            if (v < lo) lo = v;
            if (v > hi) hi = v;
          }
          for (const key of Y_PLOT_CHANNELS) {
            const arr = s.extra[key];
            if (!arr) continue;
            for (const v of arr) {
              if (v < lo) lo = v;
              if (v > hi) hi = v;
            }
          }
        }
        if (!isFinite(lo)) {
          lo = 0;
          hi = 1;
        }
        const pad = (hi - lo) * 0.1 || 1;
        ax.min = ax.min ?? lo - pad;
        ax.max = ax.max ?? hi + pad;
      }

      const db = chart.config.defaultBounds;
      if (db) {
        if (db.minX !== undefined) minX = db.minX;
        if (db.maxX !== undefined) maxX = db.maxX;
        if (db.minY !== undefined) axes[0].min = db.minY;
        if (db.maxY !== undefined) axes[0].max = db.maxY;
      }

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

      for (const s of chart.series) {
        const ax = axes[s.axisIndex!];
        s.plotY =
          ax.scale === 1 && ax.offset === 0 ? s.rawY : mapPlot(s.rawY, ax.scale!, ax.offset!);
      }
    }

    chart.bounds = { minX, maxX, minY, maxY };

    // GPU buffers are sized to the capacity so patchSeries can append without recreating them;
    // a refresh after a config change keeps the capacity the buffers already have.
    let longest = 0;
    for (const s of chart.series) if (s.rawX.length > longest) longest = s.rawX.length;
    chart.capacity = Math.max(capacity ?? chart.capacity ?? 0, longest);

    const { bufferSizes, perSeriesPassMeta } = this.computeRendererMeta(
      chart.renderer,
      chart,
    );

    const hidden = chart.config.hiddenSeries ?? new Set<number>();
    // Series sharing one x array by reference (a sampled trend) upload it once, bound to every series.
    const sharedX = chart.series.every((s) => s.rawX === chart.series[0].rawX)
      ? chart.series[0].rawX
      : null;
    const sharedXData = sharedX ? toGpu(sharedX) : null;
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
        dataX: sharedXData ? null : toGpu(s.rawX),
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

    this.worker.postMessage(
      {
        type: M.UPDATE_SERIES,
        id: chart.id,
        series: seriesData,
        bounds: chart.bounds,
        bufferSizes,
        perSeriesPassMeta,
        capacity: chart.capacity,
        sharedX: sharedXData,
      },
      transferables,
    );
    this.sendViewTransform(chart);
    this.drawChart(chart);
  }

  // Writes columns [offset, count) of every series into the GPU buffers updateSeries created
  // (up to `capacity` columns per series) without recreating anything - follow mode's per-tick
  // path. `series` carries each series' full arrays of length `count` (y plus the renderer's
  // extra arrays such as lo/hi), which also become what the hover layer reads; `x` is the shared
  // x array. All values of one tick travel in one packed transferable.
  patchSeries(id: string, patch: SeriesPatch): void {
    const chart = this.charts.get(id);
    if (!chart || !this.worker || chart.series.length === 0) return;
    const { offset, count, x, series, bounds } = patch;
    const n = chart.series.length;
    if (series.length !== n || count > chart.capacity! || offset < 0 || offset > count)
      throw new Error(
        `patchData: ${series.length} series with columns ${offset}..${count} do not fit a chart of ${n} series x ${chart.capacity} columns`,
      );
    const k = count - offset;
    const extraKeys = Object.keys(chart.series[0].extra);
    const axes = chart.yAxes;

    for (let i = 0; i < n; i++) {
      const s = chart.series[i],
        p = series[i];
      s.rawX = x as DataArray;
      s.rawY = p.y;
      for (const key of extraKeys) if (p[key]) s.extra[key] = p[key]!;
      // A series on a secondary axis is drawn in primary-axis space with the mapping of the last
      // full update (see refreshSeriesData); the hover reads the same mapping.
      const ax = axes?.[s.axisIndex!];
      s.plotY =
        ax && (ax.scale !== 1 || ax.offset !== 0) ? mapPlot(p.y, ax.scale!, ax.offset!) : p.y;
    }
    if (bounds) {
      chart.config.defaultBounds = { ...bounds };
      chart.bounds = { ...bounds };
    }

    let packed: Float32Array | null = null,
      xData: Float32Array | null = null;
    const transferables: ArrayBuffer[] = [];
    if (k > 0) {
      packed = new Float32Array((1 + extraKeys.length) * n * k);
      for (let i = 0; i < n; i++) {
        const p = series[i];
        const ax = axes?.[chart.series[i].axisIndex!];
        const mapped = !!ax && (ax.scale !== 1 || ax.offset !== 0);
        packInto(packed, i * k, p.y, offset, k, mapped ? ax.scale! : 1, mapped ? ax.offset! : 0);
        for (let e = 0; e < extraKeys.length; e++) {
          const key = extraKeys[e];
          const scale = mapped && (Y_PLOT_CHANNELS.has(key) || key === "h") ? ax.scale! : 1;
          const off = mapped && Y_PLOT_CHANNELS.has(key) ? ax.offset! : 0;
          packInto(packed, ((e + 1) * n + i) * k, p[key]!, offset, k, scale, off);
        }
      }
      transferables.push(packed.buffer as ArrayBuffer);
      if (x) {
        const xa = x as any;
        xData = toGpu(xa.subarray ? xa.subarray(offset, count) : xa.slice(offset, count));
        transferables.push(xData.buffer as ArrayBuffer);
      }
    }

    this.worker.postMessage(
      {
        type: M.PATCH_SERIES,
        id,
        offset,
        k,
        count,
        x: xData,
        packed,
        extra: extraKeys,
        bounds: bounds ? chart.bounds : null,
      },
      transferables,
    );
    this.sendViewTransform(chart);
    this.drawChart(chart);
  }

  // Moves the data window without touching the data: follow mode's tick when nothing new arrived.
  setBounds(id: string, bounds: Bounds): void {
    const chart = this.charts.get(id);
    if (!chart || !this.worker) return;
    chart.config.defaultBounds = { ...bounds };
    chart.bounds = { ...bounds };
    this.worker.postMessage({ type: M.SET_BOUNDS, id, bounds: chart.bounds });
    this.sendViewTransform(chart);
    this.drawChart(chart);
  }

  // sync: false, or the axes linked charts share - "x", "y" or "both" (true means "both").
  setSyncViews(sync: boolean | SyncViews): void {
    this._syncViews = sync === true ? "both" : sync || false;
  }

  setTheme(dark: boolean): void {
    this._isDark = dark;
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

  resetView(id: string): void {
    const chart = this.charts.get(id);
    if (!chart) return;
    for (const p of chart.plugins) p.resetView?.(chart);

    const { panX: spx, panY: spy, zoomX: szx, zoomY: szy } = chart.view;
    const { panX: tpx, panY: tpy, zoomX: tzx, zoomY: tzy } = chart.homeView;
    const t0 = performance.now();

    const animate = () => {
      const t = Math.min(1, (performance.now() - t0) / 300);
      const e = 1 - Math.pow(1 - t, 3);
      chart.view.panX = spx + (tpx - spx) * e;
      chart.view.panY = spy + (tpy - spy) * e;
      chart.view.zoomX = szx + (tzx - szx) * e;
      chart.view.zoomY = szy + (tzy - szy) * e;
      this.sendViewTransform(chart);
      this.drawChart(chart);
      if (this._syncViews) this.syncAllViews(chart);
      if (t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  setHiddenSeries(id: string, hidden: number[]): void {
    const chart = this.charts.get(id);
    if (!chart) return;
    chart.config.hiddenSeries = new Set(hidden);
    this.worker?.postMessage({
      type: M.SET_STYLE,
      id,
      hiddenSeries: chart.config.hiddenSeries,
    });
    this.drawChart(chart);
  }

  requestRender(id: string): void {
    const chart = this.charts.get(id);
    if (chart) this.sendViewTransform(chart);
  }

  private sendViewTransform(chart: InternalChart<any>): void {
    this.worker?.postMessage({
      type: M.VIEW_TRANSFORM,
      id: chart.id,
      panX: chart.view.panX,
      panY: chart.view.panY,
      zoomX: chart.view.zoomX,
      zoomY: chart.view.zoomY,
    });
  }

  // Linked charts share the axes setSyncViews named. Charts of one quantity want both; a trend
  // page, whose plots share the window but each have their own scale, links "x" alone.
  syncAllViews(source: InternalChart<any>): void {
    const mode = this._syncViews;
    const x = mode === "x" || mode === "both";
    const y = mode === "y" || mode === "both";
    if (!x && !y) return;
    for (const chart of this.charts.values()) {
      if (chart.id !== source.id) {
        const view = { ...chart.view };
        if (x) {
          view.panX = source.view.panX;
          view.zoomX = source.view.zoomX;
        }
        if (y) {
          view.panY = source.view.panY;
          view.zoomY = source.view.zoomY;
        }
        chart.view = view;
        this.sendViewTransform(chart);
        this.drawChart(chart);
      }
    }
  }

  drawChart(chart: InternalChart<any>): void {
    if (!chart.visible) return;
    const dpr = devicePixelRatio || 1;
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
