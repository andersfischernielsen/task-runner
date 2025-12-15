using FileVerifier.Generated;
using TaskRunner.Dependencies;
using AbstractTopic = TaskRunner.Abstractions.Topic;

var builder = Host.CreateApplicationBuilder(args);
builder.AddRabbitMqTaskRunner<FileUploadedMessage, FileVerifiedMessage, FileVerifier.FileVerifier>(options =>
{
    options.Name = "file-verifier";
    options.ReceiveTopics = new HashSet<AbstractTopic> { AbstractTopic.FileUploaded };
    options.SendTopics = new HashSet<AbstractTopic> { AbstractTopic.FileVerified };
});

await builder.Build().RunAsync();
