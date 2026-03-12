import type { ProviderCrawlOptions } from "../types/provider-types.js";
import type { CrawlResult } from "../types/crawl-types.js";

import { computeBackoffMs, isRetryableStatus, mapHttpStatusToReason } from "../helpers/error-mapping-helper.js";
import { sleep } from "../helpers/retry-helper.js";
import { buildCrawlResult } from "../helpers/crawl-result-helper.js";

/**
 * Crawls a single URL using the ScrapingAnt Markdown API.
 * Handles 403 (bot detection) and 409 (rate limit) with exponential backoff.
 * Returns a normalised CrawlResult.
 */
export async function crawlUrlWithAnt(options: ProviderCrawlOptions): Promise<CrawlResult> {
  const { url, apiKey, baseUrl, useBrowser, maxRetries, timeoutMs } = options;
  const startedAt = Date.now();

  const requestUrl = buildRequestUrl(url, apiKey, baseUrl, useBrowser);

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const response = await fetch(requestUrl.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });

      const statusCode = response.status;

      if (isRetryableStatus(statusCode) && attempt <= maxRetries) {
        const delayMs = computeBackoffMs(attempt, 500);
        console.warn("[ANT] Retryable status, backing off", { url, statusCode, attempt, delayMs });
        await sleep(delayMs);
        continue;
      }

      if (statusCode < 200 || statusCode >= 300) {
        const reason = await extractErrorReason(response, statusCode);
        return buildCrawlResult({ url, provider: "ant", markdown: null, statusCode, durationMs: Date.now() - startedAt, error: reason });
      }

      const data = await response.json() as Record<string, unknown>;
      const markdown = typeof data.markdown === "string" ? data.markdown : null;

      if (markdown === null || markdown.trim().length === 0) {
        return buildCrawlResult({ url, provider: "ant", markdown: null, statusCode, durationMs: Date.now() - startedAt, error: "Empty content received" });
      }

      return buildCrawlResult({ url, provider: "ant", markdown, statusCode, durationMs: Date.now() - startedAt });
    }
    catch (err: unknown) {
      if (attempt <= maxRetries) {
        const delayMs = computeBackoffMs(attempt, 500);
        console.warn("[ANT] Error, retrying", { url, attempt, delayMs, error: err instanceof Error ? err.message : String(err) });
        await sleep(delayMs);
        continue;
      }

      const reason = mapHttpStatusToReason(500, err);
      console.error("[ANT] Crawl failed", { url, attempt, reason });
      return buildCrawlResult({ url, provider: "ant", markdown: null, statusCode: 500, durationMs: Date.now() - startedAt, error: reason });
    }
  }

  return buildCrawlResult({ url, provider: "ant", markdown: null, statusCode: 500, durationMs: Date.now() - startedAt, error: "Max retries exceeded" });
}

function buildRequestUrl(url: string, apiKey: string, baseUrl: string, useBrowser: boolean): URL {
  const requestUrl = new URL(`${baseUrl}/v2/markdown`);
  requestUrl.searchParams.set("url", url);
  requestUrl.searchParams.set("x-api-key", apiKey);
  requestUrl.searchParams.set("browser", String(useBrowser));
  return requestUrl;
}

async function extractErrorReason(response: Response, statusCode: number): Promise<string> {
  try {
    const data = await response.json() as Record<string, unknown>;
    const detail = data.detail ?? data.message;
    if (typeof detail === "string" && detail.length > 0)
      return detail;
  }
  catch {
    const text = await response.text().catch(() => "");
    if (text.length > 0)
      return `HTTP ${statusCode}: ${text.substring(0, 120)}`;
  }
  return mapHttpStatusToReason(statusCode);
}
