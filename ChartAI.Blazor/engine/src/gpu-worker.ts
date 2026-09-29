/// <reference types="@webgpu/types" />
// The GPU worker: owns the device and every chart's buffers and textures, and renders the charts
// ChartManager (chart-library.ts) reports as changed, at most once per animation frame.

import { BLIT_SHADER } from "./shaders/shared.ts";
import { M, E } from "./msg.ts";

interface BindingDef {
  binding: number;
  source: string;
  write?: boolean;
}

interface SerializedPassDef {
  type: "compute" | "render";
  shader: string;
  bindings: BindingDef[];
  perSeries: boolean;
  topology?: string;
  loadOp?: "clear" | "load";
  blend?: GPUBlendState;
  // Runs after all other passes, for the highlighted series only.
  highlight?: boolean;
}

interface SerializedBufferDef {
  name: string;
  usages: string[];
  perSeries: boolean;
}

interface UniformDef {
  name: string;
  type: "f32" | "u32";
  default: number;
}

interface WorkerRendererConfig {
  name: string;
  shaders: Record<string, string>;
  passes: SerializedPassDef[];
  bufferDefs: SerializedBufferDef[];
  uniformDefs: UniformDef[];
}

interface CompiledRenderer {
  config: WorkerRendererConfig;
  // Per pass, in pass order.
  pipelines: (GPURenderPipeline | GPUComputePipeline)[];
  passLayouts: GPUBindGroupLayout[];
  // 4x MSAA for the render passes; off when a compute pass writes the render target directly.
  msaa: boolean;
  // Some pass binds the render target, so its bind groups go stale when the texture is made anew.
  usesTarget: boolean;
  // Index of the highlight pass, -1 when the renderer has none.
  hl: number;
}

// Sample data as the main thread sends it: transferred, never shared.
type F32 = Float32Array<ArrayBuffer>;

interface PassMeta {
  dispatch?: { x: number; y?: number; z?: number };
  draw?: number;
}

interface ChartSeriesData {
  label: string;
  colorR: number;
  colorG: number;
  colorB: number;
  dataX: GPUBuffer;
  // false when dataX is the chart's shared x buffer (destroyed with the chart, not the series).
  ownsX: boolean;
  dataY: GPUBuffer;
  extraBuffers: Map<string, GPUBuffer>;
  seriesBuffers: Map<string, GPUBuffer>;
  seriesIndexBuffer: GPUBuffer;
  // Columns every data buffer of the series holds.
  columns: number;
  // Columns written; the shaders draw [visibleStart, visibleStart + visibleCount) of them, which
  // they read from SeriesInfo.visibleRange.
  pointCount: number;
  visibleStart: number;
  visibleCount: number;
  hidden: boolean;
  // The output of the compute passes (the per-column buffers) predates the data, view or size.
  stale: boolean;
  passBindGroups: (GPUBindGroup | null)[];
  // Bind group of the highlight pass, created on first use.
  hlBindGroup: GPUBindGroup | null;
}

interface Chart {
  id: string;
  canvas: OffscreenCanvas;
  ctx: GPUCanvasContext;
  rendererName: string;
  visible: boolean;
  series: ChartSeriesData[];
  uniformBuffer: GPUBuffer;
  seriesStorageBuffer: GPUBuffer | null;
  // SeriesInfo (colour, visible range) changed since it was last uploaded.
  seriesInfoDirty: boolean;
  outputTexture: GPUTexture | null;
  outputTextureView: GPUTextureView | null;
  msaaTexture: GPUTexture | null;
  msaaView: GPUTextureView | null;
  blitBindGroup: GPUBindGroup | null;
  // The renderer the textures were made for (its passes decide their usage and sample count).
  texRenderer: CompiledRenderer | null;
  chartBuffers: Map<string, GPUBuffer>;
  customUniformBuffer: GPUBuffer | null;
  customUniformValues: Record<string, number>;
  chartPassBindGroups: (GPUBindGroup | null)[];
  // A buffer or texture the bind groups reference has been replaced: rebuild them before drawing.
  bindGroupsStale: boolean;
  perSeriesPassMeta: PassMeta[][];
  width: number;
  height: number;
  panX: number;
  panY: number;
  zoomX: number;
  zoomY: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  bgColor: [number, number, number] | null;
  // One x buffer bound to every series when they share an x array (see UPDATE_SERIES sharedX).
  sharedX: GPUBuffer | null;
  // Columns the data buffers can hold; PATCH_SERIES writes into them in place.
  capacity: number;
  // Series index to highlight as requested (SET_STYLE highlightSeries), -1 for none...
  highlight: number;
  // ...and the one actually drawn highlighted in the last frame (written to the uniforms).
  hlSeries: number;
  // Needs a new frame...
  dirty: boolean;
  // ...in which the chart-level compute passes rerun (the per-series ones follow ChartSeriesData.stale).
  computeStale: boolean;
}

let device: GPUDevice, canvasFormat: GPUTextureFormat;
const charts = new Map<string, Chart>();
const renderers = new Map<string, CompiledRenderer>();
let isDark = false;
// Set once the device is lost: the loss is reported once and nothing renders any more; the main
// thread replaces this worker (see ChartManager).
let deviceLost = false;

let blitPipeline: GPURenderPipeline;
let blitLayout: GPUBindGroupLayout;
let blitSampler: GPUSampler;

let frameCount = 0;
let lastRenderMs = 0;
let renderScheduled = false;
let statsInterval: ReturnType<typeof setInterval> | null = null;

// Staging buffer for uniform writes — 16 fields + highlight + 3 padding × 4 bytes = 80 bytes
const uniformStagingBuffer = new ArrayBuffer(80);
const uniformStagingF32 = new Float32Array(uniformStagingBuffer);
const uniformStagingU32 = new Uint32Array(uniformStagingBuffer);

const CLEAR_COLOR: GPUColor = { r: 0, g: 0, b: 0, a: 0 };

function parseUsageFlags(usages: string[]): GPUBufferUsageFlags {
  let flags = GPUBufferUsage.COPY_DST;
  for (const u of usages) {
    switch (u.toUpperCase()) {
      case "STORAGE":  flags |= GPUBufferUsage.STORAGE;  break;
      case "VERTEX":   flags |= GPUBufferUsage.VERTEX;   break;
      case "UNIFORM":  flags |= GPUBufferUsage.UNIFORM;  break;
      case "COPY_SRC": flags |= GPUBufferUsage.COPY_SRC; break;
      case "COPY_DST": flags |= GPUBufferUsage.COPY_DST; break;
      case "INDEX":    flags |= GPUBufferUsage.INDEX;    break;
      case "INDIRECT": flags |= GPUBufferUsage.INDIRECT; break;
    }
  }
  return flags;
}

function getBindingLayoutEntry(
  source: string,
  write: boolean | undefined,
  passType: "compute" | "render"
): Omit<GPUBindGroupLayoutEntry, "binding"> {
  const visibility =
    passType === "compute"
      ? GPUShaderStage.COMPUTE
      : GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;

  if (source === "uniforms" || source === "custom-uniforms" || source === "series-index") {
    return { visibility, buffer: { type: "uniform" } };
  }
  if (source === "render-target") {
    if (write) {
      return {
        visibility: GPUShaderStage.COMPUTE,
        storageTexture: { access: "write-only", format: "rgba8unorm" },
      };
    }
    return { visibility, texture: { sampleType: "float" } };
  }
  if (write) {
    return { visibility, buffer: { type: "storage" } };
  }
  return { visibility, buffer: { type: "read-only-storage" } };
}

function getBindingResource(
  source: string,
  chart: Chart,
  series: ChartSeriesData | null,
  renderer: CompiledRenderer
): GPUBindingResource {
  switch (source) {
    case "uniforms":        return { buffer: chart.uniformBuffer };
    case "custom-uniforms": return { buffer: chart.customUniformBuffer! };
    case "series-info":     return { buffer: chart.seriesStorageBuffer! };
    case "render-target":   return chart.outputTextureView!;
    case "x-data":          return { buffer: series!.dataX };
    case "y-data":          return { buffer: series!.dataY };
    case "series-index":    return { buffer: series!.seriesIndexBuffer };
  }

  if (source.endsWith("-data")) {
    const field = source.slice(0, -5);
    return { buffer: series!.extraBuffers.get(field)! };
  }

  const bufDef = renderer.config.bufferDefs.find((b) => b.name === source);
  if (bufDef?.perSeries) {
    return { buffer: series!.seriesBuffers.get(source)! };
  }
  return { buffer: chart.chartBuffers.get(source)! };
}

function bindGroupEntries(
  pass: SerializedPassDef,
  chart: Chart,
  series: ChartSeriesData | null,
  renderer: CompiledRenderer
): GPUBindGroupEntry[] {
  return pass.bindings.map((b) => ({
    binding: b.binding,
    resource: getBindingResource(b.source, chart, series, renderer),
  }));
}

// WGSL errors do not throw: they surface here, with the pipeline validation errors of the renderer
// (a binding the shader declares that the pass does not provide, say), as E.COMPILE messages.
function reportShaderErrors(renderer: string, shader: string, module: GPUShaderModule): void {
  module
    .getCompilationInfo?.()
    ?.then((info) => {
      const errors = info.messages.filter((m) => m.type === "error");
      if (errors.length > 0)
        postMessage({
          type: M.ERROR,
          code: E.COMPILE,
          message: `${renderer}/${shader}: ${errors.map((m) => `${m.lineNum}:${m.linePos} ${m.message}`).join("; ")}`,
        });
    })
    .catch(() => {});
}

function compileRenderer(config: WorkerRendererConfig): CompiledRenderer {
  const pipelines: (GPURenderPipeline | GPUComputePipeline)[] = [];
  const passLayouts: GPUBindGroupLayout[] = [];
  const modules = new Map<string, GPUShaderModule>();
  // A compute pass writing the render target as a storage texture rules out multisampling.
  const msaa = !config.passes.some(
    (p) =>
      p.type === "compute" &&
      p.bindings.some((b) => b.source === "render-target" && b.write)
  );

  device.pushErrorScope?.("validation");
  for (let passIdx = 0; passIdx < config.passes.length; passIdx++) {
    const pass = config.passes[passIdx];

    const layoutEntries: GPUBindGroupLayoutEntry[] = pass.bindings.map((b) => ({
      binding: b.binding,
      ...getBindingLayoutEntry(b.source, b.write, pass.type),
    }));

    const layout = device.createBindGroupLayout({ entries: layoutEntries });
    passLayouts.push(layout);

    const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });
    let shaderModule = modules.get(pass.shader);
    if (!shaderModule) {
      shaderModule = device.createShaderModule({ code: config.shaders[pass.shader] });
      modules.set(pass.shader, shaderModule);
      reportShaderErrors(config.name, pass.shader, shaderModule);
    }

    if (pass.type === "compute") {
      pipelines.push(
        device.createComputePipeline({
          layout: pipelineLayout,
          compute: { module: shaderModule, entryPoint: "main" },
        })
      );
    } else {
      pipelines.push(
        device.createRenderPipeline({
          layout: pipelineLayout,
          vertex: { module: shaderModule, entryPoint: "vs" },
          fragment: {
            module: shaderModule,
            entryPoint: "fs",
            targets: [{ format: "rgba8unorm", blend: pass.blend }],
          },
          primitive: { topology: (pass.topology ?? "triangle-list") as GPUPrimitiveTopology },
          multisample: { count: msaa ? 4 : 1 },
        })
      );
    }
  }
  device
    .popErrorScope?.()
    ?.then((err) => {
      if (err) postMessage({ type: M.ERROR, code: E.COMPILE, message: `${config.name}: ${err.message}` });
    })
    .catch(() => {});

  return {
    config,
    pipelines,
    passLayouts,
    msaa,
    usesTarget: config.passes.some((p) => p.bindings.some((b) => b.source === "render-target")),
    hl: config.passes.findIndex((p) => p.highlight),
  };
}

// SeriesInfo per series: colour, then visibleRange (first column, column count) as u32.
function writeSeriesInfo(chart: Chart): void {
  chart.seriesInfoDirty = false;
  if (!chart.seriesStorageBuffer || chart.series.length === 0) return;
  const data = new Float32Array(chart.series.length * 8);
  const dataU32 = new Uint32Array(data.buffer);

  for (let i = 0; i < chart.series.length; i++) {
    const s = chart.series[i];
    const off = i * 8;
    data[off + 0] = s.colorR;
    data[off + 1] = s.colorG;
    data[off + 2] = s.colorB;
    data[off + 3] = 1.0;
    dataU32[off + 4] = s.visibleStart;
    dataU32[off + 5] = s.visibleCount;
  }
  device.queue.writeBuffer(chart.seriesStorageBuffer, 0, data);
}

// The chart's shared uniforms, written once per frame: nothing in them is per series.
function writeUniforms(chart: Chart): void {
  const f32 = uniformStagingF32;
  const u32 = uniformStagingU32;
  const rx = chart.maxX - chart.minX;
  const ry = chart.maxY - chart.minY;
  const bg = chart.bgColor ?? (isDark ? [0.11, 0.11, 0.12] : [0.98, 0.98, 0.98]);

  f32[0]  = chart.width;
  f32[1]  = chart.height;
  f32[2]  = chart.minX + chart.panX * rx;
  f32[3]  = chart.minX + chart.panX * rx + rx / chart.zoomX;
  f32[4]  = chart.minY + chart.panY * ry;
  f32[5]  = chart.minY + chart.panY * ry + ry / chart.zoomY;
  u32[6]  = 0;
  u32[7]  = chart.series.length;
  u32[8]  = isDark ? 1 : 0;
  f32[9]  = bg[0];
  f32[10] = bg[1];
  f32[11] = bg[2];
  f32[12] = chart.minX;
  f32[13] = chart.maxX;
  f32[14] = chart.minY;
  f32[15] = chart.maxY;
  // Highlighted series index; -1 wraps to 0xffffffff, which the shaders read as "none".
  u32[16] = (chart.hlSeries ?? -1) >>> 0;

  device.queue.writeBuffer(chart.uniformBuffer, 0, uniformStagingBuffer);
}

function writeCustomUniforms(chart: Chart, config: WorkerRendererConfig): void {
  if (!chart.customUniformBuffer || config.uniformDefs.length === 0) return;
  const n = config.uniformDefs.length;
  const byteCount = Math.ceil(n * 4 / 16) * 16;
  const buffer = new ArrayBuffer(byteCount);
  const f32 = new Float32Array(buffer);
  const u32 = new Uint32Array(buffer);
  for (let i = 0; i < n; i++) {
    const def = config.uniformDefs[i];
    const v = chart.customUniformValues[def.name];
    const val = typeof v === "number" ? v : def.default;
    if (def.type === "u32") u32[i] = val >>> 0;
    else f32[i] = val;
  }
  device.queue.writeBuffer(chart.customUniformBuffer, 0, buffer);
}

// Keeps map's buffer `name` when it holds `bytes` already and makes a new one otherwise; true when
// it made one. A regrown buffer gets headroom, so a drag-resize does not reallocate at every step.
function ensureBuffer(
  map: Map<string, GPUBuffer>,
  name: string,
  bytes: number,
  usage: GPUBufferUsageFlags,
  headroom: boolean
): boolean {
  const need = Math.max(16, Math.ceil(bytes / 4) * 4);
  const old = map.get(name);
  if (old && old.size >= need) return false;
  old?.destroy();
  const limit = Math.min(device.limits.maxBufferSize || 268435456, device.limits.maxStorageBufferBindingSize || 134217728);
  const size = headroom ? Math.max(need, Math.min(limit, Math.ceil((need * 1.25) / 256) * 256)) : need;
  map.set(name, device.createBuffer({ size, usage }));
  return true;
}

function allocateChartBuffers(
  chart: Chart,
  renderer: CompiledRenderer,
  bufferSizes: Record<string, number>,
  headroom = false
): boolean {
  let made = false;
  for (const bufDef of renderer.config.bufferDefs) {
    if (!bufDef.perSeries &&
        ensureBuffer(chart.chartBuffers, bufDef.name, bufferSizes[bufDef.name] ?? 16, parseUsageFlags(bufDef.usages), headroom))
      made = true;
  }

  // Its size depends on the renderer alone; SET_UNIFORMS keeps its contents current.
  if (renderer.config.uniformDefs.length > 0 && !chart.customUniformBuffer) {
    const alignedSize = Math.max(16, Math.ceil(renderer.config.uniformDefs.length * 4 / 16) * 16);
    chart.customUniformBuffer = device.createBuffer({
      size: alignedSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    writeCustomUniforms(chart, renderer.config);
    made = true;
  }
  return made;
}

function allocateSeriesBuffers(
  series: ChartSeriesData,
  renderer: CompiledRenderer,
  bufferSizes: Record<string, number>,
  headroom = false
): boolean {
  let made = false;
  for (const bufDef of renderer.config.bufferDefs) {
    if (bufDef.perSeries &&
        ensureBuffer(series.seriesBuffers, bufDef.name, bufferSizes[bufDef.name] ?? 16, parseUsageFlags(bufDef.usages), headroom))
      made = true;
  }
  return made;
}

function createSeriesIndexBuffer(seriesIndex: number): GPUBuffer {
  const buf = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(buf, 0, new Uint32Array([seriesIndex, 0, 0, 0]));
  return buf;
}

function buildAllBindGroups(chart: Chart, renderer: CompiledRenderer): void {
  chart.bindGroupsStale = false;
  chart.chartPassBindGroups = [];
  if (!chart.seriesStorageBuffer) return;

  for (let si = 0; si < chart.series.length; si++) {
    const series = chart.series[si];
    series.passBindGroups = [];
    series.hlBindGroup = null;

    for (let passIdx = 0; passIdx < renderer.config.passes.length; passIdx++) {
      const pass = renderer.config.passes[passIdx];
      // The highlight pass binds lazily, for the one highlighted series (see renderChart).
      if (!pass.perSeries || pass.highlight) {
        series.passBindGroups.push(null);
        continue;
      }

      try {
        series.passBindGroups.push(
          device.createBindGroup({
            layout: renderer.passLayouts[passIdx],
            entries: bindGroupEntries(pass, chart, series, renderer),
          })
        );
      } catch (e) {
        postMessage({ type: M.ERROR, code: E.BIND_S, message: String(e) });
        series.passBindGroups.push(null);
      }
    }
  }

  for (let passIdx = 0; passIdx < renderer.config.passes.length; passIdx++) {
    const pass = renderer.config.passes[passIdx];
    if (pass.perSeries) {
      chart.chartPassBindGroups.push(null);
      continue;
    }
    try {
      chart.chartPassBindGroups.push(
        device.createBindGroup({
          layout: renderer.passLayouts[passIdx],
          entries: bindGroupEntries(pass, chart, null, renderer),
        })
      );
    } catch (e) {
      postMessage({ type: M.ERROR, code: E.BIND_C, message: String(e) });
      chart.chartPassBindGroups.push(null);
    }
  }
}

// The highlight pass's bind group for series si, made on first use; null when it cannot be made.
function highlightBindGroup(chart: Chart, renderer: CompiledRenderer, si: number): GPUBindGroup | null {
  const series = chart.series[si];
  if (!series.hlBindGroup) {
    try {
      series.hlBindGroup = device.createBindGroup({
        layout: renderer.passLayouts[renderer.hl],
        entries: bindGroupEntries(renderer.config.passes[renderer.hl], chart, series, renderer),
      });
    } catch (e) {
      postMessage({ type: M.ERROR, code: E.BIND_S, message: String(e) });
    }
  }
  return series.hlBindGroup;
}

// The render target (and its 4x multisampled companion) at the chart's size.
function createChartTexture(chart: Chart): void {
  releaseChartTextures(chart);

  const w = Math.max(1, chart.width);
  const h = Math.max(1, chart.height);

  const renderer = renderers.get(chart.rendererName) ?? null;
  let usage = GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT;
  // msaa is off exactly when a compute pass writes the target as a storage texture.
  if (renderer && !renderer.msaa) usage |= GPUTextureUsage.STORAGE_BINDING;

  chart.outputTexture = device.createTexture({ size: [w, h], format: "rgba8unorm", usage });
  chart.outputTextureView = chart.outputTexture.createView();
  chart.blitBindGroup = device.createBindGroup({
    layout: blitLayout,
    entries: [
      { binding: 0, resource: chart.outputTextureView },
      { binding: 1, resource: blitSampler },
    ],
  });

  // The multisampled target the render passes draw into; it resolves into outputTexture.
  if (renderer && renderer.msaa) {
    chart.msaaTexture = device.createTexture({
      size: [w, h],
      format: "rgba8unorm",
      sampleCount: 4,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    chart.msaaView = chart.msaaTexture.createView();
  }
  chart.texRenderer = renderer;
  if (renderer?.usesTarget) chart.bindGroupsStale = true;
}

// Frees the render targets, e.g. while the chart is off screen; renderChart makes them again.
function releaseChartTextures(chart: Chart): void {
  chart.outputTexture?.destroy();
  chart.msaaTexture?.destroy();
  chart.outputTexture = null;
  chart.outputTextureView = null;
  chart.msaaTexture = null;
  chart.msaaView = null;
  chart.blitBindGroup = null;
  chart.texRenderer = null;
  if (renderers.get(chart.rendererName)?.usesTarget) chart.bindGroupsStale = true;
}

// Only the pass that resolves the multisampled target into outputTexture names it (the last one of
// the frame); the passes before keep their samples for the next one.
function colorAttachment(chart: Chart, loadOp: GPULoadOp, resolve: boolean): GPURenderPassColorAttachment {
  if (!chart.msaaView)
    return { view: chart.outputTextureView!, loadOp, storeOp: "store", clearValue: CLEAR_COLOR };
  return {
    view: chart.msaaView,
    resolveTarget: resolve ? chart.outputTextureView! : undefined,
    loadOp,
    storeOp: resolve ? "discard" : "store",
    clearValue: CLEAR_COLOR,
  };
}

// Workgroup counts of pass p for series si as the main thread sized them, each clamped to the device
// limit (a larger count fails validation and loses the whole frame); null when there is nothing to run.
function dispatchSize(chart: Chart, si: number, p: number): [number, number, number] | null {
  const d = (chart.perSeriesPassMeta[si] ?? chart.perSeriesPassMeta[0])?.[p]?.dispatch ?? { x: 1 };
  const lim = device.limits.maxComputeWorkgroupsPerDimension || 65535;
  const x = Math.min(lim, Math.floor(d.x));
  const y = Math.min(lim, Math.floor(d.y ?? 1));
  const z = Math.min(lim, Math.floor(d.z ?? 1));
  return x > 0 && y > 0 && z > 0 ? [x, y, z] : null;
}

function drawCount(chart: Chart, si: number, p: number): number {
  const n = (chart.perSeriesPassMeta[si] ?? chart.perSeriesPassMeta[0])?.[p]?.draw ?? 0;
  return n > 0 ? Math.floor(n) : 0;
}

// An empty frame: the canvas cleared to transparent, so only the chart's background shows.
function presentClear(chart: Chart): void {
  let view: GPUTextureView;
  try {
    view = chart.ctx.getCurrentTexture().createView();
  } catch {
    return;
  }
  const encoder = device.createCommandEncoder();
  encoder
    .beginRenderPass({
      colorAttachments: [{ view, loadOp: "clear", storeOp: "store", clearValue: CLEAR_COLOR }],
    })
    .end();
  device.queue.submit([encoder.finish()]);
}

function renderChart(chart: Chart): void {
  if (!chart.ctx || chart.width === 0 || chart.height === 0) return;
  if (chart.series.length === 0 || !chart.seriesStorageBuffer) {
    presentClear(chart);
    return;
  }
  const renderer = renderers.get(chart.rendererName);
  if (!renderer) return;

  // The targets are released while the chart is off screen or resized, and made again on use.
  if (!chart.outputTexture || chart.texRenderer !== renderer) createChartTexture(chart);
  if (chart.bindGroupsStale) buildAllBindGroups(chart, renderer);
  if (chart.seriesInfoDirty) writeSeriesInfo(chart);

  let hs = chart.highlight ?? -1;
  if (
    renderer.hl < 0 ||
    hs < 0 ||
    hs >= chart.series.length ||
    chart.series[hs].hidden ||
    chart.series[hs].visibleCount === 0
  )
    hs = -1;
  const hlBindGroup = hs >= 0 ? highlightBindGroup(chart, renderer, hs) : null;
  if (!hlBindGroup) hs = -1;
  chart.hlSeries = hs;
  writeUniforms(chart);

  let textureView: GPUTextureView;
  try {
    textureView = chart.ctx.getCurrentTexture().createView();
  } catch {
    return;
  }

  const passes = renderer.config.passes;
  // The render passes of the frame: the first clears the target, the last one run (the highlight
  // pass when there is one) resolves it. Without a render pass to clear it, or when a compute pass
  // draws into it, the target is cleared up front.
  let firstRender = -1;
  let lastRender = -1;
  for (let p = 0; p < passes.length; p++) {
    if (passes[p].type !== "render" || passes[p].highlight) continue;
    if (firstRender < 0) firstRender = p;
    lastRender = p;
  }
  const resolveAt = hs >= 0 ? renderer.hl : lastRender;
  const clearFirst = !renderer.msaa || firstRender < 0;
  // A compute pass drawing into the target reruns every frame, as the target starts cleared; the
  // others leave their output in buffers, which only a change of data, view, size or uniforms
  // outdates (see markDirty): a highlight, theme or visibility change reruns no compute pass.
  const computeAll = !renderer.msaa;
  const chartCompute = computeAll || chart.computeStale;

  const encoder = device.createCommandEncoder();
  if (clearFirst)
    encoder.beginRenderPass({ colorAttachments: [colorAttachment(chart, "clear", resolveAt < 0)] }).end();

  // Consecutive compute passes share one GPUComputePassEncoder: one pipeline switch per pass, then
  // a bind group and a dispatch per series.
  let cp: GPUComputePassEncoder | null = null;
  for (let p = 0; p < passes.length; p++) {
    const pass = passes[p];
    if (pass.highlight) continue;

    if (pass.type === "compute") {
      const pipeline = renderer.pipelines[p] as GPUComputePipeline;
      let pipelineSet = false;
      const count = pass.perSeries ? chart.series.length : chartCompute ? 1 : 0;
      for (let si = 0; si < count; si++) {
        let bg: GPUBindGroup | null;
        if (pass.perSeries) {
          const s = chart.series[si];
          if (s.hidden || s.visibleCount === 0 || !(computeAll || s.stale)) continue;
          bg = s.passBindGroups[p];
        } else {
          bg = chart.chartPassBindGroups[p];
        }
        const d = dispatchSize(chart, si, p);
        if (!bg || !d) continue;
        if (!cp) cp = encoder.beginComputePass();
        if (!pipelineSet) {
          cp.setPipeline(pipeline);
          pipelineSet = true;
        }
        cp.setBindGroup(0, bg);
        cp.dispatchWorkgroups(d[0], d[1], d[2]);
      }
      continue;
    }

    if (cp) {
      cp.end();
      cp = null;
    }
    const loadOp: GPULoadOp = !clearFirst && p === firstRender ? "clear" : pass.loadOp ?? "load";
    const rp = encoder.beginRenderPass({
      colorAttachments: [colorAttachment(chart, loadOp, p === resolveAt)],
    });
    rp.setPipeline(renderer.pipelines[p] as GPURenderPipeline);
    if (pass.perSeries) {
      for (let si = 0; si < chart.series.length; si++) {
        const series = chart.series[si];
        if (series.hidden || series.visibleCount === 0) continue;
        const bg = series.passBindGroups[p];
        const n = drawCount(chart, si, p);
        if (!bg || n === 0) continue;
        rp.setBindGroup(0, bg);
        rp.draw(n, 1, 0, si);
      }
    } else {
      const bg = chart.chartPassBindGroups[p];
      const n = drawCount(chart, 0, p);
      if (bg && n > 0) {
        rp.setBindGroup(0, bg);
        rp.draw(n, 1, 0, 0);
      }
    }
    rp.end();
  }
  if (cp) cp.end();
  for (const s of chart.series) if (!s.hidden) s.stale = false;
  chart.computeStale = false;

  // Highlight pass: the hovered series once more, on top of everything else.
  if (hs >= 0 && hlBindGroup) {
    const n = drawCount(chart, hs, renderer.hl);
    const rp = encoder.beginRenderPass({
      colorAttachments: [colorAttachment(chart, "load", true)],
    });
    rp.setPipeline(renderer.pipelines[renderer.hl] as GPURenderPipeline);
    if (n > 0) {
      rp.setBindGroup(0, hlBindGroup);
      rp.draw(n, 1, 0, hs);
    }
    rp.end();
  }

  // Luma AA blit pass — resolves intermediate texture to canvas
  const blitPass = encoder.beginRenderPass({
    colorAttachments: [{
      view: textureView,
      loadOp: "clear",
      storeOp: "store",
      clearValue: CLEAR_COLOR,
    }],
  });
  blitPass.setPipeline(blitPipeline);
  if (chart.blitBindGroup) blitPass.setBindGroup(0, chart.blitBindGroup);
  blitPass.draw(4);
  blitPass.end();

  device.queue.submit([encoder.finish()]);
}

function scheduleRender(): void {
  if (!renderScheduled && !deviceLost) {
    renderScheduled = true;
    requestAnimationFrame(renderFrame);
  }
}

// A change of data, bounds, view, size or uniforms reruns the compute passes; a style-only change
// (compute = false: theme, background, highlight, hidden series) redraws from the buffers they left.
function markDirty(chart: Chart, compute = true): void {
  if (compute) {
    chart.computeStale = true;
    for (const s of chart.series) s.stale = true;
  }
  chart.dirty = true;
  if (chart.visible) scheduleRender();
}

function markAllDirty(compute = true): void {
  let anyVisible = false;
  for (const chart of charts.values()) {
    if (compute) {
      chart.computeStale = true;
      for (const s of chart.series) s.stale = true;
    }
    chart.dirty = true;
    if (chart.visible) anyVisible = true;
  }
  if (anyVisible) scheduleRender();
}

function renderFrame(): void {
  renderScheduled = false;
  if (deviceLost) return;
  const t0 = performance.now();
  for (const chart of charts.values()) {
    if (chart.visible && chart.dirty && chart.width > 0) {
      renderChart(chart);
      chart.dirty = false;
    }
  }
  lastRenderMs = performance.now() - t0;
  frameCount++;
}

function countActive(): number {
  let n = 0;
  for (const chart of charts.values()) if (chart.visible && chart.width > 0) n++;
  return n;
}

async function init(): Promise<boolean> {
  if (device) return true;
  if (!navigator.gpu) {
    postMessage({ type: M.ERROR, code: E.NO_GPU });
    return false;
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    postMessage({ type: M.ERROR, code: E.NO_ADAPTER });
    return false;
  }

  device = await adapter.requestDevice({
    requiredLimits: {
      maxBufferSize: adapter.limits.maxBufferSize,
      maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
    },
  });
  canvasFormat = navigator.gpu.getPreferredCanvasFormat();

  // Reported once; from then on the worker renders nothing and ignores further messages, and the
  // main thread replaces it with a new worker and device (K12).
  device.lost.then(() => {
    if (deviceLost) return;
    deviceLost = true;
    if (statsInterval) {
      clearInterval(statsInterval);
      statsInterval = null;
    }
    postMessage({ type: M.ERROR, code: E.DEVICE_LOST });
  });

  blitLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
    ],
  });
  const blitModule = device.createShaderModule({ code: BLIT_SHADER });
  blitPipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [blitLayout] }),
    vertex: { module: blitModule, entryPoint: "vs" },
    fragment: { module: blitModule, entryPoint: "fs", targets: [{ format: canvasFormat }] },
    primitive: { topology: "triangle-strip" },
  });
  blitSampler = device.createSampler({ magFilter: "linear", minFilter: "linear" });

  statsInterval = setInterval(() => {
    postMessage({
      type: M.STATS,
      fps: frameCount,
      renderMs: lastRenderMs,
      totalCharts: charts.size,
      activeCharts: countActive(),
    });
    frameCount = 0;
  }, 1000);

  postMessage({ type: M.GPU_READY });
  return true;
}

function destroySeriesData(series: ChartSeriesData): void {
  if (series.ownsX !== false) series.dataX.destroy();
  series.dataY.destroy();
  for (const [, buf] of series.extraBuffers) buf.destroy();
  for (const [, buf] of series.seriesBuffers) buf.destroy();
  series.seriesIndexBuffer.destroy();
}

// Writes k floats of src (from element srcOffset) into buf, which holds `columns` floats, from
// column col on, clipped to the buffer: a patch that does not fit can never write past its end.
function writeColumns(buf: GPUBuffer, columns: number, col: number, src: F32, srcOffset: number, k: number): void {
  const n = Math.min(k, columns - col, src.length - srcOffset);
  if (col >= 0 && n > 0) device.queue.writeBuffer(buf, col * 4, src, srcOffset, n);
}

function processUpdateSeries(
  id: string,
  seriesData: Array<{
    label: string;
    colorR: number;
    colorG: number;
    colorB: number;
    dataX: F32 | null;
    dataY: F32;
    extra: Record<string, F32>;
    hidden: boolean;
  }>,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  bufferSizes: Record<string, number>,
  perSeriesPassMeta: PassMeta[][],
  capacity?: number,
  sharedX?: F32 | null
): void {
  const chart = charts.get(id);
  if (!chart || !device) return;

  const renderer = renderers.get(chart.rendererName);
  if (!renderer) {
    postMessage({ type: M.ERROR, code: E.NO_RENDERER });
    return;
  }

  try {
    chart.minX = bounds.minX;
    chart.maxX = bounds.maxX;
    chart.minY = bounds.minY;
    chart.maxY = bounds.maxY;
    chart.perSeriesPassMeta = perSeriesPassMeta;

    for (const s of chart.series) destroySeriesData(s);
    if (chart.sharedX) {
      chart.sharedX.destroy();
      chart.sharedX = null;
    }
    chart.series = [];
    if (chart.seriesStorageBuffer) {
      chart.seriesStorageBuffer.destroy();
      chart.seriesStorageBuffer = null;
    }
    chart.chartPassBindGroups = [];
    chart.bindGroupsStale = true;
    chart.seriesInfoDirty = true;
    chart.capacity = 0;
    // No series (K2): the per-series resources are gone, and renderChart presents a cleared frame.
    if (seriesData.length === 0) return;

    chart.seriesStorageBuffer = device.createBuffer({
      size: Math.max(32, seriesData.length * 32),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    allocateChartBuffers(chart, renderer, bufferSizes);

    // Data buffers are sized to the capacity so PATCH_SERIES can write further columns in place;
    // a buffer made for len values holds cols(len) columns.
    const usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;
    const cols = (len: number) => Math.max(capacity || 0, len);
    const mk = (len: number) => device.createBuffer({ size: Math.max(16, cols(len) * 4), usage });
    if (sharedX) {
      chart.sharedX = mk(sharedX.length);
      device.queue.writeBuffer(chart.sharedX, 0, sharedX);
    }
    chart.capacity = Math.max(capacity || 0, sharedX ? sharedX.length : 0);

    for (let i = 0; i < seriesData.length; i++) {
      const sd = seriesData[i];
      let dataX: GPUBuffer;
      if (sharedX) dataX = chart.sharedX!;
      else {
        dataX = mk(sd.dataX!.length);
        device.queue.writeBuffer(dataX, 0, sd.dataX!);
      }
      const dataY = mk(sd.dataY.length);
      device.queue.writeBuffer(dataY, 0, sd.dataY);

      const xLen = sharedX ? sharedX.length : sd.dataX!.length;
      let columns = Math.min(cols(xLen), cols(sd.dataY.length));
      const extraBuffers = new Map<string, GPUBuffer>();
      for (const [key, arr] of Object.entries(sd.extra ?? {})) {
        const buf = mk(arr.length);
        device.queue.writeBuffer(buf, 0, arr);
        extraBuffers.set(key, buf);
        columns = Math.min(columns, cols(arr.length));
      }

      // A column needs its x, its y and room in every buffer.
      const n = Math.min(sd.dataY.length, xLen, columns);
      const series: ChartSeriesData = {
        label: sd.label,
        colorR: sd.colorR,
        colorG: sd.colorG,
        colorB: sd.colorB,
        dataX,
        ownsX: !sharedX,
        dataY,
        extraBuffers,
        seriesBuffers: new Map(),
        seriesIndexBuffer: createSeriesIndexBuffer(i),
        columns,
        pointCount: n,
        visibleStart: 0,
        visibleCount: n,
        hidden: sd.hidden ?? false,
        stale: true,
        passBindGroups: [],
        hlBindGroup: null,
      };
      chart.series.push(series);
      allocateSeriesBuffers(series, renderer, bufferSizes);
    }
  } catch (e) {
    postMessage({ type: M.ERROR, code: E.UPDATE, message: String(e) });
  }
}

self.onmessage = async (e: MessageEvent) => {
  const { type, ...data } = e.data;
  if (deviceLost) return;

  switch (type) {
    case M.INIT:
      isDark = data.isDark || false;
      await init();
      break;

    case M.THEME:
      isDark = data.isDark;
      markAllDirty(false);
      break;

    case M.REGISTER_RENDERER: {
      if (!device) {
        postMessage({ type: M.ERROR, code: E.NOT_READY });
        break;
      }
      const config: WorkerRendererConfig = {
        name: data.name,
        shaders: data.shaders,
        passes: data.passes,
        bufferDefs: data.bufferDefs ?? [],
        uniformDefs: data.uniformDefs ?? [],
      };
      try {
        renderers.set(data.name, compileRenderer(config));
      } catch (e) {
        postMessage({ type: M.ERROR, code: E.COMPILE, message: String(e) });
      }
      break;
    }

    case M.REGISTER_CHART: {
      if (!device) break;
      const ctx = (data.canvas as OffscreenCanvas).getContext("webgpu");
      if (!ctx) {
        postMessage({ type: M.ERROR, code: E.CTX_GET });
        break;
      }
      try {
        ctx.configure({ device, format: canvasFormat, alphaMode: "premultiplied" });
      } catch (e) {
        postMessage({ type: M.ERROR, code: E.CTX_CFG });
        break;
      }

      const limit = device.limits.maxTextureDimension2D;
      const w = Math.min(Math.max(1, Math.floor(Number(data.canvas.width) || 800)), limit);
      const h = Math.min(Math.max(1, Math.floor(Number(data.canvas.height) || 400)), limit);

      const chart: Chart = {
        id: data.id,
        canvas: data.canvas,
        ctx,
        rendererName: data.rendererName,
        visible: true,
        series: [],
        uniformBuffer: device.createBuffer({
          size: 80,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        }),
        seriesStorageBuffer: null,
        seriesInfoDirty: false,
        outputTexture: null,
        outputTextureView: null,
        msaaTexture: null,
        msaaView: null,
        blitBindGroup: null,
        texRenderer: null,
        chartBuffers: new Map(),
        customUniformBuffer: null,
        customUniformValues: data.customUniformValues ?? {},
        chartPassBindGroups: [],
        bindGroupsStale: true,
        perSeriesPassMeta: data.perSeriesPassMeta ?? [],
        width: w,
        height: h,
        panX: 0,
        panY: 0,
        zoomX: 1,
        zoomY: 1,
        minX: 0,
        maxX: 1,
        maxY: 1,
        minY: 0,
        bgColor: data.bgColor ?? null,
        sharedX: null,
        capacity: 0,
        highlight: -1,
        hlSeries: -1,
        dirty: true,
        computeStale: true,
      };

      try {
        createChartTexture(chart);
      } catch (e) {
        postMessage({ type: M.ERROR, code: E.TEX });
        break;
      }

      charts.set(data.id, chart);
      break;
    }

    case M.UNREGISTER_CHART: {
      const chart = charts.get(data.id);
      if (chart) {
        try { chart.ctx.unconfigure(); } catch {}
        chart.uniformBuffer.destroy();
        if (chart.seriesStorageBuffer) chart.seriesStorageBuffer.destroy();
        if (chart.outputTexture) chart.outputTexture.destroy();
        if (chart.msaaTexture) chart.msaaTexture.destroy();
        if (chart.customUniformBuffer) chart.customUniformBuffer.destroy();
        for (const [, buf] of chart.chartBuffers) buf.destroy();
        for (const s of chart.series) destroySeriesData(s);
        if (chart.sharedX) chart.sharedX.destroy();
        charts.delete(data.id);
      }
      break;
    }

    case M.UPDATE_SERIES: {
      processUpdateSeries(
        data.id,
        data.series ?? [],
        data.bounds,
        data.bufferSizes ?? {},
        data.perSeriesPassMeta ?? [],
        data.capacity,
        data.sharedX
      );
      const chart = charts.get(data.id);
      if (chart) markDirty(chart);
      break;
    }

    // Follow mode: write columns [offset, offset + k) of every series into the existing buffers.
    // `packed` holds y of every series, then each extra channel of every series, k floats apiece.
    // Columns [start, count) are drawn (start defaults to 0), so a sliding window can drop old
    // columns by moving `start` instead of rewriting the ones it keeps.
    case M.PATCH_SERIES: {
      const chart = charts.get(data.id);
      if (!chart || !device) break;
      try {
        const off = data.offset | 0;
        const k = data.k | 0;
        const n = chart.series.length;
        const packed: F32 | null = data.packed;
        const extra: string[] = data.extra || [];
        if (data.bounds) {
          chart.minX = data.bounds.minX;
          chart.maxX = data.bounds.maxX;
          chart.minY = data.bounds.minY;
          chart.maxY = data.bounds.maxY;
        }
        if (data.x && k > 0) {
          if (chart.sharedX) writeColumns(chart.sharedX, chart.capacity, off, data.x, 0, k);
          else for (const s of chart.series) writeColumns(s.dataX, s.columns, off, data.x, 0, k);
        }
        if (packed && k > 0) {
          for (let i = 0; i < n; i++) {
            const s = chart.series[i];
            writeColumns(s.dataY, s.columns, off, packed, i * k, k);
            for (let e = 0; e < extra.length; e++) {
              const buf = s.extraBuffers.get(extra[e]);
              if (buf) writeColumns(buf, s.columns, off, packed, ((e + 1) * n + i) * k, k);
            }
          }
        }
        const count = Math.max(0, data.count | 0);
        const start = Math.max(0, data.start | 0);
        for (const s of chart.series) {
          s.pointCount = Math.min(count, s.columns);
          s.visibleStart = Math.min(start, s.pointCount);
          s.visibleCount = s.pointCount - s.visibleStart;
        }
        chart.seriesInfoDirty = true;
      } catch (e) {
        postMessage({ type: M.ERROR, code: E.UPDATE, message: String(e) });
      }
      markDirty(chart);
      break;
    }

    case M.SET_BOUNDS: {
      const chart = charts.get(data.id);
      if (chart) {
        chart.minX = data.bounds.minX;
        chart.maxX = data.bounds.maxX;
        chart.minY = data.bounds.minY;
        chart.maxY = data.bounds.maxY;
        markDirty(chart);
      }
      break;
    }

    case M.RESIZE: {
      const chart = charts.get(data.id);
      if (!chart || !(data.width > 0) || !(data.height > 0)) break;

      const limit = device.limits.maxTextureDimension2D;
      const w = Math.min(Math.floor(data.width), limit);
      const h = Math.min(Math.floor(data.height), limit);

      if (w === chart.width && h === chart.height) break;

      chart.width = w;
      chart.height = h;
      chart.canvas.width = w;
      chart.canvas.height = h;
      if (data.perSeriesPassMeta?.length > 0) {
        chart.perSeriesPassMeta = data.perSeriesPassMeta;
      }

      // The targets follow the size; renderChart makes them anew once per frame, however many
      // RESIZE messages a drag sends in between. Buffers only ever grow, with headroom, so a
      // shrink or a drag keeps them - and the bind groups and state (boids) that go with them.
      releaseChartTextures(chart);
      const renderer = renderers.get(chart.rendererName);
      try {
        if (renderer && data.bufferSizes) {
          let made = allocateChartBuffers(chart, renderer, data.bufferSizes, true);
          for (const s of chart.series)
            if (allocateSeriesBuffers(s, renderer, data.bufferSizes, true)) made = true;
          if (made) chart.bindGroupsStale = true;
        }
      } catch (e) {
        postMessage({ type: M.ERROR, code: E.RESIZE, message: String(e) });
      }
      markDirty(chart);
      break;
    }

    case M.VIEW_TRANSFORM: {
      const chart = charts.get(data.id);
      if (chart) {
        chart.panX = data.panX;
        chart.panY = data.panY;
        chart.zoomX = Math.max(0.1, Math.min(1000000, data.zoomX));
        chart.zoomY = Math.max(0.1, Math.min(1000000, data.zoomY));
        markDirty(chart);
      }
      break;
    }

    case M.BATCH_VIEW_TRANSFORM: {
      const zX = Math.max(0.1, Math.min(1000000, data.zoomX));
      const zY = Math.max(0.1, Math.min(1000000, data.zoomY));
      for (const t of data.transforms) {
        const chart = charts.get(t.id);
        if (chart) {
          chart.panX = data.panX;
          chart.panY = data.panY;
          chart.zoomX = zX;
          chart.zoomY = zY;
          markDirty(chart);
        }
      }
      break;
    }

    // Off screen, a chart frees its render targets (the 4x multisampled one is the bulk of its
    // video memory); the canvas keeps showing its last frame.
    case M.SET_VISIBILITY: {
      const chart = charts.get(data.id);
      if (chart) {
        chart.visible = data.visible;
        if (!data.visible) releaseChartTextures(chart);
        else if (chart.dirty) scheduleRender();
      }
      break;
    }

    case M.SET_STYLE: {
      const chart = charts.get(data.id);
      if (chart) {
        if (data.bgColor !== undefined) chart.bgColor = data.bgColor;
        if (data.highlightSeries !== undefined) chart.highlight = data.highlightSeries;
        if (data.hiddenSeries !== undefined) {
          for (let i = 0; i < chart.series.length; i++)
            chart.series[i].hidden = (data.hiddenSeries as Set<number>).has(i);
        }
        // Style only: a series shown again is computed if its output went stale while hidden.
        markDirty(chart, false);
      }
      break;
    }

    case M.SET_UNIFORMS: {
      const chart = charts.get(data.id);
      if (!chart) break;
      Object.assign(chart.customUniformValues, data.values);
      const renderer = renderers.get(chart.rendererName);
      if (renderer) writeCustomUniforms(chart, renderer.config);
      markDirty(chart);
      break;
    }
  }
};
