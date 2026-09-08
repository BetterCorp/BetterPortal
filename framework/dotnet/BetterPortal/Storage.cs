namespace BetterPortal;

/// <summary>Stores one complete runtime state. Failed saves must preserve prior state.</summary>
public interface IStateStore
{
    ValueTask<byte[]?> Load(CancellationToken cancellation = default);
    ValueTask Save(ReadOnlyMemory<byte> data, CancellationToken cancellation = default);
}

/// <summary>One writer per file; use a transactional shared store for multiple replicas.</summary>
public sealed class FileStateStore : IStateStore
{
    public string Path { get; }
    public int MaxBytes { get; }
    public FileStateStore(string path, int maxBytes = 16 * 1024 * 1024)
    {
        if (maxBytes < 1) throw new ArgumentException("Invalid state size limit");
        Path = System.IO.Path.GetFullPath(path); MaxBytes = maxBytes;
    }
    public async ValueTask<byte[]?> Load(CancellationToken cancellation = default)
    {
        FileStream stream;
        try { stream = new FileStream(Path, FileMode.Open, FileAccess.Read, FileShare.Read | FileShare.Delete, 8192, FileOptions.Asynchronous); }
        catch (FileNotFoundException) { return null; }
        catch (DirectoryNotFoundException) { return null; }
        await using (stream)
        {
            if (stream.Length > MaxBytes) throw new IOException("Stored state exceeds the size limit");
            using var output = new MemoryStream(); var buffer = new byte[8192]; int count;
            while ((count = await stream.ReadAsync(buffer, cancellation)) != 0)
            {
                if (output.Length + count > MaxBytes) throw new IOException("Stored state exceeds the size limit");
                output.Write(buffer, 0, count);
            }
            return output.ToArray();
        }
    }
    public async ValueTask Save(ReadOnlyMemory<byte> data, CancellationToken cancellation = default)
    {
        if (data.Length > MaxBytes) throw new ArgumentException("State exceeds the size limit");
        cancellation.ThrowIfCancellationRequested();
        var directory = System.IO.Path.GetDirectoryName(Path)!;
        Directory.CreateDirectory(directory);
        var temporary = System.IO.Path.Combine(directory, System.IO.Path.GetFileName(Path) + "." + Guid.NewGuid().ToString("N") + ".tmp");
        try
        {
            var options = new FileStreamOptions { Mode = FileMode.CreateNew, Access = FileAccess.Write, Share = FileShare.None, Options = FileOptions.Asynchronous };
            if (!OperatingSystem.IsWindows()) options.UnixCreateMode = UnixFileMode.UserRead | UnixFileMode.UserWrite;
            await using (var stream = new FileStream(temporary, options))
            {
                await stream.WriteAsync(data, cancellation);
                await stream.FlushAsync(cancellation);
                stream.Flush(flushToDisk: true);
            }
            cancellation.ThrowIfCancellationRequested();
            // No await or cancellation check after the atomic commit.
            File.Move(temporary, Path, overwrite: true);
        }
        finally { if (File.Exists(temporary)) File.Delete(temporary); }
    }
}
