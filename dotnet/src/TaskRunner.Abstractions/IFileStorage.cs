namespace TaskRunner.Abstractions;

public readonly record struct StorageObjectId(string Container, string Key);

public interface IFileStorage
{
    Task<Stream> OpenReadAsync(StorageObjectId id, CancellationToken ct = default);

    Task WriteAsync(StorageObjectId id, Stream content, string? contentType = null, CancellationToken ct = default);

    Task DeleteAsync(StorageObjectId id, CancellationToken ct = default);
}
