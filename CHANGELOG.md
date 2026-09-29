# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- `BarOpacity` on `ChartConfig` (engine uniform `barOpacity`): the fill opacity of a bar chart's bars, 0 to 1, default 1. The bar shader used a fixed 0.85, but every pixel column a bar covered redrew the whole bar, so the fills stacked to opaque anyway; each bar is now drawn once, which is what makes the opacity take effect.
- `Chart.Ready` (`Task<bool>`): completes with true once the chart is initialized, false when WebGPU is unavailable, initialization failed or the component was disposed first.
- `Chart.RefreshConfigAsync()`: re-send the configuration without re-sending the series.
- `GapDoubleConverter` and `GapNullableDoubleConverter`: NaN and ±Infinity serialize as null wherever the models carry a double.
- Engine: `ChartManager.onViewChange(listener)` and `ChartManager.commitView(chart)`; `computeStats`, `niceTicks`, `toGpu` and `chooseOriginX` are exported.
- Tests: a Bun suite for the engine and the interop module (`bun run test` in `ChartAI.Blazor/engine`) and an xUnit/bUnit project, `ChartAI.Blazor.Tests`. CI runs both.

### Changed
- The chart engine is built from TypeScript again. `ChartAI.Blazor/engine/src` holds the chartai sources (upstream 1.1.0 plus every change this project had made to the bundle), and `engine/build.ts` bundles them with Bun into `wwwroot/chartai.js`. The .NET build runs it when Bun is installed and a source is newer than the bundle; CI rebuilds the bundle and fails when the committed one is stale. The WGSL shaders in the bundle are now minified, as in upstream's own builds.
- Series data crosses JS interop as binary (`byte[]` of float64) instead of JSON numbers, and a shared x is sent once.
- `Config` changes are detected by comparing the serialized JSON, so rebuilding an equal config on every render no longer reconfigures the chart. A key removed from the config, or set to null, resets that option (the interop sends it as null; the engine's `configure` treats null as "back to the default").
- `IsDark = true` sets the theme through `setTheme`, which is global to the page; `initEngine` no longer overrides an explicit `setTheme`.
- `ViewChanged` is raised for linked charts, the minimap, the range selector and `ResetViewAsync` too.
- Linked views (`setSyncViews`) share the visible data range instead of the normalized pan and zoom, so charts with different data extents show the same window.
- Follow mode keeps a start index instead of compacting on every drop; the store compacts when full. Give `Capacity` about twice the window.
- `zoomMode: "none"` leaves the wheel and touch scrolling to the page, and `touch-action` follows the zoom mode.
- A resize keeps a zoomed view's data range instead of resetting to the home view.
- Zoom depth is limited so the visible span stays well above the float64 spacing of the values in view.
- The minimap and range selector draw from a cached thumbnail, leave out hidden series and break lines at gaps; the range selector takes its height from the chart area and accepts touch.
- The stats panel is computed in one streaming pass, cached and throttled; it skips gaps and hidden series and shows a column per y axis.
- Ruler right-click only works while the tool is active and near an endpoint.
- Release workflow: the tagged commit must be on master, a duplicate push fails, and the GitHub release is created only when nuget.org took the package. The .NET build warns and keeps the committed bundle when Bun is not the pinned 1.4.2 (`-p:ChartAiAnyBunVersion=true` builds anyway).

### Fixed
- Axis tick labels could loop forever and freeze the tab at deep zoom on large x values such as epoch milliseconds.
- Charts whose series have different lengths drew every series with the last series' point count.
- x values were sent to the GPU as absolute float32, so epoch timestamps collapsed into steps of about two minutes and a zoomed-in chart went blank; x is now rebased to a per-chart origin.
- `StepMode`, `UpColor`, `DownColor`, `TotalColor`, `PositiveColor` and `NegativeColor` had no effect.
- Data with a very small range (below 1e-4) rendered nothing.
- The histogram's y axis did not match its bins; out-of-range samples and gaps were counted in the edge bins.
- Calls to `SetDataAsync`, `PatchDataAsync` and the other methods made before the chart finished initializing were dropped; they now wait for it.
- JS interop exceptions in `OnParametersSetAsync` could end a Blazor Server circuit, and NaN in x, bounds, annotations or thresholds failed to serialize.
- An empty `Series` (or `SetDataAsync` with no series) left the old data on screen.
- Scatter, bubble and heatmap dropped points beyond 16.7M per series; the histogram count pass exceeded the dispatch limit on very large inputs.
- Bars and candles drew gaps as bars down to the bottom of the plot.
- Series on a secondary y axis counted gaps as 0 in their bounds.
- `SetBoundsAsync` and follow-mode patches overwrote `DefaultBounds`, so later data and `ResetViewAsync` returned to a stale window.
- Series hidden in the legend reappeared on the next data upload.
- A change of the device pixel ratio (moving the window to another monitor) was not picked up.
- A lost GPU device left every chart blank until reload; the engine now restarts the GPU worker and re-uploads the charts.
- Changing `Plugins` replaced live data with the initial `Series`; changing `Config.Type` blanked charts whose series have their own x and dropped `AnnotationClicked`.
- Parameter changes that arrived during initialization were not sent; a component disposed while its module was loading leaked the module.
- `Style` and `Class` changes after initialization were ignored, and a changed `Id` could make calls reach another chart.
- A truncate-only patch never reached the engine.
- The click that ends a pan, and clicks on the legend, ruler button, stats header and annotation pills, were also handled as clicks on the chart (dropping ruler points, pinning tooltips, moving the minimap).
- Line and area charts did not draw buffered samples outside the chart bounds when panned there.
- Candlestick and OHLC charts dropped bars beyond the canvas width when `Interval` was set.
- The error band collapsed when zoomed out if lo and hi were swapped or one side was missing; bubble colours were not premultiplied; tooltip-pin could create invisible pins on gaps.
- Performance: the hover pill no longer redraws every frame once settled and redraws are coalesced per frame; highlight and theme changes no longer rerun the GPU compute passes; resizes reuse GPU buffers; per-frame work no longer grows with the series count as much; off-screen charts free their render targets; bubbles skip off-screen work; the heatmap draws one quad per cell; secondary-axis patches no longer allocate per tick; sorting x uses a typed merge sort and is done once per shared array.

## [1.1.4] - 2026-09-11

### Changed
- `setSyncViews` takes the axes linked charts share: `true` or `"both"` (the default, and the behaviour before 1.1.3), `"x"` or `"y"`. 1.1.3 had made the x axis the only thing shared; that is now the `"x"` mode.

## [1.1.3] - 2026-09-11

### Changed
- Linked views (`setSyncViews`) share only the x axis. Copying the whole view put every chart on the source's y pan and zoom too, so a y zoom on one chart rescaled the others in units that were not theirs.

## [1.1.2] - 2026-09-11

### Added
- Annotation labels are clickable: a click on a label pill raises `Chart.AnnotationClicked` with the annotation's new `Id`, calls `config.onAnnotationClick` in JavaScript and dispatches `chartai-annotation-click` from the host element, and reaches neither the zoom nor the host's own click handlers. The pointer shows a hand over a pill.
- `Annotation.LabelPosition`: `Top` puts a vertical line's label just inside the top of the plot, where the x-axis labels cannot collide with it. Vertical-line labels are laid out in lanes, so neighbours no longer draw over each other.

## [1.1.1] - 2026-09-11

### Fixed
- Error-band, area and baseline-area fills showed a darker vertical seam at every sample once the view was zoomed in far enough for the samples to be sparser than the pixels: the column holding a sample placed its vertex at the pixel centre while the empty columns around it collapsed onto the sample, so the fill strip folded over itself and blended twice.

## [1.1.0] - 2026-09-11

### Added
- `Chart.PatchDataAsync(ChartPatch)`: append or rewrite columns in place. Only the patched columns cross JS interop and only they are written into the existing GPU buffers; `Drop`/`DropBefore` trim a ring buffer, `Bounds` moves the window, `ResetView` puts the view home. `ChartConfig.Capacity` sizes the buffers; they grow when a patch does not fit.
- `Chart.SetBoundsAsync` and `Chart.SetDataAsync(series, capacity, bounds)`.
- `Chart.ViewChanged`: the data range visible in the plot area once a zoom or pan gesture has settled.
- `Chart.UnavailableText`: a notice in the host element when the browser gives the engine no WebGPU adapter, instead of an empty box.
- `ChartConfig.HighlightHover`.
- `ChartConfig.BgFade`: false paints the axis margins as hard-edged strips instead of the gradient that fades the data out toward the borders, and starts the home view at the margin.
- Gaps: `double.NaN` in any value channel serializes as null and renders as a gap (`GapArrayConverter`).

### Changed
- `ChartSeries` derives from the new `ChartChannels`, which holds the value channels; a patch carries `ChartChannels` per series.
- Bundled engine: the hovered series is drawn on top on the GPU and every other series (bands included) fades toward the background; the tooltip leads with the hovered series in a block of its colour; render passes go through 4x MSAA and lines reach the window edges when zoomed in; dragging an axis gutter pans that axis one to one while the wheel over it zooms; series sharing one x array upload it once and sorted input is kept by reference; the affine remap of secondary-axis series keeps gaps.

## [1.0.0] - 2026-09-03

### Added
- `Chart` component wrapping the chartai WebGPU engine (bundled chartai 1.1.0).
- Renderers: line, area, scatter, bar, candlestick, OHLC, step, histogram, heatmap, bubble, baseline-area, error-band, waterfall.
- Global plugins: labels, zoom, hover tooltips, legend, annotations, thresholds, watermark.
- Per-chart plugins via `ChartPlugins` flags: crosshair, stats, ruler, tooltip pin, minimap, range selector.
- Multiple Y axes with left/right placement (`ChartConfig.YAxes`, `ChartSeries.YAxis`).
- Built-in axis formatters (`AxisFormat`).

[Unreleased]: https://github.com/jaafaust/ChartAI.Blazor/compare/v1.1.1...HEAD
[1.1.1]: https://github.com/jaafaust/ChartAI.Blazor/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/jaafaust/ChartAI.Blazor/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/jaafaust/ChartAI.Blazor/releases/tag/v1.0.0
