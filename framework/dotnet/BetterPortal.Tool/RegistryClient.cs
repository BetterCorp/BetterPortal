using BetterPortal;
using System.Text;
using Node = System.Collections.Generic.Dictionary<string, object?>;

namespace BetterPortal.Tool;

/// <summary>Bounded authoring requests to the existing BP contract registry.</summary>
internal sealed class RegistryClient
{
    private readonly string url;
    private static readonly UTF8Encoding Utf8 = new(false, true);
    public RegistryClient(string? url = null)
    {
        var value = url ?? Environment.GetEnvironmentVariable("BP_REGISTRY_URL") ?? "https://io.betterportal.org";
        TrustedKeys.SecureEndpoint(value); this.url = value.TrimEnd('/');
    }
    private async Task<(byte[] Data, string? Reference)> Request(string path, CancellationToken cancellation, byte[]? data = null, string? token = null)
    {
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellation); deadline.CancelAfter(TimeSpan.FromSeconds(30));
        using var client = new HttpClient(new SocketsHttpHandler { AllowAutoRedirect = false, UseCookies = false, UseProxy = false }) { Timeout = Timeout.InfiniteTimeSpan };
        using var request = new HttpRequestMessage(data is null ? HttpMethod.Get : HttpMethod.Post, url + path);
        request.Headers.Accept.ParseAdd("application/json"); request.Headers.AcceptEncoding.ParseAdd("identity");
        if (token is not null)
        {
            if (token.Length is < 1 or > 32768 || token.Any(c => c is < (char)33 or > (char)126)) throw new ArgumentException("Invalid registry token");
            request.Headers.Authorization = new("Bearer", token);
        }
        if (data is not null)
        {
            if (data.Length > 16 * 1024 * 1024) throw new ArgumentException("Registry request exceeds its size limit");
            request.Content = new ByteArrayContent(data); request.Content.Headers.ContentType = new("application/json");
        }
        using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, deadline.Token);
        if ((int)response.StatusCode != 200 && !(data is not null && (int)response.StatusCode == 201))
            throw new ArgumentException($"Registry request failed ({(int)response.StatusCode})");
        if (!string.Equals(response.Content.Headers.ContentType?.MediaType, "application/json", StringComparison.OrdinalIgnoreCase)
            || response.Content.Headers.ContentEncoding.Any(value => !value.Equals("identity", StringComparison.OrdinalIgnoreCase)))
            throw new ArgumentException("Invalid registry response representation");
        await using var stream = await response.Content.ReadAsStreamAsync(deadline.Token);
        using var output = new MemoryStream(); var buffer = new byte[8192]; int count;
        while ((count = await stream.ReadAsync(buffer, deadline.Token)) > 0)
        {
            if (output.Length + count > 16 * 1024 * 1024) throw new ArgumentException("Registry response exceeds its size limit");
            output.Write(buffer, 0, count);
        }
        return (output.ToArray(), response.Headers.TryGetValues("BP-Registry-Ref", out var references) ? string.Join(",", references) : null);
    }
    public async Task<(string Reference, byte[] Data, Node Contract)> Lookup(string kind, string identity, string? version, CancellationToken cancellation)
    {
        if (kind == "shortName")
        {
            var (catalog, _) = await Request("/v1/packages?name=" + Uri.EscapeDataString(identity), cancellation);
            var matches = ((IEnumerable<object?>)Contracts.Parse("RegistryPackageListSchema", Json.Read(Utf8.GetString(catalog)))!).Cast<Node>().ToArray();
            if (matches.Length != 1 || ((string)matches[0]["registryRef"]!).Split('/')[^1] != identity)
                throw new ArgumentException("Registry selector is ambiguous or missing; use the full reference");
            kind = "registryRef"; identity = (string)matches[0]["registryRef"]!;
        }
        var path = kind == "registryRef" ? "/v1/packages/" + identity : "/v1/plugin-ids/" + Uri.EscapeDataString(identity);
        var (data, header) = await Request(path + "/" + Uri.EscapeDataString(version ?? "latest") + "/schema.json", cancellation);
        var reference = kind == "registryRef" ? identity : header ?? "";
        Contracts.Parse("RegistryReferenceSchema", reference);
        var contract = (Node)Contracts.Parse("BpSchemaOutputSchema", Json.Read(Utf8.GetString(data)))!; var manifest = (Node)contract["manifest"]!;
        if (kind == "pluginId" && !Equals(manifest["pluginId"], identity) || version is not (null or "latest") && !Equals(manifest["version"], version))
            throw new ArgumentException("Registry returned a different dependency identity or version");
        if (header is not null && header != reference) throw new ArgumentException("Registry returned a different package reference");
        return (reference, data, contract);
    }
    public async Task<Node> Publish(string reference, object? value, string token, CancellationToken cancellation)
    {
        Contracts.Parse("RegistryReferenceSchema", reference);
        var contract = (Node)Contracts.Parse("BpSchemaOutputSchema", value)!; var manifest = (Node)contract["manifest"]!;
        var (data, _) = await Request("/v1/packages/" + reference, cancellation, Utf8.GetBytes(Json.Write(contract)), token);
        var result = (Node)Contracts.Parse("RegistryPublishResultSchema", Json.Read(Utf8.GetString(data)))!;
        if (!Equals(result["registryRef"], reference) || !Equals(result["pluginId"], manifest["pluginId"]) || !Equals(result["version"], manifest["version"]))
            throw new ArgumentException("Registry publish response has a different identity or version");
        return result;
    }
}
