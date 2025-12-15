using Microsoft.Extensions.Logging;

namespace TaskRunner.Abstractions;

public interface ITaskRunnerContext<TSend>
{
    Task EmitAsync(TSend message, Topic topic, CancellationToken ct = default);

    IDatabase Database { get; }

    IFileStorage? FileStorage { get; }

    ITracer Tracer { get; }

    ILogger Logger { get; }
}