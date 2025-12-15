import winston, { createLogger as createWinstonLogger } from "winston";
import { Console } from "winston/lib/winston/transports";
import { S3Client, SQL } from "bun";
import type {
  Database,
  FileStorage,
  Logger,
  StorageObjectId,
  Tracer,
  TraceScope,
} from "./types";

const noOpScope: TraceScope = {
  setTag: () => {},
  setError: () => {},
  dispose: async () => {},
};

export const createNoOpTracer = (): Tracer => ({
  startSpan: () => noOpScope,
  startConsumerSpan: () => noOpScope,
  injectCurrentSpan: () => {},
});

export const createS3FileStorage = (): FileStorage => {
  const client = new S3Client({
    region: process.env["AWS_REGION"] as string,
    endpoint: process.env["S3_ENDPOINT"],
    accessKeyId: process.env["AWS_ACCESS_KEY_ID"] as string,
    secretAccessKey: process.env["AWS_SECRET_ACCESS_KEY"] as string,
    virtualHostedStyle: process.env["AWS_PATH_STYLE"] !== "path",
  });

  const getKey = (id: StorageObjectId) => `${id.container}/${id.key}`;

  return {
    openRead: async (id: StorageObjectId): Promise<ReadableStream> => {
      const buffer = await client.file(getKey(id)).arrayBuffer();
      return new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(buffer));
          controller.close();
        },
      });
    },
    write: async (
      id: StorageObjectId,
      content: ReadableStream,
      _contentType?: string,
    ): Promise<void> => {
      const chunks: Uint8Array[] = [];
      const reader = content.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const buffer = new Uint8Array(
        chunks.reduce((acc, chunk) => acc + chunk.length, 0),
      );
      let offset = 0;
      for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.length;
      }
      await client.write(getKey(id), buffer);
    },
    delete: async (id: StorageObjectId): Promise<void> => {
      await client.delete(getKey(id));
    },
  };
};

export const createPostgresDatabase = (connectionString: string): Database => {
  const sql = new SQL(connectionString, { max: 2 });

  return {
    withConnection: async <T>(
      action: (connection: SQL) => Promise<T>,
    ): Promise<T> => {
      return action(sql);
    },
  };
};

export const createLogger = (): Logger => {
  const winstonLogger = createWinstonLogger({
    transports: [new Console()],
    format: winston.format.combine(
      winston.format.errors({ stack: true }),
      winston.format.json(),
    ),
    level: process.env["LOG_LEVEL"] ?? "info",
  });

  return {
    info: (message, ...args) => winstonLogger.info(message, ...args),
    error: (message, ...args) => winstonLogger.error(message, ...args),
    debug: (message, ...args) => winstonLogger.debug(message, ...args),
    warn: (message, ...args) => winstonLogger.warn(message, ...args),
  };
};
