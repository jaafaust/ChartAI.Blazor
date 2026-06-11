using System.Diagnostics;
using ChartAI.Blazor.Components;
using ChartAI.Blazor.Demo.Components;
using ChartAI.Blazor.Demo.Data;
using ChartAI.Blazor.Models;
using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;

namespace ChartAI.Blazor.Demo.Pages;

public partial class Home
{
    public sealed record ChartDef(string Label, string? Info, ChartConfig Config, ChartSeries[] Series);

    // ─── Config / series builders ──────────────────────────────────────────
    private static ChartConfig Cfg(ChartType type, AxisFormat fx, AxisFormat fy, bool tooltip = true)
        => new() { Type = type, FormatX = fx, FormatY = fy, ShowTooltip = tooltip };

    private static ChartSeries S(string label, string color, double[] x, double[] y)
        => new() { Label = label, Color = color, X = x, Y = y };

    private static readonly string Blue = DemoData.RgbHex(0.3, 0.6, 1);
    private static readonly string Purple = DemoData.RgbHex(0.6, 0.4, 0.9);
    private static readonly string Red = DemoData.RgbHex(1, 0.4, 0.4);
    private static readonly string Green = DemoData.RgbHex(0.2, 0.7, 0.5);
    private static readonly string Orange = DemoData.RgbHex(1, 0.5, 0.2);

    // ─── Section data ──────────────────────────────────────────────────────
    private List<ChartDef> _baseCharts = new();
    private List<ChartDef> _seriesCharts = new();
    private ChartDef _spikes = default!;
    private List<ChartDef> _stepCharts = new();
    private List<ChartDef> _histogramCharts = new();
    private List<ChartDef> _heatmapCharts = new();
    private List<ChartDef> _bubbleCharts = new();
    private List<ChartDef> _baselineCharts = new();
    private List<ChartDef> _errorBandCharts = new();
    private List<ChartDef> _ohlcCharts = new();
    private List<ChartDef> _waterfallCharts = new();
    private List<ChartDef> _legendCharts = new();
    private List<ChartDef> _labelsCharts = new();
    private List<ChartDef> _zoomCharts = new();
    private List<ChartDef> _hoverCharts = new();
    private List<ChartDef> _annotationCharts = new();
    private List<ChartDef> _thresholdCharts = new();
    private List<ChartDef> _crosshairCharts = new();
    private List<ChartDef> _watermarkCharts = new();
    private List<ChartDef> _statsCharts = new();
    private List<ChartDef> _rulerCharts = new();
    private List<ChartDef> _tooltipPinCharts = new();
    private List<ChartDef> _minimapCharts = new();
    private ChartDef _rangeSelector = default!;

    // ─── Theme ─────────────────────────────────────────────────────────────
    private bool _isDark;
    private IJSObjectReference? _module;

    protected override void OnInitialized()
    {
        BuildCharts();
        BuildLive();
    }

    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        if (!firstRender) return;
        _isDark = await JS.InvokeAsync<bool>("chartaiDemo.isDark");
        StateHasChanged();
        StartLive();
    }

    private async Task<IJSObjectReference> EnsureModuleAsync()
        => _module ??= await JS.InvokeAsync<IJSObjectReference>(
            "import", "./_content/ChartAI.Blazor/chartai-blazor.js");

    private async Task ToggleTheme()
    {
        _isDark = await JS.InvokeAsync<bool>("chartaiDemo.toggleTheme");
        var mod = await EnsureModuleAsync();
        await mod.InvokeVoidAsync("setTheme", _isDark);
    }

    // ─── Build all static chart definitions ────────────────────────────────
    private void BuildCharts()
    {
        // Base
        var bar = DemoData.Generate(25, DataPattern.Trending);
        var line = DemoData.Generate(1000, DataPattern.Trending);
        var scatter = DemoData.Generate(5000, DataPattern.Cyclic);
        var area = DemoData.Generate(1000, DataPattern.Trending);
        var candle = DemoData.GenerateOhlc(500);

        _baseCharts = new()
        {
            new("Bar Chart", "25 points", Cfg(ChartType.Bar, AxisFormat.Index, AxisFormat.Price),
                new[] { S("Revenue", Purple, bar.X, bar.Y) }),
            new("Line Chart", "1,000 points", Cfg(ChartType.Line, AxisFormat.Date, AxisFormat.Price),
                new[] { S("Stock Price", Blue, DemoData.DateAxis(1000), line.Y) }),
            new("Scatter Chart", "5,000 points", Cfg(ChartType.Scatter, AxisFormat.Index, AxisFormat.Number),
                new[] { S("Cyclic Data", Red, scatter.X, scatter.Y) }),
            new("Area Chart", "1,000 points", Cfg(ChartType.Area, AxisFormat.Index, AxisFormat.Price),
                new[] { S("Filled Area", Green, area.X, area.Y) }),
            new("Candlestick", "500 OHLC", Cfg(ChartType.Candlestick, AxisFormat.Index, AxisFormat.Price),
                new[] { new ChartSeries { Label = "", Color = Blue, X = candle.X, Y = candle.Y, Open = candle.Open, High = candle.High, Low = candle.Low } }),
        };

        // Multi-series
        _seriesCharts = new()
        {
            new("Bar Chart", "25 points × 3 series", Cfg(ChartType.Bar, AxisFormat.Index, AxisFormat.Price),
                MultiSeries(3, () => DemoData.Generate(25, DataPattern.Trending), false)),
            new("Line Chart", "1,000 points × 3 series", Cfg(ChartType.Line, AxisFormat.Date, AxisFormat.Price),
                MultiSeries(3, () => DemoData.Generate(1000, DataPattern.Trending), true)),
            new("Scatter Chart", "5,000 points × 3 series", Cfg(ChartType.Scatter, AxisFormat.Index, AxisFormat.Number),
                MultiSeries(3, () => DemoData.Generate(5000, DataPattern.Cyclic), false)),
            new("Area Chart", "1,000 points × 3 series", Cfg(ChartType.Area, AxisFormat.Index, AxisFormat.Price),
                MultiSeries(3, () => DemoData.Generate(1000, DataPattern.Trending), false)),
        };

        // Spikes
        var spiky = DemoData.Generate(100_000, DataPattern.Spikey);
        _spikes = new("Spiky Line Chart", "100,000 points", Cfg(ChartType.Line, AxisFormat.Index, AxisFormat.Number),
            new[] { S("Volatile Data", Orange, spiky.X, spiky.Y) });

        // Step
        var step = DemoData.Generate(40, DataPattern.Cyclic);
        ChartDef StepDef(string label, string info, StepMode mode)
        {
            var c = Cfg(ChartType.Step, AxisFormat.Index, AxisFormat.Number);
            c.StepMode = mode;
            return new(label, info, c, new[] { S("Signal", Blue, step.X, step.Y) });
        }
        _stepCharts = new() { StepDef("after", "Step at right edge", StepMode.After), StepDef("before", "Step at left edge", StepMode.Before), StepDef("center", "Step at midpoint", StepMode.Center) };

        // Histogram
        var normal = DemoData.Normal(10000, 50, 12);
        var gA = DemoData.Normal(4000, 40, 8);
        var gB = DemoData.Normal(4000, 70, 6);
        var gC = DemoData.Normal(4000, 55, 14);
        var logNormal = DemoData.Normal(8000, 0, 0.6).Select(Math.Exp).ToArray();
        _histogramCharts = new()
        {
            new("Normal Distribution", "10,000 samples", Cfg(ChartType.Histogram, AxisFormat.Number, AxisFormat.Index),
                new[] { S("Height (cm)", DemoData.RgbHex(0.4, 0.6, 1), normal, new double[normal.Length]) }),
            new("Multi-Series", "3 distributions", Cfg(ChartType.Histogram, AxisFormat.Number, AxisFormat.Index),
                new[]
                {
                    S("Group A", DemoData.RgbHex(0.35, 0.6, 1), gA, new double[gA.Length]),
                    S("Group B", DemoData.RgbHex(1, 0.45, 0.35), gB, new double[gB.Length]),
                    S("Group C", DemoData.RgbHex(0.3, 0.78, 0.5), gC, new double[gC.Length]),
                }),
            new("Skewed", "Log-normal", Cfg(ChartType.Histogram, AxisFormat.Fixed1, AxisFormat.Index),
                new[] { S("Log-normal", DemoData.RgbHex(0.8, 0.45, 0.9), logNormal, new double[logNormal.Length]) }),
        };

        // Heatmap
        _heatmapCharts = new()
        {
            HeatmapDef("Viridis", ColorScale.Viridis),
            HeatmapDef("Plasma", ColorScale.Plasma),
            HeatmapDef("Warm", ColorScale.Warm),
            HeatmapDef("Cool", ColorScale.Cool),
        };

        // Bubble
        int n = 300;
        var bx = Enumerable.Range(0, n).Select(_ => DemoData.NextDouble() * 100).ToArray();
        var by = Enumerable.Range(0, n).Select(_ => DemoData.NextDouble() * 100).ToArray();
        var br = Enumerable.Range(0, n).Select(_ => 1 + DemoData.NextDouble() * 9).ToArray();
        var bubbleCfg = Cfg(ChartType.Bubble, AxisFormat.Number, AxisFormat.Number);
        bubbleCfg.MaxPointSize = 36;
        var bubbleMultiCfg = Cfg(ChartType.Bubble, AxisFormat.Number, AxisFormat.Number);
        bubbleMultiCfg.MaxPointSize = 28;
        bubbleMultiCfg.Legend = new LegendConfig { AlwaysOpen = true };
        _bubbleCharts = new()
        {
            new("Bubble Chart", "300 points, variable radius", bubbleCfg,
                new[] { new ChartSeries { Label = "Data", Color = Blue, X = bx, Y = by, R = br } }),
            new("Multi-Series Bubbles", "3 clusters", bubbleMultiCfg, BubbleClusters()),
        };

        // Baseline area
        var pnlX = Enumerable.Range(0, 400).Select(i => (double)i).ToArray();
        double v = 0; var pnlY = pnlX.Select(_ => { v += DemoData.Normal(1, 0, 1)[0] * 2; return v; }).ToArray();
        var pnlCfg = Cfg(ChartType.BaselineArea, AxisFormat.Index, AxisFormat.Number);
        pnlCfg.Baseline = 0;
        var tempX = Enumerable.Range(0, 365).Select(i => (double)i).ToArray();
        var tempY = tempX.Select(i => 12 * Math.Sin(i / 365.0 * Math.PI * 2 - 1.5) + (DemoData.NextDouble() - 0.5) * 4).ToArray();
        var tempCfg = Cfg(ChartType.BaselineArea, AxisFormat.Day, AxisFormat.Degree);
        tempCfg.Baseline = 0;
        tempCfg.PositiveColor = new[] { 0.9, 0.3, 0.2 };
        tempCfg.NegativeColor = new[] { 0.2, 0.5, 0.9 };
        _baselineCharts = new()
        {
            new("P&L (baseline: 0)", "Green above, red below", pnlCfg, new[] { S("P&L", Green, pnlX, pnlY) }),
            new("Temperature Deviation", "Custom baseline + colors", tempCfg, new[] { S("Temp deviation", Orange, tempX, tempY) }),
        };

        // Error band
        var ebX = Enumerable.Range(0, 300).Select(i => (double)i).ToArray();
        double ctr = 50; var ebY = ebX.Select(_ => { ctr += DemoData.Normal(1, 0, 1)[0] * 1.5; return ctr; }).ToArray();
        var ebLo = ebY.Select((val, i) => val - (2 + i * 0.08)).ToArray();
        var ebHi = ebY.Select((val, i) => val + (2 + i * 0.08)).ToArray();
        var ebCfg = Cfg(ChartType.ErrorBand, AxisFormat.Index, AxisFormat.Number);
        ebCfg.BandOpacity = 0.25;
        var boll = DemoData.Generate(300, DataPattern.Trending);
        var (blo, bhi) = DemoData.RollingStats(boll.Y, 20);
        var bollCfg = Cfg(ChartType.ErrorBand, AxisFormat.Index, AxisFormat.Price);
        bollCfg.BandOpacity = 0.2;
        _errorBandCharts = new()
        {
            new("Confidence Interval", "Widening uncertainty", ebCfg,
                new[] { new ChartSeries { Label = "Forecast", Color = DemoData.RgbHex(0.4, 0.65, 1), X = ebX, Y = ebY, Lo = ebLo, Hi = ebHi } }),
            new("Bollinger Bands", "±2σ rolling window", bollCfg,
                new[] { new ChartSeries { Label = "Price", Color = DemoData.RgbHex(0.9, 0.55, 0.2), X = boll.X, Y = boll.Y, Lo = blo, Hi = bhi } }),
        };

        // OHLC
        var ohlc = DemoData.GenerateOhlc(500);
        ChartSeries OhlcSeries() => new() { Label = "OHLC", Color = Blue, X = ohlc.X, Y = ohlc.Y, Open = ohlc.Open, High = ohlc.High, Low = ohlc.Low };
        _ohlcCharts = new()
        {
            new("OHLC Ticks", "500 bars", Cfg(ChartType.Ohlc, AxisFormat.Index, AxisFormat.Price), new[] { OhlcSeries() }),
            new("Candlestick (same data)", "For comparison", Cfg(ChartType.Candlestick, AxisFormat.Index, AxisFormat.Price), new[] { OhlcSeries() }),
        };

        // Waterfall
        var qDeltas = new double[] { 120, -45, 75, -30, 90, -60 };
        var bDeltas = new double[] { 80, 40, 0, -25, -18, -12, 0 };
        var bTotals = new double[] { 0, 0, 1, 0, 0, 0, 1 };
        var wfTotalsCfg = Cfg(ChartType.Waterfall, AxisFormat.Index, AxisFormat.Number);
        wfTotalsCfg.TotalColor = new[] { 0.5, 0.5, 0.65 };
        _waterfallCharts = new()
        {
            new("Quarterly Bridge", "Revenue breakdown", Cfg(ChartType.Waterfall, AxisFormat.Index, AxisFormat.Number),
                new[] { ChartSeries.Waterfall("Quarterly P&L", Blue, qDeltas) }),
            new("P&L Bridge", "With totals", wfTotalsCfg,
                new[] { ChartSeries.Waterfall("P&L Bridge", Blue, bDeltas, bTotals) }),
        };

        BuildPluginCharts();
    }

    private static ChartSeries[] MultiSeries(int count, Func<Xy> gen, bool dateAxis)
    {
        var result = new ChartSeries[count];
        for (int i = 0; i < count; i++)
        {
            var d = gen();
            var x = dateAxis ? DemoData.DateAxis(d.X.Length) : d.X;
            result[i] = S($"Series {i + 1}", DemoData.RandomColor(), x, d.Y);
        }
        return result;
    }

    private static ChartDef HeatmapDef(string label, ColorScale scale)
    {
        const int cols = 12, rows = 12;
        var xs = new List<double>(); var ys = new List<double>(); var vs = new List<double>();
        for (int r = 0; r < rows; r++)
            for (int c = 0; c < cols; c++)
            {
                xs.Add(c); ys.Add(r);
                vs.Add(0.5 + 0.5 * Math.Sin((double)c / cols * Math.PI * 2) * Math.Cos((double)r / rows * Math.PI * 2));
            }
        var cfg = new ChartConfig
        {
            Type = ChartType.Heatmap,
            FormatX = AxisFormat.Index,
            FormatY = AxisFormat.Index,
            ShowTooltip = false,
            GridColumns = cols,
            GridRows = rows,
            ColorScale = scale,
        };
        var series = new ChartSeries { Label = "Value", Color = "#ffffff", X = xs.ToArray(), Y = ys.ToArray(), Value = vs.ToArray() };
        return new(label, "12×12 grid", cfg, new[] { series });
    }

    private static ChartSeries[] BubbleClusters()
    {
        var defs = new (double cx, double cy, string color)[]
        {
            (25, 70, DemoData.RgbHex(1, 0.4, 0.4)),
            (55, 40, DemoData.RgbHex(0.3, 0.8, 0.4)),
            (80, 75, DemoData.RgbHex(0.5, 0.4, 1)),
        };
        var result = new ChartSeries[defs.Length];
        for (int i = 0; i < defs.Length; i++)
        {
            int count = 80 + i * 20;
            var (cx, cy, color) = defs[i];
            var g = DemoData.Normal(count * 2, 0, 10);
            var x = new double[count]; var y = new double[count]; var r = new double[count];
            for (int j = 0; j < count; j++)
            {
                x[j] = cx + g[j];
                y[j] = cy + g[count + j];
                r[j] = 1 + DemoData.NextDouble() * 7;
            }
            result[i] = new ChartSeries { Label = $"Cluster {i + 1}", Color = color, X = x, Y = y, R = r };
        }
        return result;
    }

    private void BuildPluginCharts()
    {
        // Legend
        var legSeries = MultiSeries(3, () => DemoData.Generate(500, DataPattern.Trending), true);
        ChartDef LegendDef(string label, string info, LegendConfig legend)
        {
            var c = Cfg(ChartType.Line, AxisFormat.Date, AxisFormat.Price);
            c.Legend = legend;
            return new(label, info, c, legSeries);
        }
        var many = MultiSeries(12, () => DemoData.Generate(300, DataPattern.Trending), true);
        var manyCfg = Cfg(ChartType.Line, AxisFormat.Date, AxisFormat.Price);
        manyCfg.Legend = new LegendConfig { DefaultOpen = true };
        _legendCharts = new()
        {
            LegendDef("Default", "legend: {}", new LegendConfig()),
            LegendDef("defaultOpen", "Starts open", new LegendConfig { DefaultOpen = true }),
            LegendDef("alwaysOpen", "No close", new LegendConfig { AlwaysOpen = true }),
            new("12 series", "Scroll", manyCfg, many),
        };

        // Labels
        var lab = DemoData.Generate(200, DataPattern.Trending);
        var labX = DemoData.DateAxis(200);
        ChartSeries[] LabSeries() => new[] { S("S1", DemoData.RandomColor(), labX, lab.Y) };
        var smallCfg = Cfg(ChartType.Line, AxisFormat.Date, AxisFormat.Price);
        smallCfg.LabelSize = 10;
        var gridCfg = Cfg(ChartType.Line, AxisFormat.Date, AxisFormat.Price);
        gridCfg.GridColor = "rgba(100, 150, 255, 0.3)";
        _labelsCharts = new()
        {
            new("Default", null, Cfg(ChartType.Line, AxisFormat.Date, AxisFormat.Price), LabSeries()),
            new("labelSize: 10", null, smallCfg, LabSeries()),
            new("gridColor: accent", null, gridCfg, LabSeries()),
        };

        // Zoom
        var zoom = DemoData.Generate(300, DataPattern.Trending);
        var zoomX = DemoData.DateAxis(300);
        ChartSeries[] ZoomSeries() => new[] { S("S1", DemoData.RandomColor(), zoomX, zoom.Y) };
        ChartDef ZoomDef(string label, string info, ZoomMode mode)
        {
            var c = Cfg(ChartType.Line, AxisFormat.Date, AxisFormat.Price);
            c.ZoomMode = mode;
            return new(label, info, c, ZoomSeries());
        }
        _zoomCharts = new()
        {
            ZoomDef("both", "Pan & zoom", ZoomMode.Both),
            ZoomDef("x-only", "Horizontal", ZoomMode.XOnly),
            ZoomDef("y-only", "Vertical", ZoomMode.YOnly),
            ZoomDef("none", "Disabled", ZoomMode.None),
        };

        // Hover
        var hov = DemoData.Generate(200, DataPattern.Trending);
        var hovX = DemoData.DateAxis(200);
        _hoverCharts = new()
        {
            new("showTooltip: true", null, Cfg(ChartType.Line, AxisFormat.Date, AxisFormat.Price, true),
                new[] { S("S1", DemoData.RandomColor(), hovX, hov.Y) }),
            new("showTooltip: false", null, Cfg(ChartType.Line, AxisFormat.Date, AxisFormat.Price, false),
                new[] { S("S1", DemoData.RandomColor(), hovX, hov.Y) }),
        };

        // Annotations (static)
        var ann = DemoData.Generate(200, DataPattern.Trending);
        var annX = DemoData.DateAxis(200);
        double yMid = DemoData.Mean(ann.Y);
        ChartSeries[] AnnSeries() => new[] { S("Price", DemoData.RgbHex(0.35, 0.6, 1), annX, ann.Y) };

        var linesCfg = Cfg(ChartType.Line, AxisFormat.Date, AxisFormat.Price);
        linesCfg.Annotations = new()
        {
            new() { Type = AnnotationType.HLine, Value = yMid * 1.2, Label = "Resistance", Color = "rgba(255,80,80,0.9)", Dash = new double[] { 5, 3 } },
            new() { Type = AnnotationType.HLine, Value = yMid * 0.85, Label = "Support", Color = "rgba(80,200,120,0.9)", Dash = new double[] { 5, 3 } },
            new() { Type = AnnotationType.VLine, Value = annX[(int)(annX.Length * 0.4)], Label = "Event", Color = "rgba(200,160,60,0.85)" },
        };
        var regionsCfg = Cfg(ChartType.Line, AxisFormat.Date, AxisFormat.Price);
        regionsCfg.Annotations = new()
        {
            new() { Type = AnnotationType.HRegion, Value = yMid * 0.9, Value2 = yMid * 1.1, Label = "Target zone", Color = "rgba(80,200,120,0.1)" },
            new() { Type = AnnotationType.VRegion, Value = annX[(int)(annX.Length * 0.55)], Value2 = annX[(int)(annX.Length * 0.75)], Label = "Lockup", Color = "rgba(200,160,60,0.12)" },
        };
        var combinedCfg = Cfg(ChartType.Line, AxisFormat.Date, AxisFormat.Price);
        combinedCfg.Annotations = new()
        {
            new() { Type = AnnotationType.HRegion, Value = yMid * 0.88, Value2 = yMid * 0.95, Color = "rgba(255,80,80,0.08)" },
            new() { Type = AnnotationType.HRegion, Value = yMid * 1.05, Value2 = yMid * 1.15, Color = "rgba(80,200,120,0.08)" },
            new() { Type = AnnotationType.HLine, Value = yMid * 1.15, Label = "Take profit", Color = "rgba(80,200,120,0.85)", LineWidth = 1.5 },
            new() { Type = AnnotationType.HLine, Value = yMid * 0.88, Label = "Stop loss", Color = "rgba(255,80,80,0.85)", LineWidth = 1.5 },
            new() { Type = AnnotationType.VLine, Value = annX[(int)(annX.Length * 0.3)], Label = "Earnings", Color = "rgba(160,120,240,0.8)", Dash = new double[] { 4, 3 } },
        };
        _annotationCharts = new()
        {
            new("hline + vline", "Support/resistance + event", linesCfg, AnnSeries()),
            new("hregion + vregion", "Zone fills", regionsCfg, AnnSeries()),
            new("Combined", "All annotation types", combinedCfg, AnnSeries()),
        };
        _annotationBase = AnnSeries();
        _interactiveConfig = Cfg(ChartType.Line, AxisFormat.Date, AxisFormat.Price);
        _interactiveConfig.Annotations = _interactiveAnnotations;

        // Threshold
        var th = DemoData.Generate(200, DataPattern.Cyclic);
        double yMean = DemoData.Mean(th.Y);
        ChartSeries[] ThSeries() => new[] { S("Signal", DemoData.RgbHex(0.35, 0.6, 1), th.X, th.Y) };
        var zonesCfg = Cfg(ChartType.Line, AxisFormat.Index, AxisFormat.Number);
        zonesCfg.Thresholds = new()
        {
            new() { Y = yMean + 25, Label = "High Alert", Color = "rgba(255,70,70,0.9)", FillAbove = "rgba(255,70,70,0.08)", LineWidth = 1.5, Dash = new double[] { 5, 3 } },
            new() { Y = yMean - 25, Label = "Low Alert", Color = "rgba(255,160,40,0.9)", FillBelow = "rgba(255,160,40,0.08)", LineWidth = 1.5, Dash = new double[] { 5, 3 } },
        };
        var targetCfg = Cfg(ChartType.Line, AxisFormat.Index, AxisFormat.Number);
        targetCfg.Thresholds = new()
        {
            new() { Y = yMean + 8, Label = "Target", Color = "rgba(80,200,120,0.9)", FillAbove = "rgba(80,200,120,0.07)", LineWidth = 2 },
        };
        _thresholdCharts = new()
        {
            new("Alert Zones", "fillAbove + fillBelow", zonesCfg, ThSeries()),
            new("Target Line", "Single threshold", targetCfg, ThSeries()),
        };

        // Crosshair
        var ch = DemoData.Generate(300, DataPattern.Trending);
        var chX = DemoData.DateAxis(300);
        ChartSeries[] ChSeries() => new[] { S("Price", DemoData.RgbHex(0.3, 0.65, 1), chX, ch.Y) };
        var chBoth = Cfg(ChartType.Line, AxisFormat.Date, AxisFormat.Price); chBoth.CrosshairX = true; chBoth.CrosshairY = true;
        var chX1 = Cfg(ChartType.Line, AxisFormat.Date, AxisFormat.Price); chX1.CrosshairX = true; chX1.CrosshairY = false;
        var chCustom = Cfg(ChartType.Line, AxisFormat.Date, AxisFormat.Price);
        chCustom.CrosshairX = true; chCustom.CrosshairY = true;
        chCustom.CrosshairColor = "rgba(160,100,240,0.6)"; chCustom.CrosshairDash = new double[] { 8, 4 }; chCustom.CrosshairWidth = 1.5;
        _crosshairCharts = new()
        {
            new("X + Y", "Both axes", chBoth, ChSeries()),
            new("X only", "Vertical guide", chX1, ChSeries()),
            new("Custom style", "Color + dash", chCustom, ChSeries()),
        };

        // Watermark
        var wm = DemoData.Generate(200, DataPattern.Trending);
        ChartSeries[] WmSeries() => new[] { S("Price", Blue, wm.X, wm.Y) };
        var wmCenter = Cfg(ChartType.Line, AxisFormat.Index, AxisFormat.Price); wmCenter.WatermarkText = "DEMO"; wmCenter.WatermarkPosition = WatermarkPosition.Center; wmCenter.WatermarkOpacity = 0.07;
        var wmCorner = Cfg(ChartType.Line, AxisFormat.Index, AxisFormat.Price); wmCorner.WatermarkText = "chartai"; wmCorner.WatermarkPosition = WatermarkPosition.TopRight; wmCorner.WatermarkOpacity = 0.12; wmCorner.WatermarkRotation = 0;
        var wmStrong = Cfg(ChartType.Line, AxisFormat.Index, AxisFormat.Price); wmStrong.WatermarkText = "PREVIEW"; wmStrong.WatermarkPosition = WatermarkPosition.Center; wmStrong.WatermarkOpacity = 0.18; wmStrong.WatermarkFontSize = 36;
        _watermarkCharts = new()
        {
            new("Center (diagonal)", "Default −30° rotation", wmCenter, WmSeries()),
            new("Corner positions", "top-right", wmCorner, WmSeries()),
            new("High opacity", "watermarkOpacity: 0.18", wmStrong, WmSeries()),
        };

        // Stats
        var st = DemoData.Generate(500, DataPattern.Trending);
        var stX = DemoData.DateAxis(500);
        var stTl = Cfg(ChartType.Line, AxisFormat.Date, AxisFormat.Price); stTl.StatsPosition = StatsPosition.TopLeft;
        var stTr = Cfg(ChartType.Line, AxisFormat.Date, AxisFormat.Price); stTr.StatsPosition = StatsPosition.TopRight;
        _statsCharts = new()
        {
            new("top-left panel", "Pan/zoom to update", stTl, new[] { S("Price", DemoData.RgbHex(0.35, 0.6, 1), stX, st.Y) }),
            new("top-right panel", "Multi-series aggregate", stTr, MultiSeries(3, () => DemoData.Generate(400, DataPattern.Trending), true)),
        };

        // Ruler
        var ru = DemoData.Generate(500, DataPattern.Trending);
        var ruX = DemoData.DateAxis(500);
        ChartConfig RulerCfg(RulerAxis axis)
        {
            var c = Cfg(ChartType.Line, AxisFormat.Fixed0, AxisFormat.Fixed2);
            c.RulerAxis = axis; c.RulerPosition = RulerPosition.BottomRight;
            return c;
        }
        var ru2 = DemoData.Generate(500, DataPattern.Cyclic);
        var ru2X = DemoData.DateAxis(500);
        _rulerCharts = new()
        {
            new("X-axis measurement", "rulerAxis: x", RulerCfg(RulerAxis.X), new[] { S("Price", DemoData.RgbHex(0.35, 0.6, 1), ruX, ru.Y) }),
            new("Y-axis measurement", "rulerAxis: y", RulerCfg(RulerAxis.Y), new[] { S("Price", DemoData.RgbHex(0.35, 0.6, 1), ruX, ru.Y) }),
            new("Both axes", "rulerAxis: both", RulerCfg(RulerAxis.Both), new[] { S("Value", DemoData.RgbHex(0.3, 0.8, 0.5), ru2X, ru2.Y) }),
        };

        // Tooltip pin
        var tp = DemoData.Generate(300, DataPattern.Trending);
        var tpX = DemoData.DateAxis(300);
        var tpCfg = Cfg(ChartType.Line, AxisFormat.Date, AxisFormat.Price, false); tpCfg.PinMax = 5;
        var tpMultiCfg = Cfg(ChartType.Line, AxisFormat.Date, AxisFormat.Price, false); tpMultiCfg.PinMax = 5;
        _tooltipPinCharts = new()
        {
            new("Click to pin points", "Up to 5 simultaneous pins", tpCfg,
                new[] { S("Price", DemoData.RgbHex(0.35, 0.6, 1), tpX, tp.Y) }),
            new("Multi-series pins", "Color-coded per series", tpMultiCfg,
                MultiSeries(3, () => DemoData.Generate(300, DataPattern.Trending), true)),
        };

        // Minimap
        var mm = DemoData.Generate(2000, DataPattern.Stock);
        var mmX = DemoData.DateAxis(2000);
        ChartSeries[] MmSeries() => new[] { S("Price", DemoData.RgbHex(0.35, 0.6, 1), mmX, mm.Y) };
        var mmBr = Cfg(ChartType.Line, AxisFormat.Date, AxisFormat.Price); mmBr.MinimapPosition = MinimapPosition.BottomRight; mmBr.MinimapSize = 110;
        var mmTl = Cfg(ChartType.Line, AxisFormat.Date, AxisFormat.Price); mmTl.MinimapPosition = MinimapPosition.TopLeft; mmTl.MinimapSize = 110;
        _minimapCharts = new()
        {
            new("bottom-right (default)", "Click thumbnail to jump", mmBr, MmSeries()),
            new("top-left", "minimapPosition: top-left", mmTl, MmSeries()),
        };

        // Range selector
        var rs = DemoData.Generate(1000, DataPattern.Stock);
        var rsCfg = Cfg(ChartType.Line, AxisFormat.Date, AxisFormat.Price); rsCfg.RangeSelectorHeight = 56;
        _rangeSelector = new("Range Selector", "Drag brush to navigate", rsCfg,
            new[] { S("Price", DemoData.RgbHex(0.35, 0.6, 1), DemoData.DateAxis(1000), rs.Y) });

        // Big data placeholders
        _bigDataLineSeries = Array.Empty<ChartSeries>();
        _bigDataScatterSeries = Array.Empty<ChartSeries>();
        _bigSeriesSeries = Array.Empty<ChartSeries>();
    }

    // ─── Live data ─────────────────────────────────────────────────────────
    private ChartCard? _liveLine;
    private ChartCard? _liveScatter;
    private ChartCard? _liveLine2;
    private readonly List<double> _liveDataX = new();
    private readonly List<double> _liveDataY1 = new();
    private readonly List<double> _liveDataY2 = new();
    private readonly List<double> _liveDataY3 = new();
    private ChartSeries[] _liveInit1 = Array.Empty<ChartSeries>();
    private ChartSeries[] _liveInit2 = Array.Empty<ChartSeries>();
    private ChartSeries[] _liveInit3 = Array.Empty<ChartSeries>();
    private readonly ChartConfig _liveLineCfg = Cfg(ChartType.Line, AxisFormat.Index, AxisFormat.Price);
    private readonly ChartConfig _liveScatterCfg = Cfg(ChartType.Scatter, AxisFormat.Index, AxisFormat.Price);
    private int _liveSpeed = 1;
    private bool _liveAccumulate;
    private Timer? _liveTimer;

    private void BuildLive()
    {
        var d1 = DemoData.Generate(100, DataPattern.Trending);
        var d2 = DemoData.Generate(100, DataPattern.Trending);
        var d3 = DemoData.Generate(100, DataPattern.Trending);
        for (int i = 0; i < 100; i++) _liveDataX.Add(i);
        _liveDataY1.AddRange(d1.Y);
        _liveDataY2.AddRange(d2.Y);
        _liveDataY3.AddRange(d3.Y);
        _liveInit1 = new[] { S("Live Data", DemoData.RgbHex(0.2, 0.8, 0.4), _liveDataX.ToArray(), _liveDataY1.ToArray()) };
        _liveInit2 = new[] { S("Live Data", DemoData.RgbHex(0.9, 0.3, 0.7), _liveDataX.ToArray(), _liveDataY2.ToArray()) };
        _liveInit3 = new[] { S("Live Data", DemoData.RgbHex(0.4, 0.5, 1), _liveDataX.ToArray(), _liveDataY3.ToArray()) };
    }

    private ChartConfig LiveCfg(ChartType type = ChartType.Line) => type == ChartType.Scatter ? _liveScatterCfg : _liveLineCfg;
    private ChartSeries[] LiveSeries(int n) => n switch { 1 => _liveInit1, 2 => _liveInit2, _ => _liveInit3 };

    private void StartLive()
    {
        _liveTimer?.Dispose();
        int interval = Math.Max(16, 1000 / _liveSpeed);
        _liveTimer = new Timer(_ => _ = InvokeAsync(TickLiveAsync), null, interval, interval);
    }

    private void SetSpeed(int speed)
    {
        _liveSpeed = speed;
        StartLive();
    }

    private void OnAccumulateChanged(ChangeEventArgs e) => _liveAccumulate = (bool)(e.Value ?? false);

    private async Task TickLiveAsync()
    {
        double nextX = _liveDataX.Count > 0 ? _liveDataX[^1] + 1 : 0;
        double l1 = _liveDataY1.Count > 0 ? _liveDataY1[^1] : 50;
        double l2 = _liveDataY2.Count > 0 ? _liveDataY2[^1] : 50;
        double l3 = _liveDataY3.Count > 0 ? _liveDataY3[^1] : 50;

        _liveDataX.Add(nextX);
        _liveDataY1.Add(l1 + (DemoData.NextDouble() - 0.5) * 5);
        _liveDataY2.Add(l2 + (DemoData.NextDouble() - 0.5) * 8);
        _liveDataY3.Add(l3 + (DemoData.NextDouble() - 0.5) * 6);

        if (!_liveAccumulate && _liveDataX.Count > 500)
        {
            _liveDataX.RemoveAt(0);
            _liveDataY1.RemoveAt(0);
            _liveDataY2.RemoveAt(0);
            _liveDataY3.RemoveAt(0);
        }

        var x = _liveDataX.ToArray();
        await PushLive(_liveLine, DemoData.RgbHex(0.2, 0.8, 0.4), x, _liveDataY1);
        await PushLive(_liveScatter, DemoData.RgbHex(0.9, 0.3, 0.7), x, _liveDataY2);
        await PushLive(_liveLine2, DemoData.RgbHex(0.4, 0.5, 1), x, _liveDataY3);

        StateHasChanged();
    }

    private static Task PushLive(ChartCard? card, string color, double[] x, List<double> y)
    {
        var chart = card?.ChartRef;
        if (chart is null) return Task.CompletedTask;
        return chart.SetDataAsync(new[] { S("Live Data", color, x, y.ToArray()) });
    }

    // ─── Big data ──────────────────────────────────────────────────────────
    private int _bigDataCount = 1_000_000;
    private bool _bigDataBusy;
    private string _bigDataStats = "Ready";
    private string _bigDataLineInfo = "Not generated";
    private string _bigDataScatterInfo = "Not generated";
    private ChartSeries[] _bigDataLineSeries = Array.Empty<ChartSeries>();
    private ChartSeries[] _bigDataScatterSeries = Array.Empty<ChartSeries>();

    private async Task GenerateBigData()
    {
        _bigDataBusy = true;
        _bigDataStats = "Generating...";
        StateHasChanged();
        await Task.Yield();

        var sw = Stopwatch.StartNew();
        int count = Math.Max(10_000, _bigDataCount);
        var lineData = DemoData.Generate(count, DataPattern.Stock);
        var scatterData = DemoData.Generate(count, DataPattern.Cyclic);
        _bigDataLineSeries = new[] { S("Big Data", DemoData.RgbHex(0.3, 0.7, 0.9), lineData.X, lineData.Y) };
        _bigDataScatterSeries = new[] { S("Big Data", DemoData.RgbHex(0.9, 0.5, 0.3), scatterData.X, scatterData.Y) };
        sw.Stop();

        string formatted = (count / 1e6).ToString("0.0") + "M";
        _bigDataLineInfo = _bigDataScatterInfo = formatted;
        _bigDataStats = $"Generated in {sw.ElapsedMilliseconds}ms";
        _bigDataBusy = false;
        StateHasChanged();
    }

    // ─── Big series ────────────────────────────────────────────────────────
    private int _bigSeriesCount = 1000;
    private int _bigSeriesPoints = 1000;
    private bool _bigSeriesBusy;
    private string _bigSeriesStats = "Ready";
    private string _bigSeriesInfo = "Not generated";
    private ChartSeries[] _bigSeriesSeries = Array.Empty<ChartSeries>();

    private async Task GenerateBigSeries()
    {
        _bigSeriesBusy = true;
        _bigSeriesStats = "Generating...";
        StateHasChanged();
        await Task.Yield();

        var sw = Stopwatch.StartNew();
        int seriesCount = Math.Max(1, _bigSeriesCount);
        int points = Math.Max(100, _bigSeriesPoints);
        var series = new ChartSeries[seriesCount];
        var x = DemoData.DateAxis(points);
        for (int i = 0; i < seriesCount; i++)
        {
            var d = DemoData.Generate(points, DataPattern.Trending);
            series[i] = S($"S{i + 1}", DemoData.RandomColor(), x, d.Y);
        }
        _bigSeriesSeries = series;
        sw.Stop();

        long total = (long)seriesCount * points;
        string formatted = total >= 1_000_000 ? (total / 1e6).ToString("0.0") + "M" : (total / 1e3).ToString("0") + "k";
        _bigSeriesInfo = $"{seriesCount} series × {points} pts = {formatted} total";
        _bigSeriesStats = $"Generated in {sw.ElapsedMilliseconds}ms";
        _bigSeriesBusy = false;
        StateHasChanged();
    }

    // ─── Interactive annotations ───────────────────────────────────────────
    private Chart? _interactiveChart;
    private ChartConfig _interactiveConfig = new();
    private ChartSeries[] _annotationBase = Array.Empty<ChartSeries>();
    private readonly List<Annotation> _interactiveAnnotations = new();
    private AnnotationType _newAnnType = AnnotationType.HLine;
    private double? _newAnnValue;
    private string? _newAnnLabel;

    private async Task AddAnnotation()
    {
        if (_newAnnValue is null) return;
        _interactiveAnnotations.Add(new Annotation
        {
            Type = _newAnnType,
            Value = _newAnnValue.Value,
            Label = string.IsNullOrWhiteSpace(_newAnnLabel) ? null : _newAnnLabel,
            Color = "rgba(68,102,255,0.85)",
        });
        _interactiveConfig.Annotations = new List<Annotation>(_interactiveAnnotations);
        _newAnnValue = null;
        _newAnnLabel = null;
        if (_interactiveChart is not null) await _interactiveChart.RefreshAsync();
    }

    private async Task ClearAnnotations()
    {
        _interactiveAnnotations.Clear();
        _interactiveConfig.Annotations = new List<Annotation>();
        if (_interactiveChart is not null) await _interactiveChart.RefreshAsync();
    }

    public async ValueTask DisposeAsync()
    {
        _liveTimer?.Dispose();
        if (_module is not null)
        {
            try { await _module.DisposeAsync(); } catch { }
        }
    }
}
