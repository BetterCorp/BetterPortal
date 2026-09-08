using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace BetterPortal.AspNetCore;

public static class ServiceLifetime
{
    /// <summary>Register BP startup/shutdown before building the host; map its routes with MapBetterPortal.</summary>
    public static IServiceCollection AddBetterPortal(this IServiceCollection services, Service service, ControlPlaneSync? sync = null, ServiceInstallation? installation = null)
    {
        if (sync is not null && !ReferenceEquals(sync.Service, service)) throw new ArgumentException("Sync belongs to a different service");
        if (installation is not null && (!ReferenceEquals(installation.Service, service) || sync is not null)) throw new ArgumentException("Installation must own this service's synchronization");
        services.AddSingleton(service);
        services.AddHostedService(_ => new Lifetime(service, sync, installation));
        return services;
    }
    private sealed class Lifetime(Service service, ControlPlaneSync? sync, ServiceInstallation? installation) : IHostedService, IAsyncDisposable
    {
        public async Task StartAsync(CancellationToken cancellation)
        {
            try
            {
                await service.Initialize(cancellation);
                if (installation is not null) await installation.StartAsync(cancellation);
                else if (sync is not null) await sync.StartAsync(cancellation);
            }
            catch { await DisposeAsync(); throw; }
        }
        public Task StopAsync(CancellationToken cancellation) => DisposeAsync().AsTask();
        public async ValueTask DisposeAsync()
        {
            try
            {
                if (installation is not null) await installation.DisposeAsync();
                else if (sync is not null) await sync.DisposeAsync();
            }
            finally { await service.DisposeAsync(); }
        }
    }
}
