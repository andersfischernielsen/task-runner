# TaskRunner

The TypeScript SDK for all task runners.

All shared message queue handling is done here.
Task runners themselves use this SDK and specify a single entrypoint for reacting to messages.

## Usage

The following is all you need to implement a new task runner:

### `my-task-runner.ts`

```typescript
import type { Context } from "./types";
import type { MyReceiveMessage, MySendMessage } from "./messages";
import { Topic } from "./types";

export const onMessage = async (
  message: MyReceiveMessage,
  context: Context<MySendMessage>,
) => {
  const { logger, database, fileStorage, tracer, emit } = context;

  await database.withConnection(async (conn) => {
    // ...
  });

  if (fileStorage) {
    const stream = await fileStorage.openRead({
      container: message.bucketName,
      key: message.objectKey,
    });
  }

  const outputMessage: MySendMessage = {
    fileId: message.fileId,
    fileName: message.fileName,
    contentType: message.contentType,
    bucketName: message.bucketName,
    objectKey: message.objectKey,
    sizeBytes: message.sizeBytes,
    uploadedAt: message.uploadedAt,
  };

  await emit(outputMessage, Topic.ImageVerified);
};
```

### `main.ts`

```typescript
import { taskRunner } from "./task-runner";
import {
  createPostgresDatabase,
  createS3FileStorage,
  createNoOpTracer,
} from "./dependencies";
import { onMessage } from "./my-handler";
import { myReceiveSchema, mySendSchema } from "./messages";
import { Topic } from "./types";

taskRunner(
  {
    name: "file-verifier",
    receiveTopics: [Topic.ImageUploaded],
    sendTopics: [Topic.ImageVerified],
    receivedMessageValidator: myReceiveSchema,
    sendMessageValidator: mySendSchema,
    onMessage,
  },
  {
    database: createPostgresDatabase(process.env["POSTGRES_CONNECTION"]!),
    fileStorage: createS3FileStorage(),
    tracer: createNoOpTracer(),
  },
);
```

### SDK

The `Context<SendMessage>` provides access to:

| Property      | Type          | Description                                |
| ------------- | ------------- | ------------------------------------------ |
| `logger`      | `Logger`      | A logger instance for structured logging   |
| `database`    | `Database`    | Database client for PostgreSQL connections |
| `fileStorage` | `FileStorage` | File storage client                        |
| `tracer`      | `Tracer`      | Distributed tracing                        |
| `emit()`      | Method        | Emit a message to a specified topic        |

## Project Structure

```typescript
typescript/
├── src
│   ├── dependencies.ts
│   ├── task-runner.ts
│   └── types.ts
├── samples
│   └── FileConverterRunner
│       ├── file-converter.ts
│       └── main.ts
```

## Development

To run a task runner:

```bash
bun run main.ts
```
