import type { ChartPlugin, ChartConfig, InternalChart } from "../types.ts";
import { ChartManager } from "../chart-library.ts";
import { chartMargin, hasRightAxes, yAxisStrips } from "./shared.ts";

export const DEFAULT_FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
export const DEFAULT_LABEL_SIZE = 12;

export interface LabelsConfig {
  textColor?: string;
  gridColor?: string;
  fontFamily?: string;
  labelSize?: number;
  formatX?: (value: number) => string;
  formatY?: (value: number) => string;
  // false paints the axis margins as plain strips with a hard edge instead of a fade.
  bgFade?: boolean;
}

declare module "../types.ts" {
  interface ChartPluginRegistry {
    labels: LabelsConfig;
  }
}

function computeHomeView(chart: InternalChart<ChartConfig & LabelsConfig>) {
  const { width, height } = chart;
  const m = chartMargin(chart);
  // Preserve the classic insets (l 32 / r 8 for MARGIN 55/10) while growing
  // with the strips claimed by additional y-axes. Without the margin fade the
  // strips have a hard edge, so the data starts right at it instead of under it.
  const l = chart.config.bgFade === false ? m.left : Math.max(8, m.left - 23),
    t = 8,
    r = Math.max(8, m.right - 2),
    b = 48;
  const innerW = width - l - r;
  const innerH = height - t - b;
  return {
    panX: innerW > 0 ? -l / innerW : 0,
    panY: innerH > 0 ? -b / innerH : 0,
    zoomX: innerW > 0 ? innerW / width : 1,
    zoomY: innerH > 0 ? innerH / height : 1,
  };
}

const niceTicks = (min: number, max: number, count: number) => {
  const range = max - min;
  if (range <= 0) return [min];
  const rough = range / count,
    mag = 10 ** Math.floor(Math.log10(rough)),
    res = rough / mag;
  const step = mag * (res <= 1.5 ? 1 : res <= 3 ? 2 : res <= 7 ? 5 : 10);
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) ticks.push(v);
  return ticks;
};

const getViewState = (chart: InternalChart<ChartConfig & LabelsConfig>) => {
  const w = chart.width,
    h = chart.height,
    m = chartMargin(chart);
  const { bounds: b, view: v } = chart,
    fullX = b.maxX - b.minX,
    fullY = b.maxY - b.minY;
  const rx = fullX / v.zoomX,
    ry = fullY / v.zoomY;
  const mx = b.minX + v.panX * fullX,
    my = b.minY + v.panY * fullY;
  const bgc =
    chart.config.bgColor ??
    (ChartManager.isDark ? [0.11, 0.11, 0.12] : [0.98, 0.98, 0.98]);
  return {
    w,
    h,
    m,
    rx,
    ry,
    mx,
    my,
    bg: `${Math.round(bgc[0] * 255)},${Math.round(bgc[1] * 255)},${Math.round(bgc[2] * 255)}`,
    font: chart.config.fontFamily ?? DEFAULT_FONT,
    text:
      chart.config.textColor ?? (ChartManager.isDark ? "#c0c0c0" : "#333333"),
    grid:
      chart.config.gridColor ??
      (ChartManager.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"),
  };
};

export const labelsPlugin: ChartPlugin<LabelsConfig> = {
  name: "labels",

  install(chart) {
    const hv = computeHomeView(chart);
    chart.homeView = hv;
    chart.view = { ...hv };
    ChartManager.requestRender(chart.id);
  },

  beforeDraw(ctx, chart) {
    const hv = computeHomeView(chart);
    const old = chart.homeView;
    chart.homeView = hv;
    if (
      hv.zoomX !== old.zoomX ||
      hv.zoomY !== old.zoomY ||
      hv.panX !== old.panX ||
      hv.panY !== old.panY
    ) {
      chart.view = { ...hv };
      ChartManager.requestRender(chart.id);
    }
    const { w, h, m, rx, ry, mx, my, grid } = getViewState(chart);
    const plotRight = w - (hasRightAxes(chart) ? m.right : 0);
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    ctx.beginPath();

    niceTicks(my, my + ry, 7).forEach((v) => {
      const y = h * (1 - (v - my) / ry);
      if (y > 5 && y < h - m.bottom - 5) {
        ctx.moveTo(m.left, y);
        ctx.lineTo(plotRight, y);
      }
    });

    niceTicks(mx, mx + rx, 8).forEach((v) => {
      const x = w * ((v - mx) / rx);
      if (x > m.left && x < plotRight) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h - m.bottom);
      }
    });
    ctx.stroke();
  },

  afterDraw(ctx, chart) {
    const { w, h, m, rx, ry, mx, my, bg, font, text } = getViewState(chart);
    const {
      formatX = String,
      formatY = String,
      labelSize = DEFAULT_LABEL_SIZE,
    } = chart.config;

    const drawFade = (
      dir: "left" | "right" | "bottom",
      x: number,
      y: number,
      fw: number,
      fh: number,
    ) => {
      const g =
        dir === "bottom"
          ? ctx.createLinearGradient(0, y, 0, y + fh)
          : ctx.createLinearGradient(x, 0, x + fw, 0);
      const alphas =
        dir === "left" ? [1, 0.7, 0.2, 0.05, 0] : [0, 0.05, 0.2, 0.7, 1];
      [0, 0.35, 0.55, 0.7, 1].forEach((s, i) =>
        g.addColorStop(s, `rgba(${bg},${alphas[i]})`),
      );
      ctx.fillStyle = g;
      ctx.fillRect(x, y, fw, fh);
    };
    // The axis margins are painted in the background colour so the labels stay readable over
    // data running under them: as a gradient reaching 20px into the plot, which fades the data
    // out toward the borders (the default), or with bgFade off as plain strips with a hard edge.
    if (chart.config.bgFade === false) {
      ctx.fillStyle = `rgb(${bg})`;
      ctx.fillRect(0, 0, m.left, h);
      if (hasRightAxes(chart)) ctx.fillRect(w - m.right, 0, m.right, h);
      ctx.fillRect(0, h - m.bottom, w, m.bottom);
    } else {
      drawFade("left", 0, 0, m.left + 20, h);
      if (hasRightAxes(chart)) drawFade("right", w - m.right - 20, 0, m.right + 20, h);
      drawFade("bottom", 0, h - m.bottom - 20, w, m.bottom + 20);
    }

    ctx.font = `${labelSize}px ${font}`;
    ctx.textBaseline = "middle";

    const strips = yAxisStrips(chart, m, w);
    if (!strips) {
      ctx.fillStyle = text;
      ctx.textAlign = "right";
      niceTicks(my, my + ry, 7).forEach((v) => {
        const y = h * (1 - (v - my) / ry);
        if (y > 5 && y < h - m.bottom - 5)
          ctx.fillText(formatY(v), m.left - 5, y);
      });
    } else {
      for (const strip of strips) {
        const scale = strip.axis?.scale ?? 1;
        const offset = strip.axis?.offset ?? 0;
        const fmt = strip.format ?? formatY;
        // Visible primary-space window my..my+ry mapped into this axis' units.
        const aMin = (my - offset) / scale;
        const aMax = (my + ry - offset) / scale;
        ctx.fillStyle = strip.color ?? text;
        ctx.textAlign = strip.side === "right" ? "left" : "right";
        const tx = strip.side === "right" ? strip.x0 + 5 : strip.x1 - 5;
        niceTicks(aMin, aMax, 7).forEach((v) => {
          const y = h * (1 - (v * scale + offset - my) / ry);
          if (y > 5 && y < h - m.bottom - 5) ctx.fillText(fmt(v), tx, y);
        });
      }
    }

    ctx.fillStyle = text;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    niceTicks(mx, mx + rx, 8).forEach((v) => {
      const x = w * ((v - mx) / rx);
      if (x < m.left - 10 || x > w + 30) return;
      ctx.save();
      ctx.translate(x, h - m.bottom + 5);
      ctx.rotate(-Math.PI / 14);
      ctx.fillText(formatX(v), 0, 0);
      ctx.restore();
    });
  },
};
