import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	spyOn,
} from "bun:test";
import type { ILogger } from "@xmer/consumer-shared";
import { SteamService } from "./steam.service.js";

describe("SteamService", () => {
	const mockLogger: ILogger = {
		debug: mock(() => {}),
		info: mock(() => {}),
		warn: mock(() => {}),
		error: mock(() => {}),
		child: mock(() => mockLogger),
	};

	let service: SteamService;
	let fetchSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		service = new SteamService({
			timeoutMs: 5000,
			logger: mockLogger,
		});
		fetchSpy = spyOn(globalThis, "fetch");
	});

	afterEach(() => {
		fetchSpy.mockRestore();
	});

	describe("lookupGame", () => {
		it("should return null when game is not found in search", async () => {
			// Arrange
			fetchSpy.mockResolvedValueOnce(
				new Response(JSON.stringify({ total: 0, items: [] }), { status: 200 }),
			);

			// Act
			const result = await service.lookupGame("NonExistentGame12345");

			// Assert
			expect(result).toBeNull();
		});

		it("should return full steam data when game is found", async () => {
			// Arrange
			const searchResponse = {
				total: 1,
				items: [{ id: 12345, name: "Test Game" }],
			};

			const detailsResponse = {
				"12345": {
					success: true,
					data: {
						steam_appid: 12345,
						name: "Test Game",
						release_date: { coming_soon: false, date: "Jan 1, 2024" },
						is_free: false,
						price_overview: { final_formatted: "$29.99" },
						categories: [
							{ id: 1, description: "Single-player" },
							{ id: 2, description: "Multi-player" },
						],
						header_image: "https://cdn.steam.com/header.jpg",
						screenshots: [
							{ id: 1, path_full: "https://cdn.steam.com/ss1.jpg" },
						],
						movies: [
							{
								id: 1,
								name: "Trailer",
								thumbnail: "https://cdn.steam.com/thumb.jpg",
								webm: {
									"480": "https://cdn.steam.com/480.webm",
									max: "https://cdn.steam.com/max.webm",
								},
							},
						],
					},
				},
			};

			const reviewsResponse = {
				success: 1,
				query_summary: {
					total_positive: 1000,
					total_negative: 100,
					review_score_desc: "Very Positive",
				},
			};

			fetchSpy
				.mockResolvedValueOnce(
					new Response(JSON.stringify(searchResponse), { status: 200 }),
				)
				.mockResolvedValueOnce(
					new Response(JSON.stringify(detailsResponse), { status: 200 }),
				)
				.mockResolvedValueOnce(
					new Response(JSON.stringify(reviewsResponse), { status: 200 }),
				);

			// Act
			const result = await service.lookupGame("Test Game");

			// Assert
			expect(result).not.toBeNull();
			expect(result?.app_id).toBe(12345);
			expect(result?.name).toBe("Test Game");
			expect(result?.steam_url).toBe(
				"https://store.steampowered.com/app/12345",
			);
			expect(result?.release_date).toBe("Jan 1, 2024");
			expect(result?.price).toBe("$29.99");
			expect(result?.ratings?.total_positive).toBe(1000);
			expect(result?.ratings?.total_negative).toBe(100);
			expect(result?.ratings?.review_score_desc).toBe("Very Positive");
			expect(result?.categories).toEqual(["Single-player", "Multi-player"]);
			expect(result?.media.header_image).toBe(
				"https://cdn.steam.com/header.jpg",
			);
			expect(result?.media.screenshots).toEqual([
				"https://cdn.steam.com/ss1.jpg",
			]);
			expect(result?.media.movies?.[0]?.name).toBe("Trailer");
		});

		it("should return steam data with 'Free to Play' for free games", async () => {
			// Arrange
			const searchResponse = {
				total: 1,
				items: [{ id: 12345, name: "Free Game" }],
			};

			const detailsResponse = {
				"12345": {
					success: true,
					data: {
						steam_appid: 12345,
						name: "Free Game",
						is_free: true,
						header_image: "https://cdn.steam.com/header.jpg",
					},
				},
			};

			fetchSpy
				.mockResolvedValueOnce(
					new Response(JSON.stringify(searchResponse), { status: 200 }),
				)
				.mockResolvedValueOnce(
					new Response(JSON.stringify(detailsResponse), { status: 200 }),
				)
				.mockResolvedValueOnce(
					new Response(JSON.stringify({ success: 0 }), { status: 200 }),
				);

			// Act
			const result = await service.lookupGame("Free Game");

			// Assert
			expect(result?.price).toBe("Free to Play");
		});

		it("should return null when search API fails", async () => {
			// Arrange
			fetchSpy.mockResolvedValueOnce(
				new Response("Internal Server Error", { status: 500 }),
			);

			// Act
			const result = await service.lookupGame("Test Game");

			// Assert
			expect(result).toBeNull();
			expect(mockLogger.warn).toHaveBeenCalled();
		});

		it("should return null when details API returns unsuccessful", async () => {
			// Arrange
			const searchResponse = {
				total: 1,
				items: [{ id: 12345, name: "Test Game" }],
			};

			const detailsResponse = {
				"12345": {
					success: false,
				},
			};

			fetchSpy
				.mockResolvedValueOnce(
					new Response(JSON.stringify(searchResponse), { status: 200 }),
				)
				.mockResolvedValueOnce(
					new Response(JSON.stringify(detailsResponse), { status: 200 }),
				);

			// Act
			const result = await service.lookupGame("Test Game");

			// Assert
			expect(result).toBeNull();
		});

		it("should return data without ratings when reviews API fails", async () => {
			// Arrange
			const searchResponse = {
				total: 1,
				items: [{ id: 12345, name: "Test Game" }],
			};

			const detailsResponse = {
				"12345": {
					success: true,
					data: {
						steam_appid: 12345,
						name: "Test Game",
						header_image: "https://cdn.steam.com/header.jpg",
					},
				},
			};

			fetchSpy
				.mockResolvedValueOnce(
					new Response(JSON.stringify(searchResponse), { status: 200 }),
				)
				.mockResolvedValueOnce(
					new Response(JSON.stringify(detailsResponse), { status: 200 }),
				)
				.mockResolvedValueOnce(new Response("Error", { status: 500 }));

			// Act
			const result = await service.lookupGame("Test Game");

			// Assert
			expect(result).not.toBeNull();
			expect(result?.ratings).toBeUndefined();
		});
	});

	describe("timeout handling", () => {
		it("should return null when request times out", async () => {
			// Arrange
			const slowService = new SteamService({
				timeoutMs: 10, // Very short timeout
				logger: mockLogger,
			});

			fetchSpy.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						setTimeout(
							() =>
								resolve(
									new Response(JSON.stringify({ total: 0, items: [] }), {
										status: 200,
									}),
								),
							100,
						);
					}),
			);

			// Act
			const result = await slowService.lookupGame("Test Game");

			// Assert
			expect(result).toBeNull();
			expect(mockLogger.warn).toHaveBeenCalled();
		});
	});
});
