import type { CrawlResult, CrawlStatus } from "../types/crawl-types.js";

import { extractHostname } from "./url-helper.js";

interface BuildCrawlResultOptions {
  url: string;
  provider: string;
  markdown: string | null;
  statusCode: number;
  durationMs: number;
  error?: string;
}

/**
 * Constructs a normalised CrawlResult object.
 * Single source of truth — every provider uses this to build results.
 */
export function buildCrawlResult(options: BuildCrawlResultOptions): CrawlResult {
  const { url, provider, markdown, statusCode, durationMs, error } = options;
  return {
    url,
    hostname: extractHostname(url),
    markdown,
    statusCode,
    provider,
    durationMs,
    ...(error !== undefined && { error }),
  };
}

/**
 * Decodes a Uint8Array response body into a markdown string.
 * Returns null if decoding fails or the result is empty/whitespace.
 */
export function decodeResponseBytes(data: unknown): string | null {
  try {
    if (data === null || data === undefined)
      return null;
    const text = new TextDecoder().decode(data as BufferSource);
    return text.trim().length > 0 ? text : null;
  }
  catch (err) {
    console.error("[RESULT] Failed to decode response bytes:", err);
    return null;
  }
}

/**
 * Derives an overall CrawlStatus from a list of results.
 * completed  → all results have markdown
 * partial    → some results have markdown
 * failed     → no results have markdown
 */
export function deriveCrawlStatus(results: CrawlResult[]): CrawlStatus {
  if (results.length === 0)
    return "failed";
  const successCount = results.filter(r => r.markdown !== null && r.error === undefined).length;
  if (successCount === 0)
    return "failed";
  if (successCount === results.length)
    return "completed";
  return "partial";
}

/**
 * Separates a results array into successful and failed buckets.
 */
export function partitionResults(results: CrawlResult[]): {
  successful: CrawlResult[];
  failed: CrawlResult[];
} {
  const successful = results.filter(r => r.markdown !== null && r.error === undefined);
  const failed = results.filter(r => r.markdown === null || r.error !== undefined);
  return { successful, failed };
}
