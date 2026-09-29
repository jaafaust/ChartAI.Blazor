import type { ChartPlugin, InternalChart, ZoomMode } from "../types.ts";
import { ChartManager } from "../chart-library.ts";
import { chartMargin, floatZoomLimit, hasRightAxes } from "./shared.ts";
import { commitView } from "./redraw.ts";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10_000_000;

// The zoom an axis may go to from `current`: MIN_ZOOM..MAX_ZOOM, and no deeper than keeps the
// visible span well above the float64 spacing of the values in view (floatZoomLimit), which
// the tick labels and the hover maths need. Zooming out of a view that is already deeper, after
// the data changed, stays possible.
function limitZoom(next: number, current: number, lo: number, hi: number, anchor: number): number {
  const cap = Math.min(MAX_ZOOM, floatZoomLimit(lo, hi, anchor));
  if (next > cap) next = Math.max(cap, Math.min(current, next));
  return Math.max(MIN_ZOOM, next);
}

// The touch gestures the page keeps: all of them with zoomMode "none", so a page of static charts
// scrolls under a finger, and the pan along the axis the chart does not move with "x-only" and
// "y-only". On touch the axis gutters then lose that direction; with a mouse they still pan.
function touchActionFor(mode: ZoomMode, original: string): string {
  if (mode === "none") return original;
  if (mode === "x-only") return "pan-y";
  if (mode === "y-only") return "pan-x";
  return "none";
}

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
// `chart.lastDragEndTime`, the axis gutters pan their axis one-to-one, the cursor shows what a
// drag would do, and zoomMode "none" leaves the wheel and touch scrolling over the plot to the
// page. Every view change goes through ChartManager.commitView.
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
    // The touch-action last applied, so a draw writes the style only when zoomMode changed.
    touchAction: string;
  }

  const state = new WeakMap<InternalChart, ZoomState>();

  return {
    name: "zoom",

    install(chart, el) {
      const originalTouchAction = el.style.touchAction;
      const originalUserSelect = el.style.userSelect;
      const originalWebkitUserSelect = (el.style as any).webkitUserSelect;
      const touchAction = touchActionFor(chart.config.zoomMode ?? "both", originalTouchAction);
      el.style.touchAction = touchAction;
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
        touchAction,
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

      const sendView = () => commitView(chart);

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
            if (e.pointerType !== "touch") {
              // Written only on a change: a style write per move makes the next layout read
              // (every hover handler's getBoundingClientRect) recompute styles.
              const cursor = hoverCursor(e);
              if (el.style.cursor !== cursor) el.style.cursor = cursor;
            }
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
              const panX = m === "both" || m === "x-only";
              const panY = m === "both" || m === "y-only";
              if (panX) chart.view.panX -= dx / chart.view.zoomX;
              if (panY) chart.view.panY += dy / chart.view.zoomY;

              lastX = e.clientX;
              lastY = e.clientY;
              // zoomMode "none" leaves the view alone, so there is nothing to commit.
              if (panX || panY) sendView();
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
            const b = chart.bounds;
            const pinchX = pm === "both" || pm === "x-only";
            const pinchY = pm === "both" || pm === "y-only";
            if (pinchX) {
              const fx =
                chart.view.panX + currentPinchCenterX / chart.view.zoomX;
              const newZoomX = limitZoom(
                pinchStartZoomX * scale,
                chart.view.zoomX,
                b.minX,
                b.maxX,
                b.minX + fx * (b.maxX - b.minX),
              );
              chart.view.zoomX = newZoomX;
              chart.view.panX = fx - currentPinchCenterX / newZoomX;
            }
            if (pinchY) {
              const fy =
                chart.view.panY + currentPinchCenterY / chart.view.zoomY;
              const newZoomY = limitZoom(
                pinchStartZoomY * scale,
                chart.view.zoomY,
                b.minY,
                b.maxY,
                b.minY + fy * (b.maxY - b.minY),
              );
              chart.view.zoomY = newZoomY;
              chart.view.panY = fy - currentPinchCenterY / newZoomY;
            }

            if (pinchX || pinchY) sendView();
          }
        },
        { passive: false, signal: ac.signal },
      );

      const endPointer = (e: PointerEvent) => {
        // A press another plugin claimed (a legend row, the minimap) was never tracked here;
        // its release must not count as a tap (a double tap resets the view) or a drag.
        if (!pointers.some((p) => p.pointerId === e.pointerId)) return;
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

          // zoomMode "none" over the plot: the wheel is the page's, so it scrolls.
          if (!zoomX && !zoomY) return;
          e.preventDefault();

          const b = chart.bounds;
          if (zoomX) {
            const fx = chart.view.panX + mx / chart.view.zoomX;
            chart.view.zoomX = limitZoom(
              chart.view.zoomX * scale,
              chart.view.zoomX,
              b.minX,
              b.maxX,
              b.minX + fx * (b.maxX - b.minX),
            );
            chart.view.panX = fx - mx / chart.view.zoomX;
          }

          if (zoomY) {
            const fy = chart.view.panY + my / chart.view.zoomY;
            chart.view.zoomY = limitZoom(
              chart.view.zoomY * scale,
              chart.view.zoomY,
              b.minY,
              b.maxY,
              b.minY + fy * (b.maxY - b.minY),
            );
            chart.view.panY = fy - my / chart.view.zoomY;
          }

          // A wheel step counts as dragging for a moment, so the hover layer stays quiet.
          chart.dragging = true;
          if (wheelTimeout) clearTimeout(wheelTimeout);
          wheelTimeout = setTimeout(() => {
            chart.dragging = false;
          }, 150);

          sendView();
        },
        { passive: false, signal: ac.signal },
      );
    },

    resetView(chart) {},

    // configure() redraws the chart, so a changed zoomMode reaches touch-action here.
    afterDraw(_, chart) {
      const s = state.get(chart);
      if (!s) return;
      const ta = touchActionFor(chart.config.zoomMode ?? "both", s.originalTouchAction);
      if (ta !== s.touchAction) s.el.style.touchAction = s.touchAction = ta;
    },

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
