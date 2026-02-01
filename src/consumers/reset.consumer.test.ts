import { beforeEach, describe, expect, it, mock } from "bun:test";
import { NonRetryableError } from "@xmer/consumer-shared";
import type { ILogger } from "@xmer/consumer-shared";
import type { ConsumeMessage } from "amqplib";
import type { IResetService } from "../types/index.js";
import { ResetConsumer } from "./reset.consumer.js";

describe("ResetConsumer", () => {
	const mockLogger: ILogger = {
		debug: mock(() => {}),
		info: mock(() => {}),
		warn: mock(() => {}),
		error: mock(() => {}),
		child: mock(() => mockLogger),
	};

	let consumer: ResetConsumer;
	let mockResetService: {
		handleReset: ReturnType<typeof mock>;
	};
	let mockChannel: {
		assertExchange: ReturnType<typeof mock>;
		assertQueue: ReturnType<typeof mock>;
		bindQueue: ReturnType<typeof mock>;
		consume: ReturnType<typeof mock>;
		ack: ReturnType<typeof mock>;
		nack: ReturnType<typeof mock>;
		prefetch: ReturnType<typeof mock>;
	};
	let mockDlqHandler: {
		setup: ReturnType<typeof mock>;
		handleFailure: ReturnType<typeof mock>;
	};

	beforeEach(() => {
		mockResetService = {
			handleReset: mock(() => Promise.resolve()),
		};

		mockChannel = {
			assertExchange: mock(() => Promise.resolve()),
			assertQueue: mock(() => Promise.resolve({ queue: "test-queue" })),
			bindQueue: mock(() => Promise.resolve()),
			consume: mock(() => Promise.resolve({ consumerTag: "test-tag" })),
			ack: mock(() => {}),
			nack: mock(() => {}),
			prefetch: mock(() => Promise.resolve()),
		};

		mockDlqHandler = {
			setup: mock(() => Promise.resolve()),
			handleFailure: mock(() => Promise.resolve()),
		};

		consumer = new ResetConsumer({
			channel: mockChannel as never,
			exchange: "fitgirl",
			queue: "fitgirl.reset.rss-reader",
			routingKey: "reset",
			dlqHandler: mockDlqHandler as never,
			logger: mockLogger,
			resetService: mockResetService as unknown as IResetService,
		});
	});

	describe("processMessage", () => {
		const mockMessage = {
			content: Buffer.from("{}"),
			fields: { deliveryTag: 1 },
			properties: { headers: {} },
		} as unknown as ConsumeMessage;

		it("should call resetService.handleReset with valid message", async () => {
			// Arrange
			const content = {
				source: "test",
				timestamp: "2024-01-01T00:00:00Z",
			};

			// Act
			await (
				consumer as unknown as {
					processMessage: (
						content: Record<string, unknown>,
						message: ConsumeMessage,
					) => Promise<void>;
				}
			).processMessage(content, mockMessage);

			// Assert
			expect(mockResetService.handleReset).toHaveBeenCalledWith(content);
		});

		it("should handle message with optional target field", async () => {
			// Arrange
			const content = {
				source: "admin",
				timestamp: "2024-01-01T00:00:00Z",
				target: "rss-reader",
			};

			// Act
			await (
				consumer as unknown as {
					processMessage: (
						content: Record<string, unknown>,
						message: ConsumeMessage,
					) => Promise<void>;
				}
			).processMessage(content, mockMessage);

			// Assert
			expect(mockResetService.handleReset).toHaveBeenCalledWith(content);
		});

		it("should handle message with optional reason field", async () => {
			// Arrange
			const content = {
				source: "admin",
				timestamp: "2024-01-01T00:00:00Z",
				reason: "Manual reset for testing",
			};

			// Act
			await (
				consumer as unknown as {
					processMessage: (
						content: Record<string, unknown>,
						message: ConsumeMessage,
					) => Promise<void>;
				}
			).processMessage(content, mockMessage);

			// Assert
			expect(mockResetService.handleReset).toHaveBeenCalledWith(content);
		});

		it("should throw NonRetryableError for missing source", async () => {
			// Arrange
			const content = {
				timestamp: "2024-01-01T00:00:00Z",
			};

			// Act & Assert
			try {
				await (
					consumer as unknown as {
						processMessage: (
							content: Record<string, unknown>,
							message: ConsumeMessage,
						) => Promise<void>;
					}
				).processMessage(content, mockMessage);
				expect(true).toBe(false); // Should not reach here
			} catch (error) {
				expect(error).toBeInstanceOf(NonRetryableError);
			}
		});

		it("should throw NonRetryableError for missing timestamp", async () => {
			// Arrange
			const content = {
				source: "test",
			};

			// Act & Assert
			try {
				await (
					consumer as unknown as {
						processMessage: (
							content: Record<string, unknown>,
							message: ConsumeMessage,
						) => Promise<void>;
					}
				).processMessage(content, mockMessage);
				expect(true).toBe(false); // Should not reach here
			} catch (error) {
				expect(error).toBeInstanceOf(NonRetryableError);
			}
		});

		it("should throw NonRetryableError for invalid target", async () => {
			// Arrange
			const content = {
				source: "test",
				timestamp: "2024-01-01T00:00:00Z",
				target: "invalid-target",
			};

			// Act & Assert
			try {
				await (
					consumer as unknown as {
						processMessage: (
							content: Record<string, unknown>,
							message: ConsumeMessage,
						) => Promise<void>;
					}
				).processMessage(content, mockMessage);
				expect(true).toBe(false); // Should not reach here
			} catch (error) {
				expect(error).toBeInstanceOf(NonRetryableError);
			}
		});

		it("should throw NonRetryableError for invalid reason type", async () => {
			// Arrange
			const content = {
				source: "test",
				timestamp: "2024-01-01T00:00:00Z",
				reason: 123, // Should be string
			};

			// Act & Assert
			try {
				await (
					consumer as unknown as {
						processMessage: (
							content: Record<string, unknown>,
							message: ConsumeMessage,
						) => Promise<void>;
					}
				).processMessage(content, mockMessage);
				expect(true).toBe(false); // Should not reach here
			} catch (error) {
				expect(error).toBeInstanceOf(NonRetryableError);
			}
		});
	});
});
