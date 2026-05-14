import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import postgres from "postgres";
import winston from "winston";
import type {
  Database,
  FileStorage,
  Logger,
  StorageObjectId,
  Tracer,
  TraceScope,
} from "./types.js";

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
    credentials: {
      accessKeyId: process.env["AWS_ACCESS_KEY_ID"] as string,
      secretAccessKey: process.env["AWS_SECRET_ACCESS_KEY"] as string,
    },
    forcePathStyle: process.env["AWS_PATH_STYLE"] === "path",
  });

  const getKey = (id: StorageObjectId) => `${id.container}/${id.key}`;

  return {
    openRead: async (id: StorageObjectId): Promise<ReadableStream> => {
      const command = new GetObjectCommand({
        Bucket: id.container,
        Key: id.key,
      });
      const response = await client.send(command);
      const body = response.Body as ReadableStream | undefined;
      if (!body) {
        throw new Error(`Empty response body for ${getKey(id)}`);
      }
      return body;
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
      const command = new PutObjectCommand({
        Bucket: id.container,
        Key: id.key,
        Body: buffer,
        ContentType: _contentType,
      });
      await client.send(command);
    },
    delete: async (id: StorageObjectId): Promise<void> => {
      const command = new DeleteObjectCommand({
        Bucket: id.container,
        Key: id.key,
      });
      await client.send(command);
    },
  };
};

export const createPostgresDatabase = (connectionString: string): Database => {
  const sql = postgres(connectionString, { max: 2 });

  return {
    withConnection: async <T>(
      action: (connection: ReturnType<typeof postgres>) => Promise<T>,
    ): Promise<T> => {
      return action(sql);
    },
  };
};

export const createLogger = (): Logger => {
  const winstonLogger = winston.createLogger({
    transports: [new winston.transports.Console()],
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
