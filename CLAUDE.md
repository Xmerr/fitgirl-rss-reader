# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FitGirl RSS Reader is a **publisher-only service** that polls the FitGirl Repacks RSS feed at configurable intervals, parses new game releases, enriches them with Steam Store data, and publishes to RabbitMQ. Unlike typical consumer services, this has no inbound message consumption — it's purely a data source.

Uses [`@xmer/consumer-shared`](../consumer-shared/) for RabbitMQ connection management, base publisher abstraction, and logging.

## Commands

```bash
bun run build          # Compile TypeScript to dist/
bun run lint           # Run Biome linter/formatter
bun run lint:fix       # Auto-fix lint issues
bun test               # Run all tests
bun run test:coverage  # Run tests with coverage (95% threshold)
bun run start          # Run service (requires .env file)
```

Run a single test file:
```bash
bun test src/parsers/release-parser.test.ts
```

## Architecture

```
Data Flow:

RSS Feed ──▶ RssPollerService ──▶ FitGirlPublisher ──▶ RabbitMQ
                                        │
                                        ├──▶ StateStore (Redis) - deduplication
                                        ├──▶ SteamService - enrichment
                                        └──▶ EnrichmentFailureTracker - logging
```

### Key Components

- **`src/index.ts`**: Service orchestration. Wires all dependencies, starts polling, registers shutdown handlers.

- **`src/publishers/fitgirl.publisher.ts`**: Extends `BasePublisher`. Orchestrates the poll cycle: fetch RSS -> filter new -> enrich with Steam -> publish. Uses setInterval for polling.

- **`src/services/rss-poller.service.ts`**: Fetches and parses the RSS feed using `rss-parser`. Filters to "Lossless Repack" category only.

- **`src/services/steam.service.ts`**: Steam Store API integration. Searches for games, fetches details and reviews. 5-second timeout, non-fatal failures.

- **`src/services/enrichment-failure-tracker.ts`**: Logs failed Steam lookups to a JSONL file for training data collection.

- **`src/state/state-store.ts`**: Redis-backed deduplication. Tracks seen GUIDs with 90-day TTL to prevent republishing.

- **`src/parsers/release-parser.ts`**: Parses FitGirl title patterns to extract game name, version, DLC info.

- **`src/parsers/content-parser.ts`**: Extracts original/repack sizes and magnet links from HTML content.

- **`src/config/config.ts`**: Environment variable parsing with validation.

### Dependency Injection Pattern

Components receive dependencies via constructor options:

```typescript
const publisher = new FitGirlPublisher({
  channel,           // amqplib Channel
  exchange,          // Exchange name
  logger,            // ILogger from consumer-shared
  rssPoller,         // IRssPollerService
  stateStore,        // IStateStore
  steamService,      // ISteamService
  failureTracker,    // IEnrichmentFailureTracker
  intervalMs,        // Polling interval
});
```

## RabbitMQ Topology

### Exchange

- **Name**: `fitgirl` (configurable via `EXCHANGE_NAME`)
- **Type**: `topic`
- **Durable**: `true`

### Routing Key

| Routing Key | When |
|------------|------|
| `release.new` | When a new game release is published |

### Exchange-to-Exchange Binding

On startup, binds `fitgirl` -> `notifications` on `release.new` for automatic notification forwarding.

## Message Contract

### Produced: `release.new`

```json
{
  "guid": "12345",
  "title_raw": "The Game – v1.2.3 + 5 DLCs",
  "game_name": "The Game",
  "version": "v1.2.3",
  "dlcs_included": true,
  "dlc_count": 5,
  "fitgirl_url": "https://fitgirl-repacks.site/the-game/",
  "pub_date": "2024-01-15T12:00:00.000Z",
  "size_original": "45 GB",
  "size_repack": "22 GB",
  "genres": ["Lossless Repack", "Action"],
  "magnet_link": "magnet:?xt=urn:btih:...",
  "steam": { ... } | null
}
```

## State Management (Redis)

- **Key**: `fitgirl-rss-reader:seen-guids`
- **Type**: Set
- **TTL**: 90 days (refreshed on each add)
- **Operations**: SISMEMBER for checking, SADD for marking seen

## Testing

Uses Bun's built-in test runner with arrange-act-assert pattern.

All external dependencies must be mocked:
- RSS feed fetching (rss-parser)
- Steam API (fetch)
- Redis (ioredis)
- File system (for failure tracker)
- RabbitMQ channel (amqplib)

## TypeScript

- ESM modules with `.js` extensions in imports
- Strict mode with `noUncheckedIndexedAccess`
- Interfaces in `src/types/index.ts`

## Dependencies

### Shared (from `@xmer/consumer-shared`)
- `ConnectionManager` -- RabbitMQ connection lifecycle
- `BasePublisher` -- exchange publishing
- `createLogger` / `ILogger` -- Pino logger with Loki transport

### Service-specific
- `ioredis` -- Redis client for state tracking
- `rss-parser` -- RSS feed parsing

## Environment Variables

Required: `RABBITMQ_URL`, `REDIS_URL`

Optional: `POLL_INTERVAL_MINUTES` (default: 15), `RSS_FEED_URL`, `EXCHANGE_NAME`, `STEAM_LOOKUP_TIMEOUT_MS`, `ENRICHMENT_FAILURES_PATH`, `LOKI_HOST`, `LOG_LEVEL`

See `.env.example` for all options.

## Graceful Shutdown

On SIGTERM or SIGINT:
1. Stop polling interval
2. Wait 2 seconds for in-flight requests
3. Close RabbitMQ connection
4. Close Redis connection
5. Exit
