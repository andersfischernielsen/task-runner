# TaskRunner

A message-driven task runner framework with SDKs for .NET and TypeScript, supporting complex task pipelines.

---

A _task_ is represented by a _message_ containing data necessary to carry out the task. 
_Runners_ execute assigned tasks as fast as messages can be delivered.

- All messages are strictly typed.
- Tasks are only processed once by a task runner, simplifying concurrent task processing.
- Tasks will always either fail or succeed.
- Queues are automatically set up with poison message/dead letter handling via retries and separate queues.
- Emitting the same message to multiple task runners is supported (fan-out), allowing for both forks and merges in task pipelines.
- Exchanges and queues required for task delivery are automatically configured by all SDKs.

The SDKs provide abstractions for databases, file storage, and message transport.
The included implementations use PostgreSQL, S3, and RabbitMQ, but these can be swapped for other providers.

## SDKs

| SDK                                  | Description                               |
| ------------------------------------ | ----------------------------------------- |
| [.NET](./dotnet/README.md)           | C# SDK using RabbitMQ, PostgreSQL, and S3 |
| [TypeScript](./typescript/README.md) | TypeScript SDK using Bun runtime          |

---

## Message Schemas/Topics

All message types are defined as JSON Schema in [`samples/schemas/messages/`](./samples/schemas/messages/) and auto-generated into each SDK. 
This ensures strict types while allowing runners to be implemented in the appropriate language for the tasks they carry out. 

## Running the samples

Start the full stack (PostgreSQL, RabbitMQ, LocalStack S3, and sample runners):

```bash
docker compose up --build
```

### Test

1. **Create test data:**

```sh
docker exec -i taskrunner-postgres psql -U taskrunner -d taskrunner -c "
INSERT INTO images (id, file_name, content_type, bucket_name, object_key, size_bytes)
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'test-image.jpg', 'image/jpeg', 'uploads', 'test-image.jpg', 100)
ON CONFLICT (id) DO NOTHING;"
```

2. **Publish a message:**

```sh
docker exec taskrunner-rabbitmq rabbitmqadmin -u taskrunner -p taskrunner publish \
  exchange=FileUploaded routing_key="" \
  payload='{"fileId":"550e8400-e29b-41d4-a716-446655440000","fileName":"test-image.jpg","contentType":"image/jpeg","bucketName":"uploads","objectKey":"test-image.jpg","sizeBytes":100,"uploadedAt":"2025-01-01T00:00:00Z"}'
```

3. **Watch the logs:**

```bash
docker compose logs -f
```

The flow: `FileUploaded` → FileVerifier → `FileVerified` → FileConverter → `FileConverted`

## Services

| Service       | Port                            | Credentials             |
| ------------- | ------------------------------- | ----------------------- |
| PostgreSQL    | 5432                            | `taskrunner:taskrunner` |
| RabbitMQ      | 5672 (AMQP), 15672 (Management) | `taskrunner:taskrunner` |
| LocalStack S3 | 4566                            | `test:test`             |
