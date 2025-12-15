namespace TaskRunner.Abstractions;

public interface IMessageHandler<TReceive, TSend>
{
    Task HandleAsync(TReceive message, ITaskRunnerContext<TSend> context, CancellationToken cancellationToken);
}