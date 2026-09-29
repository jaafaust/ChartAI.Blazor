import type { ChartPlugin, InternalChart, ChartConfig } from "../../types.ts";
import { ChartManager } from "../../chart-library.ts";
import { MARGIN, chartDpr, chartMargin, clickFollowsDrag } from "../shared.ts";
import { commitView } from "../redraw.ts";
import { newThumbnail, seriesThumbnail, type Thumbnail } from "./thumbnail.ts";

export type MinimapPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface MinimapConfig {
  minimapPosition?: MinimapPosition;
  minimapSize?: number;
  minimapOpacity?: number;
}

declare module "../../types.ts" {
  interface ChartPluginRegistry {
    minimap: MinimapConfig;
  }
}

interface MinimapState {
  abort: AbortController;
  drag: { startFx: number; startFy: number; startPanX: number; startPanY: number } | null;
  didDrag: boolean;
  thumb: Thumbnail;
}

const states = new WeakMap<InternalChart, MinimapState>();

const INNER_PAD = 4;

function getMinimapOrigin(
  pos: MinimapPosition,
  mSize: number,
  cw: number,
  ch: number,
  chart?: InternalChart,
): { mx: number; my: number } {
  const pad = 8;
  const m = chart ? chartMargin(chart) : MARGIN;
  switch (pos) {
    case "top-left":
      return { mx: m.left + pad, my: m.top + pad };
    case "top-right":
      return { mx: cw - m.right - mSize - pad, my: m.top + pad };
    case "bottom-left":
      return { mx: m.left + pad, my: ch - m.bottom - mSize - pad };
    case "bottom-right":
      return { mx: cw - m.right - mSize - pad, my: ch - m.bottom - mSize - pad };
  }
}

export const minimapPlugin: ChartPlugin<MinimapConfig> = {
  name: "minimap",

  // The press and click handlers run in the capture phase on the host, ahead of the handlers on
  // the interaction layer, and keep a press on the minimap to themselves: the zoom plugin used to
  // pan the chart with the same press, and the ruler and tooltip pin took its click as theirs.
  install(chart, el) {
    const ac = new AbortController();
    const host = chart.el;
    states.set(chart, { abort: ac, drag: null, didDrag: false, thumb: newThumbnail() });

    const getMinimapCoords = (e: PointerEvent | MouseEvent) => {
      const cfg = chart.config as ChartConfig & MinimapConfig;
      const mSize = cfg.minimapSize ?? 120;
      const pos: MinimapPosition = cfg.minimapPosition ?? "bottom-right";
      const { width: cw, height: ch } = chart;
      const r = el.getBoundingClientRect();
      const scaleX = cw / r.width;
      const scaleY = ch / r.height;
      const cx = (e.clientX - r.left) * scaleX;
      const cy = (e.clientY - r.top) * scaleY;
      const { mx, my } = getMinimapOrigin(pos, mSize, cw, ch, chart);
      return { cx, cy, mx, my, mSize };
    };
    // The minimap is drawn on the chart canvas; a control above it (the ruler button shares its
    // corner) keeps its own presses and clicks.
    const onCanvas = (e: Event) =>
      e.target instanceof HTMLCanvasElement && e.target.parentElement === el;

    host.addEventListener(
      "pointerdown",
      (e) => {
        if (!onCanvas(e)) return;
        const { cx, cy, mx, my, mSize } = getMinimapCoords(e);
        if (cx < mx || cx > mx + mSize || cy < my || cy > my + mSize) return;

        e.preventDefault();
        e.stopPropagation();
        el.setPointerCapture(e.pointerId);
        const state = states.get(chart);
        if (!state) return;

        const fx = (cx - mx) / mSize;
        const fy = (cy - my) / mSize;
        state.drag = {
          startFx: fx,
          startFy: fy,
          startPanX: chart.view.panX,
          startPanY: chart.view.panY,
        };
      },
      { capture: true, signal: ac.signal },
    );

    window.addEventListener(
      "pointermove",
      (e) => {
        const state = states.get(chart);
        if (!state?.drag) return;
        if (e.buttons === 0) { state.drag = null; return; }

        const { cx, cy, mx, my, mSize } = getMinimapCoords(e);
        const fx = (cx - mx) / mSize;
        const fy = (cy - my) / mSize;
        const dfx = fx - state.drag.startFx;
        const dfy = fy - state.drag.startFy;

        const hv = chart.homeView;
        chart.view.panX = Math.max(
          hv.panX,
          Math.min(hv.panX + 1 / hv.zoomX - 1 / chart.view.zoomX, state.drag.startPanX + dfx / hv.zoomX),
        );
        // fy increases downward (screen), but panY increases upward (data), so invert
        chart.view.panY = Math.max(
          hv.panY,
          Math.min(hv.panY + 1 / hv.zoomY - 1 / chart.view.zoomY, state.drag.startPanY - dfy / hv.zoomY),
        );
        if (Math.abs(dfx) > 0.005 || Math.abs(dfy) > 0.005) state.didDrag = true;
        commitView(chart);
      },
      { signal: ac.signal },
    );

    window.addEventListener(
      "pointerup",
      () => {
        const state = states.get(chart);
        if (state) {
          if (state.drag) {
            setTimeout(() => { if (state) state.didDrag = false; }, 50);
          }
          state.drag = null;
        }
      },
      { signal: ac.signal },
    );

    host.addEventListener(
      "click",
      (e) => {
        const state = states.get(chart);
        if (!state) return;
        // The click that ends a drag of the minimap's window belongs to that drag.
        if (state.didDrag) {
          state.didDrag = false;
          e.stopPropagation();
          return;
        }
        // The click that ends a pan of the chart is not a jump, wherever it lands.
        if (clickFollowsDrag(chart) || !onCanvas(e)) return;

        const { cx, cy, mx, my, mSize } = getMinimapCoords(e);
        if (cx < mx || cx > mx + mSize || cy < my || cy > my + mSize) return;

        e.preventDefault();
        e.stopPropagation();
        const fx = (cx - mx) / mSize;
        const fy = (cy - my) / mSize;
        const fyData = 1 - fy;
        const hv = chart.homeView;
        chart.view.panX = Math.max(
          hv.panX,
          Math.min(hv.panX + 1 / hv.zoomX - 1 / chart.view.zoomX, hv.panX + fx / hv.zoomX - 0.5 / chart.view.zoomX),
        );
        chart.view.panY = Math.max(
          hv.panY,
          Math.min(hv.panY + 1 / hv.zoomY - 1 / chart.view.zoomY, hv.panY + fyData / hv.zoomY - 0.5 / chart.view.zoomY),
        );
        commitView(chart);
      },
      { capture: true, signal: ac.signal },
    );
  },

  afterDraw(ctx, chart) {
    const state = states.get(chart);
    if (!state) return;
    const cfg = chart.config as ChartConfig & MinimapConfig;
    const mSize = cfg.minimapSize ?? 120;
    const opacity = cfg.minimapOpacity ?? 0.85;
    const pos: MinimapPosition = cfg.minimapPosition ?? "bottom-right";
    const { width: cw, height: ch } = chart;
    const dark = ChartManager.isDark;

    const { mx, my } = getMinimapOrigin(pos, mSize, cw, ch, chart);
    const mw = mSize;
    const mh = mSize;
    const borderR = 6;
    const innerPad = INNER_PAD;

    ctx.save();
    ctx.globalAlpha = opacity;

    const bgColor = cfg.bgColor ?? (dark ? [0.11, 0.11, 0.12] : [0.98, 0.98, 0.98]);
    ctx.fillStyle = `rgb(${bgColor.map((c: number) => Math.round(c * 255)).join(",")})`;
    ctx.beginPath();
    ctx.roundRect(mx, my, mw, mh, borderR);
    ctx.fill();
    ctx.strokeStyle = dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.14)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.roundRect(mx + 1, my + 1, mw - 2, mh - 2, borderR - 1);
    ctx.clip();

    // The series are drawn once per data change, at the chart's pixel ratio, and copied here.
    const thumb = seriesThumbnail(state.thumb, chart, mw, mh, innerPad, chartDpr(chart));
    if (thumb) ctx.drawImage(thumb, mx, my, mw, mh);

    const { view: v } = chart;
    const hv = chart.homeView;
    const homeRangeX = 1 / hv.zoomX;
    const homeRangeY = 1 / hv.zoomY;
    const vx = mx + innerPad + (v.panX - hv.panX) * hv.zoomX * (mw - innerPad * 2);
    const vy = my + innerPad + (1 - (v.panY - hv.panY) * hv.zoomY - (1 / v.zoomY) / homeRangeY) * (mh - innerPad * 2);
    const vw = (1 / v.zoomX) / homeRangeX * (mw - innerPad * 2);
    const vh = (1 / v.zoomY) / homeRangeY * (mh - innerPad * 2);

    ctx.fillStyle = dark ? "rgba(255,255,255,0.12)" : "rgba(0,100,255,0.1)";
    ctx.fillRect(vx, vy, vw, vh);
    ctx.strokeStyle = dark ? "rgba(255,255,255,0.5)" : "rgba(0,100,255,0.6)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vx, vy, vw, vh);

    ctx.restore();
  },

  uninstall(chart) {
    const s = states.get(chart);
    if (s) {
      s.abort.abort();
      states.delete(chart);
    }
  },
};
