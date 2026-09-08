using BetterPortal;

internal sealed class FaultStore(string directory, int limit = 16 * 1024 * 1024) : IStateStore
{
    private readonly FileStateStore file = new(Path.Combine(directory, "state.json"), limit);
    internal string Mode = "ok", LoadMode = "ok";
    internal int Saves;
    internal Action? AfterSave;
    internal TaskCompletionSource Started = new(TaskCreationOptions.RunContinuationsAsynchronously);
    internal TaskCompletionSource Release = new(TaskCreationOptions.RunContinuationsAsynchronously);
    public async ValueTask<byte[]?> Load(CancellationToken cancellation = default)
    {
        if (LoadMode == "block") { Started.TrySetResult(); await Release.Task.WaitAsync(cancellation); }
        return await file.Load(cancellation);
    }
    public async ValueTask Save(ReadOnlyMemory<byte> data, CancellationToken cancellation = default)
    {
        Saves++;
        if (Mode == "fail") throw new IOException("Injected persistence failure");
        if (Mode == "block") { Started.TrySetResult(); await Release.Task.WaitAsync(cancellation); }
        await file.Save(data, cancellation);
        AfterSave?.Invoke();
    }
}
