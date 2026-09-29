import { UNIFORM_STRUCT, COMPUTE_WG, SAMPLE_INDEX } from "../shared.ts";

export const BUBBLE_COMPUTE_SHADER = `${UNIFORM_STRUCT}
struct BubbleUniforms {
  maxPointSize: f32,
  minPointSize: f32,
  _p0: f32,
  _p1: f32,
};
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> dataX: array<f32>;
@group(0) @binding(2) var<storage, read> dataY: array<f32>;
@group(0) @binding(3) var outputTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(4) var<storage, read> allSeries: array<SeriesInfo>;
@group(0) @binding(5) var<uniform> seriesIdx: SeriesIndex;
@group(0) @binding(6) var<uniform> bu: BubbleUniforms;
@group(0) @binding(7) var<storage, read> dataR: array<f32>;
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
  let r = dataR[idx];
  // A gap (-3e38, GPU_GAP in chart-library.ts; a missing sorted x is +3e38) in any channel,
  // or no radius, draws nothing.
  if (abs(x) > 1.0e38 || y < -1.0e38 || !(r > 0.0)) { return; }
  let rangeX = u.viewMaxX - u.viewMinX;
  let rangeY = u.viewMaxY - u.viewMinY;
  if (rangeX <= 0.0 || rangeY <= 0.0) { return; }
  let normX = (x - u.viewMinX) / rangeX;
  let normY = (y - u.viewMinY) / rangeY;
  let centerX = normX * u.width;
  let centerY = (1.0 - normY) * u.height;
  let minDim = min(u.width, u.height);
  let maxRange = max(rangeX, rangeY);
  let rawRadius = r * minDim / maxRange;
  let radius = i32(clamp(rawRadius, bu.minPointSize, bu.maxPointSize));
  // Bubbles wholly off screen are skipped before the centre is taken to i32 (far off, it would
  // not fit), and the loops below only visit the rows and columns that lie on the canvas.
  let fr = f32(radius) + 1.0;
  if (centerX < -fr || centerX > u.width + fr || centerY < -fr || centerY > u.height + fr) { return; }
  let pixelX = i32(centerX);
  let pixelY = i32(centerY);
  let iWidth = i32(u.width);
  let iHeight = i32(u.height);
  let borderR: f32 = max(1.0, f32(radius) * 0.08);
  let innerR = f32(radius) - borderR;
  // The target holds premultiplied colour (as the blended render passes of the other charts
  // leave it, and as the canvas is configured): rgb is scaled by the alpha written with it.
  let border = vec4f(series.color.rgb * 0.5 * 0.95, 0.95);
  let fill = vec4f(series.color.rgb * 0.65, 0.65);
  let dy0 = max(-radius, -pixelY);
  let dy1 = min(radius, iHeight - 1 - pixelY);
  for (var dy = dy0; dy <= dy1; dy++) {
    // Columns of this row inside the circle: dx * dx + dy * dy <= radius * radius.
    let span = i32(sqrt(f32(radius * radius - dy * dy)));
    let dx0 = max(-span, -pixelX);
    let dx1 = min(span, iWidth - 1 - pixelX);
    for (var dx = dx0; dx <= dx1; dx++) {
      let dist2 = f32(dx * dx + dy * dy);
      textureStore(outputTex, vec2i(pixelX + dx, pixelY + dy), select(fill, border, dist2 > innerR * innerR));
    }
  }
}
`;
