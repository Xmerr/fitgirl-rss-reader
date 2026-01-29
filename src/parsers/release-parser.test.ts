import { describe, expect, it } from "bun:test";
import { parseReleaseTitle } from "./release-parser.js";

describe("parseReleaseTitle", () => {
	describe("simple titles", () => {
		it("should parse a simple game name", () => {
			// Arrange
			const title = "Obey the Voice";

			// Act
			const result = parseReleaseTitle(title);

			// Assert
			expect(result.game_name).toBe("Obey the Voice");
			expect(result.version).toBeUndefined();
			expect(result.dlcs_included).toBe(false);
			expect(result.dlc_count).toBeUndefined();
		});

		it("should trim whitespace", () => {
			// Arrange
			const title = "  Game Name  ";

			// Act
			const result = parseReleaseTitle(title);

			// Assert
			expect(result.game_name).toBe("Game Name");
		});
	});

	describe("titles with versions", () => {
		it("should parse version with en-dash separator", () => {
			// Arrange
			const title = "The Game – v1.2.3";

			// Act
			const result = parseReleaseTitle(title);

			// Assert
			expect(result.game_name).toBe("The Game");
			expect(result.version).toBe("v1.2.3");
			expect(result.dlcs_included).toBe(false);
		});

		it("should parse version with hyphen separator", () => {
			// Arrange
			const title = "The Game - v2.0";

			// Act
			const result = parseReleaseTitle(title);

			// Assert
			expect(result.game_name).toBe("The Game");
			expect(result.version).toBe("v2.0");
		});

		it("should parse version with comma separator", () => {
			// Arrange
			const title = "The Game, v1.5.2";

			// Act
			const result = parseReleaseTitle(title);

			// Assert
			expect(result.game_name).toBe("The Game");
			expect(result.version).toBe("v1.5.2");
		});

		it("should parse build number", () => {
			// Arrange
			const title = "The Game – Build 12345678";

			// Act
			const result = parseReleaseTitle(title);

			// Assert
			expect(result.game_name).toBe("The Game");
			expect(result.version).toBe("Build 12345678");
		});

		it("should parse version without v prefix", () => {
			// Arrange
			const title = "The Game – 1.2.3";

			// Act
			const result = parseReleaseTitle(title);

			// Assert
			expect(result.game_name).toBe("The Game");
			expect(result.version).toBe("1.2.3");
		});

		it("should parse multi-part version numbers", () => {
			// Arrange
			const title = "The Game – v1.2.3.4";

			// Act
			const result = parseReleaseTitle(title);

			// Assert
			expect(result.game_name).toBe("The Game");
			expect(result.version).toBe("v1.2.3.4");
		});
	});

	describe("titles with DLCs", () => {
		it("should parse DLC count with plus separator", () => {
			// Arrange
			const title = "The Game + 5 DLCs";

			// Act
			const result = parseReleaseTitle(title);

			// Assert
			expect(result.game_name).toBe("The Game");
			expect(result.dlcs_included).toBe(true);
			expect(result.dlc_count).toBe(5);
		});

		it("should parse DLC singular form", () => {
			// Arrange
			const title = "The Game + 1 DLC";

			// Act
			const result = parseReleaseTitle(title);

			// Assert
			expect(result.game_name).toBe("The Game");
			expect(result.dlcs_included).toBe(true);
			expect(result.dlc_count).toBe(1);
		});

		it("should parse large DLC count", () => {
			// Arrange
			const title = "The Game + 46 DLCs";

			// Act
			const result = parseReleaseTitle(title);

			// Assert
			expect(result.game_name).toBe("The Game");
			expect(result.dlcs_included).toBe(true);
			expect(result.dlc_count).toBe(46);
		});

		it("should handle 'All DLCs' pattern", () => {
			// Arrange
			const title = "The Game + All DLCs";

			// Act
			const result = parseReleaseTitle(title);

			// Assert
			expect(result.game_name).toBe("The Game");
			expect(result.dlcs_included).toBe(true);
			expect(result.dlc_count).toBeUndefined();
		});

		it("should handle 'DLCs' without count", () => {
			// Arrange
			const title = "The Game + DLCs";

			// Act
			const result = parseReleaseTitle(title);

			// Assert
			expect(result.game_name).toBe("The Game");
			expect(result.dlcs_included).toBe(true);
			expect(result.dlc_count).toBeUndefined();
		});
	});

	describe("combined patterns", () => {
		it("should parse version and DLCs together", () => {
			// Arrange
			const title = "The Game – v1.2.3 + 10 DLCs";

			// Act
			const result = parseReleaseTitle(title);

			// Assert
			expect(result.game_name).toBe("The Game");
			expect(result.version).toBe("v1.2.3");
			expect(result.dlcs_included).toBe(true);
			expect(result.dlc_count).toBe(10);
		});

		it("should parse comma-separated version with DLCs", () => {
			// Arrange
			const title = "The Game, v1.0 + 46 DLCs";

			// Act
			const result = parseReleaseTitle(title);

			// Assert
			expect(result.game_name).toBe("The Game");
			expect(result.version).toBe("v1.0");
			expect(result.dlcs_included).toBe(true);
			expect(result.dlc_count).toBe(46);
		});

		it("should parse build number with DLCs", () => {
			// Arrange
			const title = "The Game – Build 9876543 + 3 DLCs";

			// Act
			const result = parseReleaseTitle(title);

			// Assert
			expect(result.game_name).toBe("The Game");
			expect(result.version).toBe("Build 9876543");
			expect(result.dlcs_included).toBe(true);
			expect(result.dlc_count).toBe(3);
		});
	});

	describe("edge cases", () => {
		it("should handle game name with numbers", () => {
			// Arrange
			const title = "Far Cry 6 – v1.5.0 + 12 DLCs";

			// Act
			const result = parseReleaseTitle(title);

			// Assert
			expect(result.game_name).toBe("Far Cry 6");
			expect(result.version).toBe("v1.5.0");
			expect(result.dlcs_included).toBe(true);
			expect(result.dlc_count).toBe(12);
		});

		it("should handle game name with special characters", () => {
			// Arrange
			const title = "The Witcher 3: Wild Hunt – v4.0 + 18 DLCs";

			// Act
			const result = parseReleaseTitle(title);

			// Assert
			expect(result.game_name).toBe("The Witcher 3: Wild Hunt");
			expect(result.version).toBe("v4.0");
		});

		it("should handle game name with apostrophe", () => {
			// Arrange
			const title = "Assassin's Creed – v1.0";

			// Act
			const result = parseReleaseTitle(title);

			// Assert
			expect(result.game_name).toBe("Assassin's Creed");
			expect(result.version).toBe("v1.0");
		});
	});

	describe("FitGirl-specific patterns", () => {
		it("should strip anniversary edition suffix", () => {
			// Arrange
			const title =
				"SnowRunner: 4-Year Anniversary Edition, v39.1 + 46 DLCs + Chill Nature Beats Soundtrack";

			// Act
			const result = parseReleaseTitle(title);

			// Assert
			expect(result.game_name).toBe("SnowRunner");
			expect(result.version).toBe("v39.1");
			expect(result.dlcs_included).toBe(true);
			expect(result.dlc_count).toBe(46);
		});

		it("should strip GOG build identifier and bonus content", () => {
			// Arrange
			const title =
				"Disco Elysium: The Final Cut Bundle, GOG Build a0a063ab + Bonus Content";

			// Act
			const result = parseReleaseTitle(title);

			// Assert
			expect(result.game_name).toBe("Disco Elysium: The Final Cut");
		});

		it("should strip Bundle suffix", () => {
			// Arrange
			const title = "Some Game Bundle – v1.0";

			// Act
			const result = parseReleaseTitle(title);

			// Assert
			expect(result.game_name).toBe("Some Game");
			expect(result.version).toBe("v1.0");
		});

		it("should strip Bonus OST suffix", () => {
			// Arrange
			const title = "Terraria – v1.4.5.0 + Bonus OST";

			// Act
			const result = parseReleaseTitle(title);

			// Assert
			expect(result.game_name).toBe("Terraria");
			expect(result.version).toBe("v1.4.5.0");
		});

		it("should strip Bonus OSTs suffix", () => {
			// Arrange
			const title = "S.E.M.I.: Side Effects May Include… – v1.0 + Bonus OSTs";

			// Act
			const result = parseReleaseTitle(title);

			// Assert
			expect(result.game_name).toBe("S.E.M.I.: Side Effects May Include…");
			expect(result.version).toBe("v1.0");
		});

		it("should strip soundtrack suffix after DLCs", () => {
			// Arrange
			const title = "Game Name, v1.0 + 10 DLCs + Epic Soundtrack";

			// Act
			const result = parseReleaseTitle(title);

			// Assert
			expect(result.game_name).toBe("Game Name");
			expect(result.version).toBe("v1.0");
			expect(result.dlcs_included).toBe(true);
			expect(result.dlc_count).toBe(10);
		});

		it("should handle complex FitGirl title with multiple patterns", () => {
			// Arrange - real example from feed
			const title =
				"SnowRunner: 4-Year Anniversary Edition, v39.1 (Season 17 Update) + 46 DLCs + Chill Nature Beats Soundtrack";

			// Act
			const result = parseReleaseTitle(title);

			// Assert
			expect(result.game_name).toBe("SnowRunner");
			expect(result.dlcs_included).toBe(true);
			expect(result.dlc_count).toBe(46);
		});
	});
});
