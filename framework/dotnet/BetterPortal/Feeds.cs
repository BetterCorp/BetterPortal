using AnyVali;
using Node = System.Collections.Generic.Dictionary<string, object?>;

namespace BetterPortal;

/// <summary>A subscriber transport of an existing GET operation, with typed input/event contracts.</summary>
public abstract class SseFeed
{
    public Handler Owner { get; }
    public string ViewId { get; }
    public Schema InputSchema { get; }
    public Schema EventSchema { get; }
    public IReadOnlyList<Renderer> Renderers { get; }
    protected SseFeed(Handler owner, string viewId, Schema input, Schema @event, IEnumerable<Renderer> renderers)
    {
        Owner = owner; ViewId = viewId; InputSchema = input; EventSchema = @event;
        Renderers = Renderer.Unique(renderers);
        foreach (var renderer in Renderers)
        {
            if (renderer.Identity.Kind != "fragment" || renderer.Identity.Status != 200)
                throw new ArgumentException("SSE event renderers require a success fragment");
            if (!owner.Renderers.Any(value => value.Identity == renderer.Identity))
                throw new ArgumentException("An SSE event renderer requires its owning GET fragment");
        }
    }
    public abstract RawResponse OpenStream(RequestContext context, IReadOnlyDictionary<string, object?> values, string? fragment,
        Func<string, object?, object?, RenderContext> renderContext, CancellationToken cancellation = default);
}

public sealed class SseFeed<TInput, TEvent> : SseFeed
{
    private readonly Func<EventScope, TInput, CancellationToken, ValueTask<TInput>> publish;
    private readonly Func<RequestContext, IReadOnlyDictionary<string, object?>, string?, Func<string, object?, object?, RenderContext>, CancellationToken, RawResponse> open;
    private SseFeed(Handler owner, string viewId, Schema input, Schema @event, IEnumerable<Renderer> renderers,
        Func<EventScope, TInput, CancellationToken, ValueTask<TInput>> publish,
        Func<RequestContext, IReadOnlyDictionary<string, object?>, string?, Func<string, object?, object?, RenderContext>, CancellationToken, RawResponse> open)
        : base(owner, viewId, input, @event, renderers) { this.publish = publish; this.open = open; }

    public static SseFeed<TInput, TEvent> Bind<TParams, TQuery, THeaders, TBody>(Handler<TParams, TQuery, THeaders, TBody> owner,
        SseRoute<TInput, TEvent, HandlerContext<TParams, TQuery, THeaders, TBody>> route, IEnumerable<Renderer<TEvent>>? renderers = null)
    {
        var entries = (renderers ?? []).ToArray();
        return new(owner, route.ViewId, route.InputSchema, route.EventSchema, entries, route.Publish, (context, values, fragment, renderContext, cancellation) =>
        {
            var prepared = owner.Prepare(context, values, cancellation);
            Func<TEvent, CancellationToken, ValueTask<string>>? render = null;
            if (fragment is not null)
            {
                var theme = (context.Scope.App.GetValueOrDefault("shell") as Node)?.GetValueOrDefault("renderer") as string;
                var renderer = Renderer.Select(entries, theme, "fragment", fragment);
                var presentation = renderContext(renderer.Identity.Renderer, prepared.Params, prepared.Query);
                render = (value, signal) => renderer.Render(value, presentation);
            }
            return new RawResponse(route.Wire(new(context.Scope.TenantId, context.Scope.AppId), prepared, render, cancellation: cancellation),
                headers: new Dictionary<string, string> { ["content-type"] = "text/event-stream; charset=utf-8", ["cache-control"] = "no-store" });
        });
    }
    public override RawResponse OpenStream(RequestContext context, IReadOnlyDictionary<string, object?> values, string? fragment,
        Func<string, object?, object?, RenderContext> renderContext, CancellationToken cancellation = default) => open(context, values, fragment, renderContext, cancellation);
    public ValueTask<TInput> Publish(EventScope scope, TInput value, CancellationToken cancellation = default) => publish(scope, value, cancellation);
}
