import { taskRunner } from "../../src/task-runner";
import {
  createLogger,
  createNoOpTracer,
  createPostgresDatabase,
  createS3FileStorage,
} from "../../src/dependencies";
import { onMessage } from "./file-converter";
import {
  fileverifiedmessageSchema,
  fileconvertedmessageSchema,
} from "../../src/messages";
import { Topic } from "../../src/types";

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
