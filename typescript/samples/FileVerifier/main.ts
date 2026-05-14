import { taskRunner } from "../../src/task-runner.js";
import {
  createLogger,
  createNoOpTracer,
  createPostgresDatabase,
  createS3FileStorage,
} from "../../src/dependencies.js";
import { onMessage } from "./file-verifier.js";
import {
  fileuploadedmessageSchema,
  fileverifiedmessageSchema,
} from "../../src/messages.js";
import { Topic } from "../../src/types.js";

taskRunner(
  {
    name: "file-verifier",
    receiveTopics: [Topic.FileUploaded],
    sendTopics: [Topic.FileVerified],
    receivedMessageValidator: fileuploadedmessageSchema,
    sendMessageValidator: fileverifiedmessageSchema,
    onMessage,
  },
  {
    database: createPostgresDatabase(process.env["POSTGRES_CONNECTION"]!),
    fileStorage: createS3FileStorage(),
    tracer: createNoOpTracer(),
    logger: createLogger(),
  },
);
