import type { ILogger } from "@xmer/consumer-shared";
import type {
	IResetService,
	IStateStore,
	ResetMessage,
	ResetServiceOptions,
} from "../types/index.js";

const SERVICE_TARGET = "rss-reader";

export class ResetService implements IResetService {
	private readonly stateStore: IStateStore;
	private readonly logger: ILogger;

	constructor(options: ResetServiceOptions) {
		this.stateStore = options.stateStore;
		this.logger = options.logger.child({ component: "ResetService" });
	}

	async handleReset(message: ResetMessage): Promise<void> {
		const { source, target, reason } = message;

		// Skip if message targets a different service
		if (target && target !== SERVICE_TARGET && target !== "all") {
			this.logger.debug("Reset message not for this service, skipping", {
				source,
				target,
				expectedTarget: SERVICE_TARGET,
			});
			return;
		}

		this.logger.info("Processing reset request", {
			source,
			target: target ?? "all",
			reason,
		});

		const clearedCount = await this.stateStore.clear();

		this.logger.info("Reset complete", {
			source,
			clearedCount,
			reason,
		});
	}
}
