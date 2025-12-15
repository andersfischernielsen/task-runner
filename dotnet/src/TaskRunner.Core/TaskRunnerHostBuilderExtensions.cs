using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using TaskRunner.Abstractions;

namespace TaskRunner.Core;

public static class TaskRunnerHostBuilderExtensions
{
    public static IHostApplicationBuilder AddTaskRunner<TReceive, TSend, THandler>(
        this IHostApplicationBuilder builder,
        Action<TaskRunnerOptions<TReceive, TSend>> configureOptions)
        where THandler : class, IMessageHandler<TReceive, TSend>
    {
        var options = new TaskRunnerOptions<TReceive, TSend>();
        configureOptions(options);

        builder.Services.AddSingleton(options);
        builder.Services.AddScoped<THandler>();

        builder.Services.AddHostedService<TaskRunnerHostedService<TReceive, TSend, THandler>>();

        return builder;
    }
}
