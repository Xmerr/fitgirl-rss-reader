import { BasePublisher } from "@xmer/consumer-shared";
import type { ILogger } from "@xmer/consumer-shared";
import type {
	ISteamRefreshPublisher,
	SteamEnrichedMessage,
	SteamRefreshPublisherOptions,
} from "../types/index.js";

const ROUTING_KEY = "steam.enriched";

export class SteamRefreshPublisher
	extends BasePublisher
	implements ISteamRefreshPublisher
{
	private readonly log: ILogger;

	constructor(options: SteamRefreshPublisherOptions) {
		super(options);
		this.log = options.logger.child({ component: "SteamRefreshPublisher" });
	}

	async publishEnriched(message: SteamEnrichedMessage): Promise<void> {
		await this.publish(
			ROUTING_KEY,
			message as unknown as Record<string, unknown>,
		);
		this.log.info("Published steam enriched message", {
			gameId: message.gameId,
			steamFound: message.steam !== null,
		});
	}
}
