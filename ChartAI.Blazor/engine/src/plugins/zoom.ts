import type { ChartPlugin, InternalChart, ZoomMode } from "../types.ts";
import { ChartManager } from "../chart-library.ts";
import { chartMargin, hasRightAxes } from "./shared.ts";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10_000_000;

export interface ZoomConfig {
  zoomMode?: ZoomMode;
}

declare module "../types.ts" {
  interface ChartPluginRegistry {
    zoom: ZoomConfig;
  }
}

export interface ZoomPluginOptions {
  // Kept for API compatibility with upstream chartai; pan momentum was removed in this build.
  momentumDecay?: number;
}

// Differences from upstream chartai's zoom plugin: no pan momentum, `chart.dragging` stays true
// for as long as a pointer is down (and briefly after a wheel step), a drag stamps
// `chart.lastDragEndTime`, the axis gutters pan their axis one-to-one, and the cursor shows
// what a drag would do.
export function zoomPlugin(
  opts: ZoomPluginOptions = {},
): ChartPlugin<ZoomConfig> {
  interface ZoomState {
    lastX: number;
    lastY: number;
    velX: number;
    velY: number;
    abort: AbortController;
    originalTouchAction: string;
    originalUserSelect: string;
    originalWebkitUserSelect: string;
    el: HTMLElement;
  }

  const state = new WeakMap<InternalChart, ZoomState>();

  return {
    name: "zoom",

    install(chart, el) {
      const originalTouchAction = el.style.touchAction;
      const originalUserSelect = el.style.userSelect;
      const originalWebkitUserSelect = (el.style as any).webkitUserSelect;
      el.style.touchAction = "none";
      el.style.userSelect = "none";
      (el.style as any).webkitUserSelect = "none";

      const mgr = ChartManager;
      const ac = new AbortController();
      const s: ZoomState = {
        lastX: 0,
        lastY: 0,
        velX: 0,
        velY: 0,
        abort: ac,
        originalTouchAction,
        originalUserSelect,
        originalWebkitUserSelect,
        el,
      };

      const mode = () => chart.config.zoomMode ?? "both";
      state.set(chart, s);

      let pointers: PointerEvent[] = [];
      type GestureState = "none" | "detecting" | "pan" | "pinch" | "press";
      let gestureState: GestureState = "none";
      let startX = 0,
        startY = 0,
        lastX = 0,
        lastY = 0,
        lastTime = 0;
      const PAN_THRESHOLD = 10; // px
      const TAP_THRESHOLD = 10; // px
      const PRESS_TIME = 500; // ms
      let pressTimer: number | null = null;
      let pinchStartDist = 0,
        pinchStartZoomX = 1,
        pinchStartZoomY = 1;
      let pinchCenterX = 0.5,
        pinchCenterY = 0.5;
      let velX = 0,
        velY = 0;
      let lastTapTime = 0;
      // The axis a drag has grabbed ("x" below the plot, "y" left of it), or null.
      let axisMode: "x" | "y" | null = null;

      const axisAt = (e: PointerEvent): "x" | "y" | null => {
        const rect = el.getBoundingClientRect();
        const localX = e.clientX - rect.left,
          localY = e.clientY - rect.top;
        const margin = chartMargin(chart);
        const overY =
          localX < margin.left || (hasRightAxes(chart) && localX > rect.width - margin.right);
        const overX = localY > rect.height - margin.bottom;
        if (overY && !overX) return "y";
        if (overX && !overY) return "x";
        return null;
      };
      // The cursor says what a drag would do: slide the axis under it, or pan the plot.
      const hoverCursor = (e: PointerEvent) => {
        const a = axisAt(e);
        return a === "x" ? "ew-resize" : a === "y" ? "ns-resize" : "";
      };

      const sendView = () => {
        mgr.requestRender(chart.id);
        mgr.drawChart(chart);
        if (mgr.syncViews) mgr.syncAllViews(chart);
      };

      el.addEventListener(
        "pointerdown",
        (e) => {
          pointers.push(e);
          el.setPointerCapture(e.pointerId);

          // Ensure dragging is true as long as there is an active pointer down
          chart.dragging = true;

          if (pointers.length === 1) {
            gestureState = "detecting";
            startX = e.clientX;
            startY = e.clientY;
            lastX = e.clientX;
            lastY = e.clientY;
            velX = velY = 0;
            lastTime = performance.now();
            // A press on an axis gutter grabs that axis: the drag then pans it
            // alone, whatever the zoom mode says about the plot area.
            axisMode = axisAt(e);
            if (axisMode) {
              el.style.cursor = axisMode === "x" ? "ew-resize" : "ns-resize";
            } else if (e.pointerType === "touch") {
              pressTimer = window.setTimeout(() => {
                if (gestureState === "detecting") {
                  gestureState = "press";
                }
              }, PRESS_TIME);
            } else {
              el.style.cursor = "grabbing";
            }
          } else if (pointers.length === 2) {
            if (pressTimer) {
              clearTimeout(pressTimer);
              pressTimer = null;
            }

            gestureState = "pinch";

            if (e.pointerType === "touch") {
              e.preventDefault();
            }

            const rect = el.getBoundingClientRect();
            const dx = pointers[1].clientX - pointers[0].clientX;
            const dy = pointers[1].clientY - pointers[0].clientY;
            pinchStartDist = Math.hypot(dx, dy);
            pinchStartZoomX = chart.view.zoomX;
            pinchStartZoomY = chart.view.zoomY;
            pinchCenterX =
              ((pointers[0].clientX + pointers[1].clientX) / 2 - rect.left) /
              rect.width;
            pinchCenterY =
              1 -
              ((pointers[0].clientY + pointers[1].clientY) / 2 - rect.top) /
                rect.height;
          }
        },
        { passive: false, signal: ac.signal },
      );

      el.addEventListener(
        "pointermove",
        (e) => {
          const idx = pointers.findIndex((p) => p.pointerId === e.pointerId);
          if (idx >= 0) {
            pointers[idx] = e;
          }

          if (
            pointers.length >= 1 &&
            e.buttons === 0 &&
            (gestureState === "pan" ||
              gestureState === "detecting" ||
              gestureState === "press" ||
              axisMode !== null)
          ) {
            endPointer(e);
            return;
          }

          if (pointers.length === 0) {
            if (e.pointerType !== "touch") el.style.cursor = hoverCursor(e);
            return;
          }

          if (pointers.length === 1) {
            const totalDist = Math.hypot(
              e.clientX - startX,
              e.clientY - startY,
            );

            if (gestureState === "detecting" && totalDist > PAN_THRESHOLD) {
              gestureState = "pan";
              if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
              }
            }

            if (gestureState === "press") {
              return;
            }

            if (axisMode) {
              // Pan the grabbed axis one-to-one, so the value under the pointer
              // stays under the pointer: the same feel as dragging the plot,
              // restricted to one axis. Zooming an axis is the wheel over it,
              // anchored at the pointer like the wheel over the plot. It used to
              // stretch the axis about the centre of the view at an exponential
              // rate instead, so the tick under the hand slid away, and in
              // x-only mode the y range could not be shifted at all.
              const rect = el.getBoundingClientRect();
              if (axisMode === "x") {
                chart.view.panX -= (e.clientX - lastX) / rect.width / chart.view.zoomX;
              } else {
                chart.view.panY += (e.clientY - lastY) / rect.height / chart.view.zoomY;
              }
              lastX = e.clientX;
              lastY = e.clientY;
              sendView();
              return;
            }

            if (gestureState === "pan" || chart.dragging) {
              const rect = el.getBoundingClientRect();
              const dx = (e.clientX - lastX) / rect.width;
              const dy = (e.clientY - lastY) / rect.height;

              const now = performance.now();
              if (now - lastTime < 100) {
                velX = velX * 0.3 + dx * 0.7;
                velY = velY * 0.3 + dy * 0.7;
              }
              lastTime = now;

              const m = mode();
              if (m !== "none" && (m === "both" || m === "x-only"))
                chart.view.panX -= dx / chart.view.zoomX;
              if (m !== "none" && (m === "both" || m === "y-only"))
                chart.view.panY += dy / chart.view.zoomY;

              lastX = e.clientX;
              lastY = e.clientY;
              sendView();
            }
          } else if (pointers.length === 2 && gestureState === "pinch") {
            if (e.pointerType === "touch") {
              e.preventDefault();
            }

            const rect = el.getBoundingClientRect();
            const dx = pointers[1].clientX - pointers[0].clientX;
            const dy = pointers[1].clientY - pointers[0].clientY;
            const dist = Math.hypot(dx, dy);

            // Recalculate pinch center on every move - zoom towards current finger position
            const currentPinchCenterX =
              ((pointers[0].clientX + pointers[1].clientX) / 2 - rect.left) /
              rect.width;
            const currentPinchCenterY =
              1 -
              ((pointers[0].clientY + pointers[1].clientY) / 2 - rect.top) /
                rect.height;

            const pixelChange = dist - pinchStartDist;
            const scale = Math.exp(pixelChange / 280);

            const pm = mode();
            if (pm !== "none" && (pm === "both" || pm === "x-only")) {
              const newZoomX = Math.max(
                MIN_ZOOM,
                Math.min(MAX_ZOOM, pinchStartZoomX * scale),
              );
              const fx =
                chart.view.panX + currentPinchCenterX / chart.view.zoomX;
              chart.view.zoomX = newZoomX;
              chart.view.panX = fx - currentPinchCenterX / newZoomX;
            }
            if (pm !== "none" && (pm === "both" || pm === "y-only")) {
              const newZoomY = Math.max(
                MIN_ZOOM,
                Math.min(MAX_ZOOM, pinchStartZoomY * scale),
              );
              const fy =
                chart.view.panY + currentPinchCenterY / chart.view.zoomY;
              chart.view.zoomY = newZoomY;
              chart.view.panY = fy - currentPinchCenterY / newZoomY;
            }

            sendView();
          }
        },
        { passive: false, signal: ac.signal },
      );

      const endPointer = (e: PointerEvent) => {
        pointers = pointers.filter((p) => p.pointerId !== e.pointerId);
        try {
          el.releasePointerCapture(e.pointerId);
        } catch (err) {}

        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }

        if (pointers.length === 0) {
          const totalDist = Math.hypot(e.clientX - startX, e.clientY - startY);
          const isTap = totalDist < TAP_THRESHOLD && gestureState !== "pan";

          // If it was NOT a tap, stamp the exact time the drag ended.
          if (!isTap) {
            chart.lastDragEndTime = Date.now();
          }

          if (isTap) {
            const now = Date.now();
            if (now - lastTapTime < 300) {
              mgr.resetView(chart.id);
              lastTapTime = 0;
            } else {
              lastTapTime = now;
            }
          }

          gestureState = "none";
          chart.dragging = false;
          axisMode = null;
          el.style.cursor = e.pointerType === "touch" ? "" : hoverCursor(e);
        } else if (pointers.length === 1) {
          // Went from 2 pointers back to 1
          gestureState = "detecting";
          startX = pointers[0].clientX;
          startY = pointers[0].clientY;
          lastX = pointers[0].clientX;
          lastY = pointers[0].clientY;
          chart.dragging = true;
        }
      };

      el.addEventListener("pointerup", endPointer, { signal: ac.signal });
      el.addEventListener("pointercancel", endPointer, { signal: ac.signal });
      el.addEventListener(
        "pointerleave",
        () => {
          if (pointers.length === 0) el.style.cursor = "";
        },
        { signal: ac.signal },
      );

      let wheelTimeout: ReturnType<typeof setTimeout> | null = null;

      el.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();

          const rect = el.getBoundingClientRect();
          const localX = e.clientX - rect.left;
          const localY = e.clientY - rect.top;
          const mx = localX / rect.width;
          const my = 1 - localY / rect.height;
          const scale = 1 - e.deltaY * 0.002;

          const margin = chartMargin(chart);
          const overYAxis =
            localX < margin.left || (hasRightAxes(chart) && localX > rect.width - margin.right);
          const overXAxis = localY > rect.height - margin.bottom;

          let zoomX: boolean;
          let zoomY: boolean;

          if (overYAxis) {
            zoomX = false;
            zoomY = true;
          } else if (overXAxis) {
            zoomX = true;
            zoomY = false;
          } else {
            const wm = mode();
            zoomX = wm === "both" || wm === "x-only";
            zoomY = wm === "both" || wm === "y-only";
          }

          if (zoomX) {
            const fx = chart.view.panX + mx / chart.view.zoomX;
            chart.view.zoomX = Math.max(
              MIN_ZOOM,
              Math.min(MAX_ZOOM, chart.view.zoomX * scale),
            );
            chart.view.panX = fx - mx / chart.view.zoomX;
          }

          if (zoomY) {
            const fy = chart.view.panY + my / chart.view.zoomY;
            chart.view.zoomY = Math.max(
              MIN_ZOOM,
              Math.min(MAX_ZOOM, chart.view.zoomY * scale),
            );
            chart.view.panY = fy - my / chart.view.zoomY;
          }

          // A wheel step counts as dragging for a moment, so the hover layer stays quiet.
          chart.dragging = true;
          if (wheelTimeout) clearTimeout(wheelTimeout);
          wheelTimeout = setTimeout(() => {
            chart.dragging = false;
          }, 150);

          if (zoomX || zoomY) sendView();
        },
        { passive: false, signal: ac.signal },
      );
    },

    resetView(chart) {},

    uninstall(chart) {
      const s = state.get(chart);
      if (s) {
        s.el.style.touchAction = s.originalTouchAction;
        s.el.style.userSelect = s.originalUserSelect;
        (s.el.style as any).webkitUserSelect = s.originalWebkitUserSelect;
        s.abort.abort();
        state.delete(chart);
      }
    },
  };
}
