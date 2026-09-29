import { UNIFORM_STRUCT, COMPUTE_WG, SAMPLE_INDEX } from "../shared.ts";

// The bins split minValue..maxValue evenly when those are set (rebased like the data), else the
// chart's x bounds; there are binCount of them, or one per physical pixel column, at most 4096
// (the capacity of histBuffer). HistogramChart.computeBounds sizes the y axis from the same bins:
// keep histRange and histBins in step with it (charts/experimental/histogram.ts).
const HIST_UNIFORMS_STRUCT = `struct HistUniforms {
binCount: u32,
minValue: f32,
maxValue: f32,
_p0: f32,
};
fn histRange() -> vec2f {
let custom = hu.minValue < hu.maxValue;
return vec2f(select(u.dataMinX, hu.minValue, custom), select(u.dataMaxX, hu.maxValue, custom));
}
fn histBins() -> u32 {
let n = select(u32(u.width), hu.binCount, hu.binCount > 0u);
return clamp(n, 1u, 4096u);
}
`;

export const HIST_CLEAR_SHADER = `${UNIFORM_STRUCT}
${HIST_UNIFORMS_STRUCT}
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read_write> histBuffer: array<u32>;
@group(0) @binding(2) var<uniform> hu: HistUniforms;
@compute @workgroup_size(${COMPUTE_WG})
fn main(@builtin(global_invocation_id) id: vec3u) {
let idx = id.x;
if (idx < 4096u) {
histBuffer[idx] = 0u;
}
}
`;

// One invocation per sample (dispatch2D); gaps and samples outside the binned range are not counted.
export const HIST_COUNT_SHADER = `${UNIFORM_STRUCT}
${HIST_UNIFORMS_STRUCT}
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> dataX: array<f32>;
@group(0) @binding(2) var<storage, read_write> histBuffer: array<atomic<u32>>;
@group(0) @binding(3) var<uniform> hu: HistUniforms;
@group(0) @binding(4) var<storage, read> allSeries: array<SeriesInfo>;
@group(0) @binding(5) var<uniform> seriesIdx: SeriesIndex;
@compute @workgroup_size(${COMPUTE_WG})
fn main(@builtin(global_invocation_id) id: vec3u, @builtin(num_workgroups) nwg: vec3u) {
let range = allSeries[seriesIdx.index].visibleRange;
let i = ${SAMPLE_INDEX};
if (i >= range.y) {
return;
}
let x = dataX[range.x + i];
let bounds = histRange();
let minVal = bounds.x;
let maxVal = bounds.y;
let span = maxVal - minVal;
if (x < -1.0e38 || span <= 0.0 || x < minVal || x > maxVal) {
return;
}
// The last bin includes its right edge, so the largest sample of the data extent is counted.
let binCount = histBins();
let bin = min(u32((x - minVal) / span * f32(binCount)), binCount - 1u);
atomicAdd(&histBuffer[bin], 1u);
}
`;

export const HIST_FIND_MAX_SHADER = `${UNIFORM_STRUCT}
${HIST_UNIFORMS_STRUCT}
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> histBuffer: array<u32>;
@group(0) @binding(2) var<storage, read_write> maxBuffer: array<u32>;
@group(0) @binding(3) var<uniform> hu: HistUniforms;
@compute @workgroup_size(1)
fn main() {
let binCount = histBins();
var maxVal = 0u;
for (var i = 0u; i < binCount; i++) {
let v = histBuffer[i];
if (v > maxVal) {
maxVal = v;
}
}
maxBuffer[0] = maxVal;
}
`;

export const HIST_RENDER_SHADER = `${UNIFORM_STRUCT}
${HIST_UNIFORMS_STRUCT}
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> histBuffer: array<u32>;
@group(0) @binding(2) var<storage, read> maxBuffer: array<u32>;
@group(0) @binding(3) var<storage, read> allSeries: array<SeriesInfo>;
@group(0) @binding(4) var<uniform> si: SeriesIndex;
@group(0) @binding(5) var<uniform> hu: HistUniforms;
struct VertexOutput {
@builtin(position) pos: vec4f,
@location(0) alpha: f32,
@location(1) @interpolate(flat) seriesIdx: u32,
};
@vertex fn vs(@builtin(vertex_index) vi: u32) -> VertexOutput {
var out: VertexOutput;
out.seriesIdx = si.index;
let colIdx = vi / 6u;
let vertexType = vi % 6u;
let binCount = histBins();
let maxCount = maxBuffer[0];
if (colIdx >= binCount || maxCount == 0u) {
out.pos = vec4f(0.0, 0.0, 0.0, 0.0);
out.alpha = 0.0;
return out;
}
let count = histBuffer[colIdx];
if (count == 0u) {
out.pos = vec4f(0.0, 0.0, 0.0, 0.0);
out.alpha = 0.0;
return out;
}
let bounds = histRange();
let minVal = bounds.x;
let range = bounds.y - bounds.x;
let viewRangeX = u.viewMaxX - u.viewMinX;
let viewRangeY = u.viewMaxY - u.viewMinY;
let safeRangeX = select(viewRangeX, 1.0, viewRangeX <= 0.0);
let safeRangeY = select(viewRangeY, 1.0, viewRangeY <= 0.0);
let binLeft = minVal + f32(colIdx) / f32(binCount) * range;
let binRight = minVal + f32(colIdx + 1u) / f32(binCount) * range;
let screenLeft = (binLeft - u.viewMinX) / safeRangeX;
let screenRight = (binRight - u.viewMinX) / safeRangeX;
let screenBottom = 1.0 - (0.0 - u.viewMinY) / safeRangeY;
let screenTop = 1.0 - (f32(count) - u.viewMinY) / safeRangeY;
var positions = array<vec2f, 6>(
vec2f(screenLeft, screenBottom),
vec2f(screenRight, screenBottom),
vec2f(screenLeft, screenTop),
vec2f(screenLeft, screenTop),
vec2f(screenRight, screenBottom),
vec2f(screenRight, screenTop)
);
let screenPos = positions[vertexType];
out.pos = vec4f(screenPos.x * 2.0 - 1.0, 1.0 - screenPos.y * 2.0, 0.0, 1.0);
out.alpha = 1.0;
return out;
}
@fragment fn fs(in: VertexOutput) -> @location(0) vec4f {
if (in.alpha < 0.1) { discard; }
let series = allSeries[in.seriesIdx];
return vec4f(series.color.rgb, 0.85);
}
`;
