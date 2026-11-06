namespace BetterPortal.Generated;

/// <summary>Portable destinations with context-specific string conversion and immutable renderer selection.</summary>
public sealed partial record ResolvedRoute
{
    private System.Func<RouteOptionsInput, ResolvedRoute?>? resolve;
    private RouteOptionsInput options = new();
    private bool view;
    internal ResolvedRoute Bind(System.Func<RouteOptionsInput, ResolvedRoute?> resolver, RouteOptionsInput? input, bool viewContext)
    {
        var result = this with { };
        result.resolve = resolver; result.options = input ?? new(); result.view = viewContext;
        return result;
    }
    public override string ToString() => view ? ViewPath : ApiPath;
    public ResolvedRoute? Component(string id) => string.IsNullOrWhiteSpace(id) ? null : resolve?.Invoke(options with { Component = id, Fragment = default });
    public ResolvedRoute? Fragment(string id) => string.IsNullOrWhiteSpace(id) ? null : resolve?.Invoke(options with { Fragment = id, Component = default });
}
