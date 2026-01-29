import type { ParsedTitle } from "../types/index.js";

/**
 * Parses FitGirl release titles into structured data.
 *
 * Title patterns:
 * - Simple: "Game Name"
 * - With version: "Game Name – v1.2.3" or "Game Name - v1.2.3"
 * - With DLCs: "Game Name + 5 DLCs" or "Game Name, v1.0 + 46 DLCs"
 * - Combined: "Game Name – v1.2.3 + 10 DLCs"
 * - Build versions: "Game Name – Build 12345678"
 * - Edition bundles: "Game: X-Year Anniversary Edition" → "Game"
 * - GOG releases: "Game, GOG Build abc123" → "Game"
 */
export function parseReleaseTitle(title: string): ParsedTitle {
	let workingTitle = title.trim();
	let version: string | undefined;
	let dlcs_included = false;
	let dlc_count: number | undefined;

	// Strip bonus content patterns first (+ Bonus Content, + Bonus OST, etc.)
	workingTitle = workingTitle
		.replace(/\s*\+\s*Bonus\s+(?:Content|OSTs?|Soundtrack)s?\s*$/i, "")
		.trim();

	// Strip "+ Chill Nature Beats Soundtrack" and similar bonus audio (before DLC extraction)
	workingTitle = workingTitle
		.replace(/\s*\+\s*[\w\s]+Soundtrack\s*$/i, "")
		.trim();

	// Strip GOG/Steam build identifiers: ", GOG Build abc123" or "GOG Build 12345"
	const gogBuildMatch = workingTitle.match(
		/[,\s]+GOG\s+Build\s+[a-f0-9]+\s*$/i,
	);
	if (gogBuildMatch) {
		workingTitle = workingTitle.slice(0, gogBuildMatch.index).trim();
	}

	// Extract DLC count - match "+ N DLC" or "+ N DLCs" pattern
	const dlcMatch = workingTitle.match(/\s*\+\s*(\d+)\s*DLCs?\s*$/i);
	if (dlcMatch?.[1]) {
		dlcs_included = true;
		dlc_count = Number.parseInt(dlcMatch[1], 10);
		workingTitle = workingTitle.slice(0, dlcMatch.index).trim();
	}

	// Check for "All DLCs" or similar patterns
	const allDlcMatch = workingTitle.match(/\s*\+\s*(?:All\s+)?DLCs?\s*$/i);
	if (allDlcMatch) {
		dlcs_included = true;
		workingTitle = workingTitle.slice(0, allDlcMatch.index).trim();
	}

	// Extract version - multiple patterns:
	// "– v1.2.3", "- v1.2.3", ", v1.2.3", "– Build 12345678"
	const versionPatterns = [
		// Version with v prefix: "– v1.2.3.4" or "- v1.2.3"
		/\s*[–\-,]\s*(v[\d.]+(?:\.\d+)*)/i,
		// Build number: "– Build 12345678"
		/\s*[–\-,]\s*(Build\s*\d+)/i,
		// Version without v prefix after separator: "– 1.2.3"
		/\s*[–\-]\s*(\d+\.\d+(?:\.\d+)*)/,
	];

	for (const pattern of versionPatterns) {
		const versionMatch = workingTitle.match(pattern);
		if (versionMatch?.[1]) {
			version = versionMatch[1];
			workingTitle = workingTitle.slice(0, versionMatch.index).trim();
			break;
		}
	}

	// Clean up any trailing commas or separators
	workingTitle = workingTitle.replace(/[,\-–]+\s*$/, "").trim();

	// Strip "Bundle" suffix from game names (but keep preceding subtitle)
	// "Disco Elysium: The Final Cut Bundle" → "Disco Elysium: The Final Cut"
	workingTitle = workingTitle.replace(/\s+Bundle\s*$/i, "").trim();

	// Strip FitGirl edition suffixes that aren't real Steam names
	// ": X-Year Anniversary Edition" → removed
	workingTitle = workingTitle
		.replace(/:\s*\d+-Year\s+Anniversary\s+Edition\s*$/i, "")
		.trim();

	return {
		game_name: workingTitle,
		version,
		dlcs_included,
		dlc_count,
	};
}
