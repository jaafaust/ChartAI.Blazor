import {
    ChartManager,
    // renderers
    LineChart,
    AreaChart,
    ScatterChart,
    BarChart,
    CandlestickChart,
    StepChart,
    HistogramChart,
    HeatmapChart,
    BubbleChart,
    BaselineAreaChart,
    ErrorBandChart,
    OhlcChart,
    WaterfallChart,
    // global plugins
    labelsPlugin,
    zoomPlugin,
    hoverPlugin,
    legendPlugin,
    annotationsPlugin,
    watermarkPlugin,
    thresholdPlugin,
    // per-chart plugins
    crosshairPlugin,
    statsPlugin,
    rulerPlugin,
    tooltipPinPlugin,
    minimapPlugin,
    rangeSelectorPlugin,
    // the plot-area margins, for the visible range reported on view changes
    chartMargin
} from './chartai.js';

window.ChartAIReadyPromise = null;

// Set once setTheme was called: the theme was chosen explicitly, and initEngine must not replace
// it with the <html> class it reads when the engine comes up.
let themeExplicit = false;

export async function initEngine() {
    if (window.ChartAIReadyPromise) {
        return window.ChartAIReadyPromise;
    }

    window.ChartAIReadyPromise = new Promise(async (resolve, reject) => {
        try {
            const X = ChartManager;

            // Renderers
            X.use(LineChart);
            X.use(AreaChart);
            X.use(ScatterChart);
            X.use(BarChart);
            X.use(CandlestickChart);
            X.use(StepChart);
            X.use(HistogramChart);
            X.use(HeatmapChart);
            X.use(BubbleChart);
            X.use(BaselineAreaChart);
            X.use(ErrorBandChart);
            X.use(OhlcChart);
            X.use(WaterfallChart);

            // Global UI plugins (render only when their config is present)
            X.use(labelsPlugin);
            X.use(zoomPlugin());
            X.use(hoverPlugin);
            X.use(legendPlugin);
            X.use(annotationsPlugin);
            X.use(watermarkPlugin);
            X.use(thresholdPlugin);

            const isReady = await X.init();
            if (isReady) {
                if (!themeExplicit) X.setTheme(document.documentElement.classList.contains('dark'));
                console.log("ChartAI WebGPU Engine Ready!");
                resolve(true);
            } else {
                reject("Failed to initialize WebGPU.");
            }
        } catch (err) {
            console.error("ChartAI: Failed to initialize WebGPU.", err);
            reject(err);
        }
    });

    return window.ChartAIReadyPromise;
}

// Engine features that came with the view-change events (ChartManager.onViewChange): the view
// events themselves and SeriesPatch.start. Checked on use, so an older bundle falls back to the
// pointer/wheel triggers and to compacting the column store on every drop.
const hasViewEvents = () => typeof ChartManager.onViewChange === 'function';
const hasPatchStart = hasViewEvents;

// Per chart: the engine handle, the plugins it was created with, the data it shows (the column
// store the live path writes into, or the series list as it came), the window a follow tick
// moved to, the config last sent, and the .NET references that receive view changes and
// annotation clicks.
const charts = new Map();

// Per-chart plugins addressed by the names the Blazor layer sends.
const perChartPlugins = {
    'crosshair': crosshairPlugin,
    'stats': statsPlugin,
    'ruler': rulerPlugin,
    'tooltip-pin': tooltipPinPlugin,
    'minimap': minimapPlugin,
    'range-selector': rangeSelectorPlugin,
};

// ─── Built-in formatters (resolve enum tokens to functions) ──────────────────
const BASE_DATE = new Date("2026-02-03");
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtPrice(value) {
    if (value >= 1000) return "$" + (value / 1000).toFixed(1) + "k";
    if (value >= 100) return "$" + value.toFixed(0);
    if (value >= 10) return "$" + value.toFixed(1);
    return "$" + value.toFixed(2);
}
function fmtNumber(value) {
    if (Math.abs(value) >= 1000) return (value / 1000).toFixed(1) + "k";
    if (Math.abs(value) >= 100) return value.toFixed(0);
    if (Math.abs(value) >= 10) return value.toFixed(1);
    return value.toFixed(2);
}
function fmtDate(minutesAgo) {
    const ms = BASE_DATE.getTime() - Math.round(minutesAgo) * 60000;
    const d = new Date(ms);
    return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

const FORMATTERS = {
    'index': (v) => Math.round(v).toString(),
    'number': fmtNumber,
    'price': fmtPrice,
    'date': fmtDate,
    'fixed0': (v) => v.toFixed(0),
    'fixed1': (v) => v.toFixed(1),
    'fixed2': (v) => v.toFixed(2),
    'day': (v) => `Day ${Math.round(v)}`,
    'degree': (v) => `${v.toFixed(1)}°`,
};

function resolveFormat(token) {
    return FORMATTERS[token] ?? undefined;
}

// Resolve the per-axis format tokens of a yAxes config array to functions.
function resolveYAxes(yAxes) {
    if (!Array.isArray(yAxes)) return yAxes;
    return yAxes.map((ax) => {
        const a = { ...ax };
        const f = resolveFormat(a.format);
        if (f) a.format = f; else delete a.format;
        return a;
    });
}

// ─── Config ──────────────────────────────────────────────────────────────────
// The engine declares these renderer options as u32 uniforms and ignores anything that is not a
// number, so the names and [r, g, b] colours .NET sends are mapped to what the shaders read.

const STEP_MODES = { after: 0, before: 1, center: 2 };
const PACKED_COLORS = ['upColor', 'downColor', 'totalColor', 'positiveColor', 'negativeColor'];

// Same packing as packRGB in the engine (charts/candlestick.ts): 0xAABBGGRR, alpha opaque.
function packRGB(r, g, b) {
    return ((Math.round(r * 255) & 0xFF) |
        ((Math.round(g * 255) & 0xFF) << 8) |
        ((Math.round(b * 255) & 0xFF) << 16) |
        (0xFF << 24)) >>> 0;
}

// Inside a nested option null means unset, as .NET means it (a NaN arrives as null too): drop it.
function withoutNulls(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return o;
    const r = {};
    for (const [k, v] of Object.entries(o)) if (v != null) r[k] = v;
    return r;
}

// The serialized Blazor config in the shape of the engine's options: stepMode as its uniform
// index, the renderer colours packed, and a "none" format as null (no formatter). A line or
// threshold whose value was NaN (null here) is dropped rather than drawn at 0, and a bound or
// nested option that was NaN counts as unset. Returns a new object; format tokens stay strings
// (see resolveFormats).
export function normalizeConfig(config) {
    const cfg = { ...(config ?? {}) };
    if (typeof cfg.stepMode === 'string') cfg.stepMode = STEP_MODES[cfg.stepMode] ?? cfg.stepMode;
    for (const key of PACKED_COLORS) {
        const v = cfg[key];
        if (Array.isArray(v) && (v.length === 3 || v.length === 4))
            cfg[key] = packRGB(+v[0] || 0, +v[1] || 0, +v[2] || 0);
    }
    for (const key of ['formatX', 'formatY'])
        if (cfg[key] === 'none') cfg[key] = null;
    for (const key of ['defaultBounds', 'legend'])
        if (cfg[key] != null) cfg[key] = withoutNulls(cfg[key]);
    for (const key of ['yAxes', 'annotations', 'thresholds'])
        if (Array.isArray(cfg[key])) cfg[key] = cfg[key].map(withoutNulls);
    if (Array.isArray(cfg.annotations)) cfg.annotations = cfg.annotations.filter((a) => a && a.value != null);
    if (Array.isArray(cfg.thresholds)) cfg.thresholds = cfg.thresholds.filter((t) => t && t.y != null);
    return cfg;
}

// Format tokens to functions, in place. An unknown token falls back to the engine's default.
function resolveFormats(cfg) {
    for (const key of ['formatX', 'formatY'])
        if (cfg[key] != null) cfg[key] = resolveFormat(cfg[key]) ?? null;
    if (Array.isArray(cfg.yAxes)) cfg.yAxes = resolveYAxes(cfg.yAxes);
    return cfg;
}

// What the chart was configured with, for the next configure to diff against: the normalized
// config without the keys left at the engine default.
function sentConfig(cfg) {
    const sent = {};
    for (const [k, v] of Object.entries(cfg))
        if (v != null && k !== 'container' && k !== 'series') sent[k] = v;
    return sent;
}

function sameValue(a, b) {
    if (a === b) return true;
    if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') return false;
    return JSON.stringify(a) === JSON.stringify(b);
}

// .NET sends null for a bound it leaves open; the engine reads undefined as "from the data".
function partialBounds(b) {
    const r = {};
    for (const k of ['minX', 'maxX', 'minY', 'maxY']) if (b && b[k] != null) r[k] = b[k];
    return r;
}

// A window for patchData/setBounds: a side left open keeps the chart's current value.
function fullBounds(entry, b) {
    const cur = entry.chart._c?.bounds ?? { minX: 0, maxX: 1, minY: 0, maxY: 1 };
    return {
        minX: b?.minX ?? cur.minX,
        maxX: b?.maxX ?? cur.maxX,
        minY: b?.minY ?? cur.minY,
        maxY: b?.maxY ?? cur.maxY,
    };
}

// ─── Binary channels ─────────────────────────────────────────────────────────
// .NET sends the numbers of a SetData or a patch as one byte[] of little-endian float64 (Blazor
// transfers a byte[] as binary, a Uint8Array here), NaN for a gap; the series name their channels
// as [offset, length] ranges into it, and a shared x travels once. Plain arrays of numbers, null
// for a gap, are accepted too.

const LITTLE_ENDIAN = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;

function isNumeric(v) {
    return Array.isArray(v) || (ArrayBuffer.isView(v) && !(v instanceof DataView));
}

// One channel as a Float64Array: an array of numbers and nulls (null becomes NaN, the gap), a
// Uint8Array of little-endian float64 at any byteOffset (copied, so the result is aligned and
// owns its memory), or a Float64Array (returned as is).
export function toFloat64(channel) {
    if (channel instanceof Float64Array) return channel;
    if (channel instanceof Uint8Array) {
        const n = channel.byteLength >> 3;
        const out = new Float64Array(n);
        if (LITTLE_ENDIAN) {
            new Uint8Array(out.buffer).set(channel.subarray(0, n * 8));
        } else {
            const dv = new DataView(channel.buffer, channel.byteOffset, n * 8);
            for (let i = 0; i < n; i++) out[i] = dv.getFloat64(i * 8, true);
        }
        return out;
    }
    const n = channel?.length ?? 0;
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        const v = channel[i];
        out[i] = v == null ? NaN : v;
    }
    return out;
}

// A byte[] serialized without Blazor's binary transfer arrives as base64.
function bytesOf(data) {
    if (typeof data !== 'string') return data;
    const bin = atob(data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

function blobReader(payload) {
    const data = toFloat64(bytesOf(payload.data));
    return (ref) => (Array.isArray(ref) ? data.subarray(ref[0], ref[0] + ref[1]) : null);
}

// The series of a SetData as the engine takes them: { label, color, x, y, <channel>, hidden, yAxis }.
// Series sharing x get the same Float64Array, so the column store and the engine see it as shared.
function decodeSeries(seriesData) {
    if (Array.isArray(seriesData)) return seriesData;
    if (!seriesData || !Array.isArray(seriesData.series)) return [];
    const at = blobReader(seriesData);
    const sharedX = at(seriesData.x);
    return seriesData.series.map((s) => {
        const out = { ...(s.props ?? {}), label: s.label ?? '', color: s.color ?? '#3b82f6' };
        out.x = sharedX ?? at(s.x) ?? new Float64Array(0);
        for (const [key, ref] of Object.entries(s.ch ?? {})) out[key] = at(ref);
        if (!out.y) out.y = new Float64Array(0);
        if (s.hidden) out.hidden = true;
        if (s.yAxis != null) out.yAxis = s.yAxis;
        return out;
    });
}

// A patch's new columns: { x, series: [{ <channel>: values }] }.
function decodePatch(patch) {
    if (patch?.data == null) {
        return {
            x: isNumeric(patch?.x) ? patch.x : [],
            series: Array.isArray(patch?.series) ? patch.series : [],
        };
    }
    const at = blobReader(patch);
    return {
        x: at(patch.x) ?? new Float64Array(0),
        series: (patch.series ?? []).map((s) => {
            const o = {};
            for (const [key, ref] of Object.entries(s?.ch ?? {})) o[key] = at(ref);
            return o;
        }),
    };
}

// ─── Column store ────────────────────────────────────────────────────────────
// The arrays the engine reads live here with a fixed capacity per series: one x array and one
// array per channel of every series. A patch from .NET carries only its new columns; they are
// spliced in and written into the existing GPU buffers in place, so a live tick costs the size
// of its delta instead of a rebuild. Dropping the oldest columns only moves `start`, the first
// column the engine draws; the store is compacted when the buffers are full. Needs every series
// to share the x axis, which is what a live trend has; charts with per-series x are sent to the
// engine as they came.

function sameX(series) {
    const x0 = series[0].x;
    if (!x0) return false;
    for (let i = 1; i < series.length; i++) {
        const x = series[i].x;
        if (x === x0) continue;
        if (!x || x.length !== x0.length) return false;
        for (let j = 0; j < x.length; j++) if (x[j] !== x0[j]) return false;
    }
    return true;
}

// Copies the first n values of src. JSON null (a NaN on the .NET side) becomes NaN, which the
// engine draws as a gap; a typed array would silently turn it into 0.
function fill(dst, dstOffset, src, n = src.length) {
    if (src instanceof Float64Array) {
        dst.set(n < src.length ? src.subarray(0, n) : src, dstOffset);
        return;
    }
    for (let i = 0; i < n; i++) {
        const v = src[i];
        dst[dstOffset + i] = v == null ? NaN : v;
    }
}

function createStore(series, capacity) {
    const len = series[0].x.length;
    const cap = Math.max(capacity | 0, len, 1);
    // Every numeric array besides x is a channel; y first, then the union of the extras.
    const keySet = new Set();
    for (const s of series)
        for (const k of Object.keys(s))
            if (k !== 'x' && isNumeric(s[k])) keySet.add(k);
    const keys = ['y', ...[...keySet].filter((k) => k !== 'y')];
    const st = { cap, start: 0, len, keys, x: new Float64Array(cap), series: [], views: null };
    fill(st.x, 0, series[0].x);
    for (const s of series) {
        const chans = {};
        for (const k of keys) {
            const arr = new Float64Array(cap);
            const src = s[k];
            if (isNumeric(src)) {
                fill(arr, 0, src, Math.min(src.length, len));
                if (src.length < len) arr.fill(NaN, src.length, len);
            } else {
                arr.fill(NaN, 0, len);
            }
            chans[k] = arr;
        }
        st.series.push({ label: s.label, color: s.color, yAxis: s.yAxis, hidden: !!s.hidden, chans });
    }
    return st;
}

// What the engine gets: one shared x view and per-series views into the channels, columns
// [0, len) of which [start, len) are live. Views alias the store, so in-place patches are
// visible to the hover layer without rebuilding them.
function storeViews(st) {
    if (st.views && st.views.len === st.len) return st.views.list;
    const x = st.x.subarray(0, st.len);
    const list = st.series.map((s) => {
        const v = { label: s.label, color: s.color, x };
        if (s.yAxis != null) v.yAxis = s.yAxis;
        if (s.hidden) v.hidden = true;
        for (const k of st.keys) v[k] = s.chans[k].subarray(0, st.len);
        return v;
    });
    st.views = { len: st.len, list };
    return list;
}

// First live column whose x is at least t.
function lowerBound(st, t) {
    let lo = st.start, hi = st.len;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (st.x[mid] < t) lo = mid + 1; else hi = mid;
    }
    return lo;
}

// Moves the live columns [start, len) down to 0.
function compact(st) {
    const { start, len } = st;
    if (start === 0) return;
    st.x.copyWithin(0, start, len);
    for (const s of st.series)
        for (const k of st.keys) s.chans[k].copyWithin(0, start, len);
    st.len = len - start;
    st.start = 0;
    st.views = null;
}

function grow(st, cap) {
    compact(st);
    const nx = new Float64Array(cap);
    nx.set(st.x.subarray(0, st.len));
    st.x = nx;
    for (const s of st.series) {
        for (const k of st.keys) {
            const a = new Float64Array(cap);
            a.set(s.chans[k].subarray(0, st.len));
            s.chans[k] = a;
        }
    }
    st.cap = cap;
    st.views = null;
}

// Writes the patch's columns at physical column `at`; a channel the patch omits becomes a gap.
// The lengths were checked before (see patchSeries).
function splice(st, at, x, series) {
    const k = x.length;
    fill(st.x, at, x);
    for (let i = 0; i < st.series.length; i++) {
        const p = series[i] ?? {}, chans = st.series[i].chans;
        for (const key of st.keys) {
            const src = p[key];
            if (isNumeric(src)) fill(chans[key], at, src);
            else chans[key].fill(NaN, at, at + k);
        }
    }
    st.len = at + k;
    st.views = null;
}

// A full upload of the store: the buffers are recreated for its capacity.
function uploadStore(entry) {
    const st = entry.store;
    compact(st);
    entry.chart.setData(storeViews(st), { capacity: st.cap, bounds: entry.window ?? undefined });
}

// Puts the view back to its home transform, so a moved window is what is shown. Not reported
// as a view change: the app moved the window itself.
function homeView(entry) {
    const c = entry.chart._c;
    if (!c) return;
    c.view = { ...c.homeView };
    entry.lastView = { ...c.view };
    ChartManager.requestRender(c.id);
    ChartManager.drawChart?.(c);
}

// ─── Chart lifecycle ─────────────────────────────────────────────────────────

export function createChart(container, id, config, pluginNames) {
    if (charts.has(id)) destroyChart(id);
    const X = ChartManager;
    const cfg = normalizeConfig(config);
    // Keys left at their default are omitted, so the engine's defaults apply.
    const opts = sentConfig(resolveFormats({ ...cfg }));
    opts.container = container;
    opts.series = [];
    const chart = X.create(opts);

    const plugins = Array.isArray(pluginNames) ? pluginNames : [];
    for (const name of plugins) {
        const plugin = perChartPlugins[name];
        if (plugin) chart.addPlugin(plugin);
    }

    charts.set(id, {
        chart, plugins, store: null, list: null, listCapacity: 0, window: null, lastConfig: sentConfig(cfg),
        viewRef: null, viewTimer: null, viewAbort: null, viewUnsub: null, lastView: null, annRef: null, annAbort: null
    });
}

// A new chart in place of the old one, for a plugin or renderer change: the data, the window a
// follow tick moved to and the .NET listeners carry over.
function rebuild(id, container, config, pluginNames) {
    const old = charts.get(id);
    destroyChart(id);
    createChart(container, id, config, pluginNames);
    if (!old) return;
    const fresh = charts.get(id);
    fresh.window = old.window;
    if (old.store) {
        fresh.store = old.store;
        uploadStore(fresh);
    } else if (old.list) {
        fresh.list = old.list;
        fresh.listCapacity = old.listCapacity;
        fresh.chart.setData(old.list, { capacity: old.listCapacity, bounds: old.window ?? undefined });
    }
    if (old.viewRef) watchView(id, old.viewRef);
    if (old.annRef) watchAnnotations(id, old.annRef);
}

export function recreateChart(container, id, config, pluginNames) {
    rebuild(id, container, config, pluginNames);
}

export function updateSeries(id, seriesData, opts) {
    const entry = charts.get(id);
    if (!entry) return;
    const list = decodeSeries(seriesData);
    const capacity = opts?.capacity ?? entry.chart._c?.config?.capacity ?? 0;
    // A window given here replaces the one follow ticks moved to; without one the chart fits
    // the data (or the configured DefaultBounds) again.
    const bounds = opts?.bounds ? partialBounds(opts.bounds) : null;
    entry.window = bounds && Object.keys(bounds).length > 0 ? bounds : null;
    // Series sharing the x axis go through the column store, so they upload x once and can be
    // patched later; anything else (per-series x, a histogram's samples) is sent as it came.
    entry.store = list.length > 0 && sameX(list) ? createStore(list, capacity) : null;
    entry.list = entry.store ? null : list;
    entry.listCapacity = capacity;
    if (entry.store) uploadStore(entry);
    else entry.chart.setData(list, { capacity, bounds: entry.window ?? undefined });
}

// Writes columns in place. `offset` (default: append) is the first column written, `drop` and
// `dropBefore` discard the oldest columns first, `x` and the series' channels carry the new
// columns, `bounds` moves the window and `resetView` puts the view home. Returns the column
// count afterwards. A patch that does not fit the buffers compacts the store, and grows the
// buffers (a full upload once) when that does not free enough room.
export function patchSeries(id, patch) {
    const entry = charts.get(id);
    if (!entry || !entry.chart._c) return 0;
    const st = entry.store;
    if (!st)
        throw new Error('patchData: the chart has no shared x axis; send series sharing one x array with SetData first');
    const { x, series } = decodePatch(patch);
    if (series.length !== st.series.length)
        throw new Error(`patchData: ${series.length} series for a chart of ${st.series.length}`);
    const k = x.length;
    const count = st.len - st.start;
    const offset = patch.offset ?? count;
    if (!(offset >= 0 && offset <= count))
        throw new Error(`patchData: offset ${offset} outside 0..${count}`);
    // Everything is checked before the store changes, so a rejected patch leaves it as it was.
    for (let i = 0; i < series.length; i++) {
        for (const key of st.keys) {
            const src = series[i]?.[key];
            if (isNumeric(src) && src.length !== k)
                throw new Error(`patchData: series ${i} channel "${key}" has ${src.length} values for ${k} columns`);
        }
    }

    let drop = Math.max(0, patch.drop | 0);
    if (patch.dropBefore != null) drop = Math.max(drop, lowerBound(st, patch.dropBefore) - st.start);
    // Never drop a column the patch then rewrites.
    drop = Math.min(drop, offset);

    const bounds = patch.bounds ? fullBounds(entry, patch.bounds) : undefined;
    if (bounds) entry.window = bounds;
    if (patch.resetView) homeView(entry);

    const before = st.len;
    let at = st.start + offset;     // physical column the patch writes first
    let firstChanged = at;
    st.start += drop;
    if (at + k > st.cap) {
        // Full: drop the skipped columns for real, and grow the buffers unless that frees at
        // least a quarter of them, so the next compaction is as far away.
        at -= st.start;
        compact(st);
        firstChanged = 0;
        if (at + k > st.cap - (st.cap >> 2)) {
            grow(st, Math.max(st.cap * 2, at + k));
            splice(st, at, x, series);
            uploadStore(entry);
            return st.len - st.start;
        }
    } else if (drop > 0 && !hasPatchStart()) {
        at -= st.start;
        compact(st);
        firstChanged = 0;
    }

    splice(st, at, x, series);
    if (k > 0 || drop > 0 || st.len !== before) {
        // Columns [firstChanged, len) are written; a truncating patch (no new columns, offset
        // below the count) still reaches the engine, which then draws fewer columns.
        entry.chart.patchData({
            offset: Math.min(firstChanged, st.len),
            count: st.len,
            start: st.start,
            x: st.x.subarray(0, st.len),
            series: storeViews(st),
            bounds
        });
    } else if (bounds) {
        entry.chart.setBounds(bounds);
    }
    return st.len - st.start;
}

// Moves the window without touching the data: a follow tick with nothing new.
export function setBounds(id, bounds, resetView) {
    const entry = charts.get(id);
    if (!entry || !entry.chart._c) return;
    if (resetView) homeView(entry);
    entry.window = fullBounds(entry, bounds);
    entry.chart.setBounds(entry.window);
}

// Applies a full config from .NET. A key sent before that is now absent or null is sent as null,
// which resets it to the engine default; a key whose value did not change is not sent again.
export function configure(id, configPatch) {
    const entry = charts.get(id);
    const chart = entry?.chart;
    if (!chart || !chart._c) return;

    // A renderer-type change requires recreating the chart; its data and plugins carry over.
    if (configPatch?.type && chart._c.config.type !== configPatch.type) {
        rebuild(id, chart._c.el.parentElement, configPatch, entry.plugins);
        return;
    }

    const cfg = normalizeConfig(configPatch);
    const last = entry.lastConfig ?? {};
    const patch = {};
    for (const [k, v] of Object.entries(cfg)) {
        if (k === 'container' || k === 'series') continue;
        if (v == null) {
            if (last[k] != null) patch[k] = null;
        } else if (!sameValue(v, last[k])) {
            patch[k] = v;
        }
    }
    for (const k of Object.keys(last))
        if (!(k in cfg) && k !== 'type') patch[k] = null;
    entry.lastConfig = sentConfig(cfg);

    if (Object.keys(patch).length > 0) chart.configure(resolveFormats(patch));
}

export function resetView(id) {
    const entry = charts.get(id);
    if (!entry) return;
    entry.chart.resetView();
    // An engine without view events: follow the reset animation as after a gesture.
    if (entry.viewRef && !hasViewEvents()) scheduleReport(entry);
}

// The theme is global: every chart on the page switches.
export function setTheme(isDark) {
    themeExplicit = true;
    ChartManager.setTheme(!!isDark);
}

// sync: true (both axes), false, or the axes to share - 'x', 'y' or 'both'.
export function setSyncViews(sync) {
    ChartManager.setSyncViews(typeof sync === 'string' ? sync : !!sync);
}

// The engine could not start (no WebGPU, no adapter): say so in the host element instead of
// leaving an empty box. Idempotent.
export function showUnavailable(container, text) {
    if (!container) return;
    let el = container.querySelector(':scope > .chartai-unavailable');
    if (!el) {
        el = document.createElement('div');
        el.className = 'chartai-unavailable';
        el.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;'
            + 'padding:16px 24px;text-align:center;font-size:0.9em;line-height:1.4;opacity:0.8;pointer-events:none;';
        container.appendChild(el);
    }
    el.textContent = text
        || 'No WebGPU adapter available. The chart needs GPU access: allow it for this site or open the page in a browser with WebGPU.';
}

// ─── View changes ────────────────────────────────────────────────────────────
// Every view change the engine announces (a gesture, a linked chart following, the minimap,
// the range selector, a reset) starts a poll that waits until the view holds still (inertia and
// the reset animate), then the plot-area range is reported to .NET once per change. An engine
// without view events is watched through pointer and wheel events on the chart instead.

function unwatchView(entry) {
    stopReport(entry);
    entry.viewAbort?.abort();
    entry.viewAbort = null;
    entry.viewUnsub?.();
    entry.viewUnsub = null;
}

export function watchView(id, dotNetRef) {
    const entry = charts.get(id);
    const c = entry?.chart._c;
    if (!c) return;
    unwatchView(entry);
    entry.viewRef = dotNetRef;
    entry.lastView = { ...c.view };
    if (hasViewEvents()) {
        const engineId = entry.chart.id;
        entry.viewUnsub = ChartManager.onViewChange((chartId) => {
            if (chartId === engineId) scheduleReport(entry);
        });
        return;
    }
    const ac = new AbortController();
    entry.viewAbort = ac;
    const kick = () => scheduleReport(entry);
    for (const ev of ['pointerup', 'pointercancel', 'wheel'])
        c.el.addEventListener(ev, kick, { signal: ac.signal, passive: true });
}

function scheduleReport(entry) {
    if (entry.viewTimer) return;
    let last = null, stable = 0;
    entry.viewTimer = setInterval(() => {
        const c = entry.chart._c;
        if (!c || !entry.viewRef) { stopReport(entry); return; }
        if (c.dragging) { last = null; return; }
        const v = c.view;
        if (last && last.panX === v.panX && last.panY === v.panY && last.zoomX === v.zoomX && last.zoomY === v.zoomY) {
            if (++stable >= 2) {
                stopReport(entry);
                report(entry);
            }
        } else {
            last = { ...v };
            stable = 0;
        }
    }, 50);
}

function stopReport(entry) {
    if (entry.viewTimer) {
        clearInterval(entry.viewTimer);
        entry.viewTimer = null;
    }
}

// The data range of the plot area (the canvas minus the axis margins).
function visibleRange(c) {
    const { bounds: b, view: v, width: w, height: h } = c;
    const m = chartMargin(c);
    const fullX = b.maxX - b.minX, fullY = b.maxY - b.minY;
    const rx = fullX / v.zoomX, ry = fullY / v.zoomY;
    const x0 = b.minX + v.panX * fullX, y0 = b.minY + v.panY * fullY;
    return {
        minX: x0 + rx * m.left / w,
        maxX: x0 + rx * (w - m.right) / w,
        minY: y0 + ry * m.bottom / h,
        maxY: y0 + ry * (h - m.top) / h,
    };
}

function report(entry) {
    const c = entry.chart._c;
    if (!c || !entry.viewRef) return;
    const v = c.view, l = entry.lastView;
    if (l && l.panX === v.panX && l.panY === v.panY && l.zoomX === v.zoomX && l.zoomY === v.zoomY) return;
    entry.lastView = { ...v };
    const r = visibleRange(c);
    // NaN would reach .NET as null, which a double cannot take.
    if (![r.minX, r.maxX, r.minY, r.maxY].every(Number.isFinite)) return;
    // The .NET object may already be disposed when this lands.
    entry.viewRef.invokeMethodAsync('OnViewChanged', r.minX, r.maxX, r.minY, r.maxY).catch(() => { });
}

// ─── Annotation labels ───────────────────────────────────────────────────────
// The annotations plugin dispatches "chartai-annotation-click" from the host when a label
// pill is clicked; the annotation's id goes to .NET.

export function watchAnnotations(id, dotNetRef) {
    const entry = charts.get(id);
    const c = entry?.chart._c;
    if (!c) return;
    entry.annAbort?.abort();
    entry.annRef = dotNetRef;
    const ac = new AbortController();
    entry.annAbort = ac;
    c.el.addEventListener('chartai-annotation-click', (e) => {
        // The .NET object may already be disposed when this lands.
        entry.annRef.invokeMethodAsync('OnAnnotationClicked', e.detail?.id ?? null).catch(() => { });
    }, { signal: ac.signal });
}

export function destroyChart(id) {
    const entry = charts.get(id);
    if (!entry) return;
    unwatchView(entry);
    entry.annAbort?.abort();
    entry.chart.destroy();
    charts.delete(id);
}
