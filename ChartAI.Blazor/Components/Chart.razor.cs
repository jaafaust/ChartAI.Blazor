using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using ChartAI.Blazor.Models;
using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;

namespace ChartAI.Blazor.Components;

public partial class Chart : IAsyncDisposable
{
    private const string ModulePath = "./_content/ChartAI.Blazor/chartai-blazor.js";

    // Config changes are detected by comparing this JSON: the model's property names and
    // converters, the same as the JS interop uses.
    private static readonly JsonSerializerOptions ConfigJsonOptions = new(JsonSerializerDefaults.Web);

    [Inject] private IJSRuntime JSRuntime { get; set; } = default!;

    /// <summary>
    /// Key of the chart in the JS module. It is read once, when the chart is created; a later
    /// change is ignored, so calls always reach the chart this component created.
    /// </summary>
    [Parameter] public string Id { get; set; } = Guid.NewGuid().ToString("N");
    [Parameter] public string Style { get; set; } = "width: 100%; height: 100%; min-height: 300px; display: block; position: relative;";
    [Parameter] public string? Class { get; set; }

    /// <summary>
    /// The chart options. A change is detected by comparing the serialized JSON with what was
    /// last sent, so a new instance with the same content costs nothing and an object changed
    /// in place is picked up the next time the parent renders.
    /// </summary>
    [Parameter] public ChartConfig Config { get; set; } = new ChartConfig();

    /// <summary>The data. A change is detected by reference: assign a new collection to send new data.</summary>
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
    /// Raised with the data range visible in the plot area once the view has settled after it
    /// moved: a zoom or pan gesture, a linked chart following another (the module's
    /// <c>setSyncViews</c>), the minimap, the range selector or <see cref="ResetViewAsync"/>.
    /// A live chart uses it to fetch the window the user moved to.
    /// </summary>
    [Parameter] public EventCallback<ChartViewRange> ViewChanged { get; set; }

    /// <summary>
    /// Raised with the <see cref="Annotation.Id"/> of the annotation whose label was clicked
    /// (null when it has none). Such a click reaches neither the zoom nor a click handler of
    /// the host.
    /// </summary>
    [Parameter] public EventCallback<string?> AnnotationClicked { get; set; }

    private readonly TaskCompletionSource<bool> ready = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private ElementReference chartContainer;
    private IJSObjectReference? module;
    private DotNetObjectReference<Chart>? selfRef;
    // The Id the chart was created under; every later call uses it.
    private string? chartKey;
    private bool isInitialized;
    private bool disposed;

    // What the engine was sent last, so only what changed is sent again.
    private ChartPlugins lastPlugins = ChartPlugins.None;
    private string? lastConfigJson;
    private IEnumerable<ChartSeries>? lastSeries;
    private bool darkThemeSent;
    private bool watchingView;
    private bool watchingAnnotations;
    // One parameter pass at a time; a change that arrives during one runs another after it.
    private bool applying;
    private bool applyAgain;

    private string? renderedStyle;
    private string? renderedClass;

    /// <summary>
    /// Completes with true once the chart is initialised, and with false when it never will be:
    /// WebGPU is unavailable, initialisation failed, or the component was disposed first. The
    /// public methods wait for it themselves, so a call made during initialisation is not lost;
    /// await it to know whether the chart came up (say, before starting a live timer).
    /// </summary>
    public Task<bool> Ready => ready.Task;

    protected override void OnInitialized()
    {
        renderedStyle = Style;
        renderedClass = Class;
    }

    /// <summary>
    /// The Chart renders a single host div that the engine draws into; it re-renders only when
    /// <see cref="Style"/> or <see cref="Class"/> changed.
    /// </summary>
    protected override bool ShouldRender()
    {
        if (Style == renderedStyle && Class == renderedClass) return false;
        renderedStyle = Style;
        renderedClass = Class;
        return true;
    }

    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        if (!firstRender) return;
        try
        {
            await InitializeAsync();
        }
        catch (Exception ex)
        {
            // Nothing escapes a lifecycle method: on Blazor Server that would end the circuit.
            if (!disposed) Console.WriteLine($"Error initializing ChartAI: {ex.Message}");
        }
        finally
        {
            ready.TrySetResult(isInitialized && !disposed);
        }
    }

    private async Task InitializeAsync()
    {
        IJSObjectReference mod;
        try
        {
            mod = await JSRuntime.InvokeAsync<IJSObjectReference>("import", ModulePath);
        }
        catch (Exception ex)
        {
            if (!disposed) Console.WriteLine($"Error loading ChartAI: {ex.Message}");
            return;
        }
        if (disposed)
        {
            // Disposed while the module was loading: nothing will use it.
            await DisposeQuietlyAsync(mod);
            return;
        }
        module = mod;

        try
        {
            await mod.InvokeVoidAsync("initEngine");
        }
        catch (JSException ex)
        {
            // Nothing can ever be drawn without an adapter: say so in the host element.
            Console.WriteLine($"ChartAI: WebGPU unavailable: {ex.Message}");
            if (!disposed)
            {
                try { await mod.InvokeVoidAsync("showUnavailable", chartContainer, UnavailableText); }
                catch (Exception e) when (IsInteropFailure(e)) { }
            }
            return;
        }
        if (disposed) return;

        // The values actually sent are recorded; anything that changed meanwhile is sent by the
        // parameter pass at the end.
        var key = Id;
        var config = Config;
        var series = Series;
        var plugins = Plugins;
        var configJson = SerializeConfig(config);

        await ApplyThemeAsync(mod, config);
        chartKey = key;
        await mod.InvokeVoidAsync("createChart", chartContainer, key, config, PluginNames(plugins));
        lastPlugins = plugins;
        lastConfigJson = configJson;
        if (disposed) return;

        await mod.InvokeVoidAsync("updateSeries", key, ChartWire.Series(series));
        lastSeries = series;
        if (disposed) return;

        await WatchAsync(mod, key);
        isInitialized = true;
        await ApplyParametersAsync();
    }

    protected override async Task OnParametersSetAsync()
    {
        if (!isInitialized || disposed) return;
        try
        {
            await ApplyParametersAsync();
        }
        catch (Exception ex) when (IsInteropFailure(ex))
        {
            // What failed is not recorded as sent, so the next parameter change sends it again.
            if (!disposed) Console.WriteLine($"ChartAI: updating the chart failed: {ex.Message}");
        }
    }

    private async Task ApplyParametersAsync()
    {
        if (applying)
        {
            applyAgain = true;
            return;
        }
        applying = true;
        try
        {
            do
            {
                applyAgain = false;
                var mod = module;
                if (mod is null || chartKey is null || disposed) return;
                await ApplyChangesAsync(mod, chartKey);
            }
            while (applyAgain);
        }
        finally
        {
            applying = false;
        }
    }

    private async Task ApplyChangesAsync(IJSObjectReference mod, string key)
    {
        var plugins = Plugins;
        var config = Config;
        var series = Series;
        var configJson = SerializeConfig(config);

        // A plugin change requires recreating the chart (plugins attach at creation). The JS side
        // carries the data over, whether it came from Series, SetDataAsync or PatchDataAsync.
        if (plugins != lastPlugins)
        {
            await mod.InvokeVoidAsync("recreateChart", chartContainer, key, config, PluginNames(plugins));
            lastPlugins = plugins;
            lastConfigJson = configJson;
        }
        else if (configJson != lastConfigJson)
        {
            await mod.InvokeVoidAsync("configure", key, config);
            lastConfigJson = configJson;
        }
        await ApplyThemeAsync(mod, config);

        if (!ReferenceEquals(series, lastSeries))
        {
            await mod.InvokeVoidAsync("updateSeries", key, ChartWire.Series(series));
            lastSeries = series;
        }
        await WatchAsync(mod, key);
    }

    // IsDark switches the global theme to dark, and back to light once it turns false again; a
    // chart that never set it leaves the theme alone.
    private async Task ApplyThemeAsync(IJSObjectReference mod, ChartConfig config)
    {
        var dark = config?.IsDark == true;
        if (dark == darkThemeSent) return;
        await mod.InvokeVoidAsync("setTheme", dark);
        darkThemeSent = dark;
    }

    private async Task WatchAsync(IJSObjectReference mod, string key)
    {
        if (disposed) return;
        if (ViewChanged.HasDelegate && !watchingView)
        {
            selfRef ??= DotNetObjectReference.Create(this);
            await mod.InvokeVoidAsync("watchView", key, selfRef);
            watchingView = true;
        }
        if (AnnotationClicked.HasDelegate && !watchingAnnotations)
        {
            selfRef ??= DotNetObjectReference.Create(this);
            await mod.InvokeVoidAsync("watchAnnotations", key, selfRef);
            watchingAnnotations = true;
        }
    }

    /// <summary>
    /// Force-resend the current Config and Series to the engine. The Series parameter replaces
    /// data set with <see cref="SetDataAsync(IEnumerable{ChartSeries})"/> or
    /// <see cref="PatchDataAsync"/>; use <see cref="RefreshConfigAsync"/> to resend the Config alone.
    /// </summary>
    public async Task RefreshAsync()
    {
        var mod = await WhenReadyAsync();
        if (mod is null) return;
        var config = Config;
        var series = Series;
        try
        {
            await mod.InvokeVoidAsync("configure", chartKey, config);
            lastConfigJson = SerializeConfig(config);
            await ApplyThemeAsync(mod, config);
            await mod.InvokeVoidAsync("updateSeries", chartKey, ChartWire.Series(series));
            lastSeries = series;
        }
        catch (Exception ex) when (IsTeardown(ex)) { }
    }

    /// <summary>
    /// Resend the current Config right away, without touching the data. A Config changed in
    /// place is also picked up the next time the parent renders.
    /// </summary>
    public async Task RefreshConfigAsync()
    {
        var mod = await WhenReadyAsync();
        if (mod is null) return;
        var config = Config;
        try
        {
            await mod.InvokeVoidAsync("configure", chartKey, config);
            lastConfigJson = SerializeConfig(config);
            await ApplyThemeAsync(mod, config);
        }
        catch (Exception ex) when (IsTeardown(ex)) { }
    }

    /// <summary>Replace the series data without re-evaluating other parameters.</summary>
    public Task SetDataAsync(IEnumerable<ChartSeries> series) => SetDataAsync(series, null, null);

    /// <summary>
    /// Replace the series data and size the GPU buffers for <paramref name="capacity"/>
    /// columns, so <see cref="PatchDataAsync"/> can append up to that many without recreating
    /// them. <paramref name="bounds"/> sets the data window; a side left null comes from the data.
    /// A call made before the chart is initialised runs once it is.
    /// </summary>
    public async Task SetDataAsync(IEnumerable<ChartSeries> series, int? capacity, ChartBounds? bounds)
    {
        var mod = await WhenReadyAsync();
        if (mod is null) return;
        try
        {
            await mod.InvokeVoidAsync("updateSeries", chartKey, ChartWire.Series(series), new SetDataOptions(capacity, bounds));
        }
        catch (Exception ex) when (IsTeardown(ex)) { }
    }

    /// <summary>
    /// Write columns in place instead of replacing the data: only the patched columns cross
    /// JS interop and only they are written into the existing GPU buffers, so a live tick costs
    /// the size of its delta rather than a rebuild of the chart. Every series must share the x
    /// axis, ascending; <see cref="ChartConfig.Capacity"/> sizes the buffers and they grow when
    /// a patch does not fit. Returns the column count after the patch, or 0 when the chart never
    /// came up (see <see cref="Ready"/>).
    /// </summary>
    public async Task<int> PatchDataAsync(ChartPatch patch)
    {
        var mod = await WhenReadyAsync();
        if (mod is null) return 0;
        try
        {
            return await mod.InvokeAsync<int>("patchSeries", chartKey, ChartWire.Patch(patch));
        }
        catch (Exception ex) when (IsTeardown(ex))
        {
            return 0;
        }
    }

    /// <summary>
    /// Move the data window without touching the data: a follow tick on which nothing new
    /// arrived. A side left null keeps its value; <paramref name="resetView"/> puts the view
    /// back to its home transform first.
    /// </summary>
    public async Task SetBoundsAsync(ChartBounds bounds, bool resetView = false)
    {
        var mod = await WhenReadyAsync();
        if (mod is null) return;
        try
        {
            await mod.InvokeVoidAsync("setBounds", chartKey, bounds, resetView);
        }
        catch (Exception ex) when (IsTeardown(ex)) { }
    }

    /// <summary>Animate the view back to its home (fit-to-data) transform.</summary>
    public async Task ResetViewAsync()
    {
        var mod = await WhenReadyAsync();
        if (mod is null) return;
        try
        {
            await mod.InvokeVoidAsync("resetView", chartKey);
        }
        catch (Exception ex) when (IsTeardown(ex)) { }
    }

    [JSInvokable]
    public Task OnViewChanged(double minX, double maxX, double minY, double maxY)
        => ViewChanged.InvokeAsync(new ChartViewRange(minX, maxX, minY, maxY));

    [JSInvokable]
    public Task OnAnnotationClicked(string? id)
        => AnnotationClicked.InvokeAsync(id);

    // The module once the chart is initialised; null when it never will be.
    private async Task<IJSObjectReference?> WhenReadyAsync()
    {
        if (!await ready.Task || disposed) return null;
        return module;
    }

    // A call that loses the race with DisposeAsync, or with the circuit going away, completes
    // quietly; any other failure reaches the caller.
    private bool IsTeardown(Exception ex) => disposed || ex is JSDisconnectedException;

    private static bool IsInteropFailure(Exception ex)
        => ex is JSException or JSDisconnectedException or OperationCanceledException or ObjectDisposedException;

    private static string SerializeConfig(ChartConfig config)
        => JsonSerializer.Serialize(config, ConfigJsonOptions);

    private static string[] PluginNames(ChartPlugins plugins)
    {
        var names = new List<string>();
        if (plugins.HasFlag(ChartPlugins.Crosshair)) names.Add("crosshair");
        if (plugins.HasFlag(ChartPlugins.Stats)) names.Add("stats");
        if (plugins.HasFlag(ChartPlugins.Ruler)) names.Add("ruler");
        if (plugins.HasFlag(ChartPlugins.TooltipPin)) names.Add("tooltip-pin");
        if (plugins.HasFlag(ChartPlugins.Minimap)) names.Add("minimap");
        if (plugins.HasFlag(ChartPlugins.RangeSelector)) names.Add("range-selector");
        return names.ToArray();
    }

    private sealed record SetDataOptions(
        [property: JsonPropertyName("capacity")] int? Capacity,
        [property: JsonPropertyName("bounds")] ChartBounds? Bounds);

    private static async ValueTask DisposeQuietlyAsync(IJSObjectReference mod)
    {
        try { await mod.DisposeAsync(); }
        catch { /* circuit teardown / JS already gone */ }
    }

    public async ValueTask DisposeAsync()
    {
        if (disposed) return;
        disposed = true;
        ready.TrySetResult(false);
        var mod = module;
        module = null;
        if (mod is not null)
        {
            try
            {
                if (chartKey is not null) await mod.InvokeVoidAsync("destroyChart", chartKey);
            }
            catch
            {
                // Ignore dispose errors (circuit teardown / JS already gone)
            }
            await DisposeQuietlyAsync(mod);
        }
        selfRef?.Dispose();
        selfRef = null;
    }
}
