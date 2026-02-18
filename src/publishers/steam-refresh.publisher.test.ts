import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { ILogger } from "@xmer/consumer-shared";
import type { Channel } from "amqplib";
import type { SteamData, SteamEnrichedMessage } from "../types/index.js";
import { SteamRefreshPublisher } from "./steam-refresh.publisher.js";

describe("SteamRefreshPublisher", () => {
	const mockLogger: ILogger = {
		debug: mock(() => {}),
		info: mock(() => {}),
		warn: mock(() => {}),
		error: mock(() => {}),
		child: mock(() => mockLogger),
	};

	let publisher: SteamRefreshPublisher;
	let mockChannel: {
		assertExchange: ReturnType<typeof mock>;
		publish: ReturnType<typeof mock>;
	};

	const sampleSteamData: SteamData = {
		app_id: 12345,
		name: "Test Game",
		steam_url: "https://store.steampowered.com/app/12345",
		media: { header_image: "https://cdn.steam.com/header.jpg" },
	};

	beforeEach(() => {
		mockChannel = {
			assertExchange: mock(() => Promise.resolve({})),
			publish: mock(() => true),
		};

		publisher = new SteamRefreshPublisher({
			channel: mockChannel as unknown as Channel,
			exchange: "fitgirl",
			logger: mockLogger,
		});
	});

	describe("publishEnriched", () => {
		it("should publish to steam.enriched routing key", async () => {
			// Arrange
			const message: SteamEnrichedMessage = {
				gameId: 42,
				steam: sampleSteamData,
				timestamp: "2024-01-01T00:00:00Z",
			};

			// Act
			await publisher.publishEnriched(message);

			// Assert
			expect(mockChannel.publish).toHaveBeenCalledTimes(1);
			const publishCall = mockChannel.publish.mock.calls[0];
			expect(publishCall[1]).toBe("steam.enriched");
		});

		it("should publish correct payload with steam data", async () => {
			// Arrange
			const message: SteamEnrichedMessage = {
				gameId: 42,
				steam: sampleSteamData,
				timestamp: "2024-01-01T00:00:00Z",
			};

			// Act
			await publisher.publishEnriched(message);

			// Assert
			const publishCall = mockChannel.publish.mock.calls[0];
			const payload = JSON.parse(publishCall[2].toString());
			expect(payload.gameId).toBe(42);
			expect(payload.steam.app_id).toBe(12345);
			expect(payload.timestamp).toBe("2024-01-01T00:00:00Z");
		});

		it("should publish payload with null steam when not found", async () => {
			// Arrange
			const message: SteamEnrichedMessage = {
				gameId: 42,
				steam: null,
				timestamp: "2024-01-01T00:00:00Z",
			};

			// Act
			await publisher.publishEnriched(message);

			// Assert
			const publishCall = mockChannel.publish.mock.calls[0];
			const payload = JSON.parse(publishCall[2].toString());
			expect(payload.gameId).toBe(42);
			expect(payload.steam).toBeNull();
		});
	});
});
