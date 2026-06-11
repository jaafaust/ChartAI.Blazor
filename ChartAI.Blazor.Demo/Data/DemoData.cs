namespace ChartAI.Blazor.Demo.Data;

public enum DataPattern { Stock, Trending, Declining, Spikey, Cyclic }

public readonly record struct Xy(double[] X, double[] Y);

public readonly record struct Ohlc(double[] X, double[] Y, double[] Open, double[] High, double[] Low);

/// <summary>
/// Faithful C# port of the data generators used by the original chartai demo
/// (original/pages/main.ts). Produces the same families of synthetic data so the
/// Blazor demo mirrors the reference page.
/// </summary>
public static class DemoData
{
    private static readonly Random Rng = new();
    private const double TwoPi = 2 * Math.PI;

    // Base date for stock-style X axis (one minute per X unit, counting backwards).
    public static readonly DateTime BaseDate = new(2026, 2, 3);

    public static (double r, double g, double b) HslToRgb(double h, double s, double l)
    {
        double c = (1 - Math.Abs(2 * l - 1)) * s;
        double x = c * (1 - Math.Abs((h / 60) % 2 - 1));
        double m = l - c / 2;
        double r = 0, g = 0, b = 0;
        if (h < 60) { r = c; g = x; }
        else if (h < 120) { r = x; g = c; }
        else if (h < 180) { g = c; b = x; }
        else if (h < 240) { g = x; b = c; }
        else if (h < 300) { r = x; b = c; }
        else { r = c; b = x; }
        return (r + m, g + m, b + m);
    }

    public static string RgbHex(double r, double g, double b)
    {
        int ri = Math.Clamp((int)Math.Round(r * 255), 0, 255);
        int gi = Math.Clamp((int)Math.Round(g * 255), 0, 255);
        int bi = Math.Clamp((int)Math.Round(b * 255), 0, 255);
        return $"#{ri:x2}{gi:x2}{bi:x2}";
    }

    public static string RandomColor()
    {
        var (r, g, b) = HslToRgb(Rng.NextDouble() * 360, 0.65 + Rng.NextDouble() * 0.2, 0.5 + Rng.NextDouble() * 0.1);
        return RgbHex(r, g, b);
    }

    private static double NextGaussian()
    {
        double u1 = Math.Max(Rng.NextDouble(), 1e-10);
        double r = Math.Sqrt(-2 * Math.Log(u1));
        double theta = TwoPi * Rng.NextDouble();
        return r * Math.Cos(theta);
    }

    public static Xy Generate(int count, DataPattern pattern)
    {
        var x = new double[count];
        var y = new double[count];

        bool isDateAxis = pattern == DataPattern.Stock;
        for (int i = 0; i < count; i++) x[i] = isDateAxis ? count - 1 - i : i;

        switch (pattern)
        {
            case DataPattern.Stock:
            {
                const double minsPerDecade = 5258880;
                double drift = Math.Log(2) / minsPerDecade;
                double driftNeg = -drift * 3;
                double vol = 0.0005, volHigh = vol * 1.8;

                double decades = count / minsPerDecade;
                int recessionCount = Math.Max(1, (int)Math.Round(decades * (0.8 + Rng.NextDouble() * 0.4)));
                var rPairs = new List<(double s, double e)>();
                for (int r = 0; r < recessionCount; r++)
                {
                    double start = Math.Floor(Rng.NextDouble() * count * 0.9);
                    double durationMins = Math.Floor((180 + Rng.NextDouble() * 360) * 1440);
                    rPairs.Add((start, start + durationMins));
                }
                rPairs.Sort((a, b) => a.s.CompareTo(b.s));

                double logP = Math.Log(10 + Rng.NextDouble() * 20);
                int rIdx = 0;
                for (int i = 0; i < count; i++)
                {
                    while (rIdx < rPairs.Count && i >= rPairs[rIdx].e) rIdx++;
                    bool inRecession = rIdx < rPairs.Count && i >= rPairs[rIdx].s && i < rPairs[rIdx].e;
                    double d = inRecession ? driftNeg : drift;
                    double v = inRecession ? volHigh : vol;
                    logP += d + v * NextGaussian();
                    y[i] = Math.Exp(logP);
                }
                break;
            }
            case DataPattern.Trending:
            {
                double logP = Math.Log(20 + Rng.NextDouble() * 20);
                double drift = Math.Log(2) / count, vol = 0.015;
                for (int i = 0; i < count; i++) { logP += drift + vol * NextGaussian(); y[i] = Math.Exp(logP); }
                break;
            }
            case DataPattern.Declining:
            {
                double logP = Math.Log(60 + Rng.NextDouble() * 40);
                double drift = -Math.Log(2) / count, vol = 0.015;
                for (int i = 0; i < count; i++) { logP += drift + vol * NextGaussian(); y[i] = Math.Exp(logP); }
                break;
            }
            case DataPattern.Spikey:
            {
                double avg = 20 + Rng.NextDouble() * 30;
                int spikeCount = 3 + Rng.Next(5);
                var spikeIndices = new HashSet<int>();
                while (spikeIndices.Count < Math.Min(spikeCount, count)) spikeIndices.Add(Rng.Next(count));
                double avg12 = avg * 1.2, avg5 = avg * 5;
                for (int i = 0; i < count; i++)
                    y[i] = spikeIndices.Contains(i) ? (Rng.NextDouble() < 0.5 ? -avg5 : avg5) : (Rng.NextDouble() - 0.5) * avg12;
                break;
            }
            case DataPattern.Cyclic:
            {
                double phase = (DateTime.Now.Ticks / 10000 % 100000) / 100000.0 * TwoPi;
                double amplitude = 30 + Rng.NextDouble() * 20;
                double baseline = 50 + Rng.NextDouble() * 20;
                double cycles = 2 + Rng.NextDouble() * 4;
                double tScale = TwoPi * cycles / count;
                double harmAmp = amplitude * 0.25;
                for (int i = 0; i < count; i++)
                {
                    double t = i * tScale + phase;
                    y[i] = baseline + Math.Sin(t) * amplitude + Math.Sin(t * 2.7 + 1.3) * harmAmp + (Rng.NextDouble() - 0.5) * 8;
                }
                break;
            }
        }

        return new Xy(x, y);
    }

    public static Ohlc GenerateOhlc(int count)
    {
        var x = new double[count];
        var y = new double[count];
        var open = new double[count];
        var high = new double[count];
        var low = new double[count];

        double price = 50 + Rng.NextDouble() * 100;
        double drift = Math.Log(2) / count, vol = 0.015;
        for (int i = 0; i < count; i++)
        {
            x[i] = i;
            double o = price;
            double c = Math.Max(0.01, price * Math.Exp(drift + vol * NextGaussian()));
            double range = Math.Abs(c - o) * (1 + Rng.NextDouble() * 1.5);
            double h = Math.Max(o, c) + Rng.NextDouble() * range * 0.5;
            double l = Math.Max(0.01, Math.Min(o, c) - Rng.NextDouble() * range * 0.5);
            open[i] = o; high[i] = h; low[i] = l; y[i] = c;
            price = c;
        }
        return new Ohlc(x, y, open, high, low);
    }

    /// <summary>Box–Muller sampler with given mean/std.</summary>
    public static double[] Normal(int count, double mean, double std)
    {
        var arr = new double[count];
        for (int i = 0; i < count; i++) arr[i] = mean + std * NextGaussian();
        return arr;
    }

    public static (double[] lo, double[] hi) RollingStats(double[] y, int window)
    {
        var lo = new double[y.Length];
        var hi = new double[y.Length];
        for (int i = 0; i < y.Length; i++)
        {
            int start = Math.Max(0, i - window);
            int len = i - start + 1;
            double sum = 0;
            for (int j = start; j <= i; j++) sum += y[j];
            double mean = sum / len;
            double varSum = 0;
            for (int j = start; j <= i; j++) varSum += (y[j] - mean) * (y[j] - mean);
            double sd = Math.Sqrt(varSum / len);
            lo[i] = mean - 2 * sd;
            hi[i] = mean + 2 * sd;
        }
        return (lo, hi);
    }

    /// <summary>Map a generated X axis to "minutes ago" form (count-1 … 0).</summary>
    public static double[] DateAxis(int count) =>
        Enumerable.Range(0, count).Select(i => (double)(count - 1 - i)).ToArray();

    public static double NextDouble() => Rng.NextDouble();
    public static double Mean(double[] a) => a.Average();
}
