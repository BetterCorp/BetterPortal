using AnyVali;
using System.Runtime.CompilerServices;
using System.Text;
using System.Net.ServerSentEvents;

namespace BetterPortal;

public sealed class StreamException(string message) : Exception(message)
{
    public int Status => 500;
}

public sealed record StreamValue<TItem, TSummary>
{
    internal bool IsSummary { get; }
    internal object? Data { get; }
    private StreamValue(bool summary, object? data) { IsSummary = summary; Data = data; }
    public static StreamValue<TItem, TSummary> Item(TItem value) => new(false, value);
    public static StreamValue<TItem, TSummary> Summary(TSummary value) => new(true, value);
}

/// <summary>Request-local producer; each MoveNext validates one value before it reaches a consumer.</summary>
public sealed class StreamHandler<TItem, TSummary, TContext>
{
    public Schema ItemSchema { get; }
    public Schema? SummarySchema { get; }
    public Schema ResponseSchema { get; }
    private readonly Func<TContext, CancellationToken, IAsyncEnumerable<StreamValue<TItem, TSummary>>> run;
    private readonly int maxFrameBytes;

    public StreamHandler(Schema itemSchema, Func<TContext, CancellationToken, IAsyncEnumerable<StreamValue<TItem, TSummary>>> run,
        Schema? summarySchema = null, int maxFrameBytes = 1024 * 1024)
    {
        if (maxFrameBytes < 1024) throw new ArgumentException("Frame limit must be at least 1024 bytes");
        ItemSchema = itemSchema; SummarySchema = summarySchema; this.run = run; this.maxFrameBytes = maxFrameBytes;
        var items = (Dictionary<string, object?>)Json.Read(Json.Write(V.Export(itemSchema)))!;
        items["root"] = new Dictionary<string, object?> { ["kind"] = "array", ["items"] = items["root"], ["default"] = new List<object?>() };
        var properties = new Dictionary<string, Dictionary<string, object?>> { ["items"] = items };
        if (summarySchema is not null)
        {
            var summary = (Dictionary<string, object?>)Json.Read(Json.Write(V.Export(summarySchema)))!;
            summary["root"] = new Dictionary<string, object?> { ["kind"] = "optional", ["inner"] = summary["root"] };
            properties["summary"] = summary;
        }
        ResponseSchema = Contracts.Import(Contracts.ObjectDocument(properties));
    }

    public async IAsyncEnumerable<Dictionary<string, object?>> Frames(TContext context, [EnumeratorCancellation] CancellationToken cancellation = default)
    {
        cancellation.ThrowIfCancellationRequested();
        var producer = run(context, cancellation).GetAsyncEnumerator(cancellation);
        Dictionary<string, object?>? failure = null;
        var count = 0;
        var summarized = false;
        Task<bool>? pending = null;
        try
        {
            while (true)
            {
                Dictionary<string, object?>? frame = null;
                try
                {
                    cancellation.ThrowIfCancellationRequested();
                    pending = producer.MoveNextAsync().AsTask();
                    if (!await pending.WaitAsync(cancellation)) break;
                    cancellation.ThrowIfCancellationRequested();
                    if (summarized) throw new StreamException("Stream produced a value after its summary");
                    var value = producer.Current;
                    var schema = value.IsSummary ? SummarySchema ?? throw new StreamException("Stream has no summary schema") : ItemSchema;
                    frame = new() { ["kind"] = value.IsSummary ? "summary" : "item", ["data"] = Contracts.Parse(schema, value.Data) };
                    if (Encoding.UTF8.GetByteCount(Json.Write(frame)) > maxFrameBytes) throw new StreamException("Stream frame exceeds its byte limit");
                    if (value.IsSummary) summarized = true; else count++;
                }
                catch (OperationCanceledException) when (cancellation.IsCancellationRequested) { throw; }
                catch (ValidationError) { failure = Error("item_validation_failed", "Stream payload validation failed"); }
                catch (Exception) { failure = Error("stream_failed", "Stream failed"); }
                if (failure is not null) break;
                yield return frame!;
            }
        }
        finally
        {
            try
            {
                // An async iterator cannot dispose concurrently with MoveNext.
                // Cancellation releases the caller; cooperative producer I/O releases its resources.
                if (pending is { IsCompleted: false }) _ = CloseAfter(pending, producer);
                else await producer.DisposeAsync();
            }
            catch (OperationCanceledException) when (cancellation.IsCancellationRequested) { throw; }
            catch (Exception) { failure = Error("stream_failed", "Stream failed"); }
        }
        cancellation.ThrowIfCancellationRequested();
        yield return failure ?? (Dictionary<string, object?>)Contracts.Parse("StreamEndFrameSchema", new Dictionary<string, object?> { ["kind"] = "end", ["count"] = count })!;
    }

    private static async Task CloseAfter(Task<bool> pending, IAsyncEnumerator<StreamValue<TItem, TSummary>> producer)
    {
        try { await pending; } catch (Exception) { }
        try { await producer.DisposeAsync(); } catch (Exception) { }
    }

    private static Dictionary<string, object?> Error(string code, string message) =>
        (Dictionary<string, object?>)Contracts.Parse("StreamErrorFrameSchema", new Dictionary<string, object?> { ["kind"] = "error", ["error"] = code, ["message"] = message })!;

    public async Task<Dictionary<string, object?>> Buffered(TContext context, int maxItems = 10000, int maxBytes = 8 * 1024 * 1024, CancellationToken cancellation = default)
    {
        if (maxItems < 0 || maxBytes < 2) throw new ArgumentException("Invalid buffer limits");
        var items = new List<object?>();
        var result = new Dictionary<string, object?> { ["items"] = items };
        long size = Encoding.UTF8.GetByteCount(Json.Write(result));
        await foreach (var frame in Frames(context, cancellation))
        {
            if (frame["kind"] is "error") throw new StreamException((string)frame["message"]!);
            if (frame["kind"] is "item" or "summary")
            {
                size += Encoding.UTF8.GetByteCount(Json.Write(frame["data"]));
                if (frame["kind"] is "item") { size += items.Count > 0 ? 1 : 0; items.Add(frame["data"]); }
                else { size += 11; result["summary"] = frame["data"]; }
                if (items.Count > maxItems || size > maxBytes) throw new StreamException("Stream buffer exceeds its limit");
            }
        }
        if (size > maxBytes) throw new StreamException("Stream buffer exceeds its limit");
        return result;
    }

    public async IAsyncEnumerable<byte[]> Ndjson(TContext context, [EnumeratorCancellation] CancellationToken cancellation = default)
    {
        await foreach (var frame in Frames(context, cancellation)) yield return Encoding.UTF8.GetBytes(Json.Write(frame) + "\n");
    }

    public async IAsyncEnumerable<SseItem<string>> Sse(TContext context, [EnumeratorCancellation] CancellationToken cancellation = default)
    {
        await foreach (var frame in Frames(context, cancellation)) yield return new(Json.Write(frame), (string)frame["kind"]!);
    }
}
