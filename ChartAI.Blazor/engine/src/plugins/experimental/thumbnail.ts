import type { InternalChart } from "../../types.ts";
import { hiddenKey, sameKey } from "../shared.ts";

// The minimap and the range selector draw every series in miniature. That picture changes only
// with the data (or the size), not with the view or the hover, so it is rendered once into a
// canvas of its own and each draw copies it (drawImage) instead of stroking every series again.
export interface Thumbnail {
  canvas: HTMLCanvasElement | null;
  key: unknown[] | null;
}

export const newThumbnail = (): Thumbnail => ({ canvas: null, key: null });

// The series of `chart` drawn into a w x h (CSS px) canvas at `dpr`, inset by `pad`: from the
// cache when nothing it shows has changed. Hidden series are left out. Null without a 2D context.
export function seriesThumbnail(
  thumb: Thumbnail,
  chart: InternalChart<any>,
  w: number,
  h: number,
  pad: number,
  dpr: number,
): HTMLCanvasElement | null {
  const b = chart.bounds;
  const key: unknown[] = [chart.series, hiddenKey(chart), b.minX, b.maxX, b.minY, b.maxY, w, h, pad, dpr];
  for (const s of chart.series) key.push(s.rawX, s.plotY ?? s.rawY, s.rawX.length);
  if (thumb.canvas && sameKey(thumb.key, key)) return thumb.canvas;

  const canvas = thumb.canvas ?? document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(h * dpr));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const rangeX = b.maxX - b.minX || 1;
  const rangeY = b.maxY - b.minY || 1;
  const iw = w - 2 * pad,
    ih = h - 2 * pad;
  const hidden = chart.config.hiddenSeries as Set<number> | undefined;
  ctx.lineWidth = 1;
  chart.series.forEach((series, si) => {
    const n = series.rawX.length;
    if (n === 0 || hidden?.has(si)) return;
    const { r, g, b: bv } = series.color;
    ctx.strokeStyle = `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(bv * 255)},0.7)`;
    ctx.beginPath();
    const step = Math.max(1, Math.floor(n / w));
    const plotY = series.plotY ?? series.rawY;
    // A gap breaks the line, as it does in the chart.
    let pen = false;
    for (let i = 0; i < n; i += step) {
      const x = series.rawX[i],
        y = plotY[i];
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        pen = false;
        continue;
      }
      const px = pad + ((x - b.minX) / rangeX) * iw;
      const py = pad + (1 - (y - b.minY) / rangeY) * ih;
      if (pen) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
      pen = true;
    }
    ctx.stroke();
  });

  thumb.canvas = canvas;
  thumb.key = key;
  return canvas;
}
