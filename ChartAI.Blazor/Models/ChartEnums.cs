using System.Text.Json.Serialization;

namespace ChartAI.Blazor.Models;

/// <summary>
/// All renderer/chart types supported by the chartai engine.
/// Serializes to the exact renderer name registered in the JS bundle.
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter<ChartType>))]
public enum ChartType
{
    [JsonStringEnumMemberName("line")] Line,
    [JsonStringEnumMemberName("area")] Area,
    [JsonStringEnumMemberName("scatter")] Scatter,
    [JsonStringEnumMemberName("bar")] Bar,
    [JsonStringEnumMemberName("candlestick")] Candlestick,
    [JsonStringEnumMemberName("step")] Step,
    [JsonStringEnumMemberName("histogram")] Histogram,
    [JsonStringEnumMemberName("heatmap")] Heatmap,
    [JsonStringEnumMemberName("bubble")] Bubble,
    [JsonStringEnumMemberName("baseline-area")] BaselineArea,
    [JsonStringEnumMemberName("error-band")] ErrorBand,
    [JsonStringEnumMemberName("ohlc")] Ohlc,
    [JsonStringEnumMemberName("waterfall")] Waterfall,
}

[JsonConverter(typeof(JsonStringEnumConverter<ZoomMode>))]
public enum ZoomMode
{
    [JsonStringEnumMemberName("both")] Both,
    [JsonStringEnumMemberName("x-only")] XOnly,
    [JsonStringEnumMemberName("y-only")] YOnly,
    [JsonStringEnumMemberName("none")] None,
}

[JsonConverter(typeof(JsonStringEnumConverter<StepMode>))]
public enum StepMode
{
    [JsonStringEnumMemberName("after")] After,
    [JsonStringEnumMemberName("before")] Before,
    [JsonStringEnumMemberName("center")] Center,
}

/// <summary>Heatmap color scale. Serializes as the numeric index the engine expects (0–3).</summary>
public enum ColorScale
{
    Viridis = 0,
    Plasma = 1,
    Cool = 2,
    Warm = 3,
}

/// <summary>
/// Built-in axis/value formatters resolved to JS functions in the wrapper.
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter<AxisFormat>))]
public enum AxisFormat
{
    [JsonStringEnumMemberName("none")] None,
    [JsonStringEnumMemberName("index")] Index,
    [JsonStringEnumMemberName("number")] Number,
    [JsonStringEnumMemberName("price")] Price,
    [JsonStringEnumMemberName("date")] Date,
    [JsonStringEnumMemberName("fixed0")] Fixed0,
    [JsonStringEnumMemberName("fixed1")] Fixed1,
    [JsonStringEnumMemberName("fixed2")] Fixed2,
    [JsonStringEnumMemberName("day")] Day,
    [JsonStringEnumMemberName("degree")] Degree,
}

/// <summary>Which side of the plot a Y axis is drawn on.</summary>
[JsonConverter(typeof(JsonStringEnumConverter<AxisSide>))]
public enum AxisSide
{
    [JsonStringEnumMemberName("left")] Left,
    [JsonStringEnumMemberName("right")] Right,
}

[JsonConverter(typeof(JsonStringEnumConverter<WatermarkPosition>))]
public enum WatermarkPosition
{
    [JsonStringEnumMemberName("center")] Center,
    [JsonStringEnumMemberName("top-left")] TopLeft,
    [JsonStringEnumMemberName("top-right")] TopRight,
    [JsonStringEnumMemberName("bottom-left")] BottomLeft,
    [JsonStringEnumMemberName("bottom-right")] BottomRight,
}

[JsonConverter(typeof(JsonStringEnumConverter<MinimapPosition>))]
public enum MinimapPosition
{
    [JsonStringEnumMemberName("top-left")] TopLeft,
    [JsonStringEnumMemberName("top-right")] TopRight,
    [JsonStringEnumMemberName("bottom-left")] BottomLeft,
    [JsonStringEnumMemberName("bottom-right")] BottomRight,
}

[JsonConverter(typeof(JsonStringEnumConverter<StatsPosition>))]
public enum StatsPosition
{
    [JsonStringEnumMemberName("top-left")] TopLeft,
    [JsonStringEnumMemberName("top-right")] TopRight,
    [JsonStringEnumMemberName("bottom-left")] BottomLeft,
    [JsonStringEnumMemberName("bottom-right")] BottomRight,
}

[JsonConverter(typeof(JsonStringEnumConverter<RulerAxis>))]
public enum RulerAxis
{
    [JsonStringEnumMemberName("x")] X,
    [JsonStringEnumMemberName("y")] Y,
    [JsonStringEnumMemberName("both")] Both,
}

[JsonConverter(typeof(JsonStringEnumConverter<RulerPosition>))]
public enum RulerPosition
{
    [JsonStringEnumMemberName("top-left")] TopLeft,
    [JsonStringEnumMemberName("top-right")] TopRight,
    [JsonStringEnumMemberName("bottom-left")] BottomLeft,
    [JsonStringEnumMemberName("bottom-right")] BottomRight,
}

[JsonConverter(typeof(JsonStringEnumConverter<AnnotationType>))]
public enum AnnotationType
{
    [JsonStringEnumMemberName("hline")] HLine,
    [JsonStringEnumMemberName("vline")] VLine,
    [JsonStringEnumMemberName("hregion")] HRegion,
    [JsonStringEnumMemberName("vregion")] VRegion,
}

/// <summary>
/// Per-chart interactive plugins that are attached individually (via addPlugin)
/// rather than registered globally. Combine with bitwise OR.
/// </summary>
[Flags]
public enum ChartPlugins
{
    None = 0,
    Crosshair = 1 << 0,
    Stats = 1 << 1,
    Ruler = 1 << 2,
    TooltipPin = 1 << 3,
    Minimap = 1 << 4,
    RangeSelector = 1 << 5,
}
