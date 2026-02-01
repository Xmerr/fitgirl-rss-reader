import { BaseConsumer, NonRetryableError } from "@xmer/consumer-shared";
import type { ConsumeMessage } from "amqplib";
import type {
	IResetService,
	ResetConsumerOptions,
	ResetMessage,
} from "../types/index.js";

export class ResetConsumer extends BaseConsumer {
	private readonly resetService: IResetService;

	constructor(options: ResetConsumerOptions) {
		super(options);
		this.resetService = options.resetService;
	}

	protected async processMessage(
		content: Record<string, unknown>,
		_message: ConsumeMessage,
	): Promise<void> {
		const message = this.validateMessage(content);
		await this.resetService.handleReset(message);
	}

	private validateMessage(content: Record<string, unknown>): ResetMessage {
		if (typeof content.source !== "string" || content.source.length === 0) {
			throw new NonRetryableError(
				"Invalid or missing source field",
				"ERR_INVALID_MESSAGE",
				{ source: content.source },
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

		// Validate optional target field
		if (content.target !== undefined) {
			const validTargets = ["rss-reader", "discord-notifier", "all"];
			if (
				typeof content.target !== "string" ||
				!validTargets.includes(content.target)
			) {
				throw new NonRetryableError(
					"Invalid target field",
					"ERR_INVALID_MESSAGE",
					{ target: content.target, validTargets },
				);
			}
		}

		// Validate optional reason field
		if (content.reason !== undefined && typeof content.reason !== "string") {
			throw new NonRetryableError(
				"Invalid reason field",
				"ERR_INVALID_MESSAGE",
				{ reason: content.reason },
			);
		}

		return content as unknown as ResetMessage;
	}
}
