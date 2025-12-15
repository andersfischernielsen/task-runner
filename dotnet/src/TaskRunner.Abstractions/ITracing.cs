namespace TaskRunner.Abstractions;

public interface ITraceScope : IAsyncDisposable
{
    void SetTag(string key, object? value);
    void SetError(Exception exception);
}

public interface ITracer
{
    ITraceScope StartSpan(string name);

    ITraceScope StartConsumerSpan(string name, IReadOnlyDictionary<string, object?> incomingHeaders);

    void InjectCurrentSpan(IDictionary<string, object?> headers);
}
