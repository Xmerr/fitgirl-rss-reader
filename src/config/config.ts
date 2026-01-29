import type { IConfig } from "../types/index.js";

const DEFAULT_FEED_URL = "https://fitgirl-repacks.site/feed/";
const DEFAULT_EXCHANGE_NAME = "fitgirl";
const DEFAULT_POLL_INTERVAL_MINUTES = 15;
const DEFAULT_STEAM_TIMEOUT_MS = 5000;
const DEFAULT_ENRICHMENT_PATH = "/app/data/enrichment-failures.jsonl";
const DEFAULT_LOG_LEVEL = "info";

export class Config implements IConfig {
	readonly rabbitmqUrl: string;
	readonly redisUrl: string;
	readonly pollIntervalMinutes: number;
	readonly rssFeedUrl: string;
	readonly exchangeName: string;
	readonly steamLookupTimeoutMs: number;
	readonly enrichmentFailuresPath: string;
	readonly lokiHost?: string;
	readonly logLevel: string;

	constructor(env: Record<string, string | undefined> = process.env) {
		const rabbitmqUrl = env.RABBITMQ_URL;
		if (!rabbitmqUrl) {
			throw new Error("RABBITMQ_URL is required");
		}
		this.rabbitmqUrl = rabbitmqUrl;

		const redisUrl = env.REDIS_URL;
		if (!redisUrl) {
			throw new Error("REDIS_URL is required");
		}
		this.redisUrl = redisUrl;

		this.pollIntervalMinutes = this.parsePositiveInt(
			env.POLL_INTERVAL_MINUTES,
			DEFAULT_POLL_INTERVAL_MINUTES,
		);
		this.rssFeedUrl = env.RSS_FEED_URL ?? DEFAULT_FEED_URL;
		this.exchangeName = env.EXCHANGE_NAME ?? DEFAULT_EXCHANGE_NAME;
		this.steamLookupTimeoutMs = this.parsePositiveInt(
			env.STEAM_LOOKUP_TIMEOUT_MS,
			DEFAULT_STEAM_TIMEOUT_MS,
		);
		this.enrichmentFailuresPath =
			env.ENRICHMENT_FAILURES_PATH ?? DEFAULT_ENRICHMENT_PATH;
		this.lokiHost = env.LOKI_HOST;
		this.logLevel = env.LOG_LEVEL ?? DEFAULT_LOG_LEVEL;
	}

	private parsePositiveInt(
		value: string | undefined,
		defaultValue: number,
	): number {
		if (!value) return defaultValue;
		const parsed = Number.parseInt(value, 10);
		if (Number.isNaN(parsed) || parsed <= 0) {
			return defaultValue;
		}
		return parsed;
	}
}
