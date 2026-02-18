import type { ILogger } from "@xmer/consumer-shared";
import type {
	ISteamRefreshPublisher,
	ISteamRefreshService,
	ISteamService,
	SteamRefreshMessage,
	SteamRefreshServiceOptions,
} from "../types/index.js";

export class SteamRefreshService implements ISteamRefreshService {
	private readonly steamService: ISteamService;
	private readonly publisher: ISteamRefreshPublisher;
	private readonly logger: ILogger;

	constructor(options: SteamRefreshServiceOptions) {
		this.steamService = options.steamService;
		this.publisher = options.publisher;
		this.logger = options.logger.child({ component: "SteamRefreshService" });
	}

	async handleRefresh(message: SteamRefreshMessage): Promise<void> {
		this.logger.info("Processing steam refresh request", {
			gameId: message.gameId,
			correctedName: message.correctedName,
		});

		const steam = await this.steamService.lookupGame(message.correctedName);

		await this.publisher.publishEnriched({
			gameId: message.gameId,
			steam,
			timestamp: new Date().toISOString(),
		});

		this.logger.info("Steam refresh completed", {
			gameId: message.gameId,
			steamFound: steam !== null,
		});
	}
}
