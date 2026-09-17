import { UNIFORM_STRUCT } from "./shared.ts";

// Render pass that redraws the hovered series on top of everything else as a ribbon.
// A renderer opts in with a pass flagged `highlight: true`; the worker runs it last, only
// for the highlighted series (see ChartManager / hover plugin: SET_STYLE highlightSeries).

export const LINE_HIGHLIGHT_SHADER = `${UNIFORM_STRUCT}
struct ColData {
screenX: f32,
minScreenY: f32,
maxScreenY: f32,
valid: f32,
};
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> cols: array<ColData>;
@group(0) @binding(2) var<storage, read> allSeries: array<SeriesInfo>;
struct VertexOutput {
@builtin(position) pos: vec4f,
@location(0) @interpolate(flat) seriesIdx: u32,
};
// The hovered series once more as a ribbon: two triangles per pixel-column segment, 1.5 px
// to each side of the centre line the normal pass draws, on top of everything else.
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) series_idx: u32) -> VertexOutput {
var out: VertexOutput;
out.seriesIdx = series_idx;
out.pos = vec4f(0.0, 0.0, 0.0, 0.0);
let maxCols = u32(u.width);
let seg = vi / 6u;
if (seg + 1u >= maxCols) { return out; }
let d0 = cols[seg];
let d1 = cols[seg + 1u];
if (min(d0.valid, d1.valid) < 0.5) { return out; }
let p0 = vec2f(d0.screenX * u.width, (d0.minScreenY + d0.maxScreenY) * 0.5 * u.height);
let p1 = vec2f(d1.screenX * u.width, (d1.minScreenY + d1.maxScreenY) * 0.5 * u.height);
let dir = p1 - p0;
let len = length(dir);
if (len < 1e-4) { return out; }
let n = vec2f(-dir.y, dir.x) / len * 1.5;
let k = vi % 6u;
var pt = p0 + n;
if (k == 1u || k == 3u) { pt = p0 - n; }
if (k == 2u || k == 5u) { pt = p1 + n; }
if (k == 4u) { pt = p1 - n; }
out.pos = vec4f(pt.x / u.width * 2.0 - 1.0, 1.0 - pt.y / u.height * 2.0, 0.0, 1.0);
return out;
}
@fragment fn fs(in: VertexOutput) -> @location(0) vec4f {
let series = allSeries[in.seriesIdx];
return vec4f(series.color.rgb, 1.0);
}
`;

export const ERROR_BAND_HIGHLIGHT_SHADER = `${UNIFORM_STRUCT}
struct ColData {
screenX: f32,
loScreenY: f32,
hiScreenY: f32,
centerScreenY: f32,
valid: f32,
};
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> cols: array<ColData>;
@group(0) @binding(2) var<storage, read> allSeries: array<SeriesInfo>;
struct VertexOutput {
@builtin(position) pos: vec4f,
@location(0) @interpolate(flat) seriesIdx: u32,
};
// The hovered series once more as a ribbon: two triangles per pixel-column segment, 1.5 px
// to each side of the centre line the normal pass draws, on top of everything else.
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) series_idx: u32) -> VertexOutput {
var out: VertexOutput;
out.seriesIdx = series_idx;
out.pos = vec4f(0.0, 0.0, 0.0, 0.0);
let maxCols = u32(u.width);
let seg = vi / 6u;
if (seg + 1u >= maxCols) { return out; }
let d0 = cols[seg];
let d1 = cols[seg + 1u];
if (min(d0.valid, d1.valid) < 0.5) { return out; }
let p0 = vec2f(d0.screenX * u.width, d0.centerScreenY * u.height);
let p1 = vec2f(d1.screenX * u.width, d1.centerScreenY * u.height);
let dir = p1 - p0;
let len = length(dir);
if (len < 1e-4) { return out; }
let n = vec2f(-dir.y, dir.x) / len * 1.5;
let k = vi % 6u;
var pt = p0 + n;
if (k == 1u || k == 3u) { pt = p0 - n; }
if (k == 2u || k == 5u) { pt = p1 + n; }
if (k == 4u) { pt = p1 - n; }
out.pos = vec4f(pt.x / u.width * 2.0 - 1.0, 1.0 - pt.y / u.height * 2.0, 0.0, 1.0);
return out;
}
@fragment fn fs(in: VertexOutput) -> @location(0) vec4f {
let series = allSeries[in.seriesIdx];
return vec4f(series.color.rgb, 1.0);
}
`;
