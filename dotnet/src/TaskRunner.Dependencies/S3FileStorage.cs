using Amazon;
using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using TaskRunner.Abstractions;

namespace TaskRunner.Dependencies;

public sealed class S3FileStorage : IFileStorage, IAsyncDisposable
{
    private readonly AmazonS3Client _client;
    private readonly ILogger<S3FileStorage> _logger;

    public S3FileStorage(IConfiguration configuration, ILogger<S3FileStorage> logger)
    {
        _logger = logger;

        var region = configuration["AWS_REGION"];
        if (string.IsNullOrWhiteSpace(region))
        {
            throw new InvalidOperationException("AWS_REGION must be configured for S3FileStorage.");
        }

        var accessKey = configuration["AWS_ACCESS_KEY_ID"];
        var secretKey = configuration["AWS_SECRET_ACCESS_KEY"];

        var endpoint = configuration["S3_ENDPOINT"];

        var config = new AmazonS3Config
        {
            RegionEndpoint = RegionEndpoint.GetBySystemName(region),
        };

        if (!string.IsNullOrWhiteSpace(endpoint))
        {
            config.ServiceURL = endpoint;
            config.ForcePathStyle = configuration["AWS_PATH_STYLE"] == "path";
        }

        _client = new AmazonS3Client(accessKey, secretKey, config);
    }

    public async Task<Stream> OpenReadAsync(StorageObjectId id, CancellationToken ct = default)
    {
        var request = new GetObjectRequest
        {
            BucketName = id.Container,
            Key = id.Key
        };

        var response = await _client.GetObjectAsync(request, ct);
        return response.ResponseStream;
    }

    public async Task WriteAsync(
        StorageObjectId id,
        Stream content,
        string? contentType = null,
        CancellationToken ct = default)
    {
        var request = new PutObjectRequest
        {
            BucketName = id.Container,
            Key = id.Key,
            InputStream = content,
            ContentType = contentType
        };

        await _client.PutObjectAsync(request, ct);
    }

    public async Task DeleteAsync(StorageObjectId id, CancellationToken ct = default)
    {
        var request = new DeleteObjectRequest
        {
            BucketName = id.Container,
            Key = id.Key
        };

        await _client.DeleteObjectAsync(request, ct);
    }

    public ValueTask DisposeAsync()
    {
        _client.Dispose();
        return ValueTask.CompletedTask;
    }
}
