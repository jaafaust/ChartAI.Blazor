import { UNIFORM_STRUCT, BINARY_SEARCH, COMPUTE_WG } from "./shared.ts";

// Layout of the bar chart's custom uniforms, in the order charts/bar.ts declares them.
const BAR_UNIFORMS = `struct BarUniforms { maxSamplesPerPixel: u32, barOpacity: f32, _p2: u32, _p3: u32 };`;

// A sample of -3e38 (GPU_GAP in chart-library.ts) is a missing bar: nothing is drawn for it.
export const BOX_COMPUTE_SHADER = `${UNIFORM_STRUCT}
${BAR_UNIFORMS}
struct BarData {
screenX: f32,
minY: f32,
maxY: f32,
barWidth: f32,
};
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> dataX: array<f32>;
@group(0) @binding(2) var<storage, read> dataY: array<f32>;
@group(0) @binding(3) var<storage, read_write> barData: array<BarData>;
@group(0) @binding(4) var<storage, read> allSeries: array<SeriesInfo>;
@group(0) @binding(5) var<uniform> seriesIdx: SeriesIndex;
@group(0) @binding(6) var<uniform> bu: BarUniforms;
${BINARY_SEARCH}
fn barHalfWidth(idx: u32, seriesStart: u32, seriesEnd: u32) -> f32 {
if (seriesEnd - seriesStart <= 1u) {
return (u.viewMaxX - u.viewMinX) * 0.4;
}
var spacing: f32;
if (idx == seriesStart) {
spacing = dataX[seriesStart + 1u] - dataX[seriesStart];
} else if (idx + 1u >= seriesEnd) {
spacing = dataX[seriesEnd - 1u] - dataX[seriesEnd - 2u];
} else {
spacing = min(dataX[idx + 1u] - dataX[idx], dataX[idx] - dataX[idx - 1u]);
}
let seriesCount = max(1u, u.seriesCount);
return (spacing * 0.4) / f32(seriesCount);
}
@compute @workgroup_size(${COMPUTE_WG})
fn main(@builtin(global_invocation_id) id: vec3u) {
let outputIdx = id.x;
let maxCols = min(u32(u.width), arrayLength(&barData));
if (outputIdx >= maxCols) {
return;
}
// This series' samples: [seriesStart, seriesEnd) of its buffers.
let range = allSeries[seriesIdx.index].visibleRange;
let seriesStart = range.x;
let seriesEnd = range.x + range.y;
let viewRangeX = u.viewMaxX - u.viewMinX;
let viewRangeY = u.viewMaxY - u.viewMinY;
if (range.y == 0u || viewRangeX <= 0.0 || viewRangeY <= 0.0) {
barData[outputIdx] = BarData(0.0, 0.0, 0.0, 0.0);
return;
}
let relPx = f32(outputIdx);
let pixelMinX = u.viewMinX + (relPx / u.width) * viewRangeX;
let pixelMaxX = u.viewMinX + ((relPx + 1.0) / u.width) * viewRangeX;
let startIdx = lowerBound(pixelMinX, seriesStart, seriesEnd);
let endIdx = lowerBound(pixelMaxX, startIdx, seriesEnd);
let centerX = (pixelMinX + pixelMaxX) * 0.5;
let onePixel = 1.0 / u.width;
if (startIdx >= endIdx) {
var hit = false;
var bestX: f32 = 0.0;
var bestY: f32 = 0.0;
var bestHW: f32 = 0.0;
var bestDist: f32 = 1e10;
if (startIdx < seriesEnd && dataY[startIdx] > -1.0e38) {
let bx = dataX[startIdx];
let hw = barHalfWidth(startIdx, seriesStart, seriesEnd);
if (pixelMinX < bx + hw && pixelMaxX > bx - hw) {
let d = abs(bx - centerX);
bestX = bx; bestY = dataY[startIdx]; bestHW = hw; bestDist = d;
hit = true;
}
}
if (startIdx > seriesStart && dataY[startIdx - 1u] > -1.0e38) {
let prev = startIdx - 1u;
let bx = dataX[prev];
let hw = barHalfWidth(prev, seriesStart, seriesEnd);
if (pixelMinX < bx + hw && pixelMaxX > bx - hw) {
let d = abs(bx - centerX);
if (d < bestDist) {
bestX = bx; bestY = dataY[prev]; bestHW = hw; bestDist = d;
}
hit = true;
}
}
if (!hit) {
barData[outputIdx] = BarData(0.0, 0.0, 0.0, 0.0);
return;
}
// Every column a bar spans sees it here, but only one may emit its rectangle, or the
// translucent fills stack up to opaque (a 20 px bar drawn 20 times). The column holding the
// bar's centre draws it and that one takes the branch below; a bar whose centre lies outside
// the view is drawn by the edge column its centre is clamped to.
let cx = clamp(bestX, u.viewMinX, u.viewMaxX);
let owner = (pixelMinX <= cx && cx < pixelMaxX) || (outputIdx + 1u == maxCols && cx >= pixelMaxX);
if (!owner) {
barData[outputIdx] = BarData(0.0, 0.0, 0.0, 0.0);
return;
}
let seriesCount = max(1u, u.seriesCount);
let barOffset = (f32(seriesIdx.index) - f32(seriesCount - 1u) * 0.5) * (bestHW * 2.0);
let offsetX = bestX + barOffset;
let normX = (offsetX - u.viewMinX) / viewRangeX;
let fullWidth = bestHW * 2.0 / viewRangeX;
let gapSize = max(onePixel, fullWidth * 0.05);
let bw = max(fullWidth - gapSize, onePixel);
barData[outputIdx] = BarData(normX, bestY, bestY, bw);
return;
}
// Several samples fall into this column: one bar spanning their range, gaps left out.
var dataMinY = 3.0e38;
var dataMaxY = -3.0e38;
let rangeCount = endIdx - startIdx;
let maxSamples = bu.maxSamplesPerPixel;
if (maxSamples > 1u && rangeCount > maxSamples) {
let stride = f32(rangeCount - 1u) / f32(maxSamples - 1u);
for (var s = 0u; s < maxSamples; s++) {
let idx = startIdx + u32(f32(s) * stride);
if (idx < endIdx) {
let y = dataY[idx];
if (y > -1.0e38) {
dataMinY = min(dataMinY, y);
dataMaxY = max(dataMaxY, y);
}
}
}
let lastY = dataY[endIdx - 1u];
if (lastY > -1.0e38) {
dataMinY = min(dataMinY, lastY);
dataMaxY = max(dataMaxY, lastY);
}
} else {
for (var i = startIdx; i < endIdx; i++) {
let y = dataY[i];
if (y > -1.0e38) {
dataMinY = min(dataMinY, y);
dataMaxY = max(dataMaxY, y);
}
}
}
if (dataMaxY < dataMinY) {
barData[outputIdx] = BarData(0.0, 0.0, 0.0, 0.0);
return;
}
let hw = barHalfWidth(startIdx, seriesStart, seriesEnd);
let fullWidth = hw * 2.0 / viewRangeX;
let gapSize = max(onePixel, fullWidth * 0.05);
let bw = max(fullWidth - gapSize, onePixel);
let seriesCount = max(1u, u.seriesCount);
let barOffset = (f32(seriesIdx.index) - f32(seriesCount - 1u) * 0.5) * (hw * 2.0);
let dataX_centered = dataX[startIdx] + barOffset;
let normX = (dataX_centered - u.viewMinX) / viewRangeX;
barData[outputIdx] = BarData(normX, dataMinY, dataMaxY, bw);
}
`;

export const BOX_RENDER_SHADER = `${UNIFORM_STRUCT}
${BAR_UNIFORMS}
struct BarData {
screenX: f32,
minY: f32,
maxY: f32,
barWidth: f32,
};
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> barData: array<BarData>;
@group(0) @binding(2) var<storage, read> allSeries: array<SeriesInfo>;
@group(0) @binding(3) var<uniform> bu: BarUniforms;
struct VertexOutput {
@builtin(position) pos: vec4f,
@location(0) normY: f32,
@location(1) @interpolate(flat) seriesIdx: u32,
};
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) series_idx: u32) -> VertexOutput {
var out: VertexOutput;
out.seriesIdx = series_idx;
let maxCols = min(u32(u.width), arrayLength(&barData));
let colIdx = vi / 6u;
let vertexType = vi % 6u;
if (colIdx >= maxCols) {
out.pos = vec4f(0.0, 0.0, 0.0, 0.0);
out.normY = 0.0;
return out;
}
let bd = barData[colIdx];
if (bd.barWidth <= 0.0) {
out.pos = vec4f(0.0, 0.0, 0.0, 0.0);
out.normY = 0.0;
return out;
}
let viewRangeY = u.viewMaxY - u.viewMinY;
let safeRangeY = select(viewRangeY, 1.0, viewRangeY <= 0.0);
let normMinY = (min(bd.minY, 0.0) - u.viewMinY) / safeRangeY;
let normMaxY = (max(bd.maxY, 0.0) - u.viewMinY) / safeRangeY;
let top = 1.0 - normMaxY;
let bottom = 1.0 - normMinY;
let halfW = bd.barWidth * 0.5;
let left = bd.screenX - halfW;
let right = bd.screenX + halfW;
var positions = array<vec2f, 6>(
vec2f(left, bottom),
vec2f(right, bottom),
vec2f(left, top),
vec2f(left, top),
vec2f(right, bottom),
vec2f(right, top)
);
let screenPos = positions[vertexType];
let clipX = screenPos.x * 2.0 - 1.0;
let clipY = 1.0 - screenPos.y * 2.0;
out.pos = vec4f(clipX, clipY, 0.0, 1.0);
out.normY = normMaxY;
return out;
}
@fragment fn fs(in: VertexOutput) -> @location(0) vec4f {
let series = allSeries[in.seriesIdx];
return vec4f(series.color.rgb, bu.barOpacity);
}
`;
