import { UNIFORM_STRUCT } from "../shared.ts";

// One quad per cell (6 vertices, triangle-list), drawn by the rasterizer: a cell costs the same
// however far the view is zoomed in, where filling it texel by texel in one invocation did not.
// Each cell is one data unit wide and tall, centred on its (x, y) = (column, row).
export const HEATMAP_RENDER_SHADER = `${UNIFORM_STRUCT}
struct HeatmapUniforms {
  gridColumns: u32,
  gridRows: u32,
  colorScale: u32,
  _p0: u32,
};
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> dataX: array<f32>;
@group(0) @binding(2) var<storage, read> dataY: array<f32>;
@group(0) @binding(3) var<storage, read> allSeries: array<SeriesInfo>;
@group(0) @binding(4) var<uniform> seriesIdx: SeriesIndex;
@group(0) @binding(5) var<uniform> hu: HeatmapUniforms;
@group(0) @binding(6) var<storage, read> dataValue: array<f32>;
fn viridis(t: f32) -> vec3f {
  let c0 = vec3f(0.267, 0.005, 0.329);
  let c1 = vec3f(0.229, 0.322, 0.545);
  let c2 = vec3f(0.128, 0.566, 0.551);
  let c3 = vec3f(0.370, 0.789, 0.383);
  let c4 = vec3f(0.993, 0.906, 0.144);
  let s = clamp(t, 0.0, 1.0) * 4.0;
  let i = u32(s);
  let f = s - f32(i);
  if (i == 0u) { return mix(c0, c1, f); }
  if (i == 1u) { return mix(c1, c2, f); }
  if (i == 2u) { return mix(c2, c3, f); }
  return mix(c3, c4, clamp(f, 0.0, 1.0));
}
fn plasma(t: f32) -> vec3f {
  let c0 = vec3f(0.050, 0.030, 0.528);
  let c1 = vec3f(0.558, 0.003, 0.667);
  let c2 = vec3f(0.879, 0.176, 0.334);
  let c3 = vec3f(0.980, 0.534, 0.125);
  let c4 = vec3f(0.940, 0.975, 0.131);
  let s = clamp(t, 0.0, 1.0) * 4.0;
  let i = u32(s);
  let f = s - f32(i);
  if (i == 0u) { return mix(c0, c1, f); }
  if (i == 1u) { return mix(c1, c2, f); }
  if (i == 2u) { return mix(c2, c3, f); }
  return mix(c3, c4, clamp(f, 0.0, 1.0));
}
fn applyColorScale(t: f32, scale: u32) -> vec3f {
  let tc = clamp(t, 0.0, 1.0);
  if (scale == 1u) { return plasma(tc); }
  if (scale == 2u) { return mix(vec3f(0.0, 1.0, 1.0), vec3f(1.0, 0.0, 1.0), tc); }
  if (scale == 3u) { return mix(vec3f(1.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), tc); }
  return viridis(tc);
}
struct VertexOutput {
  @builtin(position) pos: vec4f,
  @location(0) @interpolate(flat) color: vec3f,
};
@vertex fn vs(@builtin(vertex_index) vi: u32) -> VertexOutput {
  var out: VertexOutput;
  out.pos = vec4f(0.0, 0.0, 0.0, 0.0);
  out.color = vec3f(0.0);
  // This series' cells: [visibleRange.x, visibleRange.x + visibleRange.y) of its buffers.
  let range = allSeries[seriesIdx.index].visibleRange;
  let cell = vi / 6u;
  if (cell >= range.y) { return out; }
  let idx = range.x + cell;
  let col = dataX[idx];
  let row = dataY[idx];
  let t = dataValue[idx];
  // A gap (-3e38, GPU_GAP in chart-library.ts; a missing sorted x is +3e38) in any channel
  // draws no cell.
  if (abs(col) > 1.0e38 || row < -1.0e38 || t < -1.0e38) { return out; }
  let rangeX = u.viewMaxX - u.viewMinX;
  let rangeY = u.viewMaxY - u.viewMinY;
  if (rangeX <= 0.0 || rangeY <= 0.0) { return out; }
  var corners = array<vec2f, 6>(
    vec2f(-0.5, -0.5), vec2f(0.5, -0.5), vec2f(-0.5, 0.5),
    vec2f(-0.5, 0.5), vec2f(0.5, -0.5), vec2f(0.5, 0.5)
  );
  let c = corners[vi % 6u];
  let normX = (col + c.x - u.viewMinX) / rangeX;
  let normY = (row + c.y - u.viewMinY) / rangeY;
  out.pos = vec4f(normX * 2.0 - 1.0, normY * 2.0 - 1.0, 0.0, 1.0);
  out.color = applyColorScale(t, hu.colorScale);
  return out;
}
@fragment fn fs(in: VertexOutput) -> @location(0) vec4f {
  return vec4f(in.color, 1.0);
}
`;
