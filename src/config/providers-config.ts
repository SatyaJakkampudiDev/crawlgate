import type { AppEnv, ProviderName } from "../types/env-types.js";

export interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  concurrency: number;
  waitMs: number;
  maxRetries: number;
  timeoutMs: number;
}

export interface FirecrawlConfig extends ProviderConfig {
  maxConcurrency: number;
  pollIntervalMs: number;
}

export type AllProviderConfigs = Record<ProviderName, ProviderConfig> & {
  firecrawl: FirecrawlConfig;
};

const DEFAULT_TIMEOUT_MS = 30_000;

export function resolveProviderConfigs(bindings: AppEnv["Bindings"]): AllProviderConfigs {
  return {
    bee: {
      apiKey: bindings.SCRAPINGBEE_API_KEY,
      baseUrl: "https://app.scrapingbee.com/api/v1",
      concurrency: Number(bindings.SCRAPINGBEE_CONCURRENCY ?? 1),
      waitMs: Number(bindings.SCRAPINGBEE_WAIT_MS ?? 3000),
      maxRetries: Number(bindings.SCRAPINGBEE_MAX_RETRIES ?? 2),
      timeoutMs: DEFAULT_TIMEOUT_MS,
    },
    ant: {
      apiKey: bindings.SCRAPINGANT_API_KEY,
      baseUrl: bindings.SCRAPINGANT_BASE_URL ?? "https://api.scrapingant.com",
      concurrency: Number(bindings.SCRAPINGANT_CONCURRENCY ?? 1),
      waitMs: 0,
      maxRetries: Number(bindings.SCRAPINGANT_MAX_RETRIES ?? 3),
      timeoutMs: DEFAULT_TIMEOUT_MS,
    },
    firecrawl: {
      apiKey: bindings.FIRECRAWL_API_KEY,
      baseUrl: "https://api.firecrawl.dev",
      concurrency: 1,
      waitMs: 0,
      maxRetries: 2,
      timeoutMs: DEFAULT_TIMEOUT_MS,
      maxConcurrency: Number(bindings.FIRECRAWL_MAX_CONCURRENCY ?? 5),
      pollIntervalMs: Number(bindings.FIRECRAWL_POLL_INTERVAL_MS ?? 2000),
    },
  };
}
