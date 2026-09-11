using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;
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

    /// <summary>
    /// Text shown in the host element when the browser gives the engine no WebGPU adapter
    /// (no WebGPU, no GPU, a fingerprinting shield), instead of an empty box. Null shows a
    /// built-in English notice.
    /// </summary>
    [Parameter] public string? UnavailableText { get; set; }

    /// <summary>
    /// Raised with the data range visible in the plot area once a zoom or pan gesture has
    /// settled. A live chart uses it to fetch the window the user moved to.
    /// </summary>
    [Parameter] public EventCallback<ChartViewRange> ViewChanged { get; set; }

    /// <summary>
    /// Raised with the <see cref="Annotation.Id"/> of the annotation whose label was clicked
    /// (null when it has none). Such a click reaches neither the zoom nor a click handler of
    /// the host.
    /// </summary>
    [Parameter] public EventCallback<string?> AnnotationClicked { get; set; }

    private ElementReference chartContainer;
    private IJSObjectReference? module;
    private DotNetObjectReference<Chart>? selfRef;
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
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error loading ChartAI: {ex.Message}");
            return;
        }

        try
        {
            await module.InvokeVoidAsync("initEngine");
        }
        catch (Exception ex)
        {
            // Nothing can ever be drawn without an adapter: say so in the host element.
            Console.WriteLine($"ChartAI: WebGPU unavailable: {ex.Message}");
            try { await module.InvokeVoidAsync("showUnavailable", chartContainer, UnavailableText); } catch { }
            return;
        }

        try
        {
            await module.InvokeVoidAsync("createChart", chartContainer, Id, Config, PluginNames());
            await module.InvokeVoidAsync("updateSeries", Id, Series);
            if (ViewChanged.HasDelegate || AnnotationClicked.HasDelegate)
            {
                selfRef = DotNetObjectReference.Create(this);
            }
            if (ViewChanged.HasDelegate)
            {
                await module.InvokeVoidAsync("watchView", Id, selfRef);
            }
            if (AnnotationClicked.HasDelegate)
            {
                await module.InvokeVoidAsync("watchAnnotations", Id, selfRef);
            }

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

    /// <summary>Replace the series data without re-evaluating other parameters.</summary>
    public Task SetDataAsync(IEnumerable<ChartSeries> series) => SetDataAsync(series, null, null);

    /// <summary>
    /// Replace the series data and size the GPU buffers for <paramref name="capacity"/>
    /// columns, so <see cref="PatchDataAsync"/> can append up to that many without recreating
    /// them. <paramref name="bounds"/> sets the data window; a side left null comes from the data.
    /// </summary>
    public async Task SetDataAsync(IEnumerable<ChartSeries> series, int? capacity, ChartBounds? bounds)
    {
        if (isInitialized && module is not null)
            await module.InvokeVoidAsync("updateSeries", Id, series, new SetDataOptions(capacity, bounds));
    }

    /// <summary>
    /// Write columns in place instead of replacing the data: only the patched columns cross
    /// JS interop and only they are written into the existing GPU buffers, so a live tick costs
    /// the size of its delta rather than a rebuild of the chart. Every series must share the x
    /// axis, ascending; <see cref="ChartConfig.Capacity"/> sizes the buffers and they grow when
    /// a patch does not fit. Returns the column count after the patch.
    /// </summary>
    public async Task<int> PatchDataAsync(ChartPatch patch)
    {
        if (!isInitialized || module is null) return 0;
        return await module.InvokeAsync<int>("patchSeries", Id, patch);
    }

    /// <summary>
    /// Move the data window without touching the data: a follow tick on which nothing new
    /// arrived. A side left null keeps its value; <paramref name="resetView"/> puts the view
    /// back to its home transform first.
    /// </summary>
    public async Task SetBoundsAsync(ChartBounds bounds, bool resetView = false)
    {
        if (isInitialized && module is not null)
            await module.InvokeVoidAsync("setBounds", Id, bounds, resetView);
    }

    /// <summary>Animate the view back to its home (fit-to-data) transform.</summary>
    public async Task ResetViewAsync()
    {
        if (isInitialized && module is not null)
            await module.InvokeVoidAsync("resetView", Id);
    }

    [JSInvokable]
    public Task OnViewChanged(double minX, double maxX, double minY, double maxY)
        => ViewChanged.InvokeAsync(new ChartViewRange(minX, maxX, minY, maxY));

    [JSInvokable]
    public Task OnAnnotationClicked(string? id)
        => AnnotationClicked.InvokeAsync(id);

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

    private sealed record SetDataOptions(
        [property: JsonPropertyName("capacity")] int? Capacity,
        [property: JsonPropertyName("bounds")] ChartBounds? Bounds);

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
        selfRef?.Dispose();
    }
}
