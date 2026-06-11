import {
    ChartManager,
    LineChart,
    ErrorBandChart,
    AreaChart,
    hoverPlugin,
    zoomPlugin,
    labelsPlugin,
    legendPlugin
} from './chartai.js';

window.ChartAIReadyPromise = null;

export async function initEngine() {
    if (window.ChartAIReadyPromise) {
        return window.ChartAIReadyPromise;
    }

    window.ChartAIReadyPromise = new Promise(async (resolve, reject) => {
        try {
            const X = ChartManager;
            X.use(LineChart);
            X.use(ErrorBandChart);
            X.use(AreaChart);
            X.use(hoverPlugin);
            X.use(zoomPlugin());
            X.use(labelsPlugin);
            X.use(legendPlugin);

            const isReady = await X.init();
            X.setSyncViews(true);
            if (isReady) {
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
const chartTypes = ['line', 'error-band', 'area'];
const zoomModes = ['x-only', 'y-only', 'both', 'none'];

function resolveType(typeStrOrInt) {
    if (typeof typeStrOrInt === 'number') return chartTypes[typeStrOrInt] || 'line';
    return typeStrOrInt || 'line';
}

function resolveZoomMode(zoomStrOrInt) {
    if (typeof zoomStrOrInt === 'number') return zoomModes[zoomStrOrInt] || 'x-only';
    return zoomStrOrInt || 'x-only';
}

export function createChart(container, id, config) {
    const X = ChartManager;
    
    const chart = X.create({
        type: resolveType(config.type),
        container: container,
        series: [],
        bgColor: config.isDark ? [0.18, 0.18, 0.18] : [0.98, 0.98, 0.98],
        showTooltip: config.showTooltip !== false,
        zoomMode: resolveZoomMode(config.zoomMode),
        bandOpacity: config.bandOpacity !== undefined ? config.bandOpacity : 0.25,
        defaultBounds: config.defaultBounds
    });

    X.setTheme(!!config.isDark);

    charts.set(id, chart);
}

export function updateSeries(id, seriesData) {
    const chart = charts.get(id);
    if (!chart) return;
    
    chart.setData(seriesData);
}

export function configure(id, configPatch) {
    const chart = charts.get(id);
    if (!chart) return;

    const targetType = resolveType(configPatch.type);
    
    if (targetType && chart._c && chart._c.config.type !== targetType) {
        const container = chart._c.el.parentElement;
        chart.destroy();
        charts.delete(id);
        
        createChart(container, id, configPatch);
        return;
    }

    if (configPatch.isDark !== undefined) {
        ChartManager.setTheme(!!configPatch.isDark);
        configPatch.bgColor = configPatch.isDark ? [0.18, 0.18, 0.18] : [0.98, 0.98, 0.98];
    }
    
    if (configPatch.zoomMode !== undefined) {
        configPatch.zoomMode = resolveZoomMode(configPatch.zoomMode);
    }

    chart.configure(configPatch);
}

export function destroyChart(id) {
    const chart = charts.get(id);
    if (!chart) return;

    chart.destroy();
    charts.delete(id);
}
