import type { RendererPlugin } from "../../types.ts";
import { COMPUTE_WG } from "../../shaders/shared.ts";
import { OHLC_COMPUTE_SHADER, OHLC_RENDER_SHADER } from "../../shaders/experimental/ohlc.ts";
import { packRGB, CandlestickChart } from "../candlestick.ts";

export type { CandlestickConfig as OhlcConfig } from "../candlestick.ts";

declare module "../../types.ts" {
  interface ChartTypeRegistry {
    ohlc: import("../candlestick.ts").CandlestickConfig;
  }
}

// 7 f32 per CandleData struct
const BYTES_PER_CANDLE = 7 * 4;

export const OhlcChart: RendererPlugin = {
  name: "ohlc",
  shaders: {
    compute: OHLC_COMPUTE_SHADER,
    render: OHLC_RENDER_SHADER,
  },
  uniforms: [
    { name: "maxSamples", type: "f32", default: 10000 },
    { name: "upColor",    type: "u32", default: packRGB(0.2, 0.7, 0.3) },
    { name: "downColor",  type: "u32", default: packRGB(0.9, 0.3, 0.3) },
    { name: "binSize",    type: "u32", default: 8 },
    { name: "interval",   type: "f32", default: 0 },
  ],
  buffers: [
    {
      name: "candleBuffer",
      bytes: ({ width }) => Math.max(16, width * BYTES_PER_CANDLE),
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
        { binding: 3, source: "candleBuffer", write: true },
        { binding: 4, source: "series-info" },
        { binding: 5, source: "series-index" },
        { binding: 6, source: "custom-uniforms" },
        { binding: 7, source: "open-data" },
        { binding: 8, source: "high-data" },
        { binding: 9, source: "low-data" },
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
      // 3 sections × 6 vertices = 18 per column
      draw: ({ width }) => width * 18,
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "candleBuffer" },
        { binding: 2, source: "custom-uniforms" },
      ],
    },
  ],

  // Same data as a candlestick chart, so the same bounds.
  computeBounds: CandlestickChart.computeBounds,
};
