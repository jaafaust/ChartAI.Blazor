import type { RendererPlugin } from "../types.ts";
import { COMPUTE_WG } from "../shaders/shared.ts";
import { BOX_COMPUTE_SHADER, BOX_RENDER_SHADER } from "../shaders/box.ts";

export interface BarConfig {
  maxSamplesPerPixel?: number;
  // Fill opacity of the bars, 0..1 (default 1: solid).
  barOpacity?: number;
}

declare module "../types.ts" {
  interface ChartTypeRegistry {
    bar: BarConfig;
  }
}

export const BarChart: RendererPlugin = {
  name: "bar",
  shaders: {
    compute: BOX_COMPUTE_SHADER,
    render: BOX_RENDER_SHADER,
  },
  // Order matters: it is the field order of BarUniforms in shaders/box.ts.
  uniforms: [
    { name: "maxSamplesPerPixel", type: "u32", default: 10000 },
    { name: "barOpacity",         type: "f32", default: 1.0 },
  ],
  buffers: [
    {
      name: "barBuffer",
      bytes: ({ width }) => Math.max(16, width * 4 * 4),
      usages: ["STORAGE"],
    },
  ],
  passes: [
    {
      type: "compute",
      shader: "compute",
      perSeries: true,
      dispatch: ({ width }) => ({ x: Math.ceil(Math.max(1, width) / COMPUTE_WG) }),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "x-data" },
        { binding: 2, source: "y-data" },
        { binding: 3, source: "barBuffer", write: true },
        { binding: 4, source: "series-info" },
        { binding: 5, source: "series-index" },
        { binding: 6, source: "custom-uniforms" },
      ],
    },
    {
      type: "render",
      shader: "render",
      topology: "triangle-list",
      loadOp: "load",
      blend: {
        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
        alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
      },
      // 6 vertices per column (2 triangles), drawn once per series
      draw: ({ width }) => width * 6,
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "barBuffer" },
        { binding: 2, source: "series-info" },
        { binding: 3, source: "custom-uniforms" },
      ],
    },
  ],
};
