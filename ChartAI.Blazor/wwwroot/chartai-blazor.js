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
    rangeSelectorPlugin
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

// Turn the serialized Blazor config into the shape manager.create expects.
function buildConfig(container, config) {
    const cfg = { ...config };
    cfg.container = container;
    cfg.series = [];

    const fx = resolveFormat(config.formatX);
    const fy = resolveFormat(config.formatY);
    if (fx) cfg.formatX = fx; else delete cfg.formatX;
    if (fy) cfg.formatY = fy; else delete cfg.formatY;

    return cfg;
}

export function createChart(container, id, config, pluginNames) {
    const X = ChartManager;
    const chart = X.create(buildConfig(container, config));

    if (Array.isArray(pluginNames)) {
        for (const name of pluginNames) {
            const plugin = perChartPlugins[name];
            if (plugin) chart.addPlugin(plugin);
        }
    }

    charts.set(id, chart);
}

export function recreateChart(container, id, config, pluginNames) {
    const existing = charts.get(id);
    if (existing) {
        existing.destroy();
        charts.delete(id);
    }
    createChart(container, id, config, pluginNames);
}

export function updateSeries(id, seriesData) {
    const chart = charts.get(id);
    if (!chart) return;
    chart.setData(seriesData);
}

export function configure(id, configPatch) {
    const chart = charts.get(id);
    if (!chart || !chart._c) return;

    // A renderer-type change requires recreating the chart.
    if (configPatch.type && chart._c.config.type !== configPatch.type) {
        const container = chart._c.el.parentElement;
        chart.destroy();
        charts.delete(id);
        createChart(container, id, configPatch, []);
        return;
    }

    const patch = { ...configPatch };
    delete patch.container;
    delete patch.series;

    const fx = resolveFormat(configPatch.formatX);
    const fy = resolveFormat(configPatch.formatY);
    if (fx) patch.formatX = fx; else delete patch.formatX;
    if (fy) patch.formatY = fy; else delete patch.formatY;

    chart.configure(patch);
}

export function resetView(id) {
    const chart = charts.get(id);
    if (chart) chart.resetView();
}

export function setTheme(isDark) {
    ChartManager.setTheme(!!isDark);
}

export function setSyncViews(sync) {
    ChartManager.setSyncViews(!!sync);
}

export function destroyChart(id) {
    const chart = charts.get(id);
    if (!chart) return;
    chart.destroy();
    charts.delete(id);
}
