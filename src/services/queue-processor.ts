import type { AppEnv, ProviderName } from "../types/env-types.js";
import type { CrawlMetadata } from "../types/crawl-types.js";

import { deriveCrawlStatus } from "../helpers/crawl-result-helper.js";
import { runBatchCrawl } from "./batch-crawl-service.js";
import { mapDomainUrls } from "./domain-map-service.js";
import { extractFailedUrls, updateJobRecord } from "./job-store-service.js";
import { buildFailurePayload, deliverCrawlResult, resolveWebhookConfig } from "./webhook-delivery-service.js";

interface BatchCrawlQueueMessage {
  type?: "batch-crawl" | "domain-crawl";
  jobId: string;
  triggeredAt: string;
  urls?: string[];
  domain?: string;
  provider: ProviderName;
  concurrency: number;
  waitMs: number;
  useBrowser: boolean;
  maxRetries: number;
  maxUrls?: number;
  webhookUrl?: string;
  metadata: CrawlMetadata;
}

/**
 * Processes a single queue message end-to-end:
 * resolves URLs → crawls → updates job store → delivers webhook.
 * Each message is self-contained and independently retryable.
 */
export async function processQueueMessage(
  message: Message<unknown>,
  bindings: AppEnv["Bindings"],
): Promise<void> {
  const body = message.body as BatchCrawlQueueMessage;
  const { jobId, triggeredAt, provider, concurrency, waitMs, useBrowser, maxRetries, webhookUrl, metadata } = body;
  const webhookConfig = resolveWebhookConfig(bindings);

  console.warn("[QUEUE] Processing message", { jobId, type: body.type ?? "batch-crawl" });

  // Mark job as processing — retryable: if KV is unavailable no crawling has started yet.
  try {
    await updateJobRecord(bindings.CRAWL_JOB_STORE, jobId, { status: "processing" });
  }
  catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[QUEUE] KV unavailable during status update — will retry", { jobId, error });
    message.retry();
    return;
  }

  let urls: string[];

  // Phase 1: URL resolution — retryable (no crawling has happened yet)
  try {
    urls = await resolveUrlsForMessage(body, bindings);
  }
  catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[QUEUE] URL resolution failed — will retry", { jobId, error });
    message.retry();
    return;
  }

  if (urls.length === 0) {
    console.warn("[QUEUE] No URLs to crawl", { jobId });
    await updateJobRecord(bindings.CRAWL_JOB_STORE, jobId, {
      status: "failed",
      completedAt: new Date().toISOString(),
      successCount: 0,
      failedCount: 0,
      error: "No URLs resolved for this job.",
    });
    if (webhookUrl !== undefined) {
      const payload = await buildFailurePayload(jobId, triggeredAt, metadata, webhookConfig.secret);
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Scraping-Signature": payload.signature },
        body: JSON.stringify(payload),
      });
    }
    message.ack();
    return;
  }

  // Phase 2: Crawl + record + webhook — ack regardless (no re-crawling on retry)
  try {
    const results = await runBatchCrawl(
      { urls, provider, concurrency, waitMs, useBrowser, maxRetries, metadata },
      bindings,
    );

    const completedAt = new Date().toISOString();
    const status = deriveCrawlStatus(results);
    const successCount = results.filter(r => r.markdown !== null && r.error === undefined).length;
    const failedCount = results.length - successCount;
    const failedUrls = extractFailedUrls(results);

    // KV update first — job outcome is persisted regardless of webhook result.
    await updateJobRecord(bindings.CRAWL_JOB_STORE, jobId, {
      status,
      completedAt,
      successCount,
      failedCount,
      failedUrls,
    });

    message.ack();
    console.warn("[QUEUE] Message processed", { jobId, status, resultCount: results.length });

    // Webhook delivery after ack — a delivery failure cannot corrupt the job status.
    if (webhookUrl !== undefined) {
      await deliverCrawlResult({
        jobId,
        webhookUrl,
        results,
        metadata,
        triggeredAt,
        webhookSecret: webhookConfig.secret,
        maxRetries: webhookConfig.maxRetries,
        retryBaseMs: webhookConfig.retryBaseMs,
      });
    }
  }
  catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[QUEUE] Crawl phase failed — acking to prevent re-crawl", { jobId, error });

    await updateJobRecord(bindings.CRAWL_JOB_STORE, jobId, {
      status: "failed",
      completedAt: new Date().toISOString(),
      error,
    });

    // Ack (not retry) — crawling may have partially completed.
    // Re-delivering would re-crawl all URLs and waste provider credits.
    message.ack();
  }
}

/**
 * Resolves the list of URLs to crawl from a queue message.
 * For batch-crawl messages, uses the provided URL list directly.
 * For domain-crawl messages, runs domain discovery first.
 */
async function resolveUrlsForMessage(
  body: BatchCrawlQueueMessage,
  bindings: AppEnv["Bindings"],
): Promise<string[]> {
  if (body.type === "domain-crawl" && body.domain !== undefined) {
    const mapResult = await mapDomainUrls(
      {
        domain: body.domain,
        maxUrls: body.maxUrls ?? 100,
        includeSubdomains: false,
        apiKey: bindings.FIRECRAWL_API_KEY,
        timeoutMs: 20_000,
      },
      bindings,
    );
    return mapResult.urls;
  }

  return body.urls ?? [];
}
