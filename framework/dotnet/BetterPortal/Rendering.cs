using System.Text.RegularExpressions;
using Node = System.Collections.Generic.Dictionary<string, object?>;

namespace BetterPortal;

public sealed record RenderContext(Generated.ViewRenderData Data, CancellationToken Cancellation = default)
{
    public Generated.ViewTenantContext Tenant => Data.Tenant;
    public Generated.ViewAppContext App => Data.App;
    public Generated.ViewRenderDataRequest Request => Data.Request;
    public Generated.ViewRenderDataRoute Route => Data.Route;
    public static RenderContext Create(RequestContext request, string viewId, string matchedPath, string renderer, string mode, string kind,
        string? key, int status, object? @params, object? query, CancellationToken cancellation = default)
    {
        var route = new Node { ["viewId"] = viewId, ["path"] = matchedPath, ["renderer"] = renderer, ["mode"] = mode, ["kind"] = kind, ["status"] = status };
        if (key is not null) route["key"] = key;
        return new(Contracts.Parse<Generated.ViewRenderData>("ViewRenderDataSchema", new Node { ["tenant"] = request.Scope.Tenant, ["app"] = request.Scope.App,
            ["request"] = new Node { ["method"] = request.Method, ["path"] = request.Path, ["params"] = @params, ["query"] = query }, ["route"] = route }), cancellation);
    }
}

public abstract class Renderer
{
    public Generated.RendererDeclaration Declaration { get; }
    public (string Renderer, string Kind, string? Key, int Status) Identity { get; }
    protected Renderer(Generated.RendererDeclarationInput declaration)
    {
        Declaration = Contracts.Parse<Generated.RendererDeclaration>("RendererDeclarationSchema", declaration);
        var kind = Declaration.Kind.ToString().ToLowerInvariant();
        var key = Declaration.Key.HasValue ? Declaration.Key.Value : null;
        if (kind == "page" && key is not null || kind != "page" && key is null) throw new ArgumentException("Only fragment/component renderers require a key");
        if (key is not null && !Regex.IsMatch(key, kind == "fragment" ? @"\A[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\z" : @"\A[A-Za-z0-9_-]+\z"))
            throw new ArgumentException("Invalid renderer key");
        Identity = (Declaration.Renderer, kind, key, (int)Declaration.Status);
    }
    internal abstract ValueTask<string> RenderBoxed(object? data, RenderContext context);
    public ValueTask<string> RenderUntyped(object? data, RenderContext context) => RenderBoxed(data, context);
    internal static IReadOnlyList<T> Unique<T>(IEnumerable<T> values) where T : Renderer
    {
        var result = values.ToArray();
        if (result.Select(item => item.Identity).Distinct().Count() != result.Length) throw new ArgumentException("Duplicate renderer");
        return Array.AsReadOnly(result);
    }
    public static T Select<T>(IEnumerable<T> values, string? renderer, string kind, string? key = null, int status = 200) where T : Renderer =>
        values.FirstOrDefault(item => item.Identity == (renderer, kind, key, status)) ?? throw new NotAcceptableException("Requested renderer is not available");
    public static string ContentType(string mode, object? chrome = null)
    {
        var result = "text/html; mode=" + Contracts.Parse("RenderModeSchema", mode);
        foreach (var (name, value) in (Node)Contracts.Parse("BetterPortalRouteChromeSchema", chrome ?? new Node())!)
        {
            var key = Regex.Replace(Regex.Replace(name, "([a-z0-9])([A-Z])", "$1-$2"), @"[_\s]+", "-").ToLowerInvariant();
            if (!Regex.IsMatch(key, @"\A[a-z][a-z0-9-]*\z")) continue;
            var encoded = value is string text ? Uri.EscapeDataString(text).Replace("%21", "!").Replace("%27", "'").Replace("%28", "(").Replace("%29", ")").Replace("%2A", "*")
                : Convert.ToString(value, System.Globalization.CultureInfo.InvariantCulture)!.ToLowerInvariant();
            result += "; bp-chrome-" + key + "=" + encoded;
        }
        return result + "; charset=utf-8";
    }
    internal static Node HtmlMetadata(IEnumerable<Renderer> values)
    {
        var result = new Node();
        foreach (var group in values.Where(item => item.Identity.Status == 200).GroupBy(item => item.Identity.Renderer))
        {
            var modes = new List<string>(); var variants = new List<Node>();
            foreach (var entry in group)
            {
                if (entry.Identity.Kind == "page")
                {
                    modes.Add("page");
                    variants.Add(new() { ["id"] = "default", ["title"] = "Default Content", ["slotId"] = "main", ["renderModes"] = new[] { "page", "fragment" } });
                }
                else if (entry.Identity.Kind == "fragment")
                {
                    modes.Add("fragment");
                    variants.Add(new() { ["id"] = entry.Identity.Key, ["title"] = entry.Identity.Key, ["slotId"] = entry.Identity.Key, ["renderModes"] = new[] { "fragment" } });
                }
            }
            result[group.Key] = new Node { ["defaultRenderer"] = "default", ["renderModes"] = modes.Distinct().ToArray(),
                ["slots"] = variants.Select(item => item["slotId"]).Distinct().ToArray(), ["renderers"] = variants };
        }
        return (Node)Contracts.Parse("HtmlRepresentationSupportSchema", new Node { ["renderers"] = result })!;
    }
}

public sealed class Renderer<TResult> : Renderer
{
    private readonly Func<TResult, RenderContext, ValueTask<string>> render;
    public Renderer(Generated.RendererDeclarationInput declaration, Func<TResult, RenderContext, ValueTask<string>> render) : base(declaration)
    { ArgumentNullException.ThrowIfNull(render); this.render = render; }
    public Renderer(Generated.RendererDeclarationInput declaration, Func<TResult, RenderContext, string> render) : this(declaration, (data, context) => ValueTask.FromResult(render(data, context)))
    { ArgumentNullException.ThrowIfNull(render); }
    public async ValueTask<string> Render(TResult data, RenderContext context)
    {
        context.Cancellation.ThrowIfCancellationRequested();
        return await render(data, context).AsTask().WaitAsync(context.Cancellation) ?? throw new InvalidOperationException("Renderers must return HTML strings");
    }
    internal override ValueTask<string> RenderBoxed(object? data, RenderContext context) => Render((TResult)data!, context);
}
