using System.Data.Common;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;
using TaskRunner.Abstractions;

namespace TaskRunner.Dependencies;

public sealed class PostgresDatabase : IDatabase, IAsyncDisposable
{
    private readonly NpgsqlDataSource _dataSource;

    public PostgresDatabase(string connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new ArgumentException("Connection string must be provided.", nameof(connectionString));
        }

        _dataSource = NpgsqlDataSource.Create(connectionString);
    }

    public async Task<TResult> WithConnectionAsync<TResult>(
        Func<DbConnection, CancellationToken, Task<TResult>> action,
        CancellationToken ct = default)
    {
        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        return await action(conn, ct);
    }

    public async Task WithConnectionAsync(
        Func<DbConnection, CancellationToken, Task> action,
        CancellationToken ct = default)
    {
        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await action(conn, ct);
    }

    public async ValueTask DisposeAsync()
    {
        await _dataSource.DisposeAsync();
    }
}
