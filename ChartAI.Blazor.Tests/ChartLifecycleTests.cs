using Bunit;
using ChartAI.Blazor.Components;
using ChartAI.Blazor.Models;
using Microsoft.JSInterop;

namespace ChartAI.Blazor.Tests;

/// <summary>Initialisation: early calls (B8), Ready (K15), init races and dispose (B24).</summary>
public class ChartLifecycleTests : ChartTestBase
{
    private int SeqOf(string identifier) => Module.CallsTo(identifier).Select(c => c.Seq).DefaultIfEmpty(-1).First();

    [Fact]
    public async Task SetDataAsync_before_init_is_sent_after_the_chart_is_created()
    {
        var init = Module.Hold("initEngine");
        var cut = RenderChart(series: new[] { Series("param-series") });
        await WaitUntil(() => Module.Count("initEngine") == 1, "initEngine");

        var call = cut.InvokeAsync(() => cut.Instance.SetDataAsync(new[] { Series("early-live") }, 100, new ChartBounds { MinX = 0, MaxX = 10 }));
        init.Open();
        await call.WaitAsync(Timeout);

        await WaitUntil(() => Module.CallsTo("updateSeries").Any(c => c.ArgsJson.Contains("early-live")), "updateSeries with the early data");
        var early = Module.CallsTo("updateSeries").First(c => c.ArgsJson.Contains("early-live"));
        Assert.True(early.Seq > SeqOf("createChart"), "the early data went out before createChart");
        Assert.Contains("\"capacity\":100", early.ArgsJson);
        Assert.Contains("early-live", Module.CallsTo("updateSeries").Last().ArgsJson);
    }

    [Fact]
    public async Task PatchDataAsync_before_init_runs_after_init_and_returns_the_count()
    {
        Module.Results["patchSeries"] = _ => 42;
        var init = Module.Hold("initEngine");
        var cut = RenderChart();
        await WaitUntil(() => Module.Count("initEngine") == 1, "initEngine");

        var set = cut.InvokeAsync(() => cut.Instance.SetDataAsync(new[] { Series("live") }, 100, null));
        var patch = cut.InvokeAsync(() => cut.Instance.PatchDataAsync(new ChartPatch
        {
            X = new[] { 5.0 },
            Series = new[] { new ChartChannels { Y = new[] { 10.0 } } },
        }));
        init.Open();
        await set.WaitAsync(Timeout);
        var n = await patch.WaitAsync(Timeout);

        Assert.Equal(42, n);
        var patchCall = Module.CallsTo("patchSeries").Single();
        Assert.True(patchCall.Seq > SeqOf("createChart"));
        var live = Module.CallsTo("updateSeries").First(c => c.ArgsJson.Contains("live"));
        Assert.True(patchCall.Seq > live.Seq, "the patch overtook the SetData before it");
    }

    [Fact]
    public async Task SetBounds_ResetView_and_Refresh_before_init_run_after_init()
    {
        var init = Module.Hold("initEngine");
        var cut = RenderChart(config: new ChartConfig { WatermarkText = "wm" });
        await WaitUntil(() => Module.Count("initEngine") == 1, "initEngine");

        var bounds = cut.InvokeAsync(() => cut.Instance.SetBoundsAsync(new ChartBounds { MinX = 1, MaxX = 2 }, true));
        var reset = cut.InvokeAsync(() => cut.Instance.ResetViewAsync());
        var refresh = cut.InvokeAsync(() => cut.Instance.RefreshAsync());
        init.Open();
        await Task.WhenAll(bounds, reset, refresh).WaitAsync(Timeout);

        var created = SeqOf("createChart");
        Assert.True(created > 0, "createChart was never called");
        Assert.Contains(Module.CallsTo("setBounds"), c => c.Seq > created);
        Assert.Contains(Module.CallsTo("resetView"), c => c.Seq > created);
        // RefreshAsync force-resends the Config.
        Assert.Contains(Module.CallsTo("configure"), c => c.Seq > created);
    }

    [Fact]
    public async Task Ready_completes_true_once_the_chart_is_initialised()
    {
        var cut = RenderChart();
        var ready = ReadyTask(cut.Instance);
        Assert.NotNull(ready);
        Assert.True(await ready!.WaitAsync(Timeout));
        Assert.Equal(1, Module.Count("createChart"));
    }

    [Fact]
    public async Task Ready_completes_false_and_early_calls_complete_when_WebGPU_is_unavailable()
    {
        var init = Module.Hold("initEngine");
        Module.Failures["initEngine"] = new JSException("No WebGPU adapter");
        var cut = RenderChart();
        await WaitUntil(() => Module.Count("initEngine") == 1, "initEngine");

        var set = cut.InvokeAsync(() => cut.Instance.SetDataAsync(new[] { Series("live") }, null, null));
        var patch = cut.InvokeAsync(() => cut.Instance.PatchDataAsync(new ChartPatch { X = new[] { 1.0 }, Series = new[] { new ChartChannels { Y = new[] { 1.0 } } } }));
        init.Open();
        await set.WaitAsync(Timeout);
        Assert.Equal(0, await patch.WaitAsync(Timeout));
        Assert.Equal(0, Module.Count("createChart"));

        var ready = ReadyTask(cut.Instance);
        Assert.NotNull(ready);
        Assert.False(await ready!.WaitAsync(Timeout));
    }

    [Fact]
    public async Task Early_calls_complete_when_the_component_is_disposed_before_init()
    {
        var init = Module.Hold("initEngine");
        var cut = RenderChart();
        await WaitUntil(() => Module.Count("initEngine") == 1, "initEngine");

        var set = cut.InvokeAsync(() => cut.Instance.SetDataAsync(new[] { Series("live") }, null, null));
        var patch = cut.InvokeAsync(() => cut.Instance.PatchDataAsync(new ChartPatch { X = new[] { 1.0 }, Series = new[] { new ChartChannels { Y = new[] { 1.0 } } } }));
        await Ctx.DisposeComponentsAsync();
        await set.WaitAsync(Timeout);
        Assert.Equal(0, await patch.WaitAsync(Timeout));

        init.Open();
        await Task.Delay(200);
        Assert.Equal(0, Module.Count("createChart"));
    }

    [Fact]
    public async Task Ready_completes_false_when_disposed_before_init()
    {
        var init = Module.Hold("initEngine");
        var cut = RenderChart();
        await WaitUntil(() => Module.Count("initEngine") == 1, "initEngine");
        var ready = ReadyTask(cut.Instance);
        Assert.NotNull(ready);
        await Ctx.DisposeComponentsAsync();
        Assert.False(await ready!.WaitAsync(Timeout));
        init.Open();
    }

    [Fact]
    public async Task Disposing_while_the_module_import_is_pending_disposes_the_module_and_starts_nothing()
    {
        Js.ImportGate = new Gate();
        RenderChart();
        await WaitUntil(() => Js.RuntimeCalls.Contains("import"), "the module import");
        await Ctx.DisposeComponentsAsync();
        Js.ImportGate.Open();
        await Task.Delay(300);
        Assert.True(Module.Disposed, "the module that arrived after dispose was not disposed");
        Assert.Equal(0, Module.Count("createChart"));
    }

    [Fact]
    public async Task A_config_change_during_createChart_is_sent_after_init()
    {
        var create = Module.Hold("createChart");
        var cut = RenderChart(config: new ChartConfig { WatermarkText = "wm-A" });
        await WaitUntil(() => Module.Count("createChart") == 1, "createChart");
        cut.Render(p => p.Add(c => c.Config, new ChartConfig { WatermarkText = "wm-B" }));
        create.Open();
        await WaitUntil(
            () => Module.Calls.Any(c => c.Identifier is "configure" or "recreateChart" && c.ArgsJson.Contains("wm-B")),
            "the changed Config to be sent");
    }

    [Fact]
    public async Task A_series_change_during_the_initial_upload_is_sent_after_init()
    {
        var upload = Module.Hold("updateSeries");
        var cut = RenderChart(series: new[] { Series("series-one") });
        await WaitUntil(() => Module.Count("updateSeries") == 1, "the initial updateSeries");
        cut.Render(p => p.Add(c => c.Series, new[] { Series("series-two") }));
        upload.Open();
        await WaitUntil(() => Module.CallsTo("updateSeries").Any(c => c.ArgsJson.Contains("series-two")), "the changed Series to be sent");
    }
}
