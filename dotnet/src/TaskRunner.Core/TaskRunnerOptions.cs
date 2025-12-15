using TaskRunner.Abstractions;

namespace TaskRunner.Core;

public sealed class TaskRunnerOptions<TReceive, TSend>
{
    public string Name { get; set; } = string.Empty;

    public ISet<Topic> ReceiveTopics { get; set; } = new HashSet<Topic>();

    public ISet<Topic> SendTopics { get; set; } = new HashSet<Topic>();
}
