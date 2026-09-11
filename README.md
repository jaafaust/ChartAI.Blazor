# ChartAI.Blazor

[![NuGet](https://img.shields.io/nuget/v/ChartAI.Blazor.svg)](https://www.nuget.org/packages/ChartAI.Blazor)
[![CI](https://github.com/jaafaust/ChartAI.Blazor/actions/workflows/ci.yml/badge.svg)](https://github.com/jaafaust/ChartAI.Blazor/actions/workflows/ci.yml)

A Blazor component for **[chartai](https://github.com/dgerrells/chartai)**, a tiny WebGPU chart
engine that renders millions of points across thousands of series off the main thread.
The engine ships bundled inside the package; there is nothing to install on the JS side.
The bundled build is upstream chartai 1.1.0 plus the changes listed in the changelog: in-place
data patching, gaps, multiple y axes, anti-aliased lines, GPU hover highlight and axis panning.

* **[chartai (upstream)](https://github.com/dgerrells/chartai)**
* **[Examples](https://dgerrells.github.io/chartai/)**
* **[Playground](https://dgerrells.github.io/chartai/demo/)**
* **[Silly overly complicated demo](https://dgerrells.github.io/chartai/canvas/)**

## Requirements

* .NET 10 (Blazor WebAssembly or an interactive Server render mode; the component uses JS interop, so it does not render under static SSR).
* A browser with WebGPU (current Chrome, Edge, Safari and Firefox). Without a WebGPU adapter
  the host element shows a notice (`Chart.UnavailableText`) instead of an empty box.

## Install

```bash
dotnet add package ChartAI.Blazor
```

## Quick start

No service registration and no `<script>` tag is needed. The component imports its JS module
on first render. The host element must have a height; the default `Style` gives it `min-height: 300px`.

```razor
@using ChartAI.Blazor.Components
@using ChartAI.Blazor.Models

<Chart Config="config" Series="series" Plugins="ChartPlugins.Crosshair | ChartPlugins.Minimap" />

@code {
    private readonly ChartConfig config = new()
    {
        Type = ChartType.Line,
        FormatX = AxisFormat.Index,
        FormatY = AxisFormat.Number,
        Legend = new LegendConfig { DefaultOpen = true },
    };

    private readonly ChartSeries[] series =
    [
        new() { Label = "Signal", Color = "#3b82f6", X = [0, 1, 2, 3, 4], Y = [1, 3, 2, 5, 4] },
        new() { Label = "Noise",  Color = "#f97316", X = [0, 1, 2, 3, 4], Y = [2, 1, 3, 2, 3] },
    ];
}
```

### Chart types

`ChartType`: `Line`, `Area`, `Scatter`, `Bar`, `Candlestick`, `Ohlc`, `Step`, `Histogram`,
`Heatmap`, `Bubble`, `BaselineArea`, `ErrorBand`, `Waterfall`.

Renderer-specific channels live on `ChartSeries` (`Open`/`High`/`Low` for candlesticks and OHLC,
`Lo`/`Hi` for error bands, `R` for bubbles, `Value` for heatmaps). `ChartSeries.Waterfall(...)`
builds a waterfall series from a list of deltas. Any other numeric channel can be passed through `Extra`.

### Plugins

Hover tooltips, zoom, legend, annotations, thresholds and watermark are always available and
switch on through their `ChartConfig` properties. Interactive per-chart plugins are attached with
the `Plugins` flags parameter:

`ChartPlugins.Crosshair | Stats | Ruler | TooltipPin | Minimap | RangeSelector`

Annotation labels are clickable: `AnnotationClicked` receives the `Id` of the annotation whose
label was clicked. A vertical line's label sits in the bottom margin, or just inside the top of
the plot with `LabelPosition = AnnotationLabelPosition.Top`; neighbouring labels stack in lanes.

### Updating a chart

* Assign a **new** `Config` or `Series` instance and the component pushes the change to the engine
  (changes are detected by reference).
* Mutated an object in place? Call `RefreshAsync()` on a `@ref` to resend it.
* `SetDataAsync(series)` replaces the data; `ResetViewAsync()` animates back to fit-to-data.
* A missing sample is `double.NaN` in any channel; it travels as JSON null and renders as a gap.
* While the pointer is on a line that series is drawn on top and the others fade
  (`ChartConfig.HighlightHover`); the tooltip leads with it. Dragging an axis gutter pans that
  axis, the wheel over it zooms it.
* `ChartConfig.BgColor` is the opaque background the axis margins are painted in. By default
  they are a gradient that fades the data out toward the borders; `BgFade = false` paints them
  as plain strips with a hard edge and starts the home view at that edge.

### Live data

A chart that follows a stream should not be rebuilt per tick. `PatchDataAsync` writes columns
in place: only the patched columns cross JS interop, and the engine writes them straight into
the existing GPU buffers. Every series of such a chart shares the x axis, ascending.

```razor
<Chart @ref="chart" Config="config" Series="series" ViewChanged="OnViewChanged" />

@code {
    // Buffers for a window of 500 columns; they grow on demand when a patch does not fit.
    private readonly ChartConfig config = new() { Type = ChartType.Line, Capacity = 512 };

    private Task Tick(double x, double a, double b) => chart.PatchDataAsync(new ChartPatch
    {
        X = [x],                                          // one new column
        Series = [new() { Y = [a] }, new() { Y = [b] }],  // one entry per series
        DropBefore = x - 500,                             // ring buffer: drop what left the window
        Bounds = new ChartBounds { MinX = x - 500, MaxX = x },
    });

    // The visible range after the user zoomed or panned: fetch that window.
    private Task OnViewChanged(ChartViewRange r) => LoadAsync(r.MinX, r.MaxX);
}
```

* `Offset` rewrites from a column on (the newest sample refreshed); null appends.
* `Drop` / `DropBefore` discard the oldest columns first, so a window of fixed length never grows.
* `Bounds` moves the data window with the patch; `SetBoundsAsync` does only that when nothing
  new arrived. A side left null keeps its value.
* `ResetView` puts the view back to its home transform, so the moved window is what is shown.
* `SetDataAsync(series, capacity, bounds)` reloads everything with the buffers sized for `capacity`.
* With several y axes a patch keeps the secondary axes' ranges; reload with `SetDataAsync` to
  rescale them.

### Dark mode

Set `ChartConfig.IsDark` per chart, or switch every chart at once from your own JS interop:

```csharp
var mod = await JS.InvokeAsync<IJSObjectReference>("import", "./_content/ChartAI.Blazor/chartai-blazor.js");
await mod.InvokeVoidAsync("setTheme", isDark);
```

The engine also reads a `dark` class on `<html>` when it initialises.

## Multiple Y axes

Configure axes via `ChartConfig.YAxes` and bind each series with `ChartSeries.YAxis`.
Axes on the same side stack outward without overlapping; `YAxisConfig.Width` and
`ChartConfig.YAxisGap` control the horizontal distance. The tooltip and legend
combine the series of all axes, each value formatted with its own axis format.

```csharp
var config = new ChartConfig
{
    Type = ChartType.Line,
    YAxisGap = 8, // px between stacked axes (optional, default 6)
    YAxes = new()
    {
        new YAxisConfig { Id = "price", Side = AxisSide.Left,  Format = AxisFormat.Price },
        new YAxisConfig { Id = "temp",  Side = AxisSide.Right, Format = AxisFormat.Degree,
                          Color = "#f97316", Width = 60, Min = -20, Max = 40 },
    },
};

var series = new[]
{
    new ChartSeries { Label = "Price",       X = x, Y = prices, YAxis = "price" },
    new ChartSeries { Label = "Temperature", X = x, Y = temps,  YAxis = "temp" },
};
```

The first axis is the primary axis: thresholds, annotations and the ruler measure
in its units, and unassigned series (`YAxis == null`) fall back to it. `Min`/`Max`
are optional exact bounds; otherwise each axis auto-scales to its own series.

## Demo

```bash
dotnet run --project ChartAI.Blazor.Demo
```

## Releasing

Releases are published by the `Release` GitHub Actions workflow. Push a tag `vX.Y.Z` and the
workflow packs `ChartAI.Blazor X.Y.Z`, pushes it to nuget.org and attaches the package to a GitHub
release. It authenticates with nuget.org Trusted Publishing, so no API key is stored; the
nuget.org account needs a trusted publishing policy for this repository and workflow file.

```bash
git tag v1.0.0 && git push origin v1.0.0
```

To build a package locally:

```bash
dotnet pack ChartAI.Blazor/ChartAI.Blazor.csproj -c Release -o artifacts
```

## License

MIT. The bundled chartai engine is released into the public domain by its author;
see `THIRD-PARTY-NOTICES.txt`.
