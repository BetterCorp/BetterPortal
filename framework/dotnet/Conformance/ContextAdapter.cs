using BetterPortal;

internal static class ContextAdapter
{
    public static object Run(Dictionary<string, object?> body)
    {
        try
        {
            if (body["action"] is "http-origin") return new { status = 200, output = HttpAddress.Origin((string)body["value"]!) };
            var config = new ScopedConfig(body["snapshot"]!);
            if (body.GetValueOrDefault("mutate") is true)
            {
                var original = (Dictionary<string, object?>)body["snapshot"]!;
                var tenant = (Dictionary<string, object?>)((List<object?>)original["tenants"]!)[0]!;
                var app = (Dictionary<string, object?>)((List<object?>)original["apps"]!)[0]!;
                tenant["active"] = false;
                ((Dictionary<string, object?>)((List<object?>)config.Document()["tenants"]!)[0]!)["active"] = false;
                config.ById((string)tenant["id"]!, (string)app["id"]!)!.Tenant["active"] = false;
            }
            var headers = ((Dictionary<string, object?>?)body.GetValueOrDefault("headers") ?? []).ToDictionary(pair => pair.Key, pair => (string)pair.Value!);
            var context = body.GetValueOrDefault("byId") is List<object?> ids ? config.ById((string)ids[0]!, (string)ids[1]!)
                : config.Resolve(headers, (string)body.GetValueOrDefault("scheme", "https")!, (string)body.GetValueOrDefault("mode", "service")!,
                    ((List<object?>?)body.GetValueOrDefault("trustedAddresses") ?? []).Cast<string>());
            Dictionary<string, object?>? output = context is null ? null : new()
            { ["tenantId"] = context.TenantId, ["appId"] = context.AppId, ["renderer"] = (context.App.GetValueOrDefault("shell") as Dictionary<string, object?>)?.GetValueOrDefault("renderer") };
            if (output is not null && body.TryGetValue("check", out var check)) output["allowed"] = context!.OriginPolicy.Allows(check as string, body.GetValueOrDefault("referer") is true);
            return new { status = 200, output };
        }
        catch (Exception) { return new { status = 400 }; }
    }
}
