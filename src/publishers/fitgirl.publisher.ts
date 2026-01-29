import { BasePublisher } from "@xmer/consumer-shared";
import type { ILogger } from "@xmer/consumer-shared";
import { parseRssContent } from "../parsers/content-parser.js";
import { parseReleaseTitle } from "../parsers/release-parser.js";
import type {
	FitGirlPublisherOptions,
	FitGirlRelease,
	IEnrichmentFailureTracker,
	IFitGirlPublisher,
	IRssPollerService,
	IStateStore,
	ISteamService,
	RssItem,
} from "../types/index.js";

const ROUTING_KEY = "release.new";

export class FitGirlPublisher
	extends BasePublisher
	implements IFitGirlPublisher
{
	private readonly rssPoller: IRssPollerService;
	private readonly stateStore: IStateStore;
	private readonly steamService: ISteamService;
	private readonly failureTracker: IEnrichmentFailureTracker;
	private readonly intervalMs: number;
	private readonly log: ILogger;
	private intervalId: ReturnType<typeof setInterval> | null = null;

	constructor(options: FitGirlPublisherOptions) {
		super(options);
		this.rssPoller = options.rssPoller;
		this.stateStore = options.stateStore;
		this.steamService = options.steamService;
		this.failureTracker = options.failureTracker;
		this.intervalMs = options.intervalMs;
		this.log = options.logger.child({ component: "FitGirlPublisher" });
	}

	startPolling(): void {
		// Run immediately on start
		void this.pollAndPublish();

		// Then run on interval
		this.intervalId = setInterval(() => {
			void this.pollAndPublish();
		}, this.intervalMs);

		this.log.info("Polling started", {
			intervalMs: this.intervalMs,
			intervalMinutes: this.intervalMs / 60000,
		});
	}

	stopPolling(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
		this.log.info("Polling stopped");
	}

	private async pollAndPublish(): Promise<void> {
		try {
			const items = await this.rssPoller.fetchRssFeed();
			const newItems = await this.filterNewItems(items);

			if (newItems.length === 0) {
				this.log.debug("No new releases found");
				return;
			}

			this.log.info("Processing new releases", { count: newItems.length });

			for (const item of newItems) {
				await this.processAndPublish(item);
			}
		} catch (error) {
			this.log.error("Poll cycle failed", {
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	private async filterNewItems(items: RssItem[]): Promise<RssItem[]> {
		const newItems: RssItem[] = [];

		for (const item of items) {
			const isNew = await this.stateStore.isNew(item.guid);
			if (isNew) {
				newItems.push(item);
			}
		}

		return newItems;
	}

	private async processAndPublish(item: RssItem): Promise<void> {
		try {
			const release = await this.buildRelease(item);
			await this.publish(
				ROUTING_KEY,
				release as unknown as Record<string, unknown>,
			);
			await this.stateStore.markSeen(item.guid);

			this.log.info("Published release", {
				guid: release.guid,
				game_name: release.game_name,
				steam_found: release.steam !== null,
			});
		} catch (error) {
			this.log.error("Failed to process release", {
				guid: item.guid,
				title: item.title,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	private async buildRelease(item: RssItem): Promise<FitGirlRelease> {
		const parsedTitle = parseReleaseTitle(item.title);
		const parsedContent = parseRssContent(item.content);

		// Attempt Steam enrichment (non-blocking failure)
		const steamData = await this.steamService.lookupGame(parsedTitle.game_name);

		// Log enrichment failure for training data
		if (!steamData) {
			await this.failureTracker.logFailure({
				fitgirl_name: item.title,
				parsed_name: parsedTitle.game_name,
				timestamp: new Date().toISOString(),
				error: "Game not found on Steam",
			});
		}

		return {
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
		};
	}
}
