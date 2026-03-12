export type ProviderName = "bee" | "ant" | "firecrawl";

/**
 * Cloudflare Workers environment bindings.
 * Variables  → set by middleware, accessed via c.var.*
 * Bindings   → CF bindings + secrets, accessed via c.env.*
 */
export interface AppEnv {
  Variables: {
    requestId: string;
  };
  Bindings: {
    // Queue bindings
    CRAWL_JOB_QUEUE: Queue;

    // KV bindings
    CRAWL_JOB_STORE: KVNamespace;

    // Provider API keys
    SCRAPINGBEE_API_KEY: string;
    SCRAPINGANT_API_KEY: string;
    FIRECRAWL_API_KEY: string;

    // Provider tuning (all strings — CF Workers env vars)
    SCRAPINGANT_BASE_URL: string;
    SCRAPINGBEE_CONCURRENCY: string;
    SCRAPINGBEE_WAIT_MS: string;
    SCRAPINGBEE_MAX_RETRIES: string;
    SCRAPINGANT_CONCURRENCY: string;
    SCRAPINGANT_MAX_RETRIES: string;
    FIRECRAWL_MAX_CONCURRENCY: string;
    FIRECRAWL_POLL_INTERVAL_MS: string;

    // Service auth
    SERVICE_TOKEN: string;

    // Webhook
    WEBHOOK_SECRET: string;
    WEBHOOK_MAX_RETRIES: string;
    WEBHOOK_RETRY_BASE_MS: string;

    // Routing
    DEFAULT_PROVIDER: string;
    SYNC_BATCH_THRESHOLD: string;

    // App
    ENVIRONMENT: string;
  };
}
