using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.Json.Serialization;
using ChartAI.Blazor.Models;

namespace ChartAI.Blazor.Components;

// What crosses JS interop for SetData and PatchData (see chartai-blazor.js, decodeSeries and
// decodePatch). Every number of one call travels in a single byte[] of little-endian float64,
// NaN for a gap: Blazor transfers a byte[] as binary instead of JSON text, which for a million
// points is the difference between 16 MB copied once and about 40 MB of text parsed element by
// element. Channels name [offset, length] ranges of it, and an x shared by every series travels
// once.

/// <summary>The series of a SetData.</summary>
internal sealed class SeriesPayload
{
    [JsonPropertyName("data")]
    public byte[] Data { get; init; } = [];

    /// <summary>The x shared by every series; null when the series have their own.</summary>
    [JsonPropertyName("x")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int[]? X { get; init; }

    [JsonPropertyName("series")]
    public List<SeriesEntry> Series { get; init; } = [];
}

internal sealed class SeriesEntry
{
    [JsonPropertyName("label")]
    public string Label { get; init; } = string.Empty;

    [JsonPropertyName("color")]
    public string Color { get; init; } = string.Empty;

    [JsonPropertyName("hidden")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public bool Hidden { get; init; }

    [JsonPropertyName("yAxis")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? YAxis { get; init; }

    /// <summary>This series' own x, when there is no shared one.</summary>
    [JsonPropertyName("x")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int[]? X { get; init; }

    /// <summary>y and the other value channels by name.</summary>
    [JsonPropertyName("ch")]
    public Dictionary<string, int[]> Channels { get; init; } = [];

    /// <summary><see cref="ChartChannels.Extra"/> entries that are not arrays of numbers, as they came.</summary>
    [JsonPropertyName("props")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public Dictionary<string, JsonElement>? Props { get; init; }
}

/// <summary>A <see cref="ChartPatch"/>: its options as they are, its columns in the blob.</summary>
internal sealed class PatchPayload
{
    [JsonPropertyName("offset")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? Offset { get; init; }

    [JsonPropertyName("drop")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? Drop { get; init; }

    [JsonPropertyName("dropBefore")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    [JsonConverter(typeof(GapNullableDoubleConverter))]
    public double? DropBefore { get; init; }

    [JsonPropertyName("bounds")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public ChartBounds? Bounds { get; init; }

    [JsonPropertyName("resetView")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public bool ResetView { get; init; }

    [JsonPropertyName("data")]
    public byte[] Data { get; init; } = [];

    [JsonPropertyName("x")]
    public int[] X { get; init; } = [0, 0];

    [JsonPropertyName("series")]
    public List<PatchEntry> Series { get; init; } = [];
}

internal sealed class PatchEntry
{
    [JsonPropertyName("ch")]
    public Dictionary<string, int[]> Channels { get; init; } = [];
}

/// <summary>Collects the arrays of one call and lays them out back to back.</summary>
internal sealed class NumberBlob
{
    private readonly List<double[]> parts = [];
    private int length;

    /// <summary>Appends <paramref name="values"/> and returns their [offset, length] in the blob.</summary>
    public int[] Add(double[] values)
    {
        var range = new[] { length, values.Length };
        parts.Add(values);
        length = checked(length + values.Length);
        return range;
    }

    public byte[] ToBytes()
    {
        var bytes = new byte[checked(length * sizeof(double))];
        var at = 0;
        foreach (var part in parts)
        {
            MemoryMarshal.AsBytes(part.AsSpan()).CopyTo(bytes.AsSpan(at));
            at += part.Length * sizeof(double);
        }
        // The JS side reads little-endian.
        if (!BitConverter.IsLittleEndian)
            for (var i = 0; i < bytes.Length; i += sizeof(double))
                bytes.AsSpan(i, sizeof(double)).Reverse();
        return bytes;
    }
}

internal static class ChartWire
{
    // Keys of a series that are not channels; an Extra entry of that name is not sent.
    private static readonly HashSet<string> ReservedKeys = ["label", "color", "x", "hidden", "yAxis"];

    public static SeriesPayload Series(IEnumerable<ChartSeries>? series)
    {
        var list = series?.ToList() ?? [];
        var blob = new NumberBlob();

        // One x for all when every series has the same values (by reference, or equal).
        var first = list.Count > 0 ? list[0].X ?? [] : null;
        var shared = first is not null && list.TrueForAll(s =>
            ReferenceEquals(s.X, first) || (s.X ?? []).AsSpan().SequenceEqual(first));
        var sharedX = shared ? blob.Add(first!) : null;

        var entries = new List<SeriesEntry>(list.Count);
        foreach (var s in list)
        {
            var channels = new Dictionary<string, int[]>();
            var props = AddChannels(s, blob, channels);
            entries.Add(new SeriesEntry
            {
                Label = s.Label,
                Color = s.Color,
                Hidden = s.Hidden,
                YAxis = s.YAxis,
                X = shared ? null : blob.Add(s.X ?? []),
                Channels = channels,
                Props = props,
            });
        }
        return new SeriesPayload { Data = blob.ToBytes(), X = sharedX, Series = entries };
    }

    public static PatchPayload Patch(ChartPatch patch)
    {
        var blob = new NumberBlob();
        var x = blob.Add(patch.X ?? []);
        var entries = new List<PatchEntry>();
        foreach (var s in patch.Series ?? [])
        {
            var channels = new Dictionary<string, int[]>();
            if (s is not null) AddChannels(s, blob, channels);
            entries.Add(new PatchEntry { Channels = channels });
        }
        return new PatchPayload
        {
            Offset = patch.Offset,
            Drop = patch.Drop,
            DropBefore = patch.DropBefore,
            Bounds = patch.Bounds,
            ResetView = patch.ResetView,
            Data = blob.ToBytes(),
            X = x,
            Series = entries,
        };
    }

    // y, the built-in channels that are set, and every Extra entry that is an array of numbers
    // (null for a gap). Returns the Extra entries that are something else.
    private static Dictionary<string, JsonElement>? AddChannels(
        ChartChannels c, NumberBlob blob, Dictionary<string, int[]> channels)
    {
        channels["y"] = blob.Add(c.Y ?? []);
        Add("open", c.Open);
        Add("high", c.High);
        Add("low", c.Low);
        Add("value", c.Value);
        Add("r", c.R);
        Add("lo", c.Lo);
        Add("hi", c.Hi);
        Add("h", c.H);
        Add("t", c.T);
        Add("bw", c.Bw);

        Dictionary<string, JsonElement>? props = null;
        if (c.Extra is { } extra)
        {
            foreach (var (key, element) in extra)
            {
                if (channels.ContainsKey(key) || ReservedKeys.Contains(key)) continue;
                if (TryReadNumbers(element, out var values)) channels[key] = blob.Add(values);
                else (props ??= [])[key] = element;
            }
        }
        return props;

        void Add(string key, double[]? values)
        {
            if (values is not null) channels[key] = blob.Add(values);
        }
    }

    private static bool TryReadNumbers(JsonElement element, out double[] values)
    {
        values = [];
        if (element.ValueKind != JsonValueKind.Array) return false;
        var result = new double[element.GetArrayLength()];
        var i = 0;
        foreach (var item in element.EnumerateArray())
        {
            if (item.ValueKind == JsonValueKind.Number) result[i++] = item.GetDouble();
            else if (item.ValueKind == JsonValueKind.Null) result[i++] = double.NaN;
            else return false;
        }
        values = result;
        return true;
    }
}
