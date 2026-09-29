import { UNIFORM_STRUCT, COMPUTE_WG, SAMPLE_INDEX } from "./shared.ts";

export const SCATTER_COMPUTE_SHADER = `${UNIFORM_STRUCT}
struct ScatterUniforms { pointSize: f32, _p0: f32, _p1: f32, _p2: f32 };
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> dataX: array<f32>;
@group(0) @binding(2) var<storage, read> dataY: array<f32>;
@group(0) @binding(3) var outputTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(4) var<storage, read> allSeries: array<SeriesInfo>;
@group(0) @binding(5) var<uniform> seriesIdx: SeriesIndex;
@group(0) @binding(6) var<uniform> su: ScatterUniforms;
@compute @workgroup_size(${COMPUTE_WG})
fn main(@builtin(global_invocation_id) id: vec3u, @builtin(num_workgroups) nwg: vec3u) {
let series = allSeries[seriesIdx.index];
let visStart = series.visibleRange.x;
let visCount = series.visibleRange.y;
let localIdx = ${SAMPLE_INDEX};
if (localIdx >= visCount) { return; }
let idx = visStart + localIdx;
let x = dataX[idx];
let y = dataY[idx];
// A gap in y (-3e38, GPU_GAP in chart-library.ts) or in x (±3e38: sorted x keeps a missing
// sample last as +3e38) draws nothing.
if (abs(x) > 1.0e38 || y < -1.0e38) { return; }
if (y < u.viewMinY || y > u.viewMaxY) { return; }
let width = u32(u.width);
let height = u32(u.height);
let rangeX = u.viewMaxX - u.viewMinX;
let rangeY = u.viewMaxY - u.viewMinY;
if (rangeX <= 0.0 || rangeY <= 0.0) { return; }
let normX = (x - u.viewMinX) / rangeX;
let normY = (y - u.viewMinY) / rangeY;
let screenX = normX;
let screenY = 1.0 - normY;
let pixelX = i32(screenX * f32(width));
let pixelY = i32(screenY * f32(height));
if (idx > visStart) {
let prevX = dataX[idx - 1u];
let prevY = dataY[idx - 1u];
let prevNormX = (prevX - u.viewMinX) / rangeX;
let prevNormY = (prevY - u.viewMinY) / rangeY;
let prevPx = i32(prevNormX * f32(width));
let prevPy = i32((1.0 - prevNormY) * f32(height));
if (pixelX == prevPx && pixelY == prevPy) { return; }
}
let iWidth = i32(width);
let iHeight = i32(height);
if (pixelX < 0 || pixelX >= iWidth) { return; }
if (pixelY < 0 || pixelY >= iHeight) { return; }
let color = series.color;
let radius = i32(su.pointSize);
for (var dy = -radius; dy <= radius; dy++) {
for (var dx = -radius; dx <= radius; dx++) {
if (dx * dx + dy * dy > radius * radius) { continue; }
let px = pixelX + dx;
let py = pixelY + dy;
if (px >= 0 && px < iWidth && py >= 0 && py < iHeight) {
textureStore(outputTex, vec2i(px, py), color);
}
}
}
}
`;
