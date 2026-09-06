using BetterPortal;
using BetterPortal.Generated;
using Route = BetterPortal.Route;
using Node = System.Collections.Generic.Dictionary<string, object?>;

internal static class AccessAdapter
{
    internal static object Run(Node body)
    {
        var config = new ScopedConfig(body["snapshot"]!);
        var scope = config.ById((string)body["tenantId"]!, (string)body["appId"]!);
        if (scope is null) return new { allowed = false, aliases = new Dictionary<string, string>() };
        var route = new Route("check", (string)body.GetValueOrDefault("path", "/check/:key")!, new[] { HttpMethodInput.GET, HttpMethodInput.POST }.Select(method =>
            new Operation(new Handler<object?, object?, object?, object?, object?>(Contracts.Get("JsonObjectSchema"), _ => ValueTask.FromResult<object?>(new Node())),
                new OperationDeclarationInput { OperationId = "check." + method.ToString().ToLowerInvariant(), Method = method, Title = "Check", Description = "Check", Auth = new() })));
        var access = new AppAccess(scope, config.LocalServiceIds);
        return new { allowed = access.Allows(route, (string)body.GetValueOrDefault("method", "GET")!, fragment: (string?)body.GetValueOrDefault("fragment")), aliases = access.PermissionAliases() };
    }
}
