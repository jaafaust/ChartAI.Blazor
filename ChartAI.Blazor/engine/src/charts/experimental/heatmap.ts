import type { RendererPlugin } from "../../types.ts";
import { HEATMAP_RENDER_SHADER } from "../../shaders/experimental/heatmap.ts";

export interface HeatmapConfig {
  gridColumns: number;
  gridRows: number;
  colorScale?: 0 | 1 | 2 | 3 | "viridis" | "plasma" | "cool" | "warm";
}

declare module "../../types.ts" {
  interface ChartTypeRegistry {
    heatmap: HeatmapConfig;
  }
}

export const HeatmapChart: RendererPlugin = {
  name: "heatmap",
  shaders: {
    render: HEATMAP_RENDER_SHADER,
  },
  // Order matters: it is the field order of HeatmapUniforms in shaders/experimental/heatmap.ts.
  uniforms: [
    { name: "gridColumns", type: "u32", default: 1 },
    { name: "gridRows", type: "u32", default: 1 },
    // A colour scale may be given by name; ChartManager maps it through `values`.
    { name: "colorScale", type: "u32", default: 0, values: { viridis: 0, plasma: 1, cool: 2, warm: 3 } },
  ],
  passes: [
    {
      // One quad (6 vertices) per cell.
      type: "render",
      shader: "render",
      topology: "triangle-list",
      loadOp: "load",
      perSeries: true,
      draw: ({ samples }) => Math.max(0, samples * 6),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "x-data" },
        { binding: 2, source: "y-data" },
        { binding: 3, source: "series-info" },
        { binding: 4, source: "series-index" },
        { binding: 5, source: "custom-uniforms" },
        { binding: 6, source: "value-data" },
      ],
    },
  ],
  computeBounds(series) {
    let maxCol = 0;
    let maxRow = 0;
    for (const s of series) {
      for (const x of s.rawX) if (x > maxCol) maxCol = x;
      for (const y of s.rawY) if (y > maxRow) maxRow = y;
    }
    return { minX: -0.5, maxX: maxCol + 0.5, minY: -0.5, maxY: maxRow + 0.5 };
  },
};
