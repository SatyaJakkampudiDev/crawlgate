import type { CrawlMetadata, CrawlResult } from "../types/crawl-types.js";
import type { WebhookDeliveryOptions, WebhookDeliveryResult, WebhookPayload } from "../types/webhook-types.js";

import { computeBackoffMs } from "../helpers/error-mapping-helper.js";
import { sleep } from "../helpers/retry-helper.js";
import { deriveCrawlStatus } from "../helpers/crawl-result-helper.js";
import { buildWebhookPayload } from "../helpers/webhook-helper.js";

interface DeliverCrawlResultOptions {
  jobId: string;
  webhookUrl: string;
  results: CrawlResult[];
  metadata: CrawlMetadata;
  triggeredAt: string;
  webhookSecret: string;
  maxRetries: number;
  retryBaseMs: number;
}

/**
 * Builds the signed payload and delivers it to the caller's webhookUrl.
 * Retries with exponential backoff on transient failures.
 * Should be called inside ctx.waitUntil() so it does not block the HTTP response.
 */
export async function deliverCrawlResult(options: DeliverCrawlResultOptions): Promise<WebhookDeliveryResult> {
  const { jobId, webhookUrl, results, metadata, triggeredAt, webhookSecret, maxRetries, retryBaseMs } = options;

  const completedAt = new Date().toISOString();
  const status = deriveCrawlStatus(results);

  const payload = await buildWebhookPayload({
    jobId,
    status,
    results,
    metadata,
    triggeredAt,
    completedAt,
    secret: webhookSecret,
  });

  return deliverWebhook({
    webhookUrl,
    payload,
    secret: webhookSecret,
    maxRetries,
    retryBaseMs,
  });
}

/**
 * Attempts to POST the webhook payload to the destination URL with retries.
 */
async function deliverWebhook(options: WebhookDeliveryOptions): Promise<WebhookDeliveryResult> {
  const { webhookUrl, payload, maxRetries, retryBaseMs } = options;
  const body = JSON.stringify(payload);

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Scraping-Signature": payload.signature,
          "X-Scraping-Job-Id": payload.jobId,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok) {
        console.warn("[WEBHOOK] Delivered", { jobId: payload.jobId, attempt, status: response.status });
        return { success: true, attempts: attempt, finalStatusCode: response.status };
      }

      if (!isRetryableWebhookStatus(response.status) || attempt > maxRetries) {
        console.error("[WEBHOOK] Non-retryable failure", { jobId: payload.jobId, attempt, status: response.status });
        return { success: false, attempts: attempt, finalStatusCode: response.status, error: `HTTP ${response.status}` };
      }

      const delayMs = computeBackoffMs(attempt, retryBaseMs);
      console.warn("[WEBHOOK] Retrying", { jobId: payload.jobId, attempt, delayMs, status: response.status });
      await sleep(delayMs);
    }
    catch (err: unknown) {
      if (attempt > maxRetries) {
        const error = err instanceof Error ? err.message : String(err);
        console.error("[WEBHOOK] Max retries exceeded", { jobId: payload.jobId, attempt, error });
        return { success: false, attempts: attempt, error };
      }

      const delayMs = computeBackoffMs(attempt, retryBaseMs);
      console.warn("[WEBHOOK] Network error, retrying", { jobId: payload.jobId, attempt, delayMs });
      await sleep(delayMs);
    }
  }

  return { success: false, attempts: maxRetries + 1, error: "Max retries exceeded" };
}

/**
 * Returns true if the HTTP status code is transient and worth retrying.
 */
function isRetryableWebhookStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

/**
 * Resolves webhook config values from bindings, applying safe defaults.
 */
export function resolveWebhookConfig(bindings: { WEBHOOK_SECRET: string; WEBHOOK_MAX_RETRIES: string; WEBHOOK_RETRY_BASE_MS: string }): {
  secret: string;
  maxRetries: number;
  retryBaseMs: number;
} {
  return {
    secret: bindings.WEBHOOK_SECRET,
    maxRetries: Number(bindings.WEBHOOK_MAX_RETRIES ?? 3),
    retryBaseMs: Number(bindings.WEBHOOK_RETRY_BASE_MS ?? 2000),
  };
}

/**
 * Builds a signed webhook payload for an async job that failed before scraping started.
 * Used when queue processing encounters a fatal error.
 */
export async function buildFailurePayload(
  jobId: string,
  triggeredAt: string,
  metadata: CrawlMetadata,
  secret: string,
): Promise<WebhookPayload> {
  const completedAt = new Date().toISOString();
  return buildWebhookPayload({
    jobId,
    status: "failed",
    results: [],
    metadata,
    triggeredAt,
    completedAt,
    secret,
  });
}
