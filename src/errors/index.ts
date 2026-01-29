export class RssFetchError extends Error {
	public readonly url: string;
	public override readonly cause?: Error;

	constructor(message: string, url: string, cause?: Error) {
		super(message);
		this.name = "RssFetchError";
		this.url = url;
		this.cause = cause;
	}
}

export class RssParseError extends Error {
	public override readonly cause?: Error;

	constructor(message: string, cause?: Error) {
		super(message);
		this.name = "RssParseError";
		this.cause = cause;
	}
}

export class SteamApiError extends Error {
	public readonly statusCode?: number;
	public override readonly cause?: Error;

	constructor(message: string, statusCode?: number, cause?: Error) {
		super(message);
		this.name = "SteamApiError";
		this.statusCode = statusCode;
		this.cause = cause;
	}
}
