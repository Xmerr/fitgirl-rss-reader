import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { ILogger } from "@xmer/consumer-shared";
import type {
	ISteamRefreshPublisher,
	ISteamService,
	SteamData,
	SteamRefreshMessage,
} from "../types/index.js";
import { SteamRefreshService } from "./steam-refresh.service.js";

describe("SteamRefreshService", () => {
	const mockLogger: ILogger = {
		debug: mock(() => {}),
		info: mock(() => {}),
		warn: mock(() => {}),
		error: mock(() => {}),
		child: mock(() => mockLogger),
	};

	let service: SteamRefreshService;
	let mockSteamService: { lookupGame: ReturnType<typeof mock> };
	let mockPublisher: { publishEnriched: ReturnType<typeof mock> };

	const sampleSteamData: SteamData = {
		app_id: 12345,
		name: "Test Game",
		steam_url: "https://store.steampowered.com/app/12345",
		release_date: "Jan 1, 2024",
		price: "$29.99",
		ratings: {
			total_positive: 1000,
			total_negative: 100,
			review_score_desc: "Very Positive",
		},
		categories: ["Single-player"],
		media: {
			header_image: "https://cdn.steam.com/header.jpg",
		},
	};

	beforeEach(() => {
		mockSteamService = {
			lookupGame: mock(() => Promise.resolve(sampleSteamData)),
		};

		mockPublisher = {
			publishEnriched: mock(() => Promise.resolve()),
		};

		service = new SteamRefreshService({
			steamService: mockSteamService as unknown as ISteamService,
			publisher: mockPublisher as unknown as ISteamRefreshPublisher,
			logger: mockLogger,
		});
	});

	describe("handleRefresh", () => {
		it("should look up game and publish enriched message", async () => {
			// Arrange
			const message: SteamRefreshMessage = {
				gameId: 42,
				correctedName: "Test Game",
				timestamp: "2024-01-01T00:00:00Z",
			};

			// Act
			await service.handleRefresh(message);

			// Assert
			expect(mockSteamService.lookupGame).toHaveBeenCalledWith("Test Game");
			expect(mockPublisher.publishEnriched).toHaveBeenCalledTimes(1);

			const publishCall = mockPublisher.publishEnriched.mock.calls[0];
			expect(publishCall[0].gameId).toBe(42);
			expect(publishCall[0].steam).toEqual(sampleSteamData);
			expect(typeof publishCall[0].timestamp).toBe("string");
		});

		it("should publish enriched message with null steam when not found", async () => {
			// Arrange
			mockSteamService.lookupGame.mockResolvedValueOnce(null);
			const message: SteamRefreshMessage = {
				gameId: 42,
				correctedName: "Unknown Game",
				timestamp: "2024-01-01T00:00:00Z",
			};

			// Act
			await service.handleRefresh(message);

			// Assert
			expect(mockSteamService.lookupGame).toHaveBeenCalledWith("Unknown Game");
			expect(mockPublisher.publishEnriched).toHaveBeenCalledTimes(1);

			const publishCall = mockPublisher.publishEnriched.mock.calls[0];
			expect(publishCall[0].gameId).toBe(42);
			expect(publishCall[0].steam).toBeNull();
		});
	});
});
