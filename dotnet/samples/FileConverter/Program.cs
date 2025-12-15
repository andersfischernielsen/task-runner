using FileConverter.Generated;
using TaskRunner.Dependencies;
using AbstractTopic = TaskRunner.Abstractions.Topic;

var builder = Host.CreateApplicationBuilder(args);
builder.AddRabbitMqTaskRunner<FileVerifiedMessage, FileConvertedMessage, FileConverter.FileConverter>(options =>
{
    options.Name = "file-converter";
    options.ReceiveTopics = new HashSet<AbstractTopic> { AbstractTopic.FileVerified };
    options.SendTopics = new HashSet<AbstractTopic> { AbstractTopic.FileConverted };
});

await builder.Build().RunAsync();
