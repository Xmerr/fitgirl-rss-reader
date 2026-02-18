import { describe, expect, it, mock } from "bun:test";
import { NonRetryableError } from "@xmer/consumer-shared";
import type { IDlqHandler, ILogger } from "@xmer/consumer-shared";
import type { Channel } from "amqplib";
import type { ISteamRefreshService } from "../types/index.js";
import { SteamRefreshConsumer } from "./steam-refresh.consumer.js";

const mockLogger: ILogger = {
	debug: mock(() => {}),
	info: mock(() => {}),
	warn: mock(() => {}),
	error: mock(() => {}),
	child: mock(() => mockLogger),
};

describe("SteamRefreshConsumer", () => {
	describe("validation", () => {
		const createConsumer = () => {
			const mockChannel = {
				prefetch: mock(() => Promise.resolve()),
				assertExchange: mock(() => Promise.resolve({ exchange: "fitgirl" })),
				assertQueue: mock(() => Promise.resolve({ queue: "test" })),
				bindQueue: mock(() => Promise.resolve({})),
				consume: mock(() => Promise.resolve({ consumerTag: "test-tag" })),
				ack: mock(() => {}),
				nack: mock(() => {}),
				cancel: mock(() => Promise.resolve({})),
			};

			const mockDlqHandler = {
				setup: mock(() => Promise.resolve()),
				handleRetryableError: mock(() => Promise.resolve()),
				handleNonRetryableError: mock(() => Promise.resolve()),
			};

			const mockService = {
				handleRefresh: mock(() => Promise.resolve()),
			};

			return {
				consumer: new SteamRefreshConsumer({
					channel: mockChannel as unknown as Channel,
					exchange: "fitgirl",
					queue: "fitgirl.steam.refresh.rss-reader",
					routingKey: "steam.refresh",
					dlqHandler: mockDlqHandler as unknown as IDlqHandler,
					logger: mockLogger,
					steamRefreshService: mockService as unknown as ISteamRefreshService,
				}),
				mockService,
			};
		};

		it("should throw NonRetryableError for missing gameId", () => {
			// Arrange
			const { consumer } = createConsumer();
			const content = {
				correctedName: "Test Game",
				timestamp: "2024-01-01T00:00:00Z",
			};

			// Act & Assert
			// @ts-expect-error - accessing private method for testing
			expect(() => consumer.validateMessage(content)).toThrow(
				NonRetryableError,
			);
		});

		it("should throw NonRetryableError for non-number gameId", () => {
			// Arrange
			const { consumer } = createConsumer();
			const content = {
				gameId: "not-a-number",
				correctedName: "Test Game",
				timestamp: "2024-01-01T00:00:00Z",
			};

			// Act & Assert
			// @ts-expect-error - accessing private method for testing
			expect(() => consumer.validateMessage(content)).toThrow(
				NonRetryableError,
			);
		});

		it("should throw NonRetryableError for missing correctedName", () => {
			// Arrange
			const { consumer } = createConsumer();
			const content = {
				gameId: 1,
				timestamp: "2024-01-01T00:00:00Z",
			};

			// Act & Assert
			// @ts-expect-error - accessing private method for testing
			expect(() => consumer.validateMessage(content)).toThrow(
				NonRetryableError,
			);
		});

		it("should throw NonRetryableError for empty correctedName", () => {
			// Arrange
			const { consumer } = createConsumer();
			const content = {
				gameId: 1,
				correctedName: "",
				timestamp: "2024-01-01T00:00:00Z",
			};

			// Act & Assert
			// @ts-expect-error - accessing private method for testing
			expect(() => consumer.validateMessage(content)).toThrow(
				NonRetryableError,
			);
		});

		it("should throw NonRetryableError for missing timestamp", () => {
			// Arrange
			const { consumer } = createConsumer();
			const content = {
				gameId: 1,
				correctedName: "Test Game",
			};

			// Act & Assert
			// @ts-expect-error - accessing private method for testing
			expect(() => consumer.validateMessage(content)).toThrow(
				NonRetryableError,
			);
		});

		it("should accept valid message", () => {
			// Arrange
			const { consumer } = createConsumer();
			const content = {
				gameId: 42,
				correctedName: "Test Game",
				timestamp: "2024-01-01T00:00:00Z",
			};

			// Act
			// @ts-expect-error - accessing private method for testing
			const result = consumer.validateMessage(content);

			// Assert
			expect(result.gameId).toBe(42);
			expect(result.correctedName).toBe("Test Game");
			expect(result.timestamp).toBe("2024-01-01T00:00:00Z");
		});
	});
});
