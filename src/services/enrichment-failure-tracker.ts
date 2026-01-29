import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { ILogger } from "@xmer/consumer-shared";
import type {
	EnrichmentFailure,
	EnrichmentFailureTrackerOptions,
	IEnrichmentFailureTracker,
} from "../types/index.js";

export class EnrichmentFailureTracker implements IEnrichmentFailureTracker {
	private readonly filePath: string;
	private readonly log: ILogger;
	private dirEnsured = false;

	constructor(options: EnrichmentFailureTrackerOptions) {
		this.filePath = options.filePath;
		this.log = options.logger.child({ component: "EnrichmentFailureTracker" });
	}

	async logFailure(failure: EnrichmentFailure): Promise<void> {
		try {
			await this.ensureDirectory();

			const line = `${JSON.stringify(failure)}\n`;
			await appendFile(this.filePath, line, "utf-8");

			this.log.debug("Logged enrichment failure", {
				fitgirl_name: failure.fitgirl_name,
				parsed_name: failure.parsed_name,
			});
		} catch (error) {
			this.log.warn("Failed to log enrichment failure", {
				error: error instanceof Error ? error.message : String(error),
				filePath: this.filePath,
			});
		}
	}

	private async ensureDirectory(): Promise<void> {
		if (this.dirEnsured) {
			return;
		}

		const dir = dirname(this.filePath);
		try {
			await mkdir(dir, { recursive: true });
			this.dirEnsured = true;
		} catch (error) {
			// Directory might already exist, which is fine
			if (
				error instanceof Error &&
				"code" in error &&
				error.code === "EEXIST"
			) {
				this.dirEnsured = true;
				return;
			}
			throw error;
		}
	}
}
