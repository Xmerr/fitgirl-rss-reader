import { BaseConsumer, NonRetryableError } from "@xmer/consumer-shared";
import type { ConsumeMessage } from "amqplib";
import type {
	ISteamRefreshService,
	SteamRefreshConsumerOptions,
	SteamRefreshMessage,
} from "../types/index.js";

export class SteamRefreshConsumer extends BaseConsumer {
	private readonly steamRefreshService: ISteamRefreshService;

	constructor(options: SteamRefreshConsumerOptions) {
		super(options);
		this.steamRefreshService = options.steamRefreshService;
	}

	protected async processMessage(
		content: Record<string, unknown>,
		_message: ConsumeMessage,
	): Promise<void> {
		const message = this.validateMessage(content);
		await this.steamRefreshService.handleRefresh(message);
	}

	private validateMessage(
		content: Record<string, unknown>,
	): SteamRefreshMessage {
		if (typeof content.gameId !== "number") {
			throw new NonRetryableError(
				"Invalid or missing gameId field",
				"ERR_INVALID_MESSAGE",
				{ gameId: content.gameId },
			);
		}

		if (
			typeof content.correctedName !== "string" ||
			content.correctedName.length === 0
		) {
			throw new NonRetryableError(
				"Invalid or missing correctedName field",
				"ERR_INVALID_MESSAGE",
				{ correctedName: content.correctedName },
			);
		}

		if (
			typeof content.timestamp !== "string" ||
			content.timestamp.length === 0
		) {
			throw new NonRetryableError(
				"Invalid or missing timestamp field",
				"ERR_INVALID_MESSAGE",
				{ timestamp: content.timestamp },
			);
		}

		return content as unknown as SteamRefreshMessage;
	}
}
