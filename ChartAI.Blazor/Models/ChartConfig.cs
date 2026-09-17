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

    /// <summary>
    /// Columns the GPU buffers are sized for, so <c>Chart.PatchDataAsync</c> can append up to
    /// that many without recreating them. Null sizes them for the data; a patch that does not
    /// fit grows them (one full upload).
    /// </summary>
    [JsonPropertyName("capacity")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? Capacity { get; set; }

    /// <summary>
    /// Draw the hovered series on top and fade every other series toward the background while
    /// the pointer is on a line (default true).
    /// </summary>
    [JsonPropertyName("highlightHover")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? HighlightHover { get; set; }

    /// <summary>
    /// Paint the axis margins as a gradient that fades the data out toward the borders (default
    /// true). False paints plain strips with a hard edge at the margin and starts the home view
    /// right at it, so the whole data window is visible.
    /// </summary>
    [JsonPropertyName("bgFade")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? BgFade { get; set; }

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

    /// <summary>
    /// Fill opacity of the bars of a <see cref="ChartType.Bar"/> chart, 0 to 1 (default 1, solid).
    /// Lower it to see overlapping bars of several series through each other.
    /// </summary>
    [JsonPropertyName("barOpacity")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? BarOpacity { get; set; }

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

    // ─── Multiple Y axes ───────────────────────────────────────────────────
    /// <summary>
    /// Optional multi Y-axis configuration. Each series selects its axis via
    /// <see cref="ChartSeries.YAxis"/> (matching <see cref="YAxisConfig.Id"/>);
    /// unassigned series use the first axis. The first axis defines the chart's
    /// internal coordinate space (thresholds/annotations/rulers measure in its
    /// units); additional axes are independently scaled relabelings of it.
    /// Axes on the same side stack outward without overlapping, separated by
    /// <see cref="YAxisGap"/>. Null = single default left axis.
    /// </summary>
    [JsonPropertyName("yAxes")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<YAxisConfig>? YAxes { get; set; }

    /// <summary>Horizontal distance in px between adjacent Y-axis strips on the same side (default 6).</summary>
    [JsonPropertyName("yAxisGap")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? YAxisGap { get; set; }

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

/// <summary>
/// One Y axis of a multi-axis chart (see <see cref="ChartConfig.YAxes"/>).
/// </summary>
public class YAxisConfig
{
    /// <summary>Identifier referenced by <see cref="ChartSeries.YAxis"/>. Defaults to the axis' index as a string.</summary>
    [JsonPropertyName("id")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Id { get; set; }

    /// <summary>Side the axis is drawn on. Default: first axis left, additional axes right.</summary>
    [JsonPropertyName("side")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public AxisSide? Side { get; set; }

    /// <summary>Tick/tooltip formatter for this axis. Falls back to <see cref="ChartConfig.FormatY"/>.</summary>
    [JsonPropertyName("format")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public AxisFormat? Format { get; set; }

    /// <summary>Manual lower bound (exact, no padding). Null = auto from the axis' series.</summary>
    [JsonPropertyName("min")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? Min { get; set; }

    /// <summary>Manual upper bound (exact, no padding). Null = auto from the axis' series.</summary>
    [JsonPropertyName("max")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? Max { get; set; }

    /// <summary>Tick label color (CSS). Defaults to the chart text color.</summary>
    [JsonPropertyName("color")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Color { get; set; }

    /// <summary>
    /// Width in px of this axis' label strip (default 55). Together with
    /// <see cref="ChartConfig.YAxisGap"/> this sets the horizontal distance
    /// between stacked axes on the same side.
    /// </summary>
    [JsonPropertyName("width")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? Width { get; set; }
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

    /// <summary>Names the annotation in the chart's AnnotationClicked when its label is clicked.</summary>
    [JsonPropertyName("id")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Id { get; set; }

    /// <summary>Where a vertical line's label sits: in the bottom margin (default) or just inside the top of the plot.</summary>
    [JsonPropertyName("labelPosition")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public AnnotationLabelPosition? LabelPosition { get; set; }
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
