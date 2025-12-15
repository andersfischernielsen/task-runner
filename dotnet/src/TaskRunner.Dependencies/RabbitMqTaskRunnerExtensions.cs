using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TaskRunner.Abstractions;
using TaskRunner.Core;

namespace TaskRunner.Dependencies;

public static class RabbitMqTaskRunnerExtensions
{
    public static IHostApplicationBuilder AddRabbitMqTaskRunner<TReceive, TSend, THandler>(
        this IHostApplicationBuilder builder,
        Action<TaskRunnerOptions<TReceive, TSend>> configureOptions)
        where THandler : class, IMessageHandler<TReceive, TSend>
    {
        var services = builder.Services;

        builder.AddTaskRunner<TReceive, TSend, THandler>(configureOptions);

        services.AddSingleton<ITracer, NoOpTracer>();

        var configuration = builder.Configuration;

        var postgresConnectionString = configuration["DATABASE_URL"]
            ?? configuration.GetConnectionString("Postgres");
        services.AddSingleton(new PostgresDatabase(postgresConnectionString!));

        services.AddSingleton<IFileStorage, S3FileStorage>();

        services.AddScoped<ITaskRunnerContext<TSend>>(sp =>
        {
            var logger = sp.GetRequiredService<ILogger<TaskRunnerContext<TSend>>>();
            var database = sp.GetRequiredService<PostgresDatabase>();
            var fileStorage = sp.GetRequiredService<IFileStorage>();
            var tracer = sp.GetRequiredService<ITracer>();
            var config = sp.GetRequiredService<IConfiguration>();

            var transport = sp.GetRequiredService<IMessageTransport<TReceive, TSend>>();

            return new TaskRunnerContext<TSend>(
                emitAsync: (msg, topic, ct) => transport.EmitAsync(msg, topic, ct),
                database: database,
                fileStorage: fileStorage,
                tracer: tracer,
                logger: logger
            );
        });

        services.AddSingleton<IMessageTransport<TReceive, TSend>, RabbitMqMessageTransport<TReceive, TSend>>();

        return builder;
    }
}
