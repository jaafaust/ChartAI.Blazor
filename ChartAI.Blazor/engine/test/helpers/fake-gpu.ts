// A recording fake of the WebGPU API subset the GPU worker uses, plus a bridge that runs the real
// worker module (src/gpu-worker.ts) in-process behind the Worker the main thread creates. Nothing
// is rendered; the fake records buffers, writes, bind groups, passes and submits, and reports
// validation errors a real device would raise (dispatch limits, out-of-bounds writes, destroyed
// resources in a submit) in `violations`.
import { env, FakeOffscreenCanvas, FakeWorker } from "./env.ts";

export const LIMITS = {
  maxTextureDimension2D: 8192,
  maxComputeWorkgroupsPerDimension: 65535,
  maxBufferSize: 2 ** 32,
  maxStorageBufferBindingSize: 2 ** 31,
  maxBindGroups: 4,
  maxUniformBufferBindingSize: 65536,
};

const SHADOW_LIMIT = 1 << 20; // bytes: larger buffers are tracked without their contents

export class FakeBuffer {
  static seq = 0;
  id = ++FakeBuffer.seq;
  size: number;
  usage: number;
  label?: string;
  destroyed = false;
  shadow: Uint8Array | null;
  device: FakeDevice;
  constructor(device: FakeDevice, desc: { size: number; usage: number; label?: string }) {
    this.device = device;
    this.size = desc.size;
    this.usage = desc.usage;
    this.label = desc.label;
    this.shadow = desc.size <= SHADOW_LIMIT ? new Uint8Array(desc.size) : null;
  }
  destroy() {
    this.destroyed = true;
  }
  u32(index: number): number {
    if (!this.shadow) throw new Error("buffer too large to shadow");
    return new DataView(this.shadow.buffer).getUint32(index * 4, true);
  }
}

export class FakeTexture {
  static seq = 0;
  id = ++FakeTexture.seq;
  destroyed = false;
  canvas: unknown;
  desc: any;
  constructor(desc: any, canvas?: unknown) {
    this.desc = desc;
    this.canvas = canvas ?? null;
  }
  createView() {
    return { texture: this };
  }
  destroy() {
    this.destroyed = true;
  }
}

export interface PassRecord {
  kind: "compute" | "render";
  target?: FakeTexture | null;
  loadOp?: string;
  dispatches: [number, number, number][];
  draws: number[][];
  bindGroups: any[];
}

export interface SubmitRecord {
  device: FakeDevice;
  passes: PassRecord[];
}

export interface WriteRecord {
  buffer: FakeBuffer;
  offset: number;
  bytes: number;
}

export class FakeGpu {
  violations: string[] = [];
  devices: FakeDevice[] = [];
  buffers: FakeBuffer[] = [];
  bindGroups: { layout: any; entries: any[] }[] = [];
  writes: WriteRecord[] = [];
  submits: SubmitRecord[] = [];
  canvasTextures: FakeTexture[] = [];

  api = {
    requestAdapter: async () => ({
      limits: { ...LIMITS },
      features: new Set<string>(),
      info: { vendor: "test", architecture: "fake" },
      requestDevice: async () => {
        const d = new FakeDevice(this);
        this.devices.push(d);
        return d;
      },
    }),
    getPreferredCanvasFormat: () => "bgra8unorm",
  };

  get device(): FakeDevice {
    return this.devices[this.devices.length - 1];
  }

  canvasContext(canvas: FakeOffscreenCanvas) {
    const gpu = this;
    let configured: any = null;
    return {
      canvas,
      configure(cfg: any) {
        configured = cfg;
      },
      unconfigure() {
        configured = null;
      },
      getCurrentTexture() {
        if (!configured) gpu.violations.push("getCurrentTexture on an unconfigured canvas context");
        const t = new FakeTexture({ size: [canvas.width, canvas.height] }, canvas);
        gpu.canvasTextures.push(t);
        return t;
      },
      getConfiguration() {
        return configured;
      },
    };
  }

  // Index positions to diff against (see since()).
  mark() {
    return { buffers: this.buffers.length, writes: this.writes.length, submits: this.submits.length, bindGroups: this.bindGroups.length };
  }

  since(m: ReturnType<FakeGpu["mark"]>) {
    return {
      buffers: this.buffers.slice(m.buffers),
      writes: this.writes.slice(m.writes),
      submits: this.submits.slice(m.submits),
      bindGroups: this.bindGroups.slice(m.bindGroups),
    };
  }

  // Buffers bound at `binding` in any bind group created so far.
  boundAt(binding: number): FakeBuffer[] {
    const out = new Set<FakeBuffer>();
    for (const bg of this.bindGroups)
      for (const e of bg.entries) if (e.binding === binding && e.resource?.buffer instanceof FakeBuffer) out.add(e.resource.buffer);
    return [...out];
  }

  latestBoundAt(binding: number): FakeBuffer | undefined {
    for (let i = this.bindGroups.length - 1; i >= 0; i--)
      for (const e of this.bindGroups[i].entries)
        if (e.binding === binding && e.resource?.buffer instanceof FakeBuffer && !e.resource.buffer.destroyed)
          return e.resource.buffer;
    return undefined;
  }
}

export class FakeDevice {
  gpu: FakeGpu;
  limits = { ...LIMITS };
  features = new Set<string>();
  lostAt = -1;
  private resolveLost!: (info: any) => void;
  lost: Promise<any>;
  queue: any;
  onuncapturederror: any = null;

  constructor(gpu: FakeGpu) {
    this.gpu = gpu;
    this.lost = new Promise((r) => (this.resolveLost = r));
    const dev = this;
    this.queue = {
      writeBuffer(buffer: FakeBuffer, offset: number, data: any, dataOffset = 0, size?: number) {
        let bytes: Uint8Array;
        if (ArrayBuffer.isView(data) && !(data instanceof DataView)) {
          const es = (data as any).BYTES_PER_ELEMENT ?? 1;
          const count = size ?? (data as any).length - dataOffset;
          bytes = new Uint8Array(data.buffer, data.byteOffset + dataOffset * es, count * es);
        } else if (data instanceof DataView) {
          bytes = new Uint8Array(data.buffer, data.byteOffset + dataOffset, size ?? data.byteLength - dataOffset);
        } else {
          bytes = new Uint8Array(data, dataOffset, size ?? data.byteLength - dataOffset);
        }
        if (dev.lostAt >= 0) return;
        if (!(buffer instanceof FakeBuffer)) {
          gpu.violations.push("writeBuffer to a non-buffer");
          return;
        }
        if (buffer.destroyed) gpu.violations.push(`writeBuffer to destroyed buffer #${buffer.id}`);
        if (offset % 4 !== 0 || bytes.byteLength % 4 !== 0)
          gpu.violations.push(`writeBuffer misaligned (offset ${offset}, ${bytes.byteLength} bytes)`);
        if (offset + bytes.byteLength > buffer.size) {
          gpu.violations.push(`writeBuffer out of bounds: ${offset}+${bytes.byteLength} > ${buffer.size} (buffer #${buffer.id})`);
          return;
        }
        gpu.writes.push({ buffer, offset, bytes: bytes.byteLength });
        buffer.shadow?.set(bytes, offset);
      },
      submit(cmds: any[]) {
        if (dev.lostAt >= 0) {
          dev.submitsAfterLoss++;
          return;
        }
        const passes: PassRecord[] = cmds.flatMap((c) => c.passes);
        for (const p of passes) {
          for (const bg of p.bindGroups)
            for (const e of bg?.entries ?? []) {
              const b = e.resource?.buffer;
              if (b instanceof FakeBuffer && b.destroyed) gpu.violations.push(`submit uses destroyed buffer #${b.id}`);
              const t = e.resource?.texture;
              if (t instanceof FakeTexture && t.destroyed) gpu.violations.push(`submit uses destroyed texture #${t.id}`);
            }
          if (p.target?.destroyed) gpu.violations.push(`render pass into destroyed texture #${p.target.id}`);
        }
        gpu.submits.push({ device: dev, passes });
      },
      onSubmittedWorkDone: async () => {},
    };
  }

  submitsAfterLoss = 0;

  lose(message = "test: device lost") {
    this.lostAt = this.gpu.submits.length;
    this.resolveLost({ reason: "unknown", message });
  }

  createBuffer(desc: any) {
    if (desc.size > LIMITS.maxBufferSize) this.gpu.violations.push(`createBuffer too large: ${desc.size}`);
    const b = new FakeBuffer(this, desc);
    this.gpu.buffers.push(b);
    return b;
  }
  createTexture(desc: any) {
    const [w, h] = Array.isArray(desc.size) ? desc.size : [desc.size?.width, desc.size?.height];
    if (w > LIMITS.maxTextureDimension2D || h > LIMITS.maxTextureDimension2D)
      this.gpu.violations.push(`createTexture too large: ${w}x${h}`);
    return new FakeTexture(desc);
  }
  createSampler(desc?: any) {
    return { kind: "sampler", desc };
  }
  createBindGroupLayout(desc: any) {
    return { kind: "bgl", desc };
  }
  createPipelineLayout(desc: any) {
    return { kind: "pl", desc };
  }
  createShaderModule(desc: any) {
    return { kind: "shader", code: desc.code, getCompilationInfo: async () => ({ messages: [] }) };
  }
  createComputePipeline(desc: any) {
    return { kind: "compute", desc, getBindGroupLayout: (i: number) => desc.layout?.desc?.bindGroupLayouts?.[i] ?? { kind: "bgl" } };
  }
  createRenderPipeline(desc: any) {
    return { kind: "render", desc, getBindGroupLayout: (i: number) => desc.layout?.desc?.bindGroupLayouts?.[i] ?? { kind: "bgl" } };
  }
  async createComputePipelineAsync(desc: any) {
    return this.createComputePipeline(desc);
  }
  async createRenderPipelineAsync(desc: any) {
    return this.createRenderPipeline(desc);
  }
  createBindGroup(desc: any) {
    for (const e of desc.entries ?? []) {
      const b = e.resource?.buffer;
      if (b instanceof FakeBuffer && b.destroyed) this.gpu.violations.push(`createBindGroup with destroyed buffer #${b.id}`);
      if (b === undefined && e.resource && typeof e.resource === "object" && "buffer" in e.resource)
        this.gpu.violations.push(`createBindGroup binding ${e.binding} without a buffer`);
    }
    const bg = { layout: desc.layout, entries: desc.entries ?? [] };
    this.gpu.bindGroups.push(bg);
    return bg;
  }
  createQuerySet(desc: any) {
    return { desc, destroy() {} };
  }
  createCommandEncoder() {
    const gpu = this.gpu;
    const passes: PassRecord[] = [];
    const check = (x: number, y: number, z: number) => {
      for (const v of [x, y, z])
        if (!Number.isInteger(v) || v < 0 || v > LIMITS.maxComputeWorkgroupsPerDimension)
          gpu.violations.push(`dispatchWorkgroups(${x}, ${y}, ${z}) exceeds the per-dimension limit`);
    };
    return {
      beginComputePass() {
        const rec: PassRecord = { kind: "compute", dispatches: [], draws: [], bindGroups: [] };
        passes.push(rec);
        let current: any[] = [];
        return {
          setPipeline() {},
          setBindGroup(i: number, bg: any) {
            current[i] = bg;
          },
          dispatchWorkgroups(x: number, y = 1, z = 1) {
            check(x, y, z);
            rec.dispatches.push([x, y, z]);
            rec.bindGroups.push(...current.filter(Boolean));
          },
          dispatchWorkgroupsIndirect() {
            rec.dispatches.push([-1, -1, -1]);
          },
          end() {},
        };
      },
      beginRenderPass(desc: any) {
        const att = desc.colorAttachments?.[0];
        const view = att?.view;
        const rec: PassRecord = {
          kind: "render",
          target: view?.texture ?? null,
          loadOp: att?.loadOp,
          dispatches: [],
          draws: [],
          bindGroups: [],
        };
        passes.push(rec);
        let current: any[] = [];
        return {
          setPipeline() {},
          setBindGroup(i: number, bg: any) {
            current[i] = bg;
          },
          draw(...a: number[]) {
            rec.draws.push(a);
            rec.bindGroups.push(...current.filter(Boolean));
          },
          drawIndexed(...a: number[]) {
            rec.draws.push(a);
          },
          drawIndirect() {},
          setViewport() {},
          setScissorRect() {},
          setVertexBuffer() {},
          setIndexBuffer() {},
          setBlendConstant() {},
          end() {},
        };
      },
      copyBufferToBuffer() {},
      clearBuffer() {},
      copyTextureToTexture() {},
      finish() {
        return { passes };
      },
    };
  }
  pushErrorScope() {}
  async popErrorScope() {
    return null;
  }
  addEventListener() {}
  removeEventListener() {}
  destroy() {}
}

export const GPU_CONSTANTS = {
  GPUBufferUsage: {
    MAP_READ: 1,
    MAP_WRITE: 2,
    COPY_SRC: 4,
    COPY_DST: 8,
    INDEX: 16,
    VERTEX: 32,
    UNIFORM: 64,
    STORAGE: 128,
    INDIRECT: 256,
    QUERY_RESOLVE: 512,
  },
  GPUShaderStage: { VERTEX: 1, FRAGMENT: 2, COMPUTE: 4 },
  GPUTextureUsage: { COPY_SRC: 1, COPY_DST: 2, TEXTURE_BINDING: 4, STORAGE_BINDING: 8, RENDER_ATTACHMENT: 16 },
  GPUMapMode: { READ: 1, WRITE: 2 },
  GPUColorWrite: { RED: 1, GREEN: 2, BLUE: 4, ALPHA: 8, ALL: 15 },
};

function define(target: any, name: string, value: unknown) {
  Object.defineProperty(target, name, { value, writable: true, configurable: true });
}

// ─── Worker bridge ───────────────────────────────────────────────────────────

// The worker's global scope as the worker module sees it through `self`.
class WorkerScope {
  onmessage: ((ev: any) => any) | null = null;
  private listeners = new Set<(ev: any) => any>();
  addEventListener(type: string, fn: (ev: any) => any) {
    if (type === "message") this.listeners.add(fn);
  }
  removeEventListener(type: string, fn: (ev: any) => any) {
    if (type === "message") this.listeners.delete(fn);
  }
  handlers(): ((ev: any) => any)[] {
    const hs = [...this.listeners];
    if (this.onmessage) hs.unshift(this.onmessage);
    const g = (globalThis as any).onmessage;
    if (hs.length === 0 && typeof g === "function") hs.push(g);
    return hs;
  }
}

export interface BridgeState {
  gpu: FakeGpu;
  bridges: BridgeWorker[];
  current: BridgeWorker | null;
  errors: unknown[];
  pending: number;
  intervals: unknown[];
}

let state: BridgeState | null = null;
let workerSeq = 0;
let loadChain: Promise<void> = Promise.resolve();

// The Worker the engine creates: records like FakeWorker and forwards to a real worker module.
export class BridgeWorker extends FakeWorker {
  scope = new WorkerScope();
  loaded: Promise<void>;
  queue: any[] = [];
  index: number;
  posts: any[] = []; // messages the worker module posted to the main thread

  constructor(url?: unknown, options?: unknown) {
    super(url, options);
    const s = state!;
    this.index = s.bridges.length;
    s.bridges.push(this);
    s.current = this;
    const scope = this.scope;
    this.loaded = loadChain = loadChain.then(async () => {
      define(globalThis, "self", scope);
      await import(`../../src/gpu-worker.ts?worker-instance=${++workerSeq}`);
    });
  }

  postMessage(msg: any, transfer?: unknown): void {
    super.postMessage(msg, transfer);
    if (this.terminated) return;
    this.deliver(msg);
  }

  // Sends a message to the worker module even after terminate() (to probe a dead worker).
  deliver(msg: any): void {
    const s = state!;
    s.pending++;
    this.loaded.then(() =>
      setTimeout(() => {
        try {
          for (const h of this.scope.handlers()) {
            const r = h({ data: msg, type: "message" });
            if (r && typeof r.then === "function") r.then(undefined, (e: unknown) => s.errors.push(e));
          }
        } catch (e) {
          s.errors.push(e);
        } finally {
          s.pending--;
        }
      }, 0),
    );
  }

  receive(msg: any): void {
    const s = state!;
    this.posts.push(msg);
    if (this.terminated) return;
    s.pending++;
    setTimeout(() => {
      try {
        this.emit(msg);
      } catch (e) {
        s.errors.push(e);
      } finally {
        s.pending--;
      }
    }, 0);
  }
}

const OVERRIDDEN = ["self", "postMessage", "Worker", "setInterval", ...Object.keys(GPU_CONSTANTS)];
let saved: Map<string, PropertyDescriptor | undefined> | null = null;
let savedWindowWorker: PropertyDescriptor | undefined;
let savedNavigatorGpu: PropertyDescriptor | undefined;

// Installs the fake GPU and the bridge for one test; returns the shared state.
export function installGpuBridge(): BridgeState {
  const gpu = new FakeGpu();
  state = { gpu, bridges: [], current: null, errors: [], pending: 0, intervals: [] };
  const s = state;
  if (!saved) {
    saved = new Map(OVERRIDDEN.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
    const w = (globalThis as any).window;
    savedWindowWorker = w && w !== globalThis ? Object.getOwnPropertyDescriptor(w, "Worker") : undefined;
    savedNavigatorGpu = Object.getOwnPropertyDescriptor((globalThis as any).navigator, "gpu");
  }
  for (const [k, v] of Object.entries(GPU_CONSTANTS)) define(globalThis, k, v);
  define((globalThis as any).navigator, "gpu", gpu.api);
  define(globalThis, "Worker", BridgeWorker);
  if ((globalThis as any).window && (globalThis as any).window !== globalThis) define((globalThis as any).window, "Worker", BridgeWorker);
  env().gpuContextFactory = (canvas) => gpu.canvasContext(canvas);
  // The worker's postMessage (a global in a worker) goes to the newest bridge's main side.
  define(globalThis, "postMessage", (msg: any) => s.current?.receive(msg));
  // Track intervals (the worker's stats timer) so they can be cleared after the test.
  const realSetInterval = (globalThis as any).__realSetInterval ?? globalThis.setInterval;
  (globalThis as any).__realSetInterval = realSetInterval;
  define(globalThis, "setInterval", (fn: any, ms?: number, ...args: any[]) => {
    const id = realSetInterval(fn, ms, ...args);
    s.intervals.push(id);
    return id;
  });
  return s;
}

// Clears the worker timers and puts every overridden global back (so the suite also works
// without `bun test --isolate`).
export function uninstallGpuBridge(): void {
  if (!state) return;
  for (const id of state.intervals) clearInterval(id as any);
  state = null;
  if (saved) {
    for (const [k, d] of saved) {
      if (d) Object.defineProperty(globalThis, k, d);
      else delete (globalThis as any)[k];
    }
    const w = (globalThis as any).window;
    if (w && w !== globalThis) {
      if (savedWindowWorker) Object.defineProperty(w, "Worker", savedWindowWorker);
    }
    const nav = (globalThis as any).navigator;
    if (savedNavigatorGpu) Object.defineProperty(nav, "gpu", savedNavigatorGpu);
    else delete nav.gpu;
    saved = null;
  }
  env().gpuContextFactory = null;
}

// Runs frames and message deliveries until everything has settled.
export async function settleBridge(flush: () => number, maxRounds = 50): Promise<void> {
  const s = state!;
  let quiet = 0;
  for (let i = 0; i < maxRounds; i++) {
    const frames = flush();
    await new Promise((r) => setTimeout(r, 1));
    if (frames === 0 && s.pending === 0) {
      if (++quiet >= 2) return;
    } else quiet = 0;
  }
}
