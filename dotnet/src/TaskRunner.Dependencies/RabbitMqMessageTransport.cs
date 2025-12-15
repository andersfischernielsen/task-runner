using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using TaskRunner.Abstractions;
using TaskRunner.Core;

namespace TaskRunner.Dependencies;

public sealed class RabbitMqMessageTransport<TReceive, TSend> : IMessageTransport<TReceive, TSend>
{
    private readonly TaskRunnerOptions<TReceive, TSend> _options;
    private readonly ILogger<RabbitMqMessageTransport<TReceive, TSend>> _logger;
    private readonly IConfiguration _configuration;
    private readonly ITracer _tracer;
    private readonly JsonSerializerOptions _jsonOptions;

    private IConnection? _connection;
    private IChannel? _channel;

    private readonly SemaphoreSlim _publishSemaphore = new(1, 1);

    public RabbitMqMessageTransport(TaskRunnerOptions<TReceive, TSend> options, ILogger<RabbitMqMessageTransport<TReceive, TSend>> logger, IConfiguration configuration, ITracer tracer)
    {
        _options = options;
        _logger = logger;
        _configuration = configuration;
        _tracer = tracer;
        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = false
        };
    }

    public async Task StartAsync(Func<TReceive, CancellationToken, Task> onMessage, CancellationToken ct)
    {
        var connectionString = _configuration["RABBIT_MQ_CONNECTION"]
            ?? _configuration.GetConnectionString("RabbitMQ");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException("RABBIT_MQ_CONNECTION is not configured.");
        }

        var factory = new ConnectionFactory
        {
            Uri = new Uri(connectionString)
        };

        _connection = await factory.CreateConnectionAsync(ct);
        _channel = await _connection.CreateChannelAsync(cancellationToken: ct);

        await _channel.BasicQosAsync(0, 1, global: false, cancellationToken: ct);

        _logger.LogInformation("Connected to RabbitMQ");

        var receiveQueues = new List<string>();
        foreach (var topic in _options.ReceiveTopics.Distinct())
        {
            var topicName = topic.ToString();
            var queueName = $"{topicName}.{_options.Name}";
            var deadLetterExchange = $"{queueName}.dead-letter";
            var deadLetterQueue = deadLetterExchange;

            await _channel.ExchangeDeclareAsync(deadLetterExchange, ExchangeType.Direct, durable: true, cancellationToken: ct);
            await _channel.QueueDeclareAsync(deadLetterQueue, durable: true, exclusive: false, autoDelete: false, cancellationToken: ct);
            await _channel.QueueBindAsync(deadLetterQueue, deadLetterExchange, routingKey: string.Empty, cancellationToken: ct);

            await _channel.ExchangeDeclareAsync(topicName, ExchangeType.Fanout, durable: true, cancellationToken: ct);
            await _channel.QueueDeclareAsync(
                queueName,
                durable: true,
                exclusive: false,
                autoDelete: false,
                arguments: new Dictionary<string, object?>
                {
                    ["x-queue-type"] = "quorum",
                    ["x-dead-letter-exchange"] = deadLetterExchange,
                    ["x-delivery-limit"] = 20
                },
                cancellationToken: ct);

            await _channel.QueueBindAsync(queueName, topicName, routingKey: string.Empty, cancellationToken: ct);
            receiveQueues.Add(queueName);
        }

        foreach (var topic in _options.SendTopics)
        {
            await _channel.ExchangeDeclareAsync(topic.ToString(), ExchangeType.Fanout, durable: true, cancellationToken: ct);
        }

        if (receiveQueues.Count == 0)
        {
            throw new InvalidOperationException("No receive topics configured.");
        }

        foreach (var queue in receiveQueues)
        {
            var consumer = new AsyncEventingBasicConsumer(_channel);
            consumer.ReceivedAsync += async (_, ea) =>
            {
                await HandleDeliveryAsync(ea, onMessage, ct);
            };

            await _channel.BasicConsumeAsync(
                queue: queue,
                autoAck: false,
                consumer: consumer,
                cancellationToken: ct);

            _logger.LogInformation($"Consuming queue '{queue}' for topics {string.Join(", ", _options.ReceiveTopics.Select(t => t.ToString()))}");
        }

        try
        {
            await Task.Delay(Timeout.Infinite, ct);
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("RabbitMqMessageTransport cancellation requested.");
        }
    }

    private async Task HandleDeliveryAsync(BasicDeliverEventArgs ea, Func<TReceive, CancellationToken, Task> onMessage, CancellationToken ct)
    {
        if (_channel is null)
        {
            throw new InvalidOperationException("RabbitMQ channel is not initialized.");
        }

        var headers = ConvertHeaders(ea.BasicProperties.Headers);
        await using var span = _tracer.StartConsumerSpan("message_handler", headers);

        try
        {
            var json = Encoding.UTF8.GetString(ea.Body.Span);
            TReceive instance;
            try
            {
                instance = JsonSerializer.Deserialize<TReceive>(json, _jsonOptions) ?? throw new JsonException($"Deserialization failed for {typeof(TReceive).Name}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to deserialize message");
                await _channel.BasicNackAsync(ea.DeliveryTag, multiple: false, requeue: false, cancellationToken: ct);
                return;
            }

            await onMessage(instance, ct);

            await _channel.BasicAckAsync(ea.DeliveryTag, multiple: false, cancellationToken: ct);
        }
        catch (Exception ex)
        {
            _tracer.StartSpan("message_error").SetError(ex);
            _logger.LogError(ex, "Error while processing message");
            await _channel.BasicNackAsync(ea.DeliveryTag, multiple: false, requeue: true, cancellationToken: ct);
        }
    }

    private static Dictionary<string, object?> ConvertHeaders(
        IDictionary<string, object?>? headers)
    {
        if (headers is null)
        {
            return [];
        }

        return new Dictionary<string, object?>(headers);
    }

    public async Task EmitAsync(TSend message, Topic topic, CancellationToken ct = default)
    {
        if (_channel is null)
        {
            throw new InvalidOperationException("RabbitMQ channel is not initialized.");
        }

        if (!_options.SendTopics.Contains(topic))
        {
            throw new InvalidOperationException(
                $"Topic '{topic}' is not configured as a send topic for runner '{_options.Name}'.");
        }

        var json = JsonSerializer.Serialize(message, _jsonOptions);
        var body = Encoding.UTF8.GetBytes(json);

        var properties = new BasicProperties
        {
            Persistent = true
        };

        var headers = new Dictionary<string, object?>();
        _tracer.InjectCurrentSpan(headers);
        properties.Headers = headers;

        await _publishSemaphore.WaitAsync(ct);
        try
        {
            await _channel.BasicPublishAsync(
                exchange: topic.ToString(),
                routingKey: string.Empty,
                mandatory: false,
                basicProperties: properties,
                body: body,
                cancellationToken: ct);
        }
        finally
        {
            _publishSemaphore.Release();
        }
    }

    public async ValueTask DisposeAsync()
    {
        try
        {
            if (_channel is not null)
            {
                await _channel.CloseAsync();
                _channel.Dispose();
            }
            if (_connection is not null)
            {
                await _connection.CloseAsync();
                _connection.Dispose();
            }
        }
        catch
        { }

        _publishSemaphore.Dispose();
    }
}
