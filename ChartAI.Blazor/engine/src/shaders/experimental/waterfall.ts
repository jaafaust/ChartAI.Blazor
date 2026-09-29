import { UNIFORM_STRUCT } from "../shared.ts";

const WATERFALL_TYPES = `
struct WaterfallUniforms {
  upColor:    u32,
  downColor:  u32,
  totalColor: u32,
  _pad:       u32,
};`;

// Render-only shader: reads precomputed bar geometry from CPU-uploaded data arrays.
// x-data: bar center X (data space)
// y-data: bar bottom Y (data space, precomputed cumulative sum)
// h-data: bar height (absolute, in data units)
// t-data: bar type (0=up, 1=down, 2=total)
// bw-data: bar width (in data units, from X spacing)
export const WATERFALL_RENDER_SHADER = `${UNIFORM_STRUCT}
${WATERFALL_TYPES}
@group(0) @binding(0) var<uniform>       u:      Uniforms;
@group(0) @binding(1) var<storage, read> dataX:  array<f32>;
@group(0) @binding(2) var<storage, read> dataY:  array<f32>;
@group(0) @binding(3) var<uniform>       wu:     WaterfallUniforms;
@group(0) @binding(4) var<storage, read> dataH:  array<f32>;
@group(0) @binding(5) var<storage, read> dataT:  array<f32>;
@group(0) @binding(6) var<storage, read> dataBW: array<f32>;
@group(0) @binding(7) var<storage, read> allSeries: array<SeriesInfo>;
struct VertexOutput {
@builtin(position) pos: vec4f,
@location(0) @interpolate(flat) colorType: f32,
};
// The worker draws series i as instance i: its bars are [visibleRange.x, visibleRange.x + visibleRange.y).
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) series_idx: u32) -> VertexOutput {
var out: VertexOutput;
let range      = allSeries[series_idx].visibleRange;
let bar        = vi / 6u;
let vertexType = vi % 6u;
if (bar >= range.y) {
  out.pos = vec4f(0.0, 0.0, 0.0, 1.0); out.colorType = 0.0; return out;
}
let barIdx     = range.x + bar;
let x          = dataX[barIdx];
let barBottom  = dataY[barIdx];
let barHeight  = max(dataH[barIdx], 0.0);
let barTop     = barBottom + barHeight;
let barWidth   = dataBW[barIdx];
// A gap (-3e38, GPU_GAP in chart-library.ts; a missing sorted x is +3e38) in position, base
// or width draws no bar.
if (abs(x) > 1.0e38 || barBottom < -1.0e38 || barWidth < -1.0e38) {
  out.pos = vec4f(0.0, 0.0, 0.0, 1.0); out.colorType = 0.0; return out;
}
let viewRangeX = u.viewMaxX - u.viewMinX;
let viewRangeY = u.viewMaxY - u.viewMinY;
let safeRangeX = select(viewRangeX, 1.0, viewRangeX <= 0.0);
let safeRangeY = select(viewRangeY, 1.0, viewRangeY <= 0.0);
let screenX    = (x - u.viewMinX) / safeRangeX;
let halfW      = (barWidth * 0.5) / safeRangeX;
let left       = screenX - halfW;
let right      = screenX + halfW;
let normBottom = (barBottom - u.viewMinY) / safeRangeY;
let normTop    = (barTop    - u.viewMinY) / safeRangeY;
let sBottom    = max(1.0 - normBottom, 1.0 - normTop);
let sTop       = min(1.0 - normBottom, 1.0 - normTop);
var positions  = array<vec2f, 6>(
  vec2f(left,  sBottom),
  vec2f(right, sBottom),
  vec2f(left,  sTop),
  vec2f(left,  sTop),
  vec2f(right, sBottom),
  vec2f(right, sTop)
);
let sp = positions[vertexType];
out.pos       = vec4f(sp.x * 2.0 - 1.0, 1.0 - sp.y * 2.0, 0.0, 1.0);
out.colorType = dataT[barIdx];
return out;
}
@fragment fn fs(in: VertexOutput) -> @location(0) vec4f {
let upRgb    = unpack4x8unorm(wu.upColor).rgb;
let downRgb  = unpack4x8unorm(wu.downColor).rgb;
let totalRgb = unpack4x8unorm(wu.totalColor).rgb;
var color: vec3f;
if (in.colorType < 0.5) {
  color = upRgb;
} else if (in.colorType < 1.5) {
  color = downRgb;
} else {
  color = totalRgb;
}
return vec4f(color, 0.9);
}
`;
