using System.Text.Json;
using ChartAI.Blazor.Models;

namespace ChartAI.Blazor.Tests;

/// <summary>
/// B9 / K15: models containing NaN or infinities serialise (Blazor's interop uses the Web
/// defaults) instead of throwing, in x, bounds, annotation values and threshold y as well as in
/// the value channels.
/// </summary>
public class SerializationTests
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    public static TheoryData<double> NonFinite => new() { double.NaN, double.PositiveInfinity, double.NegativeInfinity };

    [Theory]
    [MemberData(nameof(NonFinite))]
    public void ChartSeries_with_non_finite_x_serialises(double v)
    {
        var s = new ChartSeries { Label = "s", X = new[] { 0, v, 2 }, Y = new[] { 1.0, 2, 3 } };
        var json = JsonSerializer.Serialize(s, Web);
        Assert.Contains("\"label\":\"s\"", json);
    }

    [Theory]
    [MemberData(nameof(NonFinite))]
    public void Value_channels_with_non_finite_values_serialise_as_null(double v)
    {
        var s = new ChartSeries { Label = "s", X = new[] { 0.0, 1 }, Y = new[] { v, 1 }, Lo = new[] { v, 0 }, Hi = new[] { 2, v } };
        var json = JsonSerializer.Serialize(s, Web);
        Assert.Contains("\"y\":[null,1]", json);
    }

    [Theory]
    [MemberData(nameof(NonFinite))]
    public void ChartPatch_with_non_finite_x_and_bounds_serialises(double v)
    {
        var p = new ChartPatch
        {
            X = new[] { v },
            Series = new[] { new ChartChannels { Y = new[] { v } } },
            Bounds = new ChartBounds { MinX = v, MaxX = 1, MinY = v, MaxY = v },
            DropBefore = v,
        };
        JsonSerializer.Serialize(p, Web);
    }

    [Theory]
    [MemberData(nameof(NonFinite))]
    public void ChartBounds_with_non_finite_sides_serialises(double v)
    {
        JsonSerializer.Serialize(new ChartBounds { MinX = v, MaxX = v, MinY = v, MaxY = v }, Web);
    }

    [Theory]
    [MemberData(nameof(NonFinite))]
    public void ChartConfig_with_non_finite_bounds_annotations_and_thresholds_serialises(double v)
    {
        var cfg = new ChartConfig
        {
            DefaultBounds = new ChartBounds { MinY = v, MaxY = 10 },
            Annotations = new List<Annotation> { new() { Value = v, Value2 = v, Label = "a" } },
            Thresholds = new List<Threshold> { new() { Y = v, Label = "t" } },
            YAxes = new List<YAxisConfig> { new() { Min = v, Max = v } },
            BgColor = new[] { 0.1, v, 0.3 },
            PointSize = v,
        };
        var json = JsonSerializer.Serialize(cfg, Web);
        Assert.Contains("\"type\":\"line\"", json);
    }

    [Fact]
    public void Gap_channels_round_trip_NaN_through_null()
    {
        var json = JsonSerializer.Serialize(new ChartChannels { Y = new[] { 1, double.NaN, 3 } }, Web);
        var back = JsonSerializer.Deserialize<ChartChannels>(json, Web)!;
        Assert.Equal(3, back.Y.Length);
        Assert.True(double.IsNaN(back.Y[1]));
    }
}
