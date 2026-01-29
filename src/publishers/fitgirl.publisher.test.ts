import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { ILogger } from "@xmer/consumer-shared";
import type { Channel } from "amqplib";
import type {
	IEnrichmentFailureTracker,
	IRssPollerService,
	IStateStore,
	ISteamService,
	RssItem,
	SteamData,
} from "../types/index.js";
import { FitGirlPublisher } from "./fitgirl.publisher.js";

describe("FitGirlPublisher", () => {
	const mockLogger: ILogger = {
		debug: mock(() => {}),
		info: mock(() => {}),
		warn: mock(() => {}),
		error: mock(() => {}),
		child: mock(() => mockLogger),
	};

	let publisher: FitGirlPublisher;
	let mockChannel: {
		assertExchange: ReturnType<typeof mock>;
		publish: ReturnType<typeof mock>;
	};
	let mockRssPoller: IRssPollerService;
	let mockStateStore: IStateStore;
	let mockSteamService: ISteamService;
	let mockFailureTracker: IEnrichmentFailureTracker;

	const sampleRssItem: RssItem = {
		guid: "12345",
		title: "Test Game – v1.2.3 + 5 DLCs",
		link: "https://fitgirl-repacks.site/test-game/",
		pubDate: "Mon, 15 Jan 2024 12:00:00 +0000",
		content:
			"<p>Original Size: <strong>45 GB</strong></p><p>Repack Size: <strong>22 GB</strong></p>",
		categories: ["Lossless Repack", "Action"],
	};

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
		categories: ["Single-player", "Multi-player"],
		media: {
			header_image: "https://cdn.steam.com/header.jpg",
			screenshots: ["https://cdn.steam.com/ss1.jpg"],
		},
	};

	beforeEach(() => {
		mockChannel = {
			assertExchange: mock(() => Promise.resolve({})),
			publish: mock(() => true),
		};

		mockRssPoller = {
			fetchRssFeed: mock(() => Promise.resolve([sampleRssItem])),
		};

		mockStateStore = {
			isNew: mock(() => Promise.resolve(true)),
			markSeen: mock(() => Promise.resolve()),
			close: mock(() => Promise.resolve()),
		};

		mockSteamService = {
			lookupGame: mock(() => Promise.resolve(sampleSteamData)),
		};

		mockFailureTracker = {
			logFailure: mock(() => Promise.resolve()),
		};

		publisher = new FitGirlPublisher({
			channel: mockChannel as unknown as Channel,
			exchange: "fitgirl",
			logger: mockLogger,
			rssPoller: mockRssPoller,
			stateStore: mockStateStore,
			steamService: mockSteamService,
			failureTracker: mockFailureTracker,
			intervalMs: 60000,
		});
	});

	afterEach(() => {
		publisher.stopPolling();
	});

	describe("startPolling / stopPolling", () => {
		it("should start polling immediately and then on interval", async () => {
			// Arrange
			const fetchSpy = mockRssPoller.fetchRssFeed as ReturnType<typeof mock>;

			// Act
			publisher.startPolling();

			// Wait for immediate poll
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Assert
			expect(fetchSpy).toHaveBeenCalledTimes(1);
			expect(mockLogger.info).toHaveBeenCalled();
		});

		it("should stop polling when stopPolling is called", async () => {
			// Arrange
			publisher.startPolling();

			// Act
			publisher.stopPolling();

			// Assert
			expect(mockLogger.info).toHaveBeenCalled();
		});
	});

	describe("pollAndPublish", () => {
		it("should filter and publish only new items", async () => {
			// Arrange
			const secondItem: RssItem = {
				...sampleRssItem,
				guid: "12346",
				title: "Second Game",
			};

			(
				mockRssPoller.fetchRssFeed as ReturnType<typeof mock>
			).mockResolvedValueOnce([sampleRssItem, secondItem]);

			// First item is new, second is not
			(mockStateStore.isNew as ReturnType<typeof mock>)
				.mockResolvedValueOnce(true)
				.mockResolvedValueOnce(false);

			// Act
			publisher.startPolling();
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Assert
			expect(mockChannel.publish).toHaveBeenCalledTimes(1);
			expect(mockStateStore.markSeen).toHaveBeenCalledTimes(1);
			expect(mockStateStore.markSeen).toHaveBeenCalledWith("12345");
		});

		it("should not publish when no new items found", async () => {
			// Arrange
			(mockStateStore.isNew as ReturnType<typeof mock>).mockResolvedValueOnce(
				false,
			);

			// Act
			publisher.startPolling();
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Assert
			expect(mockChannel.publish).not.toHaveBeenCalled();
			expect(mockLogger.debug).toHaveBeenCalled();
		});

		it("should handle fetch errors gracefully", async () => {
			// Arrange
			(
				mockRssPoller.fetchRssFeed as ReturnType<typeof mock>
			).mockRejectedValueOnce(new Error("Network error"));

			// Act
			publisher.startPolling();
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Assert
			expect(mockChannel.publish).not.toHaveBeenCalled();
			expect(mockLogger.error).toHaveBeenCalled();
		});
	});

	describe("buildRelease", () => {
		it("should build complete release with Steam data", async () => {
			// Act
			publisher.startPolling();
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Assert
			expect(mockChannel.publish).toHaveBeenCalled();
			const publishCall = (mockChannel.publish as ReturnType<typeof mock>).mock
				.calls[0];
			const message = JSON.parse(publishCall?.[2]?.toString() ?? "{}");

			expect(message.guid).toBe("12345");
			expect(message.title_raw).toBe("Test Game – v1.2.3 + 5 DLCs");
			expect(message.game_name).toBe("Test Game");
			expect(message.version).toBe("v1.2.3");
			expect(message.dlcs_included).toBe(true);
			expect(message.dlc_count).toBe(5);
			expect(message.fitgirl_url).toBe(
				"https://fitgirl-repacks.site/test-game/",
			);
			expect(message.size_original).toBe("45 GB");
			expect(message.size_repack).toBe("22 GB");
			expect(message.steam).not.toBeNull();
			expect(message.steam.app_id).toBe(12345);
		});

		it("should log enrichment failure when Steam lookup fails", async () => {
			// Arrange
			(
				mockSteamService.lookupGame as ReturnType<typeof mock>
			).mockResolvedValueOnce(null);

			// Act
			publisher.startPolling();
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Assert
			expect(mockFailureTracker.logFailure).toHaveBeenCalled();
			const failureCall = (
				mockFailureTracker.logFailure as ReturnType<typeof mock>
			).mock.calls[0];
			expect(failureCall?.[0]?.fitgirl_name).toBe(
				"Test Game – v1.2.3 + 5 DLCs",
			);
			expect(failureCall?.[0]?.parsed_name).toBe("Test Game");
		});

		it("should publish release with null steam when lookup fails", async () => {
			// Arrange
			(
				mockSteamService.lookupGame as ReturnType<typeof mock>
			).mockResolvedValueOnce(null);

			// Act
			publisher.startPolling();
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Assert
			expect(mockChannel.publish).toHaveBeenCalled();
			const publishCall = (mockChannel.publish as ReturnType<typeof mock>).mock
				.calls[0];
			const message = JSON.parse(publishCall?.[2]?.toString() ?? "{}");

			expect(message.steam).toBeNull();
		});

		it("should publish to release.new routing key", async () => {
			// Act
			publisher.startPolling();
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Assert
			const publishCall = (mockChannel.publish as ReturnType<typeof mock>).mock
				.calls[0];
			expect(publishCall?.[1]).toBe("release.new");
		});
	});
});
