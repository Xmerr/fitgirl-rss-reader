/**
 * Test script to fetch RSS feed, enrich with Steam data, and log results.
 * Does not connect to Redis or RabbitMQ.
 *
 * Usage: bun run test:feed
 */

import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { parseRssContent } from "../parsers/content-parser.js";
import { parseReleaseTitle } from "../parsers/release-parser.js";
import { RssPollerService } from "../services/rss-poller.service.js";
import { SteamService } from "../services/steam.service.js";
import type {
	EnrichmentFailure,
	FitGirlRelease,
	RssItem,
} from "../types/index.js";

const RSS_FEED_URL = "https://fitgirl-repacks.site/feed/";
const STEAM_TIMEOUT_MS = 5000;
const FAILURES_OUTPUT_PATH = "./data/enrichment-failures.jsonl";

const logger = {
	debug: (msg: string, data?: unknown) =>
		console.log(`[DEBUG] ${msg}`, data ?? ""),
	info: (msg: string, data?: unknown) =>
		console.log(`[INFO] ${msg}`, data ?? ""),
	warn: (msg: string, data?: unknown) =>
		console.warn(`[WARN] ${msg}`, data ?? ""),
	error: (msg: string, data?: unknown) =>
		console.error(`[ERROR] ${msg}`, data ?? ""),
	child: () => logger,
};

interface BuildResult {
	release: FitGirlRelease;
	failure: EnrichmentFailure | null;
}

async function buildRelease(
	item: RssItem,
	steamService: SteamService,
): Promise<BuildResult> {
	const parsedTitle = parseReleaseTitle(item.title);
	const parsedContent = parseRssContent(item.content);

	console.log(`\n  Enriching "${parsedTitle.game_name}" via Steam...`);
	const steamData = await steamService.lookupGame(parsedTitle.game_name);

	let failure: EnrichmentFailure | null = null;

	if (steamData) {
		console.log(
			`  ✓ Found on Steam: ${steamData.name} (${steamData.steam_url})`,
		);
	} else {
		console.log("  ✗ Not found on Steam");
		failure = {
			fitgirl_name: item.title,
			parsed_name: parsedTitle.game_name,
			timestamp: new Date().toISOString(),
			error: "Game not found on Steam",
		};
	}

	return {
		release: {
			guid: item.guid,
			title_raw: item.title,
			game_name: parsedTitle.game_name,
			version: parsedTitle.version,
			dlcs_included: parsedTitle.dlcs_included,
			dlc_count: parsedTitle.dlc_count,
			fitgirl_url: item.link,
			pub_date: new Date(item.pubDate).toISOString(),
			size_original: parsedContent.size_original,
			size_repack: parsedContent.size_repack,
			genres: item.categories.length > 0 ? item.categories : undefined,
			magnet_link: parsedContent.magnet_link,
			steam: steamData,
		},
		failure,
	};
}

async function main(): Promise<void> {
	console.log("=".repeat(60));
	console.log("FitGirl RSS Reader - Test Feed");
	console.log("=".repeat(60));

	const rssPoller = new RssPollerService({
		feedUrl: RSS_FEED_URL,
		logger,
	});

	const steamService = new SteamService({
		timeoutMs: STEAM_TIMEOUT_MS,
		logger,
	});

	console.log(`\nFetching RSS feed from ${RSS_FEED_URL}...`);
	const items = await rssPoller.fetchRssFeed();
	console.log(`Found ${items.length} Lossless Repack items\n`);

	const releases: FitGirlRelease[] = [];
	const failures: EnrichmentFailure[] = [];

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		if (!item) continue;

		console.log(`\n[${i + 1}/${items.length}] Processing: ${item.title}`);
		const result = await buildRelease(item, steamService);
		releases.push(result.release);
		if (result.failure) {
			failures.push(result.failure);
		}
	}

	console.log(`\n${"=".repeat(60)}`);
	console.log("RESULTS - What would have been published:");
	console.log("=".repeat(60));

	for (const release of releases) {
		console.log(`\n${"─".repeat(50)}`);
		console.log(`Game: ${release.game_name}`);
		console.log(`Title (raw): ${release.title_raw}`);
		if (release.version) console.log(`Version: ${release.version}`);
		if (release.dlcs_included)
			console.log(`DLCs: ${release.dlc_count ?? "Yes"}`);
		console.log(`Original Size: ${release.size_original}`);
		console.log(`Repack Size: ${release.size_repack}`);
		console.log(`FitGirl URL: ${release.fitgirl_url}`);
		console.log(`Has Magnet: ${release.magnet_link ? "Yes" : "No"}`);
		if (release.steam) {
			console.log(`Steam: ${release.steam.name} (ID: ${release.steam.app_id})`);
			if (release.steam.price) console.log(`  Price: ${release.steam.price}`);
			if (release.steam.ratings) {
				console.log(`  Rating: ${release.steam.ratings.review_score_desc}`);
			}
		} else {
			console.log("Steam: Not found");
		}
	}

	console.log(`\n${"─".repeat(50)}`);
	console.log(`\nTotal: ${releases.length} releases`);
	console.log(`Steam enriched: ${releases.filter((r) => r.steam).length}`);
	console.log(`Steam not found: ${releases.filter((r) => !r.steam).length}`);

	// Write failures to file
	if (failures.length > 0) {
		await mkdir(dirname(FAILURES_OUTPUT_PATH), { recursive: true });
		const lines = `${failures.map((f) => JSON.stringify(f)).join("\n")}\n`;
		await appendFile(FAILURES_OUTPUT_PATH, lines, "utf-8");
		console.log(`\nFailures written to: ${FAILURES_OUTPUT_PATH}`);
	}
}

main().catch((error) => {
	console.error("Error:", error);
	process.exit(1);
});
