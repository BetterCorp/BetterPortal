using AnyVali;
using System.Runtime.CompilerServices;
using System.Text;
using System.Threading.Channels;
using System.Net.ServerSentEvents;

namespace BetterPortal;

public readonly record struct EventScope(string TenantId, string AppId);
public readonly record struct EventAddress(string ViewId, EventScope Scope);
public sealed class SubscriptionOverflowException() : Exception("SSE subscriber exceeded its pending event limit");

public static class SseWire
{
    private static readonly UTF8Encoding Utf8 = new(false, true);
    internal static void CheckName(string? value)
    {
        if (value is not null && (value.IndexOfAny(['\0', '\r', '\n']) >= 0 || Utf8.GetByteCount(value) > 1024))
            throw new ArgumentException("Invalid SSE event name or ID");
    }
    public static Task Write(IAsyncEnumerable<SseItem<string>> events, Stream destination, int maxDataBytes = 1024 * 1024,
        CancellationToken cancellation = default)
    {
        if (maxDataBytes < 1) throw new ArgumentException("SSE data limit must be positive");
        return SseFormatter.WriteAsync(Checked(cancellation), destination, cancellation);
        async IAsyncEnumerable<SseItem<string>> Checked([EnumeratorCancellation] CancellationToken signal)
        {
            await foreach (var item in events.WithCancellation(signal))
            {
                signal.ThrowIfCancellationRequested();
                if (Utf8.GetByteCount(item.Data) > maxDataBytes) throw new ArgumentException("SSE data byte limit exceeded");
                CheckName(item.EventType); CheckName(item.EventId);
                yield return item;
                // .NET 10 formats complete events but does not flush between them.
                await destination.FlushAsync(signal);
            }
        }
    }
}

public interface IEventSubscription : IAsyncDisposable
{
    IAsyncEnumerable<ReadOnlyMemory<byte>> Read(CancellationToken cancellation = default);
}
public interface IEventTransport : IAsyncDisposable
{
    ValueTask Publish(EventAddress address, ReadOnlyMemory<byte> data, CancellationToken cancellation = default);
    ValueTask<IEventSubscription> Subscribe(EventAddress address, CancellationToken cancellation = default);
}

/// <summary>Thread-safe bounded fan-out in this process. No replica broadcast or event history.</summary>
public sealed class LocalEvents(int capacity = 256, int maxPayloadBytes = 1024 * 1024) : IEventTransport
{
    private readonly int capacity = capacity > 0 ? capacity : throw new ArgumentException("Capacity must be positive");
    private readonly int maxPayloadBytes = maxPayloadBytes > 0 ? maxPayloadBytes : throw new ArgumentException("Payload limit must be positive");
    private readonly object gate = new();
    private readonly Dictionary<EventAddress, HashSet<Subscription>> subscribers = [];
    private bool closed;

    private sealed class Subscription(LocalEvents owner, EventAddress address, int capacity) : IEventSubscription
    {
        // Disposal/overflow drains the queue, so reads are synchronized by Channel too.
        internal readonly Channel<ReadOnlyMemory<byte>> Queue = Channel.CreateBounded<ReadOnlyMemory<byte>>(new BoundedChannelOptions(capacity)
        { FullMode = BoundedChannelFullMode.Wait, SingleReader = false, SingleWriter = false, AllowSynchronousContinuations = false });
        internal void Finish(Exception? error = null)
        {
            while (Queue.Reader.TryRead(out _)) { }
            Queue.Writer.TryComplete(error);
        }
        public async IAsyncEnumerable<ReadOnlyMemory<byte>> Read([EnumeratorCancellation] CancellationToken cancellation = default)
        {
            await foreach (var value in Queue.Reader.ReadAllAsync(cancellation)) yield return value;
        }
        public ValueTask DisposeAsync()
        {
            lock (owner.gate) { owner.Remove(address, this); Finish(); }
            return ValueTask.CompletedTask;
        }
    }

    private void Remove(EventAddress address, Subscription subscription)
    {
        if (!subscribers.TryGetValue(address, out var group)) return;
        group.Remove(subscription);
        if (group.Count == 0) subscribers.Remove(address);
    }
    public ValueTask Publish(EventAddress address, ReadOnlyMemory<byte> data, CancellationToken cancellation = default)
    {
        cancellation.ThrowIfCancellationRequested();
        if (data.Length > maxPayloadBytes) throw new ArgumentException("Event payload byte limit exceeded");
        var copy = data.ToArray();
        lock (gate)
        {
            ObjectDisposedException.ThrowIf(closed, this);
            foreach (var subscriber in subscribers.GetValueOrDefault(address)?.ToArray() ?? [])
            {
                if (subscriber.Queue.Writer.TryWrite(copy)) continue;
                subscriber.Finish(new SubscriptionOverflowException());
                Remove(address, subscriber);
            }
        }
        return ValueTask.CompletedTask;
    }
    public ValueTask<IEventSubscription> Subscribe(EventAddress address, CancellationToken cancellation = default)
    {
        cancellation.ThrowIfCancellationRequested();
        lock (gate)
        {
            ObjectDisposedException.ThrowIf(closed, this);
            var subscriber = new Subscription(this, address, capacity);
            if (!subscribers.TryGetValue(address, out var group)) subscribers[address] = group = [];
            group.Add(subscriber);
            return ValueTask.FromResult<IEventSubscription>(subscriber);
        }
    }
    public ValueTask DisposeAsync()
    {
        lock (gate)
        {
            if (closed) return ValueTask.CompletedTask;
            closed = true;
            foreach (var group in subscribers.Values) foreach (var subscriber in group) subscriber.Finish();
            subscribers.Clear();
        }
        return ValueTask.CompletedTask;
    }
}

public sealed class SseRoute<TInput, TEvent, TContext>(string viewId, Schema inputSchema, Schema eventSchema,
    Func<TInput, TContext, CancellationToken, ValueTask<TEvent>> mapper, IEventTransport transport, int maxPayloadBytes = 1024 * 1024)
{
    private readonly Func<TInput, TContext, CancellationToken, ValueTask<TEvent>> map = mapper;
    private readonly int maxPayloadBytes = maxPayloadBytes > 0 ? maxPayloadBytes : throw new ArgumentException("Payload limit must be positive");
    public string ViewId { get; } = !string.IsNullOrEmpty(viewId) ? viewId : throw new ArgumentException("View ID is required");
    public Schema InputSchema { get; } = inputSchema;
    public Schema EventSchema { get; } = eventSchema;

    public async ValueTask<TInput> Publish(EventScope scope, TInput value, CancellationToken cancellation = default)
    {
        var parsed = Contracts.Parse<TInput>(InputSchema, value);
        await transport.Publish(new(ViewId, scope), Encode(parsed), cancellation);
        return parsed;
    }
    private byte[] Encode(object? value)
    {
        var data = Encoding.UTF8.GetBytes(Json.Write(value));
        if (data.Length > maxPayloadBytes) throw new ArgumentException("Event payload byte limit exceeded");
        return data;
    }
    public async ValueTask<Subscription> Subscribe(EventScope scope, TContext context, CancellationToken cancellation = default) =>
        new(this, await transport.Subscribe(new(ViewId, scope), cancellation), context);

    public async Task WriteSse(EventScope scope, TContext context, Stream destination,
        Func<TEvent, CancellationToken, ValueTask<string>>? render = null, string? eventType = null, CancellationToken cancellation = default)
    {
        SseWire.CheckName(eventType);
        await using var subscription = await Subscribe(scope, context, cancellation);
        await SseWire.Write(Events(cancellation), destination, maxPayloadBytes, cancellation);
        async IAsyncEnumerable<SseItem<string>> Events([EnumeratorCancellation] CancellationToken signal)
        {
            await foreach (var value in subscription.Read(signal))
            {
                SseItem<string> message;
                try
                {
                    var data = render is null ? value is string text ? text : Json.Write(value) : await render(value, signal).AsTask().WaitAsync(signal);
                    if (new UTF8Encoding(false, true).GetByteCount(data) > maxPayloadBytes) throw new ArgumentException("SSE data byte limit exceeded");
                    message = new(data, eventType);
                }
                catch (OperationCanceledException) when (signal.IsCancellationRequested) { throw; }
                catch (Exception) { message = new("{\"code\":\"render_failed\",\"message\":\"Event rendering failed\"}", "error"); }
                yield return message;
            }
        }
    }

    public sealed class Subscription(SseRoute<TInput, TEvent, TContext> route, IEventSubscription subscription, TContext context) : IAsyncDisposable
    {
        public async IAsyncEnumerable<TEvent> Read([EnumeratorCancellation] CancellationToken cancellation = default)
        {
            await foreach (var data in subscription.Read(cancellation))
            {
                if (data.Length > route.maxPayloadBytes) throw new ArgumentException("Event payload byte limit exceeded");
                var input = Contracts.Parse<TInput>(route.InputSchema, Json.Read(new UTF8Encoding(false, true).GetString(data.Span)));
                var result = Contracts.Parse<TEvent>(route.EventSchema, await route.map(input, context, cancellation).AsTask().WaitAsync(cancellation));
                route.Encode(result);
                yield return result;
            }
        }
        public ValueTask DisposeAsync() => subscription.DisposeAsync();
    }
}
