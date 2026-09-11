using System.Text.Json;
using System.Text.Json.Serialization;

namespace ChartAI.Blazor.Models;

/// <summary>
/// The value channels of one series: y plus the renderer-specific extra arrays the engine
/// addresses by name in shaders (open/high/low for candlesticks and OHLC, lo/hi for error
/// bands, r for bubbles, value for heatmaps, h/t/bw for waterfalls). <see cref="Extra"/>
/// allows arbitrary custom channels. A missing sample is <see cref="double.NaN"/>; it travels
/// as JSON null and the engine draws it as a gap.
/// <see cref="ChartSeries"/> adds the identity of a series (label, colour, x);
/// <see cref="ChartPatch"/> carries only these channels for the columns it appends.
/// </summary>
public class ChartChannels
{
    [JsonPropertyName("y")]
    [JsonConverter(typeof(GapArrayConverter))]
    public double[] Y { get; set; } = Array.Empty<double>();

    // ─── Built-in extra channels ───────────────────────────────────────────
    [JsonPropertyName("open")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    [JsonConverter(typeof(GapArrayConverter))]
    public double[]? Open { get; set; }

    [JsonPropertyName("high")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    [JsonConverter(typeof(GapArrayConverter))]
    public double[]? High { get; set; }

    [JsonPropertyName("low")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    [JsonConverter(typeof(GapArrayConverter))]
    public double[]? Low { get; set; }

    /// <summary>Heatmap cell intensity (0–1) per point.</summary>
    [JsonPropertyName("value")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    [JsonConverter(typeof(GapArrayConverter))]
    public double[]? Value { get; set; }

    /// <summary>Bubble radius (data units) per point.</summary>
    [JsonPropertyName("r")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    [JsonConverter(typeof(GapArrayConverter))]
    public double[]? R { get; set; }

    /// <summary>Error-band lower bound per point.</summary>
    [JsonPropertyName("lo")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    [JsonConverter(typeof(GapArrayConverter))]
    public double[]? Lo { get; set; }

    /// <summary>Error-band upper bound per point.</summary>
    [JsonPropertyName("hi")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    [JsonConverter(typeof(GapArrayConverter))]
    public double[]? Hi { get; set; }

    // Waterfall precomputed geometry (see ChartSeries.Waterfall)
    [JsonPropertyName("h")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    [JsonConverter(typeof(GapArrayConverter))]
    public double[]? H { get; set; }

    [JsonPropertyName("t")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    [JsonConverter(typeof(GapArrayConverter))]
    public double[]? T { get; set; }

    [JsonPropertyName("bw")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    [JsonConverter(typeof(GapArrayConverter))]
    public double[]? Bw { get; set; }

    /// <summary>Arbitrary additional numeric channels, flattened into the series JSON.</summary>
    [JsonExtensionData]
    public Dictionary<string, JsonElement>? Extra { get; set; }
}

/// <summary>
/// A single data series: its label, colour and x values plus the channels of
/// <see cref="ChartChannels"/>.
/// </summary>
public class ChartSeries : ChartChannels
{
    [JsonPropertyName("label")]
    public string Label { get; set; } = string.Empty;

    /// <summary>CSS color string (hex, rgb(), named) — parsed by the engine.</summary>
    [JsonPropertyName("color")]
    public string Color { get; set; } = "#3b82f6";

    [JsonPropertyName("x")]
    public double[] X { get; set; } = Array.Empty<double>();

    [JsonPropertyName("hidden")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public bool Hidden { get; set; }

    /// <summary>
    /// Id of the Y axis this series is plotted against (see
    /// <see cref="ChartConfig.YAxes"/> / <see cref="YAxisConfig.Id"/>).
    /// Null = the first (primary) axis.
    /// </summary>
    [JsonPropertyName("yAxis")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? YAxis { get; set; }

    /// <summary>
    /// Build a waterfall-ready series from sequential deltas. Ports the engine's
    /// prepareWaterfall helper: computes bar base (y), height (h), type (t:
    /// 0 up / 1 down / 2 total) and width (bw). Pass <paramref name="totals"/>
    /// with a non-zero value at indices that should render a cumulative total bar.
    /// </summary>
    public static ChartSeries Waterfall(
        string label,
        string color,
        double[] deltas,
        double[]? totals = null,
        double[]? positions = null)
    {
        int n = deltas.Length;
        positions ??= Enumerable.Range(0, n).Select(i => (double)i).ToArray();
        var y = new double[n];
        var h = new double[n];
        var t = new double[n];
        var bw = new double[n];

        double running = 0;
        for (int i = 0; i < n; i++)
        {
            bool isTotal = (totals is { } tt && i < tt.Length ? tt[i] : 0) > 0.5;
            double delta = deltas[i];
            if (isTotal)
            {
                y[i] = Math.Min(0, running);
                h[i] = Math.Abs(running);
                t[i] = 2;
            }
            else if (delta >= 0)
            {
                y[i] = running;
                h[i] = delta;
                t[i] = 0;
                running += delta;
            }
            else
            {
                y[i] = running + delta;
                h[i] = Math.Abs(delta);
                t[i] = 1;
                running += delta;
            }
        }

        for (int i = 0; i < n; i++)
        {
            double spacing;
            if (n <= 1) spacing = 1;
            else if (i == 0) spacing = positions[1] - positions[0];
            else if (i == n - 1) spacing = positions[n - 1] - positions[n - 2];
            else spacing = Math.Min(positions[i + 1] - positions[i], positions[i] - positions[i - 1]);
            bw[i] = spacing * 0.8;
        }

        return new ChartSeries
        {
            Label = label,
            Color = color,
            X = positions,
            Y = y,
            H = h,
            T = t,
            Bw = bw,
        };
    }
}

/// <summary>
/// Serializes a value channel with NaN and infinities as JSON null, the gap the engine
/// understands (System.Text.Json refuses NaN otherwise), and reads null back as NaN.
/// </summary>
public sealed class GapArrayConverter : JsonConverter<double[]>
{
    public override double[]? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Null) return null;
        if (reader.TokenType != JsonTokenType.StartArray) throw new JsonException("Expected an array of numbers.");
        var values = new List<double>();
        while (reader.Read() && reader.TokenType != JsonTokenType.EndArray)
            values.Add(reader.TokenType == JsonTokenType.Null ? double.NaN : reader.GetDouble());
        return values.ToArray();
    }

    public override void Write(Utf8JsonWriter writer, double[] value, JsonSerializerOptions options)
    {
        writer.WriteStartArray();
        foreach (var v in value)
        {
            if (double.IsFinite(v)) writer.WriteNumberValue(v);
            else writer.WriteNullValue();
        }
        writer.WriteEndArray();
    }
}
