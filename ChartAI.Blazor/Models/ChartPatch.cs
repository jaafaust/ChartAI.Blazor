using System.Text.Json.Serialization;

namespace ChartAI.Blazor.Models;

/// <summary>
/// Columns to write into a chart in place, see <c>Chart.PatchDataAsync</c>. The chart keeps
/// every series' arrays with a fixed capacity on the JS side; a patch carries only the columns
/// it changes, which are spliced in and written straight into the existing GPU buffers. Every
/// series of a patched chart shares the x axis, ascending.
/// </summary>
public class ChartPatch
{
    /// <summary>
    /// First column the patch writes. Null appends after the last column; a value below the
    /// current count rewrites from there on (the newest sample refreshed, say). Counts before
    /// <see cref="Drop"/> is applied.
    /// </summary>
    [JsonPropertyName("offset")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? Offset { get; set; }

    /// <summary>Oldest columns to discard before the patch is applied, so a window of fixed length never grows.</summary>
    [JsonPropertyName("drop")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? Drop { get; set; }

    /// <summary>Discards every column whose x is below this value (in addition to <see cref="Drop"/>).</summary>
    [JsonPropertyName("dropBefore")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? DropBefore { get; set; }

    /// <summary>The x values of the new columns, shared by every series.</summary>
    [JsonPropertyName("x")]
    public double[] X { get; set; } = Array.Empty<double>();

    /// <summary>
    /// One entry per series of the chart, in the order of the last SetData, each with arrays
    /// of the length of <see cref="X"/>. A channel the series has but the patch omits becomes
    /// a gap.
    /// </summary>
    [JsonPropertyName("series")]
    public IEnumerable<ChartChannels> Series { get; set; } = Array.Empty<ChartChannels>();

    /// <summary>New data bounds, the visible window of a live trend. A side left null keeps its current value.</summary>
    [JsonPropertyName("bounds")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public ChartBounds? Bounds { get; set; }

    /// <summary>Puts the view back to its home transform first, so the moved window is what is shown however the user had zoomed.</summary>
    [JsonPropertyName("resetView")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public bool ResetView { get; set; }
}

/// <summary>The data range visible in the plot area, reported by <c>Chart.ViewChanged</c> after a zoom or pan gesture settled.</summary>
public readonly record struct ChartViewRange(double MinX, double MaxX, double MinY, double MaxY);
