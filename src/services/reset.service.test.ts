import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { ILogger } from "@xmer/consumer-shared";
import type { IStateStore, ResetMessage } from "../types/index.js";
import { ResetService } from "./reset.service.js";

describe("ResetService", () => {
	const mockLogger: ILogger = {
		debug: mock(() => {}),
		info: mock(() => {}),
		warn: mock(() => {}),
		error: mock(() => {}),
		child: mock(() => mockLogger),
	};

	let resetService: ResetService;
	let mockStateStore: {
		clear: ReturnType<typeof mock>;
		isNew: ReturnType<typeof mock>;
		markSeen: ReturnType<typeof mock>;
		close: ReturnType<typeof mock>;
	};

	beforeEach(() => {
		mockStateStore = {
			clear: mock(() => Promise.resolve(10)),
			isNew: mock(() => Promise.resolve(true)),
			markSeen: mock(() => Promise.resolve()),
			close: mock(() => Promise.resolve()),
		};

		resetService = new ResetService({
			stateStore: mockStateStore as unknown as IStateStore,
			logger: mockLogger,
		});
	});

	describe("handleReset", () => {
		it("should clear state store when target is undefined", async () => {
			// Arrange
			const message: ResetMessage = {
				source: "test",
				timestamp: new Date().toISOString(),
			};

			// Act
			await resetService.handleReset(message);

			// Assert
			expect(mockStateStore.clear).toHaveBeenCalled();
		});

		it("should clear state store when target is 'all'", async () => {
			// Arrange
			const message: ResetMessage = {
				source: "test",
				timestamp: new Date().toISOString(),
				target: "all",
			};

			// Act
			await resetService.handleReset(message);

			// Assert
			expect(mockStateStore.clear).toHaveBeenCalled();
		});

		it("should clear state store when target is 'rss-reader'", async () => {
			// Arrange
			const message: ResetMessage = {
				source: "test",
				timestamp: new Date().toISOString(),
				target: "rss-reader",
			};

			// Act
			await resetService.handleReset(message);

			// Assert
			expect(mockStateStore.clear).toHaveBeenCalled();
		});

		it("should skip when target is 'discord-notifier'", async () => {
			// Arrange
			const message: ResetMessage = {
				source: "test",
				timestamp: new Date().toISOString(),
				target: "discord-notifier",
			};

			// Act
			await resetService.handleReset(message);

			// Assert
			expect(mockStateStore.clear).not.toHaveBeenCalled();
		});

		it("should log the reset operation with reason", async () => {
			// Arrange
			const message: ResetMessage = {
				source: "admin",
				timestamp: new Date().toISOString(),
				reason: "Testing reset functionality",
			};

			// Act
			await resetService.handleReset(message);

			// Assert
			expect(mockLogger.info).toHaveBeenCalled();
		});
	});
});
