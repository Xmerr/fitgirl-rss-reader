import {
	ConnectionManager,
	DlqHandler,
	createLogger,
} from "@xmer/consumer-shared";
import { Redis } from "ioredis";
import { Config } from "./config/config.js";
import { ResetConsumer } from "./consumers/reset.consumer.js";
import { FitGirlPublisher } from "./publishers/fitgirl.publisher.js";
import { EnrichmentFailureTracker } from "./services/enrichment-failure-tracker.js";
import { ResetService } from "./services/reset.service.js";
import { RssPollerService } from "./services/rss-poller.service.js";
import { SteamService } from "./services/steam.service.js";
import { StateStore } from "./state/state-store.js";

async function main(): Promise<void> {
	const config = new Config();

	const logger = createLogger({
		job: "fitgirl-rss-reader",
		environment: process.env.NODE_ENV ?? "production",
		level: config.logLevel as "debug" | "info" | "warn" | "error",
		loki: config.lokiHost ? { host: config.lokiHost } : undefined,
	});

	logger.info("Starting fitgirl-rss-reader");

	// Connect to RabbitMQ
	const connectionManager = new ConnectionManager({
		url: config.rabbitmqUrl,
		logger,
	});
	await connectionManager.connect();
	const channel = connectionManager.getChannel();

	// Connect to Redis
	const redis = new Redis(config.redisUrl);
	const stateStore = new StateStore({ redis, logger });

	// Initialize services
	const rssPoller = new RssPollerService({
		feedUrl: config.rssFeedUrl,
		logger,
	});

	const steamService = new SteamService({
		timeoutMs: config.steamLookupTimeoutMs,
		logger,
	});

	const failureTracker = new EnrichmentFailureTracker({
		filePath: config.enrichmentFailuresPath,
		logger,
	});

	// Initialize publisher
	const publisher = new FitGirlPublisher({
		channel,
		exchange: config.exchangeName,
		logger,
		rssPoller,
		stateStore,
		steamService,
		failureTracker,
		intervalMs: config.pollIntervalMinutes * 60 * 1000,
	});

	// Assert exchanges and binding for notifications
	await channel.assertExchange(config.exchangeName, "topic", { durable: true });
	await channel.assertExchange("notifications", "topic", { durable: true });
	await channel.bindExchange(
		"notifications",
		config.exchangeName,
		"release.new",
	);
	logger.info("RabbitMQ topology asserted", {
		exchanges: [config.exchangeName, "notifications"],
		binding: `${config.exchangeName} -> notifications (release.new)`,
	});

	// Initialize reset service and consumer
	const resetService = new ResetService({
		stateStore,
		logger,
	});

	const resetDlqHandler = new DlqHandler({
		channel,
		exchange: config.exchangeName,
		queue: "fitgirl.reset.rss-reader",
		serviceName: "fitgirl-rss-reader",
		logger,
	});

	const resetConsumer = new ResetConsumer({
		channel,
		exchange: config.exchangeName,
		queue: "fitgirl.reset.rss-reader",
		routingKey: "reset",
		dlqHandler: resetDlqHandler,
		logger,
		resetService,
	});

	// Start reset consumer
	await resetConsumer.start();

	// Start polling
	publisher.startPolling();

	logger.info("fitgirl-rss-reader is running", {
		pollIntervalMinutes: config.pollIntervalMinutes,
		exchange: config.exchangeName,
	});

	// Graceful shutdown
	const shutdown = async (): Promise<void> => {
		logger.info("Shutting down...");

		publisher.stopPolling();
		await resetConsumer.stop();
		await new Promise((resolve) => setTimeout(resolve, 2000));
		await connectionManager.close();
		await stateStore.close();

		logger.info("Shutdown complete");
		process.exit(0);
	};

	process.on("SIGTERM", () => void shutdown());
	process.on("SIGINT", () => void shutdown());
}

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
