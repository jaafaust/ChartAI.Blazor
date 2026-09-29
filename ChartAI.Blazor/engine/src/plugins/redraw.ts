import type { InternalChart } from "../types.ts";
import { ChartManager } from "../chart-library.ts";

// Overlay redraws requested by the plugins' pointer handlers. Hover, crosshair and ruler each
// used to call drawChart on every mousemove, two to four full overlay redraws per event; the
// requests made before the next animation frame now collapse into one draw per chart.
const pending = new Set<InternalChart<any>>();
let frame = 0;

export function scheduleDraw(chart: InternalChart<any>): void {
  pending.add(chart);
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    const charts = [...pending];
    pending.clear();
    for (const c of charts) ChartManager.drawChart(c);
  });
}

// A plugin that moved chart.view hands it on here: ChartManager.commitView sends it to the
// worker, moves the linked charts, reports the change (onViewChange) and redraws.
export function commitView(chart: InternalChart<any>): void {
  ChartManager.commitView(chart);
}
