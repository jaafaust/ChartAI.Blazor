using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using ChartAI.Blazor.Models;
using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;

namespace ChartAI.Blazor.Components;

public partial class Chart : IAsyncDisposable
{
    [Inject] private IJSRuntime JSRuntime { get; set; } = default!;

    [Parameter] public string Id { get; set; } = Guid.NewGuid().ToString("N");
    [Parameter] public string Style { get; set; } = "width: 100%; height: 100%; min-height: 300px; display: block; position: relative;";
    [Parameter] public string? Class { get; set; }

    [Parameter] public ChartConfig Config { get; set; } = new ChartConfig();
    [Parameter] public IEnumerable<ChartSeries> Series { get; set; } = Array.Empty<ChartSeries>();

    /// <summary>Per-chart interactive plugins to attach (crosshair, ruler, minimap, …).</summary>
    [Parameter] public ChartPlugins Plugins { get; set; } = ChartPlugins.None;

    private ElementReference chartContainer;
    private IJSObjectReference? module;
    private bool isInitialized;
    private ChartPlugins lastPlugins = ChartPlugins.None;
    private ChartConfig? lastConfig;
    private IEnumerable<ChartSeries>? lastSeries;

    /// <summary>The Chart renders a single static host div; it never needs to re-render itself.</summary>
    protected override bool ShouldRender() => !isInitialized;

    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        if (!firstRender) return;

        try
        {
            module = await JSRuntime.InvokeAsync<IJSObjectReference>(
                "import", "./_content/ChartAI.Blazor/chartai-blazor.js");
            await module.InvokeVoidAsync("initEngine");

            await module.InvokeVoidAsync("createChart", chartContainer, Id, Config, PluginNames());
            await module.InvokeVoidAsync("updateSeries", Id, Series);

            lastPlugins = Plugins;
            lastConfig = Config;
            lastSeries = Series;
            isInitialized = true;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error initializing ChartAI: {ex.Message}");
        }
    }

    protected override async Task OnParametersSetAsync()
    {
        if (!isInitialized || module is null) return;

        // A plugin change requires recreating the chart (plugins attach at creation).
        if (Plugins != lastPlugins)
        {
            await module.InvokeVoidAsync("recreateChart", chartContainer, Id, Config, PluginNames());
            await module.InvokeVoidAsync("updateSeries", Id, Series);
            lastPlugins = Plugins;
            lastConfig = Config;
            lastSeries = Series;
            return;
        }

        // Only round-trip to JS when the inputs actually changed (by reference).
        if (!ReferenceEquals(Config, lastConfig))
        {
            await module.InvokeVoidAsync("configure", Id, Config);
            lastConfig = Config;
        }
        if (!ReferenceEquals(Series, lastSeries))
        {
            await module.InvokeVoidAsync("updateSeries", Id, Series);
            lastSeries = Series;
        }
    }

    /// <summary>
    /// Force-resend the current Config (and Series) to the engine — use when the
    /// Config object was mutated in place rather than replaced.
    /// </summary>
    public async Task RefreshAsync()
    {
        if (!isInitialized || module is null) return;
        await module.InvokeVoidAsync("configure", Id, Config);
        await module.InvokeVoidAsync("updateSeries", Id, Series);
    }

    /// <summary>Push new series data without re-evaluating other parameters (for live updates).</summary>
    public async Task SetDataAsync(IEnumerable<ChartSeries> series)
    {
        if (isInitialized && module is not null)
            await module.InvokeVoidAsync("updateSeries", Id, series);
    }

    /// <summary>Animate the view back to its home (fit-to-data) transform.</summary>
    public async Task ResetViewAsync()
    {
        if (isInitialized && module is not null)
            await module.InvokeVoidAsync("resetView", Id);
    }

    private string[] PluginNames()
    {
        var names = new List<string>();
        if (Plugins.HasFlag(ChartPlugins.Crosshair)) names.Add("crosshair");
        if (Plugins.HasFlag(ChartPlugins.Stats)) names.Add("stats");
        if (Plugins.HasFlag(ChartPlugins.Ruler)) names.Add("ruler");
        if (Plugins.HasFlag(ChartPlugins.TooltipPin)) names.Add("tooltip-pin");
        if (Plugins.HasFlag(ChartPlugins.Minimap)) names.Add("minimap");
        if (Plugins.HasFlag(ChartPlugins.RangeSelector)) names.Add("range-selector");
        return names.ToArray();
    }

    public async ValueTask DisposeAsync()
    {
        if (module != null)
        {
            try
            {
                await module.InvokeVoidAsync("destroyChart", Id);
                await module.DisposeAsync();
            }
            catch
            {
                // Ignore dispose errors (circuit teardown / JS already gone)
            }
        }
    }
}
