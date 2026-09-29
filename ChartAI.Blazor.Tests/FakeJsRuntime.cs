using System.Text.Json;
using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;

namespace ChartAI.Blazor.Tests;

/// <summary>One JS interop invocation on the chart module, in call order.</summary>
public sealed record JsCall(int Seq, string Identifier, object?[] Args, Type ResultType)
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    /// <summary>The arguments as JSON (element and .NET object references as placeholders).</summary>
    public string ArgsJson
    {
        get
        {
            var parts = new List<string>();
            foreach (var a in Args)
            {
                if (a is null) { parts.Add("null"); continue; }
                if (a is ElementReference) { parts.Add("\"<element>\""); continue; }
                var t = a.GetType();
                if (t.IsGenericType && t.GetGenericTypeDefinition() == typeof(DotNetObjectReference<>)) { parts.Add("\"<dotnet-ref>\""); continue; }
                try { parts.Add(JsonSerializer.Serialize(a, t, Web)); }
                catch (Exception ex) { parts.Add($"\"<unserialisable {t.Name}: {ex.GetType().Name}>\""); }
            }
            return "[" + string.Join(",", parts) + "]";
        }
    }

    public override string ToString() => $"#{Seq} {Identifier}({ArgsJson})";
}

/// <summary>Holds invocations of one identifier until opened (or failed).</summary>
public sealed class Gate
{
    private readonly TaskCompletionSource tcs = new(TaskCreationOptions.RunContinuationsAsynchronously);
    public Task Task => tcs.Task;
    public void Open() => tcs.TrySetResult();
    public void Fail(Exception ex) => tcs.TrySetException(ex);
}

/// <summary>
/// The chart module (chartai-blazor.js) as the component sees it. Records every invocation in
/// order; a test can hold an identifier behind a <see cref="Gate"/>, make it throw, or give it
/// a result. Unconfigured invocations complete at once with the default result.
/// </summary>
public sealed class FakeJsModule : IJSObjectReference
{
    private readonly object sync = new();
    private readonly List<JsCall> calls = new();
    private int seq;

    public Dictionary<string, Gate> Gates { get; } = new();
    public Dictionary<string, Exception> Failures { get; } = new();
    public Dictionary<string, Func<object?[], object?>> Results { get; } = new();
    public bool Disposed { get; private set; }

    public IReadOnlyList<JsCall> Calls { get { lock (sync) return calls.ToList(); } }

    public IReadOnlyList<JsCall> CallsTo(string identifier) => Calls.Where(c => c.Identifier == identifier).ToList();

    public int Count(string identifier) => CallsTo(identifier).Count;

    public Gate Hold(string identifier)
    {
        var g = new Gate();
        Gates[identifier] = g;
        return g;
    }

    public ValueTask<TValue> InvokeAsync<TValue>(string identifier, object?[]? args)
        => InvokeAsync<TValue>(identifier, CancellationToken.None, args);

    public async ValueTask<TValue> InvokeAsync<TValue>(string identifier, CancellationToken cancellationToken, object?[]? args)
    {
        JsCall call;
        lock (sync)
        {
            call = new JsCall(++seq, identifier, args ?? Array.Empty<object?>(), typeof(TValue));
            calls.Add(call);
        }
        if (Gates.TryGetValue(identifier, out var gate)) await gate.Task;
        if (Failures.TryGetValue(identifier, out var ex)) throw ex;
        if (Results.TryGetValue(identifier, out var produce))
        {
            var v = produce(call.Args);
            if (v is TValue t) return t;
            if (v is not null && typeof(TValue) != typeof(object)) return (TValue)Convert.ChangeType(v, Nullable.GetUnderlyingType(typeof(TValue)) ?? typeof(TValue));
        }
        return default!;
    }

    public ValueTask DisposeAsync()
    {
        Disposed = true;
        return ValueTask.CompletedTask;
    }
}

/// <summary>IJSRuntime whose "import" returns the <see cref="FakeJsModule"/>.</summary>
public sealed class FakeJsRuntime : IJSRuntime
{
    public FakeJsModule Module { get; } = new();
    public List<string> RuntimeCalls { get; } = new();
    public Gate? ImportGate { get; set; }
    public Exception? ImportFailure { get; set; }

    public ValueTask<TValue> InvokeAsync<TValue>(string identifier, object?[]? args)
        => InvokeAsync<TValue>(identifier, CancellationToken.None, args);

    public async ValueTask<TValue> InvokeAsync<TValue>(string identifier, CancellationToken cancellationToken, object?[]? args)
    {
        lock (RuntimeCalls) RuntimeCalls.Add(identifier);
        if (identifier == "import")
        {
            if (ImportGate is not null) await ImportGate.Task;
            if (ImportFailure is not null) throw ImportFailure;
            if (Module is TValue m) return m;
        }
        return default!;
    }
}
