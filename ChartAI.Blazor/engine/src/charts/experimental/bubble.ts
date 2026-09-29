import type { RendererPlugin } from "../../types.ts";
import { dispatch2D } from "../../shaders/shared.ts";
import { BUBBLE_COMPUTE_SHADER } from "../../shaders/experimental/bubble.ts";

export interface BubbleConfig {
  maxPointSize?: number;
  minPointSize?: number;
}

declare module "../../types.ts" {
  interface ChartTypeRegistry {
    bubble: BubbleConfig;
  }
}

export const BubbleChart: RendererPlugin = {
  name: "bubble",
  shaders: {
    compute: BUBBLE_COMPUTE_SHADER,
  },
  // Order matters: it is the field order of BubbleUniforms in shaders/experimental/bubble.ts.
  uniforms: [
    { name: "maxPointSize", type: "f32", default: 40 },
    { name: "minPointSize", type: "f32", default: 2 },
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
        { binding: 7, source: "r-data" },
      ],
    },
  ],
};
