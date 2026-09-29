using Bunit;
using ChartAI.Blazor.Components;
using ChartAI.Blazor.Models;

namespace ChartAI.Blazor.Tests;

/// <summary>Parameter changes after init: Config (P13), Plugins (B21), Id and Style/Class (B38),
/// IsDark (B23).</summary>
public class ChartParameterTests : ChartTestBase
{
    [Fact]
    public async Task A_new_Config_with_the_same_JSON_does_not_reconfigure()
    {
        var cut = await RenderInitialised(config: new ChartConfig { WatermarkText = "same", FormatX = AxisFormat.Date });
        var before = Module.Count("configure");
        cut.Render(p => p.Add(c => c.Config, new ChartConfig { WatermarkText = "same", FormatX = AxisFormat.Date }));
        await Task.Delay(150);
        Assert.Equal(before, Module.Count("configure"));
    }

    [Fact]
    public async Task A_Config_with_different_JSON_reconfigures_once()
    {
        var cut = await RenderInitialised(config: new ChartConfig { WatermarkText = "one" });
        var before = Module.Count("configure");
        cut.Render(p => p.Add(c => c.Config, new ChartConfig { WatermarkText = "two" }));
        await WaitUntil(() => Module.Count("configure") > before, "configure");
        await Task.Delay(100);
        Assert.Equal(before + 1, Module.Count("configure"));
        Assert.Contains("two", Module.CallsTo("configure").Last().ArgsJson);
    }

    [Fact]
    public async Task A_Config_mutated_in_place_is_detected_by_its_JSON()
    {
        var cfg = new ChartConfig { WatermarkText = "before" };
        var cut = await RenderInitialised(config: cfg);
        var before = Module.Count("configure");
        cfg.WatermarkText = "after";
        cut.Render(p => p.Add(c => c.Config, cfg));
        await WaitUntil(() => Module.Count("configure") > before, "configure after an in-place change");
        Assert.Contains("after", Module.CallsTo("configure").Last().ArgsJson);
    }

    [Fact]
    public async Task Changing_Plugins_recreates_the_chart_without_resending_the_stale_Series()
    {
        var cut = await RenderInitialised(series: new[] { Series("stale-param-series") });
        await cut.InvokeAsync(() => cut.Instance.SetDataAsync(new[] { Series("live-data") }, 50, null)).WaitAsync(Timeout);
        cut.Render(p => p.Add(c => c.Plugins, ChartPlugins.Crosshair));
        await WaitUntil(() => Module.Count("recreateChart") == 1, "recreateChart");
        await Task.Delay(150);
        var recreate = Module.CallsTo("recreateChart").Single();
        Assert.Contains("crosshair", recreate.ArgsJson);
        var stale = Module.CallsTo("updateSeries").Where(c => c.Seq > recreate.Seq && c.ArgsJson.Contains("stale-param-series")).ToList();
        Assert.Empty(stale);
    }

    [Fact]
    public async Task Changing_Id_after_creation_keeps_calls_on_the_created_chart()
    {
        var cut = await RenderInitialised(id: "first-id");
        cut.Render(p => p.Add(c => c.Id, "second-id"));
        await cut.InvokeAsync(() => cut.Instance.SetDataAsync(new[] { Series("after-id-change") }, null, null)).WaitAsync(Timeout);
        await cut.InvokeAsync(() => cut.Instance.ResetViewAsync()).WaitAsync(Timeout);

        var upload = Module.CallsTo("updateSeries").Last(c => c.ArgsJson.Contains("after-id-change"));
        Assert.Equal("first-id", upload.Args[0]);
        Assert.Equal("first-id", Module.CallsTo("resetView").Last().Args[0]);
        Assert.DoesNotContain(Module.Calls, c => c.Args.Length > 0 && Equals(c.Args[0], "second-id"));
        Assert.DoesNotContain(Module.Calls, c => c.Args.Length > 1 && Equals(c.Args[1], "second-id"));
    }

    [Fact]
    public async Task Changing_Class_or_Style_after_init_rerenders_the_host()
    {
        var cut = await RenderInitialised();
        cut.Render(p => p.Add(c => c.Class, "big-chart"));
        Assert.Equal("big-chart", cut.Find("div").GetAttribute("class"));
        cut.Render(p => p.Add(c => c.Style, "height: 123px;"));
        Assert.Contains("123px", cut.Find("div").GetAttribute("style"));
    }

    [Fact]
    public async Task IsDark_sets_the_global_theme()
    {
        var cut = await RenderInitialised(config: new ChartConfig { IsDark = true });
        await WaitUntil(() => Module.CallsTo("setTheme").Any(c => Equals(c.Args.FirstOrDefault(), true)), "setTheme(true)");
        cut.Render(p => p.Add(c => c.Config, new ChartConfig { IsDark = false }));
        await WaitUntil(() => Module.CallsTo("setTheme").LastOrDefault() is { } last && Equals(last.Args.FirstOrDefault(), false), "setTheme(false)");
    }
}
