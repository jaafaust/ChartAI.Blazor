using System.Text.Json.Serialization;

namespace ChartAI.Blazor.Models;

public class ChartConfig
{
    [JsonPropertyName("type")]
    public ChartType Type { get; set; } = ChartType.Line;

    [JsonPropertyName("isDark")]
    public bool IsDark { get; set; }

    [JsonPropertyName("showTooltip")]
    public bool ShowTooltip { get; set; } = true;

    [JsonPropertyName("zoomMode")]
    public ZoomMode ZoomMode { get; set; } = ZoomMode.XOnly;

    [JsonPropertyName("bandOpacity")]
    public double BandOpacity { get; set; } = 0.25;

    [JsonPropertyName("defaultBounds")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public ChartBounds? DefaultBounds { get; set; }
}

public class ChartBounds
{
    [JsonPropertyName("minX")]
    public double? MinX { get; set; }

    [JsonPropertyName("maxX")]
    public double? MaxX { get; set; }

    [JsonPropertyName("minY")]
    public double? MinY { get; set; }

    [JsonPropertyName("maxY")]
    public double? MaxY { get; set; }
}
