using Node = System.Collections.Generic.Dictionary<string, object?>;
namespace BetterPortal;

public sealed class ElevationRequiredException : TokenException
{
    public IReadOnlyDictionary<string, string> Headers { get; }
    public ElevationRequiredException(Node requirement, Node claims) : base("insufficient_user_authentication")
    {
        var challenge = new Node(requirement) { ["version"] = 1, ["tenantId"] = claims["tenantId"], ["appId"] = claims["appId"] };
        var acr = Equals(requirement["minimum"], "mfa") ? "mfa" : "confirmed";
        var authenticate = $"Bearer error=\"insufficient_user_authentication\", acr_values=\"urn:betterportal:{acr}\"";
        if (requirement.TryGetValue("maxAgeSeconds", out var age)) authenticate += $", max_age=\"{age}\"";
        Headers = new Dictionary<string, string> { ["WWW-Authenticate"] = authenticate, ["BP-Auth-Challenge"] = Json.Write(challenge), ["Cache-Control"] = "no-store" };
    }
}
public static class Elevation
{
    /// <summary>Apply to verified app-bound claims after permissions, before side effects.</summary>
    public static void Require(Node? claims, Node requirement, long? now = null)
    {
        var policy = (Node)Contracts.Parse("ElevationRequirementSchema", requirement)!;
        if (claims is null) throw new TokenException("Human authentication required");
        var current = now ?? DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        if (claims.GetValueOrDefault("elevation") is Node e && Equals(claims.GetValueOrDefault("tokenType"), "access")) {
            var verifiedAt = Convert.ToInt64(e.GetValueOrDefault("verifiedAt", -1));
            var expiresAt = Convert.ToInt64(e.GetValueOrDefault("expiresAt", 0));
            var expires = Convert.ToInt64(claims["exp"]);
            if (e.GetValueOrDefault("assurance") is "confirmed" or "mfa" && verifiedAt >= 0 && verifiedAt <= current && current < expiresAt && expiresAt <= expires
                && (!Equals(policy["minimum"], "mfa") || Equals(e["assurance"], "mfa"))
                && (!policy.TryGetValue("maxAgeSeconds", out var age) || current - verifiedAt <= Convert.ToInt64(age))) return;
        }
        throw new ElevationRequiredException(policy, claims);
    }
}
