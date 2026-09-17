import type { ChartPlugin, InternalChart } from "../../types.ts";
import { ChartManager } from "../../chart-library.ts";
import { chartMargin } from "../shared.ts";
import { DEFAULT_FONT } from "../labels.ts";
import { dataToScreen } from "../coords.ts";

export type AnnotationType = "hline" | "vline" | "hregion" | "vregion";

export interface Annotation {
  type: AnnotationType;
  value: number;
  value2?: number;
  label?: string;
  color?: string;
  dash?: [number, number];
  lineWidth?: number;
  // Reported with chartai-annotation-click / onAnnotationClick.
  id?: string | number;
  // vline only: where its label sits, in the bottom margin (default) or just inside the top.
  labelPosition?: "top" | "bottom";
}

export interface AnnotationsConfig {
  annotations?: Annotation[];
  fontFamily?: string;
  onAnnotationClick?: (annotation: Annotation) => void;
}

declare module "../../types.ts" {
  interface ChartPluginRegistry {
    annotations: AnnotationsConfig;
  }
}

const DEFAULT_COLOR = "rgba(100,100,200,0.8)";
const PILL_HEIGHT = 18;
const PILL_PADDING = 12;
const LANE_GAP = 3;

interface PillBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

function pillWidth(ctx: CanvasRenderingContext2D, txt: string, fontFamily: string): number {
  ctx.font = `600 10px ${fontFamily}`;
  return ctx.measureText(txt).width + PILL_PADDING;
}

function drawPill(
  ctx: CanvasRenderingContext2D,
  txt: string,
  cx: number,
  cy: number,
  color: string,
  dark: boolean,
  fontFamily: string,
): PillBox {
  const pw = pillWidth(ctx, txt, fontFamily);
  const ph = PILL_HEIGHT;
  const px = cx - pw / 2;
  const py = cy - ph / 2;
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 4);
  ctx.fillStyle = dark ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.9)";
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(txt, cx, cy);
  return { x: px, y: py, w: pw, h: ph };
}

// The label pills as last drawn, per chart, so a click can be matched to its annotation.
const pillBoxes = new WeakMap<InternalChart, (PillBox & { ann: Annotation })[]>();
const pointerStates = new WeakMap<
  InternalChart,
  { abort: AbortController; downX: number; downY: number }
>();

function pillAt(chart: InternalChart, x: number, y: number): Annotation | null {
  const boxes = pillBoxes.get(chart);
  if (!boxes) return null;
  for (let i = boxes.length - 1; i >= 0; i--) {
    const b = boxes[i];
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.ann;
  }
  return null;
}

interface VLabel {
  ann: Annotation;
  cx: number;
  pw: number;
  color: string;
  lane: number;
}

// Vertical-line labels take lanes: a pill that would overlap the previous one in its lane
// drops to the next lane, so events seconds apart on a wide window stay readable.
function assignLanes(items: VLabel[]): void {
  items.sort((a, b) => a.cx - b.cx);
  const laneEnd: number[] = [];
  for (const it of items) {
    const left = it.cx - it.pw / 2;
    let lane = 0;
    while (lane < laneEnd.length && left < laneEnd[lane] + 4) lane++;
    laneEnd[lane] = it.cx + it.pw / 2;
    it.lane = lane;
  }
}

export const annotationsPlugin: ChartPlugin<AnnotationsConfig> = {
  name: "annotations",

  // Labels are clickable. A click on a pill calls config.onAnnotationClick with the annotation
  // and dispatches "chartai-annotation-click" (detail: { id, annotation }) from the host, and
  // stops there: it reaches neither the zoom plugin nor the host's own click handlers. The
  // handlers sit on the host rather than the interaction layer, which puts them after the zoom
  // plugin's, so the pointer cursor set here outlives the cursor that plugin sets on every move.
  install(chart, el) {
    const ac = new AbortController();
    const st = { abort: ac, downX: 0, downY: 0 };
    pointerStates.set(chart, st);
    const host = chart.el;
    const local = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    host.addEventListener(
      "pointerdown",
      (e) => {
        st.downX = e.clientX;
        st.downY = e.clientY;
      },
      { signal: ac.signal },
    );
    host.addEventListener(
      "pointermove",
      (e) => {
        if (chart.dragging) return;
        const { x, y } = local(e);
        if (pillAt(chart, x, y)) el.style.cursor = "pointer";
      },
      { signal: ac.signal },
    );
    host.addEventListener(
      "click",
      (e) => {
        // A drag that ends on a pill is not a click on it.
        if (Math.hypot(e.clientX - st.downX, e.clientY - st.downY) > 4) return;
        const { x, y } = local(e);
        const ann = pillAt(chart, x, y);
        if (!ann) return;
        e.stopPropagation();
        chart.config.onAnnotationClick?.(ann);
        host.dispatchEvent(
          new CustomEvent("chartai-annotation-click", {
            detail: { id: ann.id ?? null, annotation: ann },
            bubbles: true,
            composed: true,
          }),
        );
      },
      { signal: ac.signal },
    );
  },

  uninstall(chart) {
    pointerStates.get(chart)?.abort.abort();
    pointerStates.delete(chart);
    pillBoxes.delete(chart);
  },

  beforeDraw(ctx, chart) {
    const annotations: Annotation[] = chart.config.annotations ?? [];
    const { width: w, height: h } = chart;
    const m = chartMargin(chart);
    const dark = ChartManager.isDark;
    const fontFamily: string = chart.config.fontFamily ?? DEFAULT_FONT;

    const regions = annotations.filter(
      (a) => a.type === "hregion" || a.type === "vregion",
    );
    if (regions.length === 0) return;

    ctx.save();

    // Pass 1: clipped — draw region fills
    ctx.save();
    ctx.beginPath();
    ctx.rect(m.left, m.top, w - m.left - m.right, h - m.top - m.bottom);
    ctx.clip();

    for (const ann of regions) {
      const color =
        ann.color ?? (dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)");
      const { y: sy1 } = dataToScreen(0, ann.value, chart, w, h);
      const { x: sx1 } = dataToScreen(ann.value, 0, chart, w, h);
      const v2 = ann.value2 ?? ann.value;
      const { y: sy2 } = dataToScreen(0, v2, chart, w, h);
      const { x: sx2 } = dataToScreen(v2, 0, chart, w, h);

      ctx.fillStyle = color;
      if (ann.type === "hregion") {
        const top = Math.min(sy1, sy2);
        const bottom = Math.max(sy1, sy2);
        ctx.fillRect(m.left, top, w - m.left - m.right, bottom - top);
      } else {
        const left = Math.min(sx1, sx2);
        const right = Math.max(sx1, sx2);
        ctx.fillRect(left, m.top, right - left, h - m.top - m.bottom);
      }
    }

    ctx.restore();

    // Pass 2: unclipped — draw region labels
    for (const ann of regions) {
      if (!ann.label) continue;
      const color =
        ann.color ?? (dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)");
      const { y: sy1 } = dataToScreen(0, ann.value, chart, w, h);
      const { x: sx1 } = dataToScreen(ann.value, 0, chart, w, h);
      const v2 = ann.value2 ?? ann.value;
      const { y: sy2 } = dataToScreen(0, v2, chart, w, h);
      const { x: sx2 } = dataToScreen(v2, 0, chart, w, h);

      if (ann.type === "hregion") {
        // Right edge, vertically centered between sy1 and sy2
        const cy = (sy1 + sy2) / 2;
        if (cy < m.top - 9 || cy > h - m.bottom + 9) continue;
        const pw = pillWidth(ctx, ann.label, fontFamily);
        const cx = w - m.right - pw / 2 - 4;
        drawPill(ctx, ann.label, cx, cy, color, dark, fontFamily);
      } else {
        // Bottom margin, horizontally centered between sx1 and sx2
        const pw = pillWidth(ctx, ann.label, fontFamily);
        const cx = (sx1 + sx2) / 2;
        if (cx < m.left - (pw / 2 + 2) || cx > w - m.right + (pw / 2 + 2)) continue;
        const cy = h - m.bottom / 2;
        drawPill(ctx, ann.label, cx, cy, color, dark, fontFamily);
      }
    }

    ctx.restore();
  },

  afterDraw(ctx, chart) {
    const annotations: Annotation[] = chart.config.annotations ?? [];
    const { width: w, height: h } = chart;
    const m = chartMargin(chart);
    const dark = ChartManager.isDark;
    const fontFamily: string = chart.config.fontFamily ?? DEFAULT_FONT;

    const lines = annotations.filter(
      (a) => a.type === "hline" || a.type === "vline",
    );
    const boxes: (PillBox & { ann: Annotation })[] = [];
    pillBoxes.set(chart, boxes);
    if (lines.length === 0) return;

    ctx.save();

    // Pass 1: clipped — draw lines
    ctx.save();
    ctx.beginPath();
    ctx.rect(m.left, m.top, w - m.left - m.right, h - m.top - m.bottom);
    ctx.clip();

    for (const ann of lines) {
      const color = ann.color ?? DEFAULT_COLOR;
      ctx.strokeStyle = color;
      ctx.lineWidth = ann.lineWidth ?? 1.5;
      ctx.setLineDash(ann.dash ?? []);
      ctx.beginPath();

      if (ann.type === "hline") {
        const { y: sy } = dataToScreen(0, ann.value, chart, w, h);
        ctx.moveTo(m.left, sy);
        ctx.lineTo(w - m.right, sy);
      } else {
        const { x: sx } = dataToScreen(ann.value, 0, chart, w, h);
        ctx.moveTo(sx, m.top);
        ctx.lineTo(sx, h - m.bottom);
      }

      ctx.stroke();
    }

    ctx.restore();

    // Pass 2: unclipped — draw line labels
    const vlabels: VLabel[] = [];
    for (const ann of lines) {
      if (!ann.label) continue;
      const color = ann.color ?? DEFAULT_COLOR;

      if (ann.type === "hline") {
        const { y: sy } = dataToScreen(0, ann.value, chart, w, h);
        if (sy < m.top - 9 || sy > h - m.bottom + 9) continue;
        // Pill inside right margin, centered on the line
        const pw = pillWidth(ctx, ann.label, fontFamily);
        const cx = w - m.right - pw / 2 - 4;
        boxes.push({ ...drawPill(ctx, ann.label, cx, sy, color, dark, fontFamily), ann });
      } else {
        const { x: sx } = dataToScreen(ann.value, 0, chart, w, h);
        const pw = pillWidth(ctx, ann.label, fontFamily);
        if (sx < m.left - (pw / 2 + 2) || sx > w - m.right + (pw / 2 + 2)) continue;
        vlabels.push({ ann, cx: sx, pw, color, lane: 0 });
      }
    }
    // A vertical line's label sits in the bottom margin, or, with labelPosition "top", just
    // inside the top of the plot where the x-axis labels cannot collide with it. Lanes stack
    // away from that edge.
    assignLanes(vlabels);
    for (const it of vlabels) {
      const step = PILL_HEIGHT + LANE_GAP;
      const cy =
        it.ann.labelPosition === "top"
          ? m.top + 4 + PILL_HEIGHT / 2 + it.lane * step
          : h - m.bottom / 2 - it.lane * step;
      boxes.push({ ...drawPill(ctx, it.ann.label!, it.cx, cy, it.color, dark, fontFamily), ann: it.ann });
    }

    ctx.restore();
  },
};
