import { describe, expect, it } from "bun:test";
import { parseRssContent } from "./content-parser.js";

describe("parseRssContent", () => {
	describe("size extraction", () => {
		it("should extract original and repack sizes with strong tags", () => {
			// Arrange
			const content = `
				<p>Original Size: <strong>45 GB</strong></p>
				<p>Repack Size: <strong>22 GB</strong></p>
			`;

			// Act
			const result = parseRssContent(content);

			// Assert
			expect(result.size_original).toBe("45 GB");
			expect(result.size_repack).toBe("22 GB");
		});

		it("should extract decimal sizes", () => {
			// Arrange
			const content = `
				<p>Original Size: <strong>45.7 GB</strong></p>
				<p>Repack Size: <strong>22.5 GB</strong></p>
			`;

			// Act
			const result = parseRssContent(content);

			// Assert
			expect(result.size_original).toBe("45.7 GB");
			expect(result.size_repack).toBe("22.5 GB");
		});

		it("should extract MB sizes", () => {
			// Arrange
			const content = `
				<p>Original Size: <strong>500 MB</strong></p>
				<p>Repack Size: <strong>350 MB</strong></p>
			`;

			// Act
			const result = parseRssContent(content);

			// Assert
			expect(result.size_original).toBe("500 MB");
			expect(result.size_repack).toBe("350 MB");
		});

		it("should extract TB sizes", () => {
			// Arrange
			const content = `
				<p>Original Size: <strong>1.2 TB</strong></p>
				<p>Repack Size: <strong>800 GB</strong></p>
			`;

			// Act
			const result = parseRssContent(content);

			// Assert
			expect(result.size_original).toBe("1.2 TB");
			expect(result.size_repack).toBe("800 GB");
		});

		it("should handle 'from' prefix for selective downloads", () => {
			// Arrange
			const content = `
				<p>Original Size: <strong>45 GB</strong></p>
				<p>Repack Size: <strong>from 10.5 GB</strong></p>
			`;

			// Act
			const result = parseRssContent(content);

			// Assert
			expect(result.size_original).toBe("45 GB");
			expect(result.size_repack).toBe("from 10.5 GB");
		});

		it("should return 'Unknown' when sizes are not found", () => {
			// Arrange
			const content = "<p>No size information here</p>";

			// Act
			const result = parseRssContent(content);

			// Assert
			expect(result.size_original).toBe("Unknown");
			expect(result.size_repack).toBe("Unknown");
		});

		it("should handle sizes without strong tags", () => {
			// Arrange
			const content = `
				<p>Original Size: 45 GB</p>
				<p>Repack Size: 22 GB</p>
			`;

			// Act
			const result = parseRssContent(content);

			// Assert
			expect(result.size_original).toBe("45 GB");
			expect(result.size_repack).toBe("22 GB");
		});
	});

	describe("magnet link extraction", () => {
		it("should extract a simple magnet link", () => {
			// Arrange
			const content = `
				<p>Download: <a href="magnet:?xt=urn:btih:abc123def456">Magnet</a></p>
			`;

			// Act
			const result = parseRssContent(content);

			// Assert
			expect(result.magnet_link).toBe("magnet:?xt=urn:btih:abc123def456");
		});

		it("should extract a magnet link with additional parameters", () => {
			// Arrange
			const content = `
				<p>Download: <a href="magnet:?xt=urn:btih:abc123def456&dn=Game+Name&tr=http://tracker.example.com">Magnet</a></p>
			`;

			// Act
			const result = parseRssContent(content);

			// Assert
			expect(result.magnet_link).toBe(
				"magnet:?xt=urn:btih:abc123def456&dn=Game+Name&tr=http://tracker.example.com",
			);
		});

		it("should handle HTML-encoded ampersands", () => {
			// Arrange
			const content = `
				<p>Download: <a href="magnet:?xt=urn:btih:abc123def456&amp;dn=Game+Name&amp;tr=http://tracker.example.com">Magnet</a></p>
			`;

			// Act
			const result = parseRssContent(content);

			// Assert
			expect(result.magnet_link).toBe(
				"magnet:?xt=urn:btih:abc123def456&dn=Game+Name&tr=http://tracker.example.com",
			);
		});

		it("should return undefined when no magnet link is present", () => {
			// Arrange
			const content = `
				<p>Original Size: <strong>45 GB</strong></p>
				<p>No magnet link here</p>
			`;

			// Act
			const result = parseRssContent(content);

			// Assert
			expect(result.magnet_link).toBeUndefined();
		});

		it("should extract magnet link from complex content", () => {
			// Arrange
			const content = `
				<p>Original Size: <strong>45 GB</strong></p>
				<p>Repack Size: <strong>22 GB</strong></p>
				<p>Some other text</p>
				<p><a href="magnet:?xt=urn:btih:1a2b3c4d5e6f7890&dn=The+Game&tr=udp://tracker.opentrackr.org:1337">Click to download</a></p>
			`;

			// Act
			const result = parseRssContent(content);

			// Assert
			expect(result.magnet_link).toBe(
				"magnet:?xt=urn:btih:1a2b3c4d5e6f7890&dn=The+Game&tr=udp://tracker.opentrackr.org:1337",
			);
		});
	});

	describe("combined extraction", () => {
		it("should extract all fields from realistic content", () => {
			// Arrange
			const content = `
				<p><strong>Genres/Tags:</strong> Action, RPG, Open world</p>
				<p><strong>Company:</strong> CD Projekt RED</p>
				<p><strong>Languages:</strong> ENG, RUS</p>
				<p><strong>Original Size:</strong> <strong>75 GB</strong></p>
				<p><strong>Repack Size:</strong> <strong>from 35 GB</strong></p>
				<p><strong>Download Mirrors:</strong></p>
				<p><a href="magnet:?xt=urn:btih:abcdef123456&amp;dn=Cyberpunk+2077&amp;tr=udp://tracker.example.com">Magnet Link</a></p>
			`;

			// Act
			const result = parseRssContent(content);

			// Assert
			expect(result.size_original).toBe("75 GB");
			expect(result.size_repack).toBe("from 35 GB");
			expect(result.magnet_link).toBe(
				"magnet:?xt=urn:btih:abcdef123456&dn=Cyberpunk+2077&tr=udp://tracker.example.com",
			);
		});
	});
});
