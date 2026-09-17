// @ts-nocheck — WebGPU globals available in worker context

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
  blend?: any;
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
  pipelines: Map<string, GPURenderPipeline | GPUComputePipeline>;
  passLayouts: Map<string, GPUBindGroupLayout>;
  // 4x MSAA for the render passes; off when a compute pass writes the render target directly.
  msaa: boolean;
  // Index of the highlight pass, -1 when the renderer has none.
  hl: number;
}

interface PassMeta {
  dispatch?: { x: number; y?: number; z?: number; xCount?: number };
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
  pointCount: number;
  visibleStart: number;
  visibleCount: number;
  hidden: boolean;
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
  outputTexture: GPUTexture | null;
  outputTextureView: GPUTextureView | null;
  msaaTexture: GPUTexture | null;
  msaaView: GPUTextureView | null;
  blitBindGroup: GPUBindGroup | null;
  chartBuffers: Map<string, GPUBuffer>;
  customUniformBuffer: GPUBuffer | null;
  customUniformValues: Record<string, number>;
  chartPassBindGroups: (GPUBindGroup | null)[];
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
  dirty: boolean;
}

let device: GPUDevice, canvasFormat: GPUTextureFormat;
const charts = new Map<string, Chart>();
const renderers = new Map<string, CompiledRenderer>();
let isDark = false;

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
  write: boolean | undefined,
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

function compileRenderer(config: WorkerRendererConfig): CompiledRenderer {
  const pipelines = new Map<string, GPURenderPipeline | GPUComputePipeline>();
  const passLayouts = new Map<string, GPUBindGroupLayout>();
  // A compute pass writing the render target as a storage texture rules out multisampling.
  const msaa = !config.passes.some(
    (p) =>
      p.type === "compute" &&
      p.bindings.some((b) => b.source === "render-target" && b.write)
  );

  for (let passIdx = 0; passIdx < config.passes.length; passIdx++) {
    const pass = config.passes[passIdx];

    const layoutEntries: GPUBindGroupLayoutEntry[] = pass.bindings.map((b) => ({
      binding: b.binding,
      ...getBindingLayoutEntry(b.source, b.write, pass.type),
    }));

    const layout = device.createBindGroupLayout({ entries: layoutEntries });
    passLayouts.set(`pass-${passIdx}`, layout);

    const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });
    const shaderModule = device.createShaderModule({ code: config.shaders[pass.shader] });

    if (pass.type === "compute") {
      pipelines.set(
        `pass-${passIdx}`,
        device.createComputePipeline({
          layout: pipelineLayout,
          compute: { module: shaderModule, entryPoint: "main" },
        })
      );
    } else {
      pipelines.set(
        `pass-${passIdx}`,
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

  return {
    config,
    pipelines,
    passLayouts,
    msaa,
    hl: config.passes.findIndex((p) => p.highlight),
  };
}

function writeAllSeriesData(chart: Chart): void {
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

function writeUniforms(chart: Chart, series: ChartSeriesData): void {
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
  u32[6]  = series.pointCount;
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
    const val = chart.customUniformValues[def.name] ?? def.default;
    if (def.type === "u32") u32[i] = val >>> 0;
    else f32[i] = val;
  }
  device.queue.writeBuffer(chart.customUniformBuffer, 0, buffer);
}

function allocateChartBuffers(
  chart: Chart,
  renderer: CompiledRenderer,
  bufferSizes: Record<string, number>
): void {
  for (const [, buf] of chart.chartBuffers) buf.destroy();
  chart.chartBuffers.clear();

  for (const bufDef of renderer.config.bufferDefs) {
    if (!bufDef.perSeries) {
      const size = Math.max(16, bufferSizes[bufDef.name] ?? 16);
      chart.chartBuffers.set(
        bufDef.name,
        device.createBuffer({ size, usage: parseUsageFlags(bufDef.usages) })
      );
    }
  }

  if (renderer.config.uniformDefs.length > 0) {
    if (chart.customUniformBuffer) chart.customUniformBuffer.destroy();
    const alignedSize = Math.max(16, Math.ceil(renderer.config.uniformDefs.length * 4 / 16) * 16);
    chart.customUniformBuffer = device.createBuffer({
      size: alignedSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    writeCustomUniforms(chart, renderer.config);
  }
}

function allocateSeriesBuffers(
  series: ChartSeriesData,
  seriesIndex: number,
  renderer: CompiledRenderer,
  bufferSizes: Record<string, number>
): void {
  for (const [, buf] of series.seriesBuffers) buf.destroy();
  series.seriesBuffers.clear();

  for (const bufDef of renderer.config.bufferDefs) {
    if (bufDef.perSeries) {
      const size = Math.max(16, bufferSizes[bufDef.name] ?? 16);
      series.seriesBuffers.set(
        bufDef.name,
        device.createBuffer({ size, usage: parseUsageFlags(bufDef.usages) })
      );
    }
  }

  if (series.seriesIndexBuffer) series.seriesIndexBuffer.destroy();
  series.seriesIndexBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(series.seriesIndexBuffer, 0, new Uint32Array([seriesIndex, 0, 0, 0]));
}

function buildAllBindGroups(chart: Chart, renderer: CompiledRenderer): void {
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

      const layout = renderer.passLayouts.get(`pass-${passIdx}`)!;
      try {
        const entries: GPUBindGroupEntry[] = pass.bindings.map((b) => ({
          binding: b.binding,
          resource: getBindingResource(b.source, b.write, chart, series, renderer),
        }));
        series.passBindGroups.push(device.createBindGroup({ layout, entries }));
      } catch (e) {
        postMessage({ type: M.ERROR, code: E.BIND_S, message: String(e) });
        series.passBindGroups.push(null);
      }
    }
  }

  chart.chartPassBindGroups = [];
  for (let passIdx = 0; passIdx < renderer.config.passes.length; passIdx++) {
    const pass = renderer.config.passes[passIdx];
    if (pass.perSeries) {
      chart.chartPassBindGroups.push(null);
      continue;
    }
    const layout = renderer.passLayouts.get(`pass-${passIdx}`)!;
    try {
      const entries: GPUBindGroupEntry[] = pass.bindings.map((b) => ({
        binding: b.binding,
        resource: getBindingResource(b.source, b.write, chart, null, renderer),
      }));
      chart.chartPassBindGroups.push(device.createBindGroup({ layout, entries }));
    } catch (e) {
      postMessage({ type: M.ERROR, code: E.BIND_C, message: String(e) });
      chart.chartPassBindGroups.push(null);
    }
  }
}

function createChartTexture(chart: Chart): void {
  if (chart.outputTexture) chart.outputTexture.destroy();

  const w = Math.max(1, chart.width);
  const h = Math.max(1, chart.height);

  const renderer = renderers.get(chart.rendererName);
  let usage = GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT;

  if (renderer) {
    for (const pass of renderer.config.passes) {
      if (pass.type === "compute") {
        for (const b of pass.bindings) {
          if (b.source === "render-target" && b.write) {
            usage |= GPUTextureUsage.STORAGE_BINDING;
            break;
          }
        }
      }
    }
  }

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
  if (chart.msaaTexture) {
    chart.msaaTexture.destroy();
    chart.msaaTexture = null;
    chart.msaaView = null;
  }
  if (renderer && renderer.msaa) {
    chart.msaaTexture = device.createTexture({
      size: [w, h],
      format: "rgba8unorm",
      sampleCount: 4,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    chart.msaaView = chart.msaaTexture.createView();
  }
}

function colorAttachment(chart: Chart, loadOp: GPULoadOp): GPURenderPassColorAttachment {
  return {
    view: chart.msaaView ?? chart.outputTextureView!,
    resolveTarget: chart.msaaView ? chart.outputTextureView! : undefined,
    loadOp,
    storeOp: "store",
    clearValue: { r: 0, g: 0, b: 0, a: 0 },
  };
}

function renderChart(chart: Chart): void {
  const renderer = renderers.get(chart.rendererName);
  if (!renderer) return;
  if (!chart.ctx || chart.width === 0 || chart.height === 0 || chart.series.length === 0) return;

  // The chart may have been registered before its renderer compiled: create the MSAA target now.
  if (renderer.msaa && !chart.msaaView) createChartTexture(chart);

  let hs = chart.highlight ?? -1;
  if (
    renderer.hl < 0 ||
    hs < 0 ||
    hs >= chart.series.length ||
    chart.series[hs].hidden ||
    chart.series[hs].pointCount === 0
  )
    hs = -1;
  chart.hlSeries = hs;

  let textureView: GPUTextureView;
  try {
    textureView = chart.ctx.getCurrentTexture().createView();
  } catch {
    return;
  }

  const encoder = device.createCommandEncoder();

  writeAllSeriesData(chart);
  if (chart.series.length > 0) writeUniforms(chart, chart.series[0]);

  // Clear intermediate texture
  const clearPass = encoder.beginRenderPass({
    colorAttachments: [colorAttachment(chart, "clear")],
  });
  clearPass.end();

  for (let passIdx = 0; passIdx < renderer.config.passes.length; passIdx++) {
    const pass = renderer.config.passes[passIdx];
    const pipeline = renderer.pipelines.get(`pass-${passIdx}`);
    if (!pipeline || pass.highlight) continue;

    if (pass.type === "compute") {
      if (pass.perSeries) {
        for (let si = 0; si < chart.series.length; si++) {
          const series = chart.series[si];
          if (series.pointCount === 0 || series.hidden) continue;

          writeUniforms(chart, series);

          const meta = chart.perSeriesPassMeta[si]?.[passIdx];
          const dispatch = meta?.dispatch ?? { x: 1 };

          const bg = series.passBindGroups[passIdx];
          if (!bg) continue;

          const cp = encoder.beginComputePass();
          cp.setPipeline(pipeline as GPUComputePipeline);
          cp.setBindGroup(0, bg);
          cp.dispatchWorkgroups(dispatch.x, dispatch.y ?? 1, dispatch.z ?? 1);
          cp.end();
        }
      } else {
        const bg = chart.chartPassBindGroups[passIdx];
        if (!bg) continue;
        const meta = chart.perSeriesPassMeta[0]?.[passIdx];
        const dispatch = meta?.dispatch ?? { x: 1 };
        const cp = encoder.beginComputePass();
        cp.setPipeline(pipeline as GPUComputePipeline);
        cp.setBindGroup(0, bg);
        cp.dispatchWorkgroups(dispatch.x, dispatch.y ?? 1, dispatch.z ?? 1);
        cp.end();
      }
    } else if (pass.type === "render") {
      const meta0 = chart.perSeriesPassMeta[0]?.[passIdx];
      const drawCount = meta0?.draw ?? 0;

      const rp = encoder.beginRenderPass({
        colorAttachments: [colorAttachment(chart, pass.loadOp ?? "load")],
      });
      rp.setPipeline(pipeline as GPURenderPipeline);

      if (pass.perSeries) {
        for (let si = 0; si < chart.series.length; si++) {
          const series = chart.series[si];
          if (series.pointCount === 0 || series.hidden) continue;
          const bg = series.passBindGroups[passIdx];
          if (!bg) continue;
          rp.setBindGroup(0, bg);
          rp.draw(drawCount, 1, 0, si);
        }
      } else {
        const bg = chart.chartPassBindGroups[passIdx];
        if (bg) {
          rp.setBindGroup(0, bg);
          rp.draw(drawCount, 1, 0, 0);
        }
      }

      rp.end();
    }
  }

  // Highlight pass: the hovered series once more, on top of everything else.
  if (hs >= 0) {
    const passIdx = renderer.hl;
    const pass = renderer.config.passes[passIdx];
    const pipeline = renderer.pipelines.get(`pass-${passIdx}`);
    const series = chart.series[hs];
    if (pipeline && !series.hlBindGroup) {
      try {
        series.hlBindGroup = device.createBindGroup({
          layout: renderer.passLayouts.get(`pass-${passIdx}`)!,
          entries: pass.bindings.map((b) => ({
            binding: b.binding,
            resource: getBindingResource(b.source, b.write, chart, series, renderer),
          })),
        });
      } catch (e) {
        postMessage({ type: M.ERROR, code: E.BIND_S, message: String(e) });
      }
    }
    if (pipeline && series.hlBindGroup) {
      const drawCount = chart.perSeriesPassMeta[hs]?.[passIdx]?.draw ?? 0;
      const rp = encoder.beginRenderPass({
        colorAttachments: [colorAttachment(chart, "load")],
      });
      rp.setPipeline(pipeline as GPURenderPipeline);
      rp.setBindGroup(0, series.hlBindGroup);
      rp.draw(drawCount, 1, 0, hs);
      rp.end();
    }
  }

  // Luma AA blit pass — resolves intermediate texture to canvas
  const blitPass = encoder.beginRenderPass({
    colorAttachments: [{
      view: textureView,
      loadOp: "clear",
      storeOp: "store",
      clearValue: { r: 0, g: 0, b: 0, a: 0 },
    }],
  });
  blitPass.setPipeline(blitPipeline);
  if (chart.blitBindGroup) blitPass.setBindGroup(0, chart.blitBindGroup);
  blitPass.draw(4);
  blitPass.end();

  device.queue.submit([encoder.finish()]);
}

function scheduleRender(): void {
  if (!renderScheduled) {
    renderScheduled = true;
    requestAnimationFrame(renderFrame);
  }
}

function markDirty(chart: Chart): void {
  chart.dirty = true;
  if (chart.visible) scheduleRender();
}

function markAllDirty(): void {
  let anyVisible = false;
  for (const chart of charts.values()) {
    chart.dirty = true;
    if (chart.visible) anyVisible = true;
  }
  if (anyVisible) scheduleRender();
}

function renderFrame(): void {
  renderScheduled = false;
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

  device.lost.then((info) => {
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
  if (series.seriesIndexBuffer) series.seriesIndexBuffer.destroy();
}

function processUpdateSeries(
  id: string,
  seriesData: Array<{
    label: string;
    colorR: number;
    colorG: number;
    colorB: number;
    dataX: Float32Array | null;
    dataY: Float32Array;
    extra: Record<string, Float32Array>;
    hidden: boolean;
  }>,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  bufferSizes: Record<string, number>,
  perSeriesPassMeta: PassMeta[][],
  capacity?: number,
  sharedX?: Float32Array | null
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

    if (chart.seriesStorageBuffer) chart.seriesStorageBuffer.destroy();
    if (seriesData.length > 0) {
      chart.seriesStorageBuffer = device.createBuffer({
        size: Math.max(32, seriesData.length * 32),
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
    }

    allocateChartBuffers(chart, renderer, bufferSizes);

    // Data buffers are sized to the capacity so PATCH_SERIES can write further columns in place.
    const usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;
    const mk = (len: number) =>
      device.createBuffer({ size: Math.max(16, Math.max(capacity || 0, len) * 4), usage });
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

      const extraBuffers = new Map<string, GPUBuffer>();
      for (const [key, arr] of Object.entries(sd.extra ?? {})) {
        const buf = mk(arr.length);
        device.queue.writeBuffer(buf, 0, arr);
        extraBuffers.set(key, buf);
      }

      const n = sd.dataY.length;
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
        seriesIndexBuffer: null as any,
        pointCount: n,
        visibleStart: 0,
        visibleCount: n,
        hidden: sd.hidden ?? false,
        passBindGroups: [],
        hlBindGroup: null,
      };
      chart.series.push(series);
      allocateSeriesBuffers(series, i, renderer, bufferSizes);
    }

    buildAllBindGroups(chart, renderer);
  } catch (e) {
    postMessage({ type: M.ERROR, code: E.UPDATE, message: String(e) });
  }
}

self.onmessage = async (e: MessageEvent) => {
  const { type, ...data } = e.data;

  switch (type) {
    case M.INIT:
      isDark = data.isDark || false;
      await init();
      break;

    case M.THEME:
      isDark = data.isDark;
      markAllDirty();
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
        postMessage({ type: M.ERROR, code: E.COMPILE });
      }
      break;
    }

    case M.REGISTER_CHART: {
      if (!device) break;
      const ctx = data.canvas.getContext("webgpu");
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
        outputTexture: null,
        outputTextureView: null,
        msaaTexture: null,
        msaaView: null,
        blitBindGroup: null,
        chartBuffers: new Map(),
        customUniformBuffer: null,
        customUniformValues: data.customUniformValues ?? {},
        chartPassBindGroups: [],
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
        data.series,
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
    case M.PATCH_SERIES: {
      const chart = charts.get(data.id);
      if (!chart || !device) break;
      try {
        const off = data.offset | 0;
        const k = data.k | 0;
        const n = chart.series.length;
        const packed: Float32Array | null = data.packed;
        const extra: string[] = data.extra || [];
        if (data.bounds) {
          chart.minX = data.bounds.minX;
          chart.maxX = data.bounds.maxX;
          chart.minY = data.bounds.minY;
          chart.maxY = data.bounds.maxY;
        }
        if (data.x && k > 0) {
          if (chart.sharedX) device.queue.writeBuffer(chart.sharedX, off * 4, data.x);
          else for (const s of chart.series) device.queue.writeBuffer(s.dataX, off * 4, data.x);
        }
        if (packed && k > 0) {
          for (let i = 0; i < n; i++) {
            const s = chart.series[i];
            device.queue.writeBuffer(s.dataY, off * 4, packed, i * k, k);
            for (let e = 0; e < extra.length; e++) {
              const buf = s.extraBuffers.get(extra[e]);
              if (buf) device.queue.writeBuffer(buf, off * 4, packed, ((e + 1) * n + i) * k, k);
            }
          }
        }
        for (const s of chart.series) {
          s.pointCount = data.count;
          s.visibleCount = data.count;
        }
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
      if (!chart || data.width <= 0 || data.height <= 0) break;

      const limit = device.limits.maxTextureDimension2D;
      const w = Math.min(data.width, limit);
      const h = Math.min(data.height, limit);

      if (w === chart.width && h === chart.height) break;

      chart.width = w;
      chart.height = h;
      chart.canvas.width = w;
      chart.canvas.height = h;
      if (data.perSeriesPassMeta?.length > 0) {
        chart.perSeriesPassMeta = data.perSeriesPassMeta;
      }

      const renderer = renderers.get(chart.rendererName);
      try {
        createChartTexture(chart);
        if (renderer && data.bufferSizes) {
          allocateChartBuffers(chart, renderer, data.bufferSizes);
          for (let i = 0; i < chart.series.length; i++) {
            allocateSeriesBuffers(chart.series[i], i, renderer, data.bufferSizes);
          }
          buildAllBindGroups(chart, renderer);
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
          chart.dirty = true;
        }
      }
      scheduleRender();
      break;
    }

    case M.SET_VISIBILITY: {
      const chart = charts.get(data.id);
      if (chart) {
        chart.visible = data.visible;
        if (data.visible && chart.dirty) scheduleRender();
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
        markDirty(chart);
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
