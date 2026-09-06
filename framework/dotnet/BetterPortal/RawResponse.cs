using AnyVali;
using System.Text.RegularExpressions;

namespace BetterPortal;

/// <summary>The host owns and disposes a streaming body after delivery or cancellation.</summary>
public sealed class RawResponse : IAsyncDisposable
{
    private static readonly HashSet<string> TransportHeaders = new(["connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade", "content-length"], StringComparer.OrdinalIgnoreCase);
    public ReadOnlyMemory<byte> Body { get; }
    public Stream? BodyStream { get; }
    public int Status { get; }
    public IReadOnlyList<KeyValuePair<string, string>> Headers { get; }
    private bool closed;

    public RawResponse(ReadOnlyMemory<byte> body = default, int status = 200, IEnumerable<KeyValuePair<string, string>>? headers = null)
        : this(body, null, status, headers) { }
    public RawResponse(Stream body, int status = 200, IEnumerable<KeyValuePair<string, string>>? headers = null)
        : this(default, body ?? throw new ArgumentNullException(nameof(body)), status, headers) { }
    private RawResponse(ReadOnlyMemory<byte> body, Stream? stream, int status, IEnumerable<KeyValuePair<string, string>>? headers)
    {
        if (status is < 200 or > 599) throw new ArgumentException("Invalid final response status");
        if (status is 204 or 205 or 304 && (!body.IsEmpty || stream is not null)) throw new ArgumentException("Response status forbids a body");
        if (stream is not null && !stream.CanRead) throw new ArgumentException("Raw response stream must be readable");
        var pairs = (headers ?? []).ToArray();
        if (pairs.Sum(pair => (long)pair.Key.Length + pair.Value.Length) > 65536) throw new ArgumentException("Response headers are too large");
        foreach (var (name, value) in pairs)
        {
            if (!Regex.IsMatch(name, @"\A[!#$%&'*+.^_`|~0-9A-Za-z-]+\z") || value.Any(c => c < 32 && c != '\t' || c > 255 || c == 127))
                throw new ArgumentException("Invalid response header");
            if (TransportHeaders.Contains(name) || name.StartsWith("access-control-", StringComparison.OrdinalIgnoreCase))
                throw new ArgumentException("Response header is owned by the host");
        }
        Body = body.ToArray(); BodyStream = stream; Status = status; Headers = Array.AsReadOnly(pairs);
    }
    private static Dictionary<string, string> FileHeaders(string filename, string contentType, bool inline)
    {
        var fallback = new string(filename.Select(c => c is >= (char)32 and < (char)127 && c is not ('\\' or '"' or '/' or ';') ? c : '_').ToArray());
        return new() { ["content-type"] = contentType, ["content-disposition"] = (inline ? "inline" : "attachment") + "; filename=\"" + fallback + "\"; filename*=UTF-8''" + Uri.EscapeDataString(filename) };
    }
    public static RawResponse File(ReadOnlyMemory<byte> body, string filename, string contentType = "application/octet-stream", bool inline = false) => new(body, headers: FileHeaders(filename, contentType, inline));
    public static RawResponse File(Stream body, string filename, string contentType = "application/octet-stream", bool inline = false) => new(body, headers: FileHeaders(filename, contentType, inline));
    public async ValueTask DisposeAsync()
    {
        if (closed) return;
        closed = true;
        if (BodyStream is not null) await BodyStream.DisposeAsync();
    }
}

public sealed class RawHandler<TParams, TQuery, THeaders, TBody> : Handler<TParams, TQuery, THeaders, TBody>
{
    public override Schema? ResponseSchema => null;
    public override bool IsRaw => true;
    private readonly Func<HandlerContext<TParams, TQuery, THeaders, TBody>, ValueTask<RawResponse>> run;
    public RawHandler(Func<HandlerContext<TParams, TQuery, THeaders, TBody>, ValueTask<RawResponse>> run,
        Schema? @params = null, Schema? query = null, Schema? headers = null, Schema? request = null) : base(@params, query, headers, request)
    { ArgumentNullException.ThrowIfNull(run); this.run = run; }
    public async ValueTask<RawResponse> Invoke(RequestContext context, IReadOnlyDictionary<string, object?> values, CancellationToken cancellation = default)
    {
        cancellation.ThrowIfCancellationRequested();
        // Await ownership transfer: abandoning a raw result can leak an open file.
        var result = await run(Prepare(context, values, cancellation)) ?? throw new InvalidOperationException("Raw handlers must return RawResponse");
        if (cancellation.IsCancellationRequested) { await result.DisposeAsync(); cancellation.ThrowIfCancellationRequested(); }
        return result;
    }
    internal override async ValueTask<object?> InvokeBoxed(RequestContext context, IReadOnlyDictionary<string, object?> values, CancellationToken cancellation) => await Invoke(context, values, cancellation);
}
