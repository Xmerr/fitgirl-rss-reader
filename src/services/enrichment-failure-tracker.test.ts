import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	spyOn,
} from "bun:test";
import * as fs from "node:fs/promises";
import type { ILogger } from "@xmer/consumer-shared";
import { EnrichmentFailureTracker } from "./enrichment-failure-tracker.js";

describe("EnrichmentFailureTracker", () => {
	const mockLogger: ILogger = {
		debug: mock(() => {}),
		info: mock(() => {}),
		warn: mock(() => {}),
		error: mock(() => {}),
		child: mock(() => mockLogger),
	};

	let tracker: EnrichmentFailureTracker;
	let mkdirSpy: ReturnType<typeof spyOn>;
	let appendFileSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		tracker = new EnrichmentFailureTracker({
			filePath: "/app/data/enrichment-failures.jsonl",
			logger: mockLogger,
		});

		mkdirSpy = spyOn(fs, "mkdir").mockResolvedValue(undefined);
		appendFileSpy = spyOn(fs, "appendFile").mockResolvedValue(undefined);
	});

	afterEach(() => {
		mkdirSpy.mockRestore();
		appendFileSpy.mockRestore();
	});

	describe("logFailure", () => {
		it("should create directory and append failure to file", async () => {
			// Arrange
			const failure = {
				fitgirl_name: "Test Game – v1.0",
				parsed_name: "Test Game",
				timestamp: "2024-01-15T12:00:00.000Z",
				error: "Game not found on Steam",
			};

			// Act
			await tracker.logFailure(failure);

			// Assert
			expect(mkdirSpy).toHaveBeenCalledWith("/app/data", { recursive: true });
			expect(appendFileSpy).toHaveBeenCalledWith(
				"/app/data/enrichment-failures.jsonl",
				`${JSON.stringify(failure)}\n`,
				"utf-8",
			);
			expect(mockLogger.debug).toHaveBeenCalled();
		});

		it("should only create directory once", async () => {
			// Arrange
			const failure1 = {
				fitgirl_name: "Game 1",
				parsed_name: "Game 1",
				timestamp: "2024-01-15T12:00:00.000Z",
				error: "Not found",
			};
			const failure2 = {
				fitgirl_name: "Game 2",
				parsed_name: "Game 2",
				timestamp: "2024-01-15T12:01:00.000Z",
				error: "Not found",
			};

			// Act
			await tracker.logFailure(failure1);
			await tracker.logFailure(failure2);

			// Assert
			expect(mkdirSpy).toHaveBeenCalledTimes(1);
			expect(appendFileSpy).toHaveBeenCalledTimes(2);
		});

		it("should handle directory already exists", async () => {
			// Arrange
			const eexistError = new Error(
				"Directory exists",
			) as NodeJS.ErrnoException;
			eexistError.code = "EEXIST";
			mkdirSpy.mockRejectedValueOnce(eexistError);

			const failure = {
				fitgirl_name: "Test Game",
				parsed_name: "Test Game",
				timestamp: "2024-01-15T12:00:00.000Z",
				error: "Not found",
			};

			// Act
			await tracker.logFailure(failure);

			// Assert
			expect(appendFileSpy).toHaveBeenCalled();
		});

		it("should log warning when file write fails", async () => {
			// Arrange
			appendFileSpy.mockRejectedValueOnce(new Error("Permission denied"));

			const failure = {
				fitgirl_name: "Test Game",
				parsed_name: "Test Game",
				timestamp: "2024-01-15T12:00:00.000Z",
				error: "Not found",
			};

			// Act
			await tracker.logFailure(failure);

			// Assert
			expect(mockLogger.warn).toHaveBeenCalled();
		});

		it("should format failure as JSON line", async () => {
			// Arrange
			const failure = {
				fitgirl_name: 'Test "Game" – v1.0',
				parsed_name: 'Test "Game"',
				timestamp: "2024-01-15T12:00:00.000Z",
				error: "Not found",
			};

			// Act
			await tracker.logFailure(failure);

			// Assert
			const writtenContent = appendFileSpy.mock.calls[0]?.[1] as string;
			expect(writtenContent).toEndWith("\n");
			expect(JSON.parse(writtenContent.trim())).toEqual(failure);
		});
	});
});
