using Microsoft.Extensions.Logging;
using TaskRunner.Abstractions;

namespace TaskRunner.Core;

public sealed class TaskRunnerContext<TSend>(
    Func<TSend, Topic, CancellationToken, Task> emitAsync,
    IDatabase database,
    IFileStorage fileStorage,
    ITracer tracer,
    ILogger logger) : ITaskRunnerContext<TSend>
{
    private readonly Func<TSend, Topic, CancellationToken, Task> _emitAsync = emitAsync ?? throw new ArgumentNullException(nameof(emitAsync));

    public Task EmitAsync(TSend message, Topic topic, CancellationToken ct = default) => _emitAsync(message, topic, ct);

    public IDatabase Database { get; } = database ?? throw new ArgumentNullException(nameof(database));
    public IFileStorage FileStorage { get; } = fileStorage;
    public ITracer Tracer { get; } = tracer ?? throw new ArgumentNullException(nameof(tracer));
    public ILogger Logger { get; } = logger ?? throw new ArgumentNullException(nameof(logger));
}
