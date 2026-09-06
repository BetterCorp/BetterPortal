using AnyVali;
using Node = System.Collections.Generic.Dictionary<string, object?>;

namespace BetterPortal;

public sealed class StreamRenderers<TItem, TSummary>
{
    public string Renderer => Shell.Identity.Renderer;
    public Renderer<Generated.StreamShellContext> Shell { get; }
    public Renderer<TItem> Item { get; }
    public Renderer<TSummary>? Summary { get; }
    public Renderer<Generated.StreamErrorFrame>? Error { get; }
    public StreamRenderers(string renderer,
        Func<Generated.StreamShellContext, RenderContext, ValueTask<string>> shell,
        Func<TItem, RenderContext, ValueTask<string>> item,
        Func<TSummary, RenderContext, ValueTask<string>>? summary = null,
        Func<Generated.StreamErrorFrame, RenderContext, ValueTask<string>>? error = null)
    {
        var declaration = new Generated.RendererDeclarationInput { Renderer = renderer };
        Shell = new(declaration, shell); Item = new(declaration, item);
        Summary = summary is null ? null : new(declaration, summary);
        Error = error is null ? null : new(declaration, error);
    }
}

/// <summary>Finite operation with ordinary input policy and one validated producer per consuming request.</summary>
public sealed class FiniteHandler<TParams, TQuery, THeaders, TBody, TItem, TSummary> : Handler<TParams, TQuery, THeaders, TBody>
{
    private readonly StreamHandler<TItem, TSummary, HandlerContext<TParams, TQuery, THeaders, TBody>> stream;
    private readonly int maxItems, maxBytes, maxFrameBytes;
    private readonly IReadOnlyDictionary<string, StreamRenderers<TItem, TSummary>> streamRenderers;
    public override Schema ResponseSchema => stream.ResponseSchema;
    public override bool IsStreaming => true;
    public override IReadOnlyList<Renderer> Renderers { get; }
    public override IReadOnlyCollection<string> StreamRendererKeys => streamRenderers.Keys.ToArray();
    public override Node StreamingMetadata
    {
        get
        {
            var value = new Node { ["itemSchema"] = Operation.Export(stream.ItemSchema) };
            if (stream.SummarySchema is { } summary) value["summarySchema"] = Operation.Export(summary);
            return value;
        }
    }
    public FiniteHandler(Schema item, Func<HandlerContext<TParams, TQuery, THeaders, TBody>, CancellationToken, IAsyncEnumerable<StreamValue<TItem, TSummary>>> run,
        Schema? summary = null, Schema? @params = null, Schema? query = null, Schema? headers = null, Schema? request = null,
        IEnumerable<Renderer<Node>>? renderers = null, IEnumerable<StreamRenderers<TItem, TSummary>>? streamRenderers = null,
        int maxFrameBytes = 1024 * 1024, int maxItems = 10000, int maxBytes = 8 * 1024 * 1024)
        : base(@params, query, headers, request)
    {
        if (maxItems < 0 || maxBytes < 2) throw new ArgumentException("Invalid buffer limits");
        stream = new(item, run, summary, maxFrameBytes); this.maxItems = maxItems; this.maxBytes = maxBytes; this.maxFrameBytes = maxFrameBytes;
        Renderers = Renderer.Unique(renderers ?? []);
        this.streamRenderers = (streamRenderers ?? []).ToDictionary(value => value.Renderer, StringComparer.Ordinal);
    }
    internal override async ValueTask<Invocation> ExecuteBoxed(RequestContext context, IReadOnlyDictionary<string, object?> values, CancellationToken cancellation)
    {
        var prepared = Prepare(context, values, cancellation);
        var value = await stream.Buffered(prepared, maxItems, maxBytes, cancellation);
        return new(value, prepared.Params, prepared.Query);
    }
    public override RawResponse OpenStream(RequestContext context, IReadOnlyDictionary<string, object?> values, bool sse = false,
        Func<string, object?, object?, RenderContext>? renderContext = null, CancellationToken cancellation = default)
    {
        var prepared = Prepare(context, values, cancellation);
        var theme = (context.Scope.App.GetValueOrDefault("shell") as Node)?.GetValueOrDefault("renderer") as string;
        var renderer = theme is not null ? streamRenderers.GetValueOrDefault(theme) : null;
        return new RawResponse(sse ? Sse(prepared, renderer, renderer is not null && renderContext is not null ? renderContext(renderer.Renderer, prepared.Params, prepared.Query) : null, cancellation)
            : stream.Ndjson(prepared, cancellation), headers: new Dictionary<string, string>
        { ["content-type"] = sse ? "text/event-stream; charset=utf-8" : "application/x-ndjson; charset=utf-8", ["cache-control"] = "no-store" });
    }
    public override async ValueTask<string?> StreamShell(RequestContext context, IReadOnlyDictionary<string, object?> values, string connectionPath, string mode,
        Func<string, object?, object?, RenderContext> renderContext, CancellationToken cancellation = default)
    {
        var theme = (context.Scope.App.GetValueOrDefault("shell") as Node)?.GetValueOrDefault("renderer") as string;
        var renderer = theme is not null ? streamRenderers.GetValueOrDefault(theme) : null;
        if (renderer is null || mode == "page" && Renderers.Any(value => value.Identity == (theme, "page", null, 200))) return null;
        var prepared = Prepare(context, values, cancellation);
        var data = Contracts.Parse<Generated.StreamShellContext>("StreamShellContextSchema", new { sseConnectPath = connectionPath, @params = prepared.Params, query = prepared.Query });
        return await renderer.Shell.Render(data, renderContext(renderer.Renderer, prepared.Params, prepared.Query));
    }
    private static T Decode<T>(object? value) => System.Text.Json.JsonSerializer.Deserialize<T>(Json.Write(value), Json.Options)!;
    private async IAsyncEnumerable<byte[]> Sse(HandlerContext<TParams, TQuery, THeaders, TBody> prepared, StreamRenderers<TItem, TSummary>? renderer,
        RenderContext? context, [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellation)
    {
        await foreach (var frame in stream.Frames(prepared, cancellation))
        {
            var kind = (string)frame["kind"]!; byte[] message; var failed = false;
            try
            {
                var data = Json.Write(frame);
                if (renderer is not null && context is not null)
                {
                    if (kind == "item") data = await renderer.Item.Render(Decode<TItem>(frame["data"]), context);
                    else if (kind == "summary")
                    {
                        if (renderer.Summary is null) continue;
                        data = await renderer.Summary.Render(Decode<TSummary>(frame["data"]), context);
                    }
                    else if (kind == "end") data = "";
                    else if (renderer.Error is not null) data = await renderer.Error.Render(Decode<Generated.StreamErrorFrame>(frame), context);
                }
                message = await SseWire.Encode(new(data, kind), maxFrameBytes, cancellation);
            }
            catch (OperationCanceledException) when (cancellation.IsCancellationRequested) { throw; }
            catch (Exception)
            {
                var error = Contracts.Parse("StreamErrorFrameSchema", new { kind = "error", error = "render_failed", message = "Stream rendering failed" });
                message = await SseWire.Encode(new(Json.Write(error), "error"), maxFrameBytes, cancellation); failed = true;
            }
            yield return message;
            if (failed) yield break;
        }
    }
}
