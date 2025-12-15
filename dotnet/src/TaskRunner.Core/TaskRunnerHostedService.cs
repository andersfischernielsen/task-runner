using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TaskRunner.Abstractions;

namespace TaskRunner.Core;

public sealed class TaskRunnerHostedService<TReceive, TSend, THandler>(
    IServiceProvider services,
    IMessageTransport<TReceive, TSend> transport,
    ILogger<TaskRunnerHostedService<TReceive, TSend, THandler>> logger) : BackgroundService
    where THandler : class, IMessageHandler<TReceive, TSend>
{
    private readonly IServiceProvider _services = services;
    private readonly IMessageTransport<TReceive, TSend> _transport = transport;
    private readonly ILogger<TaskRunnerHostedService<TReceive, TSend, THandler>> _logger = logger;

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "Starting task runner for {ReceiveType} -> {SendType} with handler {HandlerType}",
            typeof(TReceive).Name,
            typeof(TSend).Name,
            typeof(THandler).Name);

        return _transport.StartAsync(DispatchMessageAsync, stoppingToken);
    }

    private async Task DispatchMessageAsync(TReceive message, CancellationToken ct)
    {
        using var scope = _services.CreateScope();
        var handler = scope.ServiceProvider.GetRequiredService<THandler>();
        var context = scope.ServiceProvider.GetRequiredService<ITaskRunnerContext<TSend>>();

        await handler.HandleAsync(message, context, ct);
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Stopping task runner for {ReceiveType} -> {SendType}",
            typeof(TReceive).Name,
            typeof(TSend).Name);

        await base.StopAsync(cancellationToken);
        await _transport.DisposeAsync();
    }
}
