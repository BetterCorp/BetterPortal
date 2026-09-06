using BetterPortal;
using Node = System.Collections.Generic.Dictionary<string, object?>;

internal static class AuthorizationAdapter
{
    internal static async Task<object> Run(Node body)
    {
        var context = (Node)body["context"]!;
        var key = (Node?)body.GetValueOrDefault("userKey");
        Task<string> Resolve(string kid, CancellationToken _) => key is not null && Equals(key["kid"], kid)
            ? Task.FromResult((string)key["publicKeyPem"]!) : throw new TokenException("Unknown key");
        var management = (Node?)context.GetValueOrDefault("managementScope");
        var trusted = new AuthContext((string)context["tenantId"]!, (string)context["appId"]!, (Node?)context.GetValueOrDefault("appAuth"),
            key is null ? null : Resolve, (Node?)context.GetValueOrDefault("servicePolicy"),
            ((Node?)context.GetValueOrDefault("serviceAliases"))?.ToDictionary(pair => pair.Key, pair => (string)pair.Value!),
            management is null ? null : ((string)management["tenantId"]!, (string)management["appId"]!));
        try
        {
            var caller = await RequestAuthorization.AuthorizeAsync(((Node)body["headers"]!).ToDictionary(pair => pair.Key, pair => (string)pair.Value!),
                (Node)body["requirement"]!, trusted, (string)body["viewId"]!, (string)body["method"]!);
            return new { status = 200, output = new { mode = caller.Mode, user = caller.User?.GetValueOrDefault("sub"), service = caller.Service?.GetValueOrDefault("iss") } };
        }
        catch (TokenException error) { return new { status = error.Status }; }
    }
}
