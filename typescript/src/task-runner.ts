import { type Channel, type ConsumeMessage, connect } from "amqplib";
import type {
  Context,
  Dependencies,
  Logger,
  TaskRunner,
  TaskRunnerOptions,
  Topic,
} from "./types";

const setRunnerReady = async (isReady: boolean, logger: Logger) => {
  try {
    await Bun.write("/var/run/runner-ready", isReady ? "true" : "false");
    logger.debug(
      `Runner marked ${
        isReady ? "ready" : "not ready"
      } (written to /var/run/runner-ready)`,
    );
  } catch (e) {
    logger.error("Failed to write runner-ready file:", e);
  }
};

const createConsumerQueue = async (
  receiveTopic: string,
  consumerName: string,
  channel: Channel,
) => {
  const consumerQueue = `${receiveTopic}.${consumerName}`;
  const deadLetterName = `${consumerQueue}.dead-letter`;
  const queueArguments = {
    "x-queue-type": "quorum",
    "x-dead-letter-exchange": deadLetterName,
    "x-delivery-limit": 20,
  };

  await channel.assertExchange(deadLetterName, "direct", { durable: true });
  await channel.assertQueue(deadLetterName, { durable: true });
  await channel.bindQueue(deadLetterName, deadLetterName, "");

  await channel.assertExchange(receiveTopic, "fanout", { durable: true });
  await channel.assertQueue(consumerQueue, {
    durable: true,
    arguments: queueArguments,
  });
  await channel.bindQueue(consumerQueue, receiveTopic, "");

  return consumerQueue;
};

const stringify = <T>(set: Set<T>) => JSON.stringify(Array.from(set), null, 0);

export const taskRunner: TaskRunner = async <ReceiveMessage, SendMessage>(
  options: TaskRunnerOptions<ReceiveMessage, SendMessage>,
  dependencies: Dependencies,
) => {
  const logger = dependencies.logger;
  const tracer = dependencies.tracer;
  const database = dependencies.database;
  const fileStorage = dependencies.fileStorage;

  const messageQueueConnection = process.env["RABBIT_MQ_CONNECTION"] as string;

  try {
    const uniqueReceiveTopics = new Set(options.receiveTopics);
    const uniqueSendTopics = new Set(options.sendTopics);

    const connection = await connect(messageQueueConnection);

    connection.on("close", async () => {
      logger.warn("RabbitMQ connection closed, marking runner as not ready");
      await setRunnerReady(false, logger);
    });

    connection.on("error", async (err) => {
      logger.error("RabbitMQ connection error:", err);
      await setRunnerReady(false, logger);
    });

    const channel = await connection.createChannel();

    channel.on("close", async () => {
      logger.warn("RabbitMQ channel closed, marking runner as not ready");
      await setRunnerReady(false, logger);
    });

    channel.on("error", async (err) => {
      logger.error("RabbitMQ channel error:", err);
      await setRunnerReady(false, logger);
    });

    channel.prefetch(1);
    logger.info("Connected to RabbitMQ");

    const consumerQueues: string[] = [];
    const consumerTags: string[] = [];

    for (const receiveTopic of uniqueReceiveTopics) {
      const queue = await createConsumerQueue(
        receiveTopic,
        options.name,
        channel,
      );
      consumerQueues.push(queue);
    }

    for (const sendTopic of uniqueSendTopics) {
      await channel.assertExchange(sendTopic, "fanout", { durable: true });
    }

    const emit = async (message: SendMessage, topic: Topic): Promise<void> => {
      const headers: Record<string, unknown> = {};
      tracer.injectCurrentSpan(headers);

      const validatedMessage = options.sendMessageValidator.parse(message);

      if (!uniqueSendTopics.has(topic)) {
        throw new Error(
          `Topic '${topic}' is not in the configured send topics: ${stringify(
            uniqueSendTopics,
          )}`,
        );
      }

      logger.debug(`Emitting message to topic '${topic}'`);
      channel.publish(
        topic,
        "",
        Buffer.from(JSON.stringify(validatedMessage)),
        {
          headers,
          persistent: true,
        },
      );
    };

    const consumeMessages = async (
      consumerQueues: string[],
      channel: Channel,
      createContext: () => Context<SendMessage>,
      consumerTags: string[],
    ) => {
      for (const receiveQueue of consumerQueues) {
        const { consumerTag } = await channel.consume(
          receiveQueue,
          async (message: ConsumeMessage | null) => {
            if (message === null) {
              logger.error("Received null message");
              return;
            }

            logger.debug(`Received message on queue '${receiveQueue}'`);

            const scope = tracer.startConsumerSpan(
              "handleMessage",
              (message.properties.headers as Record<string, unknown>) ?? {},
            );

            try {
              const content = JSON.parse(message.content.toString());
              const validatedMessage =
                options.receivedMessageValidator.parse(content);

              await options.onMessage(validatedMessage, createContext());

              channel.ack(message);
            } catch (err) {
              scope.setError(
                err instanceof Error ? err : new Error(String(err)),
              );
              logger.error("Error processing message:", err);
              channel.nack(message, false, true);
            } finally {
              await scope.dispose();
            }
          },
        );
        consumerTags.push(consumerTag);
      }
    };

    const createContext = (): Context<SendMessage> => ({
      emit,
      database,
      fileStorage,
      tracer,
      logger,
    });

    await consumeMessages(consumerQueues, channel, createContext, consumerTags);

    const sendTopicName = stringify(uniqueSendTopics);
    const receiveTopicName = stringify(uniqueReceiveTopics);
    logger.info(
      `Consuming topics: ${receiveTopicName}. Emitting to: ${sendTopicName}`,
    );

    await setRunnerReady(true, logger);

    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting shutdown...`);
      await setRunnerReady(false, logger);

      for (const consumerTag of consumerTags) {
        try {
          await channel.cancel(consumerTag);
          logger.info(`Cancelled consumer: ${consumerTag}`);
        } catch (err) {
          logger.error(`Error cancelling consumer ${consumerTag}:`, err);
        }
      }

      try {
        await channel.close();
        logger.info("Closed RabbitMQ channel");
      } catch (err) {
        logger.error("Error closing channel:", err);
      }

      try {
        await connection.close();
        logger.info("Closed RabbitMQ connection");
      } catch (err) {
        logger.error("Error closing connection:", err);
      }

      logger.info("Shutdown complete");
      process.exit(0);
    };

    process.on("SIGTERM", () => void shutdown("SIGTERM"));
    process.on("SIGINT", () => void shutdown("SIGINT"));
  } catch (err) {
    logger.error("Fatal error:", err);
    process.exit(1);
  }
};
