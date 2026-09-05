using BetterPortal;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using System.Security.Cryptography;

// Test-only actions; the real host must never expose signing endpoints.
internal static class SecurityAdapter
{
    private static readonly KeyPair Key = KeyPair.Generate();
    internal static async Task<object> Run(Dictionary<string, object?> body)
    {
        string Text(string name) => (string)body[name]!;
        var action = Text("action");
        if (action.StartsWith("keys-", StringComparison.Ordinal)) return await KeyAdapter.Run(body);
        if (action == "jwt-key") return new { publicKeyPem = Key.PublicKeyPem, kid = Key.Kid, jwk = Key.PublicJwk() };
        if (action == "jwt-pair") return new TokenIssuer(Key, Text("issuer"), Text("audience"))
            .IssuePair((Dictionary<string, object?>)body["user"]!);
        var purpose = Enum.GetValues<TokenPurpose>().Single(p => Tokens.PurposeName(p) == Text("purpose"));
        if (action == "jwt-sign") return new { token = Tokens.Sign(Key, (Dictionary<string, object?>)body["claims"]!, purpose) };
        if (action == "jwt-raw")
        {
            using var rsa = RSA.Create();
            rsa.ImportFromPem(Key.PrivateKeyPem);
            var key = new RsaSecurityKey(rsa) { KeyId = Key.Kid, CryptoProviderFactory = new() { CacheSignatureProviders = false } };
            var header = new Dictionary<string, object> { ["typ"] = purpose == TokenPurpose.Service ? "BP-S2S-JWT" : "JWT" };
            if (body.GetValueOrDefault("header") is Dictionary<string, object?> supplied)
                foreach (var item in supplied)
                    if (item.Key == "kid") key.KeyId = (string)item.Value!;
                    else header[item.Key] = item.Value!;
            return new { token = new JsonWebTokenHandler { SetDefaultTimesOnTokenCreation = false }
                .CreateToken(Json.Write(body["claims"]), new SigningCredentials(key, SecurityAlgorithms.RsaSha256), header) };
        }
        if (action == "jwt-verify")
        {
            Task<string> Resolve(string kid, CancellationToken _) => kid == Text("kid") ? Task.FromResult(Text("publicKeyPem"))
                : throw new TokenException("Unknown signing key");
            try
            {
                Dictionary<string, object?> output;
                if (purpose == TokenPurpose.ConfigTicket)
                {
                    var scope = (Dictionary<string, object?>)body["scope"]!;
                    output = await Tokens.VerifyConfigTicketAsync(Text("token"), Resolve, Text("issuer"),
                        (string)scope["serviceId"]!, (string)scope["tenantId"]!, (string)scope["action"]!);
                }
                else if (purpose == TokenPurpose.Service)
                {
                    var service = (Dictionary<string, object?>)body["service"]!;
                    var policy = (Dictionary<string, object?>)service["policy"]!;
                    foreach (var peer in ((IEnumerable<object?>)policy["services"]!).Cast<Dictionary<string, object?>>())
                    {
                        peer["keyId"] = Text("kid");
                        peer["publicKeyPem"] = Text("publicKeyPem");
                    }
                    output = (await Authorization.AuthorizeServiceAsync(Text("token"), policy, Text("issuer"),
                        (string)service["tenantId"]!, (string)service["appId"]!, (string)service["viewId"]!,
                        (string)service["method"]!, (string)service["mode"]!,
                        ((IEnumerable<object?>)service["requiredPermissions"]!).Cast<string>().ToArray())).Claims;
                }
                else output = await Tokens.VerifyAsync(Text("token"), Resolve, Text("issuer"), body.GetValueOrDefault("audience") as string, purpose);
                return new { valid = true, output };
            }
            catch (TokenException) { return new { valid = false }; }
        }
        throw new ArgumentException("Unknown security action");
    }
}
