using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Net.Http.Headers;
using Node = System.Collections.Generic.Dictionary<string, object?>;

namespace BetterPortal.AspNetCore;

public static class Hosting
{
    private static readonly UTF8Encoding Utf8 = new(false, true);
    private static readonly HashSet<string> SingleHeaders = new(["host", "origin", "referer", "authorization", "content-type", "content-length", "x-bp-service-id", "x-bp-tenant-id", "x-bp-app-id", "x-bp-service-authorization"], StringComparer.OrdinalIgnoreCase);
    private static Dictionary<string, string> Headers(HttpRequest request)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase); var size = 0;
        foreach (var (name, values) in request.Headers)
        {
            size += name.Length + values.Sum(value => value?.Length ?? 0);
            if (size > 65536) throw new RequestException(431, "Request headers are too large");
            if (SingleHeaders.Contains(name) && values.Count != 1 || values.Any(value => value is not null && value.IndexOfAny(['\r', '\n', '\0']) >= 0))
                throw new RequestException(400, "Invalid or duplicate request header");
            result[name.ToLowerInvariant()] = string.Join(name.Equals("cookie", StringComparison.OrdinalIgnoreCase) ? "; " : ", ", values.ToArray());
        }
        return result;
    }
    private static void Append(Node values, string name, object? value)
    {
        if (!values.TryGetValue(name, out var existing)) values[name] = value;
        else if (existing is List<object?> items) items.Add(value);
        else values[name] = new List<object?> { existing, value };
    }
    private static Node Pairs(string raw, int maximumLength = 8192)
    {
        if (raw.Length > maximumLength) throw new RequestException(414, "Query string is too large");
        var result = new Node(StringComparer.Ordinal); var count = 0;
        foreach (var pair in new QueryStringEnumerable(raw))
        {
            if (++count > 1000) throw new RequestException(400, "Too many form or query fields");
            try { Append(result, Utf8.GetString(System.Web.HttpUtility.UrlDecodeToBytes(pair.EncodedName.ToString(), Utf8)),
                Utf8.GetString(System.Web.HttpUtility.UrlDecodeToBytes(pair.EncodedValue.ToString(), Utf8))); }
            catch (DecoderFallbackException) { throw new RequestException(400, "Invalid form or query encoding"); }
        }
        return result;
    }
    private static async Task<byte[]> ReadBody(HttpRequest request, int maximum, CancellationToken cancellation)
    {
        using var output = new MemoryStream(); var buffer = new byte[8192]; int count;
        if (request.ContentLength > maximum) throw new RequestException(413, "Request body is too large");
        while ((count = await request.Body.ReadAsync(buffer, cancellation)) != 0)
        {
            if (output.Length + count > maximum) throw new RequestException(413, "Request body is too large");
            output.Write(buffer, 0, count);
        }
        return output.ToArray();
    }
    private static async Task<(object? Value, Generated.MultipartRequest? Multipart)> Decode(HttpRequest request, byte[] body, CancellationToken cancellation)
    {
        if (body.Length == 0) return (new Node(), null);
        if (!MediaTypeHeaderValue.TryParse(request.ContentType, out var contentType)) throw new RequestException(415, "Unsupported request content type");
        var media = contentType.MediaType.ToString().ToLowerInvariant();
        if (media == "application/json" || media.EndsWith("+json", StringComparison.Ordinal))
        {
            try { return (Json.Read(Utf8.GetString(body)), null); }
            catch (Exception error) when (error is System.Text.Json.JsonException or ArgumentException) { throw new RequestException(400, "Invalid JSON body"); }
        }
        var fields = new Node(StringComparer.Ordinal); var files = new Node(StringComparer.Ordinal); var values = new Node(StringComparer.Ordinal);
        if (media == "application/x-www-form-urlencoded")
        {
            try { fields = Pairs(Utf8.GetString(body), body.Length); }
            catch (DecoderFallbackException) { throw new RequestException(400, "Invalid form body"); }
        }
        else if (media == "multipart/form-data")
        {
            var boundary = HeaderUtilities.RemoveQuotes(contentType.Boundary).ToString();
            if (boundary.Length is < 1 or > 128) throw new RequestException(400, "Invalid multipart boundary");
            using var input = new MemoryStream(body);
            var reader = new MultipartReader(boundary, input) { BodyLengthLimit = body.Length }; MultipartSection? section;
            var fileCount = 0; var fieldCount = 0;
            try
            {
                while ((section = await reader.ReadNextSectionAsync(cancellation)) is not null)
                {
                    if (!ContentDispositionHeaderValue.TryParse(section.ContentDisposition, out var disposition) || disposition.DispositionType != "form-data" || !disposition.Name.HasValue)
                        throw new RequestException(400, "Invalid form body");
                    var name = HeaderUtilities.RemoveQuotes(disposition.Name).ToString();
                    using var content = new MemoryStream(); await section.Body.CopyToAsync(content, cancellation);
                    if (disposition.FileName.HasValue || disposition.FileNameStar.HasValue)
                    {
                        if (++fileCount > 100) throw new RequestException(400, "Too many uploaded files");
                        var filename = HeaderUtilities.RemoveQuotes(disposition.FileNameStar.HasValue ? disposition.FileNameStar : disposition.FileName).ToString();
                        Append(values, name, filename);
                        Append(files, name, new Node { ["fieldName"] = name, ["filename"] = filename, ["contentType"] = section.ContentType ?? "application/octet-stream", ["size"] = content.Length,
                            ["data"] = content.ToArray().Select(value => (int)value).ToArray() });
                    }
                    else
                    {
                        if (++fieldCount > 1000 || content.Length > 1024 * 1024) throw new RequestException(400, "Form field limits exceeded");
                        var value = Utf8.GetString(content.ToArray());
                        Append(fields, name, value); Append(values, name, value);
                    }
                }
            }
            catch (Exception error) when (error is InvalidDataException or DecoderFallbackException) { throw new RequestException(400, "Invalid form body"); }
        }
        else throw new RequestException(415, "Unsupported request content type");
        if (media == "application/x-www-form-urlencoded") foreach (var (name, value) in fields) values[name] = value;
        return (values, Contracts.Parse<Generated.MultipartRequest>("MultipartRequestSchema", new Node { ["fields"] = fields, ["files"] = files }));
    }
    private static async Task Reply(HttpContext context, object? value, int status, IReadOnlyDictionary<string, string>? headers = null, string contentType = "application/json")
    {
        context.Response.StatusCode = status;
        if (headers is not null) foreach (var (key, item) in headers) context.Response.Headers[key] = item;
        if (status is 204 or 304) return;
        context.Response.ContentType = contentType + "; charset=utf-8";
        if (context.Request.Method == "HEAD") return;
        await context.Response.WriteAsync(Json.Write(value), context.RequestAborted);
    }
    private static string[] Segments(string path) => path == "/" ? [] : path[1..].Split('/');
    public static WebApplication MapBetterPortal(this WebApplication endpoints, Service service, int maxBodyBytes = 1024 * 1024, string mode = "service")
    {
        if (maxBodyBytes < 1 || mode is not ("service" or "theme")) throw new ArgumentException("Invalid hosting options");
        endpoints.UseStatusCodePages(async status => await Reply(status.HttpContext,
            new { error = status.HttpContext.Response.StatusCode switch { 404 => "Route not found", 405 => "Method not allowed", _ => "Request failed" } }, status.HttpContext.Response.StatusCode));
        string[] discovery = ["/.well-known/bp/health", "/.well-known/bp/manifest", "/.well-known/bp/schema.json"];
        foreach (var path in discovery) endpoints.MapMethods(path, ["GET", "HEAD", "OPTIONS"], async (HttpContext context) =>
        {
            var headers = new Dictionary<string, string> { ["access-control-allow-origin"] = "*", ["cache-control"] = "no-store" };
            if (context.Request.Method == "OPTIONS")
            {
                if (context.Request.Headers["access-control-request-method"].ToString() is not ("GET" or "HEAD")) { await Reply(context, new { error = "Method not allowed" }, 403, headers); return; }
                headers["access-control-allow-methods"] = "GET, HEAD, OPTIONS"; headers["access-control-allow-headers"] = "Accept";
                await Reply(context, null, 204, headers); return;
            }
            if (path == discovery[0]) await Reply(context, new { ok = service.Ready }, service.Ready ? 200 : 503, headers);
            else await Reply(context, path == discovery[1] ? service.Manifest : (object)service.Schema(), 200, headers);
        });
        var groups = new Dictionary<string, Dictionary<string, (Route Route, string Path)>>(StringComparer.Ordinal);
        foreach (var route in service.Registry.Routes) foreach (var path in route.Paths)
        {
            if (discovery.Contains(path)) throw new ArgumentException("Route conflicts with BP discovery: " + path);
            var pattern = "/" + string.Join('/', Segments(path).Select((part, index) => part.StartsWith(':') ? "{_bp" + index + "}" : part));
            if (!groups.TryGetValue(pattern, out var methods)) groups[pattern] = methods = new(StringComparer.Ordinal);
            foreach (var operation in route.Operations) methods.Add(operation.Method, (route, path));
        }
        foreach (var (pattern, operations) in groups) endpoints.MapMethods(pattern, operations.Keys.Append("OPTIONS"), async (HttpContext context) =>
        {
            IReadOnlyDictionary<string, string> responseHeaders = new Dictionary<string, string> { ["vary"] = "Origin" };
            try
            {
                var headers = Headers(context.Request); var query = Pairs(context.Request.QueryString.Value ?? "");
                if (query.GetValueOrDefault("_f") is { } selector && selector is not string) throw new RequestException(400, "Invalid fragment selector");
                var fragment = (string?)query.GetValueOrDefault("_f");
                var requested = context.Request.Method == "OPTIONS" ? headers.GetValueOrDefault("access-control-request-method", "") : context.Request.Method;
                if (!operations.TryGetValue(requested, out var binding)) throw new RequestException(context.Request.Method == "OPTIONS" ? 403 : 405, "Method not allowed");
                if (context.Request.Method == "OPTIONS")
                {
                    responseHeaders = service.Preflight(binding.Route, headers, binding.Path, fragment, context.Request.Scheme, mode);
                    await Reply(context, null, 204, responseHeaders); return;
                }
                var prepared = await service.PrepareAsync(binding.Route, requested, context.Request.Path, headers, binding.Path, fragment, context.Request.Scheme, mode, cancellationToken: context.RequestAborted);
                responseHeaders = prepared.Headers;
                var representation = Media.Negotiate(headers.GetValueOrDefault("accept"), ["json", "metadata"]);
                var operation = binding.Route.Operations.Single(item => item.Method == requested);
                if (representation.Kind == "metadata") { await Reply(context, Service.Metadata(binding.Route, operation, binding.Path), 200, responseHeaders, "application/vnd.betterportal.metadata+json"); return; }
                var body = await ReadBody(context.Request, maxBodyBytes, context.RequestAborted);
                var (value, multipart) = await Decode(context.Request, body, context.RequestAborted);
                var parameters = Segments(binding.Path).Select((part, index) => (part, index)).Where(item => item.part.StartsWith(':'))
                    .ToDictionary(item => item.part[1..], item => context.Request.RouteValues["_bp" + item.index]);
                var output = await operation.Invoke(prepared.Context with { Multipart = multipart }, new Node { ["params"] = parameters, ["query"] = query, ["headers"] = headers, ["request"] = value }, context.RequestAborted);
                await Reply(context, output, 200, responseHeaders);
            }
            catch (RequestException error) { await Reply(context, new { error = error.Message }, error.Status, responseHeaders.Concat(error.Headers).GroupBy(pair => pair.Key).ToDictionary(group => group.Key, group => group.Last().Value)); }
            catch (CorsDeniedException) { await Reply(context, new { error = "Origin or method is not allowed" }, 403, new Dictionary<string, string> { ["vary"] = "Origin, Access-Control-Request-Method, Access-Control-Request-Headers" }); }
            catch (NotAcceptableException) { await Reply(context, new { error = "Representation not available" }, 406, responseHeaders); }
            catch (HandlerInputException error) { await Reply(context, new { error = "Invalid request " + error.Field }, 400, responseHeaders); }
            catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested) { }
            catch (BadHttpRequestException error) { await Reply(context, new { error = "Invalid request body" }, error.StatusCode, responseHeaders); }
            catch (Exception) { await Reply(context, new { error = "Request failed" }, 500, responseHeaders); }
        });
        return endpoints;
    }
}
