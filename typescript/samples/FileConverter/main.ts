import { taskRunner } from "../../src/task-runner.js";
import {
  createLogger,
  createNoOpTracer,
  createPostgresDatabase,
  createS3FileStorage,
} from "../../src/dependencies.js";
import { onMessage } from "./file-converter.js";
import {
  fileverifiedmessageSchema,
  fileconvertedmessageSchema,
} from "../../src/messages.js";
import { Topic } from "../../src/types.js";

taskRunner(
  {
    name: "file-converter",
    receiveTopics: [Topic.FileVerified],
    sendTopics: [Topic.FileConverted],
    receivedMessageValidator: fileverifiedmessageSchema,
    sendMessageValidator: fileconvertedmessageSchema,
    onMessage,
  },
  {
    database: createPostgresDatabase(process.env["POSTGRES_CONNECTION"]!),
    fileStorage: createS3FileStorage(),
    tracer: createNoOpTracer(),
    logger: createLogger(),
  },
);
