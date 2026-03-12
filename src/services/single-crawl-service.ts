import type { AppEnv } from "../types/env-types.js";
import type { CrawlResult, SingleCrawlOptions } from "../types/crawl-types.js";

import { HTTPException } from "hono/http-exception";
import { resolveProviderAdapter } from "../config/provider-registry.js";
import { resolveProviderConfigs } from "../config/providers-config.js";
import { clampConcurrency } from "../helpers/concurrency-helper.js";

/**
 * Crawls a single URL using the resolved provider.
 * Validates the API key is configured before delegating to the provider adapter.
 */
export async function crawlSingleUrl(
  options: SingleCrawlOptions,
  bindings: AppEnv["Bindings"],
): Promise<CrawlResult> {
  const { url, provider, waitMs, useBrowser, maxRetries } = options;

  const configs = resolveProviderConfigs(bindings);
  const adapter = resolveProviderAdapter(provider);
  const config = configs[provider];

  if (!config.apiKey || config.apiKey.trim().length === 0) {
    throw new HTTPException(503, {
      message: `Provider "${provider}" API key is not configured.`,
    });
  }

  console.warn("[SINGLE] Crawling URL", { url, provider, useBrowser });

  const result = await adapter.crawlUrl({
    url,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    waitMs: waitMs ?? config.waitMs,
    useBrowser,
    maxRetries: maxRetries ?? config.maxRetries,
    timeoutMs: config.timeoutMs,
  });

  console.warn("[SINGLE] Done", {
    url,
    provider,
    success: result.markdown !== null,
    durationMs: result.durationMs,
  });

  return result;
}

/**
 * Resolves the provider to use for a single crawl request.
 * Falls back to the configured DEFAULT_PROVIDER binding.
 */
export function resolveSingleProvider(
  requested: string | undefined,
  defaultProvider: string,
): "bee" | "ant" | "firecrawl" {
  const valid = ["bee", "ant", "firecrawl"] as const;
  const candidate = (requested ?? defaultProvider).toLowerCase();
  const found = valid.find(v => v === candidate);
  if (found === undefined) {
    throw new HTTPException(400, {
      message: `Invalid provider "${candidate}". Must be one of: bee, ant, firecrawl.`,
    });
  }
  return found;
}

/**
 * Resolves and clamps the concurrency value for batch operations.
 */
export function resolveConcurrency(requested: number | undefined, configured: string): number {
  const configuredNum = Number(configured ?? 1);
  const value = requested ?? configuredNum;
  return clampConcurrency(value, 1, 5);
}
