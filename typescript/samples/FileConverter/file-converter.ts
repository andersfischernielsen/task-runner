import { Topic, type Context } from "../../src/types.js";
import type {
  FileVerifiedMessage,
  FileConvertedMessage,
} from "../../src/messages.js";
import sharp from "sharp";
export const onMessage = async (
  message: FileVerifiedMessage,
  { logger, database, fileStorage, emit }: Context<FileConvertedMessage>,
) => {
  logger.info(`Processing image conversion for fileId: ${message.fileId}`);

  if (!fileStorage) {
    throw new Error("File storage is not configured");
  }

  // Step 1: Fetch the image from FileStorage
  logger.debug(
    `Fetching image from ${message.bucketName}/${message.objectKey}`,
  );
  const sourceStream = await fileStorage.openRead({
    container: message.bucketName,
    key: message.objectKey,
  });

  logger.debug(`Converting image ${message.fileId} to PNG`);
  const chunks: Uint8Array[] = [];
  const reader = sourceStream.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const imageBuffer = Buffer.concat(chunks);
  const pngBuffer = await sharp(imageBuffer).png().toBuffer();

  const pngStream = new ReadableStream({
    start(controller) {
      controller.enqueue(pngBuffer);
      controller.close();
    },
  });

  const pngFileName = message.fileName.replace(/\.[^.]+$/, ".png");
  const pngObjectKey = message.objectKey.replace(/\.[^.]+$/, ".png");

  logger.debug(
    `Uploading converted PNG to ${message.bucketName}/${pngObjectKey}`,
  );
  await fileStorage.write(
    { container: message.bucketName, key: pngObjectKey },
    pngStream,
    "image/png",
  );

  await database.withConnection(async (conn) => {
    await conn`
      UPDATE images 
      SET converted = true, converted_at = NOW(), converted_key = ${pngObjectKey}
      WHERE id = ${message.fileId}
    `;
  });

  logger.info(`Image ${message.fileId} converted and uploaded as PNG`);

  const convertedMessage: FileConvertedMessage = {
    fileId: message.fileId,
    fileName: pngFileName,
    contentType: "image/png",
    bucketName: message.bucketName,
    objectKey: pngObjectKey,
    sizeBytes: pngBuffer.length,
    convertedAt: new Date().toISOString(),
  };

  await emit(convertedMessage, Topic.FileConverted);
  logger.info(`Emitted FileConverted message for ${message.fileId}`);
};
