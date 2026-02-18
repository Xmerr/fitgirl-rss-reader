import type {
	BaseConsumerOptions,
	ILogger,
	IPublisher,
} from "@xmer/consumer-shared";
import type { Channel } from "amqplib";
import type { Redis } from "ioredis";

// RSS Feed Types
export interface RssItem {
	guid: string;
	title: string;
	link: string;
	pubDate: string;
	content: string;
	categories: string[];
}

// Parsed Release Types
export interface ParsedTitle {
	game_name: string;
	version?: string;
	dlcs_included: boolean;
	dlc_count?: number;
}

export interface ParsedContent {
	size_original: string;
	size_repack: string;
	magnet_link?: string;
}

// Steam API Types
export interface SteamSearchResult {
	app_id: number;
	name: string;
}

export interface SteamRatings {
	total_positive: number;
	total_negative: number;
	review_score_desc: string;
}

export interface SteamMovie {
	id: number;
	name: string;
	thumbnail: string;
	webm_480?: string;
	webm_max?: string;
}

export interface SteamMedia {
	header_image?: string;
	screenshots?: string[];
	movies?: SteamMovie[];
}

export interface SteamData {
	app_id: number;
	name: string;
	steam_url: string;
	release_date?: string;
	price?: string;
	ratings?: SteamRatings;
	categories?: string[];
	media: SteamMedia;
}

// Message Payload
export interface FitGirlRelease {
	guid: string;
	title_raw: string;
	game_name: string;
	version?: string;
	dlcs_included: boolean;
	dlc_count?: number;
	fitgirl_url: string;
	pub_date: string;
	size_original: string;
	size_repack: string;
	genres?: string[];
	magnet_link?: string;
	steam: SteamData | null;
}

// Enrichment Failure Types
export interface EnrichmentFailure {
	fitgirl_name: string;
	parsed_name: string;
	timestamp: string;
	error: string;
}

// Service Interfaces
export interface IRssPollerService {
	fetchRssFeed(): Promise<RssItem[]>;
}

export interface ISteamService {
	lookupGame(gameName: string): Promise<SteamData | null>;
}

export interface IEnrichmentFailureTracker {
	logFailure(failure: EnrichmentFailure): Promise<void>;
}

export interface IStateStore {
	isNew(guid: string): Promise<boolean>;
	markSeen(guid: string): Promise<void>;
	clear(): Promise<number>;
	close(): Promise<void>;
}

export interface IFitGirlPublisher extends IPublisher {
	startPolling(): void;
	stopPolling(): void;
}

// Constructor Options
export interface RssPollerServiceOptions {
	feedUrl: string;
	logger: ILogger;
}

export interface SteamServiceOptions {
	timeoutMs: number;
	logger: ILogger;
}

export interface EnrichmentFailureTrackerOptions {
	filePath: string;
	logger: ILogger;
}

export interface StateStoreOptions {
	redis: Redis;
	logger: ILogger;
	ttlDays?: number;
}

export interface FitGirlPublisherOptions {
	channel: Channel;
	exchange: string;
	logger: ILogger;
	rssPoller: IRssPollerService;
	stateStore: IStateStore;
	steamService: ISteamService;
	failureTracker: IEnrichmentFailureTracker;
	intervalMs: number;
}

// Config Interface
export interface IConfig {
	rabbitmqUrl: string;
	redisUrl: string;
	pollIntervalMinutes: number;
	rssFeedUrl: string;
	exchangeName: string;
	steamLookupTimeoutMs: number;
	enrichmentFailuresPath: string;
	lokiHost?: string;
	logLevel: string;
}

// Reset Message Types
export interface ResetMessage {
	source: string;
	timestamp: string;
	target?: "rss-reader" | "discord-notifier" | "all";
	reason?: string;
}

export interface IResetService {
	handleReset(message: ResetMessage): Promise<void>;
}

export interface ResetServiceOptions {
	stateStore: IStateStore;
	logger: ILogger;
}

export interface ResetConsumerOptions extends BaseConsumerOptions {
	resetService: IResetService;
}

// Steam Refresh Types
export interface SteamRefreshMessage {
	gameId: number;
	correctedName: string;
	timestamp: string;
}

export interface SteamEnrichedMessage {
	gameId: number;
	steam: SteamData | null;
	timestamp: string;
}

export interface ISteamRefreshService {
	handleRefresh(message: SteamRefreshMessage): Promise<void>;
}

export interface SteamRefreshServiceOptions {
	steamService: ISteamService;
	publisher: ISteamRefreshPublisher;
	logger: ILogger;
}

export interface ISteamRefreshPublisher extends IPublisher {
	publishEnriched(message: SteamEnrichedMessage): Promise<void>;
}

export interface SteamRefreshPublisherOptions {
	channel: Channel;
	exchange: string;
	logger: ILogger;
}

export interface SteamRefreshConsumerOptions extends BaseConsumerOptions {
	steamRefreshService: ISteamRefreshService;
}

// Re-export BaseConsumerOptions for convenience
export type { BaseConsumerOptions } from "@xmer/consumer-shared";
