import { taskRunner } from "../../src/task-runner";
import {
  createLogger,
  createNoOpTracer,
  createPostgresDatabase,
  createS3FileStorage,
} from "../../src/dependencies";
import { onMessage } from "./file-verifier";
import {
  fileuploadedmessageSchema,
  fileverifiedmessageSchema,
} from "../../src/messages";
import { Topic } from "../../src/types";

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
