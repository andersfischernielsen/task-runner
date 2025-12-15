using FileVerifier.Generated;
using TaskRunner.Abstractions;
using AbstractTopic = TaskRunner.Abstractions.Topic;

namespace FileVerifier;

public sealed class FileVerifier : IMessageHandler<FileUploadedMessage, FileVerifiedMessage>
{
    public async Task HandleAsync(FileUploadedMessage message, ITaskRunnerContext<FileVerifiedMessage> context, CancellationToken ct)
    {
        var logger = context.Logger;

        logger.LogInformation("Processing file verification for fileId: {FileId}", message.FileId);

        var imageExists = await context.Database.WithConnectionAsync(async (conn, token) =>
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT COUNT(*) FROM images WHERE id = @Id";

            var idParam = cmd.CreateParameter();
            idParam.ParameterName = "@Id";
            idParam.Value = message.FileId;
            cmd.Parameters.Add(idParam);

            var result = await cmd.ExecuteScalarAsync(token);
            return Convert.ToInt32(result) > 0;
        }, ct);

        if (!imageExists)
        {
            logger.LogError("Image with id {FileId} not found in database", message.FileId);
            throw new InvalidOperationException($"Image not found in database: {message.FileId}");
        }

        logger.LogDebug("Image {FileId} found in database", message.FileId);

        if (context.FileStorage is null)
        {
            throw new InvalidOperationException("File storage is not configured");
        }

        try
        {
            var storageId = new StorageObjectId(message.BucketName, message.ObjectKey);
            await using var stream = await context.FileStorage.OpenReadAsync(storageId, ct);
            logger.LogDebug("Image {FileId} exists in storage at {Bucket}/{Key}",
                message.FileId, message.BucketName, message.ObjectKey);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Image {FileId} not found in storage: {Bucket}/{Key}",
                message.FileId, message.BucketName, message.ObjectKey);
            throw new InvalidOperationException($"Image not found in storage: {message.ObjectKey}", ex);
        }

        await context.Database.WithConnectionAsync(async (conn, token) =>
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "UPDATE images SET verified = true, verified_at = @VerifiedAt WHERE id = @Id";

            var idParam = cmd.CreateParameter();
            idParam.ParameterName = "@Id";
            idParam.Value = message.FileId;
            cmd.Parameters.Add(idParam);

            var verifiedAtParam = cmd.CreateParameter();
            verifiedAtParam.ParameterName = "@VerifiedAt";
            verifiedAtParam.Value = DateTimeOffset.UtcNow;
            cmd.Parameters.Add(verifiedAtParam);

            await cmd.ExecuteNonQueryAsync(token);
        }, ct);

        logger.LogInformation("Image {FileId} marked as verified in database", message.FileId);

        var verifiedMessage = new FileVerifiedMessage(
            fileId: message.FileId,
            fileName: message.FileName,
            contentType: message.ContentType,
            bucketName: message.BucketName,
            objectKey: message.ObjectKey,
            sizeBytes: message.SizeBytes,
            uploadedAt: message.UploadedAt
        );

        await context.EmitAsync(verifiedMessage, AbstractTopic.FileVerified, ct);
        logger.LogInformation("Emitted FileVerified message for {FileId}", message.FileId);
    }
}
