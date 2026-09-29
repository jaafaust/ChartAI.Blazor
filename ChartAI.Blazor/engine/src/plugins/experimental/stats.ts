import type {
  ChartPlugin,
  ChartConfig,
  DataArray,
  InternalChart,
  ResolvedYAxis,
} from "../../types.ts";
import { ChartManager } from "../../chart-library.ts";
import { chartMargin, hiddenKey, sameKey } from "../shared.ts";
import { DEFAULT_FONT } from "../labels.ts";

export type StatsPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface StatsConfig {
  statsPosition?: StatsPosition;
  fontFamily?: string;
  textColor?: string;
  statsPrecision?: number;
  formatValue?: (n: number) => string;
  statsShowSeries?: boolean;
}

declare module "../../types.ts" {
  interface ChartPluginRegistry {
    stats: StatsConfig;
  }
}

export interface SeriesStats {
  min: number;
  max: number;
  mean: number;
  stddev: number;
  count: number;
}

// Streaming min / max / mean / variance: one pass, nothing kept. The sums are taken relative to
// the first sample, which keeps the variance accurate for values far from zero (a large offset,
// epoch times) where plain sums of squares cancel.
interface Accumulator {
  n: number;
  shift: number;
  sum: number;
  sumSq: number;
  min: number;
  max: number;
}

const newAccumulator = (): Accumulator => ({
  n: 0,
  shift: 0,
  sum: 0,
  sumSq: 0,
  min: Infinity,
  max: -Infinity,
});

// Adds values[start..end) to acc, skipping gaps (null, NaN) and infinities.
function accumulate(acc: Accumulator, values: ArrayLike<number>, start: number, end: number): void {
  let { n, shift, sum, sumSq, min, max } = acc;
  for (let i = start; i < end; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) continue;
    if (n === 0) shift = v;
    const d = v - shift;
    n++;
    sum += d;
    sumSq += d * d;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  Object.assign(acc, { n, shift, sum, sumSq, min, max });
}

function finish(acc: Accumulator): SeriesStats | null {
  if (acc.n === 0) return null;
  const d = acc.sum / acc.n;
  return {
    min: acc.min,
    max: acc.max,
    mean: acc.shift + d,
    stddev: Math.sqrt(Math.max(0, acc.sumSq / acc.n - d * d)),
    count: acc.n,
  };
}

// Population statistics of the finite values; null when there are none.
export function computeStats(values: ArrayLike<number>): SeriesStats | null {
  const acc = newAccumulator();
  accumulate(acc, values, 0, values.length);
  return finish(acc);
}

// The statistics of one y axis: series on different axes are in different units, so each axis
// with visible series gets its own column. A chart with one axis has one group, axis null.
interface StatsGroup {
  axis: ResolvedYAxis | null;
  stats: SeriesStats;
}

// Columns [start, end) of a sorted x array inside [lo, hi].
function sortedRange(x: DataArray, lo: number, hi: number): [number, number] {
  let a = 0,
    b = x.length;
  while (a < b) {
    const mid = (a + b) >> 1;
    if (x[mid] < lo) a = mid + 1;
    else b = mid;
  }
  const start = a;
  b = x.length;
  while (a < b) {
    const mid = (a + b) >> 1;
    if (x[mid] <= hi) a = mid + 1;
    else b = mid;
  }
  return [start, a];
}

function computeGroups(chart: InternalChart<any>): StatsGroup[] {
  const { bounds: b, view: v } = chart;
  const fullX = b.maxX - b.minX;
  const visMinX = b.minX + v.panX * fullX;
  const visMaxX = visMinX + fullX / v.zoomX;
  const hidden: Set<number> | undefined = chart.config.hiddenSeries;
  // x is sorted unless the renderer opted out of sorting (histogram): then every sample is tested.
  const sorted = chart.renderer.sortX !== false;
  const accs: Accumulator[] = [];
  for (let si = 0; si < chart.series.length; si++) {
    if (hidden?.has(si)) continue;
    const s = chart.series[si];
    const ai = s.axisIndex ?? 0;
    const acc = (accs[ai] ??= newAccumulator());
    if (sorted) {
      const [start, end] = sortedRange(s.rawX, visMinX, visMaxX);
      accumulate(acc, s.rawY, start, end);
    } else {
      const n = Math.min(s.rawX.length, s.rawY.length);
      for (let i = 0; i < n; i++) {
        const x = s.rawX[i];
        if (x >= visMinX && x <= visMaxX) accumulate(acc, s.rawY, i, i + 1);
      }
    }
  }
  const groups: StatsGroup[] = [];
  accs.forEach((acc, ai) => {
    const stats = finish(acc);
    if (stats) groups.push({ axis: chart.yAxes?.[ai] ?? null, stats });
  });
  return groups;
}

// Everything the numbers depend on. patchData and setData hand over new arrays, so array
// identity and length stand for the data; the view and bounds for the window.
function statsKey(chart: InternalChart<any>): unknown[] {
  const { bounds: b, view: v } = chart;
  const key: unknown[] = [
    chart.series,
    chart.yAxes,
    b.minX,
    b.maxX,
    v.panX,
    v.zoomX,
    hiddenKey(chart),
  ];
  for (const s of chart.series) key.push(s.rawX, s.rawY, s.rawX.length, s.rawY.length);
  return key;
}

// While the view or the data keeps changing (a pan, follow mode), the visible samples are
// scanned at most this often; the last change is always shown.
const STATS_INTERVAL_MS = 100;

interface StatsState {
  overlay: HTMLDivElement;
  header: HTMLDivElement;
  body: HTMLDivElement;
  collapsed: boolean;
  abort: AbortController;
  dragOffset: { x: number; y: number } | null;
  customPos: { x: number; y: number } | null;
  // Whether the current press began on the header, and whether it moved the panel: a press on
  // the header that did not move it toggles the panel.
  pressOnHeader: boolean;
  dragMoved: boolean;
  tiltAngle: number;
  tiltVelocity: number;
  tiltRafId: number | null;
  // The groups computed for `key`, when, and a pending throttled recompute.
  key: unknown[] | null;
  groups: StatsGroup[];
  computedAt: number;
  timer: ReturnType<typeof setTimeout> | null;
  // What was last written to the DOM, so an unchanged draw writes nothing.
  lookKey: string;
  headerHtml: string;
  bodyHtml: string;
}

const states = new WeakMap<InternalChart, StatsState>();

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// Panel colours and position: written only when they change.
function applyLook(chart: InternalChart<ChartConfig & StatsConfig>, state: StatsState, visible: boolean) {
  const { overlay } = state;
  const dark = ChartManager.isDark;
  const cfg = chart.config;
  const bgColor = cfg.bgColor ?? (dark ? [0.11, 0.11, 0.12] : [0.98, 0.98, 0.98]);
  const rgb = bgColor.map((c: number) => Math.round(c * 255)).join(",");
  const panelBg = dark ? `rgba(${rgb},0.92)` : "rgba(255,255,255,0.95)";
  const border = dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.10)";
  const text = cfg.textColor ?? (dark ? "#c0c0c0" : "#333333");
  const font = cfg.fontFamily ?? DEFAULT_FONT;
  const pos: StatsPosition = cfg.statsPosition ?? "top-left";
  const m = chartMargin(chart);
  // A panel being dragged keeps the position the drag gives it.
  const place = state.dragOffset
    ? "drag"
    : state.customPos
      ? `${state.customPos.x},${state.customPos.y}`
      : `${pos}|${m.top}|${m.right}|${m.bottom}|${m.left}`;
  const key = [visible, panelBg, border, text, font, place].join("|");
  if (key === state.lookKey) return;
  state.lookKey = key;

  // Use individual style properties so we never overwrite position/cursor during drag
  overlay.style.display = visible ? "block" : "none";
  overlay.style.position = "absolute";
  overlay.style.pointerEvents = "auto";
  overlay.style.zIndex = "15";
  overlay.style.background = panelBg;
  overlay.style.border = `1px solid ${border}`;
  overlay.style.borderRadius = "6px";
  overlay.style.padding = "7px 10px";
  overlay.style.fontFamily = font;
  overlay.style.fontSize = "11px";
  overlay.style.color = text;
  overlay.style.minWidth = "100px";
  overlay.style.userSelect = "none";

  if (state.dragOffset) return;
  const pad = 6;
  if (state.customPos) {
    overlay.style.top = `${state.customPos.y}px`;
    overlay.style.left = `${state.customPos.x}px`;
    overlay.style.right = "auto";
    overlay.style.bottom = "auto";
  } else {
    overlay.style.right = "auto";
    overlay.style.bottom = "auto";
    overlay.style.top = "auto";
    overlay.style.left = "auto";
    if (pos === "top-left")     { overlay.style.top = `${m.top + pad}px`;    overlay.style.left  = `${m.left + pad}px`; }
    if (pos === "top-right")    { overlay.style.top = `${m.top + pad}px`;    overlay.style.right = `${m.right + pad}px`; overlay.style.left = "auto"; }
    if (pos === "bottom-left")  { overlay.style.bottom = `${m.bottom + pad}px`; overlay.style.left = `${m.left + pad}px`; overlay.style.top = "auto"; }
    if (pos === "bottom-right") { overlay.style.bottom = `${m.bottom + pad}px`; overlay.style.right = `${m.right + pad}px`; overlay.style.top = "auto"; overlay.style.left = "auto"; }
  }
}

function setContent(state: StatsState, headerHtml: string, bodyHtml: string) {
  if (headerHtml !== state.headerHtml) state.header.innerHTML = state.headerHtml = headerHtml;
  if (bodyHtml !== state.bodyHtml) state.body.innerHTML = state.bodyHtml = bodyHtml;
}

function updateOverlay(chart: InternalChart<ChartConfig & StatsConfig>, state: StatsState) {
  const dark = ChartManager.isDark;
  const cfg = chart.config;
  const muted = dark ? "#777" : "#aaa";
  const precision = cfg.statsPrecision ?? 2;
  const fmt = cfg.formatValue ?? ((n: number) => n.toFixed(precision));
  const title = (arrow: string) =>
    `<span style="color:${muted};font-size:10px;font-weight:600;letter-spacing:.04em;cursor:grab">STATS ${arrow}</span>`;

  if (state.collapsed) {
    applyLook(chart, state, true);
    setContent(state, title("&#9660;"), "");
    return;
  }

  const key = statsKey(chart);
  if (!sameKey(state.key, key)) {
    const now = performance.now();
    const wait = state.computedAt + STATS_INTERVAL_MS - now;
    if (wait <= 0) {
      state.key = key;
      state.computedAt = now;
      state.groups = computeGroups(chart);
    } else if (state.timer === null) {
      // Scanned a moment ago: the numbers shown stay until the interval has passed.
      state.timer = setTimeout(() => {
        state.timer = null;
        if (states.get(chart) === state) updateOverlay(chart, state);
      }, wait);
    }
  }

  const groups = state.groups;
  applyLook(chart, state, groups.length > 0);
  if (groups.length === 0) return;

  // One value column per axis; the axis names head the columns once there is more than one.
  const cell = (s: string) => `<span>${s}</span>`;
  const row = (label: string, value: (g: StatsGroup) => string) =>
    `<span style="color:${muted}">${label}</span>${groups.map((g) => cell(value(g))).join("")}`;
  const head =
    groups.length > 1
      ? `<span></span>${groups
          .map((g) => {
            const color = g.axis?.color ? `color:${escapeHtml(g.axis.color)};` : `color:${muted};`;
            return `<span style="${color}font-weight:600">${escapeHtml(g.axis?.id ?? "")}</span>`;
          })
          .join("")}`
      : "";
  const body = `
    <div style="display:grid;grid-template-columns:auto${" auto".repeat(groups.length)};gap:1px 10px">
      ${head}
      ${row("min", (g) => fmt(g.stats.min))}
      ${row("max", (g) => fmt(g.stats.max))}
      ${row("avg", (g) => fmt(g.stats.mean))}
      ${row("&#963;", (g) => fmt(g.stats.stddev))}
      ${row("n", (g) => g.stats.count.toLocaleString())}
    </div>`;
  setContent(state, `<div style="margin-bottom:4px">${title("&#9650;")}</div>`, body);
}

export const statsPlugin: ChartPlugin<StatsConfig> = {
  name: "stats",

  install(chart, el) {
    const ac = new AbortController();
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:absolute;pointer-events:auto;z-index:15;";
    const header = document.createElement("div");
    const body = document.createElement("div");
    overlay.appendChild(header);
    overlay.appendChild(body);
    el.appendChild(overlay);

    const state: StatsState = {
      overlay,
      header,
      body,
      collapsed: false,
      abort: ac,
      dragOffset: null,
      customPos: null,
      pressOnHeader: false,
      dragMoved: false,
      tiltAngle: 0,
      tiltVelocity: 0,
      tiltRafId: null,
      key: null,
      groups: [],
      computedAt: -Infinity,
      timer: null,
      lookKey: "",
      headerHtml: "",
      bodyHtml: "",
    };
    states.set(chart, state);

    // Clicks on the panel are the panel's: they must not reach the chart (a ruler point, a
    // tooltip pin) or the host. The toggle is decided from the press rather than the click's
    // target, which pointer capture turns into the panel itself.
    overlay.addEventListener(
      "click",
      (e) => {
        e.stopPropagation();
        if (!state.pressOnHeader || state.dragMoved) return;
        state.collapsed = !state.collapsed;
        updateOverlay(chart as InternalChart<ChartConfig & StatsConfig>, state);
      },
      { signal: ac.signal },
    );

    overlay.addEventListener(
      "pointerdown",
      (e) => {
        e.stopPropagation();
        state.pressOnHeader = header.contains(e.target as Node);
        if (!state.customPos) {
          state.customPos = { x: overlay.offsetLeft, y: overlay.offsetTop };
          overlay.style.left = state.customPos.x + "px";
          overlay.style.top = state.customPos.y + "px";
          overlay.style.right = "auto";
          overlay.style.bottom = "auto";
        }
        state.dragOffset = { x: 0, y: 0 };
        state.dragMoved = false;
        if (state.tiltRafId !== null) {
          cancelAnimationFrame(state.tiltRafId);
          state.tiltRafId = null;
        }
        overlay.setPointerCapture(e.pointerId);
        overlay.style.cursor = "grabbing";
      },
      { signal: ac.signal },
    );

    overlay.addEventListener(
      "pointermove",
      (e) => {
        if (!state.dragOffset || !state.customPos) return;
        const x = Math.max(0, Math.min(state.customPos.x + e.movementX, el.clientWidth - overlay.offsetWidth));
        const y = Math.max(0, Math.min(state.customPos.y + e.movementY, el.clientHeight - overlay.offsetHeight));
        state.dragOffset.x += e.movementX;
        state.dragOffset.y += e.movementY;
        if (Math.hypot(state.dragOffset.x, state.dragOffset.y) > 3) state.dragMoved = true;
        state.customPos = { x, y };
        overlay.style.left = x + "px";
        overlay.style.top = y + "px";
        state.tiltVelocity = state.tiltVelocity * 0.6 + e.movementX * 0.4;
        state.tiltAngle = Math.max(-15, Math.min(15, state.tiltVelocity * 1.5));
        overlay.style.transform = `rotate(${state.tiltAngle}deg)`;
      },
      { signal: ac.signal },
    );

    overlay.addEventListener(
      "pointerup",
      () => {
        state.dragOffset = null;
        overlay.style.cursor = "";
        const decayTilt = () => {
          state.tiltAngle *= 0.78;
          state.tiltVelocity *= 0.78;
          if (Math.abs(state.tiltAngle) > 0.05) {
            overlay.style.transform = `rotate(${state.tiltAngle}deg)`;
            state.tiltRafId = requestAnimationFrame(decayTilt);
          } else {
            state.tiltAngle = 0;
            state.tiltVelocity = 0;
            overlay.style.transform = "";
            state.tiltRafId = null;
          }
        };
        state.tiltRafId = requestAnimationFrame(decayTilt);
      },
      { signal: ac.signal },
    );
  },

  afterDraw(_, chart) {
    const state = states.get(chart);
    if (!state) return;
    updateOverlay(chart as InternalChart<ChartConfig & StatsConfig>, state);
  },

  uninstall(chart) {
    const state = states.get(chart);
    if (state) {
      if (state.tiltRafId !== null) cancelAnimationFrame(state.tiltRafId);
      if (state.timer !== null) clearTimeout(state.timer);
      state.abort.abort();
      state.overlay.remove();
      states.delete(chart);
    }
  },
};
