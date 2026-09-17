import { UNIFORM_STRUCT, BINARY_SEARCH, COMPUTE_WG } from "../shared.ts";

// A sample of -3e38 (GPU_GAP in chart-library.ts) marks a missing value in y, lo or hi.

export const ERROR_BAND_COMPUTE_SHADER = `${UNIFORM_STRUCT}
struct ErrorBandUniforms {
maxSamplesPerPixel: u32,
bandOpacity: f32,
_p0: u32, _p1: u32,
};
struct BandData {
screenX: f32,
loScreenY: f32,
hiScreenY: f32,
centerScreenY: f32,
valid: f32,
};
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> dataX: array<f32>;
@group(0) @binding(2) var<storage, read> dataY: array<f32>;
@group(0) @binding(3) var<storage, read_write> bandData: array<BandData>;
@group(0) @binding(4) var<storage, read> allSeries: array<SeriesInfo>;
@group(0) @binding(5) var<uniform> eu: ErrorBandUniforms;
@group(0) @binding(6) var<storage, read> loData: array<f32>;
@group(0) @binding(7) var<storage, read> hiData: array<f32>;
${BINARY_SEARCH}
@compute @workgroup_size(${COMPUTE_WG})
fn main(@builtin(global_invocation_id) id: vec3u) {
let outputIdx = id.x;
let maxCols = u32(u.width);
let count = u.pointCount;
if (outputIdx >= maxCols || count == 0u) {
if (outputIdx < maxCols) {
bandData[outputIdx] = BandData(-1.0, -1.0, -1.0, -1.0, 0.0);
}
return;
}
let viewRangeX = u.viewMaxX - u.viewMinX;
let viewRangeY = u.viewMaxY - u.viewMinY;
if (viewRangeX < 0.0001 || viewRangeY < 0.0001) {
bandData[outputIdx] = BandData(-1.0, -1.0, -1.0, -1.0, 0.0);
return;
}
let relPx = f32(outputIdx);
let pixelMinX = u.viewMinX + (relPx / u.width) * viewRangeX;
let pixelMaxX = u.viewMinX + ((relPx + 1.0) / u.width) * viewRangeX;
if (pixelMaxX < u.dataMinX || pixelMinX > u.dataMaxX) {
bandData[outputIdx] = BandData(-1.0, -1.0, -1.0, -1.0, 0.0);
return;
}
let startIdx = lowerBound(pixelMinX, count);
var endIdx = lowerBound(pixelMaxX, count);
endIdx = min(endIdx, count);
let centerX = (pixelMinX + pixelMaxX) * 0.5;
if (startIdx >= endIdx) {
var bestIdx = startIdx;
if (startIdx > 0u && startIdx < count) {
let distPrev = abs(dataX[startIdx - 1u] - centerX);
let distCurr = abs(dataX[startIdx] - centerX);
if (distPrev < distCurr) {
bestIdx = startIdx - 1u;
}
} else if (startIdx >= count && count > 0u) {
bestIdx = count - 1u;
}
// The outermost columns take the neighbour beyond the view, so the segment crossing a canvas
// edge is drawn even when the half nearer to that neighbour lies entirely off screen.
if (outputIdx == 0u && startIdx > 0u) {
bestIdx = startIdx - 1u;
}
if (outputIdx + 1u == maxCols && startIdx < count) {
bestIdx = startIdx;
}
if (bestIdx >= count) {
bandData[outputIdx] = BandData(-1.0, -1.0, -1.0, -1.0, 0.0);
return;
}
let y = dataY[bestIdx];
if (y < -1.0e38) {
bandData[outputIdx] = BandData(-1.0, -1.0, -1.0, -1.0, 0.0);
return;
}
var lo = loData[bestIdx];
var hi = hiData[bestIdx];
if (lo < -1.0e38) { lo = y; }
if (hi < -1.0e38) { hi = y; }
let normX = (dataX[bestIdx] - u.viewMinX) / viewRangeX;
let normY = (y - u.viewMinY) / viewRangeY;
let normLo = (lo - u.viewMinY) / viewRangeY;
let normHi = (hi - u.viewMinY) / viewRangeY;
bandData[outputIdx] = BandData(normX, 1.0 - normLo, 1.0 - normHi, 1.0 - normY, 1.0);
return;
}
var dataMinY = 3.0e38;
var dataMaxY = -3.0e38;
var dataMinLo = 3.0e38;
var dataMaxHi = -3.0e38;
let rangeCount = endIdx - startIdx;
let maxSamples = eu.maxSamplesPerPixel;
if (maxSamples > 1u && rangeCount > maxSamples) {
let stride = f32(rangeCount - 1u) / f32(maxSamples - 1u);
for (var s = 0u; s < maxSamples; s++) {
let idx = startIdx + u32(f32(s) * stride);
if (idx < endIdx) {
let y = dataY[idx];
if (y > -1.0e38) {
dataMinY = min(dataMinY, y);
dataMaxY = max(dataMaxY, y);
let lo = loData[idx];
let hi = hiData[idx];
if (lo > -1.0e38) { dataMinLo = min(dataMinLo, lo); }
if (hi > -1.0e38) { dataMaxHi = max(dataMaxHi, hi); }
}
}
}
let lastY = dataY[endIdx - 1u];
if (lastY > -1.0e38) {
dataMinY = min(dataMinY, lastY);
dataMaxY = max(dataMaxY, lastY);
let lastLo = loData[endIdx - 1u];
let lastHi = hiData[endIdx - 1u];
if (lastLo > -1.0e38) { dataMinLo = min(dataMinLo, lastLo); }
if (lastHi > -1.0e38) { dataMaxHi = max(dataMaxHi, lastHi); }
}
} else {
for (var i = startIdx; i < endIdx; i++) {
let y = dataY[i];
if (y > -1.0e38) {
dataMinY = min(dataMinY, y);
dataMaxY = max(dataMaxY, y);
let lo = loData[i];
let hi = hiData[i];
if (lo > -1.0e38) { dataMinLo = min(dataMinLo, lo); }
if (hi > -1.0e38) { dataMaxHi = max(dataMaxHi, hi); }
}
}
}
if (dataMaxY < dataMinY) {
bandData[outputIdx] = BandData(-1.0, -1.0, -1.0, -1.0, 0.0);
return;
}
if (dataMaxHi < dataMinLo) {
dataMinLo = dataMinY;
dataMaxHi = dataMaxY;
}
// The vertex of a column that holds samples sits at the middle of those samples, not at the
// pixel centre: the empty columns on either side collapse onto their nearest sample, so a
// vertex left or right of that sample folds the strip back over itself and the overlap
// shows as a darker seam wherever the fill is blended.
let normX = ((dataX[startIdx] + dataX[endIdx - 1u]) * 0.5 - u.viewMinX) / viewRangeX;
let normMinLo = (dataMinLo - u.viewMinY) / viewRangeY;
let normMaxHi = (dataMaxHi - u.viewMinY) / viewRangeY;
let normMinY = (dataMinY - u.viewMinY) / viewRangeY;
let normMaxY = (dataMaxY - u.viewMinY) / viewRangeY;
let loScreenY = 1.0 - normMinLo;
let hiScreenY = 1.0 - normMaxHi;
let centerScreenY = 1.0 - (normMinY + normMaxY) * 0.5;
bandData[outputIdx] = BandData(normX, loScreenY, hiScreenY, centerScreenY, 1.0);
}
`;

export const ERROR_BAND_FILL_RENDER_SHADER = `${UNIFORM_STRUCT}
struct ErrorBandUniforms {
maxSamplesPerPixel: u32,
bandOpacity: f32,
_p0: u32, _p1: u32,
};
struct BandData {
screenX: f32,
loScreenY: f32,
hiScreenY: f32,
centerScreenY: f32,
valid: f32,
};
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> bandData: array<BandData>;
@group(0) @binding(2) var<storage, read> allSeries: array<SeriesInfo>;
@group(0) @binding(3) var<uniform> eu: ErrorBandUniforms;
struct VertexOutput {
@builtin(position) pos: vec4f,
@location(0) @interpolate(flat) seriesIdx: u32,
@location(1) @interpolate(flat) valid: f32,
};
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) series_idx: u32) -> VertexOutput {
var out: VertexOutput;
out.seriesIdx = series_idx;
out.valid = 0.0;
let maxCols = u32(u.width);
if (vi >= maxCols * 2u) {
out.pos = vec4f(0.0, 0.0, 0.0, 0.0);
return out;
}
let col = vi / 2u;
let onHi = (vi % 2u) == 0u;
let d = bandData[col];
let viewRangeX = u.viewMaxX - u.viewMinX;
let leftBound = select(0.0, clamp((u.dataMinX - u.viewMinX) / viewRangeX, 0.0, 1.0), viewRangeX > 0.0001);
let rightBound = select(1.0, clamp((u.dataMaxX - u.viewMinX) / viewRangeX, 0.0, 1.0), viewRangeX > 0.0001);
var sx = clamp(d.screenX, leftBound, rightBound);
var py = select(d.loScreenY, d.hiScreenY, onHi);
if (d.valid < 0.5 && vi > 0u) {
let prevCol = (vi - 1u) / 2u;
let pd = bandData[prevCol];
sx = clamp(pd.screenX, leftBound, rightBound);
py = select(pd.loScreenY, pd.hiScreenY, (vi - 1u) % 2u == 0u);
}
let clipX = sx * 2.0 - 1.0;
let clipY = 1.0 - py * 2.0;
out.valid = d.valid;
out.pos = vec4f(clipX, clipY, 0.0, 1.0);
return out;
}
@fragment fn fs(in: VertexOutput) -> @location(0) vec4f {
if (in.valid < 0.5) { discard; }
let series = allSeries[in.seriesIdx];
// The band of every series but the hovered one fades like its line: colour pulled toward the
// background as well as the opacity lowered, so stacked translucent bands still recede.
let dim = select(1.0, 0.35, u.highlight != 0xffffffffu && in.seriesIdx != u.highlight);
return vec4f(mix(vec3f(u.bgR, u.bgG, u.bgB), series.color.rgb, dim), eu.bandOpacity * dim);
}
`;

export const ERROR_BAND_LINE_RENDER_SHADER = `${UNIFORM_STRUCT}
struct BandData {
screenX: f32,
loScreenY: f32,
hiScreenY: f32,
centerScreenY: f32,
valid: f32,
};
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> bandData: array<BandData>;
@group(0) @binding(2) var<storage, read> allSeries: array<SeriesInfo>;
struct VertexOutput {
@builtin(position) pos: vec4f,
@location(0) alpha: f32,
@location(1) @interpolate(flat) seriesIdx: u32,
};
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) series_idx: u32) -> VertexOutput {
var out: VertexOutput;
out.seriesIdx = series_idx;
out.alpha = 0.0;
let maxCols = u32(u.width);
let segIdx = vi / 2u;
let endpoint = vi % 2u;
if (segIdx + 1u > maxCols) {
out.pos = vec4f(0.0, 0.0, 0.0, 0.0);
return out;
}
let col = segIdx + endpoint;
if (col >= maxCols) {
out.pos = vec4f(0.0, 0.0, 0.0, 0.0);
return out;
}
let d = bandData[col];
let d0 = bandData[segIdx];
let d1 = bandData[segIdx + 1u];
let segValid = min(d0.valid, d1.valid);
out.pos = vec4f(d.screenX * 2.0 - 1.0, 1.0 - d.centerScreenY * 2.0, 0.0, segValid);
out.alpha = segValid;
return out;
}
@fragment fn fs(in: VertexOutput) -> @location(0) vec4f {
if (in.alpha < 0.1) { discard; }
let series = allSeries[in.seriesIdx];
// Every series but the hovered one steps back toward the background while a highlight is
// set; mixed into the colour rather than the alpha, since the line passes do not blend.
let dim = select(1.0, 0.35, u.highlight != 0xffffffffu && in.seriesIdx != u.highlight);
return vec4f(mix(vec3f(u.bgR, u.bgG, u.bgB), series.color.rgb, dim), 1.0);
}
`;
