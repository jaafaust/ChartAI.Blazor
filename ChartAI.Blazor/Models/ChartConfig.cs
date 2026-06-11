using System.Text.Json.Serialization;

namespace ChartAI.Blazor.Models;

/// <summary>
/// Full configuration surface for a chartai chart. Mirrors the union of every
/// renderer config and plugin config in the original library. Unset (null)
/// fields are omitted from the JSON sent to the engine so engine defaults apply.
/// </summary>
public class ChartConfig
{
    [JsonPropertyName("type")]
    public ChartType Type { get; set; } = ChartType.Line;

    [JsonPropertyName("isDark")]
    public bool IsDark { get; set; }

    // ─── Shared / hover ────────────────────────────────────────────────────
    [JsonPropertyName("showTooltip")]
    public bool ShowTooltip { get; set; } = true;

    [JsonPropertyName("pillDecayMs")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? PillDecayMs { get; set; }

    /// <summary>Built-in formatter for X-axis tick labels and tooltips.</summary>
    [JsonPropertyName("formatX")]
    public AxisFormat FormatX { get; set; } = AxisFormat.None;

    /// <summary>Built-in formatter for Y-axis tick labels and tooltips.</summary>
    [JsonPropertyName("formatY")]
    public AxisFormat FormatY { get; set; } = AxisFormat.None;

    // ─── Labels / axes ─────────────────────────────────────────────────────
    [JsonPropertyName("textColor")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? TextColor { get; set; }

    [JsonPropertyName("gridColor")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? GridColor { get; set; }

    [JsonPropertyName("fontFamily")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? FontFamily { get; set; }

    [JsonPropertyName("labelSize")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? LabelSize { get; set; }

    // ─── Zoom ──────────────────────────────────────────────────────────────
    [JsonPropertyName("zoomMode")]
    public ZoomMode ZoomMode { get; set; } = ZoomMode.Both;

    // ─── Bounds ────────────────────────────────────────────────────────────
    [JsonPropertyName("defaultBounds")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public ChartBounds? DefaultBounds { get; set; }

    [JsonPropertyName("bgColor")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double[]? BgColor { get; set; }

    // ─── Renderer-specific numeric uniforms ────────────────────────────────
    [JsonPropertyName("pointSize")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? PointSize { get; set; }

    [JsonPropertyName("maxSamplesPerPixel")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? MaxSamplesPerPixel { get; set; }

    [JsonPropertyName("bandOpacity")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? BandOpacity { get; set; }

    // step
    [JsonPropertyName("stepMode")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public StepMode? StepMode { get; set; }

    // histogram
    [JsonPropertyName("binCount")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? BinCount { get; set; }

    [JsonPropertyName("minValue")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? MinValue { get; set; }

    [JsonPropertyName("maxValue")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? MaxValue { get; set; }

    // heatmap
    [JsonPropertyName("gridColumns")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? GridColumns { get; set; }

    [JsonPropertyName("gridRows")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? GridRows { get; set; }

    [JsonPropertyName("colorScale")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public ColorScale? ColorScale { get; set; }

    // bubble
    [JsonPropertyName("maxPointSize")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? MaxPointSize { get; set; }

    [JsonPropertyName("minPointSize")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? MinPointSize { get; set; }

    // baseline-area
    [JsonPropertyName("baseline")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? Baseline { get; set; }

    [JsonPropertyName("positiveColor")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double[]? PositiveColor { get; set; }

    [JsonPropertyName("negativeColor")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double[]? NegativeColor { get; set; }

    // candlestick / ohlc / waterfall
    [JsonPropertyName("upColor")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double[]? UpColor { get; set; }

    [JsonPropertyName("downColor")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double[]? DownColor { get; set; }

    [JsonPropertyName("totalColor")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double[]? TotalColor { get; set; }

    [JsonPropertyName("binSize")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? BinSize { get; set; }

    [JsonPropertyName("interval")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? Interval { get; set; }

    [JsonPropertyName("maxSamples")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? MaxSamples { get; set; }

    // ─── Legend (nested) ───────────────────────────────────────────────────
    [JsonPropertyName("legend")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public LegendConfig? Legend { get; set; }

    // ─── Annotations / thresholds ──────────────────────────────────────────
    [JsonPropertyName("annotations")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<Annotation>? Annotations { get; set; }

    [JsonPropertyName("thresholds")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<Threshold>? Thresholds { get; set; }

    // ─── Crosshair ─────────────────────────────────────────────────────────
    [JsonPropertyName("crosshairX")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? CrosshairX { get; set; }

    [JsonPropertyName("crosshairY")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? CrosshairY { get; set; }

    [JsonPropertyName("crosshairColor")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? CrosshairColor { get; set; }

    [JsonPropertyName("crosshairDash")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double[]? CrosshairDash { get; set; }

    [JsonPropertyName("crosshairWidth")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? CrosshairWidth { get; set; }

    // ─── Watermark ─────────────────────────────────────────────────────────
    [JsonPropertyName("watermarkText")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? WatermarkText { get; set; }

    [JsonPropertyName("watermarkPosition")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public WatermarkPosition? WatermarkPosition { get; set; }

    [JsonPropertyName("watermarkOpacity")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? WatermarkOpacity { get; set; }

    [JsonPropertyName("watermarkFontSize")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? WatermarkFontSize { get; set; }

    [JsonPropertyName("watermarkColor")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? WatermarkColor { get; set; }

    [JsonPropertyName("watermarkRotation")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? WatermarkRotation { get; set; }

    // ─── Stats ─────────────────────────────────────────────────────────────
    [JsonPropertyName("statsPosition")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public StatsPosition? StatsPosition { get; set; }

    [JsonPropertyName("statsPrecision")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? StatsPrecision { get; set; }

    [JsonPropertyName("statsShowSeries")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? StatsShowSeries { get; set; }

    // ─── Ruler ─────────────────────────────────────────────────────────────
    [JsonPropertyName("rulerAxis")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public RulerAxis? RulerAxis { get; set; }

    [JsonPropertyName("rulerMax")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? RulerMax { get; set; }

    [JsonPropertyName("rulerColor")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? RulerColor { get; set; }

    [JsonPropertyName("rulerPosition")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public RulerPosition? RulerPosition { get; set; }

    // ─── Tooltip pin ───────────────────────────────────────────────────────
    [JsonPropertyName("pinMax")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? PinMax { get; set; }

    // ─── Minimap ───────────────────────────────────────────────────────────
    [JsonPropertyName("minimapPosition")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public MinimapPosition? MinimapPosition { get; set; }

    [JsonPropertyName("minimapSize")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? MinimapSize { get; set; }

    [JsonPropertyName("minimapOpacity")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? MinimapOpacity { get; set; }

    // ─── Range selector ────────────────────────────────────────────────────
    [JsonPropertyName("rangeSelectorHeight")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? RangeSelectorHeight { get; set; }

    [JsonPropertyName("rangeSelectorMargin")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? RangeSelectorMargin { get; set; }

    [JsonPropertyName("brushColor")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? BrushColor { get; set; }
}

public class ChartBounds
{
    [JsonPropertyName("minX")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? MinX { get; set; }

    [JsonPropertyName("maxX")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? MaxX { get; set; }

    [JsonPropertyName("minY")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? MinY { get; set; }

    [JsonPropertyName("maxY")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? MaxY { get; set; }
}

public class LegendConfig
{
    [JsonPropertyName("defaultOpen")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? DefaultOpen { get; set; }

    [JsonPropertyName("alwaysOpen")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? AlwaysOpen { get; set; }

    [JsonPropertyName("maxLabelChars")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? MaxLabelChars { get; set; }

    [JsonPropertyName("labelSize")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? LabelSize { get; set; }

    [JsonPropertyName("textColor")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? TextColor { get; set; }
}

public class Annotation
{
    [JsonPropertyName("type")]
    public AnnotationType Type { get; set; } = AnnotationType.HLine;

    [JsonPropertyName("value")]
    public double Value { get; set; }

    [JsonPropertyName("value2")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? Value2 { get; set; }

    [JsonPropertyName("label")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Label { get; set; }

    [JsonPropertyName("color")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Color { get; set; }

    [JsonPropertyName("dash")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double[]? Dash { get; set; }

    [JsonPropertyName("lineWidth")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? LineWidth { get; set; }
}

public class Threshold
{
    [JsonPropertyName("y")]
    public double Y { get; set; }

    [JsonPropertyName("label")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Label { get; set; }

    [JsonPropertyName("color")]
    public string Color { get; set; } = "rgba(100,100,200,0.8)";

    [JsonPropertyName("fillAbove")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? FillAbove { get; set; }

    [JsonPropertyName("fillBelow")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? FillBelow { get; set; }

    [JsonPropertyName("lineWidth")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? LineWidth { get; set; }

    [JsonPropertyName("dash")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double[]? Dash { get; set; }
}
