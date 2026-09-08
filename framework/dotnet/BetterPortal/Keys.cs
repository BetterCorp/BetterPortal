using System.Diagnostics;
using System.Security.Cryptography;
using Microsoft.IdentityModel.Tokens;

namespace BetterPortal;

public static class TrustedKeys
{
    public static Uri SecureEndpoint(string value, bool allowQuery = false)
    {
        if (value.Any(char.IsWhiteSpace) || value.Any(char.IsControl) || value.Contains('\\') || (!allowQuery && value.Contains('?')) || value.Contains('#')
            || !Uri.TryCreate(value, UriKind.Absolute, out var uri) || uri.UserInfo.Length != 0 || uri.Port == 0 || uri.Host.Length == 0)
            throw new ArgumentException("Invalid trusted endpoint");
        // Inspect the original authority so Uri normalization cannot admit 127.1 or integer/hex IPv4 aliases.
        var authority = value.Split("://", 2)[^1].Split(['/', '?'])[0];
        if (authority.Contains('@')) throw new ArgumentException("Endpoint userinfo is forbidden");
        var host = authority.StartsWith('[') ? authority[..(authority.IndexOf(']') + 1)] : authority.Split(':')[0];
        var loopback = host.Equals("localhost", StringComparison.OrdinalIgnoreCase) || host is "127.0.0.1" or "[::1]";
        if (uri.Scheme != "https" && !(uri.Scheme == "http" && loopback))
            throw new ArgumentException("Endpoint requires HTTPS (HTTP only on exact loopback)");
        return uri;
    }

    public static IReadOnlyDictionary<string, string> PublicKeys(IDictionary<string, object?> document)
    {
        var parsed = (Dictionary<string, object?>)Contracts.Parse("PublicJwksSchema", new Dictionary<string, object?>(document))!;
        var keys = ((IEnumerable<object?>)parsed["keys"]!).Cast<Dictionary<string, object?>>().ToArray();
        if (keys.Length is < 1 or > 128) throw new TokenException("JWKS must contain 1 to 128 keys");
        var result = new Dictionary<string, string>();
        foreach (var jwk in keys)
        {
            var kid = (string)jwk["kid"]!;
            if (!Tokens.ValidKid(kid) || result.ContainsKey(kid)) throw new TokenException("Invalid or duplicate JWKS key ID");
            using var rsa = RSA.Create();
            rsa.ImportParameters(new RSAParameters
            {
                Modulus = Base64UrlEncoder.DecodeBytes((string)jwk["n"]!), Exponent = Base64UrlEncoder.DecodeBytes((string)jwk["e"]!)
            });
            if (rsa.KeySize < 2048) throw new TokenException("JWKS RSA key is too small");
            result.Add(kid, rsa.ExportSubjectPublicKeyInfoPem());
        }
        return result;
    }
}

/// <summary>One issuer/endpoint cache. Its URI must come from trusted configuration, never JWT headers.</summary>
public sealed class JwksClient : IAsyncDisposable
{
    public string Issuer { get; }
    public Uri Uri { get; }
    private readonly HttpClient _client;
    private readonly CancellationTokenSource _shutdown = new();
    private readonly object _gate = new();
    private readonly HashSet<Task<IReadOnlyDictionary<string, string>>> _tasks = [];
    private IReadOnlyDictionary<string, string> _keys = new Dictionary<string, string>();
    private Task<IReadOnlyDictionary<string, string>>? _refresh;
    private long _generation;
    private double _expires, _nextAttempt;
    private bool _closed;
    private static double Now => (double)Stopwatch.GetTimestamp() / Stopwatch.Frequency;

    public JwksClient(string issuer, string uri)
    {
        if (string.IsNullOrEmpty(issuer)) throw new ArgumentException("Issuer is required");
        Issuer = issuer;
        Uri = TrustedKeys.SecureEndpoint(uri, allowQuery: true);
        _client = new(new SocketsHttpHandler { AllowAutoRedirect = false, UseProxy = false, UseCookies = false });
    }

    public void Invalidate()
    {
        lock (_gate)
        {
            _generation++;
            _keys = new Dictionary<string, string>();
            _expires = _nextAttempt = 0;
            _refresh = null;
        }
    }

    private async Task<IReadOnlyDictionary<string, string>> LoadAsync(long generation)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(_shutdown.Token);
        timeout.CancelAfter(TimeSpan.FromSeconds(5));
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, Uri);
            request.Headers.Accept.ParseAdd("application/jwk-set+json, application/json");
            using var response = await _client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, timeout.Token);
            if ((int)response.StatusCode != 200 || response.Content.Headers.ContentType?.MediaType?.ToLowerInvariant() is not ("application/json" or "application/jwk-set+json"))
                throw new TokenException("JWKS endpoint returned an invalid status or content type");
            await using var stream = await response.Content.ReadAsStreamAsync(timeout.Token);
            using var content = new MemoryStream();
            var buffer = new byte[8192];
            int count;
            while ((count = await stream.ReadAsync(buffer, timeout.Token)) != 0)
            {
                if (content.Length + count > 1024 * 1024) throw new TokenException("JWKS response exceeds 1 MiB");
                content.Write(buffer, 0, count);
            }
            var keys = TrustedKeys.PublicKeys((Dictionary<string, object?>)Json.Read(new System.Text.UTF8Encoding(false, true).GetString(content.ToArray()))!);
            lock (_gate)
            {
                if (generation != _generation || _closed) throw new TokenException("JWKS cache was invalidated during refresh");
                _keys = keys;
                _expires = Now + 1800;
            }
            return keys;
        }
        catch (OperationCanceledException) when (!_shutdown.IsCancellationRequested) { throw new TokenException("JWKS retrieval timed out"); }
        catch (OperationCanceledException) { throw; }
        catch (TokenException) { throw; }
        catch (Exception) { throw new TokenException("JWKS retrieval failed"); }
        finally { lock (_gate) { if (generation == _generation) _nextAttempt = Now + 2; } }
    }

    public async Task<string> ResolveAsync(string kid, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (!Tokens.ValidKid(kid)) throw new TokenException("Invalid token key ID");
        Task<IReadOnlyDictionary<string, string>> task;
        long generation;
        lock (_gate)
        {
            ObjectDisposedException.ThrowIf(_closed, this);
            if (Now < _expires && _keys.TryGetValue(kid, out var key)) return key;
            if (_refresh is null)
            {
                if (Now < _nextAttempt) throw new TokenException("JWKS key unavailable; refresh is throttled");
                _nextAttempt = Now + 2;
                _refresh = LoadAsync(_generation);
                _tasks.Add(_refresh);
                _ = _refresh.ContinueWith(completed =>
                {
                    lock (_gate)
                    {
                        _tasks.Remove(completed);
                        if (_refresh == completed) _refresh = null;
                    }
                    _ = completed.Exception;
                }, TaskScheduler.Default);
            }
            task = _refresh;
            generation = _generation;
        }
        // Cancel only this waiter; shutdown cancels the shared retrieval.
        var keys = await task.WaitAsync(cancellationToken);
        lock (_gate)
        {
            if (generation != _generation) throw new TokenException("JWKS cache was invalidated during lookup");
            return keys.TryGetValue(kid, out var found) ? found : throw new TokenException("JWKS key not found");
        }
    }

    public async ValueTask DisposeAsync()
    {
        Task[] tasks;
        lock (_gate)
        {
            if (_closed) return;
            _closed = true;
            Invalidate();
            tasks = _tasks.Cast<Task>().ToArray();
        }
        await _shutdown.CancelAsync();
        try { await Task.WhenAll(tasks); } catch (Exception) { /* Individual waiters observe their refresh result. */ }
        _client.Dispose();
        _shutdown.Dispose();
    }
}
