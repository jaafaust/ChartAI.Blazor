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
                X.setTheme(document.documentElement.classList.contains('dark'));
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

// Per chart: the engine handle, the plugins it was created with, the column store the live
// path writes into, and the .NET reference that receives view changes.
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
    'none': undefined,
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

// Turn the serialized Blazor config into the shape manager.create expects.
function buildConfig(container, config) {
    const cfg = { ...config };
    cfg.container = container;
    cfg.series = [];

    const fx = resolveFormat(config.formatX);
    const fy = resolveFormat(config.formatY);
    if (fx) cfg.formatX = fx; else delete cfg.formatX;
    if (fy) cfg.formatY = fy; else delete cfg.formatY;
    if (config.yAxes) cfg.yAxes = resolveYAxes(config.yAxes);

    return cfg;
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

// ─── Column store ────────────────────────────────────────────────────────────
// The arrays the engine reads live here with a fixed capacity per series: one x array and one
// array per channel of every series. A patch from .NET carries only its new columns; they are
// spliced in and written into the existing GPU buffers in place, so a live tick costs the size
// of its delta instead of a rebuild. Needs every series to share the x axis, which is what a
// live trend has; charts with per-series x are sent to the engine as they came.

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

// JSON null (a NaN on the .NET side) becomes NaN, which the engine draws as a gap; a typed
// array would silently turn it into 0.
function fill(dst, dstOffset, src) {
    for (let i = 0; i < src.length; i++) {
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
            if (k !== 'x' && Array.isArray(s[k])) keySet.add(k);
    const keys = ['y', ...[...keySet].filter((k) => k !== 'y')];
    const st = { cap, len, keys, x: new Float64Array(cap), series: [], views: null };
    fill(st.x, 0, series[0].x);
    for (const s of series) {
        const chans = {};
        for (const k of keys) {
            const arr = new Float64Array(cap);
            if (Array.isArray(s[k])) fill(arr, 0, s[k]); else arr.fill(NaN, 0, len);
            chans[k] = arr;
        }
        st.series.push({ label: s.label, color: s.color, yAxis: s.yAxis, hidden: !!s.hidden, chans });
    }
    return st;
}

// What the engine gets: one shared x view and per-series views into the channels. Views alias
// the store, so in-place patches are visible to the hover layer without rebuilding them.
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

function lowerBound(st, t) {
    let lo = 0, hi = st.len;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (st.x[mid] < t) lo = mid + 1; else hi = mid;
    }
    return lo;
}

// Drops the oldest `drop` columns.
function compact(st, drop) {
    const { len } = st;
    st.x.copyWithin(0, drop, len);
    for (const s of st.series)
        for (const k of st.keys) s.chans[k].copyWithin(0, drop, len);
    st.len = len - drop;
    st.views = null;
}

function grow(st, cap) {
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

// Writes the patch's columns at `offset`; a channel the patch omits becomes a gap.
function splice(st, offset, x, series) {
    const k = x.length;
    fill(st.x, offset, x);
    for (let i = 0; i < st.series.length; i++) {
        const p = series[i] ?? {}, chans = st.series[i].chans;
        for (const key of st.keys) {
            const src = p[key];
            if (Array.isArray(src)) {
                if (src.length !== k)
                    throw new Error(`patchData: series ${i} channel "${key}" has ${src.length} values for ${k} columns`);
                fill(chans[key], offset, src);
            } else {
                chans[key].fill(NaN, offset, offset + k);
            }
        }
    }
    st.len = offset + k;
    st.views = null;
}

// Puts the view back to its home transform, so a moved window is what is shown.
function homeView(entry) {
    const c = entry.chart._c;
    if (!c) return;
    c.view = { ...c.homeView };
    entry.lastView = { ...c.view };
}

// ─── Chart lifecycle ─────────────────────────────────────────────────────────

export function createChart(container, id, config, pluginNames) {
    const X = ChartManager;
    const chart = X.create(buildConfig(container, config));

    const plugins = Array.isArray(pluginNames) ? pluginNames : [];
    for (const name of plugins) {
        const plugin = perChartPlugins[name];
        if (plugin) chart.addPlugin(plugin);
    }

    charts.set(id, { chart, plugins, store: null, viewRef: null, viewTimer: null, viewAbort: null, lastView: null, annRef: null, annAbort: null });
}

export function recreateChart(container, id, config, pluginNames) {
    const old = charts.get(id);
    destroyChart(id);
    createChart(container, id, config, pluginNames);
    if (old?.viewRef) watchView(id, old.viewRef);
    if (old?.annRef) watchAnnotations(id, old.annRef);
}

export function updateSeries(id, seriesData, opts) {
    const entry = charts.get(id);
    if (!entry) return;
    const list = Array.isArray(seriesData) ? seriesData : [];
    const capacity = opts?.capacity ?? entry.chart._c?.config?.capacity ?? 0;
    const bounds = opts?.bounds ? partialBounds(opts.bounds) : undefined;
    // Series sharing the x axis go through the column store, so they upload x once and can be
    // patched later; anything else (per-series x, a histogram's samples) is sent as it came.
    entry.store = list.length > 0 && sameX(list) ? createStore(list, capacity) : null;
    if (entry.store)
        entry.chart.setData(storeViews(entry.store), { capacity: entry.store.cap, bounds });
    else
        entry.chart.setData(list, { capacity, bounds });
}

// Writes columns in place. `offset` (default: append) is the first column written, `drop` and
// `dropBefore` discard the oldest columns first, `x` and `series[i][channel]` carry the new
// columns, `bounds` moves the window and `resetView` puts the view home. Returns the column
// count afterwards. A patch that does not fit the buffers grows them (a full upload once).
export function patchSeries(id, patch) {
    const entry = charts.get(id);
    if (!entry || !entry.chart._c) return 0;
    const st = entry.store;
    if (!st)
        throw new Error('patchData: the chart has no shared x axis; send series sharing one x array with SetData first');
    const x = Array.isArray(patch.x) ? patch.x : [];
    const series = Array.isArray(patch.series) ? patch.series : [];
    if (series.length !== st.series.length)
        throw new Error(`patchData: ${series.length} series for a chart of ${st.series.length}`);

    let offset = patch.offset ?? st.len;
    if (offset < 0 || offset > st.len)
        throw new Error(`patchData: offset ${offset} outside 0..${st.len}`);
    let drop = Math.max(0, patch.drop | 0);
    if (patch.dropBefore != null) drop = Math.max(drop, lowerBound(st, patch.dropBefore));
    // Never drop a column the patch then rewrites.
    drop = Math.min(drop, offset);

    let firstChanged = offset;
    if (drop > 0) {
        compact(st, drop);
        offset -= drop;
        firstChanged = 0;
    }
    const bounds = patch.bounds ? fullBounds(entry, patch.bounds) : undefined;
    if (patch.resetView) homeView(entry);

    if (offset + x.length > st.cap) {
        grow(st, Math.max(st.cap * 2, offset + x.length));
        splice(st, offset, x, series);
        entry.chart.setData(storeViews(st), { capacity: st.cap, bounds });
        return st.len;
    }

    splice(st, offset, x, series);
    if (firstChanged < st.len || drop > 0) {
        entry.chart.patchData({
            offset: firstChanged,
            count: st.len,
            x: st.x.subarray(0, st.len),
            series: storeViews(st),
            bounds
        });
    } else if (bounds) {
        entry.chart.setBounds(bounds);
    }
    return st.len;
}

// Moves the window without touching the data: a follow tick with nothing new.
export function setBounds(id, bounds, resetView) {
    const entry = charts.get(id);
    if (!entry || !entry.chart._c) return;
    if (resetView) homeView(entry);
    entry.chart.setBounds(fullBounds(entry, bounds));
}

export function configure(id, configPatch) {
    const entry = charts.get(id);
    const chart = entry?.chart;
    if (!chart || !chart._c) return;

    // A renderer-type change requires recreating the chart; its data and plugins carry over.
    if (configPatch.type && chart._c.config.type !== configPatch.type) {
        const container = chart._c.el.parentElement;
        const { plugins, store, viewRef } = entry;
        destroyChart(id);
        createChart(container, id, configPatch, plugins);
        const fresh = charts.get(id);
        fresh.store = store;
        if (store) fresh.chart.setData(storeViews(store), { capacity: store.cap });
        if (viewRef) watchView(id, viewRef);
        return;
    }

    const patch = { ...configPatch };
    delete patch.container;
    delete patch.series;

    const fx = resolveFormat(configPatch.formatX);
    const fy = resolveFormat(configPatch.formatY);
    if (fx) patch.formatX = fx; else delete patch.formatX;
    if (fy) patch.formatY = fy; else delete patch.formatY;
    if (configPatch.yAxes) patch.yAxes = resolveYAxes(configPatch.yAxes);

    chart.configure(patch);
}

export function resetView(id) {
    const entry = charts.get(id);
    if (entry) entry.chart.resetView();
}

export function setTheme(isDark) {
    ChartManager.setTheme(!!isDark);
}

export function setSyncViews(sync) {
    ChartManager.setSyncViews(!!sync);
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
// After a pointer or wheel gesture the view is polled until it holds still (inertia and the
// double-tap reset animate), then the plot-area range is reported to .NET once per change.

export function watchView(id, dotNetRef) {
    const entry = charts.get(id);
    const c = entry?.chart._c;
    if (!c) return;
    entry.viewAbort?.abort();
    entry.viewRef = dotNetRef;
    entry.lastView = { ...c.view };
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
    stopReport(entry);
    entry.viewAbort?.abort();
    entry.annAbort?.abort();
    entry.chart.destroy();
    charts.delete(id);
}
