using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace BetterPortal.AspNetCore;

public static class ServiceLifetime
{
    /// <summary>Register BP startup/shutdown before building the host; map its routes with MapBetterPortal.</summary>
    public static IServiceCollection AddBetterPortal(this IServiceCollection services, Service service, ControlPlaneSync? sync = null)
    {
        if (sync is not null && !ReferenceEquals(sync.Service, service)) throw new ArgumentException("Sync belongs to a different service");
        services.AddSingleton(service);
        services.AddHostedService(_ => new Lifetime(service, sync));
        return services;
    }
    private sealed class Lifetime(Service service, ControlPlaneSync? sync) : IHostedService, IAsyncDisposable
    {
        public async Task StartAsync(CancellationToken cancellation)
        {
            if (sync is not null) await sync.StartAsync(cancellation);
        }
        public Task StopAsync(CancellationToken cancellation) => DisposeAsync().AsTask();
        public async ValueTask DisposeAsync()
        {
            try { if (sync is not null) await sync.DisposeAsync(); }
            finally { await service.DisposeAsync(); }
        }
    }
}
