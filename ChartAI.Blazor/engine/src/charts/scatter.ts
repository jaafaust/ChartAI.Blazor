import type { RendererPlugin } from "../types.ts";
import { dispatch2D } from "../shaders/shared.ts";
import { SCATTER_COMPUTE_SHADER } from "../shaders/scatter.ts";

export interface ScatterConfig {
  pointSize?: number;
}

declare module "../types.ts" {
  interface ChartTypeRegistry {
    scatter: ScatterConfig;
  }
}

export const ScatterChart: RendererPlugin = {
  name: "scatter",
  shaders: {
    compute: SCATTER_COMPUTE_SHADER,
  },
  uniforms: [
    { name: "pointSize", type: "f32", default: 3 },
  ],
  passes: [
    {
      type: "compute",
      shader: "compute",
      perSeries: true,
      dispatch: ({ samples }) => dispatch2D(samples),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "x-data" },
        { binding: 2, source: "y-data" },
        { binding: 3, source: "render-target", write: true },
        { binding: 4, source: "series-info" },
        { binding: 5, source: "series-index" },
        { binding: 6, source: "custom-uniforms" },
      ],
    },
  ],
};
