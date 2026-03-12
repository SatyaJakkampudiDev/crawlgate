import type { ProviderCrawlOptions } from "../types/provider-types.js";

import type { CrawlResult } from "../types/crawl-types.js";
import ScrapingBee from "scrapingbee";

import { computeBackoffMs, isRetryableStatus, mapHttpStatusToReason } from "../helpers/error-mapping-helper.js";
import { sleep } from "../helpers/retry-helper.js";
import { buildCrawlResult, decodeResponseBytes } from "../helpers/crawl-result-helper.js";

/**
 * Crawls a single URL using the ScrapingBee API.
 * Handles JS rendering, retries on transient errors, and returns a normalised CrawlResult.
 */
export async function crawlUrlWithBee(options: ProviderCrawlOptions): Promise<CrawlResult> {
  const { url, apiKey, waitMs, useBrowser, maxRetries, timeoutMs } = options;
  const startedAt = Date.now();
  const client = new ScrapingBee.ScrapingBeeClient(apiKey);

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const response = await client.get({
        url,
        params: {
          return_page_markdown: true,
          render_js: useBrowser,
          wait: waitMs,
          timeout: timeoutMs,
        },
      });

      const statusCode = response.status ?? 200;

      if (statusCode < 200 || statusCode >= 300) {
        if (isRetryableStatus(statusCode) && attempt <= maxRetries) {
          const delayMs = computeBackoffMs(attempt, 500);
          console.warn("[BEE] Retryable status, backing off", { url, statusCode, attempt, delayMs });
          await sleep(delayMs);
          continue;
        }
        const reason = mapHttpStatusToReason(statusCode);
        return buildCrawlResult({ url, provider: "bee", markdown: null, statusCode, durationMs: Date.now() - startedAt, error: reason });
      }

      const markdown = decodeResponseBytes(response.data);
      if (markdown === null) {
        return buildCrawlResult({ url, provider: "bee", markdown: null, statusCode, durationMs: Date.now() - startedAt, error: "Empty or undecodable content received" });
      }

      return buildCrawlResult({ url, provider: "bee", markdown, statusCode, durationMs: Date.now() - startedAt });
    }
    catch (err: unknown) {
      const statusCode = (err as Record<string, unknown>)?.status as number | undefined ?? 500;

      if (isRetryableStatus(statusCode) && attempt <= maxRetries) {
        const delayMs = computeBackoffMs(attempt, 500);
        console.warn("[BEE] Error, retrying", { url, statusCode, attempt, delayMs });
        await sleep(delayMs);
        continue;
      }

      const reason = mapHttpStatusToReason(statusCode, err);
      console.error("[BEE] Crawl failed", { url, statusCode, attempt, reason });
      return buildCrawlResult({ url, provider: "bee", markdown: null, statusCode, durationMs: Date.now() - startedAt, error: reason });
    }
  }

  return buildCrawlResult({ url, provider: "bee", markdown: null, statusCode: 500, durationMs: Date.now() - startedAt, error: "Max retries exceeded" });
}
