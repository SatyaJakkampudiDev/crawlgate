import type { ProviderCrawlOptions } from "../types/provider-types.js";

import type { CrawlResult } from "../types/crawl-types.js";
import Firecrawl from "@mendable/firecrawl-js";

import { mapHttpStatusToReason } from "../helpers/error-mapping-helper.js";
import { buildCrawlResult } from "../helpers/crawl-result-helper.js";

interface FirecrawlCrawlResponse {
  success: boolean;
  markdown?: string;
  error?: string;
}

/**
 * Crawls a single URL using the Firecrawl /scrape endpoint.
 * Firecrawl manages its own concurrency internally — no p-limit needed here.
 */
export async function crawlUrlWithFirecrawl(options: ProviderCrawlOptions): Promise<CrawlResult> {
  const { url, apiKey, timeoutMs } = options;
  const startedAt = Date.now();
  const client = new Firecrawl({ apiKey });
  const isPdf = url.toLowerCase().endsWith(".pdf");

  try {
    const raw = await withTimeout(
      client.scrape(url, { formats: ["markdown"], ...(isPdf && { parsePDF: true }) }),
      timeoutMs,
    );

    const response = raw as FirecrawlCrawlResponse;

    if (!response.success) {
      const reason = response.error ?? "Firecrawl returned unsuccessful status";
      console.warn("[FIRECRAWL] Unsuccessful response", { url, reason });
      return buildCrawlResult({
        url,
        provider: "firecrawl",
        markdown: null,
        statusCode: 422,
        durationMs: Date.now() - startedAt,
        error: reason,
      });
    }

    const markdown = response.markdown ?? null;

    if (markdown === null || markdown.trim().length === 0) {
      return buildCrawlResult({
        url,
        provider: "firecrawl",
        markdown: null,
        statusCode: 200,
        durationMs: Date.now() - startedAt,
        error: "Empty content received",
      });
    }

    return buildCrawlResult({
      url,
      provider: "firecrawl",
      markdown,
      statusCode: 200,
      durationMs: Date.now() - startedAt,
    });
  }
  catch (err: unknown) {
    const reason = mapHttpStatusToReason(500, err);
    console.error("[FIRECRAWL] Crawl error", { url, reason });
    return buildCrawlResult({
      url,
      provider: "firecrawl",
      markdown: null,
      statusCode: 500,
      durationMs: Date.now() - startedAt,
      error: reason,
    });
  }
}

/**
 * Wraps a promise with a hard timeout.
 * Rejects with a timeout error after `ms` milliseconds.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Firecrawl request timed out after ${ms}ms`)), ms),
    ),
  ]);
}
