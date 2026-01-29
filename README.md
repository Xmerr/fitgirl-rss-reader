# FitGirl RSS Reader

A publisher-only microservice that polls the FitGirl Repacks RSS feed at configurable intervals, parses new game releases, enriches them with Steam Store data, and publishes to RabbitMQ.

## Links

- [GitHub](https://github.com/Xmerr/fitgirl-rss-reader)
- [Docker Hub](https://hub.docker.com/r/xmer/fitgirl-rss-reader)

## Quick Start

```bash
docker run -d \
  -e RABBITMQ_URL=amqp://user:pass@host:5672 \
  -e REDIS_URL=redis://host:6379 \
  -v ./data:/app/data \
  xmer/fitgirl-rss-reader:latest
```

## Docker Compose

```yaml
services:
  fitgirl-rss-reader:
    image: xmer/fitgirl-rss-reader:latest
    restart: unless-stopped
    environment:
      - RABBITMQ_URL=amqp://user:pass@rabbitmq:5672
      - REDIS_URL=redis://redis:6379
      - POLL_INTERVAL_MINUTES=15
      - LOKI_HOST=http://loki:3100
    volumes:
      - ./data:/app/data
    networks:
      - rabbitmq_network

networks:
  rabbitmq_network:
    external: true
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RABBITMQ_URL` | Yes | - | AMQP connection URI |
| `REDIS_URL` | Yes | - | Redis connection URI for state tracking |
| `POLL_INTERVAL_MINUTES` | No | `15` | How often to poll the RSS feed |
| `RSS_FEED_URL` | No | `https://fitgirl-repacks.site/feed/` | RSS feed URL to poll |
| `EXCHANGE_NAME` | No | `fitgirl` | RabbitMQ exchange name |
| `STEAM_LOOKUP_TIMEOUT_MS` | No | `5000` | Timeout for Steam API requests |
| `ENRICHMENT_FAILURES_PATH` | No | `/app/data/enrichment-failures.jsonl` | Path to log failed Steam lookups |
| `LOKI_HOST` | No | - | Grafana Loki endpoint for logging |
| `LOG_LEVEL` | No | `info` | Log level (debug, info, warn, error) |

## Volumes

| Volume | Required | Description |
|--------|----------|-------------|
| `/app/data` | No | Persistent storage for enrichment failure logs |

## RabbitMQ Topology

### Exchange

- **Name**: `fitgirl` (configurable)
- **Type**: `topic`
- **Durable**: `true`

### Routing Key

- `release.new` - Published when a new game release is detected

### Exchange-to-Exchange Binding

On startup, the service binds `fitgirl` -> `notifications` on `release.new` so releases are automatically forwarded to the notifications exchange.

## Message Payload

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
  "genres": ["Lossless Repack", "Action", "RPG"],
  "magnet_link": "magnet:?xt=urn:btih:...",
  "steam": {
    "app_id": 12345,
    "name": "The Game",
    "steam_url": "https://store.steampowered.com/app/12345",
    "release_date": "Jan 1, 2024",
    "price": "$29.99",
    "ratings": {
      "total_positive": 1000,
      "total_negative": 100,
      "review_score_desc": "Very Positive"
    },
    "categories": ["Single-player", "Multi-player"],
    "media": {
      "header_image": "https://cdn.steam.com/header.jpg",
      "screenshots": ["https://cdn.steam.com/ss1.jpg"],
      "movies": [{
        "id": 1,
        "name": "Trailer",
        "thumbnail": "https://cdn.steam.com/thumb.jpg",
        "webm_480": "https://cdn.steam.com/480.webm",
        "webm_max": "https://cdn.steam.com/max.webm"
      }]
    }
  }
}
```

Note: `steam` will be `null` if the game couldn't be found on Steam.

## How It Works

1. **RSS Polling**: Fetches the FitGirl RSS feed at the configured interval
2. **Filtering**: Only processes items with "Lossless Repack" category
3. **Deduplication**: Checks Redis to skip previously seen releases (by GUID)
4. **Title Parsing**: Extracts game name, version, and DLC info from the title
5. **Content Parsing**: Extracts original/repack sizes and magnet links from HTML
6. **Steam Enrichment**: Looks up the game on Steam for additional metadata
7. **Publishing**: Publishes the enriched release to RabbitMQ
8. **State Tracking**: Marks the GUID as seen in Redis (90-day TTL)

## Enrichment Failure Tracking

When Steam lookup fails, the service logs the failure to a JSONL file for later analysis. This helps improve the title parser over time.

Example failure entry:
```json
{"fitgirl_name":"Test Game – v1.0","parsed_name":"Test Game","timestamp":"2024-01-15T12:00:00.000Z","error":"Game not found on Steam"}
```

## Local Development

```bash
# Install dependencies
bun install

# Run linting
bun run lint

# Run tests
bun test

# Run tests with coverage
bun run test:coverage

# Build TypeScript
bun run build

# Start the service (requires .env file)
bun run start
```

## How to Run

1. Copy `.env.example` to `.env`
2. Fill in your RabbitMQ and Redis URLs
3. Run with Docker Compose: `docker compose up -d`
