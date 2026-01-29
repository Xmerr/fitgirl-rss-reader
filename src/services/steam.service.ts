import type { ILogger } from "@xmer/consumer-shared";
import { SteamApiError } from "../errors/index.js";
import type {
	ISteamService,
	SteamData,
	SteamMedia,
	SteamMovie,
	SteamRatings,
	SteamServiceOptions,
} from "../types/index.js";

interface SteamSearchResponse {
	total: number;
	items: Array<{
		id: number;
		name: string;
	}>;
}

interface SteamAppDetailsResponse {
	[appId: string]:
		| {
				success: boolean;
				data?: {
					steam_appid: number;
					name: string;
					release_date?: {
						coming_soon: boolean;
						date: string;
					};
					is_free?: boolean;
					price_overview?: {
						final_formatted: string;
					};
					recommendations?: {
						total: number;
					};
					categories?: Array<{
						id: number;
						description: string;
					}>;
					header_image?: string;
					screenshots?: Array<{
						id: number;
						path_full: string;
					}>;
					movies?: Array<{
						id: number;
						name: string;
						thumbnail: string;
						webm?: {
							"480"?: string;
							max?: string;
						};
					}>;
				};
		  }
		| undefined;
}

interface SteamReviewsResponse {
	success: number;
	query_summary?: {
		total_positive: number;
		total_negative: number;
		review_score_desc: string;
	};
}

const STEAM_SEARCH_URL = "https://store.steampowered.com/api/storesearch/";
const STEAM_DETAILS_URL = "https://store.steampowered.com/api/appdetails";
const STEAM_REVIEWS_URL = "https://store.steampowered.com/appreviews/";

export class SteamService implements ISteamService {
	private readonly timeoutMs: number;
	private readonly log: ILogger;

	constructor(options: SteamServiceOptions) {
		this.timeoutMs = options.timeoutMs;
		this.log = options.logger.child({ component: "SteamService" });
	}

	async lookupGame(gameName: string): Promise<SteamData | null> {
		try {
			const appId = await this.searchGame(gameName);
			if (!appId) {
				this.log.debug("Game not found on Steam", { gameName });
				return null;
			}

			const [details, reviews] = await Promise.all([
				this.getAppDetails(appId),
				this.getAppReviews(appId),
			]);

			if (!details) {
				this.log.debug("Could not fetch app details", { appId, gameName });
				return null;
			}

			return this.buildSteamData(appId, details, reviews);
		} catch (error) {
			if (error instanceof SteamApiError) {
				this.log.warn("Steam API error", { gameName, error: error.message });
			} else {
				this.log.warn("Unexpected error during Steam lookup", {
					gameName,
					error: error instanceof Error ? error.message : String(error),
				});
			}
			return null;
		}
	}

	private async searchGame(gameName: string): Promise<number | null> {
		const url = new URL(STEAM_SEARCH_URL);
		url.searchParams.set("term", gameName);
		url.searchParams.set("cc", "us");

		const response = await this.fetchWithTimeout(url.toString());
		if (!response.ok) {
			throw new SteamApiError(
				`Search request failed: ${response.statusText}`,
				response.status,
			);
		}

		const data = (await response.json()) as SteamSearchResponse;
		if (!data.items || data.items.length === 0) {
			return null;
		}

		// Return the first match
		const firstItem = data.items[0];
		return firstItem?.id ?? null;
	}

	private async getAppDetails(
		appId: number,
	): Promise<SteamAppDetailsResponse[string] | null> {
		const url = new URL(STEAM_DETAILS_URL);
		url.searchParams.set("appids", appId.toString());

		const response = await this.fetchWithTimeout(url.toString());
		if (!response.ok) {
			throw new SteamApiError(
				`Details request failed: ${response.statusText}`,
				response.status,
			);
		}

		const data = (await response.json()) as SteamAppDetailsResponse;
		const appData = data[appId.toString()];

		if (!appData?.success || !appData.data) {
			return null;
		}

		return appData;
	}

	private async getAppReviews(
		appId: number,
	): Promise<SteamReviewsResponse | null> {
		const url = `${STEAM_REVIEWS_URL}${appId}?json=1&language=all&purchase_type=all`;

		try {
			const response = await this.fetchWithTimeout(url);
			if (!response.ok) {
				return null;
			}

			const data = (await response.json()) as SteamReviewsResponse;
			if (data.success !== 1) {
				return null;
			}

			return data;
		} catch {
			// Reviews are optional, don't throw
			return null;
		}
	}

	private buildSteamData(
		appId: number,
		appData: NonNullable<SteamAppDetailsResponse[string]>,
		reviews: SteamReviewsResponse | null,
	): SteamData {
		const data = appData.data;
		if (!data) {
			throw new SteamApiError("Missing app data in response");
		}

		let price: string | undefined;
		if (data.is_free) {
			price = "Free to Play";
		} else if (data.price_overview?.final_formatted) {
			price = data.price_overview.final_formatted;
		}

		let ratings: SteamRatings | undefined;
		if (reviews?.query_summary) {
			ratings = {
				total_positive: reviews.query_summary.total_positive,
				total_negative: reviews.query_summary.total_negative,
				review_score_desc: reviews.query_summary.review_score_desc,
			};
		}

		const categories = data.categories?.map((c) => c.description);

		const media: SteamMedia = {
			header_image: data.header_image,
			screenshots: data.screenshots?.map((s) => s.path_full),
			movies: data.movies?.map(
				(m): SteamMovie => ({
					id: m.id,
					name: m.name,
					thumbnail: m.thumbnail,
					webm_480: m.webm?.["480"],
					webm_max: m.webm?.max,
				}),
			),
		};

		return {
			app_id: appId,
			name: data.name,
			steam_url: `https://store.steampowered.com/app/${appId}`,
			release_date: data.release_date?.date,
			price,
			ratings,
			categories,
			media,
		};
	}

	private async fetchWithTimeout(url: string): Promise<Response> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

		try {
			return await fetch(url, { signal: controller.signal });
		} catch (error) {
			if (error instanceof Error && error.name === "AbortError") {
				throw new SteamApiError(`Request timed out after ${this.timeoutMs}ms`);
			}
			throw error;
		} finally {
			clearTimeout(timeoutId);
		}
	}
}
