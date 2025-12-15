import type { SQL } from "bun";
import type { ZodSchema } from "zod";

export enum Topic {
  FileUploaded = "FileUploaded",
  FileVerified = "FileVerified",
  FileConverted = "FileConverted",
}

export type StorageObjectId = {
  container: string;
  key: string;
};

export interface FileStorage {
  openRead: (id: StorageObjectId) => Promise<ReadableStream>;
  write: (
    id: StorageObjectId,
    content: ReadableStream,
    contentType?: string,
  ) => Promise<void>;
  delete: (id: StorageObjectId) => Promise<void>;
}

export interface Database {
  withConnection: <T>(action: (connection: SQL) => Promise<T>) => Promise<T>;
}

export interface TraceScope {
  setTag: (key: string, value: unknown) => void;
  setError: (error: Error) => void;
  dispose: () => Promise<void>;
}

export interface Tracer {
  startSpan: (name: string) => TraceScope;
  startConsumerSpan: (
    name: string,
    incomingHeaders: Record<string, unknown>,
  ) => TraceScope;
  injectCurrentSpan: (headers: Record<string, unknown>) => void;
}

export interface Logger {
  info: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
}

export type Context<TSend> = {
  emit: (message: TSend, topic: Topic) => Promise<void>;
  database: Database;
  fileStorage?: FileStorage;
  tracer: Tracer;
  logger: Logger;
};

export type MessageHandler<TReceive, TSend> = (
  message: TReceive,
  context: Context<TSend>,
) => Promise<void>;

export interface TaskRunnerOptions<TReceive, TSend> {
  name: string;
  receiveTopics: Topic[];
  sendTopics: Topic[];
  receivedMessageValidator: ZodSchema<TReceive>;
  sendMessageValidator: ZodSchema<TSend>;
  onMessage: MessageHandler<TReceive, TSend>;
}

export interface Dependencies {
  database: Database;
  fileStorage: FileStorage;
  tracer: Tracer;
  logger: Logger;
}

export type TaskRunner = <ReceiveMessage, SendMessage>(
  options: TaskRunnerOptions<ReceiveMessage, SendMessage>,
  dependencies: Dependencies,
) => Promise<void>;
