# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.0] - 2026-09-03

### Added
- `Chart` component wrapping the chartai WebGPU engine (bundled chartai 1.1.0).
- Renderers: line, area, scatter, bar, candlestick, OHLC, step, histogram, heatmap, bubble, baseline-area, error-band, waterfall.
- Global plugins: labels, zoom, hover tooltips, legend, annotations, thresholds, watermark.
- Per-chart plugins via `ChartPlugins` flags: crosshair, stats, ruler, tooltip pin, minimap, range selector.
- Multiple Y axes with left/right placement (`ChartConfig.YAxes`, `ChartSeries.YAxis`).
- Built-in axis formatters (`AxisFormat`).

[Unreleased]: https://github.com/jaafaust/ChartAI.Blazor/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/jaafaust/ChartAI.Blazor/releases/tag/v1.0.0
