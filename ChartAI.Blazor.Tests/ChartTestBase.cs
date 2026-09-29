using Bunit;
using ChartAI.Blazor.Components;
using ChartAI.Blazor.Models;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.JSInterop;

namespace ChartAI.Blazor.Tests;

/// <summary>
/// Renders <see cref="Chart"/> with bUnit against <see cref="FakeJsRuntime"/>, whose module
/// records every interop call in order (bUnit's own JSInterop keeps invocations per identifier,
/// which loses the cross-call ordering these tests assert).
/// </summary>
public abstract class ChartTestBase : IAsyncLifetime
{
    protected static readonly TimeSpan Timeout = TimeSpan.FromSeconds(10);

    protected BunitContext Ctx { get; } = new();
    protected FakeJsRuntime Js { get; } = new();
    protected FakeJsModule Module => Js.Module;

    protected ChartTestBase()
    {
        Ctx.Services.AddSingleton<IJSRuntime>(Js);
    }

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync()
    {
        try { await Ctx.DisposeAsync(); } catch { }
    }

    protected static ChartSeries Series(string label, int n = 5) => new()
    {
        Label = label,
        Color = "#3b82f6",
        X = Enumerable.Range(0, n).Select(i => (double)i).ToArray(),
        Y = Enumerable.Range(0, n).Select(i => (double)i * 2).ToArray(),
    };

    protected IRenderedComponent<Chart> RenderChart(
        string id = "chart-1",
        ChartConfig? config = null,
        IEnumerable<ChartSeries>? series = null,
        ChartPlugins plugins = ChartPlugins.None,
        string? cssClass = null)
        => Ctx.Render<Chart>(p =>
        {
            p.Add(c => c.Id, id);
            p.Add(c => c.Config, config ?? new ChartConfig());
            p.Add(c => c.Series, series ?? Array.Empty<ChartSeries>());
            p.Add(c => c.Plugins, plugins);
            if (cssClass is not null) p.Add(c => c.Class, cssClass);
        });

    /// <summary>Renders the chart and waits until its initialisation has finished.</summary>
    protected async Task<IRenderedComponent<Chart>> RenderInitialised(
        string id = "chart-1",
        ChartConfig? config = null,
        IEnumerable<ChartSeries>? series = null,
        ChartPlugins plugins = ChartPlugins.None)
    {
        var cut = RenderChart(id, config, series, plugins);
        await WaitInitialised(cut);
        return cut;
    }

    protected async Task WaitInitialised(IRenderedComponent<Chart> cut)
    {
        var ready = ReadyTask(cut.Instance);
        if (ready is not null)
        {
            Assert.True(await ready.WaitAsync(Timeout), "Ready completed with false");
            return;
        }
        // Without Ready (the unfixed component): the upload is the last step before the
        // component flags itself initialised.
        await WaitUntil(() => Module.Count("createChart") > 0 && Module.Count("updateSeries") > 0, "initial createChart + updateSeries");
        await Task.Delay(100);
    }

    /// <summary>Chart.Ready (K15) through reflection, so this project also builds against a
    /// component that does not have it yet.</summary>
    protected static Task<bool>? ReadyTask(Chart chart)
        => typeof(Chart).GetProperty("Ready")?.GetValue(chart) as Task<bool>;

    protected static async Task WaitUntil(Func<bool> condition, string what, TimeSpan? timeout = null)
    {
        var limit = DateTime.UtcNow + (timeout ?? Timeout);
        while (!condition())
        {
            if (DateTime.UtcNow > limit) Assert.Fail($"Timed out waiting for {what}.");
            await Task.Delay(10);
        }
    }

    /// <summary>Lets pending renderer work run, then fails on an exception the renderer caught
    /// from a lifecycle method (fatal to a Blazor Server circuit).</summary>
    protected async Task AssertNoUnhandledException()
    {
        await Task.Delay(200);
        var unhandled = Ctx.Renderer.UnhandledException;
        if (unhandled.IsCompleted) Assert.Fail($"A lifecycle method let an exception escape: {unhandled.Result}");
    }

    protected static Exception MakeException(string kind) => kind switch
    {
        nameof(JSDisconnectedException) => new JSDisconnectedException("test: circuit disconnected"),
        nameof(JSException) => new JSException("test: JS failed"),
        nameof(TaskCanceledException) => new TaskCanceledException("test: canceled"),
        nameof(OperationCanceledException) => new OperationCanceledException("test: canceled"),
        nameof(ObjectDisposedException) => new ObjectDisposedException("test: disposed"),
        _ => throw new ArgumentOutOfRangeException(nameof(kind)),
    };

    public static TheoryData<string> InteropExceptions => new()
    {
        nameof(JSDisconnectedException),
        nameof(JSException),
        nameof(TaskCanceledException),
        nameof(OperationCanceledException),
        nameof(ObjectDisposedException),
    };
}
