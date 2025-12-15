using FileConverter.Generated;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Png;
using TaskRunner.Abstractions;
using AbstractTopic = TaskRunner.Abstractions.Topic;

namespace FileConverter;

public sealed class FileConverter : IMessageHandler<FileVerifiedMessage, FileConvertedMessage>
{
    public async Task HandleAsync(FileVerifiedMessage message, ITaskRunnerContext<FileConvertedMessage> context, CancellationToken ct)
    {
        var logger = context.Logger;

        logger.LogInformation("Processing image conversion for fileId: {FileId}", message.FileId);

        if (context.FileStorage is null)
        {
            throw new InvalidOperationException("File storage is not configured");
        }

        logger.LogDebug("Fetching image from {Bucket}/{Key}", message.BucketName, message.ObjectKey);
        var sourceStorageId = new StorageObjectId(message.BucketName, message.ObjectKey);
        await using var sourceStream = await context.FileStorage.OpenReadAsync(sourceStorageId, ct);

        logger.LogDebug("Converting image {FileId} to PNG", message.FileId);
        using var image = await Image.LoadAsync(sourceStream, ct);

        var pngStream = new MemoryStream();
        await image.SaveAsync(pngStream, new PngEncoder(), ct);
        pngStream.Position = 0;

        var pngSizeBytes = pngStream.Length;
        var pngFileName = Path.ChangeExtension(message.FileName, ".png");
        var pngObjectKey = Path.ChangeExtension(message.ObjectKey, ".png");

        logger.LogDebug("Uploading converted PNG to {Bucket}/{Key}", message.BucketName, pngObjectKey);
        var targetStorageId = new StorageObjectId(message.BucketName, pngObjectKey);
        await context.FileStorage.WriteAsync(targetStorageId, pngStream, contentType: "image/png", ct: ct);

        await context.Database.WithConnectionAsync(async (conn, token) =>
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "UPDATE images SET converted = true, converted_at = @ConvertedAt, converted_key = @ConvertedKey WHERE id = @Id";

            var idParam = cmd.CreateParameter();
            idParam.ParameterName = "@Id";
            idParam.Value = message.FileId;
            cmd.Parameters.Add(idParam);

            var convertedAtParam = cmd.CreateParameter();
            convertedAtParam.ParameterName = "@ConvertedAt";
            convertedAtParam.Value = DateTimeOffset.UtcNow;
            cmd.Parameters.Add(convertedAtParam);

            var convertedKeyParam = cmd.CreateParameter();
            convertedKeyParam.ParameterName = "@ConvertedKey";
            convertedKeyParam.Value = pngObjectKey;
            cmd.Parameters.Add(convertedKeyParam);

            await cmd.ExecuteNonQueryAsync(token);
        }, ct);

        logger.LogInformation("Image {FileId} converted and uploaded as PNG", message.FileId);

        var convertedMessage = new FileConvertedMessage(
            fileId: message.FileId,
            fileName: pngFileName,
            contentType: "image/png",
            bucketName: message.BucketName,
            objectKey: pngObjectKey,
            sizeBytes: pngSizeBytes,
            convertedAt: DateTimeOffset.UtcNow
        );

        await context.EmitAsync(convertedMessage, AbstractTopic.FileConverted, ct);
        logger.LogInformation("Emitted FileConverted message for {FileId}", message.FileId);
    }
}
