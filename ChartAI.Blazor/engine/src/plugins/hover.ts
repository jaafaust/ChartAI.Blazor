import type { ChartPlugin, InternalChart, HoverData } from "../types.ts";
import { ChartManager } from "../chart-library.ts";
import { M } from "../msg.ts";
import { DEFAULT_FONT } from "./labels.ts";
import { chartMargin, seriesAxisFormat } from "./shared.ts";
import { dataToScreen, screenToData } from "./coords.ts";

const MAX_HOVER_PX = 50;

function findNearestPoint(
  chart: InternalChart,
  screenX: number,
  screenY: number,
  width: number,
  height: number,
): HoverData | null {
  if (chart.series.length === 0) return null;
  const { x: dataX, y: dataY } = screenToData(
    screenX,
    screenY,
    chart,
    width,
    height,
  );
  const rX = chart.bounds.maxX - chart.bounds.minX;
  const vW = rX / chart.view.zoomX;
  const vMinX = chart.bounds.minX + chart.view.panX * rX;

  const shared = findNearestLine(chart, dataX, dataY, height);
  if (shared !== undefined) return shared;

  let bsi = -1,
    bi = -1,
    bdx = Infinity,
    bdy = Infinity;
  for (let s = 0; s < chart.series.length; s++) {
    if (chart.config?.hiddenSeries?.has(s)) continue;
    const sr = chart.series[s];
    const n = sr.rawX.length;
    if (n === 0) continue;
    let lo = 0,
      hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sr.rawX[mid] < dataX) lo = mid + 1;
      else hi = mid;
    }
    let idx = lo;
    if (
      lo > 0 &&
      Math.abs(sr.rawX[lo - 1] - dataX) < Math.abs(sr.rawX[lo] - dataX)
    )
      idx = lo - 1;
    const dx = Math.abs(sr.rawX[idx] - dataX);
    const dy = Math.abs((sr.plotY ?? sr.rawY)[idx] - dataY);
    if (dx < bdx || (dx === bdx && dy < bdy)) {
      bdx = dx;
      bdy = dy;
      bsi = s;
      bi = idx;
    }
  }
  if (bsi === -1) return null;
  const sr = chart.series[bsi];
  if (Math.abs(((sr.rawX[bi] - vMinX) / vW) * width - screenX) > MAX_HOVER_PX)
    return null;
  return {
    x: sr.rawX[bi],
    y: (sr.plotY ?? sr.rawY)[bi],
    value: sr.rawY[bi],
    index: bi,
    screenX,
    screenY,
    seriesIndex: bsi,
    seriesLabel: sr.label,
  };
}

// Series sharing one x array (the sampled trend): the line under the cursor is the one whose
// segment between the two neighbouring columns passes closest, so the pick follows a line along
// its whole length instead of jumping at vertex midpoints. Returns undefined when the series do
// not share x, null when nothing is within reach.
function findNearestLine(
  chart: InternalChart,
  dataX: number,
  dataY: number,
  height: number,
): HoverData | null | undefined {
  const first = chart.series[0];
  const xs = first.rawX;
  const n = xs.length;
  for (const s of chart.series) if (s.rawX !== xs) return;
  if (n === 0) return null;

  const rY = chart.bounds.maxY - chart.bounds.minY;
  const pxPerY = height / (rY / chart.view.zoomY);
  const rX = chart.bounds.maxX - chart.bounds.minX;
  const pxPerX = chart.width / (rX / chart.view.zoomX);

  let lo = 0,
    hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] < dataX) lo = mid + 1;
    else hi = mid;
  }
  const c1 = lo,
    c0 = Math.max(0, lo - 1);
  const t = c1 > c0 ? Math.min(1, Math.max(0, (dataX - xs[c0]) / (xs[c1] - xs[c0]))) : 0;
  const near = t < 0.5 ? c0 : c1;
  if (
    Math.abs(xs[c0] - dataX) * pxPerX > MAX_HOVER_PX &&
    Math.abs(xs[c1] - dataX) * pxPerX > MAX_HOVER_PX &&
    (dataX < xs[c0] || dataX > xs[c1])
  )
    return null;

  const isGap = (v: number) => v == null || v !== v;
  let bsi = -1,
    bd = MAX_HOVER_PX;
  for (let s = 0; s < chart.series.length; s++) {
    if (chart.config?.hiddenSeries?.has(s)) continue;
    const ys = chart.series[s].plotY ?? chart.series[s].rawY;
    const y0 = ys[c0],
      y1 = ys[c1];
    let y: number;
    if (!isGap(y0) && !isGap(y1)) y = y0 + (y1 - y0) * t;
    else if (!isGap(y0)) y = y0;
    else if (!isGap(y1)) y = y1;
    else continue;
    const d = Math.abs(y - dataY) * pxPerY;
    if (d < bd) {
      bd = d;
      bsi = s;
    }
  }
  if (bsi === -1) return null;
  const sr = chart.series[bsi];
  const ys = sr.plotY ?? sr.rawY;
  const idx = !isGap(ys[near]) ? near : near === c0 ? c1 : c0;
  // screenX/screenY are filled in by the caller (handleHover).
  return {
    x: xs[idx],
    y: ys[idx],
    value: sr.rawY[idx],
    index: idx,
    seriesIndex: bsi,
    seriesLabel: sr.label,
  } as HoverData;
}

// Text colour on a fill of a series colour: the same hue pulled toward black on a light fill or
// toward white on a dark one, by `k`, so it stays readable for any of the palette's colours.
const onColor = (rgb: string, k: number) => {
  const [r, g, b] = rgb.split(",").map(Number);
  const t = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.4 ? 0 : 255;
  return `rgb(${Math.round(r + (t - r) * k)},${Math.round(g + (t - g) * k)},${Math.round(b + (t - b) * k)})`;
};

export interface HoverConfig {
  onHover?: (data: HoverData | null) => void;
  showTooltip?: boolean;
  pillDecayMs?: number;
  fontFamily?: string;
  formatX?: (value: number) => string;
  formatY?: (value: number) => string;
  // false keeps the GPU from drawing the hovered series on top and dimming the rest.
  highlightHover?: boolean;
}

declare module "../types.ts" {
  interface ChartPluginRegistry {
    hover: HoverConfig;
  }
}

interface HoverState {
  hoverResult: HoverData | null;
  // Series index the worker currently highlights, -1 for none.
  highlight: number;
  pillX: number;
  pillY: number;
  pillTargetX: number;
  pillTargetY: number;
  pillAnimRef: number | null;
  abort: AbortController;
}

const states = new WeakMap<InternalChart, HoverState>();

export const hoverPlugin: ChartPlugin<HoverConfig> = {
  name: "hover",

  install(chart, el) {
    const mgr = ChartManager;
    const ac = new AbortController();
    const s: HoverState = {
      hoverResult: null,
      highlight: -1,
      pillX: 0,
      pillY: 0,
      pillTargetX: 0,
      pillTargetY: 0,
      pillAnimRef: null,
      abort: ac,
    };
    states.set(chart, s);

    const update = (res: HoverData | null) => {
      if (chart.config.onHover) chart.config.onHover(res);
      // The GPU draws the hovered series on top and dims the rest; only a change is posted.
      const hl = res && chart.config.highlightHover !== false ? res.seriesIndex : -1;
      if (hl !== s.highlight) {
        s.highlight = hl;
        mgr["worker"]?.postMessage({ type: M.SET_STYLE, id: el.dataset.chartId, highlightSeries: hl });
      }
      if (!(chart.config.showTooltip ?? false)) return;
      s.hoverResult = res;
      mgr.drawChart(chart);

      if (res && !s.pillAnimRef) {
        let lastT = performance.now();
        const tick = (now: number) => {
          if (!s.hoverResult) return (s.pillAnimRef = null);
          const f =
            1 - Math.pow(0.5, (now - lastT) / (chart.config.pillDecayMs ?? 60));
          lastT = now;
          s.pillX += (s.pillTargetX - s.pillX) * f;
          s.pillY += (s.pillTargetY - s.pillY) * f;
          mgr.drawChart(chart);
          s.pillAnimRef = requestAnimationFrame(tick);
        };
        s.pillAnimRef = requestAnimationFrame(tick);
      }
    };

    const handleHover = (clientX: number, clientY: number) => {
      if (chart.dragging) return;
      const r = el.getBoundingClientRect();
      const res = findNearestPoint(
        chart,
        clientX - r.left,
        clientY - r.top,
        r.width,
        r.height,
      );
      if (res) {
        res.screenX = clientX - r.left;
        res.screenY = clientY - r.top;
      }
      update(res);
    };

    el.addEventListener("mousemove", (e) => handleHover(e.clientX, e.clientY), {
      signal: ac.signal,
    });

    el.addEventListener(
      "touchmove",
      (e) => {
        if (e.touches.length === 1) {
          handleHover(e.touches[0].clientX, e.touches[0].clientY);
        }
      },
      { signal: ac.signal, passive: true },
    );

    ["mouseleave", "pointerdown", "touchend", "touchcancel"].forEach((ev) =>
      el.addEventListener(ev, () => update(null), { signal: ac.signal }),
    );
  },

  afterDraw(ctx, chart) {
    const s = states.get(chart);
    if (!s?.hoverResult || !chart.config.showTooltip) return;

    const { hoverResult: hvr } = s;
    const w = chart.width;
    const h = chart.height;
    const margin = chartMargin(chart);
    const dark = ChartManager.isDark;
    const {
      formatX = String,
      formatY = String,
      fontFamily = DEFAULT_FONT,
    } = chart.config;

    const { x: px, y: py } = dataToScreen(hvr.x, hvr.y, chart, w, h);

    const mainSeries = chart.series[hvr.seriesIndex] || chart.series[0];
    const rgb = `${Math.round(mainSeries.color.r * 255)},${Math.round(mainSeries.color.g * 255)},${Math.round(mainSeries.color.b * 255)}`;
    const col = `rgb(${rgb})`;
    const textCol = dark ? `oklch(from ${col} calc(l + 0.1) c h)` : col;
    // A gap under the cursor has no y: only the vertical guide and the x pill are drawn.
    const hasY = Number.isFinite(py);

    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = `rgba(${rgb},0.4)`;
    ctx.stroke(
      new Path2D(
        hasY
          ? `M${px} 0V${h - margin.bottom}M${margin.left} ${py}H${w}`
          : `M${px} 0V${h - margin.bottom}`,
      ),
    );
    ctx.restore();

    if (hasY) {
      ctx.beginPath();
      ctx.arc(px, py, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.strokeStyle = dark ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.9)";
      ctx.stroke();
    }

    type SeriesPoint = {
      si: number;
      label: string;
      val: string;
      rawVal: number;
      rgb: string;
      col: string;
    };
    const seriesData = chart.series
      .map((ser, si): SeriesPoint | null => {
        if (chart.config?.hiddenSeries?.has(si)) return null;
        let l = 0,
          r = ser.rawX.length - 1;
        while (l <= r) {
          const m = (l + r) >> 1;
          if (Math.abs(ser.rawX[m] - hvr.x) < 0.0001) {
            const v = ser.rawY[m];
            if (v == null || v !== v) return null;
            const rgb = `${Math.round(ser.color.r * 255)},${Math.round(ser.color.g * 255)},${Math.round(ser.color.b * 255)}`;
            return {
              si,
              label: ser.label,
              val: seriesAxisFormat(chart, si)(v),
              rawVal: v,
              rgb,
              col: `rgb(${rgb})`,
            };
          }
          ser.rawX[m] < hvr.x ? (l = m + 1) : (r = m - 1);
        }
        return null;
      })
      .filter((x): x is SeriesPoint => x !== null);

    seriesData.sort((a, b) => Math.abs(b.rawVal) - Math.abs(a.rawVal));
    // The hovered series leads the list, whatever its magnitude.
    const hovered = seriesData.findIndex((d) => d.si === hvr.seriesIndex);
    if (hovered > 0) seriesData.unshift(...seriesData.splice(hovered, 1));
    const totalSeries = seriesData.length;
    const displayData = seriesData.slice(0, 5);
    const remainingCount = totalSeries - displayData.length;

    s.pillTargetX = px;
    s.pillTargetY = py;
    if (!s.pillAnimRef) {
      s.pillX = px;
      s.pillY = py;
    }

    const drawPill = (x: number, y: number, txt: string, isX: boolean, anchorLeft?: boolean) => {
      ctx.font = `600 10px ${fontFamily}`;
      const tw = ctx.measureText(txt).width,
        pw = tw + 12,
        ph = 18;
      const ox = isX ? x - pw / 2 : x - pw,
        oy = isX ? y : y - ph / 2;

      ctx.save();
      const angle = isX
        ? Math.atan((s.pillTargetX - s.pillX) / 80) * 0.2
        : Math.atan((s.pillTargetY - s.pillY) / 80) * 0.2;
      ctx.translate(x, y);
      ctx.rotate(angle);
      const bx = isX ? -pw / 2 : anchorLeft ? 0 : -pw,
        by = isX ? 0 : -ph / 2;

      ctx.beginPath();
      ctx.roundRect(bx, by, pw, ph, 4);
      ctx.fillStyle = dark ? "rgba(0,0,0,0.75)" : "rgba(255,255,255,0.75)";
      ctx.fill();
      ctx.fillStyle = `rgba(${rgb},0.2)`;
      ctx.fill();
      ctx.strokeStyle = textCol;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = textCol;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(txt, bx + pw / 2, by + ph / 2);
      ctx.restore();
    };

    drawPill(
      Math.max(margin.left, Math.min(w - margin.right, s.pillX)),
      h - margin.bottom + 4,
      formatX(hvr.x),
      true,
    );
    if (hasY) {
      // The y pill sits on the axis the hovered series is bound to and uses that axis' format.
      const hoveredAxis = chart.yAxes?.[chart.series[hvr.seriesIndex]?.axisIndex ?? 0];
      const pillLabel = seriesAxisFormat(chart, hvr.seriesIndex)(hvr.value ?? hvr.y);
      const pillY = Math.max(9, Math.min(h - margin.bottom - 9, s.pillY));
      if (hoveredAxis?.side === "right") drawPill(w - margin.right, pillY, pillLabel, false, true);
      else drawPill(margin.left, pillY, pillLabel, false);
    }

    // The hovered series (the highlighted line) is the tooltip's header: a block filled with
    // its colour carrying its name, the time and the value large, so it reads as "this one"
    // without knowing the ordering rule. The other series follow as a quiet list.
    const rowFont = `600 10px ${fontFamily}`,
      nameFont = `600 11px ${fontFamily}`,
      valueFont = `600 18px ${fontFamily}`;
    const rowH = 18,
      pad = 10;
    const leadIsHovered = displayData.length > 0 && displayData[0].si === hvr.seriesIndex;
    const lead = leadIsHovered ? displayData[0] : null;
    const rows = leadIsHovered ? displayData.slice(1) : displayData;
    const timeTxt = formatX(hvr.x);
    const widths: number[] = [];
    ctx.font = rowFont;
    const timeW = ctx.measureText(timeTxt).width;
    for (const d of rows)
      widths.push(24 + ctx.measureText(d.label).width + 12 + ctx.measureText(d.val).width);
    if (remainingCount > 0) widths.push(ctx.measureText(`+${remainingCount} more`).width);
    if (lead) {
      ctx.font = nameFont;
      widths.push(ctx.measureText(lead.label).width + 10 + timeW);
      ctx.font = valueFont;
      widths.push(ctx.measureText(lead.val).width);
    } else {
      widths.push(timeW);
    }
    const headerH = lead ? 46 : 26;
    const boxW = Math.max(0, ...widths) + 2 * pad;
    const boxH = headerH + (lead ? 4 : 0) + rows.length * rowH + (remainingCount > 0 ? rowH : 0) + 4;
    let bx = hvr.screenX + 14,
      by = hvr.screenY - boxH - 6;
    if (bx + boxW > w) bx = hvr.screenX - boxW - 14;
    by = Math.max(4, Math.min(h - boxH - 4, hvr.screenY - boxH - 6));

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(bx, by, boxW, boxH, 6);
    ctx.clip();
    ctx.fillStyle = dark ? "rgba(28,28,30,0.95)" : "rgba(255,255,255,0.96)";
    ctx.fillRect(bx, by, boxW, boxH);
    if (lead) {
      ctx.fillStyle = lead.col;
      ctx.fillRect(bx, by, boxW, headerH);
    }
    ctx.restore();
    ctx.beginPath();
    ctx.roundRect(bx, by, boxW, boxH, 6);
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textBaseline = "middle";
    if (lead) {
      ctx.textAlign = "left";
      ctx.font = nameFont;
      ctx.fillStyle = onColor(lead.rgb, 0.78);
      ctx.fillText(lead.label, bx + pad, by + 14);
      ctx.textAlign = "right";
      ctx.font = rowFont;
      ctx.fillStyle = onColor(lead.rgb, 0.6);
      ctx.fillText(timeTxt, bx + boxW - pad, by + 14);
      ctx.textAlign = "left";
      ctx.font = valueFont;
      ctx.fillStyle = onColor(lead.rgb, 0.78);
      ctx.fillText(lead.val, bx + pad, by + 33);
    } else {
      ctx.textAlign = "left";
      ctx.font = rowFont;
      ctx.fillStyle = dark ? "#888" : "#999";
      ctx.fillText(timeTxt, bx + pad, by + 15);
    }
    let rowTop = by + headerH + (lead ? 4 : 0);
    ctx.font = rowFont;
    rows.forEach((sd) => {
      const ty = rowTop + rowH / 2;
      ctx.fillStyle = sd.col;
      ctx.beginPath();
      ctx.roundRect(bx + pad, ty - 4, 8, 8, 2);
      ctx.fill();
      ctx.textAlign = "left";
      ctx.fillStyle = dark ? "#eee" : "#1a1a1a";
      ctx.fillText(sd.label, bx + pad + 14, ty);
      ctx.textAlign = "right";
      ctx.fillText(sd.val, bx + boxW - pad, ty);
      rowTop += rowH;
    });

    if (remainingCount > 0) {
      ctx.textAlign = "left";
      ctx.fillStyle = dark ? "#666" : "#aaa";
      ctx.fillText(`+${remainingCount} more`, bx + pad, rowTop + rowH / 2);
    }
  },

  uninstall(chart) {
    const s = states.get(chart);
    if (s?.pillAnimRef) cancelAnimationFrame(s.pillAnimRef);
    s?.abort.abort();
    states.delete(chart);
  },
};
