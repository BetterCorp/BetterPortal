using AnyVali;
using System.Runtime.CompilerServices;
using System.Text;
using System.Threading.Channels;

namespace BetterPortal;

public readonly record struct EventScope(string TenantId, string AppId);
public readonly record struct EventAddress(string ViewId, EventScope Scope);
public sealed class SubscriptionOverflowException() : Exception("SSE subscriber exceeded its pending event limit");

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
