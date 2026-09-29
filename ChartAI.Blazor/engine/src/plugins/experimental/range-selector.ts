import type { ChartPlugin, InternalChart, ChartConfig } from "../../types.ts";
import { ChartManager } from "../../chart-library.ts";
import { chartDpr } from "../shared.ts";
import { commitView } from "../redraw.ts";
import { newThumbnail, seriesThumbnail, type Thumbnail } from "./thumbnail.ts";

export interface RangeSelectorConfig {
  rangeSelectorHeight?: number;
  rangeSelectorMargin?: number;
  brushColor?: string;
}

declare module "../../types.ts" {
  interface ChartPluginRegistry {
    "range-selector": RangeSelectorConfig;
  }
}

interface BrushDrag {
  type: "move" | "left" | "right";
  startX: number;
  startPanX: number;
  startZoomX: number;
}

interface RangeSelectorState {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  abort: AbortController;
  brushDrag: BrushDrag | null;
  thumb: Thumbnail;
  // The strip's size in CSS px and its pixel ratio.
  width: number;
  height: number;
  dpr: number;
  // The interaction layer, and its inline height before the strip took its share.
  el: HTMLElement;
  originalHeight: string;
}

const states = new WeakMap<InternalChart, RangeSelectorState>();

// How close (CSS px) to a brush edge a press grabs that edge.
const EDGE_PX = 5;
const EDGE_PX_TOUCH = 12;

// The strip is as wide as the chart: chart.width comes from ChartManager's ResizeObserver, so
// sizing it reads no layout. The backing store follows the pixel ratio, so it stays sharp.
function fitCanvas(chart: InternalChart, state: RangeSelectorState): void {
  const w = Math.max(1, chart.width);
  const dpr = chartDpr(chart);
  if (w === state.width && dpr === state.dpr) return;
  state.width = w;
  state.dpr = dpr;
  state.canvas.width = Math.round(w * dpr);
  state.canvas.height = Math.round(state.height * dpr);
}

function drawMiniCanvas(chart: InternalChart, state: RangeSelectorState): void {
  const { ctx, width: w, height: h, dpr } = state;
  const dark = ChartManager.isDark;
  const cfg = chart.config as ChartConfig & RangeSelectorConfig;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const bgColor = cfg.bgColor ?? (dark ? [0.11, 0.11, 0.12] : [0.98, 0.98, 0.98]);
  ctx.fillStyle = `rgb(${bgColor.map((c: number) => Math.round(c * 255)).join(",")})`;
  ctx.fillRect(0, 0, w, h);

  // The series are drawn once per data change and copied here.
  const thumb = seriesThumbnail(state.thumb, chart, w, h, 0, dpr);
  if (thumb) ctx.drawImage(thumb, 0, 0, w, h);

  const { view: v } = chart;
  const hv = chart.homeView;
  const homeRange = 1 / hv.zoomX;
  const brushL = (v.panX - hv.panX) / homeRange * w;
  const brushR = (v.panX - hv.panX + 1.0 / v.zoomX) / homeRange * w;
  const brushColor =
    cfg.brushColor ?? (dark ? "rgba(255,255,255,0.12)" : "rgba(0,100,255,0.1)");
  const brushBorder = dark ? "rgba(255,255,255,0.35)" : "rgba(0,100,255,0.5)";

  ctx.fillStyle = dark ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.5)";
  ctx.fillRect(0, 0, brushL, h);
  ctx.fillRect(brushR, 0, w - brushR, h);

  ctx.fillStyle = brushColor;
  ctx.fillRect(brushL, 0, brushR - brushL, h);
  ctx.strokeStyle = brushBorder;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(brushL, 0.75, brushR - brushL, h - 1.5);
}

export const rangeSelectorPlugin: ChartPlugin<RangeSelectorConfig> = {
  name: "range-selector",

  // The strip sits below the chart inside the chart's element: the interaction layer gives up
  // the strip's height (it used to keep all of it, so the strip spilled out of the container).
  // It is driven by pointer events, so touch drags the brush as a mouse does; vertical swipes
  // over it still scroll the page.
  install(chart, el) {
    const cfg = chart.config as ChartConfig & RangeSelectorConfig;
    const height = cfg.rangeSelectorHeight ?? 60;
    const margin = cfg.rangeSelectorMargin ?? 4;
    const ac = new AbortController();

    const canvas = document.createElement("canvas");
    canvas.style.cssText = `display:block;margin-top:${margin}px;width:100%;height:${height}px;touch-action:pan-y;`;

    const originalHeight = el.style.height;
    if (el.parentElement) {
      el.style.height = `calc(100% - ${height + margin}px)`;
      el.parentElement.insertBefore(canvas, el.nextSibling);
    }

    const ctx2d = canvas.getContext("2d")!;
    const state: RangeSelectorState = {
      canvas,
      ctx: ctx2d,
      abort: ac,
      brushDrag: null,
      thumb: newThumbnail(),
      width: 0,
      height,
      dpr: 0,
      el,
      originalHeight,
    };
    states.set(chart, state);

    const getRelX = (e: PointerEvent): number => {
      const rect = canvas.getBoundingClientRect();
      return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    };
    // The brush's edges as fractions of the strip, and the edge tolerance for this pointer.
    const brush = (e: PointerEvent) => {
      const { view: v } = chart;
      const hv = chart.homeView;
      const homeRange = 1 / hv.zoomX;
      const left = (v.panX - hv.panX) / homeRange;
      return {
        left,
        right: left + hv.zoomX / v.zoomX,
        tol: (e.pointerType === "touch" ? EDGE_PX_TOUCH : EDGE_PX) / (state.width || 1),
      };
    };
    const hoverCursor = (e: PointerEvent) => {
      const rx = getRelX(e);
      const { left, right, tol } = brush(e);
      canvas.style.cursor =
        Math.abs(rx - left) < tol || Math.abs(rx - right) < tol
          ? "ew-resize"
          : rx > left && rx < right
            ? "grab"
            : "default";
    };

    canvas.addEventListener(
      "pointerdown",
      (e) => {
        const rx = getRelX(e);
        const { view: v } = chart;
        const { left, right, tol } = brush(e);
        const start = (type: BrushDrag["type"]) => {
          state.brushDrag = { type, startX: rx, startPanX: v.panX, startZoomX: v.zoomX };
          canvas.setPointerCapture(e.pointerId);
        };

        if (Math.abs(rx - left) < tol) {
          start("left");
        } else if (Math.abs(rx - right) < tol) {
          start("right");
        } else if (rx > left && rx < right) {
          start("move");
          canvas.style.cursor = "grabbing";
        } else {
          // A press outside the brush centres it there.
          const hv = chart.homeView;
          const homeRange = 1 / hv.zoomX;
          const brushWidth = 1.0 / v.zoomX;
          chart.view.panX = Math.max(hv.panX, Math.min(hv.panX + homeRange - brushWidth, hv.panX + rx * homeRange - brushWidth / 2));
          commitView(chart);
        }
        e.preventDefault();
      },
      { signal: ac.signal },
    );

    canvas.addEventListener(
      "pointermove",
      (e) => {
        if (!state.brushDrag) {
          if (e.pointerType !== "touch") hoverCursor(e);
          return;
        }
        const rect = canvas.getBoundingClientRect();
        const rx = (e.clientX - rect.left) / rect.width;
        const dx = rx - state.brushDrag.startX;
        const { startPanX, startZoomX } = state.brushDrag;

        const hv = chart.homeView;
        const homeRange = 1 / hv.zoomX;
        if (state.brushDrag.type === "move") {
          chart.view.panX = Math.max(hv.panX, Math.min(hv.panX + homeRange - 1 / startZoomX, startPanX + dx * homeRange));
        } else if (state.brushDrag.type === "left") {
          const newLeft = Math.max(hv.panX, startPanX + dx * homeRange);
          const newRight = startPanX + 1.0 / startZoomX;
          if (newLeft < newRight - 0.01) {
            chart.view.panX = newLeft;
            chart.view.zoomX = Math.max(hv.zoomX, 1.0 / (newRight - newLeft));
          }
        } else if (state.brushDrag.type === "right") {
          const newRight = Math.min(hv.panX + homeRange, startPanX + 1.0 / startZoomX + dx * homeRange);
          if (newRight > startPanX + 0.01) {
            chart.view.zoomX = Math.max(hv.zoomX, 1.0 / (newRight - startPanX));
          }
        }
        commitView(chart);
      },
      { signal: ac.signal },
    );

    const endDrag = (e: PointerEvent) => {
      if (!state.brushDrag) return;
      state.brushDrag = null;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {}
      if (e.pointerType !== "touch") hoverCursor(e);
      else canvas.style.cursor = "";
    };
    canvas.addEventListener("pointerup", endDrag, { signal: ac.signal });
    canvas.addEventListener("pointercancel", endDrag, { signal: ac.signal });

    fitCanvas(chart, state);
    drawMiniCanvas(chart, state);
  },

  afterDraw(_, chart) {
    const state = states.get(chart);
    if (!state) return;
    fitCanvas(chart, state);
    drawMiniCanvas(chart, state);
  },

  uninstall(chart) {
    const state = states.get(chart);
    if (state) {
      state.abort.abort();
      state.canvas.remove();
      state.el.style.height = state.originalHeight;
      states.delete(chart);
    }
  },
};
