using Bunit;
using ChartAI.Blazor.Components;
using ChartAI.Blazor.Models;

namespace ChartAI.Blazor.Tests;

/// <summary>
/// B9 / K15: interop failures in lifecycle methods (a disconnected Blazor Server circuit, a JS
/// error, a canceled call, a disposed runtime) must never escape: on Server they end the circuit.
/// </summary>
public class ChartExceptionTests : ChartTestBase
{
    [Theory]
    [MemberData(nameof(InteropExceptions))]
    public async Task A_failing_configure_in_OnParametersSetAsync_does_not_escape(string kind)
    {
        var cut = await RenderInitialised(config: new ChartConfig { WatermarkText = "one" });
        Module.Failures["configure"] = MakeException(kind);
        cut.Render(p => p.Add(c => c.Config, new ChartConfig { WatermarkText = "two" }));
        await AssertNoUnhandledException();
    }

    [Theory]
    [MemberData(nameof(InteropExceptions))]
    public async Task A_failing_updateSeries_in_OnParametersSetAsync_does_not_escape(string kind)
    {
        var cut = await RenderInitialised(series: new[] { Series("a") });
        Module.Failures["updateSeries"] = MakeException(kind);
        cut.Render(p => p.Add(c => c.Series, new[] { Series("b") }));
        await AssertNoUnhandledException();
    }

    [Theory]
    [MemberData(nameof(InteropExceptions))]
    public async Task A_failing_recreateChart_in_OnParametersSetAsync_does_not_escape(string kind)
    {
        var cut = await RenderInitialised();
        Module.Failures["recreateChart"] = MakeException(kind);
        cut.Render(p => p.Add(c => c.Plugins, ChartPlugins.Ruler));
        await AssertNoUnhandledException();
    }

    [Theory]
    [MemberData(nameof(InteropExceptions))]
    public async Task A_failing_createChart_in_OnAfterRenderAsync_does_not_escape(string kind)
    {
        Module.Failures["createChart"] = MakeException(kind);
        RenderChart();
        await WaitUntil(() => Module.Count("createChart") == 1, "createChart");
        await AssertNoUnhandledException();
    }

    [Theory]
    [MemberData(nameof(InteropExceptions))]
    public async Task A_failing_module_import_does_not_escape(string kind)
    {
        Js.ImportFailure = MakeException(kind);
        RenderChart();
        await WaitUntil(() => Js.RuntimeCalls.Contains("import"), "the module import");
        await AssertNoUnhandledException();
    }

    [Theory]
    [MemberData(nameof(InteropExceptions))]
    public async Task A_failing_destroyChart_in_DisposeAsync_does_not_escape(string kind)
    {
        await RenderInitialised();
        Module.Failures["destroyChart"] = MakeException(kind);
        await Ctx.DisposeComponentsAsync();
        await AssertNoUnhandledException();
    }
}
