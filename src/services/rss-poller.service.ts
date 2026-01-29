import type { ILogger } from "@xmer/consumer-shared";
import Parser from "rss-parser";
import { RssFetchError, RssParseError } from "../errors/index.js";
import type {
	IRssPollerService,
	RssItem,
	RssPollerServiceOptions,
} from "../types/index.js";

interface CustomFeedItem {
	guid?: string;
	title?: string;
	link?: string;
	pubDate?: string;
	"content:encoded"?: string;
	categories?: string[];
}

const LOSSLESS_REPACK_CATEGORY = "Lossless Repack";

export class RssPollerService implements IRssPollerService {
	private readonly feedUrl: string;
	private readonly log: ILogger;
	private readonly parser: Parser<Record<string, unknown>, CustomFeedItem>;

	constructor(options: RssPollerServiceOptions) {
		this.feedUrl = options.feedUrl;
		this.log = options.logger.child({ component: "RssPollerService" });
		this.parser = new Parser<Record<string, unknown>, CustomFeedItem>({
			customFields: {
				item: ["content:encoded"],
			},
		});
	}

	async fetchRssFeed(): Promise<RssItem[]> {
		this.log.debug("Fetching RSS feed", { url: this.feedUrl });

		let feed: Parser.Output<CustomFeedItem>;
		try {
			feed = await this.parser.parseURL(this.feedUrl);
		} catch (error) {
			throw new RssFetchError(
				`Failed to fetch RSS feed: ${error instanceof Error ? error.message : String(error)}`,
				this.feedUrl,
				error instanceof Error ? error : undefined,
			);
		}

		if (!feed.items) {
			throw new RssParseError("RSS feed contains no items");
		}

		const items = this.filterAndMapItems(feed.items);
		this.log.info("Fetched RSS feed", {
			totalItems: feed.items.length,
			losslessRepacks: items.length,
		});

		return items;
	}

	private filterAndMapItems(items: CustomFeedItem[]): RssItem[] {
		return items
			.filter((item) => this.isLosslessRepack(item))
			.map((item) => this.mapToRssItem(item))
			.filter((item): item is RssItem => item !== null);
	}

	private isLosslessRepack(item: CustomFeedItem): boolean {
		if (!item.categories) {
			return false;
		}
		return item.categories.some(
			(category) =>
				category.toLowerCase() === LOSSLESS_REPACK_CATEGORY.toLowerCase(),
		);
	}

	private mapToRssItem(item: CustomFeedItem): RssItem | null {
		// Extract WordPress post ID from guid
		// Format: "https://fitgirl-repacks.site/?p=12345"
		const guid = this.extractGuid(item.guid);
		if (!guid) {
			this.log.warn("Skipping item without valid guid", {
				title: item.title,
			});
			return null;
		}

		if (!item.title) {
			this.log.warn("Skipping item without title", { guid });
			return null;
		}

		return {
			guid,
			title: item.title,
			link: item.link ?? "",
			pubDate: item.pubDate ?? new Date().toISOString(),
			content: item["content:encoded"] ?? "",
			categories: item.categories ?? [],
		};
	}

	private extractGuid(rawGuid: string | undefined): string | null {
		if (!rawGuid) {
			return null;
		}

		// Try to extract post ID from WordPress permalink format
		const match = rawGuid.match(/[?&]p=(\d+)/);
		if (match?.[1]) {
			return match[1];
		}

		// If not a WordPress format, use the full guid
		return rawGuid;
	}
}
