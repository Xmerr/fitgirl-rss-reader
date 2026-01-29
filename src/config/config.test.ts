import { beforeEach, describe, expect, it } from "bun:test";
import { Config } from "./config.js";

describe("Config", () => {
	const validEnv = {
		RABBITMQ_URL: "amqp://localhost:5672",
		REDIS_URL: "redis://localhost:6379",
	};

	describe("required variables", () => {
		it("should throw when RABBITMQ_URL is missing", () => {
			// Arrange
			const env = { REDIS_URL: "redis://localhost:6379" };

			// Act & Assert
			expect(() => new Config(env)).toThrow("RABBITMQ_URL is required");
		});

		it("should throw when REDIS_URL is missing", () => {
			// Arrange
			const env = { RABBITMQ_URL: "amqp://localhost:5672" };

			// Act & Assert
			expect(() => new Config(env)).toThrow("REDIS_URL is required");
		});

		it("should parse required variables correctly", () => {
			// Arrange & Act
			const config = new Config(validEnv);

			// Assert
			expect(config.rabbitmqUrl).toBe("amqp://localhost:5672");
			expect(config.redisUrl).toBe("redis://localhost:6379");
		});
	});

	describe("optional variables with defaults", () => {
		it("should use default values when not provided", () => {
			// Arrange & Act
			const config = new Config(validEnv);

			// Assert
			expect(config.pollIntervalMinutes).toBe(15);
			expect(config.rssFeedUrl).toBe("https://fitgirl-repacks.site/feed/");
			expect(config.exchangeName).toBe("fitgirl");
			expect(config.steamLookupTimeoutMs).toBe(5000);
			expect(config.enrichmentFailuresPath).toBe(
				"/app/data/enrichment-failures.jsonl",
			);
			expect(config.logLevel).toBe("info");
			expect(config.lokiHost).toBeUndefined();
		});

		it("should parse custom values when provided", () => {
			// Arrange
			const env = {
				...validEnv,
				POLL_INTERVAL_MINUTES: "30",
				RSS_FEED_URL: "https://custom.feed/rss",
				EXCHANGE_NAME: "custom-exchange",
				STEAM_LOOKUP_TIMEOUT_MS: "10000",
				ENRICHMENT_FAILURES_PATH: "/custom/path.jsonl",
				LOKI_HOST: "http://loki:3100",
				LOG_LEVEL: "debug",
			};

			// Act
			const config = new Config(env);

			// Assert
			expect(config.pollIntervalMinutes).toBe(30);
			expect(config.rssFeedUrl).toBe("https://custom.feed/rss");
			expect(config.exchangeName).toBe("custom-exchange");
			expect(config.steamLookupTimeoutMs).toBe(10000);
			expect(config.enrichmentFailuresPath).toBe("/custom/path.jsonl");
			expect(config.lokiHost).toBe("http://loki:3100");
			expect(config.logLevel).toBe("debug");
		});
	});

	describe("parsePositiveInt", () => {
		it("should return default for invalid numeric strings", () => {
			// Arrange
			const env = {
				...validEnv,
				POLL_INTERVAL_MINUTES: "invalid",
			};

			// Act
			const config = new Config(env);

			// Assert
			expect(config.pollIntervalMinutes).toBe(15);
		});

		it("should return default for zero", () => {
			// Arrange
			const env = {
				...validEnv,
				POLL_INTERVAL_MINUTES: "0",
			};

			// Act
			const config = new Config(env);

			// Assert
			expect(config.pollIntervalMinutes).toBe(15);
		});

		it("should return default for negative numbers", () => {
			// Arrange
			const env = {
				...validEnv,
				POLL_INTERVAL_MINUTES: "-5",
			};

			// Act
			const config = new Config(env);

			// Assert
			expect(config.pollIntervalMinutes).toBe(15);
		});

		it("should return default for empty string", () => {
			// Arrange
			const env = {
				...validEnv,
				POLL_INTERVAL_MINUTES: "",
			};

			// Act
			const config = new Config(env);

			// Assert
			expect(config.pollIntervalMinutes).toBe(15);
		});
	});
});
