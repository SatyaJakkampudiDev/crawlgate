import type { ProviderName } from "../types/env-types.js";
import type { ProviderAdapter } from "../types/provider-types.js";

import { crawlUrlWithFirecrawl } from "../providers/firecrawl-provider.js";
import { crawlUrlWithAnt } from "../providers/scraping-ant-provider.js";
import { crawlUrlWithBee } from "../providers/scraping-bee-provider.js";

/**
 * Central registry of all crawling provider adapters.
 * To add a new provider: implement CrawlUrlFn and register it here.
 * Zero other files need to change.
 */
const PROVIDER_REGISTRY: Record<ProviderName, ProviderAdapter> = {
  bee: {
    name: "bee",
    executionMode: "sync-parallel",
    crawlUrl: crawlUrlWithBee,
  },
  ant: {
    name: "ant",
    executionMode: "sync-parallel",
    crawlUrl: crawlUrlWithAnt,
  },
  firecrawl: {
    name: "firecrawl",
    executionMode: "sync-parallel",
    crawlUrl: crawlUrlWithFirecrawl,
  },
};

/**
 * Resolves the adapter for a given provider name.
 * Throws if the provider is not registered (should never happen given Zod validation upstream).
 */
export function resolveProviderAdapter(name: ProviderName): ProviderAdapter {
  const adapter = PROVIDER_REGISTRY[name];
  if (adapter === undefined) {
    throw new Error(`[REGISTRY] Unknown provider: ${name}`);
  }
  return adapter;
}
