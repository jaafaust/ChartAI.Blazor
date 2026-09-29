import { UNIFORM_STRUCT, BINARY_SEARCH, COMPUTE_WG } from "./shared.ts";

// Shared helpers embedded into the candlestick and OHLC shaders
export const CANDLE_TYPES = `
struct CandleUniforms {
  maxSamples: f32,
  upColor:    u32,
  downColor:  u32,
  binSize:    u32,
  interval:   f32,
  _p0: u32, _p1: u32, _p2: u32,
};
struct CandleData {
  screenX:    f32,
  barWidth:   f32,
  low:        f32,
  bodyBottom: f32,
  bodyTop:    f32,
  high:       f32,
  isUp:       f32,
};`;

// Returns the effective grouping interval in X-axis units.
// If cu.interval > 0 it is used directly; otherwise auto-selects the smallest
// standard timeframe that gives each candle at least cu.binSize screen pixels.
// Either way candleData holds one candle per pixel column: when the view spans more
// intervals than that, whole multiples of the interval are merged into one candle.
// Only differences and the (period-aligned) rebased view enter here, never absolute x.
export const EFFECTIVE_INTERVAL = `
fn effectiveInterval() -> f32 {
  let viewRangeX = u.viewMaxX - u.viewMinX;
  var iv = cu.interval;
  if (iv <= 0.0) {
    let raw = viewRangeX / u.width * f32(max(cu.binSize, 1u));
    let steps = array<f32, 20>(
      1.0, 2.0, 5.0, 10.0, 15.0, 30.0,
      60.0, 120.0, 300.0, 600.0, 900.0, 1800.0,
      3600.0, 7200.0, 14400.0, 43200.0,
      86400.0, 259200.0, 604800.0, 2592000.0
    );
    iv = raw;
    for (var i = 0u; i < 20u; i++) {
      if (steps[i] >= raw) { iv = steps[i]; break; }
    }
  }
  let cols = max(u.width - 2.0, 1.0);
  return iv * max(1.0, ceil(viewRangeX / (iv * cols)));
}
fn candleBins(interval: f32) -> u32 {
  let viewRangeX = u.viewMaxX - u.viewMinX;
  return min(u32(ceil(viewRangeX / interval)) + 2u, min(u32(u.width), arrayLength(&candleData)));
}`;

export const CANDLESTICK_COMPUTE_SHADER = `${UNIFORM_STRUCT}
${CANDLE_TYPES}
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read>       dataX:     array<f32>;
@group(0) @binding(2) var<storage, read>       dataClose: array<f32>;
@group(0) @binding(3) var<storage, read_write> candleData: array<CandleData>;
@group(0) @binding(4) var<storage, read>       allSeries: array<SeriesInfo>;
@group(0) @binding(5) var<uniform>             seriesIdx: SeriesIndex;
@group(0) @binding(6) var<uniform>             cu: CandleUniforms;
@group(0) @binding(7) var<storage, read>       dataOpen: array<f32>;
@group(0) @binding(8) var<storage, read>       dataHigh: array<f32>;
@group(0) @binding(9) var<storage, read>       dataLow:  array<f32>;
${BINARY_SEARCH}
${EFFECTIVE_INTERVAL}
// Sample i as (open, high, low, close). A gap in close (-3e38, GPU_GAP in chart-library.ts)
// is a missing candle; a gap in open, high or low falls back to the close.
fn candleAt(i: u32) -> vec4f {
  let c = dataClose[i];
  var o = dataOpen[i];
  if (o < -1.0e38) { o = c; }
  var h = dataHigh[i];
  if (h < -1.0e38) { h = max(o, c); }
  var l = dataLow[i];
  if (l < -1.0e38) { l = min(o, c); }
  return vec4f(o, h, l, c);
}
@compute @workgroup_size(${COMPUTE_WG})
fn main(@builtin(global_invocation_id) id: vec3u) {
let binIdx     = id.x;
let maxBins    = min(u32(u.width), arrayLength(&candleData));
if (binIdx >= maxBins) { return; }
// This series' samples: [seriesStart, seriesEnd) of its buffers.
let range      = allSeries[seriesIdx.index].visibleRange;
let seriesStart      = range.x;
let seriesEnd        = range.x + range.y;
let viewRangeX = u.viewMaxX - u.viewMinX;
let viewRangeY = u.viewMaxY - u.viewMinY;
if (range.y == 0u || viewRangeX <= 0.0 || viewRangeY <= 0.0) {
  candleData[binIdx] = CandleData(0.0,0.0,0.0,0.0,0.0,0.0,0.0);
  return;
}
let interval     = effectiveInterval();
let alignedStart = floor(u.viewMinX / interval) * interval;
let numBins      = candleBins(interval);
if (binIdx >= numBins) { return; }
let binMinX = alignedStart + f32(binIdx) * interval;
let binMaxX = binMinX + interval;
if (binMinX >= u.viewMaxX) {
  candleData[binIdx] = CandleData(0.0,0.0,0.0,0.0,0.0,0.0,0.0);
  return;
}
let binMidX  = binMinX + interval * 0.5;
let screenX  = (binMidX - u.viewMinX) / viewRangeX;
let barWidth = interval / viewRangeX;
let onePixel = 1.0 / u.width;
let bw       = max(barWidth * 0.95, onePixel);
let startIdx = lowerBound(binMinX, seriesStart, seriesEnd);
let endIdx   = lowerBound(binMaxX, startIdx, seriesEnd);
if (startIdx >= endIdx) {
  // No data starts in this interval — find nearest candle that visually overlaps
  var bestIdx:  u32  = 0u;
  var bestDist: f32  = 1e10;
  var hit = false;
  if (startIdx < seriesEnd) {
    let bx = dataX[startIdx];
    let hw = interval * 0.5;
    if (binMinX < bx + hw && binMaxX > bx - hw) {
      bestIdx = startIdx; bestDist = abs(bx - binMidX); hit = true;
    }
  }
  if (startIdx > seriesStart) {
    let prev = startIdx - 1u;
    let bx   = dataX[prev];
    let hw   = interval * 0.5;
    if (binMinX < bx + hw && binMaxX > bx - hw) {
      let d = abs(bx - binMidX);
      if (!hit || d < bestDist) { bestIdx = prev; }
      hit = true;
    }
  }
  let k = candleAt(bestIdx);
  if (!hit || k.w < -1.0e38) {
    candleData[binIdx] = CandleData(0.0,0.0,0.0,0.0,0.0,0.0,0.0);
    return;
  }
  candleData[binIdx] = CandleData(screenX, bw, k.z, min(k.x,k.w), max(k.x,k.w), k.y, select(0.0,1.0,k.w>=k.x));
  return;
}
// Aggregate OHLC across the samples in this interval, gaps left out: open of the first,
// close of the last, extremes of all.
var found = false;
var o = 0.0;
var c = 0.0;
var h = -3.0e38;
var l = 3.0e38;
let rangeCount  = endIdx - startIdx;
let maxSamples  = u32(cu.maxSamples);
if (maxSamples > 1u && rangeCount > maxSamples) {
  let stride = f32(rangeCount - 1u) / f32(maxSamples - 1u);
  for (var s = 0u; s <= maxSamples; s++) {
    // The extra last step visits endIdx - 1 itself, whatever the rounding of the stride.
    let idx = select(startIdx + u32(f32(s) * stride), endIdx - 1u, s == maxSamples);
    if (idx < endIdx) {
      let k = candleAt(idx);
      if (k.w > -1.0e38) {
        if (!found) { o = k.x; found = true; }
        c = k.w; h = max(h, k.y); l = min(l, k.z);
      }
    }
  }
} else {
  for (var i = startIdx; i < endIdx; i++) {
    let k = candleAt(i);
    if (k.w > -1.0e38) {
      if (!found) { o = k.x; found = true; }
      c = k.w; h = max(h, k.y); l = min(l, k.z);
    }
  }
}
if (!found) {
  candleData[binIdx] = CandleData(0.0,0.0,0.0,0.0,0.0,0.0,0.0);
  return;
}
candleData[binIdx] = CandleData(screenX, bw, l, min(o,c), max(o,c), h, select(0.0,1.0,c>=o));
}
`;

export const CANDLESTICK_RENDER_SHADER = `${UNIFORM_STRUCT}
${CANDLE_TYPES}
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> candleData: array<CandleData>;
@group(0) @binding(2) var<uniform>       cu: CandleUniforms;
${EFFECTIVE_INTERVAL}
struct VertexOutput {
@builtin(position) pos: vec4f,
@location(0) @interpolate(flat) isUp:   f32,
@location(1) @interpolate(flat) isWick: f32,
};
// 5 sections × 6 vertices = 30 per column
// 0=body  1=upper-wick  2=lower-wick  3=upper-cap  4=lower-cap
@vertex fn vs(@builtin(vertex_index) vi: u32) -> VertexOutput {
var out: VertexOutput;
let viewRangeX = u.viewMaxX - u.viewMinX;
let colIdx     = vi / 30u;
let localVi    = vi % 30u;
let section    = localVi / 6u;
let vertexType = localVi % 6u;
if (viewRangeX <= 0.0 || colIdx >= candleBins(effectiveInterval())) {
  out.pos = vec4f(0.0,0.0,0.0,0.0); out.isUp = 0.0; out.isWick = 0.0; return out;
}
let cd = candleData[colIdx];
if (cd.barWidth <= 0.0) {
  out.pos = vec4f(0.0,0.0,0.0,0.0); out.isUp = 0.0; out.isWick = 0.0; return out;
}
out.isUp   = cd.isUp;
out.isWick = select(0.0, 1.0, section > 0u);
let viewRangeY = u.viewMaxY - u.viewMinY;
let safeRangeY = select(viewRangeY, 1.0, viewRangeY <= 0.0);
let onePixelX  = 1.0 / u.width;
let onePixelY  = 1.0 / u.height;
var sLeft: f32; var sRight: f32; var sTop: f32; var sBottom: f32;
if (section == 0u) {
  let nb = (cd.bodyBottom - u.viewMinY) / safeRangeY;
  let nt = (cd.bodyTop    - u.viewMinY) / safeRangeY;
  sBottom = 1.0 - nb; sTop = 1.0 - nt;
  let hw = cd.barWidth * 0.5;
  sLeft = cd.screenX - hw; sRight = cd.screenX + hw;
} else if (section == 1u) {
  let nb = (cd.bodyTop - u.viewMinY) / safeRangeY;
  let nt = (cd.high    - u.viewMinY) / safeRangeY;
  sBottom = 1.0 - nb; sTop = 1.0 - nt;
  let hw = max(onePixelX, cd.barWidth * 0.08);
  sLeft = cd.screenX - hw; sRight = cd.screenX + hw;
} else if (section == 2u) {
  let nb = (cd.low        - u.viewMinY) / safeRangeY;
  let nt = (cd.bodyBottom - u.viewMinY) / safeRangeY;
  sBottom = 1.0 - nb; sTop = 1.0 - nt;
  let hw = max(onePixelX, cd.barWidth * 0.08);
  sLeft = cd.screenX - hw; sRight = cd.screenX + hw;
} else if (section == 3u) {
  let sy     = 1.0 - (cd.high - u.viewMinY) / safeRangeY;
  let wickHW = max(onePixelX, cd.barWidth * 0.08);
  let capHH  = wickHW * u.width / u.height;
  sTop = sy - capHH; sBottom = sy + capHH;
  let hw = max(onePixelX * 2.0, cd.barWidth * 0.28);
  sLeft = cd.screenX - hw; sRight = cd.screenX + hw;
} else {
  let sy     = 1.0 - (cd.low - u.viewMinY) / safeRangeY;
  let wickHW = max(onePixelX, cd.barWidth * 0.08);
  let capHH  = wickHW * u.width / u.height;
  sTop = sy - capHH; sBottom = sy + capHH;
  let hw = max(onePixelX * 2.0, cd.barWidth * 0.28);
  sLeft = cd.screenX - hw; sRight = cd.screenX + hw;
}
var positions = array<vec2f, 6>(
  vec2f(sLeft,  sBottom),
  vec2f(sRight, sBottom),
  vec2f(sLeft,  sTop),
  vec2f(sLeft,  sTop),
  vec2f(sRight, sBottom),
  vec2f(sRight, sTop)
);
let sp = positions[vertexType];
out.pos = vec4f(sp.x * 2.0 - 1.0, 1.0 - sp.y * 2.0, 0.0, 1.0);
return out;
}
@fragment fn fs(in: VertexOutput) -> @location(0) vec4f {
let upRgb   = unpack4x8unorm(cu.upColor).rgb;
let downRgb = unpack4x8unorm(cu.downColor).rgb;
let base  = select(downRgb, upRgb, in.isUp > 0.5);
let color = select(base, base * 0.65, in.isWick > 0.5);
return vec4f(color, 0.92);
}
`;
