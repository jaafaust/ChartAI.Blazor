export type ZoomMode = "both" | "x-only" | "y-only" | "none";

export type BlendFactor =
  | "zero" | "one"
  | "src" | "one-minus-src"
  | "src-alpha" | "one-minus-src-alpha"
  | "dst" | "one-minus-dst"
  | "dst-alpha" | "one-minus-dst-alpha"
  | "src-alpha-saturated"
  | "constant" | "one-minus-constant";

export type BlendOperation = "add" | "subtract" | "reverse-subtract" | "min" | "max";

export interface BlendComponent {
  srcFactor?: BlendFactor;
  dstFactor?: BlendFactor;
  operation?: BlendOperation;
}

export interface BlendState {
  color: BlendComponent;
  alpha: BlendComponent;
}

export interface ChartColor { r: number; g: number; b: number; }

// Sample data: a plain array or any typed array. A missing sample is null or NaN on the JS
// side; ChartManager maps it to a sentinel the shaders treat as a gap.
export type DataArray = ArrayLike<number> & Iterable<number>;

export interface Bounds { minX: number; maxX: number; minY: number; maxY: number; }

export interface ChartSeries {
  label: string;
  color: ChartColor | string;
  x: DataArray;
  y: DataArray;
  hidden?: boolean;
  // Id (or index) of the entry in ChartConfig.yAxes this series is scaled by. Default: the first.
  yAxis?: string | number;
  [key: string]: any;
}

// One y axis of a chart with several (ChartConfig.yAxes). The first axis defines the plot
// space; series on any other axis are remapped into it (see ChartManager.refreshSeriesData).
export interface YAxisDef {
  id?: string;
  side?: "left" | "right";
  width?: number;
  format?: (value: number) => string;
  color?: string;
  min?: number;
  max?: number;
}

// YAxisDef with defaults applied, plus the affine map into primary-axis space
// (plotY = y * scale + offset) once the data has been processed.
export interface ResolvedYAxis {
  id: string;
  side: "left" | "right";
  width: number;
  format?: (value: number) => string;
  color?: string;
  min?: number;
  max?: number;
  scale?: number;
  offset?: number;
}

export interface HoverData {
  x: number;
  // y in plot (primary-axis) space, value in the series' own axis units.
  y: number;
  value: number;
  index: number;
  screenX: number;
  screenY: number;
  seriesIndex: number;
  seriesLabel: string;
}

// Chart.patchData: columns [offset, count) of every series, written into the GPU buffers
// updateSeries allocated (up to ChartConfig.capacity columns) without recreating them.
export interface SeriesPatch {
  offset: number;
  count: number;
  // The first valid column (default 0): columns below it are dropped without moving the data,
  // so a sliding window costs its delta. Hover and bounds ignore them; the GPU skips them.
  start?: number;
  // The shared x array (all series of a patched chart share one x array). Omitted: x is
  // unchanged (the last x array passed stays in use).
  x?: DataArray | null;
  // Per series: the full y array of length `count` plus the renderer's extra arrays (lo/hi, ...).
  series: Array<{ y: DataArray; [key: string]: DataArray | undefined }>;
  // Moves the runtime window (never config.defaultBounds).
  bounds?: Bounds;
}

export interface UpdateSeriesOptions {
  // Columns to allocate GPU buffers for, so patchData can append later without reallocating.
  capacity?: number;
  // The runtime window: overrides the data and config.defaultBounds for the sides it sets. A
  // full update without it resets the window to config.defaultBounds and the data.
  bounds?: Partial<Bounds>;
}

// Chart.configure: a key present with value null (or undefined) resets that option to its
// default; keys left out keep their current value.
export type ConfigPatch<C> = { [K in keyof C]?: C[K] | null };

// ChartManager.setSyncViews: which axes linked charts share.
export type SyncViews = false | "x" | "y" | "both";

export interface RenderContext {
  width: number;
  height: number;
  samples: number;
  seriesCount: number;
  bounds: Bounds;
  view: { panX: number; panY: number; zoomX: number; zoomY: number };
}

export interface BindingDef {
  binding: number;
  source: string;
  write?: boolean;
}

export interface PassDef {
  type: "compute" | "render";
  shader: string;
  bindings: BindingDef[];
  perSeries?: boolean;
  dispatch?: (ctx: RenderContext) => { x: number; y?: number; z?: number };
  topology?: string;
  loadOp?: "clear" | "load";
  blend?: BlendState;
  draw?: (ctx: RenderContext) => number;
  // A highlight pass runs after all others, for the hovered series only (see hover plugin).
  highlight?: boolean;
}

export type BufferUsage = "STORAGE" | "VERTEX" | "UNIFORM" | "INDEX" | "INDIRECT" | "COPY_SRC" | "COPY_DST";

export interface BufferDef {
  name: string;
  bytes: (ctx: RenderContext) => number;
  usages: BufferUsage[];
}

export interface UniformDef {
  name: string;
  type: "f32" | "u32";
  default: number;
  // Names a config value may use instead of the number (stepMode: "center" -> 2). A u32 given
  // as [r, g, b] (0..1) is packed like packRGB in charts/candlestick.ts.
  values?: Record<string, number>;
  // An absolute x value (histogram minValue/maxValue): it is rebased by the chart's x origin
  // like the x data before it reaches the GPU.
  xPosition?: boolean;
}

export interface PassMeta {
  dispatch?: { x: number; y?: number; z?: number };
  draw?: number;
}

export interface ChartConfig {
  type: string;
  container: HTMLElement;
  series: ChartSeries[];
  defaultBounds?: Partial<Bounds>;
  bgColor?: [number, number, number];
  hiddenSeries?: Set<number>;
  // Columns to allocate GPU buffers for up front (follow mode, see Chart.patchData).
  capacity?: number;
  // Several y axes; series pick one with ChartSeries.yAxis. Omit for a single implicit axis.
  yAxes?: YAxisDef[];
  // Gap in px between stacked axis strips on the same side.
  yAxisGap?: number;
}

// Augmented by renderer modules (e.g. `declare module "../types.ts" { interface ChartTypeRegistry { line: LineConfig } }`)
// Drives typed autocomplete on manager.create({ type: "line", ... }) with no explicit generic needed.
export interface ChartTypeRegistry {}

// Augmented by plugin modules. All registered plugin configs are merged as optional fields
// on every manager.create() call — so users get autocomplete for any installed plugin's options.
export interface ChartPluginRegistry {}

// Utility: collapses a union of object types into an intersection (A | B | C → A & B & C).
export type UnionToIntersection<U> =
  (U extends any ? (x: U) => void : never) extends (x: infer I) => void ? I : never;

// All registered plugin config fields merged as optional. Empty when no plugins are imported.
export type AllPluginOptions = keyof ChartPluginRegistry extends never
  ? {}
  : Partial<UnionToIntersection<ChartPluginRegistry[keyof ChartPluginRegistry]>>;

export interface ChartStats {
  fps: number;
  renderMs: number;
  total: number;
  active: number;
}

export interface InternalSeries {
  label: string;
  color: ChartColor;
  // ChartSeries.hidden as given; the legend's toggles are kept apart as overrides by label.
  hidden?: boolean;
  yAxis?: string | number;
  // Index into InternalChart.yAxes (0 for the implicit single axis).
  axisIndex?: number;
  rawX: DataArray;
  rawY: DataArray;
  // rawY remapped into primary-axis space for a series on a secondary axis; rawY otherwise.
  plotY?: DataArray;
  extra: Record<string, DataArray>;
}

export interface InternalChart<C extends ChartConfig = ChartConfig> {
  id: string;
  config: C;
  el: HTMLElement;
  backCanvas: HTMLCanvasElement;
  frontCanvas: HTMLCanvasElement;
  // The canvas whose control went to the GPU worker; replaced when a new worker takes over.
  gpuCanvas?: HTMLCanvasElement;
  // CSS size, and the device pixel ratio the canvases were last sized for.
  width: number;
  height: number;
  dpr: number;
  series: InternalSeries[];
  // Absolute data bounds (float64). The worker gets x relative to originX.
  bounds: Bounds;
  // The window setBounds / patchData({ bounds }) / updateSeries({ bounds }) set; it overrides
  // the data and config.defaultBounds until a full update without bounds. null for none.
  runtimeBounds?: Partial<Bounds> | null;
  // Subtracted from every x (data, bounds, x-position uniforms) before it is converted to
  // float32 for the GPU, so epoch timestamps keep their precision.
  originX?: number;
  view: { panX: number; panY: number; zoomX: number; zoomY: number };
  homeView: { panX: number; panY: number; zoomX: number; zoomY: number };
  visible: boolean;
  dragging: boolean;
  // Stamped by the zoom plugin when a drag (not a tap) ends.
  lastDragEndTime?: number;
  plugins: ChartPlugin<any>[];
  renderer: RendererPlugin;
  customUniforms: Record<string, number>;
  // Columns the GPU buffers hold (>= the longest series).
  capacity?: number;
  // Resolved y axes, null for the implicit single axis.
  yAxes?: ResolvedYAxis[] | null;
}

export interface ChartPlugin<C extends object = object> {
  name: string;
  install?(chart: InternalChart<ChartConfig & C>, el: HTMLElement): void;
  uninstall?(chart: InternalChart<ChartConfig & C>): void;
  resetView?(chart: InternalChart<ChartConfig & C>): void;
  beforeDraw?(ctx: CanvasRenderingContext2D, chart: InternalChart<ChartConfig & C>): void;
  afterDraw?(ctx: CanvasRenderingContext2D, chart: InternalChart<ChartConfig & C>): void;
}

export interface RendererPlugin {
  name: string;
  shaders: Record<string, string>;
  passes: PassDef[];
  buffers?: BufferDef[];
  uniforms?: UniformDef[];
  // Absolute data bounds; `chart` gives the config and size (width, dpr) they may depend on.
  computeBounds?(series: InternalSeries[], chart: InternalChart<any>): Bounds;
  // computeBounds depends on the chart size: the bounds are recomputed on resize (without
  // re-uploading the data).
  boundsDependOnSize?: boolean;
  // false: x is used as given (not sorted). Default true; hover binary-searches sorted x.
  sortX?: boolean;
  // Runs before the uniforms are read from the config (it may normalise config values).
  install?(chart: InternalChart<any>, el: HTMLElement): void;
  uninstall?(chart: InternalChart<any>): void;
}
