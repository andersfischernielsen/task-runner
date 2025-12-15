using TaskRunner.Abstractions;

namespace TaskRunner.Dependencies;

public sealed class NoOpTracer : ITracer
{
    private sealed class NoOpScope : ITraceScope
    {
        public void SetTag(string key, object? value) { }

        public void SetError(Exception exception) { }

        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
    }

    public ITraceScope StartSpan(string name) => new NoOpScope();

    public ITraceScope StartConsumerSpan(string name, IReadOnlyDictionary<string, object?> incomingHeaders) => new NoOpScope();

    public void InjectCurrentSpan(IDictionary<string, object?> headers) { }
}
