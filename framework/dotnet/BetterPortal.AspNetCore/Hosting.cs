using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Net.Http.Headers;
using Node = System.Collections.Generic.Dictionary<string, object?>;

namespace BetterPortal.AspNetCore;

public static class Hosting
{
    private static readonly UTF8Encoding Utf8 = new(false, true);
    private static string RequestPath(HttpRequest request)
    {
        var raw = request.HttpContext.Features.Get<IHttpRequestFeature>()?.RawTarget;
        if (raw?.StartsWith('/') is true) ValidateEscapes(raw.Split('?', 2)[0]);
        return raw?.StartsWith('/') is true ? new Uri("http://betterportal.invalid" + raw.Split('?', 2)[0]).AbsolutePath : request.PathBase.Add(request.Path).ToUriComponent();
    }
    private static string PathParameter(string value)
    {
        try { return Utf8.GetString(System.Web.HttpUtility.UrlDecodeToBytes(value.Replace("+", "%2B", StringComparison.Ordinal), Utf8)); }
        catch (DecoderFallbackException) { throw new RequestException(400, "Invalid path encoding"); }
    }
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
        Service.ValidateProtocolVersion(result.GetValueOrDefault("bp-protocol-version", "2"));
        return result;
    }
    private static void Append(Node values, string name, object? value)
    {
        if (!values.TryGetValue(name, out var existing)) values[name] = value;
        else if (existing is List<object?> items) items.Add(value);
        else values[name] = new List<object?> { existing, value };
    }
    private static void ValidateEscapes(string raw)
    {
        for (var index = 0; index < raw.Length; index++)
        {
            if (raw[index] != '%') continue;
            if (index + 2 >= raw.Length || !Uri.IsHexDigit(raw[index + 1]) || !Uri.IsHexDigit(raw[index + 2]))
                throw new RequestException(400, "Invalid percent escape");
            index += 2;
        }
    }
    private static Node Pairs(string raw, int maximumLength = 8192)
    {
        if (raw.Length > maximumLength) throw new RequestException(414, "Query string is too large");
        ValidateEscapes(raw);
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
        if (status >= 400) context.Response.Headers.CacheControl = "no-store";
        if (status is 204 or 304) return;
        context.Response.ContentType = contentType + "; charset=utf-8";
        if (context.Request.Method == "HEAD") return;
        await context.Response.WriteAsync(Json.Write(value), context.RequestAborted);
    }
    private static string[] Segments(string path) => path == "/" ? [] : path[1..].Split('/');
    private static async Task ReplyRaw(HttpContext context, RawResponse raw, IReadOnlyDictionary<string, string> headers, CancellationToken retired = default)
    {
        await using (raw)
        {
            using var retirement = retired.Register(context.Abort);
            context.Response.StatusCode = raw.Status;
            // An intentional empty raw error must not become a framework JSON error.
            if (context.Features.Get<Microsoft.AspNetCore.Diagnostics.IStatusCodePagesFeature>() is { } statusPages) statusPages.Enabled = false;
            foreach (var (name, value) in raw.Headers) context.Response.Headers.Append(name, value);
            foreach (var (name, value) in headers)
                if (name.Equals("vary", StringComparison.OrdinalIgnoreCase)) context.Response.Headers.Append(name, value);
                else if (name.Equals("cache-control", StringComparison.OrdinalIgnoreCase))
                {
                    if (!context.Response.Headers.ContainsKey(name)) context.Response.Headers[name] = raw.Status >= 400 || raw.BodyStream is not null || raw.BodyChunks is not null ? "no-store" : value;
                }
                else context.Response.Headers[name] = value;
            if (raw.BodyStream is null && raw.BodyChunks is null && raw.Status is not (204 or 304)) context.Response.ContentLength = raw.Body.Length;
            if (context.Request.Method == "HEAD" || raw.Status is 204 or 205 or 304) return;
            if (raw.BodyChunks is not null)
            {
                await foreach (var chunk in raw.BodyChunks.WithCancellation(context.RequestAborted))
                {
                    retired.ThrowIfCancellationRequested();
                    await context.Response.Body.WriteAsync(chunk, context.RequestAborted);
                    await context.Response.Body.FlushAsync(context.RequestAborted);
                }
            }
            else if (raw.BodyStream is not null) await raw.BodyStream.CopyToAsync(context.Response.Body, context.RequestAborted);
            else await context.Response.Body.WriteAsync(raw.Body, context.RequestAborted);
        }
    }
    public static WebApplication MapBetterPortal(this WebApplication endpoints, Service service, int maxBodyBytes = 1024 * 1024, string mode = "service", ServiceInstallation? installation = null)
    {
        if (maxBodyBytes < 1 || mode is not ("service" or "theme")) throw new ArgumentException("Invalid hosting options");
        if (installation is not null && !ReferenceEquals(installation.Service, service)) throw new ArgumentException("Installation belongs to a different service");
        void Map(string path, IEnumerable<string> methods, RequestDelegate handler)
        {
            var allowed = methods.Distinct().ToArray();
            endpoints.MapMethods(path, allowed, handler);
            // Only BP paths own this fallback; other host endpoints keep their error behavior.
            endpoints.Map(path, (HttpContext context) => Reply(context, new { error = "Method not allowed" }, 405,
                new Dictionary<string, string> { ["allow"] = string.Join(", ", allowed) }))
                .WithOrder(int.MaxValue - 1);
        }
        string[] discovery = ["/.well-known/bp/health", "/.well-known/bp/manifest", "/.well-known/bp/schema.json", "/.well-known/bp/config/schema"];
        if (installation is not null) discovery = [.. discovery, "/.well-known/jwks.json"];
        foreach (var path in discovery) Map(path, ["GET", "HEAD", "OPTIONS"], async (HttpContext context) =>
        {
            var headers = new Dictionary<string, string> { ["access-control-allow-origin"] = "*", ["cache-control"] = "no-store" };
            try { _ = Headers(context.Request); }
            catch (RequestException error) { await Reply(context, new { error = error.Message }, error.Status, headers); return; }
            if (context.Request.Method == "OPTIONS")
            {
                if (context.Request.Headers["access-control-request-method"].ToString() is not ("GET" or "HEAD")) { await Reply(context, new { error = "Method not allowed" }, 403, headers); return; }
                headers["access-control-allow-methods"] = "GET, HEAD, OPTIONS"; headers["access-control-allow-headers"] = "Accept, BP-Protocol-Version";
                await Reply(context, null, 204, headers); return;
            }
            if (path == discovery[0]) await Reply(context, new { ok = service.Ready }, service.Ready ? 200 : 503, headers);
            else if (path == "/.well-known/jwks.json" && installation is not null)
            {
                try { await Reply(context, installation.Jwks(), 200, headers); }
                catch (InvalidOperationException) { await Reply(context, new { error = "Signing identity is not available" }, 503, headers); }
            }
            else await Reply(context, path == discovery[1] ? service.Manifest : path == discovery[3] ? service.ConfigSchema() : (object)service.Schema(), 200, headers);
        });
        const string installPath = "/.well-known/bp/install";
        const string hostnamePath = "/.well-known/bp/hostname-change";
        if (installation is not null) foreach (var path in new[] { installPath, hostnamePath }) Map(path, ["POST", "OPTIONS"], async (HttpContext context) =>
        {
            using var stopping = CancellationTokenSource.CreateLinkedTokenSource(context.RequestAborted, endpoints.Lifetime.ApplicationStopping);
            var responseHeaders = new Dictionary<string, string> { ["access-control-allow-origin"] = "*", ["cache-control"] = "no-store" };
            try
            {
                var headers = Headers(context.Request);
                if (context.Request.Method == "OPTIONS")
                {
                    responseHeaders["access-control-allow-methods"] = "POST, OPTIONS"; responseHeaders["access-control-allow-headers"] = "Content-Type, Accept, BP-Protocol-Version";
                    await Reply(context, null, 204, responseHeaders); return;
                }
                var contentType = headers.GetValueOrDefault("content-type", "").Split(';')[0].Trim().ToLowerInvariant();
                if (contentType != "application/json" && !contentType.EndsWith("+json", StringComparison.Ordinal)) throw new RequestException(415, "Installation requires JSON");
                var body = await ReadBody(context.Request, maxBodyBytes, stopping.Token);
                object? value;
                try { value = Json.Read(Utf8.GetString(body)); }
                catch (Exception error) when (error is System.Text.Json.JsonException or ArgumentException) { throw new RequestException(400, "Invalid JSON body"); }
                var result = path == hostnamePath ? await installation.ChangeHostname(value, stopping.Token) : await installation.Install(value, stopping.Token);
                stopping.Token.ThrowIfCancellationRequested();
                await Reply(context, result.Body, result.Status, responseHeaders);
            }
            catch (RequestException error) { await Reply(context, new { error = error.Message, installed = installation.Installed }, error.Status, responseHeaders); }
            catch (OperationCanceledException) when (stopping.IsCancellationRequested) { context.Abort(); }
            catch (Exception) { await Reply(context, new { error = "Installation failed", installed = installation.Installed }, 500, responseHeaders); }
        });
        const string configPath = "/.well-known/bp/config";
        Map(configPath, ["GET", "HEAD", "POST", "OPTIONS"], async (HttpContext context) =>
        {
            var responseHeaders = new Dictionary<string, string> { ["vary"] = "Origin", ["cache-control"] = "no-store" };
            try
            {
                var headers = Headers(context.Request);
                responseHeaders = service.ConfigHeaders(headers, preflight: context.Request.Method == "OPTIONS");
                if (context.Request.Method == "OPTIONS") { await Reply(context, null, 204, responseHeaders); return; }
                var body = await ReadBody(context.Request, maxBodyBytes, context.RequestAborted);
                object? value = null;
                if (context.Request.Method == "POST")
                {
                    var contentType = context.Request.ContentType?.Split(';')[0].Trim().ToLowerInvariant();
                    if (contentType != "application/json" && contentType?.EndsWith("+json", StringComparison.Ordinal) is not true) throw new RequestException(415, "Config writes require JSON");
                    try { value = Json.Read(Utf8.GetString(body)); }
                    catch (Exception error) when (error is System.Text.Json.JsonException or ArgumentException) { throw new RequestException(400, "Invalid JSON body"); }
                }
                var result = await service.ConfigRequest(context.Request.Method == "POST" ? "config.write" : "config.read", headers, value, context.RequestAborted);
                await Reply(context, result, 200, responseHeaders);
            }
            catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested) { throw; }
            catch (RequestException error)
            {
                foreach (var (name, value) in error.Headers) responseHeaders[name] = value;
                await Reply(context, new { error = error.Message }, error.Status, responseHeaders);
            }
            catch (CorsDeniedException) { await Reply(context, new { error = "Origin or preflight is not allowed" }, 403, responseHeaders); }
            catch (Exception) { await Reply(context, new { error = "Request failed" }, 500, responseHeaders); }
        });
        var groups = new Dictionary<string, Dictionary<string, (Route Route, string Path)>>(StringComparer.Ordinal);
        foreach (var route in service.Registry.Routes) foreach (var path in route.Paths)
        {
            if (discovery.Contains(path) || path == configPath || installation is not null && (path == installPath || path == hostnamePath)) throw new ArgumentException("Route conflicts with BP discovery: " + path);
            var pattern = "/" + string.Join('/', Segments(path).Select((part, index) => part.StartsWith(':') ? "{_bp" + index + "}" : part));
            if (!groups.TryGetValue(pattern, out var methods)) groups[pattern] = methods = new(StringComparer.Ordinal);
            foreach (var operation in route.Operations) methods.Add(operation.Method, (route, path));
        }
        var bindings = groups.Select(pair => (Pattern: pair.Key, Operations: pair.Value, Sse: false)).ToList();
        foreach (var (pattern, operations) in groups)
            if (operations.TryGetValue("GET", out var get) && get.Route.HasSse)
            {
                var path = pattern.TrimEnd('/') + "/__sse";
                bindings.Add((path, new() { ["GET"] = get }, true));
            }
        foreach (var (pattern, operations, sse) in bindings) Map(pattern, operations.Keys.Concat(operations.ContainsKey("GET") ? ["HEAD", "OPTIONS"] : new[] { "OPTIONS" }).Distinct(), async (HttpContext context) =>
        {
            var requestAborted = context.RequestAborted;
            using var lifetime = service.Ready ? CancellationTokenSource.CreateLinkedTokenSource(requestAborted, service.Stopping, endpoints.Lifetime.ApplicationStopping) : null;
            if (lifetime is not null) context.RequestAborted = lifetime.Token;
            IReadOnlyDictionary<string, string> responseHeaders = new Dictionary<string, string> { ["vary"] = "Origin, Accept", ["cache-control"] = "no-store" };
            ScopedContext? failureScope = null; Operation? operation = null; Route? route = null; Representation? representation = null;
            var kind = "page"; string? key = null; var matched = ""; var requested = "GET";
            var query = new Node(); var parameters = new Node();
            var requestPath = "";
            var headers = new Dictionary<string, string>();
            async Task Failure(int status, string message, ScopedContext? scope = null)
            {
                responseHeaders = new Dictionary<string, string>(responseHeaders) { ["cache-control"] = "no-store" };
                scope ??= failureScope;
                var theme = (scope?.App.GetValueOrDefault("shell") as Node)?.GetValueOrDefault("renderer") as string;
                if (theme is not null && scope is not null && operation is not null && route is not null && representation?.Kind == "html")
                {
                    try
                    {
                        var renderContext = RenderContext.Create(new RequestContext(scope, new AuthorizedCaller(), requested, requestPath) { Urls = service.Urls(scope, requestPath, headers, context.Request.Scheme) },
                            route.ViewId, matched, theme, representation.Mode ?? "page", kind, key, status, parameters, query, context.RequestAborted);
                        var value = await operation.RenderError(renderContext, message);
                        if (value is not null) { await ReplyRaw(context, value, responseHeaders); return; }
                    }
                    catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested) { throw; }
                    catch (Exception) { status = 500; message = "Request failed"; }
                }
                await Reply(context, new { error = message }, status, responseHeaders);
            }
            try
            {
                requestPath = RequestPath(context.Request);
                headers = Headers(context.Request); query = Pairs(context.Request.QueryString.Value ?? "");
                if (query.GetValueOrDefault("_f") is { } selector && selector is not string) throw new RequestException(400, "Invalid fragment selector");
                var fragment = (string?)query.GetValueOrDefault("_f");
                var preflight = context.Request.Method == "OPTIONS" && headers.ContainsKey("access-control-request-method");
                requested = preflight ? headers["access-control-request-method"] : context.Request.Method;
                if (requested == "HEAD") requested = "GET";
                if (!operations.TryGetValue(requested, out var binding)) throw new RequestException(preflight ? 403 : 405, "Method not allowed");
                if (sse && (query.ContainsKey("_c") || binding.Route.Sse is null && query.ContainsKey("_f"))) throw new RequestException(400, "Stream connection does not support this selector");
                route = binding.Route; matched = binding.Path;
                var routedPath = requestPath.TrimEnd('/');
                var rawSegments = (sse ? routedPath[..^"/__sse".Length] : routedPath).Split('/').TakeLast(Segments(binding.Path).Length).ToArray();
                parameters = Segments(binding.Path).Select((part, index) => (part, index)).Where(item => item.part.StartsWith(':'))
                    .ToDictionary(item => item.part[1..], item => (object?)PathParameter(rawSegments[item.index]));
                if (preflight)
                {
                    responseHeaders = service.Preflight(binding.Route, headers, binding.Path, fragment, context.Request.Scheme, mode);
                    await Reply(context, null, 204, responseHeaders); return;
                }
                operation = binding.Route.Operations.Single(item => item.Method == requested);
                NotAcceptableException? negotiationError = null;
                try
                {
                    if (!operation.Handler.IsRaw && !sse)
                    {
                        var offers = new List<string> { "json", "metadata" };
                        if (operation.Handler.Renderers.Count > 0 || operation.ErrorRenderers.Count > 0 || operation.Handler.StreamRendererKeys.Count > 0) offers.Add("html");
                        if (operation.Handler.IsStreaming) offers.Add("ndjson");
                        representation = Media.Negotiate(headers.GetValueOrDefault("accept"), offers);
                    }
                }
                catch (NotAcceptableException error) { negotiationError = error; }
                if (representation?.Kind == "ndjson" && (query.ContainsKey("_f") || query.ContainsKey("_c") || representation.Fragment is not null))
                    throw new RequestException(400, "Stream connections do not accept renderer selectors");
                fragment ??= representation?.Fragment;
                if (query.GetValueOrDefault("_c") is { } componentValue && componentValue is not string || fragment is not null && query.ContainsKey("_c"))
                    throw new RequestException(400, "Invalid or ambiguous renderer selector");
                var component = (string?)query.GetValueOrDefault("_c");
                kind = fragment is not null ? "fragment" : component is not null ? "component" : "page";
                key = fragment ?? component;
                query.Remove("_f"); query.Remove("_c");
                // Subscriber fragments select an HTML event renderer before opening their stream.
                var accessFragment = representation?.Kind == "html" || sse && binding.Route.Sse is not null ? fragment : null;
                var prepared = await service.PrepareAsync(binding.Route, requested, requestPath, headers, binding.Path, accessFragment, context.Request.Scheme, mode, cancellationToken: context.RequestAborted);
                responseHeaders = prepared.Headers;
                failureScope = prepared.Context.Scope;
                if (negotiationError is not null) throw negotiationError;
                if (representation?.Kind == "metadata") { await Reply(context, Service.Metadata(binding.Route, operation, binding.Path), 200, responseHeaders, "application/vnd.betterportal.metadata+json"); return; }
                var body = await ReadBody(context.Request, maxBodyBytes, context.RequestAborted);
                var (value, multipart) = await Decode(context.Request, body, context.RequestAborted);
                var requestContext = prepared.Context with { Multipart = multipart };
                var values = new Node { ["params"] = parameters, ["query"] = query, ["headers"] = headers, ["request"] = value };
                RenderContext StreamContext(string renderer, object? parsedParams, object? parsedQuery) => RenderContext.Create(requestContext, binding.Route.ViewId, binding.Path,
                    renderer, "fragment", "page", null, 200, parsedParams, parsedQuery, context.RequestAborted);
                if (sse && binding.Route.Sse is { } feed)
                {
                    RenderContext EventContext(string renderer, object? parsedParams, object? parsedQuery)
                    {
                        var path = requestPath.TrimEnd('/')[..^"/__sse".Length];
                        if (path.Length == 0) path = "/";
                        var presentation = requestContext with { Path = path, Urls = service.Urls(requestContext.Scope, path, headers, context.Request.Scheme) };
                        return RenderContext.Create(presentation, binding.Route.ViewId, binding.Path, renderer, "fragment", "fragment", fragment, 200, parsedParams, parsedQuery, context.RequestAborted);
                    }
                    await ReplyRaw(context, feed.OpenStream(requestContext, values, fragment, EventContext, context.RequestAborted), responseHeaders, requestContext.SnapshotRetired); return;
                }
                if (operation.Handler.IsStreaming && (sse || representation?.Kind == "ndjson"))
                {
                    await ReplyRaw(context, operation.Handler.OpenStream(requestContext, values, sse, StreamContext, context.RequestAborted), responseHeaders, requestContext.SnapshotRetired); return;
                }
                if (operation.Handler.IsStreaming && requested == "GET" && kind == "page" && representation?.Kind == "html")
                {
                    var connection = requestPath.TrimEnd('/') + "/__sse" + context.Request.QueryString.ToUriComponent();
                    var shell = await operation.Handler.StreamShell(requestContext, values, connection, representation.Mode ?? "page", StreamContext, context.RequestAborted);
                    if (shell is not null)
                    {
                        await ReplyRaw(context, new RawResponse(Encoding.UTF8.GetBytes(shell), headers: new Dictionary<string, string>
                            { ["content-type"] = operation.HtmlContentType("fragment"), ["cache-control"] = "no-store" }), responseHeaders); return;
                    }
                }
                string? theme = null;
                if (representation?.Kind == "html")
                {
                    theme = (prepared.Context.Scope.App.GetValueOrDefault("shell") as Node)?.GetValueOrDefault("renderer") as string;
                    if (!operation.Handler.Renderers.Any(item => (item.Identity.Renderer, item.Identity.Kind, item.Identity.Key) == (theme, kind, key)))
                        throw new NotAcceptableException("Requested renderer is not available");
                }
                var output = await operation.Execute(requestContext, values, context.RequestAborted);
                if (operation.Handler.IsRaw) { await ReplyRaw(context, (RawResponse)output.Value!, responseHeaders, requestContext.SnapshotRetired); return; }
                var status = requestContext.Response.Status;
                var applicationHeaders = requestContext.Response.Headers.Where(pair => !pair.Key.Equals("content-type", StringComparison.OrdinalIgnoreCase)).ToList();
                if (status is 204 or 205 or 304) { await ReplyRaw(context, new RawResponse(status: status, headers: applicationHeaders), responseHeaders); return; }
                if (representation?.Kind == "html")
                {
                    Renderer renderer;
                    try { renderer = Renderer.Select(operation.Handler.Renderers, theme, kind, key, status); }
                    catch (NotAcceptableException) when (status != 200) { await ReplyRaw(context, new RawResponse(status: status, headers: applicationHeaders), responseHeaders); return; }
                    var renderContext = RenderContext.Create(requestContext, binding.Route.ViewId, binding.Path, renderer.Identity.Renderer, representation.Mode ?? "page", kind, key, status, output.Params, output.Query, context.RequestAborted);
                    var html = await renderer.RenderUntyped(output.Value, renderContext);
                    var contentMode = kind == "page" ? representation.Mode ?? "page" : "fragment";
                    applicationHeaders.Add(new("content-type", operation.HtmlContentType(contentMode)));
                    await ReplyRaw(context, new RawResponse(Encoding.UTF8.GetBytes(html), status, applicationHeaders), responseHeaders);
                }
                else
                {
                    applicationHeaders.Add(new("content-type", "application/json; charset=utf-8"));
                    await ReplyRaw(context, new RawResponse(Encoding.UTF8.GetBytes(Json.Write(output.Value)), status, applicationHeaders), responseHeaders);
                }
            }
            catch (RequestException error)
            {
                responseHeaders = responseHeaders.Concat(error.Headers).GroupBy(pair => pair.Key).ToDictionary(group => group.Key, group => group.Last().Value);
                await Failure(error.Status, error.Message, error.Scope);
            }
            catch (CorsDeniedException) { await Reply(context, new { error = "Origin or method is not allowed" }, 403, new Dictionary<string, string> { ["vary"] = "Origin, Access-Control-Request-Method, Access-Control-Request-Headers" }); }
            catch (NotAcceptableException) { await Failure(406, "Representation not available"); }
            catch (HandlerInputException error) { await Failure(400, "Invalid request " + error.Field); }
            catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested) { context.Abort(); }
            catch (BadHttpRequestException error) { await Failure(error.StatusCode, "Invalid request body"); }
            catch (Exception)
            {
                if (context.Response.HasStarted) context.Abort();
                else { context.Response.Clear(); await Failure(500, "Request failed"); }
            }
            finally { context.RequestAborted = requestAborted; }
        });
        return endpoints;
    }
}
