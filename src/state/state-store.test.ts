import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { ILogger } from "@xmer/consumer-shared";
import { StateStore } from "./state-store.js";

describe("StateStore", () => {
	const mockLogger: ILogger = {
		debug: mock(() => {}),
		info: mock(() => {}),
		warn: mock(() => {}),
		error: mock(() => {}),
		child: mock(() => mockLogger),
	};

	let stateStore: StateStore;
	let mockRedis: {
		sismember: ReturnType<typeof mock>;
		sadd: ReturnType<typeof mock>;
		expire: ReturnType<typeof mock>;
		scard: ReturnType<typeof mock>;
		del: ReturnType<typeof mock>;
		quit: ReturnType<typeof mock>;
	};

	beforeEach(() => {
		mockRedis = {
			sismember: mock(() => Promise.resolve(0)),
			sadd: mock(() => Promise.resolve(1)),
			expire: mock(() => Promise.resolve(1)),
			scard: mock(() => Promise.resolve(5)),
			del: mock(() => Promise.resolve(1)),
			quit: mock(() => Promise.resolve("OK")),
		};

		stateStore = new StateStore({
			redis: mockRedis as unknown as import("ioredis").Redis,
			logger: mockLogger,
		});
	});

	describe("isNew", () => {
		it("should return true when guid has not been seen", async () => {
			// Arrange
			mockRedis.sismember.mockResolvedValueOnce(0);

			// Act
			const result = await stateStore.isNew("12345");

			// Assert
			expect(result).toBe(true);
			expect(mockRedis.sismember).toHaveBeenCalledWith(
				"fitgirl-rss-reader:seen-guids",
				"12345",
			);
		});

		it("should return false when guid has been seen", async () => {
			// Arrange
			mockRedis.sismember.mockResolvedValueOnce(1);

			// Act
			const result = await stateStore.isNew("12345");

			// Assert
			expect(result).toBe(false);
		});
	});

	describe("markSeen", () => {
		it("should add guid to the seen set", async () => {
			// Act
			await stateStore.markSeen("12345");

			// Assert
			expect(mockRedis.sadd).toHaveBeenCalledWith(
				"fitgirl-rss-reader:seen-guids",
				"12345",
			);
		});

		it("should refresh TTL on the set", async () => {
			// Act
			await stateStore.markSeen("12345");

			// Assert
			// Default TTL is 90 days = 90 * 24 * 60 * 60 = 7776000 seconds
			expect(mockRedis.expire).toHaveBeenCalledWith(
				"fitgirl-rss-reader:seen-guids",
				7776000,
			);
		});

		it("should use custom TTL when provided", async () => {
			// Arrange
			const customStore = new StateStore({
				redis: mockRedis as unknown as import("ioredis").Redis,
				logger: mockLogger,
				ttlDays: 30,
			});

			// Act
			await customStore.markSeen("12345");

			// Assert
			// 30 days = 30 * 24 * 60 * 60 = 2592000 seconds
			expect(mockRedis.expire).toHaveBeenCalledWith(
				"fitgirl-rss-reader:seen-guids",
				2592000,
			);
		});

		it("should log debug message", async () => {
			// Act
			await stateStore.markSeen("12345");

			// Assert
			expect(mockLogger.debug).toHaveBeenCalled();
		});
	});

	describe("clear", () => {
		it("should delete the redis key and return count", async () => {
			// Arrange
			mockRedis.scard.mockResolvedValueOnce(10);

			// Act
			const result = await stateStore.clear();

			// Assert
			expect(result).toBe(10);
			expect(mockRedis.scard).toHaveBeenCalledWith(
				"fitgirl-rss-reader:seen-guids",
			);
			expect(mockRedis.del).toHaveBeenCalledWith(
				"fitgirl-rss-reader:seen-guids",
			);
		});

		it("should return 0 when set is empty", async () => {
			// Arrange
			mockRedis.scard.mockResolvedValueOnce(0);

			// Act
			const result = await stateStore.clear();

			// Assert
			expect(result).toBe(0);
		});

		it("should log the clear operation", async () => {
			// Act
			await stateStore.clear();

			// Assert
			expect(mockLogger.info).toHaveBeenCalled();
		});
	});

	describe("close", () => {
		it("should quit redis connection", async () => {
			// Act
			await stateStore.close();

			// Assert
			expect(mockRedis.quit).toHaveBeenCalled();
			expect(mockLogger.info).toHaveBeenCalled();
		});
	});
});
