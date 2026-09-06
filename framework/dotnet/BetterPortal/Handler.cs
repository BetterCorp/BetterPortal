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

/// <summary>Hosting supplies an already resolved scope and verified caller.</summary>
public sealed record RequestContext(ScopedContext Scope, AuthorizedCaller Caller, string Method, string Path,
    IReadOnlyDictionary<string, object?>? Config = null);

public sealed record HandlerContext<TParams, TQuery, THeaders, TBody>(RequestContext RequestContext,
    TParams Params, TQuery Query, THeaders Headers, TBody Request, CancellationToken Cancellation);

public sealed class Handler<TParams, TQuery, THeaders, TBody, TResult>
{
    public Schema ResponseSchema { get; }
    public IReadOnlyDictionary<string, Schema> Schemas { get; }
    public Dictionary<string, object?> InputDocument => Contracts.ObjectDocument(new[] { "params", "query", "headers", "request" }.ToDictionary(name => name,
        name => (Dictionary<string, object?>)Json.Read(Json.Write(V.Export(Schemas.GetValueOrDefault(name, Contracts.Get("JsonObjectSchema")))))!), "reject");
    private readonly Func<HandlerContext<TParams, TQuery, THeaders, TBody>, ValueTask<TResult>> run;

    public Handler(Schema response, Func<HandlerContext<TParams, TQuery, THeaders, TBody>, ValueTask<TResult>> run,
        Schema? @params = null, Schema? query = null, Schema? headers = null, Schema? request = null)
    {
        ResponseSchema = response; this.run = run;
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

    public async ValueTask<TResult> Invoke(RequestContext context, IReadOnlyDictionary<string, object?> values, CancellationToken cancellation = default)
    {
        cancellation.ThrowIfCancellationRequested();
        var result = await run(Prepare(context, values, cancellation)).AsTask().WaitAsync(cancellation);
        cancellation.ThrowIfCancellationRequested();
        try { return Contracts.Parse<TResult>(ResponseSchema, result); }
        catch (ValidationError error) { throw new HandlerOutputException(error); }
    }
}
