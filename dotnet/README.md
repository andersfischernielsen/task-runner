# TaskRunner

The .NET SDK for all task runners.

All shared message queue handling is done here.
Task runners themselves use this SDK and specify a single entrypoint for reacting to messages.

## Usage

The following is all you need to implement a new task runner:

### `MyTaskRunner.cs`

```csharp
using TaskRunner.Abstractions;

namespace MyTaskRunner;

public sealed class MyTaskRunner : IMessageHandler<MyReceiveMessage, MySendMessage>
{
    public async Task HandleAsync(
        MyReceiveMessage message,
        ITaskRunnerContext<MySendMessage> context,
        CancellationToken ct)
    {
        // Instantiated and set up by the SDK:
        var logger = context.Logger;            // A logger instance.
        var database = context.Database;        // A database client.
        var fileStorage = context.FileStorage;  // A file storage client.
        var tracer = context.Tracer;            // A tracing instance.

        await context.Database.WithConnectionAsync(async (conn, token) =>
        {
            // Logic.
            await Task.CompletedTask;
        }, ct);

        var stream = await context.FileStorage.OpenReadAsync(new StorageObjectId(message.BucketName, message.ObjectKey), ct);

        // Logic.

        var outputMessage = new MySendMessage(
            FileId: message.FileId,
            FileName: message.FileName,
            ContentType: message.ContentType,
            BucketName: message.BucketName,
            ObjectKey: message.ObjectKey,
            SizeBytes: message.SizeBytes,
            UploadedAt: message.UploadedAt
        );

        await context.EmitAsync(outputMessage, Topic.ImageVerified, ct);
    }
}
```

### `Program.cs`

```csharp
using MyTaskRunner;
using TaskRunner.Abstractions;
using TaskRunner.Dependencies;

var builder = Host.CreateApplicationBuilder(args);
builder.AddRabbitMqTaskRunner<MyReceiveMessage, MySendMessage, MyTaskRunner.MyTaskRunner>(options =>
{
    options.Name = "file-verifier";
    options.ReceiveTopics = new HashSet<Topic> { Topic.ImageUploaded };
    options.SendTopics = new HashSet<Topic> { Topic.ImageVerified };
});

await builder.Build().RunAsync();
```

### SDK

The `ITaskRunnerContext<TSend>` provides access to:

| Property      | Type            | Description                                |
| ------------- | --------------- | ------------------------------------------ |
| `Logger`      | `ILogger`       | A logger instance for structured logging   |
| `Database`    | `IDatabase`     | Database client for PostgreSQL connections |
| `FileStorage` | `IFileStorage?` | S3/file storage client                     |
| `Tracer`      | `ITracer`       | Distributed tracing support                |
| `EmitAsync()` | Method          | Emit a message to a specified topic        |

## Project Structure

```
src/
├── TaskRunner.Abstractions/   # Core interfaces and types
├── TaskRunner.Core/           # Base task runner implementation
└── TaskRunner.Dependencies/   # RabbitMQ, PostgreSQL, S3 implementations
samples/
└── FileVerifier/              # Example task runner implementation
```

## Development

To build the solution:

```bash
dotnet build
```

To run the sample:

```bash
cd samples/FileVerifier
dotnet run
```
