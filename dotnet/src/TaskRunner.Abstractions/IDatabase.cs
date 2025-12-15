using System.Data.Common;

namespace TaskRunner.Abstractions;

public interface IDatabase
{
    Task<TResult> WithConnectionAsync<TResult>(Func<DbConnection, CancellationToken, Task<TResult>> action, CancellationToken ct = default);

    Task WithConnectionAsync(Func<DbConnection, CancellationToken, Task> action, CancellationToken ct = default);
}
