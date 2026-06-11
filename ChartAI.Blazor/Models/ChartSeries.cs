using System;
using System.Text.Json.Serialization;

namespace ChartAI.Blazor.Models;

public class ChartSeries
{
    [JsonPropertyName("label")]
    public string Label { get; set; } = string.Empty;

    [JsonPropertyName("color")]
    public string Color { get; set; } = "#000000";
    
    [JsonPropertyName("x")]
    public double[] X { get; set; } = Array.Empty<double>();

    [JsonPropertyName("y")]
    public double?[] Y { get; set; } = Array.Empty<double?>();
    
    [JsonPropertyName("lo")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double?[]? Lo { get; set; }

    [JsonPropertyName("hi")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double?[]? Hi { get; set; }
}
