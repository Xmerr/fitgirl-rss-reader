import type { ILogger } from "@xmer/consumer-shared";
import type { Redis } from "ioredis";
import type { IStateStore, StateStoreOptions } from "../types/index.js";

const DEFAULT_TTL_DAYS = 90;
const REDIS_KEY = "fitgirl-rss-reader:seen-guids";

export class StateStore implements IStateStore {
	private readonly redis: Redis;
	private readonly log: ILogger;
	private readonly ttlSeconds: number;

	constructor(options: StateStoreOptions) {
		this.redis = options.redis;
		this.log = options.logger.child({ component: "StateStore" });
		this.ttlSeconds = (options.ttlDays ?? DEFAULT_TTL_DAYS) * 24 * 60 * 60;
	}

	async isNew(guid: string): Promise<boolean> {
		const isMember = await this.redis.sismember(REDIS_KEY, guid);
		return isMember === 0;
	}

	async markSeen(guid: string): Promise<void> {
		await this.redis.sadd(REDIS_KEY, guid);
		// Refresh TTL on the set to prevent it from expiring while actively being used
		await this.redis.expire(REDIS_KEY, this.ttlSeconds);
		this.log.debug("Marked guid as seen", { guid });
	}

	async clear(): Promise<number> {
		const count = await this.redis.scard(REDIS_KEY);
		await this.redis.del(REDIS_KEY);
		this.log.info("State cleared", { clearedCount: count });
		return count;
	}

	async close(): Promise<void> {
		await this.redis.quit();
		this.log.info("Redis connection closed");
	}
}
