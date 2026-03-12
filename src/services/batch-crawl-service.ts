import type { AppEnv } from "../types/env-types.js";

import type { BatchJobOptions } from "../types/job-types.js";
import type { BatchJobResponse, BatchCrawlOptions, CrawlResult } from "../types/crawl-types.js";
import { HTTPException } from "hono/http-exception";

import { resolveProviderAdapter } from "../config/provider-registry.js";
import { resolveProviderConfigs } from "../config/providers-config.js";
import { clampConcurrency, runConcurrent } from "../helpers/concurrency-helper.js";
import { deriveCrawlStatus, partitionResults } from "../helpers/crawl-result-helper.js";
import { createJobRecord } from "./job-store-service.js";
import { deliverCrawlResult, resolveWebhookConfig } from "./webhook-delivery-service.js";

/**
 * Executes a batch crawl using the selected provider and concurrency settings.
 * Results are returned in the same order as the input URL list.
 */
export async function runBatchCrawl(
  options: BatchCrawlOptions,
  bindings: AppEnv["Bindings"],
): Promise<CrawlResult[]> {
  const { urls, provider, concurrency, waitMs, useBrowser, maxRetries } = options;

  const configs = resolveProviderConfigs(bindings);
  const adapter = resolveProviderAdapter(provider);
  const config = configs[provider];

  if (!config.apiKey || config.apiKey.trim().length === 0) {
    throw new HTTPException(503, {
      message: `Provider "${provider}" API key is not configured.`,
    });
  }

  const effectiveConcurrency = clampConcurrency(concurrency, 1, 5);

  console.warn("[BATCH] Starting", {
    urlCount: urls.length,
    provider,
    concurrency: effectiveConcurrency,
  });

  const tasks = urls.map(url => () =>
    adapter.crawlUrl({
      url,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      waitMs: waitMs ?? config.waitMs,
      useBrowser,
      maxRetries: maxRetries ?? config.maxRetries,
      timeoutMs: config.timeoutMs,
    }),
  );

  const results = await runConcurrent({
    tasks,
    concurrency: effectiveConcurrency,
    onTaskComplete: (result, index) => {
      const success = result.markdown !== null;
      console.warn("[BATCH] URL done", {
        index,
        url: result.url,
        success,
        durationMs: result.durationMs,
      });
    },
  });

  const { successful, failed } = partitionResults(results);

  console.warn("[BATCH] Complete", {
    total: results.length,
    successful: successful.length,
    failed: failed.length,
    provider,
  });

  return results;
}

/**
 * Persists the job record in KV and sends the message to the queue.
 * Returns the standard async batch job response.
 */
export async function enqueueBatchJob(
  env: AppEnv["Bindings"],
  options: BatchJobOptions,
): Promise<BatchJobResponse> {
  await createJobRecord(env.CRAWL_JOB_STORE, {
    jobId: options.jobId,
    type: "batch-crawl",
    provider: options.provider,
    triggeredAt: options.triggeredAt,
    urlCount: options.urls.length,
    ...(options.webhookUrl !== undefined && { webhookUrl: options.webhookUrl }),
    metadata: options.metadata,
  });

  await env.CRAWL_JOB_QUEUE.send({
    jobId: options.jobId,
    triggeredAt: options.triggeredAt,
    urls: options.urls,
    provider: options.provider,
    concurrency: options.concurrency,
    waitMs: options.waitMs,
    useBrowser: options.useBrowser,
    maxRetries: options.maxRetries,
    webhookUrl: options.webhookUrl,
    metadata: options.metadata,
  });

  return {
    jobId: options.jobId,
    mode: "async",
    status: "queued",
    urlCount: options.urls.length,
    successCount: null,
    failedCount: null,
    results: null,
  };
}

/**
 * Runs a batch crawl inline, fires the webhook non-blocking if provided,
 * and returns the standard sync batch job response.
 */
export async function runSyncBatchCrawl(
  ctx: ExecutionContext,
  env: AppEnv["Bindings"],
  options: BatchJobOptions,
): Promise<BatchJobResponse> {
  const results = await runBatchCrawl(
    {
      urls: options.urls,
      provider: options.provider,
      concurrency: options.concurrency,
      waitMs: options.waitMs,
      useBrowser: options.useBrowser,
      maxRetries: options.maxRetries,
      metadata: options.metadata,
    },
    env,
  );

  if (options.webhookUrl !== undefined) {
    const webhookConfig = resolveWebhookConfig(env);
    ctx.waitUntil(
      deliverCrawlResult({
        jobId: options.jobId,
        webhookUrl: options.webhookUrl,
        results,
        metadata: options.metadata,
        triggeredAt: options.triggeredAt,
        webhookSecret: webhookConfig.secret,
        maxRetries: webhookConfig.maxRetries,
        retryBaseMs: webhookConfig.retryBaseMs,
      }),
    );
  }

  return {
    jobId: options.jobId,
    mode: "sync",
    status: deriveCrawlStatus(results),
    urlCount: options.urls.length,
    successCount: results.filter(r => r.markdown !== null).length,
    failedCount: results.filter(r => r.markdown === null).length,
    results,
  };
}

/**
 * Determines whether a batch job should run synchronously (return results inline)
 * or asynchronously (enqueue and return a jobId).
 */
export function determineBatchMode(
  urlCount: number,
  webhookUrl: string | undefined,
  syncThreshold: string,
): "sync" | "async" {
  const threshold = Number(syncThreshold ?? 10);
  if (webhookUrl !== undefined && webhookUrl.length > 0)
    return "async";
  if (urlCount > threshold)
    return "async";
  return "sync";
}
