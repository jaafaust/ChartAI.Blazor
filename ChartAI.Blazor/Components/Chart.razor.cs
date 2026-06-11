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
    
    [Parameter] public ChartConfig Config { get; set; } = new ChartConfig();
    [Parameter] public IEnumerable<ChartSeries> Series { get; set; } = Array.Empty<ChartSeries>();

    private ElementReference chartContainer;
    private IJSObjectReference? module;
    private bool isInitialized;

    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        if (firstRender)
        {
            try
            {
                module = await JSRuntime.InvokeAsync<IJSObjectReference>("import", "./_content/ChartAI.Blazor/chartai-blazor.js");
                await module.InvokeVoidAsync("initEngine");
                
                await module.InvokeVoidAsync("createChart", chartContainer, Id, Config);
                await module.InvokeVoidAsync("updateSeries", Id, Series);
                
                isInitialized = true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error initializing ChartAI: {ex.Message}");
            }
        }
    }

    protected override async Task OnParametersSetAsync()
    {
        if (isInitialized && module != null)
        {
            await module.InvokeVoidAsync("configure", Id, Config);
            await module.InvokeVoidAsync("updateSeries", Id, Series);
        }
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
                // Ignore dispose errors
            }
        }
    }
}
