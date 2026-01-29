import type { ParsedContent } from "../types/index.js";

/**
 * Extracts size information and magnet links from FitGirl RSS content HTML.
 *
 * Expected patterns in content:
 * - Original Size: <strong>45 GB</strong>
 * - Repack Size: <strong>22 GB</strong> or <strong>from 10.5 GB</strong>
 * - Magnet links: magnet:?xt=urn:btih:...
 */
export function parseRssContent(content: string): ParsedContent {
	const originalSize = extractSize(content, "Original Size");
	const repackSize = extractSize(content, "Repack Size");
	const magnetLink = extractMagnetLink(content);

	return {
		size_original: originalSize ?? "Unknown",
		size_repack: repackSize ?? "Unknown",
		magnet_link: magnetLink,
	};
}

function extractSize(content: string, label: string): string | undefined {
	// Pattern: "Label: <strong>VALUE</strong>" or "Label: VALUE"
	// Handle variations like "from X GB" for selective downloads
	// Also handle cases where label itself is in strong tags
	const patterns = [
		// Label in strong tags: <strong>Label:</strong> <strong>VALUE</strong>
		new RegExp(`<strong>${label}:</strong>\\s*<strong>([^<]+)</strong>`, "i"),
		// With strong tags: Label: <strong>VALUE</strong>
		new RegExp(`${label}:\\s*<strong>([^<]+)</strong>`, "i"),
		// Without strong tags
		new RegExp(`${label}:\\s*([\\d.,]+\\s*(?:GB|MB|TB))`, "i"),
		// With "from" prefix (selective downloads)
		new RegExp(`${label}:\\s*<strong>from\\s+([^<]+)</strong>`, "i"),
	];

	for (const pattern of patterns) {
		const match = content.match(pattern);
		if (match?.[1]) {
			return normalizeSize(match[1].trim());
		}
	}

	return undefined;
}

function normalizeSize(size: string): string {
	// Normalize size format: "45 GB", "22.5 GB", etc.
	// Handle "from X GB" by extracting just the size
	const fromMatch = size.match(/^from\s+(.+)$/i);
	if (fromMatch?.[1]) {
		return `from ${fromMatch[1]}`;
	}

	return size;
}

function extractMagnetLink(content: string): string | undefined {
	// Magnet link pattern - extract full magnet URI
	const magnetPattern = /magnet:\?xt=urn:btih:[a-zA-Z0-9]+[^"'\s<>]*/i;
	const match = content.match(magnetPattern);

	if (match?.[0]) {
		// Clean up any HTML entities or trailing characters
		let magnetLink = match[0];

		// Remove any trailing HTML entities like &amp;
		magnetLink = magnetLink.replace(/&amp;/g, "&");

		// Remove any trailing punctuation that got captured
		magnetLink = magnetLink.replace(/[,;.]+$/, "");

		return magnetLink;
	}

	return undefined;
}
