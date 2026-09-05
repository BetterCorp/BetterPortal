using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Text.Json.Serialization;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace BetterPortal;

public sealed class TokenException(string message, int status = 401) : Exception(message)
{
    public int Status { get; } = status;
}

public enum TokenPurpose { Access, Refresh, Service, ConfigTicket, CpEnvelope, Setup }

/// <summary>RSA signing material. Private material is never included in diagnostic formatting.</summary>
public sealed class KeyPair
{
    [JsonIgnore]
    public string PrivateKeyPem { get; }
    public string Kid { get; }
    public string PublicKeyPem { get; }

    public KeyPair(string privateKeyPem, string kid)
    {
        if (!Tokens.ValidKid(kid)) throw new ArgumentException("Invalid signing key ID");
        using var rsa = RSA.Create();
        rsa.ImportFromPem(privateKeyPem);
        if (rsa.KeySize < 2048) throw new ArgumentException("BP requires RSA of at least 2048 bits");
        // Exporting the private parameters also rejects a public-only PEM.
        PrivateKeyPem = rsa.ExportPkcs8PrivateKeyPem();
        PublicKeyPem = rsa.ExportSubjectPublicKeyInfoPem();
        Kid = kid;
    }

    public static KeyPair Generate(string? kid = null, int keySize = 2048)
    {
        if (keySize is not (2048 or 3072 or 4096)) throw new ArgumentException("RSA key size must be 2048, 3072 or 4096");
        using var rsa = RSA.Create(keySize);
        return new(rsa.ExportPkcs8PrivateKeyPem(), kid ?? Base64UrlEncoder.Encode(rsa.ExportParameters(false).Modulus!)[..16]);
    }

    public Dictionary<string, object?> PublicJwk()
    {
        using var rsa = RSA.Create();
        rsa.ImportFromPem(PublicKeyPem);
        var parameters = rsa.ExportParameters(false);
        return (Dictionary<string, object?>)Contracts.Parse("RsaPublicJwkSchema", new Dictionary<string, object?>
        {
            ["kty"] = "RSA", ["alg"] = "RS256", ["use"] = "sig", ["kid"] = Kid,
            ["n"] = Base64UrlEncoder.Encode(parameters.Modulus!), ["e"] = Base64UrlEncoder.Encode(parameters.Exponent!)
        })!;
    }
}

/// <summary>BP token purposes and trust policy; IdentityModel performs signature and JWT verification.</summary>
public static class Tokens
{
    public const string ConfigTicketAudience = "betterportal-service-config";
    private static readonly Regex KidPattern = new(@"\A[A-Za-z0-9_-]{1,256}\z", RegexOptions.CultureInvariant);
    private static readonly Regex PartPattern = new(@"\A[A-Za-z0-9_-]+\z", RegexOptions.CultureInvariant);
    internal static bool ValidKid(string kid) => KidPattern.IsMatch(kid);
    private static string HeaderType(TokenPurpose purpose) => purpose == TokenPurpose.Service ? "BP-S2S-JWT" : "JWT";
    public static string PurposeName(TokenPurpose purpose) => purpose switch
    {
        TokenPurpose.Access => "access", TokenPurpose.Refresh => "refresh", TokenPurpose.Service => "service",
        TokenPurpose.ConfigTicket => "config-ticket", TokenPurpose.CpEnvelope => "cp-envelope", TokenPurpose.Setup => "setup",
        _ => throw new ArgumentOutOfRangeException(nameof(purpose))
    };

    private static Dictionary<string, object?> PurposeClaims(IDictionary<string, object?> claims, TokenPurpose purpose)
    {
        var contract = purpose switch
        {
            TokenPurpose.Access or TokenPurpose.Refresh => "JwtClaimsSchema",
            TokenPurpose.Service => "ServiceTokenClaimsSchema", TokenPurpose.ConfigTicket => "ServiceConfigTicketClaimsSchema",
            TokenPurpose.CpEnvelope => "CpEnvelopeClaimsSchema", TokenPurpose.Setup => "SetupTokenClaimsSchema",
            _ => throw new ArgumentOutOfRangeException(nameof(purpose))
        };
        var parsed = (Dictionary<string, object?>)Contracts.Parse(contract, new Dictionary<string, object?>(claims))!;
        if (purpose != TokenPurpose.ConfigTicket && (string?)parsed.GetValueOrDefault("tokenType") != PurposeName(purpose))
            throw new TokenException("Token purpose mismatch");
        var lifetime = Convert.ToInt64(parsed["exp"]) - Convert.ToInt64(parsed["iat"]);
        if (lifetime <= 0) throw new TokenException("Token expiration must follow issuance");
        if (purpose == TokenPurpose.Service && (lifetime > 60 || !Equals(parsed["sub"], parsed["iss"])))
            throw new TokenException("Invalid service token lifetime or subject");
        return parsed;
    }

    private static RsaSecurityKey SecurityKey(RSA rsa, string kid) => new(rsa)
    {
        KeyId = kid,
        // Each call owns and disposes its RSA handle; a cached provider must not retain it.
        CryptoProviderFactory = new CryptoProviderFactory { CacheSignatureProviders = false }
    };

    public static string Sign(KeyPair key, IDictionary<string, object?> claims, TokenPurpose purpose)
    {
        var parsed = PurposeClaims(claims, purpose);
        using var rsa = RSA.Create();
        rsa.ImportFromPem(key.PrivateKeyPem);
        return new JsonWebTokenHandler { SetDefaultTimesOnTokenCreation = false }.CreateToken(new SecurityTokenDescriptor
        {
            Claims = parsed.ToDictionary(p => p.Key, p => p.Value!), TokenType = HeaderType(purpose),
            SigningCredentials = new SigningCredentials(SecurityKey(rsa, key.Kid), SecurityAlgorithms.RsaSha256)
        });
    }

    private static Dictionary<string, object?> ReadPart(string part)
    {
        if (!PartPattern.IsMatch(part)) throw new TokenException("Invalid JWT encoding");
        var bytes = Base64UrlEncoder.DecodeBytes(part);
        if (Base64UrlEncoder.Encode(bytes) != part) throw new TokenException("Invalid JWT encoding");
        return Json.Read(new UTF8Encoding(false, true).GetString(bytes)) as Dictionary<string, object?>
            ?? throw new TokenException("JWT part must be an object");
    }

    internal static Dictionary<string, object?> UnverifiedClaims(string token)
    {
        if (string.IsNullOrEmpty(token) || token.Length > 32768) throw new TokenException("Invalid token size");
        try
        {
            var parts = token.Split('.');
            if (parts.Length != 3) throw new TokenException("Invalid JWT encoding");
            return ReadPart(parts[1]);
        }
        catch (Exception) { throw new TokenException("Invalid service envelope"); }
    }

    public static async Task<Dictionary<string, object?>> VerifyAsync(string token,
        Func<string, CancellationToken, Task<string>> resolver, string issuer, string? audience,
        TokenPurpose purpose, int clockTolerance = 0, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(issuer) || (purpose != TokenPurpose.Setup && string.IsNullOrEmpty(audience)) || clockTolerance < 0)
            throw new ArgumentException("Issuer, audience and nonnegative clock tolerance are required");
        if (string.IsNullOrEmpty(token) || token.Length > 32768) throw new TokenException("Invalid token size");
        try
        {
            var parts = token.Split('.');
            if (parts.Length != 3 || !PartPattern.IsMatch(parts[2])) throw new TokenException("Invalid JWT encoding");
            var header = ReadPart(parts[0]);
            var claims = ReadPart(parts[1]); // Also rejects duplicate JSON members, before library parsing.
            if (!Equals(header.GetValueOrDefault("alg"), "RS256") || !Equals(header.GetValueOrDefault("typ"), HeaderType(purpose)))
                throw new TokenException("Invalid token algorithm or header type");
            if (new[] { "jku", "x5u", "jwk", "crit", "b64" }.Any(header.ContainsKey))
                throw new TokenException("Unsupported token header");
            if (header.GetValueOrDefault("kid") is not string kid || !ValidKid(kid)) throw new TokenException("Invalid token key ID");
            var pem = await resolver(kid, cancellationToken);
            cancellationToken.ThrowIfCancellationRequested();
            using var rsa = RSA.Create();
            rsa.ImportFromPem(pem);
            if (rsa.KeySize < 2048) throw new TokenException("Untrusted signing key size");
            var result = await new JsonWebTokenHandler { MaximumTokenSizeInBytes = 32768, MapInboundClaims = false }
                .ValidateTokenAsync(token, new TokenValidationParameters
                {
                    RequireSignedTokens = true, ValidateIssuerSigningKey = true, IssuerSigningKey = SecurityKey(rsa, kid),
                    ValidAlgorithms = [SecurityAlgorithms.RsaSha256], ValidTypes = [HeaderType(purpose)],
                    ValidateIssuer = true, ValidIssuer = issuer, ValidateAudience = audience is not null,
                    RequireAudience = purpose != TokenPurpose.Setup, ValidAudience = audience,
                    IgnoreTrailingSlashWhenValidatingAudience = false,
                    RequireExpirationTime = true, ValidateLifetime = true, ClockSkew = TimeSpan.FromSeconds(clockTolerance),
                    IncludeTokenOnFailedValidation = false, LogTokenId = false
                });
            if (!result.IsValid) throw new TokenException("Token verification failed");
            var parsed = PurposeClaims(claims, purpose);
            var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            if (Convert.ToInt64(parsed["exp"]) <= now - clockTolerance || Convert.ToInt64(parsed["iat"]) > now + clockTolerance)
                throw new TokenException("Token time is invalid");
            return parsed;
        }
        catch (OperationCanceledException) { throw; }
        catch (TokenException) { throw; }
        catch (Exception) { throw new TokenException("Token verification failed"); }
    }

    public static async Task<Dictionary<string, object?>> VerifyConfigTicketAsync(string token,
        Func<string, CancellationToken, Task<string>> resolver, string issuer, string serviceId, string tenantId,
        string action, CancellationToken cancellationToken = default)
    {
        var claims = await VerifyAsync(token, resolver, issuer, ConfigTicketAudience, TokenPurpose.ConfigTicket, cancellationToken: cancellationToken);
        if (!Equals(claims["serviceId"], serviceId) || !Equals(claims["tenantId"], tenantId)
            || !((IEnumerable<object?>)claims["actions"]!).Contains(action))
            throw new TokenException("Config ticket scope or action mismatch");
        return claims;
    }
}

public sealed class TokenIssuer(KeyPair key, string issuer, string audience, int accessSeconds = 900, int refreshSeconds = 604800)
{
    public Dictionary<string, object?> IssuePair(IDictionary<string, object?> user, bool includeRefresh = true)
    {
        if (accessSeconds < 1 || refreshSeconds < 1) throw new ArgumentException("Token lifetimes must be positive");
        if (includeRefresh && (!user.TryGetValue("authProvider", out var provider) || provider is not string { Length: > 0 }
            || !user.TryGetValue("refreshContext", out var context) || context is not IDictionary<string, object?>))
            throw new ArgumentException("Refresh tokens require authProvider and refreshContext");
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var identifier = Guid.CreateVersion7().ToString();
        var common = new Dictionary<string, object?>(user)
        {
            ["iss"] = issuer, ["aud"] = audience, ["realm"] = "runtime", ["iat"] = now, ["jti"] = identifier
        };
        var access = new Dictionary<string, object?>(common) { ["tokenType"] = "access", ["exp"] = now + accessSeconds };
        access.Remove("refreshContext");
        var result = new Dictionary<string, object?>
        {
            ["tokenId"] = identifier, ["accessToken"] = Tokens.Sign(key, access, TokenPurpose.Access),
            ["accessTokenExpiresInSeconds"] = accessSeconds
        };
        if (includeRefresh)
        {
            var refresh = new Dictionary<string, object?>(common)
            {
                ["roles"] = new List<object?>(), ["tokenType"] = "refresh", ["exp"] = now + refreshSeconds
            };
            result["refreshToken"] = Tokens.Sign(key, refresh, TokenPurpose.Refresh);
            result["refreshTokenExpiresInSeconds"] = refreshSeconds;
        }
        return result;
    }

    public async Task<Dictionary<string, object?>> VerifyRefreshAsync(string token, string tenantId, string appId,
        CancellationToken cancellationToken = default)
    {
        var claims = await Tokens.VerifyAsync(token, (kid, _) => kid == key.Kid ? Task.FromResult(key.PublicKeyPem)
            : throw new TokenException("Unknown signing key"), issuer, audience, TokenPurpose.Refresh, cancellationToken: cancellationToken);
        if (!Equals(claims["tenantId"], tenantId) || !Equals(claims["appId"], appId)) throw new TokenException("Refresh token tenant or app mismatch");
        return claims;
    }
}
