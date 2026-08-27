# ChartAI

See: 

* **[ChartAI](https://github.com/dgerrells/chartai)**
* **[Examples](https://dgerrells.github.io/chartai/)**
* **[Playground](https://dgerrells.github.io/chartai/demo/)**
* **[Silly overly complicated demo](https://dgerrells.github.io/chartai/canvas/)**

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
