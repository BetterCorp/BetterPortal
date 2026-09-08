using AnyVali;
using System.Collections.Frozen;

namespace BetterPortal;

public sealed class HandlerInputException(string field, ValidationError cause) : Exception("Invalid request " + field, cause)
{
    public int Status => 400;
    public string Field { get; } = field;
    public ValidationError Validation { get; } = cause;
}
public sealed class HandlerOutputException(ValidationError cause) : Exception("Response validation failed", cause)
{
    public int Status => 500;
}

public sealed class ResponseState
{
    private int status = 200;
    private readonly List<KeyValuePair<string, string>> headers = [];
    public int Status { get => status; set { _ = new RawResponse(status: value); status = value; } }
    public IReadOnlyList<KeyValuePair<string, string>> Headers => headers.AsReadOnly();
    public void SetHeader(string name, string value, bool append = false)
    {
        _ = new RawResponse(headers: [new(name, value)]);
        if (name.Equals("content-encoding", StringComparison.OrdinalIgnoreCase)) throw new ArgumentException("Content-Encoding requires a raw response");
        if (!append) RemoveHeader(name);
        headers.Add(new(name, value));
    }
    public void RemoveHeader(string name) => headers.RemoveAll(pair => pair.Key.Equals(name, StringComparison.OrdinalIgnoreCase));
}

/// <summary>Hosting supplies an already resolved scope and verified caller.</summary>
public sealed record RequestContext(ScopedContext Scope, AuthorizedCaller Caller, string Method, string Path,
    IReadOnlyDictionary<string, object?>? Config = null, Generated.MultipartRequest? Multipart = null)
{
    public ResponseState Response { get; init; } = new();
    public Urls Urls { get; init; } = new(Scope, null, null, Path);
    internal RequestClients? ClientContext { get; init; }
    [System.Text.Json.Serialization.JsonIgnore]
    public CancellationToken SnapshotRetired { get; init; }
    [System.Text.Json.Serialization.JsonIgnore]
    public RequestClients Clients => ClientContext ?? throw new InvalidOperationException("Clients require a service request context");
}

public sealed record HandlerContext<TParams, TQuery, THeaders, TBody>(RequestContext RequestContext,
    TParams Params, TQuery Query, THeaders Headers, TBody Request, CancellationToken Cancellation)
{
    public ResponseState Response => RequestContext.Response;
    public Urls Urls => RequestContext.Urls;
}
public sealed record Invocation(object? Value, object? Params, object? Query);

/// <summary>Common registration surface for handlers with different input/output types.</summary>
public abstract class Handler
{
    public abstract Schema? ResponseSchema { get; }
    public virtual bool IsRaw => false;
    public virtual bool IsStreaming => false;
    public virtual IReadOnlyCollection<string> StreamRendererKeys => [];
    public virtual Dictionary<string, object?>? StreamingMetadata => null;
    public virtual RawResponse OpenStream(RequestContext context, IReadOnlyDictionary<string, object?> values, bool sse = false,
        Func<string, object?, object?, RenderContext>? renderContext = null, CancellationToken cancellation = default)
        => throw new InvalidOperationException("Handler does not stream");
    public virtual ValueTask<string?> StreamShell(RequestContext context, IReadOnlyDictionary<string, object?> values, string connectionPath, string mode,
        Func<string, object?, object?, RenderContext> renderContext, CancellationToken cancellation = default) => ValueTask.FromResult<string?>(null);
    public virtual IReadOnlyList<Renderer> Renderers => [];
    public abstract IReadOnlyDictionary<string, Schema> Schemas { get; }
    public Dictionary<string, object?> InputDocument => Contracts.ObjectDocument(new[] { "params", "query", "headers", "request" }.ToDictionary(name => name,
        name => (Dictionary<string, object?>)Json.Read(Json.Write(V.Export(Schemas.GetValueOrDefault(name, Contracts.Get("JsonObjectSchema")))))!), "reject");
    internal abstract ValueTask<Invocation> ExecuteBoxed(RequestContext context, IReadOnlyDictionary<string, object?> values, CancellationToken cancellation);
    internal async ValueTask<object?> InvokeBoxed(RequestContext context, IReadOnlyDictionary<string, object?> values, CancellationToken cancellation) =>
        (await ExecuteBoxed(context, values, cancellation)).Value;
}

public abstract class Handler<TParams, TQuery, THeaders, TBody> : Handler
{
    public override IReadOnlyDictionary<string, Schema> Schemas { get; }
    protected Handler(Schema? @params, Schema? query, Schema? headers, Schema? request)
    {
        Schemas = new Dictionary<string, Schema?>(StringComparer.Ordinal)
        { ["params"] = @params, ["query"] = query, ["headers"] = headers, ["request"] = request }
            .Where(pair => pair.Value is not null).ToFrozenDictionary(pair => pair.Key, pair => pair.Value!, StringComparer.Ordinal);
    }
    private T Parse<T>(string name, IReadOnlyDictionary<string, object?> values)
    {
        try { return Contracts.Parse<T>(Schemas.GetValueOrDefault(name, Contracts.Get("JsonObjectSchema")), values.GetValueOrDefault(name, new Dictionary<string, object?>())); }
        catch (ValidationError error) { throw new HandlerInputException(name, error); }
    }
    public HandlerContext<TParams, TQuery, THeaders, TBody> Prepare(RequestContext context, IReadOnlyDictionary<string, object?> values, CancellationToken cancellation = default) =>
        new(context, Parse<TParams>("params", values), Parse<TQuery>("query", values), Parse<THeaders>("headers", values), Parse<TBody>("request", values), cancellation);
}

public sealed class Handler<TParams, TQuery, THeaders, TBody, TResult> : Handler<TParams, TQuery, THeaders, TBody>
{
    public override Schema ResponseSchema { get; }
    public override IReadOnlyList<Renderer> Renderers { get; }
    private readonly Func<HandlerContext<TParams, TQuery, THeaders, TBody>, ValueTask<TResult>> run;
    public Handler(Schema response, Func<HandlerContext<TParams, TQuery, THeaders, TBody>, ValueTask<TResult>> run,
        Schema? @params = null, Schema? query = null, Schema? headers = null, Schema? request = null,
        IEnumerable<Renderer<TResult>>? renderers = null) : base(@params, query, headers, request)
    {
        ArgumentNullException.ThrowIfNull(response); ArgumentNullException.ThrowIfNull(run);
        ResponseSchema = response; this.run = run;
        Renderers = Renderer.Unique(renderers ?? []);
    }

    private async ValueTask<(TResult Value, HandlerContext<TParams, TQuery, THeaders, TBody> Prepared)> Execute(RequestContext context, IReadOnlyDictionary<string, object?> values, CancellationToken cancellation)
    {
        cancellation.ThrowIfCancellationRequested();
        var prepared = Prepare(context, values, cancellation);
        var result = await run(prepared).AsTask().WaitAsync(cancellation);
        if (result is RawResponse raw)
        {
            await raw.DisposeAsync();
            throw new InvalidOperationException("Raw responses require a RawHandler");
        }
        cancellation.ThrowIfCancellationRequested();
        try { return (Contracts.Parse<TResult>(ResponseSchema, result), prepared); }
        catch (ValidationError error) { throw new HandlerOutputException(error); }
    }
    public async ValueTask<TResult> Invoke(RequestContext context, IReadOnlyDictionary<string, object?> values, CancellationToken cancellation = default) =>
        (await Execute(context, values, cancellation)).Value;
    internal override async ValueTask<Invocation> ExecuteBoxed(RequestContext context, IReadOnlyDictionary<string, object?> values, CancellationToken cancellation)
    {
        var result = await Execute(context, values, cancellation);
        return new(result.Value, result.Prepared.Params, result.Prepared.Query);
    }
}
