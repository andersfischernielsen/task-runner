import { Topic, type Context } from "../../src/types";
import type {
  FileUploadedMessage,
  FileVerifiedMessage,
} from "../../src/messages";

export const onMessage = async (
  message: FileUploadedMessage,
  { logger, database, fileStorage, emit }: Context<FileVerifiedMessage>,
) => {
  logger.info(`Processing file verification for fileId: ${message.fileId}`);

  const imageExists = await database.withConnection(async (conn) => {
    const result = await conn`
      SELECT id FROM images WHERE id = ${message.fileId}
    `;
    return result.length > 0;
  });

  if (!imageExists) {
    logger.error(`Image with id ${message.fileId} not found in database`);
    throw new Error(`Image not found in database: ${message.fileId}`);
  }

  logger.debug(`Image ${message.fileId} found in database`);

  if (!fileStorage) {
    throw new Error("File storage is not configured");
  }

  try {
    const stream = await fileStorage.openRead({
      container: message.bucketName,
      key: message.objectKey,
    });
    await stream.cancel();
    logger.debug(
      `Image ${message.fileId} exists in storage at ${message.bucketName}/${message.objectKey}`,
    );
  } catch (error) {
    logger.error(
      `Image ${message.fileId} not found in storage: ${message.bucketName}/${message.objectKey}`,
    );
    throw new Error(`Image not found in storage: ${message.objectKey}`);
  }

  await database.withConnection(async (conn) => {
    await conn`
      UPDATE images 
      SET verified = true, verified_at = NOW()
      WHERE id = ${message.fileId}
    `;
  });

  logger.info(`Image ${message.fileId} marked as verified in database`);

  const verifiedMessage: FileVerifiedMessage = {
    fileId: message.fileId,
    fileName: message.fileName,
    contentType: message.contentType,
    bucketName: message.bucketName,
    objectKey: message.objectKey,
    sizeBytes: message.sizeBytes,
    uploadedAt: message.uploadedAt,
  };

  await emit(verifiedMessage, Topic.FileVerified);
  logger.info(`Emitted FileVerified message for ${message.fileId}`);
};
