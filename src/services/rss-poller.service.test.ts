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
import Parser from "rss-parser";
import { RssFetchError, RssParseError } from "../errors/index.js";
import { RssPollerService } from "./rss-poller.service.js";

describe("RssPollerService", () => {
	const mockLogger: ILogger = {
		debug: mock(() => {}),
		info: mock(() => {}),
		warn: mock(() => {}),
		error: mock(() => {}),
		child: mock(() => mockLogger),
	};

	let service: RssPollerService;
	let parseUrlSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		service = new RssPollerService({
			feedUrl: "https://fitgirl-repacks.site/feed/",
			logger: mockLogger,
		});

		parseUrlSpy = spyOn(Parser.prototype, "parseURL");
	});

	afterEach(() => {
		parseUrlSpy.mockRestore();
	});

	describe("fetchRssFeed", () => {
		it("should fetch and filter items to Lossless Repacks only", async () => {
			// Arrange
			const mockFeed = {
				items: [
					{
						guid: "https://fitgirl-repacks.site/?p=12345",
						title: "Test Game – v1.0",
						link: "https://fitgirl-repacks.site/test-game/",
						pubDate: "Mon, 15 Jan 2024 12:00:00 +0000",
						"content:encoded": "<p>Original Size: <strong>45 GB</strong></p>",
						categories: ["Lossless Repack", "Action"],
					},
					{
						guid: "https://fitgirl-repacks.site/?p=12346",
						title: "Not a Repack",
						link: "https://fitgirl-repacks.site/not-repack/",
						pubDate: "Mon, 15 Jan 2024 11:00:00 +0000",
						"content:encoded": "<p>Some content</p>",
						categories: ["News"],
					},
					{
						guid: "https://fitgirl-repacks.site/?p=12347",
						title: "Another Game + 5 DLCs",
						link: "https://fitgirl-repacks.site/another-game/",
						pubDate: "Mon, 15 Jan 2024 10:00:00 +0000",
						"content:encoded": "<p>Repack Size: <strong>22 GB</strong></p>",
						categories: ["lossless repack", "RPG"], // Case insensitive
					},
				],
			};

			parseUrlSpy.mockResolvedValueOnce(mockFeed);

			// Act
			const result = await service.fetchRssFeed();

			// Assert
			expect(result).toHaveLength(2);
			expect(result[0]?.guid).toBe("12345");
			expect(result[0]?.title).toBe("Test Game – v1.0");
			expect(result[1]?.guid).toBe("12347");
			expect(result[1]?.title).toBe("Another Game + 5 DLCs");
		});

		it("should throw RssFetchError when parsing fails", async () => {
			// Arrange
			parseUrlSpy.mockRejectedValueOnce(new Error("Network error"));

			// Act & Assert
			await expect(service.fetchRssFeed()).rejects.toBeInstanceOf(
				RssFetchError,
			);
		});

		it("should throw RssParseError when feed has no items", async () => {
			// Arrange
			parseUrlSpy.mockResolvedValueOnce({ items: undefined });

			// Act & Assert
			await expect(service.fetchRssFeed()).rejects.toBeInstanceOf(
				RssParseError,
			);
		});

		it("should skip items without valid guid", async () => {
			// Arrange
			const mockFeed = {
				items: [
					{
						guid: undefined,
						title: "No Guid Game",
						link: "https://fitgirl-repacks.site/no-guid/",
						categories: ["Lossless Repack"],
					},
					{
						guid: "https://fitgirl-repacks.site/?p=12345",
						title: "Valid Game",
						link: "https://fitgirl-repacks.site/valid-game/",
						categories: ["Lossless Repack"],
					},
				],
			};

			parseUrlSpy.mockResolvedValueOnce(mockFeed);

			// Act
			const result = await service.fetchRssFeed();

			// Assert
			expect(result).toHaveLength(1);
			expect(result[0]?.title).toBe("Valid Game");
			expect(mockLogger.warn).toHaveBeenCalled();
		});

		it("should skip items without title", async () => {
			// Arrange
			const mockFeed = {
				items: [
					{
						guid: "https://fitgirl-repacks.site/?p=12345",
						title: undefined,
						link: "https://fitgirl-repacks.site/no-title/",
						categories: ["Lossless Repack"],
					},
				],
			};

			parseUrlSpy.mockResolvedValueOnce(mockFeed);

			// Act
			const result = await service.fetchRssFeed();

			// Assert
			expect(result).toHaveLength(0);
			expect(mockLogger.warn).toHaveBeenCalled();
		});

		it("should handle items without categories", async () => {
			// Arrange
			const mockFeed = {
				items: [
					{
						guid: "https://fitgirl-repacks.site/?p=12345",
						title: "Game Without Categories",
						link: "https://fitgirl-repacks.site/game/",
						categories: undefined,
					},
				],
			};

			parseUrlSpy.mockResolvedValueOnce(mockFeed);

			// Act
			const result = await service.fetchRssFeed();

			// Assert
			expect(result).toHaveLength(0);
		});

		it("should extract content from content:encoded field", async () => {
			// Arrange
			const mockFeed = {
				items: [
					{
						guid: "https://fitgirl-repacks.site/?p=12345",
						title: "Test Game",
						link: "https://fitgirl-repacks.site/test-game/",
						pubDate: "Mon, 15 Jan 2024 12:00:00 +0000",
						"content:encoded":
							"<p>Original Size: <strong>45 GB</strong></p><p>Repack Size: <strong>22 GB</strong></p>",
						categories: ["Lossless Repack"],
					},
				],
			};

			parseUrlSpy.mockResolvedValueOnce(mockFeed);

			// Act
			const result = await service.fetchRssFeed();

			// Assert
			expect(result[0]?.content).toContain("Original Size");
			expect(result[0]?.content).toContain("Repack Size");
		});

		it("should use full guid when not WordPress format", async () => {
			// Arrange
			const mockFeed = {
				items: [
					{
						guid: "custom-guid-format-12345",
						title: "Test Game",
						link: "https://fitgirl-repacks.site/test-game/",
						categories: ["Lossless Repack"],
					},
				],
			};

			parseUrlSpy.mockResolvedValueOnce(mockFeed);

			// Act
			const result = await service.fetchRssFeed();

			// Assert
			expect(result[0]?.guid).toBe("custom-guid-format-12345");
		});

		it("should provide default values for optional fields", async () => {
			// Arrange
			const mockFeed = {
				items: [
					{
						guid: "https://fitgirl-repacks.site/?p=12345",
						title: "Minimal Item",
						categories: ["Lossless Repack"],
					},
				],
			};

			parseUrlSpy.mockResolvedValueOnce(mockFeed);

			// Act
			const result = await service.fetchRssFeed();

			// Assert
			expect(result[0]?.link).toBe("");
			expect(result[0]?.pubDate).toBeDefined();
			expect(result[0]?.content).toBe("");
			expect(result[0]?.categories).toEqual(["Lossless Repack"]);
		});
	});
});
