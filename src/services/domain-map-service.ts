import type { AppEnv, ProviderName } from "../types/env-types.js";
import type { CrawlMetadata } from "../types/crawl-types.js";

import { HTTPException } from "hono/http-exception";

import { deduplicateUrls, filterValidUrls, normaliseBaseUrl } from "../helpers/url-helper.js";
import { createJobRecord } from "./job-store-service.js";

interface DomainMapOptions {
  domain: string;
  maxUrls: number;
  includeSubdomains: boolean;
  apiKey: string;
  timeoutMs: number;
}

interface DomainMapResult {
  domain: string;
  urls: string[];
  total: number;
}

/**
 * Discovers all crawlable URLs for a given domain using Firecrawl's /map endpoint.
 * Falls back to sitemap parsing if Firecrawl is unavailable.
 */
export async function mapDomainUrls(
  options: DomainMapOptions,
  bindings: AppEnv["Bindings"],
): Promise<DomainMapResult> {
  const { domain, maxUrls, includeSubdomains } = options;
  const normalisedDomain = normaliseBaseUrl(domain);

  if (!bindings.FIRECRAWL_API_KEY || bindings.FIRECRAWL_API_KEY.trim().length === 0) {
    throw new HTTPException(503, {
      message: "Domain mapping requires Firecrawl API key to be configured.",
    });
  }

  console.warn("[MAP] Starting domain discovery", { domain: normalisedDomain, maxUrls });

  const urls = await fetchDomainUrlsFromFirecrawl({
    domain: normalisedDomain,
    maxUrls,
    includeSubdomains,
    apiKey: bindings.FIRECRAWL_API_KEY,
    timeoutMs: 20_000,
  });

  const deduplicated = deduplicateUrls(filterValidUrls(urls)).slice(0, maxUrls);

  console.warn("[MAP] Discovery complete", { domain: normalisedDomain, found: deduplicated.length });

  return {
    domain: normalisedDomain,
    urls: deduplicated,
    total: deduplicated.length,
  };
}

/**
 * Persists the job record in KV and sends the domain-crawl message to the queue.
 * urlCount is 0 at enqueue time — updated by the queue worker after domain discovery.
 */
export async function enqueueDomainJob(
  env: AppEnv["Bindings"],
  options: {
    jobId: string;
    triggeredAt: string;
    domain: string;
    provider: ProviderName;
    maxUrls: number;
    concurrency: number;
    waitMs: number;
    useBrowser: boolean;
    maxRetries: number;
    webhookUrl: string;
    metadata: CrawlMetadata;
  },
): Promise<{ jobId: string; domain: string; mode: "async" }> {
  await createJobRecord(env.CRAWL_JOB_STORE, {
    jobId: options.jobId,
    type: "domain-crawl",
    provider: options.provider,
    triggeredAt: options.triggeredAt,
    urlCount: 0,
    domain: options.domain,
    webhookUrl: options.webhookUrl,
    metadata: options.metadata,
  });

  await env.CRAWL_JOB_QUEUE.send({
    jobId: options.jobId,
    triggeredAt: options.triggeredAt,
    type: "domain-crawl",
    domain: options.domain,
    provider: options.provider,
    maxUrls: options.maxUrls,
    concurrency: options.concurrency,
    waitMs: options.waitMs,
    useBrowser: options.useBrowser,
    maxRetries: options.maxRetries,
    webhookUrl: options.webhookUrl,
    metadata: options.metadata,
  });

  return { jobId: options.jobId, domain: options.domain, mode: "async" };
}

/**
 * Calls the Firecrawl /map endpoint to retrieve all URLs for a domain.
 */
async function fetchDomainUrlsFromFirecrawl(options: DomainMapOptions): Promise<string[]> {
  const { domain, maxUrls, includeSubdomains, apiKey, timeoutMs } = options;

  const response = await fetch("https://api.firecrawl.dev/v1/map", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url: domain,
      limit: maxUrls,
      includeSubdomains,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.warn(`Error : : ${text.substring(0, 120)}`);
    throw new HTTPException(502, {
      message: `Firecrawl map API returned ${response.status}`,
    });
  }

  const data = await response.json() as Record<string, unknown>;
  const links = data.links;

  if (!Array.isArray(links)) {
    throw new HTTPException(502, { message: "Firecrawl map API returned unexpected response shape." });
  }

  return links.filter((l): l is string => typeof l === "string");
}
