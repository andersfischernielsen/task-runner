using TaskRunner.Abstractions;

namespace TaskRunner.Core;

public interface IMessageTransport<TReceive, TSend> : IAsyncDisposable
{
    Task StartAsync(Func<TReceive, CancellationToken, Task> onMessage, CancellationToken ct);

    Task EmitAsync(TSend message, Topic topic, CancellationToken ct = default);
}
