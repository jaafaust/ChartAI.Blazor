# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed
- The chart engine is built from TypeScript again. `ChartAI.Blazor/engine/src` holds the chartai sources (upstream 1.1.0 plus every change this project had made to the bundle), and `engine/build.ts` bundles them with Bun into `wwwroot/chartai.js`. The .NET build runs it when Bun is installed and a source is newer than the bundle; CI rebuilds the bundle and fails when the committed one is stale. The WGSL shaders in the bundle are now minified, as in upstream's own builds.

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
